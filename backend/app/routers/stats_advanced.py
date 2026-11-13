"""Advanced statistical modeling routes: SARIMA, Bayesian MCMC, Extreme Value & Spatial FDR."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas import (
    BayesianMcmcRequest,
    ExtremeValueRequest,
    SarimaRequest,
    SpatialFdrRequest,
)
from ..services.bayesian_service import run_bayesian_mcmc
from ..services.extreme_service import run_extreme_value_analysis
from ..services.forecast_service import run_sarima_forecast
from ..services.spatial_fdr_service import run_spatial_fdr_analysis

router = APIRouter(prefix="/api/v1/stats", tags=["Advanced Scientific Statistics"])


@router.post("/sarima")
def sarima_forecast(payload: SarimaRequest) -> dict:
    try:
        return run_sarima_forecast(
            payload.dates,
            payload.values,
            forecast_steps=payload.forecast_steps,
            seasonal_period=payload.seasonal_period,
            auto_order=payload.auto_order,
            order=payload.order,
            seasonal_order=payload.seasonal_order,
            holdout_size=payload.holdout_size,
            variable_name=payload.variable_name or "Environmental Series",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/bayesian-mcmc")
def bayesian_mcmc(payload: BayesianMcmcRequest) -> dict:
    try:
        return run_bayesian_mcmc(
            payload.dates,
            payload.values,
            model_type=payload.model_type,
            chains=payload.chains,
            draws=payload.draws,
            burn_in=payload.burn_in,
            seed=payload.seed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/extreme-value")
def extreme_value(payload: ExtremeValueRequest) -> dict:
    try:
        return run_extreme_value_analysis(
            payload.values,
            dates=payload.dates,
            mode=payload.mode,
            block_size=payload.block_size,
            threshold_quantile=payload.threshold_quantile,
            return_periods=payload.return_periods,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/spatial-fdr")
def spatial_fdr(payload: SpatialFdrRequest) -> dict:
    try:
        return run_spatial_fdr_analysis(
            region_name=payload.region_name or "Gridded Climate Domain",
            center_lat=payload.center_lat,
            center_lon=payload.center_lon,
            grid_rows=payload.grid_rows,
            grid_cols=payload.grid_cols,
            n_years=payload.n_years,
            alpha=payload.alpha,
            correction_method=payload.correction_method,
            cube_input=payload.cube,
            seed=payload.seed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
