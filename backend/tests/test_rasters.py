"""Tests for DEM Differencing (DoD), SAR Change Detection & LULC Transitions (presets + GeoTIFF upload)."""

from __future__ import annotations

import os
import tempfile

import numpy as np
import rasterio
from rasterio.transform import from_origin
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _make_geotiff_bytes(array: np.ndarray, pixel_size: float = 10.0) -> bytes:
    fd, path = tempfile.mkstemp(suffix=".tif")
    os.close(fd)
    try:
        transform = from_origin(500000.0, 5000000.0, pixel_size, pixel_size)
        with rasterio.open(
            path,
            "w",
            driver="GTiff",
            height=array.shape[0],
            width=array.shape[1],
            count=1,
            dtype=array.dtype,
            crs="EPSG:32610",
            transform=transform,
        ) as dst:
            dst.write(array, 1)
        with open(path, "rb") as f:
            return f.read()
    finally:
        if os.path.exists(path):
            os.remove(path)


def test_dem_preset_and_geotiff_upload():
    preset = client.post(
        "/api/v1/rasters/dem-diff",
        json={"scenario": "mount_st_helens_lahar", "lod_threshold_m": 0.75},
    )
    assert preset.status_code == 200
    p = preset.json()
    assert p["summary"]["erosion_volume_m3"] > 0
    assert p["summary"]["deposition_volume_m3"] > 0
    assert p["images"]["dod_png"].startswith("data:image/png;base64,")

    dem1 = np.full((32, 32), 100.0, dtype=np.float32)
    dem2 = dem1.copy()
    dem2[4:12, 4:12] -= 5.0  # Known 8x8 pixel * 100m^2 * 5m = 32,000 m^3 erosion
    dem2[18:24, 18:24] += 3.0  # Known 6x6 pixel * 100m^2 * 3m = 10,800 m^3 deposition

    b1 = _make_geotiff_bytes(dem1, pixel_size=10.0)
    b2 = _make_geotiff_bytes(dem2, pixel_size=10.0)
    up = client.post(
        "/api/v1/rasters/dem-diff/upload",
        data={"lod_threshold_m": "0.5"},
        files={
            "before_file": ("dem1.tif", b1, "image/tiff"),
            "after_file": ("dem2.tif", b2, "image/tiff"),
        },
    )
    assert up.status_code == 200
    u = up.json()
    assert u["provenance"]["tier"] == "user_upload"
    assert abs(u["summary"]["erosion_volume_m3"] - 32000.0) < 50.0
    assert abs(u["summary"]["deposition_volume_m3"] - 10800.0) < 50.0


def test_sar_preset_and_geotiff_upload():
    preset = client.post(
        "/api/v1/rasters/sar-change",
        json={"scenario": "amazon_seasonal_flooding", "speckle_filter": "lee", "threshold_db": 3.0},
    )
    assert preset.status_code == 200
    s = preset.json()
    assert s["summary"]["backscatter_drop_area_km2"] > 0
    assert s["otsu_suggested_threshold_db"] > 0

    sar1 = np.full((36, 36), 0.40, dtype=np.float32)
    sar2 = sar1.copy()
    sar2[10:22, 10:22] = 0.04  # -10 dB drop
    b1 = _make_geotiff_bytes(sar1, pixel_size=20.0)
    b2 = _make_geotiff_bytes(sar2, pixel_size=20.0)
    up = client.post(
        "/api/v1/rasters/sar-change/upload",
        data={"speckle_filter": "none", "threshold_db": "3.0"},
        files={
            "before_file": ("sar1.tif", b1, "image/tiff"),
            "after_file": ("sar2.tif", b2, "image/tiff"),
        },
    )
    assert up.status_code == 200
    assert up.json()["summary"]["backscatter_drop_area_km2"] > 0.05


def test_lulc_preset_and_geotiff_upload():
    preset = client.post(
        "/api/v1/rasters/lulc-transitions",
        json={"scenario": "amazon_arc_deforestation"},
    )
    assert preset.status_code == 200
    l_data = preset.json()
    assert 0.0 < l_data["cohen_kappa"] <= 1.0
    assert len(l_data["transition_matrix"]["counts"]) >= 2

    m1 = np.ones((20, 20), dtype=np.int16)
    m1[10:, :] = 2
    m2 = m1.copy()
    m2[:5, :10] = 3  # 50 pixels converted from class 1 to 3
    up = client.post(
        "/api/v1/rasters/lulc-transitions/upload",
        files={
            "before_file": ("lulc1.tif", _make_geotiff_bytes(m1, 500.0), "image/tiff"),
            "after_file": ("lulc2.tif", _make_geotiff_bytes(m2, 500.0), "image/tiff"),
        },
    )
    assert up.status_code == 200
    u = up.json()
    assert abs(u["pct_changed"] - 12.5) < 0.2
