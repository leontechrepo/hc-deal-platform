"""Smoke tests for the new amendments endpoints (Corporate Credit Data Model v0.2)."""
import pytest
from fastapi import HTTPException

from app.api.amendments import AmendmentRequest, create_amendment, list_amendments
from app.api.approvals import ApprovalRequest, create_approval
from app.api.deals import CreateDealRequest, create_deal

TEST_AUTH = {"sub": "test-user"}


async def test_create_and_list_amendment(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Amendment Test Co"), db_session, auth=TEST_AUTH)
    amendment = await create_amendment(
        deal["deal_id"], AmendmentRequest(amendment_type="Maturity Extension", description="Extended 12 months"), db_session
    )
    assert amendment["amendment_type"] == "Maturity Extension"

    amendments = await list_amendments(deal["deal_id"], db_session)
    assert any(a["amendment_id"] == amendment["amendment_id"] for a in amendments)


async def test_amendment_can_link_to_an_approval(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Linked Amendment Co"), db_session, auth=TEST_AUTH)
    approval = await create_approval(
        deal["deal_id"],
        ApprovalRequest(approval_stage="Amendment Approval", approval_status="approved"),
        db_session,
        auth=TEST_AUTH,
    )
    amendment = await create_amendment(
        deal["deal_id"],
        AmendmentRequest(amendment_type="Covenant Reset", approval_log_id=approval["approval_id"]),
        db_session,
    )
    assert amendment["approval_log_id"] == approval["approval_id"]


async def test_amendment_rejects_approval_from_another_deal(db_session):
    deal_a = await create_deal(CreateDealRequest(company_name="Amendment Deal A"), db_session, auth=TEST_AUTH)
    deal_b = await create_deal(CreateDealRequest(company_name="Amendment Deal B"), db_session, auth=TEST_AUTH)
    approval_on_b = await create_approval(
        deal_b["deal_id"],
        ApprovalRequest(approval_stage="Amendment Approval", approval_status="approved"),
        db_session,
        auth=TEST_AUTH,
    )
    with pytest.raises(HTTPException) as exc_info:
        await create_amendment(
            deal_a["deal_id"],
            AmendmentRequest(amendment_type="Covenant Reset", approval_log_id=approval_on_b["approval_id"]),
            db_session,
        )
    assert exc_info.value.status_code == 400
