"""Extraction planning, tracked runs, conflicts, no-overwrite, and reviewer actions."""
from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.api.deals import CreateDealRequest, create_deal
from app.api.extractions import (
    AcceptRequest,
    RejectRequest,
    accept_candidate,
    list_deal_extractions,
    reject_candidate,
)
from app.core.config import settings
from app.db.models import Deal
from app.db.models.documents import DealDocument, DealExtractionCandidate, DealExtractionRun
from app.db.models.suggestions import LLMCall
from app.services import deal_extraction
from app.services.deal_extraction import Candidate, enqueue_extraction_run
from app.services.deal_extraction import process_run as _process_run
from app.services.extraction_plan import RawCandidate, plan_candidates

AUTH = {"sub": "reviewer-1"}


async def process_run(db, run_id):
    # The app's get_db commits at request end; tests flush so refresh() sees the state.
    changed = await _process_run(db, run_id)
    await db.flush()
    return changed


def _plan(cands, *, current=None, stage="screening", status="Active"):
    current = current or {}
    return plan_candidates(
        cands, current_values=lambda f: current.get(f), pipeline_stage=stage, status=status
    )


def _by_status(planned):
    return {(p.candidate.field, p.candidate.document_id): p.status for p in planned}


# ── planner ──────────────────────────────────────────────────────────────────

def test_high_confidence_blank_field_is_applied():
    out = _plan([RawCandidate("deal_size_m", "$40M", 0.95, "Facility: $40M", 1)])
    assert out[0].status == "applied" and out[0].value == Decimal("40.00")


def test_ambiguous_confidence_goes_to_review_not_applied():
    out = _plan([RawCandidate("spread_bps", "450", 0.7, "approx S+450", 1)])
    assert out[0].status == "suggested"


def test_populated_field_is_never_overwritten():
    out = _plan(
        [RawCandidate("deal_size_m", "50", 0.99, "Facility: $50M", 1)],
        current={"deal_size_m": Decimal("40.00")},
    )
    assert out[0].status == "differs_from_current"
    same = _plan(
        [RawCandidate("deal_size_m", "40", 0.99, "x", 1)], current={"deal_size_m": Decimal("40.00")}
    )
    assert same[0].status == "matches_existing"


def test_documents_that_disagree_are_a_conflict_not_a_winner():
    out = _plan([
        RawCandidate("deal_size_m", "12.5", 0.90, "a", 1),
        RawCandidate("deal_size_m", "15", 0.88, "b", 2),
    ])
    assert {p.status for p in out} == {"conflict"}


def test_clear_winner_supersedes_weaker_and_corroborating_agree():
    out = _plan([
        RawCandidate("dscr", "1.5", 0.95, "a", 1),
        RawCandidate("dscr", "1.5x", 0.90, "b", 2),
        RawCandidate("dscr", "1.1", 0.60, "c", 3),
    ])
    st = _by_status(out)
    assert st[("dscr", 1)] == "applied"
    assert st[("dscr", 2)] == "corroborating"
    assert st[("dscr", 3)] == "superseded"


def test_invalid_values_are_recorded_with_reason():
    out = _plan([RawCandidate("oid_pct", "99", 0.95, "OID 99", 1)])
    assert out[0].status == "invalid" and out[0].reason == "percent_out_of_range"


def test_non_credit_fields_are_not_extractable():
    assert "cap_rate" not in deal_extraction.EXTRACTION_FIELDS
    assert {"oid_pct", "sofr_floor_pct"} <= deal_extraction.EXTRACTION_FIELDS


def test_underwriting_locked_deal_never_auto_applies():
    out = _plan(
        [RawCandidate("deal_size_m", "40", 0.99, "x", 1)], stage="loi_signed"
    )
    assert out[0].status == "suggested" and out[0].reason == "underwriting_locked"


# ── tracked run ──────────────────────────────────────────────────────────────

@pytest.fixture
def extraction_on(monkeypatch):
    monkeypatch.setattr(settings, "ATTACHMENT_INGESTION_ENABLED", True)
    monkeypatch.setattr(settings, "DOCUMENT_EXTRACTION_ENABLED", True)


async def _deal(db_session, **overrides):
    result = await create_deal(
        CreateDealRequest(company_name=f"Extract Co {uuid.uuid4().hex[:6]}"), db_session, auth=AUTH
    )
    deal = await db_session.get(Deal, result["deal_id"])
    for k, v in overrides.items():
        setattr(deal, k, v)
    await db_session.flush()
    return deal


async def _doc(db_session, deal, name="cim.pdf"):
    doc = DealDocument(
        deal_id=deal.id, name=name, content_type="application/pdf", size_bytes=10,
        sha256=uuid.uuid4().hex, storage_backend="local", storage_key=f"k/{uuid.uuid4().hex}",
        source="email_attachment", processing_status="pending",
    )
    db_session.add(doc)
    await db_session.flush()
    return doc


def _fake_extract(by_doc):
    async def fake(document):
        document.processing_status = "extracted"
        return by_doc[document.id], {
            "input_tokens": 1000, "output_tokens": 200, "request_id": "req_1", "latency_ms": 5,
        }

    return fake


async def test_run_applies_blank_fields_keeps_populated_and_flags_conflicts(
    db_session, extraction_on, monkeypatch
):
    deal = await _deal(db_session, deal_size_m=Decimal("40.00"))
    d1, d2 = await _doc(db_session, deal), await _doc(db_session, deal, "qoe.pdf")
    monkeypatch.setattr(deal_extraction, "extract_document", _fake_extract({
        d1.id: [
            Candidate("deal_size_m", "55", 0.97, "Facility $55M", d1.id),
            Candidate("spread_bps", "475", 0.93, "S+475", d1.id),
            Candidate("dscr", "1.4", 0.91, "DSCR 1.4x", d1.id),
        ],
        d2.id: [Candidate("dscr", "1.9", 0.90, "DSCR 1.9x", d2.id)],
    }))
    run = await enqueue_extraction_run(
        db_session, deal_id=deal.id, suggestion_id=None, document_ids=[d1.id, d2.id], trigger="manual"
    )
    assert await process_run(db_session, run.id) is True
    await db_session.refresh(deal)
    await db_session.refresh(run)

    assert deal.deal_size_m == Decimal("40.00")  # populated: untouched
    assert deal.spread_bps == 475                # clear + confident: applied
    assert deal.dscr is None                     # documents disagree: not applied
    assert run.status == "complete"
    assert run.applied_field_count == 1
    assert "dscr" in run.conflicts
    assert "deal_size_m" in run.low_confidence_fields

    cands = (await db_session.execute(
        select(DealExtractionCandidate).where(DealExtractionCandidate.run_id == run.id)
    )).scalars().all()
    status = {(c.field, c.document_id): c.status for c in cands}
    assert status[("deal_size_m", d1.id)] == "differs_from_current"
    assert status[("spread_bps", d1.id)] == "applied"
    assert status[("dscr", d1.id)] == status[("dscr", d2.id)] == "conflict"
    await db_session.refresh(d1)
    assert d1.processing_status == "needs_review" and d1.human_review_required

    calls = (await db_session.execute(
        select(LLMCall).where(LLMCall.extraction_run_id == run.id)
    )).scalars().all()
    assert len(calls) == 2 and all(c.purpose == "extract_document" for c in calls)
    assert run.input_tokens == 2000 and run.estimated_cost_usd > 0


async def test_failed_document_retries_then_errors(db_session, extraction_on, monkeypatch):
    deal = await _deal(db_session)
    doc = await _doc(db_session, deal)

    async def boom(document):
        raise RuntimeError("document_has_no_text")

    monkeypatch.setattr(deal_extraction, "extract_document", boom)
    run = await enqueue_extraction_run(
        db_session, deal_id=deal.id, suggestion_id=None, document_ids=[doc.id], trigger="manual"
    )
    for _ in range(deal_extraction.MAX_ATTEMPTS):
        await process_run(db_session, run.id)
    await db_session.refresh(run)
    assert run.status == "error" and run.last_error == "all_documents_failed"
    assert run.retry_count == deal_extraction.MAX_ATTEMPTS
    assert run.document_errors[str(doc.id)] == "document_has_no_text"


async def test_disabled_flag_means_no_run(db_session, monkeypatch):
    monkeypatch.setattr(settings, "DOCUMENT_EXTRACTION_ENABLED", False)
    deal = await _deal(db_session)
    assert await enqueue_extraction_run(db_session, deal_id=deal.id, suggestion_id=None) is None


# ── reviewer actions ─────────────────────────────────────────────────────────

async def _conflicted(db_session, extraction_on, monkeypatch, **deal_kw):
    deal = await _deal(db_session, **deal_kw)
    d1, d2 = await _doc(db_session, deal), await _doc(db_session, deal, "b.pdf")
    monkeypatch.setattr(deal_extraction, "extract_document", _fake_extract({
        d1.id: [Candidate("dscr", "1.4", 0.91, "DSCR 1.4x", d1.id)],
        d2.id: [Candidate("dscr", "1.9", 0.90, "DSCR 1.9x", d2.id)],
    }))
    run = await enqueue_extraction_run(
        db_session, deal_id=deal.id, suggestion_id=None, document_ids=[d1.id, d2.id]
    )
    await process_run(db_session, run.id)
    cands = (await db_session.execute(
        select(DealExtractionCandidate).where(DealExtractionCandidate.run_id == run.id)
    )).scalars().all()
    return deal, d1, d2, {c.document_id: c for c in cands}


async def test_accepting_one_side_of_a_conflict_resolves_the_other(
    db_session, extraction_on, monkeypatch
):
    deal, d1, d2, cands = await _conflicted(db_session, extraction_on, monkeypatch)
    out = await accept_candidate(cands[d2.id].id, AcceptRequest(), db_session, AUTH)
    assert out["status"] == "accepted" and out["reviewed_by"]
    await db_session.refresh(deal)
    assert deal.dscr == Decimal("1.90")
    await db_session.refresh(cands[d1.id])
    assert cands[d1.id].status == "superseded"
    await db_session.refresh(d1)
    assert not d1.human_review_required

    with pytest.raises(HTTPException) as again:
        await accept_candidate(cands[d2.id].id, AcceptRequest(), db_session, AUTH)
    assert again.value.status_code == 409

    listing = await list_deal_extractions(deal.id, db_session)
    assert listing["pending_review_count"] == 0 and len(listing["candidates"]) == 2


async def test_accept_over_populated_field_requires_explicit_overwrite(
    db_session, extraction_on, monkeypatch
):
    deal = await _deal(db_session, spread_bps=400)
    doc = await _doc(db_session, deal)
    monkeypatch.setattr(deal_extraction, "extract_document", _fake_extract({
        doc.id: [Candidate("spread_bps", "450", 0.97, "S+450", doc.id)]
    }))
    run = await enqueue_extraction_run(db_session, deal_id=deal.id, suggestion_id=None, document_ids=[doc.id])
    await process_run(db_session, run.id)
    cand = (await db_session.execute(
        select(DealExtractionCandidate).where(DealExtractionCandidate.run_id == run.id)
    )).scalar_one()
    assert cand.status == "differs_from_current"

    with pytest.raises(HTTPException) as exc:
        await accept_candidate(cand.id, AcceptRequest(), db_session, AUTH)
    assert exc.value.status_code == 409
    await db_session.refresh(deal)
    assert deal.spread_bps == 400

    await accept_candidate(cand.id, AcceptRequest(overwrite=True), db_session, AUTH)
    await db_session.refresh(deal)
    assert deal.spread_bps == 450


async def test_accept_blocked_when_underwriting_locked(db_session, extraction_on, monkeypatch):
    deal, d1, d2, cands = await _conflicted(
        db_session, extraction_on, monkeypatch, pipeline_stage="loi_signed"
    )
    with pytest.raises(HTTPException) as exc:
        await accept_candidate(cands[d1.id].id, AcceptRequest(), db_session, AUTH)
    assert exc.value.status_code == 409
    await db_session.refresh(deal)
    assert deal.dscr is None


async def test_reject_records_reviewer_and_clears_review_flag(db_session, extraction_on, monkeypatch):
    deal, d1, d2, cands = await _conflicted(db_session, extraction_on, monkeypatch)
    await reject_candidate(cands[d1.id].id, RejectRequest(note="wrong table"), db_session, AUTH)
    await db_session.refresh(cands[d1.id])
    assert cands[d1.id].status == "rejected" and cands[d1.id].review_note == "wrong table"
    await db_session.refresh(d1)
    assert not d1.human_review_required
    await db_session.refresh(d2)
    assert d2.human_review_required  # the other side still conflicts/needs a decision
