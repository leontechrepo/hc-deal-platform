"""
Tests for the deal documents API (app/api/deal_documents.py), covering the
upload/list/download/delete flow and the storage-cleanup-on-delete fix.
Storage calls are mocked at the app.api.deal_documents.storage call site —
these tests never touch the real S3-compatible bucket.
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

import app.api.deal_documents as docs_mod
from app.api.deal_documents import (
    delete_document,
    download_document,
    list_documents,
    upload_document,
)
from app.api.deals import CreateDealRequest, create_deal
from app.db.models.documents import DealDocument

TEST_AUTH = {"sub": "test-user"}


def _configure_storage(monkeypatch):
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


async def test_upload_creates_document_and_calls_put_object(db_session, monkeypatch):
    _configure_storage(monkeypatch)
    deal_id = await _make_deal(db_session)

    with patch.object(docs_mod.storage, "put_object") as mock_put:
        result = await upload_document(
            deal_id, file=_fake_upload(), category="NDA", db=db_session, auth=TEST_AUTH,
        )

    mock_put.assert_called_once()
    key_arg = mock_put.call_args[0][0]
    assert key_arg.startswith(f"deals/{deal_id}/")
    assert result["name"] == "term_sheet.pdf"
    assert result["category"] == "NDA"
    assert result["size_bytes"] == len(b"hello world")
    assert result["status"] == "active"


async def test_upload_rejects_invalid_category(db_session, monkeypatch):
    _configure_storage(monkeypatch)
    deal_id = await _make_deal(db_session)

    with patch.object(docs_mod.storage, "put_object") as mock_put:
        with pytest.raises(HTTPException) as exc_info:
            await upload_document(
                deal_id, file=_fake_upload(), category="Not A Real Category", db=db_session, auth=TEST_AUTH,
            )
    assert exc_info.value.status_code == 400
    mock_put.assert_not_called()


async def test_upload_503_when_storage_not_configured(db_session, monkeypatch):
    # Local dev points STORAGE_* at the real bucket, so explicitly blank it
    # out here rather than relying on the ambient settings being unconfigured.
    monkeypatch.setattr(docs_mod.settings, "STORAGE_BUCKET_NAME", "")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_ENDPOINT_URL", "")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_ACCESS_KEY_ID", "")
    monkeypatch.setattr(docs_mod.settings, "STORAGE_SECRET_ACCESS_KEY", "")
    deal_id = await _make_deal(db_session)

    with patch.object(docs_mod.storage, "put_object") as mock_put:
        with pytest.raises(HTTPException) as exc_info:
            await upload_document(
                deal_id, file=_fake_upload(), category="NDA", db=db_session, auth=TEST_AUTH,
            )
    assert exc_info.value.status_code == 503
    mock_put.assert_not_called()


async def test_list_documents_excludes_deleted(db_session, monkeypatch):
    _configure_storage(monkeypatch)
    deal_id = await _make_deal(db_session)

    with patch.object(docs_mod.storage, "put_object"):
        kept = await upload_document(
            deal_id, file=_fake_upload("kept.pdf"), category="NDA", db=db_session, auth=TEST_AUTH,
        )
        removed = await upload_document(
            deal_id, file=_fake_upload("removed.pdf"), category="NDA", db=db_session, auth=TEST_AUTH,
        )

    with patch.object(docs_mod.storage, "delete_object"):
        await delete_document(removed["id"], db=db_session, auth=TEST_AUTH)

    docs = await list_documents(deal_id, db=db_session)
    ids = [d["id"] for d in docs]
    assert kept["id"] in ids
    assert removed["id"] not in ids


async def test_download_redirects_to_presigned_url(db_session, monkeypatch):
    _configure_storage(monkeypatch)
    deal_id = await _make_deal(db_session)

    with patch.object(docs_mod.storage, "put_object"):
        doc = await upload_document(
            deal_id, file=_fake_upload(), category="NDA", db=db_session, auth=TEST_AUTH,
        )

    with patch.object(docs_mod.storage, "presigned_get_url", return_value="https://fake.storageapi.dev/signed-url") as mock_url:
        response = await download_document(doc["id"], db=db_session)

    mock_url.assert_called_once()
    assert response.status_code == 302
    assert response.headers["location"] == "https://fake.storageapi.dev/signed-url"


async def test_delete_calls_storage_delete_object_and_soft_deletes(db_session, monkeypatch):
    _configure_storage(monkeypatch)
    deal_id = await _make_deal(db_session)

    with patch.object(docs_mod.storage, "put_object"):
        doc = await upload_document(
            deal_id, file=_fake_upload(), category="NDA", db=db_session, auth=TEST_AUTH,
        )

    with patch.object(docs_mod.storage, "delete_object") as mock_delete:
        result = await delete_document(doc["id"], db=db_session, auth=TEST_AUTH)

    mock_delete.assert_called_once()
    assert mock_delete.call_args[0][0].startswith(f"deals/{deal_id}/")
    assert result == {"ok": True, "document_id": doc["id"]}

    stored = await db_session.get(DealDocument, doc["id"])
    assert stored.status == "deleted"


async def test_delete_404_for_missing_document(db_session):
    with pytest.raises(HTTPException) as exc_info:
        await delete_document(999999, db=db_session, auth=TEST_AUTH)
    assert exc_info.value.status_code == 404
