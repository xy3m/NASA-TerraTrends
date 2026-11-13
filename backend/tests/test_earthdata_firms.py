"""Tests for NetCDF4 upload inspect/extract, vertical profiles, trace gases & FIRMS resilience."""

from __future__ import annotations

import os
import tempfile

import numpy as np
import xarray as xr
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_netcdf_inspect_and_extract_roundtrip():
    dates = [f"2020-{m:02d}-01" for m in range(1, 13)] + [f"2021-{m:02d}-01" for m in range(1, 13)]
    lats = np.array([75.0, 77.5, 80.0])
    lons = np.array([10.0, 15.0, 20.0])
    data = np.linspace(260.0, 275.0, 24 * 3 * 3).reshape(24, 3, 3)

    ds = xr.Dataset(
        {
            "t2m": (
                ("time", "lat", "lon"),
                data,
                {"units": "K", "long_name": "2-meter Air Temperature"},
            )
        },
        coords={"time": dates, "lat": lats, "lon": lons},
        attrs={"title": "Geo-Iris NetCDF Test Cube"},
    )

    fd, path = tempfile.mkstemp(suffix=".nc")
    os.close(fd)
    try:
        ds.to_netcdf(path, engine="netcdf4")
        with open(path, "rb") as f:
            nc_bytes = f.read()
    finally:
        if os.path.exists(path):
            os.remove(path)

    insp = client.post(
        "/api/v1/earthdata/netcdf/inspect",
        files={"file": ("svalbard_t2m.nc", nc_bytes, "application/x-netcdf")},
    )
    assert insp.status_code == 200
    meta = insp.json()
    assert meta["dims"]["time"] == 24
    assert meta["variables"][0]["name"] == "t2m"
    assert meta["variables"][0]["units"] == "K"

    ext = client.post(
        "/api/v1/earthdata/netcdf/extract",
        data={"variable": "t2m", "target_lat": "77.5", "target_lon": "15.0"},
        files={"file": ("svalbard_t2m.nc", nc_bytes, "application/x-netcdf")},
    )
    assert ext.status_code == 200
    body = ext.json()
    assert body["provenance"]["tier"] == "user_upload"
    assert len(body["series"]) == 24
    assert body["has_spatial_cube"] is True


def test_vertical_profile_and_trace_gas_endpoints():
    vp = client.post(
        "/api/v1/earthdata/vertical-profile",
        json={"lat": 78.0, "lon": 15.0, "start_year": 2003, "end_year": 2024, "product": "AIRS3STM"},
    )
    assert vp.status_code == 200
    vp_data = vp.json()
    levels = vp_data["profile_by_pressure"]
    assert len(levels) == 12
    # Lower troposphere should show warming trend while upper stratosphere cools
    assert levels[0]["trend_c_per_decade"] > 0
    assert levels[-1]["trend_c_per_decade"] < 0

    tg = client.post(
        "/api/v1/earthdata/trace-gases",
        json={"gas": "CH4", "lat": 68.0, "lon": 25.0, "start_year": 2019, "end_year": 2024},
    )
    assert tg.status_code == 200
    tg_data = tg.json()
    assert tg_data["gas"] == "CH4"
    assert len(tg_data["values"]) == 72


def test_firms_proxy_without_key_handles_gracefully():
    resp = client.post(
        "/api/v1/firms/fires",
        json={
            "west": -125.0,
            "south": 32.0,
            "east": -114.0,
            "north": 42.0,
            "source": "VIIRS_SNPP_NRT",
            "day_range": 5,
            "allow_eonet_fallback": True,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "provenance" in body
    assert body["provenance"]["tier"] in {"satellite_observation", "synthetic_demo"}
    assert body["summary"]["total_detections"] >= 1
