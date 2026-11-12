"""Tests for SARIMA, Bayesian MCMC, Extreme Value (GEV/GPD) & Spatial FDR endpoints."""

from __future__ import annotations

import numpy as np
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _sample_climate_series(n_months: int = 96, slope_per_yr: float = 0.08, with_polar_gaps: bool = True):
    rng = np.random.default_rng(123)
    dates = []
    values = []
    for idx in range(n_months):
        year = 2016 + idx // 12
        month = (idx % 12) + 1
        dates.append(f"{year:04d}-{month:02d}")
        if with_polar_gaps and month in (12, 1):
            values.append(None)
            continue
        t_yr = idx / 12.0
        val = 14.0 + slope_per_yr * t_yr + 3.5 * np.sin(2.0 * np.pi * (month - 1) / 12.0) + rng.normal(0.0, 0.35)
        values.append(round(float(val), 3))
    return dates, values


def test_sarima_with_missing_polar_night_gaps():
    dates, values = _sample_climate_series(84, slope_per_yr=0.12, with_polar_gaps=True)
    resp = client.post(
        "/api/v1/stats/sarima",
        json={
            "dates": dates,
            "values": values,
            "forecast_steps": 12,
            "seasonal_period": 12,
            "auto_order": True,
            "holdout_size": 6,
            "variable_name": "Arctic T2M",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["n_total"] == 84
    assert data["n_missing"] > 0
    assert len(data["forecast"]) == 12
    assert data["forecast"][0]["date"] == "2023-01"
    assert data["forecast"][0]["ci95_upper"] > data["forecast"][0]["mean"] > data["forecast"][0]["ci95_lower"]
    assert data["holdout"] is not None
    assert data["holdout"]["rmse"] >= 0


def test_bayesian_mcmc_robust_ar1_converges_on_positive_trend():
    dates, values = _sample_climate_series(108, slope_per_yr=0.25, with_polar_gaps=True)
    resp = client.post(
        "/api/v1/stats/bayesian-mcmc",
        json={
            "dates": dates,
            "values": values,
            "model_type": "robust_ar1",
            "chains": 3,
            "draws": 650,
            "burn_in": 350,
            "seed": 7,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    slope_yr = data["parameters"]["slope_per_year"]
    assert slope_yr["mean"] > 0.12
    assert slope_yr["r_hat"] < 1.15
    assert data["probability_of_direction"]["p_positive"] > 0.90
    assert len(data["traces_slope_decade"]) == 3


def test_bayesian_mcmc_changepoint_model():
    dates, _ = _sample_climate_series(96, slope_per_yr=0.0, with_polar_gaps=False)
    rng = np.random.default_rng(9)
    vals = []
    for i in range(96):
        t = i / 12.0
        hinge = 0.65 * max(0.0, t - 4.0)
        vals.append(round(float(10.0 + hinge + rng.normal(0.0, 0.2)), 3))

    resp = client.post(
        "/api/v1/stats/bayesian-mcmc",
        json={
            "dates": dates,
            "values": vals,
            "model_type": "changepoint",
            "chains": 2,
            "draws": 600,
            "burn_in": 350,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["parameters"]["slope_shift_per_year"]["mean"] > 0.25
    assert data["estimated_changepoint_date"] is not None


def test_extreme_value_gev_and_gpd():
    rng = np.random.default_rng(55)
    vals = rng.gumbel(loc=32.0, scale=4.5, size=144).tolist()
    gev = client.post(
        "/api/v1/stats/extreme-value",
        json={"values": vals, "mode": "gev_block_maxima", "block_size": 12},
    )
    assert gev.status_code == 200
    g_data = gev.json()
    assert len(g_data["return_levels"]) == 6
    rl = [row["return_level"] for row in g_data["return_levels"]]
    assert rl[-1] > rl[0]  # 100-period return level > 2-period return level

    gpd = client.post(
        "/api/v1/stats/extreme-value",
        json={"values": vals, "mode": "gpd_pot", "threshold_quantile": 0.85},
    )
    assert gpd.status_code == 200
    assert gpd.json()["n_samples"] >= 10


def test_spatial_fdr_prunes_false_positives():
    resp = client.post(
        "/api/v1/stats/spatial-fdr",
        json={
            "region_name": "Svalbard Grid",
            "center_lat": 78.0,
            "center_lon": 15.0,
            "grid_rows": 14,
            "grid_cols": 16,
            "n_years": 22,
            "alpha": 0.05,
            "correction_method": "by",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    s = data["summary"]
    assert s["total_valid_cells"] == 14 * 16
    assert s["fdr_significant_cells"] <= s["raw_significant_cells"]
    assert data["images"]["trend_png"].startswith("data:image/png;base64,")
    assert data["images"]["fdr_png"].startswith("data:image/png;base64,")
