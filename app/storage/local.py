"""Local filesystem storage backend for development."""
from __future__ import annotations

import contextlib
import os
import tempfile
from pathlib import Path

from app.storage.base import StorageBackend, StorageError


class LocalFilesystemBackend(StorageBackend):
    name = "local"

    def __init__(self, root: str | Path):
        self._root = Path(root)
        self._root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        root = self._root.resolve()
        candidate = (self._root / key).resolve()
        try:
            candidate.relative_to(root)
        except ValueError:
            raise StorageError(f"key {key!r} escapes the storage root") from None
        return candidate

    async def put(self, key: str, body: bytes, content_type: str | None = None) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(dir=path.parent, suffix=".partial")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(body)
            os.replace(tmp_path, path)
        except Exception:
            with contextlib.suppress(FileNotFoundError):
                os.remove(tmp_path)
            raise

    async def get(self, key: str) -> bytes:
        try:
            return self._path(key).read_bytes()
        except FileNotFoundError:
            raise StorageError(f"no object at key {key!r}") from None

    async def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    async def url_for(
        self, key: str, *, download_name: str | None = None, expires_in: int = 300
    ) -> str | None:
        return None
