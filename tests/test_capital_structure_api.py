"""Smoke tests for the new capital-structure + participant-lenders endpoints
(Corporate Credit Data Model v0.2)."""
from app.api.capital_structure import (
    ParticipantLenderRequest,
    TranchePatchRequest,
    TrancheRequest,
    create_participant_lender,
    create_tranche,
    delete_tranche,
    list_capital_structure,
    list_participant_lenders,
    patch_tranche,
)
from app.api.deals import CreateDealRequest, create_deal

TEST_AUTH = {"sub": "test-user"}


async def test_create_list_patch_delete_tranche(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Cap Structure Co"), db_session, auth=TEST_AUTH)
    tranche = await create_tranche(
        deal["deal_id"],
        TrancheRequest(tranche_type="Term Loan", holder="Leon Capital Group", amount=5_000_000_00, is_lcg_position=True),
        db_session,
    )
    assert tranche["amount"] == 5_000_000_00
    assert tranche["is_lcg_position"] is True

    tranches = await list_capital_structure(deal["deal_id"], db_session)
    assert any(t["tranche_id"] == tranche["tranche_id"] for t in tranches)

    updated = await patch_tranche(deal["deal_id"], tranche["tranche_id"], TranchePatchRequest(seniority_rank=1), db_session)
    assert updated["seniority_rank"] == 1

    deleted = await delete_tranche(deal["deal_id"], tranche["tranche_id"], db_session)
    assert deleted["ok"] is True


async def test_create_and_list_participant_lender(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Syndication Co"), db_session, auth=TEST_AUTH)
    lender = await create_participant_lender(
        deal["deal_id"], ParticipantLenderRequest(lender_name="Other Bank", is_agent=False), db_session
    )
    assert lender["lender_name"] == "Other Bank"

    lenders = await list_participant_lenders(deal["deal_id"], db_session)
    assert any(l["participant_id"] == lender["participant_id"] for l in lenders)
