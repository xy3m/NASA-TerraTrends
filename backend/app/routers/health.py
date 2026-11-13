"""Health check and session credential configuration routes."""

from __future__ import annotations

from fastapi import APIRouter

from ..config import settings
from ..schemas import AuthConfigRequest, AuthStatusResponse, HealthResponse
from ..services.auth_store import auth_store

router = APIRouter(prefix="/api/v1", tags=["Health & Auth"])


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=settings.version,
        capabilities={
            "sarima": True,
            "bayesian_mcmc": True,
            "extreme_value_gev_gpd": True,
            "spatial_fdr": True,
            "netcdf4_hdf5_xarray": True,
            "rasterio_dem_sar_lulc": True,
            "firms_eonet_proxy": True,
            "asf_sar_search": True,
            "appeears_cmr_proxy": True,
        },
        auth=AuthStatusResponse(**auth_store.status()),
    )


@router.get("/auth/status", response_model=AuthStatusResponse)
def get_auth_status() -> AuthStatusResponse:
    return AuthStatusResponse(**auth_store.status())


@router.post("/auth/configure", response_model=AuthStatusResponse)
def configure_auth(payload: AuthConfigRequest) -> AuthStatusResponse:
    updated = auth_store.configure(
        earthdata_token=payload.earthdata_token,
        earthdata_username=payload.earthdata_username,
        earthdata_password=payload.earthdata_password,
        firms_map_key=payload.firms_map_key,
        clear_session=payload.clear_session,
    )
    return AuthStatusResponse(**updated)
