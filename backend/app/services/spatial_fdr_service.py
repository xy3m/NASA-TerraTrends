"""Vectorized gridded Mann-Kendall + Spatial False Discovery Rate (BH/BY/Holm/Bonferroni).

Implements Wilks (2016, BAMS) spatial field significance control over gridded
climate data cubes (T, H, W), rendering crisp RGBA heatmap PNG previews alongside
per-cell trend and corrected q-value matrices.
"""

from __future__ import annotations

import base64
import io
from typing import Literal, Optional

import numpy as np
from PIL import Image
from scipy import stats
from statsmodels.stats.multitest import multipletests


def _build_synthetic_climate_cube(
    *,
    center_lat: float,
    center_lon: float,
    rows: int,
    cols: int,
    n_years: int,
    seed: int,
) -> tuple[np.ndarray, list[float], list[float], str]:
    """Create a realistic spatio-temporal anomaly grid (n_years, rows, cols)."""
    rng = np.random.default_rng(seed)
    lat_span = 14.0
    lon_span = 22.0
    lats = np.linspace(max(-88.0, center_lat - lat_span / 2), min(88.0, center_lat + lat_span / 2), rows)
    lons = np.linspace(center_lon - lon_span / 2, center_lon + lon_span / 2, cols)
    lon_grid, lat_grid = np.meshgrid(lons, lats)

    t = np.arange(n_years, dtype=float)
    t_norm = t - np.mean(t)

    # Polar/regional warming dipole + realistic spatial AR noise
    amp_boost = 1.6 if abs(center_lat) > 55 else 1.0
    core1 = np.exp(-(((lat_grid - (center_lat + 1.5)) / 4.2) ** 2 + ((lon_grid - (center_lon - 2.5)) / 5.5) ** 2))
    core2 = 0.72 * np.exp(-(((lat_grid - (center_lat - 2.2)) / 3.8) ** 2 + ((lon_grid - (center_lon + 4.0)) / 5.2) ** 2))
    cooling_pocket = -0.32 * np.exp(-(((lat_grid - (center_lat - 3.5)) / 2.6) ** 2 + ((lon_grid - (center_lon - 4.5)) / 3.2) ** 2))

    slope_per_year = amp_boost * (0.065 * core1 + 0.052 * core2 + 0.03 * cooling_pocket)

    # Correlated spatial noise at each time step (3x3 box smoothing in space)
    noise = rng.normal(0.0, 0.34, size=(n_years, rows, cols))
    for k in range(n_years):
        padded = np.pad(noise[k], 1, mode="edge")
        noise[k] = (
            padded[:-2, :-2] + padded[:-2, 1:-1] + padded[:-2, 2:]
            + padded[1:-1, :-2] + 2.0 * padded[1:-1, 1:-1] + padded[1:-1, 2:]
            + padded[2:, :-2] + padded[2:, 1:-1] + padded[2:, 2:]
        ) / 10.0 * 1.45

    # Baseline climatology gradient + trend + noise
    baseline = 12.0 - 0.45 * np.abs(lat_grid)
    cube = baseline[None, :, :] + t_norm[:, None, None] * slope_per_year[None, :, :] + noise
    return (
        cube,
        [round(float(x), 3) for x in lats],
        [round(float(x), 3) for x in lons],
        "synthetic_demo",
    )


def _vectorized_mk_and_slope(cube: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Compute vectorized per-cell Mann-Kendall Z, two-sided p-value, and OLS slope/decade."""
    T, H, W = cube.shape
    flat = cube.reshape(T, H * W)  # (T, N)

    # Pairwise sign differences sum over all i < j
    # Memory-safe accumulation along i for arbitrary spatial grids
    S = np.zeros(flat.shape[1], dtype=float)
    n_valid = np.sum(np.isfinite(flat), axis=0)
    for i in range(T - 1):
        diff = flat[i + 1 :, :] - flat[i : i + 1, :]
        valid_pairs = np.isfinite(diff)
        S += np.sum(np.where(valid_pairs, np.sign(diff), 0.0), axis=0)

    # Exact MK variance under no-ties formula (with per-pixel valid count)
    var_s = n_valid * (n_valid - 1.0) * (2.0 * n_valid + 5.0) / 18.0
    var_s = np.maximum(var_s, 1e-9)

    Z = np.zeros_like(S)
    pos = S > 0
    neg = S < 0
    Z[pos] = (S[pos] - 1.0) / np.sqrt(var_s[pos])
    Z[neg] = (S[neg] + 1.0) / np.sqrt(var_s[neg])
    Z[n_valid < 5] = 0.0

    p_vals = 2.0 * stats.norm.sf(np.abs(Z))
    p_vals = np.where(n_valid >= 5, np.clip(p_vals, 1e-15, 1.0), 1.0)

    # Vectorized OLS slope (handles missing NaNs cleanly)
    t = np.arange(T, dtype=float)[:, None]
    mask = np.isfinite(flat)
    t_masked = np.where(mask, t, np.nan)
    t_mean = np.nanmean(t_masked, axis=0, keepdims=True)
    y_mean = np.nanmean(flat, axis=0, keepdims=True)
    num = np.nansum((t_masked - t_mean) * (flat - y_mean), axis=0)
    den = np.nansum((t_masked - t_mean) ** 2, axis=0)
    slope_decade = np.where((den > 1e-12) & (n_valid >= 5), (num / np.maximum(den, 1e-12)) * 10.0, 0.0)

    return (
        Z.reshape(H, W),
        p_vals.reshape(H, W),
        slope_decade.reshape(H, W),
        (n_valid >= 5).reshape(H, W),
    )


def _render_spatial_png(
    slope_grid: np.ndarray,
    sig_mask: np.ndarray,
    mode: Literal["diverging", "fdr_mask"],
) -> str:
    """Render clean north-up Geo-Iris spatial PNG encoded as base64 data URI."""
    H, W = slope_grid.shape
    vmax = max(float(np.percentile(np.abs(slope_grid), 98)), 0.1)
    rgba = np.zeros((H, W, 4), dtype=np.uint8)

    # Flip vertically so row 0 corresponds to northernmost latitude at top of image
    s_flip = np.flipud(slope_grid)
    m_flip = np.flipud(sig_mask)

    norm = np.clip(s_flip / vmax, -1.0, 1.0)
    if mode == "diverging":
        # Cold cyan/blue (-1) -> slate (0) -> fiery orange/red (+1)
        r = np.where(norm >= 0, 30 + 225 * norm, 30 * (1 + norm)).astype(np.uint8)
        g = np.where(norm >= 0, 110 + 70 * (1 - norm), 130 + 95 * (-norm)).astype(np.uint8)
        b = np.where(norm >= 0, 145 * (1 - norm), 170 + 85 * (-norm)).astype(np.uint8)
        rgba[:, :, 0] = r
        rgba[:, :, 1] = g
        rgba[:, :, 2] = b
        rgba[:, :, 3] = 240
    else:
        # Highlight only FDR-significant pixels strongly, mute non-significant cells
        r = np.where(norm >= 0, 244, 56).astype(np.uint8)
        g = np.where(norm >= 0, 92, 189).astype(np.uint8)
        b = np.where(norm >= 0, 66, 248).astype(np.uint8)
        rgba[:, :, 0] = np.where(m_flip, r, 18)
        rgba[:, :, 1] = np.where(m_flip, g, 32)
        rgba[:, :, 2] = np.where(m_flip, b, 56)
        rgba[:, :, 3] = np.where(m_flip, 250, 175)

    img = Image.fromarray(rgba, mode="RGBA").resize((max(360, W * 16), max(280, H * 16)), Image.Resampling.NEAREST)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def run_spatial_fdr_analysis(
    *,
    region_name: str = "Arctic & Boreal Sub-Grid",
    center_lat: float = 68.0,
    center_lon: float = 20.0,
    grid_rows: int = 20,
    grid_cols: int = 24,
    n_years: int = 20,
    alpha: float = 0.05,
    correction_method: Literal["bh", "by", "holm", "bonferroni"] = "by",
    cube_input: Optional[list[list[list[Optional[float]]]]] = None,
    seed: int = 42,
) -> dict:
    """Execute vectorized gridded Mann-Kendall + Spatial FDR correction."""
    if cube_input is not None:
        cube = np.array(
            [[[np.nan if v is None else float(v) for v in row] for row in t_slice] for t_slice in cube_input],
            dtype=float,
        )
        if cube.ndim != 3 or cube.shape[0] < 6:
            raise ValueError("Uploaded cube must be 3D (T, H, W) with T >= 6 time steps.")
        H, W = cube.shape[1], cube.shape[2]
        lats = [round(center_lat - 5.0 + 10.0 * i / max(1, H - 1), 3) for i in range(H)]
        lons = [round(center_lon - 8.0 + 16.0 * j / max(1, W - 1), 3) for j in range(W)]
        provenance_tier = "user_upload"
    else:
        cube, lats, lons, provenance_tier = _build_synthetic_climate_cube(
            center_lat=center_lat,
            center_lon=center_lon,
            rows=grid_rows,
            cols=grid_cols,
            n_years=n_years,
            seed=seed,
        )

    Z, p_vals, slope_decade, valid_mask = _vectorized_mk_and_slope(cube)
    valid_p = p_vals[valid_mask]
    raw_sig = (p_vals <= alpha) & valid_mask

    method_map = {
        "bh": "fdr_bh",
        "by": "fdr_by",
        "holm": "holm",
        "bonferroni": "bonferroni",
    }
    if len(valid_p) == 0:
        raise ValueError("No valid cells found in spatio-temporal cube.")

    rejected_flat, q_flat, _, _ = multipletests(valid_p, alpha=alpha, method=method_map[correction_method])

    q_vals = np.ones_like(p_vals)
    q_vals[valid_mask] = q_flat
    fdr_sig = np.zeros_like(valid_mask, dtype=bool)
    fdr_sig[valid_mask] = rejected_flat

    n_tests = int(np.sum(valid_mask))
    n_raw_sig = int(np.sum(raw_sig))
    n_fdr_sig = int(np.sum(fdr_sig))
    false_positives_pruned = max(0, n_raw_sig - n_fdr_sig)
    area_fraction_sig = round(100.0 * n_fdr_sig / max(1, n_tests), 2)

    # Wilks (2016) global field significance threshold (p_(1) vs alpha_global)
    p_sorted = np.sort(valid_p)
    alpha_wilks = alpha / (1.0 + sum(1.0 / k for k in range(2, n_tests + 1))) if correction_method == "by" else alpha
    field_significant = n_fdr_sig > 0

    return {
        "region_name": region_name,
        "provenance": {
            "tier": provenance_tier,
            "source_name": "Uploaded Spatial Cube" if provenance_tier == "user_upload" else "Geo-Iris Gridded Climate Benchmark Field",
            "dataset_id": "SPATIAL_GRID_MK_FDR",
            "is_live": False,
            "status_message": (
                "Vectorized Mann-Kendall & Spatial FDR evaluated over uploaded 3D cube."
                if provenance_tier == "user_upload"
                else "Synthetic demonstration spatio-temporal climate grid (20x24 cells) illustrating Wilks (2016) Spatial FDR."
            ),
        },
        "dimensions": {"time_steps": int(cube.shape[0]), "rows": int(cube.shape[1]), "cols": int(cube.shape[2])},
        "method": correction_method,
        "alpha": alpha,
        "summary": {
            "total_valid_cells": n_tests,
            "raw_significant_cells": n_raw_sig,
            "fdr_significant_cells": n_fdr_sig,
            "false_positives_pruned": false_positives_pruned,
            "pct_area_raw_sig": round(100.0 * n_raw_sig / max(1, n_tests), 2),
            "pct_area_fdr_sig": area_fraction_sig,
            "field_significant": field_significant,
            "min_raw_p": float(f"{p_sorted[0]:.3e}"),
            "min_adjusted_q": float(f"{np.min(q_vals[valid_mask]):.3e}"),
            "max_positive_slope_decade": round(float(np.max(slope_decade)), 4),
            "min_negative_slope_decade": round(float(np.min(slope_decade)), 4),
            "wilks_effective_alpha": float(f"{alpha_wilks:.3e}"),
        },
        "images": {
            "trend_png": _render_spatial_png(slope_decade, raw_sig, "diverging"),
            "fdr_png": _render_spatial_png(slope_decade, fdr_sig, "fdr_mask"),
        },
        "grid": {
            "latitudes": lats,
            "longitudes": lons,
            "slope_decade": [[round(float(v), 4) for v in row] for row in slope_decade],
            "p_values": [[round(float(v), 6) for v in row] for row in p_vals],
            "q_values": [[round(float(v), 6) for v in row] for row in q_vals],
            "raw_significant": [[bool(v) for v in row] for row in raw_sig],
            "fdr_significant": [[bool(v) for v in row] for row in fdr_sig],
        },
    }
