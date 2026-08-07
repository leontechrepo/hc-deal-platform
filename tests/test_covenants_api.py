"""Smoke tests for the new covenants endpoints, including the reuse of
portfolio_monitoring_tests as covenant_test_results (Corporate Credit Data
Model v0.2)."""
import pytest
from fastapi import HTTPException

from app.api.covenants import CovenantPatchRequest, CovenantRequest, create_covenant, list_covenants, patch_covenant
from app.api.deals import CreateDealRequest, create_deal
from app.api.portfolio import PortfolioTestRequest, create_portfolio_test

TEST_AUTH = {"sub": "test-user"}


async def test_create_list_and_patch_covenant(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Covenant Test Co"), db_session, auth=TEST_AUTH)
    covenant = await create_covenant(
        deal["deal_id"],
        CovenantRequest(covenant_type="Financial", covenant_name="Max Total Leverage", threshold_value=4.5, test_frequency="Quarterly"),
        db_session,
    )
    assert covenant["threshold_value"] == 4.5

    covenants = await list_covenants(deal["deal_id"], db_session)
    assert any(c["covenant_id"] == covenant["covenant_id"] for c in covenants)

    updated = await patch_covenant(deal["deal_id"], covenant["covenant_id"], CovenantPatchRequest(threshold_value=5.0), db_session)
    assert updated["threshold_value"] == 5.0


async def test_threshold_only_valid_for_financial_covenants(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Negative Covenant Co"), db_session, auth=TEST_AUTH)
    with pytest.raises(HTTPException) as exc_info:
        await create_covenant(
            deal["deal_id"],
            CovenantRequest(covenant_type="Negative", covenant_name="Restriction on Additional Debt", threshold_value=1.0),
            db_session,
        )
    assert exc_info.value.status_code == 400


async def test_portfolio_monitoring_test_can_link_to_a_covenant(db_session):
    """portfolio_monitoring_tests is reused as covenant_test_results — a test
    can optionally tie to a specific Covenant once one exists."""
    deal = await create_deal(
        CreateDealRequest(company_name="Reuse Covenant Test Co", pipeline_stage="portfolio_monitoring", deal_size_m=10.0),
        db_session,
        auth=TEST_AUTH,
    )
    covenant = await create_covenant(
        deal["deal_id"], CovenantRequest(covenant_type="Financial", covenant_name="Max Total Leverage", threshold_value=4.5),
        db_session,
    )
    test = await create_portfolio_test(
        deal["deal_id"],
        PortfolioTestRequest(test_date="2026-01-01", leverage=4.0, covenant_id=covenant["covenant_id"]),
        db_session,
    )
    assert test["covenant_id"] == covenant["covenant_id"]
