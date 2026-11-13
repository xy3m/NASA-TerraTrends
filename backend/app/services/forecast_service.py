"""ARIMA / SARIMA state-space time-series forecasting with missing-gap support."""

from __future__ import annotations

import itertools
import warnings
from typing import Optional

import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.stats.diagnostic import acorr_ljungbox
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.statespace.sarimax import SARIMAX


def _parse_dates(dates: list[str]) -> list[str]:
    return [str(d) for d in dates]


def _next_month_labels(last_date: str, steps: int) -> list[str]:
    """Generate sequential YYYY-MM labels after `last_date`, falling back to t+k."""
    try:
        parts = last_date.split("-")
        if len(parts) >= 2:
            year = int(parts[0])
            month = int(parts[1])
            out: list[str] = []
            for _ in range(steps):
                month += 1
                if month > 12:
                    month = 1
                    year += 1
                out.append(f"{year:04d}-{month:02d}")
            return out
    except (ValueError, IndexError):
        pass
    return [f"t+{i + 1}" for i in range(steps)]


def _fit_sarimax(
    series: np.ndarray,
    order: tuple[int, int, int],
    seasonal_order: tuple[int, int, int, int],
    maxiter: int = 80,
):
    model = SARIMAX(
        series,
        order=order,
        seasonal_order=seasonal_order,
        enforce_stationarity=False,
        enforce_invertibility=False,
    )
    return model.fit(disp=False, maxiter=maxiter)


def _auto_select_order(
    series: np.ndarray,
    s: int,
) -> tuple[tuple[int, int, int], tuple[int, int, int, int], list[dict]]:
    """Curated AIC model selection keeping web request latency under ~1-2 seconds."""
    valid_count = int(np.sum(np.isfinite(series)))
    use_seasonal = s > 1 and len(series) >= max(2 * s + 6, 30) and valid_count >= 2 * s

    candidate_specs: list[tuple[tuple[int, int, int], tuple[int, int, int, int]]] = (
        [
            ((0, 1, 1), (0, 1, 1, s)),
            ((1, 1, 1), (0, 1, 1, s)),
            ((1, 1, 0), (1, 0, 0, s)),
            ((1, 0, 1), (1, 0, 1, s)),
            ((1, 1, 1), (1, 0, 1, s)),
            ((2, 1, 1), (0, 0, 0, 0)),
            ((1, 1, 1), (0, 0, 0, 0)),
            ((0, 1, 1), (0, 0, 0, 0)),
        ]
        if use_seasonal
        else [
            ((1, 1, 1), (0, 0, 0, 0)),
            ((0, 1, 1), (0, 0, 0, 0)),
            ((1, 1, 0), (0, 0, 0, 0)),
            ((2, 1, 1), (0, 0, 0, 0)),
            ((1, 0, 1), (0, 0, 0, 0)),
        ]
    )

    candidates = []
    best_aic = float("inf")
    best_order = (1, 1, 1)
    best_seasonal = (0, 0, 0, 0) if not use_seasonal else (0, 1, 1, s)

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for order_c, s_order_c in candidate_specs:
            try:
                fit = _fit_sarimax(series, order_c, s_order_c, maxiter=50)
                aic = float(fit.aic)
                if np.isfinite(aic):
                    candidates.append(
                        {
                            "order": list(order_c),
                            "seasonal_order": list(s_order_c),
                            "aic": round(aic, 2),
                            "bic": round(float(fit.bic), 2),
                        }
                    )
                    if aic < best_aic:
                        best_aic = aic
                        best_order = order_c
                        best_seasonal = s_order_c
            except Exception:
                continue

    candidates.sort(key=lambda item: item["aic"])
    return best_order, best_seasonal, candidates[:8]


def run_sarima_forecast(
    dates: list[str],
    values: list[Optional[float]],
    *,
    forecast_steps: int = 12,
    seasonal_period: int = 12,
    auto_order: bool = True,
    order: tuple[int, int, int] = (1, 1, 1),
    seasonal_order: tuple[int, int, int, int] = (1, 0, 1, 12),
    holdout_size: int = 6,
    variable_name: str = "Environmental Series",
) -> dict:
    """Fit SARIMAX (preserving NaN gaps in state-space), evaluate holdout & forecast."""
    if len(dates) != len(values):
        raise ValueError("dates and values must have identical length.")

    raw = np.array([np.nan if v is None else float(v) for v in values], dtype=float)
    valid_mask = np.isfinite(raw)
    n_valid = int(np.sum(valid_mask))
    if n_valid < 20:
        raise ValueError(f"At least 20 finite observations are required for SARIMA (got {n_valid}).")

    # Ensure seasonal period doesn't exceed data support
    s = seasonal_period if (seasonal_period > 1 and len(raw) >= 2 * seasonal_period + 4) else 0

    candidates: list[dict] = []
    if auto_order:
        chosen_order, chosen_seasonal, candidates = _auto_select_order(raw, seasonal_period)
    else:
        chosen_order = order
        chosen_seasonal = seasonal_order if s > 0 else (0, 0, 0, 0)

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fit = _fit_sarimax(raw, chosen_order, chosen_seasonal)

    # Forecast & prediction intervals (95% and 80%)
    forecast_res = fit.get_forecast(steps=forecast_steps)
    mean_fc = forecast_res.predicted_mean
    ci95 = forecast_res.conf_int(alpha=0.05)
    ci80 = forecast_res.conf_int(alpha=0.20)
    future_dates = _next_month_labels(dates[-1], forecast_steps)

    # Fitted values (replace early Kalman diffuse initialization spikes with NaN)
    fitted_vals = np.asarray(fit.fittedvalues, dtype=float)
    skip_init = max(chosen_order[1] + (chosen_seasonal[1] * chosen_seasonal[3] if chosen_seasonal[3] else 0), 1)
    fitted_list: list[Optional[float]] = [
        None if (i < skip_init or not np.isfinite(fitted_vals[i]) or not valid_mask[i]) else round(float(fitted_vals[i]), 4)
        for i in range(len(raw))
    ]

    # Residuals diagnostics on observed points after burn-in
    resid_arr = raw[skip_init:] - fitted_vals[skip_init:]
    finite_resid = resid_arr[np.isfinite(resid_arr)]
    lb_stat = None
    lb_p = None
    shapiro_p = None
    if len(finite_resid) >= 12:
        max_lag = min(12, max(2, len(finite_resid) // 4))
        lb = acorr_ljungbox(finite_resid, lags=[max_lag], return_df=True)
        lb_stat = round(float(lb["lb_stat"].iloc[-1]), 4)
        lb_p = round(float(lb["lb_pvalue"].iloc[-1]), 4)
        sample_res = finite_resid[:5000]
        if len(sample_res) >= 3 and np.std(sample_res) > 1e-12:
            _, sp_p = stats.shapiro(sample_res)
            shapiro_p = round(float(sp_p), 4)

    # Holdout backtest on tail of the series
    holdout_metrics = None
    effective_holdout = min(holdout_size, max(0, len(raw) - 24))
    if effective_holdout >= 3:
        train = raw[:-effective_holdout]
        test = raw[-effective_holdout:]
        if int(np.sum(np.isfinite(train))) >= 18 and int(np.sum(np.isfinite(test))) >= 2:
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    bt_fit = _fit_sarimax(train, chosen_order, chosen_seasonal)
                bt_pred = np.asarray(bt_fit.get_forecast(steps=effective_holdout).predicted_mean, dtype=float)
                ok = np.isfinite(test) & np.isfinite(bt_pred)
                if int(np.sum(ok)) >= 2:
                    err = test[ok] - bt_pred[ok]
                    rmse = float(np.sqrt(np.mean(err ** 2)))
                    mae = float(np.mean(np.abs(err)))
                    denom = np.where(np.abs(test[ok]) > 1e-6, np.abs(test[ok]), np.nan)
                    mape = float(np.nanmean(np.abs(err) / denom) * 100.0) if np.any(np.isfinite(denom)) else None
                    holdout_metrics = {
                        "holdout_steps": int(effective_holdout),
                        "rmse": round(rmse, 4),
                        "mae": round(mae, 4),
                        "mape_pct": round(mape, 2) if mape is not None and np.isfinite(mape) else None,
                    }
            except Exception:
                holdout_metrics = None

    # Seasonal decomposition (interpolate missing gaps solely for STL/classical view)
    decomposition = None
    if seasonal_period > 1 and len(raw) >= 2 * seasonal_period:
        interpolated = pd.Series(raw).interpolate(method="linear", limit_direction="both").to_numpy()
        if np.all(np.isfinite(interpolated)):
            try:
                decomp = seasonal_decompose(interpolated, model="additive", period=seasonal_period, extrapolate_trend="freq")
                decomposition = {
                    "trend": [round(float(x), 4) if np.isfinite(x) else None for x in decomp.trend],
                    "seasonal": [round(float(x), 4) if np.isfinite(x) else None for x in decomp.seasonal],
                    "residual": [round(float(x), 4) if np.isfinite(x) else None for x in decomp.resid],
                }
            except Exception:
                decomposition = None

    forecast_rows = []
    for i in range(forecast_steps):
        forecast_rows.append(
            {
                "date": future_dates[i],
                "mean": round(float(mean_fc[i]), 4),
                "ci80_lower": round(float(ci80[i, 0]), 4),
                "ci80_upper": round(float(ci80[i, 1]), 4),
                "ci95_lower": round(float(ci95[i, 0]), 4),
                "ci95_upper": round(float(ci95[i, 1]), 4),
            }
        )

    return {
        "variable_name": variable_name,
        "n_total": len(raw),
        "n_valid": n_valid,
        "n_missing": len(raw) - n_valid,
        "selected_order": list(chosen_order),
        "selected_seasonal_order": list(chosen_seasonal),
        "aic": round(float(fit.aic), 2),
        "bic": round(float(fit.bic), 2),
        "log_likelihood": round(float(fit.llf), 2),
        "historical_dates": _parse_dates(dates),
        "observed": [None if not np.isfinite(v) else round(float(v), 4) for v in raw],
        "fitted": fitted_list,
        "forecast": forecast_rows,
        "diagnostics": {
            "ljung_box_q": lb_stat,
            "ljung_box_p": lb_p,
            "shapiro_p": shapiro_p,
            "residual_std": round(float(np.std(finite_resid, ddof=1)), 4) if len(finite_resid) > 1 else None,
        },
        "holdout": holdout_metrics,
        "decomposition": decomposition,
        "model_candidates": candidates,
    }
