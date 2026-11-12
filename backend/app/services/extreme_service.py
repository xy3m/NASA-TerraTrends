"""Extreme Value Analysis (GEV block maxima & GPD Peaks-Over-Threshold)."""

from __future__ import annotations

from typing import Literal, Optional

import numpy as np
from scipy import stats


def _bootstrap_return_ci(
    sample: np.ndarray,
    dist_name: Literal["gev", "gpd"],
    return_periods: list[float],
    threshold: float = 0.0,
    rate_per_period: float = 1.0,
    n_boot: int = 80,
    seed: int = 42,
    init_params: Optional[tuple[float, float, float]] = None,
) -> tuple[list[float], list[float]]:
    rng = np.random.default_rng(seed)
    boot_levels = np.empty((n_boot, len(return_periods)), dtype=float)
    n = len(sample)

    for b in range(n_boot):
        resamp = sample[rng.integers(0, n, size=n)]
        try:
            if dist_name == "gev":
                if init_params is not None:
                    c, loc, scale = stats.genextreme.fit(resamp, init_params[0], loc=init_params[1], scale=init_params[2])
                else:
                    c, loc, scale = stats.genextreme.fit(resamp)
                for j, T in enumerate(return_periods):
                    p = 1.0 - 1.0 / max(T, 1.01)
                    boot_levels[b, j] = float(stats.genextreme.ppf(p, c, loc=loc, scale=scale))
            else:
                exceed = resamp - threshold
                exceed = exceed[exceed >= 0]
                if len(exceed) < 3:
                    boot_levels[b, :] = np.nan
                    continue
                c, loc, scale = stats.genpareto.fit(exceed, floc=0.0)
                for j, T in enumerate(return_periods):
                    p_exceed = min(0.99999, max(1e-6, 1.0 - 1.0 / max(T * rate_per_period, 1.01)))
                    boot_levels[b, j] = threshold + float(stats.genpareto.ppf(p_exceed, c, loc=loc, scale=scale))
        except Exception:
            boot_levels[b, :] = np.nan

    lows: list[float] = []
    highs: list[float] = []
    for j in range(len(return_periods)):
        col = boot_levels[:, j]
        col = col[np.isfinite(col)]
        if len(col) >= 10:
            lows.append(round(float(np.percentile(col, 2.5)), 4))
            highs.append(round(float(np.percentile(col, 97.5)), 4))
        else:
            lows.append(float("nan"))
            highs.append(float("nan"))
    return lows, highs


def run_extreme_value_analysis(
    values: list[Optional[float]],
    *,
    dates: Optional[list[str]] = None,
    mode: Literal["gev_block_maxima", "gpd_pot"] = "gev_block_maxima",
    block_size: int = 12,
    threshold_quantile: float = 0.85,
    return_periods: Optional[list[float]] = None,
) -> dict:
    """Fit GEV (block maxima) or GPD (Peaks-Over-Threshold) and return return levels."""
    periods = return_periods or [2.0, 5.0, 10.0, 20.0, 50.0, 100.0]
    arr = np.array([np.nan if v is None else float(v) for v in values], dtype=float)
    valid = arr[np.isfinite(arr)]
    if len(valid) < 10:
        raise ValueError(f"At least 10 valid points required for Extreme Value Analysis (got {len(valid)}).")

    if mode == "gev_block_maxima":
        n_blocks = len(arr) // block_size
        block_maxima: list[float] = []
        block_labels: list[str] = []
        for b in range(n_blocks):
            sl = arr[b * block_size : (b + 1) * block_size]
            sl_ok = sl[np.isfinite(sl)]
            if len(sl_ok) >= max(2, block_size // 3):
                block_maxima.append(float(np.max(sl_ok)))
                if dates and b * block_size < len(dates):
                    block_labels.append(str(dates[b * block_size])[:4])
                else:
                    block_labels.append(f"Block {b + 1}")

        if len(block_maxima) < 5:
            # Adaptive fallback chunking into 6-8 blocks when total length is modest
            chunk = max(2, len(valid) // 8)
            block_maxima = [float(np.max(valid[i : i + chunk])) for i in range(0, len(valid) - chunk + 1, chunk)]
            block_labels = [f"Block {i + 1}" for i in range(len(block_maxima))]

        bm = np.asarray(block_maxima, dtype=float)
        c, loc, scale = stats.genextreme.fit(bm)
        xi = -float(c)  # Hydrological EV convention: xi = -scipy_c

        ks_stat, ks_p = stats.kstest(bm, "genextreme", args=(c, loc, scale))

        levels = [
            float(stats.genextreme.ppf(1.0 - 1.0 / max(T, 1.01), c, loc=loc, scale=scale))
            for T in periods
        ]
        ci_low, ci_high = _bootstrap_return_ci(bm, "gev", periods, init_params=(c, loc, scale))

        # Empirical plotting positions (Gringorten)
        bm_sorted = np.sort(bm)
        n_bm = len(bm_sorted)
        emp_probs = [(i + 1 - 0.44) / (n_bm + 0.12) for i in range(n_bm)]
        emp_periods = [round(1.0 / max(1e-6, 1.0 - p), 3) for p in emp_probs]

        family = "Frechet (heavy-tailed)" if xi > 0.05 else ("Weibull (bounded)" if xi < -0.05 else "Gumbel (light-tailed)")

        return {
            "mode": "gev_block_maxima",
            "family_classification": family,
            "n_samples": len(bm),
            "parameters": {
                "shape_xi": round(xi, 4),
                "scipy_c": round(float(c), 4),
                "location_mu": round(float(loc), 4),
                "scale_sigma": round(float(scale), 4),
            },
            "goodness_of_fit": {
                "ks_statistic": round(float(ks_stat), 4),
                "ks_p_value": round(float(ks_p), 4),
            },
            "block_maxima": [round(float(x), 4) for x in bm],
            "block_labels": block_labels,
            "empirical_return_plot": [
                {"return_period": emp_periods[i], "value": round(float(bm_sorted[i]), 4)}
                for i in range(n_bm)
            ],
            "return_levels": [
                {
                    "return_period": float(periods[i]),
                    "return_level": round(levels[i], 4),
                    "ci95_low": None if np.isnan(ci_low[i]) else ci_low[i],
                    "ci95_high": None if np.isnan(ci_high[i]) else ci_high[i],
                }
                for i in range(len(periods))
            ],
        }

    # GPD Peaks-Over-Threshold
    threshold = float(np.quantile(valid, threshold_quantile))
    exceedances = valid[valid > threshold] - threshold
    if len(exceedances) < 5:
        threshold = float(np.quantile(valid, 0.70))
        exceedances = valid[valid > threshold] - threshold
    if len(exceedances) < 4:
        raise ValueError("Insufficient exceedances above threshold for GPD fit.")

    c, loc, scale = stats.genpareto.fit(exceedances, floc=0.0)
    ks_stat, ks_p = stats.kstest(exceedances, "genpareto", args=(c, loc, scale))

    # Mean number of exceedances per year (assuming monthly series of 12 steps/year)
    years_observed = max(1.0, len(arr) / float(block_size))
    rate_per_year = len(exceedances) / years_observed

    levels = []
    for T in periods:
        prob = min(0.99999, max(1e-6, 1.0 - 1.0 / max(T * rate_per_year, 1.01)))
        levels.append(threshold + float(stats.genpareto.ppf(prob, c, loc=loc, scale=scale)))

    ci_low, ci_high = _bootstrap_return_ci(
        valid[valid > threshold],
        "gpd",
        periods,
        threshold=threshold,
        rate_per_period=rate_per_year,
    )

    ex_sorted = np.sort(exceedances) + threshold
    n_ex = len(ex_sorted)
    emp_plot = []
    for i in range(n_ex):
        p_tail = max(1e-6, (n_ex - i) / (n_ex + 1.0))
        emp_plot.append(
            {
                "return_period": round(1.0 / max(1e-6, rate_per_year * p_tail), 3),
                "value": round(float(ex_sorted[i]), 4),
            }
        )

    return {
        "mode": "gpd_pot",
        "family_classification": "Generalized Pareto Tail",
        "n_samples": len(exceedances),
        "threshold": round(threshold, 4),
        "threshold_quantile": threshold_quantile,
        "exceedance_rate_per_period": round(float(rate_per_year), 3),
        "parameters": {
            "shape_xi": round(float(c), 4),
            "location_u": round(threshold, 4),
            "scale_sigma": round(float(scale), 4),
        },
        "goodness_of_fit": {
            "ks_statistic": round(float(ks_stat), 4),
            "ks_p_value": round(float(ks_p), 4),
        },
        "empirical_return_plot": emp_plot,
        "return_levels": [
            {
                "return_period": float(periods[i]),
                "return_level": round(levels[i], 4),
                "ci95_low": None if np.isnan(ci_low[i]) else ci_low[i],
                "ci95_high": None if np.isnan(ci_high[i]) else ci_high[i],
            }
            for i in range(len(periods))
        ],
    }
