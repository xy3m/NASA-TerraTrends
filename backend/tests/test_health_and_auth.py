"""Tests for health, capability discovery, and non-leaking session credential store."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["capabilities"]["sarima"] is True
    assert data["capabilities"]["bayesian_mcmc"] is True
    assert data["capabilities"]["spatial_fdr"] is True
    assert data["capabilities"]["netcdf4_hdf5_xarray"] is True
    assert data["capabilities"]["rasterio_dem_sar_lulc"] is True


def test_auth_configure_masks_and_clears_secrets():
    resp = client.post(
        "/api/v1/auth/configure",
        json={
            "firms_map_key": "secret_firms_map_key_998877",
            "earthdata_token": "edl_bearer_super_secret_token_xyz",
            "earthdata_username": "nasaresearcher",
            "earthdata_password": "secret_password",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["firms_configured"] is True
    assert body["firms_source"] == "session"
    assert body["earthdata_configured"] is True
    assert body["earthdata_source"] == "session"
    # Verify masked suffix hints appear without ever exposing raw secrets
    serialized = str(body)
    assert "sec...877" in serialized
    assert "secret_firms_map_key_998877" not in serialized
    assert "edl_bearer_super_secret_token_xyz" not in serialized
    assert "secret_password" not in serialized

    cleared = client.post("/api/v1/auth/configure", json={"clear_session": True})
    assert cleared.status_code == 200
    assert cleared.json()["firms_source"] != "session"
    assert cleared.json()["earthdata_source"] != "session"
