"""Runtime configuration for the Geo-Iris Phase 2 FastAPI backend."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    """Application settings loaded from environment variables and `.env`."""

    app_name: str = "Geo-Iris Phase 2 Scientific Compute & NASA Proxy API"
    version: str = "2.0.0"
    host: str = field(default_factory=lambda: os.getenv("BACKEND_HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: int(os.getenv("BACKEND_PORT", "8000")))
    cors_origins: list[str] = field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        ]
    )
    max_upload_bytes: int = 35 * 1024 * 1024  # 35 MB safety bound for GeoTIFF / NetCDF uploads
    http_timeout_seconds: float = 25.0


settings = Settings()
