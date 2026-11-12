"""SAR / DEM Landform Change Detection, LULC Transition Matrix & NASA ASF Proxy."""

from __future__ import annotations

import base64
import io
import os
import tempfile
from pathlib import Path
from typing import Literal, Optional

import numpy as np
import rasterio
import requests
from PIL import Image
from rasterio.warp import Resampling, reproject
from scipy.ndimage import uniform_filter
from skimage.filters import threshold_otsu
from sklearn.metrics import cohen_kappa_score, confusion_matrix


def _read_raster_bytes(raw_bytes: bytes, filename: str) -> tuple[np.ndarray, dict]:
    suffix = Path(filename).suffix.lower() or ".tif"
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(raw_bytes)
        with rasterio.open(tmp_path) as src:
            arr = src.read(1).astype(float)
            nodata = src.nodata
            if nodata is not None:
                arr = np.where(arr == nodata, np.nan, arr)
            meta = {
                "crs": src.crs,
                "transform": src.transform,
                "width": src.width,
                "height": src.height,
                "res": src.res,
            }
            return arr, meta
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass


def _align_second_raster(
    ref_arr: np.ndarray,
    ref_meta: dict,
    src_arr: np.ndarray,
    src_meta: dict,
    *,
    is_categorical: bool = False,
) -> np.ndarray:
    """Reproject or resample second raster to match first raster's exact grid."""
    if ref_arr.shape == src_arr.shape and ref_meta.get("transform") == src_meta.get("transform"):
        return src_arr

    if ref_meta.get("crs") is not None and src_meta.get("crs") is not None:
        dst = np.full(ref_arr.shape, np.nan, dtype=float)
        resampling = Resampling.nearest if is_categorical else Resampling.bilinear
        reproject(
            source=src_arr,
            destination=dst,
            src_transform=src_meta["transform"],
            src_crs=src_meta["crs"],
            dst_transform=ref_meta["transform"],
            dst_crs=ref_meta["crs"],
            resampling=resampling,
            src_nodata=np.nan,
            dst_nodata=np.nan,
        )
        return dst

    # Unprojected GeoTIFF / pixel-grid fallback: resize cleanly with PIL
    mode = Image.Resampling.NEAREST if is_categorical else Image.Resampling.BILINEAR
    img = Image.fromarray(np.nan_to_num(src_arr, nan=0.0).astype(np.float32))
    resized = img.resize((ref_arr.shape[1], ref_arr.shape[0]), mode)
    return np.asarray(resized, dtype=float)


def _encode_png(rgba: np.ndarray, target_size: tuple[int, int] = (360, 280)) -> str:
    img = Image.fromarray(rgba, mode="RGBA").resize(target_size, Image.Resampling.NEAREST)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _render_scalar_png(arr: np.ndarray, palette: Literal["terrain", "diverging", "sar", "mask"]) -> str:
    rgba = np.zeros((arr.shape[0], arr.shape[1], 4), dtype=np.uint8)
    valid = np.isfinite(arr)
    if not np.any(valid):
        return _encode_png(rgba)

    if palette == "diverging":
        vmax = max(float(np.percentile(np.abs(arr[valid]), 98)), 1e-3)
        norm = np.clip(np.nan_to_num(arr, nan=0.0) / vmax, -1.0, 1.0)
        rgba[:, :, 0] = np.where(norm >= 0, 35 + 220 * norm, 35 * (1 + norm)).astype(np.uint8)
        rgba[:, :, 1] = np.where(norm >= 0, 110 + 90 * (1 - norm), 130 + 95 * (-norm)).astype(np.uint8)
        rgba[:, :, 2] = np.where(norm >= 0, 130 * (1 - norm), 175 + 80 * (-norm)).astype(np.uint8)
        rgba[:, :, 3] = np.where(valid, 245, 0)
    elif palette == "mask":
        # +1 deposition/increase (cyan), -1 erosion/flood drop (amber/red), 0 unchanged
        rgba[:, :, 0] = np.where(arr < -0.5, 244, np.where(arr > 0.5, 56, 20)).astype(np.uint8)
        rgba[:, :, 1] = np.where(arr < -0.5, 88, np.where(arr > 0.5, 189, 30)).astype(np.uint8)
        rgba[:, :, 2] = np.where(arr < -0.5, 66, np.where(arr > 0.5, 248, 48)).astype(np.uint8)
        rgba[:, :, 3] = np.where(valid, 245, 0)
    else:
        lo, hi = np.percentile(arr[valid], [2, 98])
        span = max(float(hi - lo), 1e-6)
        u = np.clip((np.nan_to_num(arr, nan=lo) - lo) / span, 0.0, 1.0)
        if palette == "sar":
            val = (20 + 235 * u).astype(np.uint8)
            rgba[:, :, 0] = val
            rgba[:, :, 1] = (val * 0.96).astype(np.uint8)
            rgba[:, :, 2] = np.clip(val * 1.05, 0, 255).astype(np.uint8)
        else:
            # Terrain tint
            rgba[:, :, 0] = (32 + 185 * (u ** 1.3)).astype(np.uint8)
            rgba[:, :, 1] = (58 + 150 * np.sin(u * np.pi * 0.85)).astype(np.uint8)
            rgba[:, :, 2] = (75 + 145 * (1.0 - 0.5 * u)).astype(np.uint8)
        rgba[:, :, 3] = np.where(valid, 250, 0)

    return _encode_png(rgba)


# ---------------------------------------------------------------------------
# 1. DEM of Difference (DoD)
# ---------------------------------------------------------------------------

def _synthetic_dem_pair(scenario: str) -> tuple[np.ndarray, np.ndarray, str]:
    H, W = 96, 120
    y = np.linspace(-1.0, 1.0, H)
    x = np.linspace(-1.2, 1.2, W)
    xg, yg = np.meshgrid(x, y)
    rng = np.random.default_rng(101 if scenario == "mount_st_helens_lahar" else (202 if scenario == "colorado_river_incision" else 303))

    if scenario == "mount_st_helens_lahar":
        dem1 = 1850.0 - 420.0 * np.sqrt(xg ** 2 + yg ** 2) + 25.0 * np.sin(4 * xg) * np.cos(4 * yg)
        # Crater breach / incision upper flank + downstream lahar deposition lobe
        erosion = -28.0 * np.exp(-(((xg + 0.35) / 0.25) ** 2 + ((yg - 0.1) / 0.28) ** 2))
        deposition = 16.5 * np.exp(-(((xg - 0.45) / 0.34) ** 2 + ((yg + 0.08) / 0.24) ** 2))
        delta = erosion + deposition + rng.normal(0.0, 0.28, size=(H, W))
        label = "Mount St. Helens Volcanic Sector Collapse & Lahar Deposition"
    elif scenario == "colorado_river_incision":
        channel = np.exp(-((yg - 0.2 * np.sin(3 * xg)) / 0.14) ** 2)
        dem1 = 920.0 + 180.0 * np.abs(yg) - 95.0 * channel
        erosion = -4.2 * channel * (0.6 + 0.4 * np.cos(2 * xg))
        bar_dep = 2.4 * np.exp(-(((xg - 0.25) / 0.22) ** 2 + ((yg + 0.16) / 0.10) ** 2))
        delta = erosion + bar_dep + rng.normal(0.0, 0.22, size=(H, W))
        label = "Fluvial Canyon Incision & Point-Bar Aggradation"
    else:
        dem1 = 210.0 + 140.0 * (1.0 - xg) + 18.0 * np.sin(5 * yg)
        # Grounding-zone ice shelf dynamic thinning (-18 to -35 m)
        thinning = -26.0 * np.exp(-((xg - 0.3) / 0.55) ** 2) * (0.65 + 0.35 * np.cos(2 * yg))
        delta = thinning + rng.normal(0.0, 0.30, size=(H, W))
        label = "Thwaites Glacier Grounding-Zone Dynamic Ice Thinning"

    return dem1, dem1 + delta, label


def compute_dem_differencing(
    *,
    dem_before: Optional[np.ndarray] = None,
    dem_after: Optional[np.ndarray] = None,
    scenario: str = "mount_st_helens_lahar",
    lod_threshold_m: float = 0.75,
    pixel_size_m: float = 10.0,
    is_upload: bool = False,
) -> dict:
    """Compute DEM of Difference (DoD) with Level-of-Detection & sediment/ice volume budget."""
    if dem_before is not None and dem_after is not None:
        z1, z2 = dem_before, dem_after
        label = "Uploaded GeoTIFF DEM Pair"
        tier = "user_upload"
        msg = f"Computed DEM of Difference across uploaded {z1.shape[0]}x{z1.shape[1]} elevation grids."
    else:
        z1, z2, label = _synthetic_dem_pair(scenario)
        tier = "synthetic_demo"
        msg = f"Curated landform change benchmark ({label}); upload two GeoTIFF DEMs (.tif) to evaluate real terrain."

    dod = z2 - z1
    valid = np.isfinite(dod)
    pixel_area_m2 = pixel_size_m * pixel_size_m

    significant = valid & (np.abs(dod) >= lod_threshold_m)
    deposition_mask = significant & (dod > 0)
    erosion_mask = significant & (dod < 0)

    dep_vol_m3 = float(np.sum(dod[deposition_mask]) * pixel_area_m2) if np.any(deposition_mask) else 0.0
    ero_vol_m3 = float(np.sum(np.abs(dod[erosion_mask])) * pixel_area_m2) if np.any(erosion_mask) else 0.0
    net_vol_m3 = dep_vol_m3 - ero_vol_m3

    sig_class = np.where(deposition_mask, 1.0, np.where(erosion_mask, -1.0, 0.0))
    dod_valid = dod[valid]
    hist_counts, hist_edges = np.histogram(dod_valid, bins=24)

    return {
        "provenance": {
            "tier": tier,
            "source_name": label,
            "dataset_id": scenario.upper() if not is_upload else "USER_DEM_PAIR",
            "is_live": False,
            "status_message": msg,
        },
        "label": label,
        "dimensions": {"rows": int(dod.shape[0]), "cols": int(dod.shape[1]), "pixel_size_m": pixel_size_m},
        "lod_threshold_m": lod_threshold_m,
        "summary": {
            "mean_elevation_change_m": round(float(np.mean(dod_valid)), 3),
            "median_change_m": round(float(np.median(dod_valid)), 3),
            "max_deposition_m": round(float(np.max(dod_valid)), 3),
            "max_erosion_m": round(float(np.min(dod_valid)), 3),
            "pct_area_changed": round(100.0 * float(np.sum(significant)) / max(1, int(np.sum(valid))), 2),
            "deposition_volume_m3": round(dep_vol_m3, 1),
            "erosion_volume_m3": round(ero_vol_m3, 1),
            "net_volume_change_m3": round(net_vol_m3, 1),
        },
        "histogram": {
            "centers_m": [round(float(0.5 * (hist_edges[i] + hist_edges[i + 1])), 3) for i in range(len(hist_counts))],
            "counts": [int(c) for c in hist_counts],
        },
        "images": {
            "before_png": _render_scalar_png(z1, "terrain"),
            "after_png": _render_scalar_png(z2, "terrain"),
            "dod_png": _render_scalar_png(dod, "diverging"),
            "lod_mask_png": _render_scalar_png(sig_class, "mask"),
        },
    }


def compute_dem_differencing_from_files(
    before_bytes: bytes,
    before_name: str,
    after_bytes: bytes,
    after_name: str,
    *,
    lod_threshold_m: float = 0.75,
) -> dict:
    z1, m1 = _read_raster_bytes(before_bytes, before_name)
    z2_raw, m2 = _read_raster_bytes(after_bytes, after_name)
    z2 = _align_second_raster(z1, m1, z2_raw, m2, is_categorical=False)
    res_x = abs(m1["res"][0]) if m1.get("res") and 0.5 <= abs(m1["res"][0]) <= 2000 else 10.0
    return compute_dem_differencing(
        dem_before=z1,
        dem_after=z2,
        lod_threshold_m=lod_threshold_m,
        pixel_size_m=float(res_x),
        is_upload=True,
    )


# ---------------------------------------------------------------------------
# 2. SAR Speckle Filtering & Log-Ratio Change Detection + NASA ASF Proxy
# ---------------------------------------------------------------------------

def _lee_speckle_filter(img: np.ndarray, window_size: int = 5) -> np.ndarray:
    """Classic Lee adaptive multiplicative speckle filter preserving edges."""
    clean = np.nan_to_num(img, nan=float(np.nanmedian(img)))
    mean_local = uniform_filter(clean, size=window_size)
    sq_mean_local = uniform_filter(clean ** 2, size=window_size)
    var_local = np.maximum(0.0, sq_mean_local - mean_local ** 2)
    # Estimate overall speckle noise variance in CV^2 sense
    cv_global = float(np.median(np.sqrt(var_local) / np.maximum(mean_local, 1e-6)))
    var_noise = (mean_local * cv_global) ** 2
    weight = np.clip(np.maximum(0.0, var_local - var_noise) / np.maximum(var_local, 1e-8), 0.0, 1.0)
    return mean_local + weight * (clean - mean_local)


def _synthetic_sar_pair(scenario: str) -> tuple[np.ndarray, np.ndarray, str]:
    H, W = 96, 120
    y = np.linspace(-1.0, 1.0, H)
    x = np.linspace(-1.2, 1.2, W)
    xg, yg = np.meshgrid(x, y)
    rng = np.random.default_rng(777 if scenario == "amazon_seasonal_flooding" else (888 if scenario == "rondonia_deforestation_clearcut" else 999))

    # Underlying linear backscatter intensity + Gamma(L=4) SAR speckle
    base_rcs = 0.25 + 0.12 * np.sin(3 * xg) * np.cos(3 * yg)
    if scenario == "amazon_seasonal_flooding":
        # Open floodwater causes specular bounce away -> sharp backscatter DROP (-7 to -11 dB)
        flood_zone = np.exp(-((yg - 0.15 * np.sin(3.5 * xg)) / 0.22) ** 2) > 0.45
        rcs2 = np.where(flood_zone, base_rcs * 0.12, base_rcs)
        label = "Amazon Floodplain Inundation (Specular Water Backscatter Drop)"
    elif scenario == "rondonia_deforestation_clearcut":
        # Fishbone clearcut polygons reduce C/L-band volume scattering (-4.5 to -7 dB)
        fishbone = (np.abs(xg) < 0.75) & ((np.abs(yg - 0.35) < 0.16) | (np.abs(yg + 0.30) < 0.14))
        rcs2 = np.where(fishbone, base_rcs * 0.26, base_rcs)
        label = "Rondonia Forest Clear-Cut Herringbone Loss"
    else:
        # Fresh rough a'a lava flow & urban damage doubles/triples rough backscatter (+5 to +8 dB)
        lava_lobe = ((xg + 0.1) ** 2 / 0.35 + (yg - 0.05) ** 2 / 0.12) < 1.0
        rcs2 = np.where(lava_lobe, base_rcs * 4.2, base_rcs)
        label = "Kilauea Rough Lava Flow Emplacement (+Backscatter Gain)"

    # Apply realistic 4-look Gamma SAR speckle noise
    i1 = base_rcs * rng.gamma(shape=4.0, scale=0.25, size=(H, W))
    i2 = rcs2 * rng.gamma(shape=4.0, scale=0.25, size=(H, W))
    return i1, i2, label


def compute_sar_change_detection(
    *,
    img_before: Optional[np.ndarray] = None,
    img_after: Optional[np.ndarray] = None,
    scenario: str = "amazon_seasonal_flooding",
    speckle_filter: Literal["none", "lee", "mean"] = "lee",
    window_size: int = 5,
    threshold_db: float = 3.0,
    pixel_size_m: float = 20.0,
    is_upload: bool = False,
) -> dict:
    """Compute SAR log-ratio change detection with Lee speckle filtering & Otsu threshold."""
    if img_before is not None and img_after is not None:
        i1, i2 = img_before, img_after
        label = "Uploaded Dual SAR GeoTIFF Backscatter Pair"
        tier = "user_upload"
        msg = f"Processed uploaded {i1.shape[0]}x{i1.shape[1]} SAR intensity scenes with {speckle_filter} speckle filtering."
    else:
        i1, i2, label = _synthetic_sar_pair(scenario)
        tier = "synthetic_demo"
        msg = f"Sentinel-1 / NISAR backscatter benchmark ({label}); upload two GeoTIFF SAR bands to analyze real scenes."

    eps = 1e-6
    i1_pos = np.maximum(np.nan_to_num(i1, nan=float(np.nanmedian(i1))), eps)
    i2_pos = np.maximum(np.nan_to_num(i2, nan=float(np.nanmedian(i2))), eps)

    if speckle_filter == "lee":
        f1 = _lee_speckle_filter(i1_pos, window_size)
        f2 = _lee_speckle_filter(i2_pos, window_size)
    elif speckle_filter == "mean":
        f1 = uniform_filter(i1_pos, size=window_size)
        f2 = uniform_filter(i2_pos, size=window_size)
    else:
        f1, f2 = i1_pos, i2_pos

    log_ratio_db = 10.0 * np.log10(np.maximum(f2, eps) / np.maximum(f1, eps))
    abs_change = np.abs(log_ratio_db)

    try:
        otsu_db = float(threshold_otsu(abs_change))
    except Exception:
        otsu_db = threshold_db

    changed_drop = log_ratio_db <= -threshold_db
    changed_gain = log_ratio_db >= threshold_db
    mask_arr = np.where(changed_gain, 1.0, np.where(changed_drop, -1.0, 0.0))

    total_pixels = log_ratio_db.size
    px_km2 = (pixel_size_m * pixel_size_m) / 1_000_000.0
    drop_area_km2 = float(np.sum(changed_drop)) * px_km2
    gain_area_km2 = float(np.sum(changed_gain)) * px_km2

    hist_counts, hist_edges = np.histogram(log_ratio_db.ravel(), bins=24)

    return {
        "provenance": {
            "tier": tier,
            "source_name": label,
            "dataset_id": scenario.upper() if not is_upload else "USER_SAR_PAIR",
            "is_live": False,
            "status_message": msg,
        },
        "label": label,
        "speckle_filter": speckle_filter,
        "window_size": window_size,
        "threshold_db": threshold_db,
        "otsu_suggested_threshold_db": round(otsu_db, 3),
        "summary": {
            "total_area_km2": round(total_pixels * px_km2, 3),
            "backscatter_drop_area_km2": round(drop_area_km2, 3),
            "backscatter_gain_area_km2": round(gain_area_km2, 3),
            "pct_changed": round(100.0 * (np.sum(changed_drop) + np.sum(changed_gain)) / max(1, total_pixels), 2),
            "mean_log_ratio_db": round(float(np.mean(log_ratio_db)), 3),
            "std_log_ratio_db": round(float(np.std(log_ratio_db)), 3),
        },
        "histogram": {
            "centers_db": [round(float(0.5 * (hist_edges[i] + hist_edges[i + 1])), 3) for i in range(len(hist_counts))],
            "counts": [int(c) for c in hist_counts],
        },
        "images": {
            "before_png": _render_scalar_png(10.0 * np.log10(f1), "sar"),
            "after_png": _render_scalar_png(10.0 * np.log10(f2), "sar"),
            "log_ratio_png": _render_scalar_png(log_ratio_db, "diverging"),
            "change_mask_png": _render_scalar_png(mask_arr, "mask"),
        },
    }


def compute_sar_change_from_files(
    before_bytes: bytes,
    before_name: str,
    after_bytes: bytes,
    after_name: str,
    *,
    speckle_filter: Literal["none", "lee", "mean"] = "lee",
    window_size: int = 5,
    threshold_db: float = 3.0,
) -> dict:
    i1, m1 = _read_raster_bytes(before_bytes, before_name)
    i2_raw, m2 = _read_raster_bytes(after_bytes, after_name)
    i2 = _align_second_raster(i1, m1, i2_raw, m2, is_categorical=False)
    res_x = abs(m1["res"][0]) if m1.get("res") and 0.5 <= abs(m1["res"][0]) <= 2000 else 20.0
    return compute_sar_change_detection(
        img_before=i1,
        img_after=i2,
        speckle_filter=speckle_filter,
        window_size=window_size,
        threshold_db=threshold_db,
        pixel_size_m=float(res_x),
        is_upload=True,
    )


def search_asf_sar_granules(
    *,
    lat: float,
    lon: float,
    radius_deg: float = 0.4,
    platform: str = "SENTINEL-1",
    start_date: str = "2024-01-01T00:00:00Z",
    end_date: str = "2025-12-31T23:59:59Z",
    max_results: int = 12,
) -> dict:
    """Real keyless query to NASA Alaska Satellite Facility (ASF) SAR Search API."""
    url = "https://api.asf.alaska.edu/services/search/param"
    params = {
        "bbox": f"{lon - radius_deg:.3f},{lat - radius_deg:.3f},{lon + radius_deg:.3f},{lat + radius_deg:.3f}",
        "platform": platform,
        "start": start_date,
        "end": end_date,
        "maxResults": max_results,
        "output": "geojson",
    }
    try:
        resp = requests.get(url, params=params, timeout=18)
        resp.raise_for_status()
        features = resp.json().get("features", [])
        granules = []
        for feat in features:
            props = feat.get("properties", {})
            granules.append(
                {
                    "scene_name": props.get("sceneName"),
                    "platform": props.get("platform"),
                    "beam_mode": props.get("beamModeType"),
                    "polarization": props.get("polarization"),
                    "flight_direction": props.get("flightDirection"),
                    "path_number": props.get("pathNumber"),
                    "frame_number": props.get("frameNumber"),
                    "start_time": props.get("startTime"),
                    "bytes_mb": round(float(props.get("bytes", 0)) / (1024 * 1024), 1) if props.get("bytes") else None,
                    "browse_url": (props.get("browse") or [None])[0] if isinstance(props.get("browse"), list) else props.get("browse"),
                    "download_url": props.get("url"),
                }
            )
        return {
            "provenance": {
                "tier": "satellite_observation",
                "source_name": "NASA Alaska Satellite Facility (ASF) SAR Archive",
                "dataset_id": f"ASF_{platform}",
                "is_live": True,
                "status_message": f"Retrieved {len(granules)} live {platform} SAR scenes near ({lat:.2f}, {lon:.2f}) from NASA ASF.",
                "citation": "Alaska Satellite Facility Distributed Active Archive Center (ASF DAAC)",
            },
            "granule_count": len(granules),
            "granules": granules,
        }
    except Exception as exc:
        return {
            "provenance": {
                "tier": "synthetic_demo",
                "source_name": "NASA ASF SAR Search Fallback",
                "dataset_id": f"ASF_{platform}",
                "is_live": False,
                "status_message": f"ASF SAR catalog request failed ({exc}).",
            },
            "granule_count": 0,
            "granules": [],
        }


# ---------------------------------------------------------------------------
# 3. Land Use / Land Cover (LULC) Transition Matrix
# ---------------------------------------------------------------------------

LULC_CLASS_LABELS = {
    1: "Evergreen Forest",
    2: "Savanna & Shrubland",
    3: "Cropland",
    4: "Urban & Built-up",
    5: "Surface Water",
    6: "Barren / Salt Flat",
}

LULC_PALETTE = {
    1: (22, 163, 74),    # Forest green
    2: (163, 230, 53),   # Savanna lime
    3: (245, 158, 11),   # Cropland amber
    4: (239, 68, 68),    # Urban crimson
    5: (14, 165, 233),   # Water cyan
    6: (194, 178, 128),  # Barren sand
}


def _synthetic_lulc_pair(scenario: str) -> tuple[np.ndarray, np.ndarray, str]:
    H, W = 90, 110
    rng = np.random.default_rng(505 if scenario == "amazon_arc_deforestation" else (606 if scenario == "pearl_river_urbanization" else 707))
    y, x = np.meshgrid(np.linspace(-1, 1, H), np.linspace(-1, 1, W), indexing="ij")

    if scenario == "amazon_arc_deforestation":
        t1 = np.ones((H, W), dtype=int)
        t1[(y > 0.35) & (x < 0.2)] = 2
        t1[np.abs(y + 0.55) < 0.08] = 5
        t2 = t1.copy()
        clearcut = (x > -0.3) & (x < 0.75) & (y > -0.45) & (y < 0.6) & ((rng.random((H, W)) + 0.25 * x) > 0.45)
        t2[clearcut] = 3  # Pasture / Cropland conversion
        t2[(x > 0.3) & (y > 0.1) & (rng.random((H, W)) > 0.85)] = 4
        label = "Amazon Arc of Deforestation (2001 -> 2023 MCD12Q1 Scenario)"
    elif scenario == "pearl_river_urbanization":
        t1 = np.full((H, W), 3, dtype=int)
        t1[y < -0.3] = 1
        t1[np.abs(x + 0.1 * y) < 0.14] = 5
        t1[(x ** 2 + y ** 2) < 0.12] = 4
        t2 = t1.copy()
        sprawl = (x ** 2 + (y * 1.1) ** 2) < 0.52
        t2[sprawl & (t1 != 5)] = 4
        label = "Pearl River Delta Rapid Urban Sprawl (2001 -> 2023)"
    else:
        t1 = np.full((H, W), 6, dtype=int)
        basin = (x ** 2 / 0.55 + y ** 2 / 0.65) < 1.0
        t1[basin] = 5
        t1[(y > 0.65) & (x < -0.2)] = 3
        t2 = t1.copy()
        desiccated = (x ** 2 / 0.55 + y ** 2 / 0.65) >= 0.22
        t2[basin & desiccated] = 6  # Salt crust desiccation
        label = "Aral Sea Surface Water Desiccation (2000 -> 2023)"

    return t1, t2, label


def _render_categorical_png(arr: np.ndarray, class_ids: list[int]) -> str:
    H, W = arr.shape
    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[:, :, 3] = 245
    fallback_colors = [(56, 189, 248), (168, 85, 247), (249, 115, 22), (34, 197, 94), (244, 63, 94), (148, 163, 184)]
    for idx, cid in enumerate(class_ids):
        color = LULC_PALETTE.get(int(cid), fallback_colors[idx % len(fallback_colors)])
        mask = arr == cid
        rgba[mask, 0] = color[0]
        rgba[mask, 1] = color[1]
        rgba[mask, 2] = color[2]
    return _encode_png(rgba)


def compute_lulc_transitions(
    *,
    lulc_before: Optional[np.ndarray] = None,
    lulc_after: Optional[np.ndarray] = None,
    scenario: str = "amazon_arc_deforestation",
    pixel_area_km2: float = 0.25,
    is_upload: bool = False,
) -> dict:
    """Compute Land Use / Land Cover KxK transition matrix, Cohen's Kappa & net class gains/losses."""
    if lulc_before is not None and lulc_after is not None:
        t1_raw, t2_raw = lulc_before, lulc_after
        valid = np.isfinite(t1_raw) & np.isfinite(t2_raw)
        t1 = np.rint(t1_raw[valid]).astype(int)
        t2 = np.rint(t2_raw[valid]).astype(int)
        map1 = np.rint(np.nan_to_num(t1_raw, nan=0)).astype(int)
        map2 = np.rint(np.nan_to_num(t2_raw, nan=0)).astype(int)
        label = "Uploaded Classified LULC GeoTIFF Pair"
        tier = "user_upload"
        msg = f"Evaluated pixel-by-pixel LULC transitions across {len(t1)} valid cells."
    else:
        map1, map2, label = _synthetic_lulc_pair(scenario)
        t1 = map1.ravel()
        t2 = map2.ravel()
        tier = "synthetic_demo"
        msg = f"MCD12Q1 benchmark scenario ({label}); upload two classified GeoTIFF rasters to compute custom transitions."

    class_ids = sorted(int(c) for c in np.unique(np.concatenate([t1, t2])))[:12]
    if len(class_ids) < 2:
        raise ValueError("LULC transition analysis requires at least 2 distinct land cover classes.")

    cm = confusion_matrix(t1, t2, labels=class_ids)
    total = int(np.sum(cm))
    overall_agreement = float(np.trace(cm) / max(1, total))
    kappa = float(cohen_kappa_score(t1, t2, labels=class_ids))

    row_sums = np.sum(cm, axis=1)
    col_sums = np.sum(cm, axis=0)
    class_summary = []
    for i, cid in enumerate(class_ids):
        before_px = int(row_sums[i])
        after_px = int(col_sums[i])
        persisted_px = int(cm[i, i])
        net_px = after_px - before_px
        class_summary.append(
            {
                "class_id": cid,
                "label": LULC_CLASS_LABELS.get(cid, f"Class {cid}"),
                "before_pct": round(100.0 * before_px / max(1, total), 2),
                "after_pct": round(100.0 * after_px / max(1, total), 2),
                "net_change_pct_pts": round(100.0 * net_px / max(1, total), 2),
                "net_area_km2": round(net_px * pixel_area_km2, 2),
                "persistence_pct": round(100.0 * persisted_px / max(1, before_px), 2),
            }
        )

    change_map = np.where(map1 != map2, -1.0, 0.0)

    return {
        "provenance": {
            "tier": tier,
            "source_name": label,
            "dataset_id": scenario.upper() if not is_upload else "USER_LULC_PAIR",
            "is_live": False,
            "status_message": msg,
        },
        "label": label,
        "overall_persistence_pct": round(overall_agreement * 100.0, 2),
        "pct_changed": round((1.0 - overall_agreement) * 100.0, 2),
        "cohen_kappa": round(kappa, 4),
        "classes": class_summary,
        "transition_matrix": {
            "labels": [LULC_CLASS_LABELS.get(c, f"Class {c}") for c in class_ids],
            "counts": cm.tolist(),
            "area_km2": [[round(float(val * pixel_area_km2), 2) for val in row] for row in cm],
        },
        "images": {
            "before_png": _render_categorical_png(map1, class_ids),
            "after_png": _render_categorical_png(map2, class_ids),
            "change_mask_png": _render_scalar_png(change_map, "mask"),
        },
    }


def compute_lulc_from_files(
    before_bytes: bytes,
    before_name: str,
    after_bytes: bytes,
    after_name: str,
) -> dict:
    t1, m1 = _read_raster_bytes(before_bytes, before_name)
    t2_raw, m2 = _read_raster_bytes(after_bytes, after_name)
    t2 = _align_second_raster(t1, m1, t2_raw, m2, is_categorical=True)
    res_x = abs(m1["res"][0]) if m1.get("res") and 1.0 <= abs(m1["res"][0]) <= 2000 else 500.0
    px_km2 = (res_x * res_x) / 1_000_000.0
    return compute_lulc_transitions(
        lulc_before=t1,
        lulc_after=t2,
        pixel_area_km2=float(px_km2),
        is_upload=True,
    )
