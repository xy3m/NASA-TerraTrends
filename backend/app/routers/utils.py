"""Shared router helpers."""

from __future__ import annotations

from fastapi import HTTPException, UploadFile
from ..config import settings


async def read_checked_upload(upload: UploadFile) -> tuple[bytes, str]:
    """Read an uploaded file enforcing the global payload size limit."""
    raw = await upload.read()
    if not raw:
        raise HTTPException(status_code=400, detail=f"Uploaded file '{upload.filename}' is empty.")
    if len(raw) > settings.max_upload_bytes:
        mb = settings.max_upload_bytes // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"Uploaded file exceeds {mb} MB limit.")
    return raw, upload.filename or "upload.bin"
