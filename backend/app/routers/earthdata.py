"""Earthdata, AppEEARS, Vertical Sounding Profiles, Trace Gases & NetCDF4/HDF5 routes."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..schemas import (
    AppeearsPointRequest,
    EarthdataGranuleRequest,
    TraceGasRequest,
    VerticalProfileRequest,
)
from ..services.earthdata_service import (
    extract_netcdf_subset,
    get_trace_gas_analytics,
    get_vertical_pressure_profile,
    inspect_netcdf_file,
    proxy_appeears_point_task,
    search_earthdata_granules,
)
from .utils import read_checked_upload

router = APIRouter(prefix="/api/v1/earthdata", tags=["Earthdata & NetCDF4"])


@router.post("/granules")
def search_granules(payload: EarthdataGranuleRequest) -> dict:
    return search_earthdata_granules(
        short_name=payload.short_name,
        bbox=payload.bbox,
        start_date=payload.start_date,
        end_date=payload.end_date,
        max_results=payload.max_results,
    )


@router.post("/appeears-point")
def submit_appeears_point(payload: AppeearsPointRequest) -> dict:
    return proxy_appeears_point_task(
        product=payload.product,
        layer=payload.layer,
        lat=payload.lat,
        lon=payload.lon,
        start_date=payload.start_date,
        end_date=payload.end_date,
        task_name=payload.task_name,
    )


@router.post("/vertical-profile")
def vertical_profile(payload: VerticalProfileRequest) -> dict:
    return get_vertical_pressure_profile(
        lat=payload.lat,
        lon=payload.lon,
        start_year=payload.start_year,
        end_year=payload.end_year,
        product=payload.product,
    )


@router.post("/trace-gases")
def trace_gases(payload: TraceGasRequest) -> dict:
    return get_trace_gas_analytics(
        gas=payload.gas,
        lat=payload.lat,
        lon=payload.lon,
        region_label=payload.region_label or f"({payload.lat:.1f}, {payload.lon:.1f})",
        start_year=payload.start_year,
        end_year=payload.end_year,
    )


@router.post("/netcdf/inspect")
async def inspect_netcdf(file: UploadFile = File(...)) -> dict:
    raw, filename = await read_checked_upload(file)
    try:
        return inspect_netcdf_file(raw, filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/netcdf/extract")
async def extract_netcdf(
    file: UploadFile = File(...),
    variable: Optional[str] = Form(default=None),
    target_lat: Optional[float] = Form(default=None),
    target_lon: Optional[float] = Form(default=None),
    spatial_mean: bool = Form(default=False),
) -> dict:
    raw, filename = await read_checked_upload(file)
    try:
        return extract_netcdf_subset(
            raw,
            filename,
            variable=variable,
            target_lat=target_lat,
            target_lon=target_lon,
            spatial_mean=spatial_mean,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
