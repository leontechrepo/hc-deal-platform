"""Storage backend interface and factory."""
from __future__ import annotations

import os
import re
import urllib.parse
import uuid
from abc import ABC, abstractmethod

from app.core.config import settings


class StorageError(Exception):
    """Storage-layer failure."""


def content_disposition(filename: str, disposition: str = "attachment") -> str:
    ascii_name = "".join(
        c if 0x20 <= ord(c) < 0x7F and c not in '"\\%;' else "_" for c in filename
    ).strip()
    quoted = urllib.parse.quote(filename, safe="")
    return (
        f'{disposition}; filename="{ascii_name or "download"}"; '
        f"filename*=UTF-8''{quoted}"
    )


class StorageBackend(ABC):
    name: str

    def key_for(self, filename: str, folder: str = "documents") -> str:
        basename = os.path.basename(filename.strip()) or "file"
        safe_name = re.sub(r"[^A-Za-z0-9_.-]", "_", basename)
        return f"{folder}/{uuid.uuid4()}-{safe_name}"

    @abstractmethod
    async def put(self, key: str, body: bytes, content_type: str | None = None) -> None: ...

    @abstractmethod
    async def get(self, key: str) -> bytes: ...

    @abstractmethod
    async def delete(self, key: str) -> None: ...

    @abstractmethod
    async def url_for(
        self, key: str, *, download_name: str | None = None, expires_in: int = 300
    ) -> str | None: ...

    async def copy(
        self, src_key: str, dst_key: str, content_type: str | None = None
    ) -> None:
        body = await self.get(src_key)
        await self.put(dst_key, body, content_type)


def get_storage(backend: str | None = None) -> StorageBackend:
    name = backend or settings.STORAGE_BACKEND
    # Legacy HC default name for rows written before the abstraction.
    if name in ("s3", "railway_bucket"):
        from app.storage.s3 import S3Backend
        return S3Backend(
            bucket=settings.STORAGE_BUCKET_NAME,
            endpoint_url=settings.STORAGE_ENDPOINT_URL,
            access_key_id=settings.STORAGE_ACCESS_KEY_ID,
            secret_access_key=settings.STORAGE_SECRET_ACCESS_KEY,
            region=settings.STORAGE_REGION,
        )
    if name == "local":
        from app.storage.local import LocalFilesystemBackend
        return LocalFilesystemBackend(settings.STORAGE_LOCAL_PATH)
    raise StorageError(f"unknown storage backend {name!r}")


def backend_configured(backend: str | None = None) -> bool:
    """Whether *this* backend (not necessarily the active one) can be used right now.

    Documents pin the backend they were written to, so access has to be gated on
    the row's backend: after switching STORAGE_BACKEND, old S3 rows stay reachable
    as long as the S3 credentials are still present.
    """
    name = backend or settings.STORAGE_BACKEND
    if name == "local":
        return True
    if name in ("s3", "railway_bucket"):
        return bool(
            settings.STORAGE_BUCKET_NAME
            and settings.STORAGE_ENDPOINT_URL
            and settings.STORAGE_ACCESS_KEY_ID
            and settings.STORAGE_SECRET_ACCESS_KEY
        )
    return False
