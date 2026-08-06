"""Smoke tests for the new approval-log endpoints (Corporate Credit Data
Model v0.2) — the audit_trail concept superseded by deal_activity."""
import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.api.approvals import ApprovalRequest, create_approval, list_approvals
from app.api.deals import CreateDealRequest, create_deal
from app.db.models.activity import DealActivity

TEST_AUTH = {"sub": "test-user"}


async def test_create_and_list_approval(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Approval Test Co"), db_session, auth=TEST_AUTH)
    approval = await create_approval(
        deal["deal_id"],
        ApprovalRequest(approval_stage="screening", approver="J. O'Meara", approval_status="approved"),
        db_session,
        auth=TEST_AUTH,
    )
    assert approval["approval_status"] == "approved"

    approvals = await list_approvals(deal["deal_id"], db_session)
    assert any(a["approval_id"] == approval["approval_id"] for a in approvals)


async def test_reasoning_required_on_terminal_status(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Terminal Status Co"), db_session, auth=TEST_AUTH)
    with pytest.raises(HTTPException) as exc_info:
        await create_approval(
            deal["deal_id"], ApprovalRequest(approval_stage="Passed", approval_status="approved"), db_session, auth=TEST_AUTH
        )
    assert exc_info.value.status_code == 400

    # Providing reasoning makes the same terminal-stage approval succeed.
    approval = await create_approval(
        deal["deal_id"],
        ApprovalRequest(approval_stage="Passed", approval_status="approved", reasoning="Sector concentration risk"),
        db_session,
        auth=TEST_AUTH,
    )
    assert approval["reasoning"] == "Sector concentration risk"


async def test_approval_emits_a_deal_activity_entry(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Activity Feed Co"), db_session, auth=TEST_AUTH)
    await create_approval(
        deal["deal_id"], ApprovalRequest(approval_stage="screening", approval_status="approved"), db_session, auth=TEST_AUTH
    )
    activity = (
        await db_session.execute(
            select(DealActivity).where(DealActivity.deal_id == deal["deal_id"], DealActivity.activity_type == "approval")
        )
    ).scalar_one_or_none()
    assert activity is not None
