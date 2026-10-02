"""Helpers around the storage abstraction for deal documents."""
from __future__ import annotations

import uuid

from app.storage.base import get_storage


def make_storage_key(deal_id: uuid.UUID, filename: str) -> str:
    return get_storage().key_for(filename, folder=f"active/{deal_id}")


async def put_object(
    storage_key: str,
    body: bytes,
    content_type: str | None,
    *,
    backend: str | None = None,
) -> str:
    """Write bytes; returns the backend name that was used."""
    storage = get_storage(backend)
    await storage.put(storage_key, body, content_type)
    return storage.name


async def presigned_get_url(
    storage_key: str,
    *,
    backend: str | None = None,
    download_name: str | None = None,
    expires_in: int = 300,
) -> str | None:
    return await get_storage(backend).url_for(
        storage_key, download_name=download_name, expires_in=expires_in
    )


async def delete_object(
    storage_key: str, *, backend: str | None = None
) -> None:
    await get_storage(backend).delete(storage_key)
