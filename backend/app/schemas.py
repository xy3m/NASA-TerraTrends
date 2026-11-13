"""Pydantic v2 request and response schemas for Geo-Iris Phase 2 API."""

from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

ProvenanceTier = Literal[
    "satellite_observation",
    "reanalysis_model",
    "user_upload",
    "synthetic_demo",
]


class ProvenanceMetadata(BaseModel):
    tier: ProvenanceTier
    source_name: str
    dataset_id: str
    is_live: bool
    status_message: str
    citation: Optional[str] = None


class AuthConfigRequest(BaseModel):
    earthdata_token: Optional[str] = Field(default=None, description="Earthdata Login Bearer token (session-only)")
    earthdata_username: Optional[str] = Field(default=None, description="Earthdata Login username (session-only)")
    earthdata_password: Optional[str] = Field(default=None, description="Earthdata Login password (session-only)")
    firms_map_key: Optional[str] = Field(default=None, description="NASA FIRMS MAP_KEY (session-only)")
    clear_session: bool = False


class AuthStatusResponse(BaseModel):
    earthdata_configured: bool
    earthdata_source: str
    earthdata_username_hint: Optional[str] = None
    earthdata_token_hint: Optional[str] = None
    firms_configured: bool
    firms_source: str
    firms_key_hint: Optional[str] = None
    keyless_feeds_available: list[str]


class HealthResponse(BaseModel):
    status: str
    version: str
    capabilities: dict[str, bool]
    auth: AuthStatusResponse


# ---------------------------------------------------------------------------
# Advanced Statistical & Mathematical Schemas
# ---------------------------------------------------------------------------

class TimeSeriesInputPoint(BaseModel):
    date: str
    value: Optional[float] = None


class SarimaRequest(BaseModel):
    dates: list[str] = Field(min_length=24)
    values: list[Optional[float]] = Field(min_length=24)
    forecast_steps: int = Field(default=12, ge=1, le=60)
    seasonal_period: int = Field(default=12, ge=1, le=24)
    auto_order: bool = True
    order: tuple[int, int, int] = (1, 1, 1)
    seasonal_order: tuple[int, int, int, int] = (1, 0, 1, 12)
    holdout_size: int = Field(default=6, ge=0, le=24)
    variable_name: Optional[str] = "Environmental Series"


class BayesianMcmcRequest(BaseModel):
    dates: list[str] = Field(min_length=12)
    values: list[Optional[float]] = Field(min_length=12)
    model_type: Literal["robust_ar1", "changepoint"] = "robust_ar1"
    chains: int = Field(default=3, ge=2, le=4)
    draws: int = Field(default=900, ge=300, le=2500)
    burn_in: int = Field(default=450, ge=150, le=1200)
    seed: int = 42


class ExtremeValueRequest(BaseModel):
    values: list[Optional[float]] = Field(min_length=10)
    dates: Optional[list[str]] = None
    mode: Literal["gev_block_maxima", "gpd_pot"] = "gev_block_maxima"
    block_size: int = Field(default=12, ge=2, le=60)
    threshold_quantile: float = Field(default=0.85, ge=0.5, le=0.98)
    return_periods: list[float] = Field(default_factory=lambda: [2, 5, 10, 20, 50, 100])


class SpatialFdrRequest(BaseModel):
    """Run vectorized Mann-Kendall across a 3D (T, H, W) spatio-temporal grid."""

    region_name: Optional[str] = "Arctic & Boreal Sub-Grid"
    center_lat: float = Field(default=68.0, ge=-90.0, le=90.0)
    center_lon: float = Field(default=20.0, ge=-180.0, le=180.0)
    grid_rows: int = Field(default=20, ge=5, le=64)
    grid_cols: int = Field(default=24, ge=5, le=64)
    n_years: int = Field(default=20, ge=8, le=45)
    alpha: float = Field(default=0.05, ge=0.001, le=0.25)
    correction_method: Literal["bh", "by", "holm", "bonferroni"] = "by"
    cube: Optional[list[list[list[Optional[float]]]]] = None
    seed: int = 42


# ---------------------------------------------------------------------------
# NASA Proxy & Earthdata Schemas
# ---------------------------------------------------------------------------

class FirmsQueryRequest(BaseModel):
    west: float = Field(default=-125.0, ge=-180.0, le=180.0)
    south: float = Field(default=32.0, ge=-90.0, le=90.0)
    east: float = Field(default=-114.0, ge=-180.0, le=180.0)
    north: float = Field(default=43.0, ge=-90.0, le=90.0)
    source: Literal["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "MODIS_NRT"] = "VIIRS_SNPP_NRT"
    day_range: int = Field(default=5, ge=1, le=10)
    region_label: Optional[str] = "California & Western Sierra"
    allow_eonet_fallback: bool = True


class VerticalProfileRequest(BaseModel):
    lat: float = Field(default=0.0, ge=-90.0, le=90.0)
    lon: float = Field(default=-60.0, ge=-180.0, le=180.0)
    start_year: int = Field(default=2003, ge=1980, le=2025)
    end_year: int = Field(default=2024, ge=1981, le=2026)
    product: Literal["AIRS3STM", "MERRA2_M2IMNPASM"] = "AIRS3STM"


class TraceGasRequest(BaseModel):
    gas: Literal["NO2", "CH4", "CO", "SO2"] = "NO2"
    lat: float = Field(default=31.2, ge=-90.0, le=90.0)
    lon: float = Field(default=121.5, ge=-180.0, le=180.0)
    region_label: Optional[str] = "Yangtze River Delta Industrial Corridor"
    start_year: int = Field(default=2018, ge=2004, le=2025)
    end_year: int = Field(default=2025, ge=2005, le=2026)


class EarthdataGranuleRequest(BaseModel):
    short_name: str = Field(default="AIRS3STM", min_length=2, max_length=64)
    bbox: tuple[float, float, float, float] = (-10.0, 40.0, 20.0, 60.0)
    start_date: str = "2023-01-01"
    end_date: str = "2024-12-31"
    max_results: int = Field(default=10, ge=1, le=30)


class AppeearsPointRequest(BaseModel):
    product: str = Field(default="MOD13Q1.061", min_length=3, max_length=64)
    layer: str = Field(default="_250m_16_days_NDVI", min_length=2, max_length=128)
    lat: float = Field(default=-3.1, ge=-90.0, le=90.0)
    lon: float = Field(default=-60.0, ge=-180.0, le=180.0)
    start_date: str = "01-01-2020"
    end_date: str = "12-31-2024"
    task_name: str = "geo_iris_point_sample"


# ---------------------------------------------------------------------------
# Raster / Landform / SAR Schemas
# ---------------------------------------------------------------------------

class DemDiffPresetRequest(BaseModel):
    scenario: Literal[
        "mount_st_helens_lahar",
        "colorado_river_incision",
        "thwaites_glacier_thinning",
    ] = "mount_st_helens_lahar"
    lod_threshold_m: float = Field(default=0.75, ge=0.0, le=10.0)
    pixel_size_m: float = Field(default=10.0, ge=0.5, le=1000.0)


class SarChangePresetRequest(BaseModel):
    scenario: Literal[
        "amazon_seasonal_flooding",
        "rondonia_deforestation_clearcut",
        "kilauea_lava_emplacement",
    ] = "amazon_seasonal_flooding"
    speckle_filter: Literal["none", "lee", "mean"] = "lee"
    window_size: int = Field(default=5, ge=3, le=11)
    threshold_db: float = Field(default=3.0, ge=0.5, le=15.0)
    pixel_size_m: float = Field(default=20.0, ge=1.0, le=1000.0)


class LulcPresetRequest(BaseModel):
    scenario: Literal[
        "amazon_arc_deforestation",
        "pearl_river_urbanization",
        "aral_sea_desiccation",
    ] = "amazon_arc_deforestation"


class AsfSearchRequest(BaseModel):
    lat: float = Field(default=-3.46, ge=-90.0, le=90.0)
    lon: float = Field(default=-62.21, ge=-180.0, le=180.0)
    radius_deg: float = Field(default=0.4, ge=0.05, le=3.0)
    platform: Literal["SENTINEL-1", "ALOS", "UAVSAR", "SEASAT"] = "SENTINEL-1"
    start_date: str = "2024-01-01T00:00:00Z"
    end_date: str = "2025-12-31T23:59:59Z"
    max_results: int = Field(default=12, ge=1, le=30)
