"""
Regression tests for the Codex-review findings on app/api/inbox.py:
- approving a sponsor_id suggestion must not crash on the audit-log truncation
- list_inbox (and its /review-queue alias) must return grouped-by-email cards
  with legacy `stage` on nested suggestions
- approving a pipeline_stage -> portfolio_monitoring suggestion must create a
  PortfolioPosition, matching the manual PATCH /api/deals/{id} path's behavior
"""
from sqlalchemy import select

import json
import uuid

from app.api.companies import get_company
from app.api.deals import CreateDealRequest, create_deal, get_deal
from app.api.inbox import ApproveRequest, approve_suggestion, list_inbox
from app.api.sponsors import SponsorRequest, create_sponsor
from app.db.models import EmailScanLog, PendingSuggestion
from app.db.models.portfolio import PortfolioPosition

TEST_AUTH = {"sub": "test-user"}


async def _make_scan_log(db_session, *, subject: str = "Test email") -> EmailScanLog:
    scan_log = EmailScanLog(
        graph_message_id=f"msg-{uuid.uuid4().hex[:12]}",
        user_email="jomeara@leonhealthcarepartners.com",
        subject=subject,
        action_taken="queued_for_review",
        folder="inbox",
    )
    db_session.add(scan_log)
    await db_session.flush()
    return scan_log


async def _make_suggestion(
    db_session,
    deal_id,
    suggested_field,
    suggested_value,
    *,
    scan_log: EmailScanLog | None = None,
):
    if scan_log is None:
        scan_log = await _make_scan_log(
            db_session, subject=f"Test email ({suggested_field})"
        )

    kind = (
        "new_deal" if suggested_field == "new_deal"
        else "commentary" if suggested_field == "commentary"
        else "field_update"
    )
    suggestion = PendingSuggestion(
        deal_id=deal_id,
        email_scan_log_id=scan_log.id,
        kind=kind,
        suggested_field=suggested_field,
        suggested_value=suggested_value,
        claude_summary="test",
        email_subject=scan_log.subject or "Test email",
        confidence=0.9,
        source="email_scan",
        status="pending",
        dedupe_key=uuid.uuid4().hex,
    )
    db_session.add(suggestion)
    await db_session.flush()
    return suggestion


async def test_approving_sponsor_id_suggestion_does_not_crash(db_session):
    deal_result = await create_deal(CreateDealRequest(company_name="Sponsor Match Co"), db_session, auth=TEST_AUTH)
    sponsor = await create_sponsor(
        SponsorRequest(name="Meridian Health Partners", email_domain="meridianhealth.com"), db_session
    )

    suggestion = await _make_suggestion(db_session, deal_result["deal_id"], "sponsor_id", str(sponsor["id"]))

    result = await approve_suggestion(suggestion.id, ApproveRequest(), db_session, auth=TEST_AUTH)
    assert result["ok"] is True
    assert result["deal_id"] == deal_result["deal_id"]


async def test_list_inbox_includes_legacy_stage_key(db_session):
    deal_result = await create_deal(CreateDealRequest(company_name="Legacy Stage Co"), db_session, auth=TEST_AUTH)
    await _make_suggestion(db_session, deal_result["deal_id"], "commentary", "some note")

    items = await list_inbox(db_session)
    assert len(items) >= 1
    group = items[0]
    assert "suggestions" in group
    assert isinstance(group["suggestions"], list)
    assert len(group["suggestions"]) >= 1
    assert "stage" in group["suggestions"][0]
    assert "pipeline_stage" in group["suggestions"][0]


async def test_list_inbox_groups_suggestions_by_email_scan_log(db_session):
    deal_a = await create_deal(CreateDealRequest(company_name="Group Deal A"), db_session, auth=TEST_AUTH)
    deal_b = await create_deal(CreateDealRequest(company_name="Group Deal B"), db_session, auth=TEST_AUTH)
    scan_log = await _make_scan_log(db_session, subject="Shared email thread")

    s1 = await _make_suggestion(
        db_session, deal_a["deal_id"], "commentary", "note one", scan_log=scan_log
    )
    s2 = await _make_suggestion(
        db_session, deal_b["deal_id"], "commentary", "note two", scan_log=scan_log
    )

    items = await list_inbox(db_session)
    matching = [g for g in items if g["id"] == str(scan_log.id)]
    assert len(matching) == 1
    group = matching[0]
    suggestion_ids = {s["id"] for s in group["suggestions"]}
    assert suggestion_ids == {s1.id, s2.id}
    assert group["email_subject"] == "Shared email thread"
    assert group["mailbox"] == "jomeara@leonhealthcarepartners.com"


async def test_approving_with_deal_id_override_retargets_the_update(db_session):
    original = await create_deal(CreateDealRequest(company_name="Wrong Match Co"), db_session, auth=TEST_AUTH)
    correct = await create_deal(CreateDealRequest(company_name="Right Match Co"), db_session, auth=TEST_AUTH)

    suggestion = await _make_suggestion(db_session, original["deal_id"], "commentary", "2026/01/01: [Auto] note")

    result = await approve_suggestion(
        suggestion.id, ApproveRequest(deal_id=correct["deal_id"]), db_session, auth=TEST_AUTH
    )
    assert result["ok"] is True
    assert result["deal_id"] == correct["deal_id"]
    assert result["company_name"] == "Right Match Co"

    await db_session.refresh(suggestion)
    assert str(suggestion.deal_id) == correct["deal_id"]

    from app.api.deals import get_deal

    original_deal = await get_deal(original["deal_id"], db_session)
    correct_deal = await get_deal(correct["deal_id"], db_session)
    assert original_deal["commentary"] is None
    assert correct_deal["commentary"] == "2026/01/01: [Auto] note"


async def test_approving_portfolio_monitoring_transition_creates_position(db_session):
    deal_result = await create_deal(CreateDealRequest(company_name="Funded Via Inbox Co", deal_size_m=8.0), db_session, auth=TEST_AUTH)
    deal_id = deal_result["deal_id"]

    suggestion = await _make_suggestion(db_session, deal_id, "pipeline_stage", "portfolio_monitoring")
    await approve_suggestion(
        suggestion.id,
        ApproveRequest(allow_stage_skip=True, reasoning="Closed and funded — inbox backfill"),
        db_session,
        auth=TEST_AUTH,
    )

    position = (
        await db_session.execute(select(PortfolioPosition).where(PortfolioPosition.deal_id == deal_id))
    ).scalar_one_or_none()
    assert position is not None
    assert float(position.original_amount_m) == 8.0


async def test_approving_new_deal_suggestion_creates_a_linked_company(db_session):
    new_deal_payload = json.dumps({"company_name": "Inbox-Detected Co", "sector": "Logistics", "summary": "New borrower signal"})
    suggestion = await _make_suggestion(db_session, None, "new_deal", new_deal_payload)

    result = await approve_suggestion(suggestion.id, ApproveRequest(), db_session, auth=TEST_AUTH)
    assert result["created"] is True

    deal = await get_deal(result["deal_id"], db_session)
    assert deal["company_id"] is not None

    company = await get_company(deal["company_id"], db_session)
    assert company["company_name"] == "Inbox-Detected Co"
    assert company["sector"] == "Logistics"


async def test_approving_new_deal_suggestion_reuses_existing_company_by_name(db_session):
    existing = await create_deal(CreateDealRequest(company_name="Repeat Borrower Via Inbox Co"), db_session, auth=TEST_AUTH)
    existing_deal = await get_deal(existing["deal_id"], db_session)

    new_deal_payload = json.dumps({"company_name": "Repeat Borrower Via Inbox Co", "summary": "Follow-on signal"})
    suggestion = await _make_suggestion(db_session, None, "new_deal", new_deal_payload)
    result = await approve_suggestion(suggestion.id, ApproveRequest(), db_session, auth=TEST_AUTH)

    new_deal = await get_deal(result["deal_id"], db_session)
    assert new_deal["company_id"] == existing_deal["company_id"]


# --- One reviewed decision per email ---------------------------------------------------

import pytest
from fastapi import HTTPException

from app.api.inbox import (
    GroupAcceptRequest,
    GroupFieldDecision,
    NewDealForm,
    accept_group,
    dismiss_group,
)


async def test_accept_group_applies_edited_values_in_one_call(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Group Accept Co"), db_session, auth=TEST_AUTH)
    log = await _make_scan_log(db_session, subject="Term sheet update")
    size = await _make_suggestion(db_session, deal["deal_id"], "deal_size_m", "70", scan_log=log)
    spread = await _make_suggestion(db_session, deal["deal_id"], "spread_bps", "450", scan_log=log)
    note = await _make_suggestion(db_session, deal["deal_id"], "commentary", "Upsized.", scan_log=log)

    result = await accept_group(
        str(log.id),
        GroupAcceptRequest(fields=[
            GroupFieldDecision(suggestion_id=size.id, value="72.5"),  # reviewer corrected it
            GroupFieldDecision(suggestion_id=spread.id, value="450"),
            GroupFieldDecision(suggestion_id=note.id, include=False),  # unticked
        ]),
        db_session,
        auth=TEST_AUTH,
    )
    assert result["applied"] == [size.id, spread.id]
    assert result["rejected"] == [note.id]
    assert result["remaining"] == 0

    updated = await get_deal(deal["deal_id"], db_session)
    assert float(updated["deal_size_m"]) == 72.5  # edited value, not the proposed 70
    assert updated["spread_bps"] == 450
    assert updated["commentary"] is None
    for s in (size, spread, note):
        await db_session.refresh(s)
    assert (size.status, spread.status, note.status) == ("approved", "approved", "rejected")
    assert not any(g["id"] == str(log.id) for g in await list_inbox(db_session))


async def test_accept_group_leaves_unmentioned_suggestions_pending(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Late Arrival Co"), db_session, auth=TEST_AUTH)
    log = await _make_scan_log(db_session)
    seen = await _make_suggestion(db_session, deal["deal_id"], "commentary", "seen", scan_log=log)
    late = await _make_suggestion(db_session, deal["deal_id"], "next_action", "Call CFO", scan_log=log)

    result = await accept_group(
        str(log.id),
        GroupAcceptRequest(fields=[GroupFieldDecision(suggestion_id=seen.id)]),
        db_session,
        auth=TEST_AUTH,
    )
    assert result["remaining"] == 1
    await db_session.refresh(late)
    assert late.status == "pending"


async def test_accept_group_new_deal_uses_the_edited_form(db_session):
    log = await _make_scan_log(db_session, subject="Intro: Acme Dental")
    suggestion = await _make_suggestion(
        db_session, None, "new_deal",
        json.dumps({"company_name": "Acme Dentl", "sector": "Dental", "summary": "Intro"}),
        scan_log=log,
    )
    result = await accept_group(
        str(log.id),
        GroupAcceptRequest(new_deal=NewDealForm(
            company_name="Acme Dental Partners", sector="Dental Services",
            deal_size_m="$40M", summary="Typo fixed by reviewer",
        )),
        db_session,
        auth=TEST_AUTH,
    )
    assert result["created"] is True and result["applied"] == [suggestion.id]
    deal = await get_deal(result["deal_id"], db_session)
    assert deal["company_name"] == "Acme Dental Partners"
    assert deal["sector_primary"] == "Dental Services"
    assert float(deal["deal_size_m"]) == 40.0
    assert "Typo fixed by reviewer" in deal["commentary"]


async def test_accept_group_new_deal_can_link_to_an_existing_deal(db_session):
    existing = await create_deal(CreateDealRequest(company_name="Already Tracked Co"), db_session, auth=TEST_AUTH)
    log = await _make_scan_log(db_session)
    suggestion = await _make_suggestion(
        db_session, None, "new_deal", json.dumps({"company_name": "Already Tracked"}), scan_log=log
    )
    result = await accept_group(
        str(log.id), GroupAcceptRequest(deal_id=existing["deal_id"]), db_session, auth=TEST_AUTH
    )
    assert result["linked"] is True and result["created"] is False
    assert result["deal_id"] == existing["deal_id"]
    await db_session.refresh(suggestion)
    assert str(suggestion.deal_id) == existing["deal_id"]


async def test_accept_group_reports_every_failure_and_applies_nothing(db_session):
    log = await _make_scan_log(db_session, subject="Mixed quality")
    await _make_suggestion(
        db_session, None, "new_deal", json.dumps({"company_name": "Atomic Rollback Co"}), scan_log=log
    )
    bad = await _make_suggestion(db_session, None, "deal_size_m", "not-a-number", scan_log=log)

    with pytest.raises(HTTPException) as exc:
        await accept_group(
            str(log.id),
            GroupAcceptRequest(fields=[GroupFieldDecision(suggestion_id=bad.id)]),
            db_session,
            auth=TEST_AUTH,
        )
    assert exc.value.status_code == 422
    errors = exc.value.detail["errors"]
    assert [e["suggestion_id"] for e in errors] == [bad.id]
    assert errors[0]["field"] == "deal_size_m" and errors[0]["status"] == 400

    await db_session.rollback()  # what get_db does when the request fails
    from app.db.models import Deal
    created = (
        await db_session.execute(select(Deal).where(Deal.company_name == "Atomic Rollback Co"))
    ).scalar_one_or_none()
    assert created is None


async def test_accept_group_flags_a_locked_underwriting_field_without_blocking_the_rest(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Locked Co"), db_session, auth=TEST_AUTH)
    from app.db.models import Deal
    row = (await db_session.execute(select(Deal).where(Deal.id == deal["deal_id"]))).scalar_one()
    row.pipeline_stage = "loi_signed"
    await db_session.flush()
    log = await _make_scan_log(db_session)
    locked = await _make_suggestion(db_session, deal["deal_id"], "spread_bps", "400", scan_log=log)

    with pytest.raises(HTTPException) as exc:
        await accept_group(
            str(log.id),
            GroupAcceptRequest(fields=[GroupFieldDecision(suggestion_id=locked.id)]),
            db_session,
            auth=TEST_AUTH,
        )
    assert exc.value.detail["errors"][0]["status"] == 409


async def test_accept_group_rejects_unknown_suggestion_ids(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Unknown Id Co"), db_session, auth=TEST_AUTH)
    log = await _make_scan_log(db_session)
    await _make_suggestion(db_session, deal["deal_id"], "commentary", "x", scan_log=log)
    with pytest.raises(HTTPException) as exc:
        await accept_group(
            str(log.id),
            GroupAcceptRequest(fields=[GroupFieldDecision(suggestion_id=999999999)]),
            db_session,
            auth=TEST_AUTH,
        )
    assert exc.value.status_code == 400


async def test_dismiss_group_rejects_everything_for_the_email(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Dismiss Co"), db_session, auth=TEST_AUTH)
    log = await _make_scan_log(db_session)
    a = await _make_suggestion(db_session, deal["deal_id"], "commentary", "a", scan_log=log)
    b = await _make_suggestion(db_session, deal["deal_id"], "next_action", "b", scan_log=log)

    result = await dismiss_group(str(log.id), db_session, auth=TEST_AUTH)
    assert sorted(result["rejected"]) == sorted([a.id, b.id])
    with pytest.raises(HTTPException) as exc:
        await dismiss_group(str(log.id), db_session, auth=TEST_AUTH)
    assert exc.value.status_code == 404


async def test_read_group_email_fetches_live_and_reports_why_when_it_cannot(db_session, monkeypatch):
    from app.api import inbox as inbox_api
    from app.api.inbox import read_group_email

    log = await _make_scan_log(db_session, subject="Body please")
    monkeypatch.setattr(inbox_api.settings, "AZURE_CLIENT_ID", "x")
    monkeypatch.setattr(inbox_api.settings, "AZURE_CLIENT_SECRET", "y")

    async def fake_fetch(client, *, user_email, message_id):
        assert message_id == log.graph_message_id
        return {"body": {"contentType": "html", "content": "<html><body><p>Hi team,</p><p>Upsizing to $75M.</p></body></html>"}}

    monkeypatch.setattr("app.graph.mail.fetch_message", fake_fetch)
    ok = await read_group_email(str(log.id), db_session)
    assert ok["available"] is True
    assert "Upsizing to $75M." in ok["body"] and "<p>" not in ok["body"]

    async def gone(client, *, user_email, message_id):
        return None

    monkeypatch.setattr("app.graph.mail.fetch_message", gone)
    assert (await read_group_email(str(log.id), db_session))["reason"] == "removed"
    assert (await read_group_email("orphan-5", db_session))["reason"] == "no_source_email"
    monkeypatch.setattr(inbox_api.settings, "AZURE_CLIENT_ID", "")
    assert (await read_group_email(str(log.id), db_session))["reason"] == "graph_not_configured"
