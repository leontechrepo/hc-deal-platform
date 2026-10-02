"""Attachment ingestion → provenance → filing, suggestion approval, and proposal validation."""
from __future__ import annotations

import uuid
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.api.deals import CreateDealRequest, create_deal, delete_deal
from app.api.inbox import (
    ApproveRequest,
    FileDocumentRequest,
    approve_suggestion,
    file_unfiled_document,
    list_inbox,
    list_unfiled_documents,
)
from app.automation import attachments as att
from app.automation import scanner
from app.automation.classifier import ClassificationResult
from app.core.config import settings
from app.db.documents import file_documents_for_suggestion
from app.db.models import Deal, EmailScanLog, PendingSuggestion
from app.db.models.documents import DealDocument, DealExtractionRun
from app.db.models.suggestions import ScanRun
from app.graph.mail import DeltaPage

AUTH = {"sub": "reviewer-1"}
PDF = "#microsoft.graph.fileAttachment"


@pytest.fixture
def local_storage(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "local")
    monkeypatch.setattr(settings, "STORAGE_LOCAL_PATH", str(tmp_path))


async def _deal(db):
    r = await create_deal(CreateDealRequest(company_name=f"Intake Co {uuid.uuid4().hex[:6]}"), db, auth=AUTH)
    return await db.get(Deal, r["deal_id"])


async def _log(db, *, attachments=True):
    log = EmailScanLog(
        graph_message_id=f"m-{uuid.uuid4().hex[:10]}", user_email="x@example.com", folder="inbox",
        subject="Acme CIM", sender_address="banker@firm.com", has_attachments=attachments,
        action_taken="queued_for_review",
    )
    db.add(log)
    await db.flush()
    return log


def _graph(monkeypatch, listing, blobs):
    async def list_attachments(client, *, user_email, message_id):
        return listing

    async def fetch(client, *, user_email, message_id, attachment_id):
        value = blobs[attachment_id]
        if isinstance(value, Exception):
            raise value
        return value

    monkeypatch.setattr(att, "list_attachments", list_attachments)
    monkeypatch.setattr(att, "fetch_attachment_bytes", fetch)


def _a(aid, name, ctype="application/pdf", size=50_000, **extra):
    return {"id": aid, "name": name, "contentType": ctype, "size": size, "@odata.type": PDF, **extra}


async def test_ingestion_records_every_attachments_outcome_and_leaves_documents_unfiled(
    db_session, local_storage, monkeypatch
):
    log = await _log(db_session)
    tag = uuid.uuid4().hex
    _graph(monkeypatch, [
        _a("a1", "CIM.pdf"),
        _a("a2", "logo.png", "image/png", 900, isInline=True),
        _a("a3", "run.exe", "application/octet-stream"),
        _a("a4", "huge.pdf", size=80 * 1024 * 1024),
    ], {"a1": f"cim-{tag}".encode()})
    out = await att.ingest_attachments_for_log(db_session, log, client=object(), user="x@example.com")
    by_name = {e["name"]: e for e in out}
    assert by_name["CIM.pdf"]["disposition"] == "stored"
    assert by_name["logo.png"]["reason"] == "inline_or_signature"
    assert by_name["run.exe"]["reason"] == "blocked_extension"
    assert by_name["huge.pdf"]["reason"] == "too_large"

    doc = (await db_session.execute(
        select(DealDocument).where(DealDocument.email_scan_log_id == log.id)
    )).scalar_one()
    assert doc.deal_id is None and doc.source == "email_attachment"       # unfiled until reviewed
    assert doc.sha256 and doc.graph_attachment_id == "a1" and by_name["CIM.pdf"]["sha256"] == doc.sha256
    assert log.attachment_count == 4


async def test_failed_attachment_is_retried_without_duplicating_stored_ones(
    db_session, local_storage, monkeypatch
):
    log = await _log(db_session)
    tag = uuid.uuid4().hex
    listing = [_a("ok", "a.pdf"), _a("flaky", "b.pdf")]
    _graph(monkeypatch, listing, {"ok": f"ok-{tag}".encode(), "flaky": RuntimeError("503 from graph")})
    first = await att.ingest_attachments_for_log(db_session, log, client=object(), user="x@example.com")
    assert {e["name"]: e["disposition"] for e in first} == {"a.pdf": "stored", "b.pdf": "failed"}
    assert att.has_retryable_failures(log.attachment_summary)

    _graph(monkeypatch, listing, {"ok": f"ok-{tag}".encode(), "flaky": f"flaky-{tag}".encode()})
    second = await att.ingest_attachments_for_log(db_session, log, client=object(), user="x@example.com")
    assert {e["name"]: e["disposition"] for e in second} == {"a.pdf": "stored", "b.pdf": "stored"}
    docs = (await db_session.execute(
        select(DealDocument).where(DealDocument.email_scan_log_id == log.id)
    )).scalars().all()
    assert len(docs) == 2
    assert not att.has_retryable_failures(log.attachment_summary)


async def test_failure_stops_being_retried_after_max_attempts(db_session, local_storage, monkeypatch):
    log = await _log(db_session)
    _graph(monkeypatch, [_a("bad", "x.pdf")], {"bad": RuntimeError("nope")})
    for _ in range(att.MAX_ATTACHMENT_ATTEMPTS):
        await att.ingest_attachments_for_log(db_session, log, client=object(), user="x@example.com")
    assert log.attachment_summary[0]["attempts"] == att.MAX_ATTACHMENT_ATTEMPTS
    assert not att.has_retryable_failures(log.attachment_summary)


async def test_same_bytes_in_two_emails_share_one_document_with_both_sources(
    db_session, local_storage, monkeypatch
):
    body = f"shared-{uuid.uuid4().hex}".encode()
    l1, l2 = await _log(db_session), await _log(db_session)
    _graph(monkeypatch, [_a("s", "CIM.pdf")], {"s": body})
    await att.ingest_attachments_for_log(db_session, l1, client=object(), user="x@example.com")
    out = await att.ingest_attachments_for_log(db_session, l2, client=object(), user="x@example.com")
    assert out[0]["disposition"] == "duplicate"
    from app.db.models.documents import DealDocumentEmailLog

    doc = (await db_session.execute(
        select(DealDocument).where(DealDocument.email_scan_log_id == l1.id)
    )).scalar_one()
    sources = set((await db_session.execute(
        select(DealDocumentEmailLog.email_scan_log_id).where(DealDocumentEmailLog.document_id == doc.id)
    )).scalars().all())
    assert sources == {l1.id, l2.id}


# ── approval & filing ────────────────────────────────────────────────────────

async def _suggestion(db, deal, log, field, value):
    s = PendingSuggestion(
        deal_id=deal.id, email_scan_log_id=log.id, kind="field_update", suggested_field=field,
        suggested_value=value, claude_summary="x", email_subject=log.subject, confidence=0.9,
        status="pending", dedupe_key=uuid.uuid4().hex, evidence="quote",
    )
    db.add(s)
    await db.flush()
    return s


async def test_approval_files_the_emails_documents_and_never_double_files(
    db_session, local_storage, monkeypatch
):
    deal = await _deal(db_session)
    log = await _log(db_session)
    tag = uuid.uuid4().hex
    _graph(monkeypatch, [_a("p", "CIM.pdf")], {"p": f"cim-{tag}".encode()})
    await att.ingest_attachments_for_log(db_session, log, client=object(), user="x@example.com")
    doc = (await db_session.execute(select(DealDocument).where(DealDocument.email_scan_log_id == log.id))).scalar_one()

    # the deal already has these exact bytes (e.g. manually uploaded)
    existing = DealDocument(
        deal_id=deal.id, name="CIM-v1.pdf", sha256=doc.sha256, storage_backend="local",
        storage_key="x", source="upload",
    )
    db_session.add(existing)
    await db_session.flush()

    s = await _suggestion(db_session, deal, log, "spread_bps", "450 bps")
    await approve_suggestion(s.id, ApproveRequest(), db_session, AUTH)
    await db_session.refresh(doc)
    await db_session.refresh(deal)
    assert deal.spread_bps == 450
    assert doc.status == "deleted" and doc.deal_id is None   # duplicate discarded, not filed twice
    active = (await db_session.execute(
        select(DealDocument).where(DealDocument.deal_id == deal.id, DealDocument.sha256 == doc.sha256,
                                   DealDocument.status == "active")
    )).scalars().all()
    assert len(active) == 1

    out = await file_documents_for_suggestion(db_session, s, deal.id)  # idempotent
    assert (out.attached, out.discarded) == (0, 0)


async def test_unfiled_documents_stay_unfiled_until_reviewer_assigns(db_session, local_storage, monkeypatch):
    deal = await _deal(db_session)
    log = await _log(db_session)
    _graph(monkeypatch, [_a("p", "NDA.pdf")], {"p": f"nda-{uuid.uuid4().hex}".encode()})
    await att.ingest_attachments_for_log(db_session, log, client=object(), user="x@example.com")
    unfiled = await list_unfiled_documents(db_session)
    mine = [d for d in unfiled if d["email_scan_log_id"] == log.id]
    assert len(mine) == 1 and mine[0]["email_subject"] == "Acme CIM" and mine[0]["email_from"] == "banker@firm.com"

    out = await file_unfiled_document(mine[0]["id"], FileDocumentRequest(deal_id=deal.id), db_session)
    assert out["filed"] is True
    with pytest.raises(HTTPException) as again:
        await file_unfiled_document(mine[0]["id"], FileDocumentRequest(deal_id=deal.id), db_session)
    assert again.value.status_code == 404  # no longer unfiled → cannot be filed twice


async def test_assigning_a_document_starts_a_scoped_extraction_run_only_when_enabled(
    db_session, local_storage, monkeypatch
):
    started = []

    async def fake_bg(run_id):
        started.append(run_id)

    import app.services.deal_extraction as de

    monkeypatch.setattr(de, "process_run_background", fake_bg)
    deal = await _deal(db_session)

    for flags, expect_run in (((False, False), False), ((True, True), True)):
        monkeypatch.setattr(settings, "ATTACHMENT_INGESTION_ENABLED", flags[0])
        monkeypatch.setattr(settings, "DOCUMENT_EXTRACTION_ENABLED", flags[1])
        log = await _log(db_session)
        _graph(monkeypatch, [_a("p", "QoE.pdf")], {"p": f"qoe-{uuid.uuid4().hex}".encode()})
        await att.ingest_attachments_for_log(db_session, log, client=object(), user="x@example.com")
        doc = (await db_session.execute(select(DealDocument).where(DealDocument.email_scan_log_id == log.id))).scalar_one()
        out = await file_unfiled_document(doc.id, FileDocumentRequest(deal_id=deal.id), db_session)
        assert ("extraction_run_id" in out) is expect_run
        if expect_run:
            run = await db_session.get(DealExtractionRun, uuid.UUID(out["extraction_run_id"]))
            assert run.document_ids == [doc.id] and run.trigger == "assignment"


async def test_approving_a_garbage_value_is_a_400_not_a_raw_write(db_session):
    deal = await _deal(db_session)
    log = await _log(db_session, attachments=False)
    s = await _suggestion(db_session, deal, log, "deal_size_m", "banana")
    with pytest.raises(HTTPException) as exc:
        await approve_suggestion(s.id, ApproveRequest(), db_session, AUTH)
    assert exc.value.status_code == 400
    await db_session.refresh(deal)
    assert deal.deal_size_m is None


async def test_underwriting_lock_blocks_email_approval(db_session):
    deal = await _deal(db_session)
    deal.pipeline_stage = "loi_signed"
    log = await _log(db_session, attachments=False)
    s = await _suggestion(db_session, deal, log, "total_leverage", "4.5")
    with pytest.raises(HTTPException) as exc:
        await approve_suggestion(s.id, ApproveRequest(), db_session, AUTH)
    assert exc.value.status_code == 409


async def test_inbox_exposes_attachment_state_documents_and_removal(db_session, local_storage, monkeypatch):
    monkeypatch.setattr(settings, "ATTACHMENT_INGESTION_ENABLED", True)
    deal = await _deal(db_session)
    log = await _log(db_session)
    s = await _suggestion(db_session, deal, log, "spread_bps", "450 bps")

    group = next(g for g in await list_inbox(db_session) if g["id"] == str(log.id))
    assert group["attachment_state"] == "pending" and group["documents"] == []

    _graph(monkeypatch, [_a("p", "CIM.pdf")], {"p": f"cim-{uuid.uuid4().hex}".encode()})
    await att.ingest_attachments_for_log(db_session, log, client=object(), user="x@example.com")
    log.source_removed_at = log.processed_at
    group = next(g for g in await list_inbox(db_session) if g["id"] == str(log.id))
    assert group["attachment_state"] == "ingested"
    assert group["documents"][0]["name"] == "CIM.pdf" and group["documents"][0]["filed"] is False
    assert group["source_removed"] is True
    assert group["suggestions"][0]["evidence"] == "quote"

    monkeypatch.setattr(settings, "ATTACHMENT_INGESTION_ENABLED", False)
    other = await _log(db_session)
    await _suggestion(db_session, deal, other, "spread_bps", "400 bps")
    g2 = next(g for g in await list_inbox(db_session) if g["id"] == str(other.id))
    assert g2["attachment_state"] == "disabled"


async def test_deleting_a_deal_removes_its_documents_and_blobs(db_session, local_storage):
    import os

    from app.db.documents import store_document

    deal = await _deal(db_session)
    doc, _ = await store_document(
        db_session, name="a.pdf", body=f"x-{uuid.uuid4().hex}".encode(), deal_id=deal.id,
    )
    path = os.path.join(settings.STORAGE_LOCAL_PATH, doc.storage_key)
    assert os.path.exists(path)
    await delete_deal(deal.id, db_session, AUTH)
    assert os.path.exists(path) is False
    left = (await db_session.execute(select(DealDocument).where(DealDocument.id == doc.id))).scalar_one_or_none()
    assert left is None  # not resurrected as an "unfiled" document


# ── scanner: evidence & validator enforcement ────────────────────────────────

async def test_scanner_drops_proposals_without_evidence_or_failing_validators(db_session, monkeypatch):
    deal = await _deal(db_session)
    user = f"{uuid.uuid4().hex[:8]}@example.com"
    for k, v in (("AZURE_CLIENT_ID", "x"), ("ANTHROPIC_API_KEY", "x"), ("MONITORED_USER_1", user),
                 ("MONITORED_USER_2", ""), ("GRAPH_FOLDERS", "inbox")):
        monkeypatch.setattr(settings, k, v)

    async def classify(text, *, searcher, received_at=None):
        return ClassificationResult(
            outcome="matched", confidence=0.95, reasoning="r",
            matched_candidate=SimpleNamespace(deal_id=deal.id),
            field_updates=[
                {"field": "spread_bps", "value": "450", "evidence": "S+450 per term sheet"},
                {"field": "dscr", "value": "1.6", "evidence": ""},                      # no evidence
                {"field": "tenor_months", "value": "9999", "evidence": "tenor"},          # fails validator
                {"field": "cap_rate", "value": "5", "evidence": "not a credit field"},   # not allowlisted
            ],
        ), []

    async def page(client, *, url, page_size=50):
        m = {"id": f"m-{uuid.uuid4().hex[:8]}", "internetMessageId": f"<{uuid.uuid4().hex}@x>",
             "conversationId": "c1", "subject": "Term sheet update", "hasAttachments": False,
             "from": {"emailAddress": {"address": "banker@firm.com"}}, "receivedDateTime": "2026-09-01T00:00:00Z",
             "body": {"content": "S+450", "contentType": "text"}, "bodyPreview": "S+450"}
        return DeltaPage(messages=[m], delta_link="https://d")

    monkeypatch.setattr(scanner, "classify_email", classify)
    monkeypatch.setattr(scanner, "fetch_delta_page", page)
    await db_session.commit()
    await scanner.run_scan(db_session, trigger="manual", client=object())

    rows = (await db_session.execute(
        select(PendingSuggestion).where(PendingSuggestion.deal_id == deal.id, PendingSuggestion.kind == "field_update")
    )).scalars().all()
    assert [(r.suggested_field, r.suggested_value, r.evidence, r.status) for r in rows] == [
        ("spread_bps", "450 bps", "S+450 per term sheet", "pending")
    ]
    run = (await db_session.execute(select(ScanRun).order_by(ScanRun.started_at.desc()).limit(1))).scalar_one()
    assert run.field_updates_proposed == 4 and run.field_updates_rejected == 3
    assert run.error_counts == {"missing_evidence": 1, "int_out_of_range": 1, "field_not_allowed": 1}
    await db_session.refresh(deal)
    assert deal.spread_bps is None  # nothing applied: human approval still required
