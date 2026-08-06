"""Smoke tests for the new screening-memos endpoints (versioned, Corporate
Credit Data Model v0.2)."""
from app.api.deals import CreateDealRequest, create_deal
from app.api.screening import ScreeningMemoRequest, create_screening_memo, list_screening_memos

TEST_AUTH = {"sub": "test-user"}


async def test_versions_increment(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Screening Test Co"), db_session, auth=TEST_AUTH)

    first = await create_screening_memo(deal["deal_id"], ScreeningMemoRequest(recommendation="hold"), db_session)
    assert first["version"] == 1

    second = await create_screening_memo(deal["deal_id"], ScreeningMemoRequest(recommendation="go", status="decided"), db_session)
    assert second["version"] == 2
    assert second["status"] == "decided"

    memos = await list_screening_memos(deal["deal_id"], db_session)
    assert {m["version"] for m in memos} == {1, 2}
