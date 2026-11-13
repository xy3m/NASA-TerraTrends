"""SAR Change Detection, DEM Differencing (DoD), LULC Transitions & NASA ASF routes."""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..schemas import (
    AsfSearchRequest,
    DemDiffPresetRequest,
    LulcPresetRequest,
    SarChangePresetRequest,
)
from ..services.raster_service import (
    compute_dem_differencing,
    compute_dem_differencing_from_files,
    compute_lulc_from_files,
    compute_lulc_transitions,
    compute_sar_change_detection,
    compute_sar_change_from_files,
    search_asf_sar_granules,
)
from .utils import read_checked_upload

router = APIRouter(prefix="/api/v1/rasters", tags=["SAR, DEM & LULC Rasters"])


@router.post("/dem-diff")
def dem_diff_preset(payload: DemDiffPresetRequest) -> dict:
    return compute_dem_differencing(
        scenario=payload.scenario,
        lod_threshold_m=payload.lod_threshold_m,
        pixel_size_m=payload.pixel_size_m,
    )


@router.post("/dem-diff/upload")
async def dem_diff_upload(
    before_file: UploadFile = File(...),
    after_file: UploadFile = File(...),
    lod_threshold_m: float = Form(default=0.75),
) -> dict:
    b1, n1 = await read_checked_upload(before_file)
    b2, n2 = await read_checked_upload(after_file)
    try:
        return compute_dem_differencing_from_files(
            b1, n1, b2, n2, lod_threshold_m=lod_threshold_m
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to compute DEM DoD: {exc}") from exc


@router.post("/sar-change")
def sar_change_preset(payload: SarChangePresetRequest) -> dict:
    return compute_sar_change_detection(
        scenario=payload.scenario,
        speckle_filter=payload.speckle_filter,
        window_size=payload.window_size,
        threshold_db=payload.threshold_db,
        pixel_size_m=payload.pixel_size_m,
    )


@router.post("/sar-change/upload")
async def sar_change_upload(
    before_file: UploadFile = File(...),
    after_file: UploadFile = File(...),
    speckle_filter: str = Form(default="lee"),
    window_size: int = Form(default=5),
    threshold_db: float = Form(default=3.0),
) -> dict:
    b1, n1 = await read_checked_upload(before_file)
    b2, n2 = await read_checked_upload(after_file)
    filt = speckle_filter if speckle_filter in {"none", "lee", "mean"} else "lee"
    try:
        return compute_sar_change_from_files(
            b1,
            n1,
            b2,
            n2,
            speckle_filter=filt,  # type: ignore[arg-type]
            window_size=window_size,
            threshold_db=threshold_db,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to compute SAR change: {exc}") from exc


@router.post("/asf-search")
def asf_sar_search(payload: AsfSearchRequest) -> dict:
    return search_asf_sar_granules(
        lat=payload.lat,
        lon=payload.lon,
        radius_deg=payload.radius_deg,
        platform=payload.platform,
        start_date=payload.start_date,
        end_date=payload.end_date,
        max_results=payload.max_results,
    )


@router.post("/lulc-transitions")
def lulc_preset(payload: LulcPresetRequest) -> dict:
    return compute_lulc_transitions(scenario=payload.scenario)


@router.post("/lulc-transitions/upload")
async def lulc_upload(
    before_file: UploadFile = File(...),
    after_file: UploadFile = File(...),
) -> dict:
    b1, n1 = await read_checked_upload(before_file)
    b2, n2 = await read_checked_upload(after_file)
    try:
        return compute_lulc_from_files(b1, n1, b2, n2)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to compute LULC matrix: {exc}") from exc
