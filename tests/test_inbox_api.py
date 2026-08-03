"""
Regression tests for the Codex-review findings on app/api/inbox.py:
- approving a sponsor_id suggestion must not crash on the audit-log truncation
- list_inbox (and its /review-queue alias) must return the legacy `stage` key
- approving a pipeline_stage -> portfolio_monitoring suggestion must create a
  PortfolioPosition, matching the manual PATCH /api/deals/{id} path's behavior
"""
from sqlalchemy import select

from app.api.deals import CreateDealRequest, create_deal
from app.api.inbox import ApproveRequest, approve_suggestion, list_inbox
from app.api.sponsors import SponsorRequest, create_sponsor
from app.db.models import EmailScanLog, PendingSuggestion
from app.db.models.portfolio import PortfolioPosition

TEST_AUTH = {"sub": "test-user"}


async def _make_suggestion(db_session, deal_id, suggested_field, suggested_value):
    scan_log = EmailScanLog(
        graph_message_id=f"msg-{suggested_field}-{deal_id}",
        user_email="jomeara@leonhealthcarepartners.com",
        subject="Test email",
        action_taken="queued_for_review",
    )
    db_session.add(scan_log)
    await db_session.flush()

    suggestion = PendingSuggestion(
        deal_id=deal_id,
        email_scan_log_id=scan_log.id,
        suggested_field=suggested_field,
        suggested_value=suggested_value,
        claude_summary="test",
        email_subject="Test email",
        confidence=0.9,
        source="email_scan",
        status="pending",
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
    assert "stage" in items[0]
    assert "pipeline_stage" in items[0]


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
    assert suggestion.deal_id == correct["deal_id"]

    from app.api.deals import get_deal

    original_deal = await get_deal(original["deal_id"], db_session)
    correct_deal = await get_deal(correct["deal_id"], db_session)
    assert original_deal["commentary"] is None
    assert correct_deal["commentary"] == "2026/01/01: [Auto] note"


async def test_approving_portfolio_monitoring_transition_creates_position(db_session):
    deal_result = await create_deal(CreateDealRequest(company_name="Funded Via Inbox Co", deal_size_m=8.0), db_session, auth=TEST_AUTH)
    deal_id = deal_result["deal_id"]

    suggestion = await _make_suggestion(db_session, deal_id, "pipeline_stage", "portfolio_monitoring")
    await approve_suggestion(suggestion.id, ApproveRequest(), db_session, auth=TEST_AUTH)

    position = (
        await db_session.execute(select(PortfolioPosition).where(PortfolioPosition.deal_id == deal_id))
    ).scalar_one_or_none()
    assert position is not None
    assert float(position.original_amount_m) == 8.0
