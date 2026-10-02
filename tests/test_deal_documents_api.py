"""
Tests for the deal documents API — storage calls mocked; no real S3.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import delete

import app.api.deal_documents as docs_mod
from app.api.deal_documents import (
    delete_document,
    download_document,
    list_documents,
    upload_document,
)
from app.api.deals import CreateDealRequest, create_deal
from app.db.models.deals import Deal
from app.db.models.documents import DealDocument

TEST_AUTH = {"sub": "test-user"}


def _configure_storage(monkeypatch):
    monkeypatch.setattr(docs_mod.settings, "STORAGE_BACKEND", "s3")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_BUCKET_NAME", "test-bucket")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_ENDPOINT_URL", "https://fake.storageapi.dev")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_ACCESS_KEY_ID", "fake-key-id")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_SECRET_ACCESS_KEY", "fake-secret")


def _fake_upload(filename="term_sheet.pdf", content=b"hello world", content_type="application/pdf"):
    upload = MagicMock()
    upload.filename = filename
    upload.content_type = content_type

    async def _read():
        return content

    upload.read = _read
    return upload


async def _make_deal(db_session):
    result = await create_deal(CreateDealRequest(company_name="Doc Test Co"), db_session, auth=TEST_AUTH)
    return result["deal_id"]


async def _cleanup_deal(db_session, deal_id):
    # deal_documents.deal_id is SET NULL: delete them explicitly so they don't become unfiled rows.
    await db_session.execute(delete(DealDocument).where(DealDocument.deal_id == deal_id))
    await db_session.execute(delete(Deal).where(Deal.id == deal_id))
    await db_session.commit()


async def test_upload_creates_document_and_calls_put_object(db_session, monkeypatch):
    _configure_storage(monkeypatch)
    deal_id = await _make_deal(db_session)

    with patch.object(docs_mod.storage, "put_object", new_callable=AsyncMock, return_value="s3") as mock_put:
        result = await upload_document(
            deal_id, file=_fake_upload(), category="NDA", db=db_session, auth=TEST_AUTH,
        )

    mock_put.assert_awaited_once()
    key_arg = mock_put.await_args[0][0]
    assert f"/{deal_id}/" in key_arg or key_arg.startswith(f"active/{deal_id}/")
    assert result["name"] == "term_sheet.pdf"
    assert result["category"] == "NDA"
    assert result["size_bytes"] == len(b"hello world")
    assert result["status"] == "active"
    assert result["storage_backend"] == "s3"


async def test_upload_rejects_invalid_category(db_session, monkeypatch):
    _configure_storage(monkeypatch)
    deal_id = await _make_deal(db_session)

    with patch.object(docs_mod.storage, "put_object", new_callable=AsyncMock) as mock_put:
        with pytest.raises(HTTPException) as exc_info:
            await upload_document(
                deal_id, file=_fake_upload(), category="Not A Real Category", db=db_session, auth=TEST_AUTH,
            )
    assert exc_info.value.status_code == 400
    mock_put.assert_not_called()


async def test_upload_503_when_storage_not_configured(db_session, monkeypatch):
    monkeypatch.setattr(docs_mod.settings, "STORAGE_BACKEND", "s3")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_BUCKET_NAME", "")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_ENDPOINT_URL", "")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_ACCESS_KEY_ID", "")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_SECRET_ACCESS_KEY", "")
    deal_id = await _make_deal(db_session)

    with patch.object(docs_mod.storage, "put_object", new_callable=AsyncMock) as mock_put:
        with pytest.raises(HTTPException) as exc_info:
            await upload_document(
                deal_id, file=_fake_upload(), category="NDA", db=db_session, auth=TEST_AUTH,
            )
    assert exc_info.value.status_code == 503
    mock_put.assert_not_called()


async def test_list_documents_excludes_deleted(db_session, monkeypatch):
    _configure_storage(monkeypatch)
    deal_id = await _make_deal(db_session)

    with patch.object(docs_mod.storage, "put_object", new_callable=AsyncMock, return_value="s3"):
        kept = await upload_document(
            deal_id, file=_fake_upload("kept.pdf", content=b"kept bytes"), category="NDA", db=db_session, auth=TEST_AUTH,
        )
        removed = await upload_document(
            deal_id, file=_fake_upload("removed.pdf", content=b"removed bytes"), category="NDA", db=db_session, auth=TEST_AUTH,
        )

    with patch.object(docs_mod.storage, "delete_object", new_callable=AsyncMock):
        await delete_document(removed["id"], db=db_session, auth=TEST_AUTH)

    docs = await list_documents(deal_id, db=db_session)
    ids = [d["id"] for d in docs]
    assert kept["id"] in ids
    assert removed["id"] not in ids

    await _cleanup_deal(db_session, deal_id)


async def test_download_redirects_to_presigned_url(db_session, monkeypatch):
    _configure_storage(monkeypatch)
    deal_id = await _make_deal(db_session)

    with patch.object(docs_mod.storage, "put_object", new_callable=AsyncMock, return_value="s3"):
        doc = await upload_document(
            deal_id, file=_fake_upload(), category="NDA", db=db_session, auth=TEST_AUTH,
        )

    fake_backend = MagicMock()
    fake_backend.url_for = AsyncMock(return_value="https://fake.storageapi.dev/signed-url")
    with patch.object(docs_mod, "get_storage", return_value=fake_backend):
        response = await download_document(doc["id"], db=db_session)

    fake_backend.url_for.assert_awaited_once()
    assert response.status_code == 302
    assert response.headers["location"] == "https://fake.storageapi.dev/signed-url"


async def test_delete_calls_storage_delete_object_and_soft_deletes(db_session, monkeypatch):
    _configure_storage(monkeypatch)
    deal_id = await _make_deal(db_session)

    with patch.object(docs_mod.storage, "put_object", new_callable=AsyncMock, return_value="s3"):
        doc = await upload_document(
            deal_id, file=_fake_upload(), category="NDA", db=db_session, auth=TEST_AUTH,
        )

    with patch.object(docs_mod.storage, "delete_object", new_callable=AsyncMock) as mock_delete:
        result = await delete_document(doc["id"], db=db_session, auth=TEST_AUTH)

    mock_delete.assert_awaited_once()
    assert result == {"ok": True, "document_id": doc["id"]}

    stored = await db_session.get(DealDocument, doc["id"])
    assert stored.status == "deleted"

    await _cleanup_deal(db_session, deal_id)


async def test_delete_still_soft_deletes_when_storage_unconfigured(db_session, monkeypatch):
    """Blob delete is best-effort; soft-delete always commits first."""
    _configure_storage(monkeypatch)
    deal_id = await _make_deal(db_session)

    with patch.object(docs_mod.storage, "put_object", new_callable=AsyncMock, return_value="s3"):
        doc = await upload_document(
            deal_id, file=_fake_upload(), category="NDA", db=db_session, auth=TEST_AUTH,
        )

    monkeypatch.setattr(docs_mod.settings, "STORAGE_BUCKET_NAME", "")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_ENDPOINT_URL", "")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_ACCESS_KEY_ID", "")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_SECRET_ACCESS_KEY", "")

    with patch.object(docs_mod.storage, "delete_object", new_callable=AsyncMock) as mock_delete:
        result = await delete_document(doc["id"], db=db_session, auth=TEST_AUTH)

    assert result["ok"] is True
    mock_delete.assert_awaited()
    stored = await db_session.get(DealDocument, doc["id"])
    assert stored.status == "deleted"
    await _cleanup_deal(db_session, deal_id)


async def test_delete_404_for_missing_document(db_session):
    with pytest.raises(HTTPException) as exc_info:
        await delete_document(999999, db=db_session, auth=TEST_AUTH)
    assert exc_info.value.status_code == 404


async def test_duplicate_upload_returns_existing_document(db_session, monkeypatch):
    _configure_storage(monkeypatch)
    deal_id = await _make_deal(db_session)
    with patch.object(docs_mod.storage, "put_object", new_callable=AsyncMock, return_value="s3") as put:
        first = await upload_document(
            deal_id, file=_fake_upload(content=b"same bytes"), category="NDA", db=db_session, auth=TEST_AUTH,
        )
        second = await upload_document(
            deal_id, file=_fake_upload("renamed.pdf", content=b"same bytes"), category="NDA",
            db=db_session, auth=TEST_AUTH,
        )
    assert first["duplicate"] is False and second["duplicate"] is True
    assert second["id"] == first["id"]
    assert put.await_count == 1  # the duplicate never touched storage
    assert first["sha256"]
    await _cleanup_deal(db_session, deal_id)


async def test_oversize_upload_rejected_before_storage(db_session, monkeypatch):
    _configure_storage(monkeypatch)
    monkeypatch.setattr(docs_mod, "MAX_UPLOAD_BYTES", 5)
    deal_id = await _make_deal(db_session)
    with patch.object(docs_mod.storage, "put_object", new_callable=AsyncMock) as put:
        with pytest.raises(HTTPException) as exc:
            await upload_document(
                deal_id, file=_fake_upload(content=b"123456"), category="NDA", db=db_session, auth=TEST_AUTH,
            )
    assert exc.value.status_code == 413
    put.assert_not_called()
    await _cleanup_deal(db_session, deal_id)


async def test_download_uses_the_rows_backend_not_the_active_one(db_session, monkeypatch):
    """After switching STORAGE_BACKEND to local, an S3 document must still be served from S3."""
    import tempfile

    from app.storage.local import LocalFilesystemBackend

    _configure_storage(monkeypatch)
    deal_id = await _make_deal(db_session)
    with patch.object(docs_mod.storage, "put_object", new_callable=AsyncMock, return_value="s3"):
        uploaded = await upload_document(
            deal_id, file=_fake_upload(content=b"pinned"), category="NDA", db=db_session, auth=TEST_AUTH,
        )
    monkeypatch.setattr(docs_mod.settings, "STORAGE_BACKEND", "local")  # config changed afterwards

    seen = {}
    fake = MagicMock()

    async def url_for(key, **kw):
        seen.update(kw)
        return "https://signed.example/doc"

    fake.url_for = url_for

    def pick(name=None):
        seen["backend"] = name
        return fake

    with patch.object(docs_mod, "get_storage", side_effect=pick):
        resp = await download_document(uploaded["id"], db=db_session)
    assert seen["backend"] == "s3"
    assert resp.status_code == 302

    # and a local-pinned row keeps working with no bucket configured at all
    with tempfile.TemporaryDirectory() as tmp:
        backend = LocalFilesystemBackend(tmp)
        key = backend.key_for("x.txt", "active/x")
        await backend.put(key, b"local bytes", "text/plain")
        row = await db_session.get(DealDocument, uploaded["id"])
        row.storage_backend, row.storage_key, row.name = "local", key, "x.txt"
        await db_session.flush()
        monkeypatch.setattr(docs_mod.settings, "STORAGE_BUCKET_NAME", "")
        with patch.object(docs_mod, "get_storage", return_value=backend):
            resp = await download_document(uploaded["id"], db=db_session)
        assert resp.body == b"local bytes"
    await _cleanup_deal(db_session, deal_id)


async def test_listing_exposes_email_provenance_and_review_counts(db_session, monkeypatch):
    from app.db.models import EmailScanLog

    deal_id = await _make_deal(db_session)
    log = EmailScanLog(
        graph_message_id=f"prov-{deal_id}", user_email="a@example.com", folder="inbox",
        subject="Acme CIM", sender_address="banker@firm.com", action_taken="queued_for_review",
    )
    db_session.add(log)
    await db_session.flush()
    db_session.add(DealDocument(
        deal_id=deal_id, name="cim.pdf", source="email_attachment", email_scan_log_id=log.id,
        storage_backend="local", storage_key="k", sha256="abc", skip_reason=None,
    ))
    await db_session.flush()
    docs = await list_documents(deal_id, db=db_session)
    assert docs[0]["source_email"]["subject"] == "Acme CIM"
    assert docs[0]["source_email"]["sender"] == "banker@firm.com"
    assert docs[0]["filed"] is True and docs[0]["pending_review_count"] == 0
    await _cleanup_deal(db_session, deal_id)
