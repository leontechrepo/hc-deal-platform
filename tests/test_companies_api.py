"""Smoke tests for the new companies endpoints (Corporate Credit Data Model v0.2)."""
import uuid

import pytest
from fastapi import HTTPException

from app.api.companies import (
    CompanyPatchRequest,
    CompanyRequest,
    create_company,
    get_company,
    list_companies,
    patch_company,
)
from app.api.deals import CreateDealRequest, PatchRequest, create_deal, get_deal, patch_deal

TEST_AUTH = {"sub": "test-user"}


async def test_create_list_and_get_company(db_session):
    result = await create_company(CompanyRequest(company_name="Acme Health"), db_session)
    assert result["company_name"] == "Acme Health"

    companies = await list_companies(db_session)
    assert any(c["company_id"] == result["company_id"] for c in companies)

    fetched = await get_company(result["company_id"], db_session)
    assert fetched["company_name"] == "Acme Health"


async def test_get_missing_company_404(db_session):
    with pytest.raises(HTTPException) as exc_info:
        await get_company(uuid.uuid4(), db_session)
    assert exc_info.value.status_code == 404


async def test_patch_company(db_session):
    result = await create_company(CompanyRequest(company_name="Patch Co"), db_session)
    updated = await patch_company(result["company_id"], CompanyPatchRequest(sector="Cardiology"), db_session)
    assert updated["sector"] == "Cardiology"
    assert updated["company_name"] == "Patch Co"


async def test_create_deal_creates_and_links_a_company(db_session):
    deal = await create_deal(
        CreateDealRequest(company_name="Linked Borrower Co", sector_primary="Industrials", location="Dallas, TX"),
        db_session, auth=TEST_AUTH,
    )
    assert deal.get("deal_id")
    fetched = await get_deal(deal["deal_id"], db_session)
    assert fetched["company_id"] is not None

    company = await get_company(fetched["company_id"], db_session)
    assert company["company_name"] == "Linked Borrower Co"
    assert company["sector"] == "Industrials"
    assert company["hq_location"] == "Dallas, TX"


async def test_patch_company_syncs_to_linked_deal(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Sync From Company Co"), db_session, auth=TEST_AUTH)
    fetched = await get_deal(deal["deal_id"], db_session)

    await patch_company(fetched["company_id"], CompanyPatchRequest(company_name="Renamed Co", sector="Fintech"), db_session)

    refetched = await get_deal(deal["deal_id"], db_session)
    assert refetched["company_name"] == "Renamed Co"
    assert refetched["sector_primary"] == "Fintech"


async def test_patch_deal_company_name_syncs_to_company(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Sync From Deal Co"), db_session, auth=TEST_AUTH)
    fetched = await get_deal(deal["deal_id"], db_session)

    await patch_deal(deal["deal_id"], PatchRequest(field="company_name", value="Renamed From Deal Co"), db_session, auth=TEST_AUTH)

    company = await get_company(fetched["company_id"], db_session)
    assert company["company_name"] == "Renamed From Deal Co"


async def test_create_deal_with_unrestricted_state_value_does_not_truncate(db_session):
    # credit_deals.state has always been unrestricted TEXT — companies.state
    # must accept the same values without a width-related insert failure.
    deal = await create_deal(
        CreateDealRequest(company_name="Full State Name Co", state="California"), db_session, auth=TEST_AUTH,
    )
    fetched = await get_deal(deal["deal_id"], db_session)
    company = await get_company(fetched["company_id"], db_session)
    assert company["state"] == "California"
