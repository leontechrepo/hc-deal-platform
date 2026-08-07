"""Smoke tests for the new underwriting-assumptions endpoints (versioned,
Corporate Credit Data Model v0.2)."""
import pytest
from fastapi import HTTPException

from app.api.deals import CreateDealRequest, create_deal
from app.api.underwriting import (
    UnderwritingAssumptionRequest,
    create_underwriting_assumption,
    get_latest_underwriting_assumption,
    list_underwriting_assumptions,
)

TEST_AUTH = {"sub": "test-user"}


async def test_versions_increment_and_are_never_overwritten(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Underwriting Test Co"), db_session, auth=TEST_AUTH)

    first = await create_underwriting_assumption(
        deal["deal_id"], UnderwritingAssumptionRequest(total_leverage_multiple=4.0), db_session
    )
    assert first["version"] == 1

    second = await create_underwriting_assumption(
        deal["deal_id"], UnderwritingAssumptionRequest(total_leverage_multiple=4.5), db_session
    )
    assert second["version"] == 2

    all_versions = await list_underwriting_assumptions(deal["deal_id"], db_session)
    assert {a["version"] for a in all_versions} == {1, 2}

    latest = await get_latest_underwriting_assumption(deal["deal_id"], db_session)
    assert latest["version"] == 2
    assert latest["total_leverage_multiple"] == 4.5


async def test_latest_404_when_no_assumptions_recorded(db_session):
    deal = await create_deal(CreateDealRequest(company_name="No Underwriting Co"), db_session, auth=TEST_AUTH)
    with pytest.raises(HTTPException) as exc_info:
        await get_latest_underwriting_assumption(deal["deal_id"], db_session)
    assert exc_info.value.status_code == 404


async def test_create_rejects_invalid_data_classification(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Bad Classification Co"), db_session, auth=TEST_AUTH)
    with pytest.raises(HTTPException) as exc_info:
        await create_underwriting_assumption(
            deal["deal_id"], UnderwritingAssumptionRequest(data_classification="Confidential"), db_session
        )
    assert exc_info.value.status_code == 400
