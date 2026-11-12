"""Session-only credential store for NASA Earthdata & FIRMS proxies.

Environment variables provide defaults; users can also configure temporary
in-memory session tokens via `/api/v1/auth/configure` without persisting secrets
to disk or echoing raw tokens in API responses.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from threading import Lock
from typing import Optional


@dataclass
class CredentialSnapshot:
    earthdata_token: Optional[str] = None
    earthdata_username: Optional[str] = None
    earthdata_password: Optional[str] = None
    firms_map_key: Optional[str] = None


def _mask_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = value.strip()
    if len(cleaned) <= 6:
        return "*" * len(cleaned)
    return f"{cleaned[:3]}...{cleaned[-3:]}"


class AuthStore:
    """Thread-safe holder resolving env defaults and session-level overrides."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._session = CredentialSnapshot()

    def configure(
        self,
        *,
        earthdata_token: Optional[str] = None,
        earthdata_username: Optional[str] = None,
        earthdata_password: Optional[str] = None,
        firms_map_key: Optional[str] = None,
        clear_session: bool = False,
    ) -> dict:
        with self._lock:
            if clear_session:
                self._session = CredentialSnapshot()
            else:
                if earthdata_token is not None:
                    self._session.earthdata_token = earthdata_token.strip() or None
                if earthdata_username is not None:
                    self._session.earthdata_username = earthdata_username.strip() or None
                if earthdata_password is not None:
                    self._session.earthdata_password = earthdata_password.strip() or None
                if firms_map_key is not None:
                    self._session.firms_map_key = firms_map_key.strip() or None
        return self.status()

    def get_firms_map_key(self) -> Optional[str]:
        with self._lock:
            return self._session.firms_map_key or os.getenv("NASA_FIRMS_MAP_KEY") or None

    def get_earthdata_token(self) -> Optional[str]:
        with self._lock:
            return self._session.earthdata_token or os.getenv("EARTHDATA_TOKEN") or None

    def get_earthdata_credentials(self) -> tuple[Optional[str], Optional[str]]:
        with self._lock:
            user = self._session.earthdata_username or os.getenv("EARTHDATA_USERNAME") or None
            pw = self._session.earthdata_password or os.getenv("EARTHDATA_PASSWORD") or None
            return user, pw

    def has_earthdata_auth(self) -> bool:
        token = self.get_earthdata_token()
        user, pw = self.get_earthdata_credentials()
        return bool(token or (user and pw))

    def status(self) -> dict:
        with self._lock:
            edl_token = self._session.earthdata_token or os.getenv("EARTHDATA_TOKEN") or None
            edl_user = self._session.earthdata_username or os.getenv("EARTHDATA_USERNAME") or None
            edl_pass = self._session.earthdata_password or os.getenv("EARTHDATA_PASSWORD") or None
            firms_key = self._session.firms_map_key or os.getenv("NASA_FIRMS_MAP_KEY") or None

            edl_source = (
                "session"
                if (self._session.earthdata_token or (self._session.earthdata_username and self._session.earthdata_password))
                else ("environment" if (os.getenv("EARTHDATA_TOKEN") or (os.getenv("EARTHDATA_USERNAME") and os.getenv("EARTHDATA_PASSWORD"))) else "none")
            )
            firms_source = (
                "session"
                if self._session.firms_map_key
                else ("environment" if os.getenv("NASA_FIRMS_MAP_KEY") else "none")
            )

            return {
                "earthdata_configured": bool(edl_token or (edl_user and edl_pass)),
                "earthdata_source": edl_source,
                "earthdata_username_hint": _mask_secret(edl_user),
                "earthdata_token_hint": _mask_secret(edl_token),
                "firms_configured": bool(firms_key),
                "firms_source": firms_source,
                "firms_key_hint": _mask_secret(firms_key),
                "keyless_feeds_available": [
                    "NASA EONET v3 Wildfires & Events",
                    "NASA ASF SAR Granule Search",
                    "NASA CMR Discovery",
                    "Local NetCDF4/HDF5/GeoTIFF Upload Analytics",
                ],
            }


auth_store = AuthStore()
