"""Storage backend and document dedupe tests."""
from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from app.db.documents import content_hash, store_document
from app.storage.local import LocalFilesystemBackend


@pytest.mark.asyncio
async def test_local_storage_put_get_delete():
    with tempfile.TemporaryDirectory() as tmp:
        backend = LocalFilesystemBackend(tmp)
        key = backend.key_for("CIM.pdf", "active/unfiled")
        await backend.put(key, b"%PDF-1.4 test", "application/pdf")
        assert await backend.get(key) == b"%PDF-1.4 test"
        assert await backend.url_for(key) is None
        await backend.delete(key)
        with pytest.raises(Exception):
            await backend.get(key)


@pytest.mark.asyncio
async def test_local_storage_rejects_path_escape():
    with tempfile.TemporaryDirectory() as tmp:
        backend = LocalFilesystemBackend(tmp)
        with pytest.raises(Exception):
            await backend.get("../etc/passwd")


@pytest.mark.asyncio
async def test_store_document_dedupes_by_hash(db_session):
    with tempfile.TemporaryDirectory() as tmp:
        backend = LocalFilesystemBackend(tmp)
        body = b"identical-bytes"
        doc1, created1 = await store_document(
            db_session,
            name="a.pdf",
            body=body,
            content_type="application/pdf",
            doc_type="PDF",
            source="email_attachment",
            storage=backend,
        )
        doc2, created2 = await store_document(
            db_session,
            name="b.pdf",
            body=body,
            content_type="application/pdf",
            doc_type="PDF",
            source="email_attachment",
            storage=backend,
        )
        assert created1 is True
        assert created2 is False
        assert doc1.id == doc2.id
        assert doc1.sha256 == content_hash(body)
        assert doc1.deal_id is None


@pytest.mark.asyncio
async def test_backend_configured_is_per_backend(monkeypatch):
    from app.core.config import settings
    from app.storage.base import backend_configured

    monkeypatch.setattr(settings, "STORAGE_BACKEND", "local")
    monkeypatch.setattr(settings, "STORAGE_BUCKET_NAME", "")
    assert backend_configured("local") is True
    assert backend_configured("s3") is False  # active=local says nothing about s3 creds
    monkeypatch.setattr(settings, "STORAGE_BUCKET_NAME", "b")
    monkeypatch.setattr(settings, "STORAGE_ENDPOINT_URL", "https://e")
    monkeypatch.setattr(settings, "STORAGE_ACCESS_KEY_ID", "k")
    monkeypatch.setattr(settings, "STORAGE_SECRET_ACCESS_KEY", "s")
    assert backend_configured("s3") is True and backend_configured("railway_bucket") is True
    assert backend_configured("nope") is False


@pytest.mark.asyncio
async def test_store_document_pins_backend_and_cleans_up_on_failure(db_session):
    from sqlalchemy.exc import IntegrityError

    with tempfile.TemporaryDirectory() as tmp:
        backend = LocalFilesystemBackend(tmp)
        doc, created = await store_document(
            db_session, name="a.pdf", body=b"pin-me", storage=backend, source="email_attachment"
        )
        assert created and doc.storage_backend == "local" and doc.deal_id is None  # unfiled

        # A DB failure after the bytes were written must not leave an orphan object.
        class Exploding(LocalFilesystemBackend):
            deleted: list[str] = []

            async def delete(self, key):
                self.deleted.append(key)
                await super().delete(key)

        exploding = Exploding(tmp)
        original_add = db_session.add

        def bad_add(obj):
            raise IntegrityError("x", {}, Exception("boom"))

        db_session.add = bad_add  # type: ignore[method-assign]
        try:
            with pytest.raises(IntegrityError):
                await store_document(db_session, name="b.pdf", body=b"other-bytes", storage=exploding)
        finally:
            db_session.add = original_add  # type: ignore[method-assign]
        assert len(exploding.deleted) == 1
        with pytest.raises(Exception):
            await exploding.get(exploding.deleted[0])
