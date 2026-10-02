"""Scanner claim / lock / dedupe unit-style tests (DB-backed where needed)."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.automation.budget import BudgetExceeded, ScanBudget
from app.automation.dedupe import new_deal_discriminator, suggestion_dedupe_key
from app.db.graph_sync import (
    advance_watermark,
    get_or_create_sync_state,
    is_parked,
    record_failure,
    reset_for_resync,
)
from app.db.models.suggestions import EmailScanLog
from app.domain.attachments import classify_attachment, select_attachments
from app.domain.prefilter import is_low_value


def test_prefilter_calendar():
    assert is_low_value("Accepted: Diligence call", "a@b.com").skip
    assert not is_low_value("NDA executed for Acme", "banker@firm.com").skip


def test_attachment_inline_noise():
    decision = classify_attachment({
        "@odata.type": "#microsoft.graph.fileAttachment",
        "isInline": True,
        "name": "logo.png",
        "contentType": "image/png",
        "size": 1200,
    })
    assert not decision.store
    assert decision.reason == "inline_or_signature"


def test_attachment_pdf_kept():
    decision = classify_attachment({
        "@odata.type": "#microsoft.graph.fileAttachment",
        "name": "CIM.pdf",
        "contentType": "application/pdf",
        "size": 500_000,
    })
    assert decision.store
    assert decision.doc_type == "PDF"


def test_select_attachments_budget():
    mid = {
        "@odata.type": "#microsoft.graph.fileAttachment",
        "name": "a.pdf",
        "contentType": "application/pdf",
        "size": 20 * 1024 * 1024,
    }
    keep, reasons = select_attachments([mid, mid], max_total_bytes=30 * 1024 * 1024)
    assert len(keep) == 1
    assert reasons.get("message_budget") == 1


def test_dedupe_keys_differ_by_company():
    k1 = suggestion_dedupe_key(
        deal_id=None, thread_id="t1", kind="new_deal",
        discriminator=new_deal_discriminator({"company_name": "Acme Health"}),
    )
    k2 = suggestion_dedupe_key(
        deal_id=None, thread_id="t1", kind="new_deal",
        discriminator=new_deal_discriminator({"company_name": "Beta Health"}),
    )
    assert k1 != k2


def test_budget_stop():
    budget = ScanBudget(max_messages=2)
    budget.record_message()
    budget.record_message()
    with pytest.raises(BudgetExceeded):
        budget.check()


@pytest.mark.asyncio
async def test_graph_sync_watermark_and_parking(db_session):
    state = await get_or_create_sync_state(
        db_session, user_email="a@example.com", folder="inbox"
    )
    assert state.resume_url is None
    await advance_watermark(
        db_session, state, next_link="https://next", delta_link=None
    )
    assert state.resume_url == "https://next"
    await advance_watermark(
        db_session, state, next_link=None, delta_link="https://delta"
    )
    assert state.resume_url == "https://delta"
    assert state.next_link is None

    for _ in range(5):
        await record_failure(db_session, state, error="boom")
    assert is_parked(state)
    await reset_for_resync(db_session, state, reason="410")
    assert state.delta_link is None
