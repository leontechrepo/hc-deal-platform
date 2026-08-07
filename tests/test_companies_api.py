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
