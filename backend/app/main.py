"""Geo-Iris Phase 2 FastAPI application entrypoint."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import earthdata, firms, health, rasters, stats_advanced

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=(
        "Phase 2 scientific backend providing SARIMA/ARIMA state-space forecasting, "
        "Bayesian MCMC trend & change-point inference, GEV/GPD extremes, vectorized "
        "Spatial FDR, NetCDF4/HDF5 inspection, GeoTIFF DEM/SAR/LULC change detection, "
        "and NASA FIRMS/EONET/CMR/ASF/AppEEARS proxy feeds."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(stats_advanced.router)
app.include_router(firms.router)
app.include_router(earthdata.router)
app.include_router(rasters.router)


@app.get("/")
def root() -> dict:
    return {
        "service": settings.app_name,
        "version": settings.version,
        "docs_url": "/docs",
        "health_url": "/api/v1/health",
    }
