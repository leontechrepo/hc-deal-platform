"""Smoke tests for the new contacts endpoints (Corporate Credit Data Model v0.2)."""
import pytest
from fastapi import HTTPException

from app.api.contacts import ContactPatchRequest, ContactRequest, create_contact, list_deal_contacts, patch_contact
from app.api.deals import CreateDealRequest, create_deal

TEST_AUTH = {"sub": "test-user"}


async def test_create_and_list_deal_contact(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Contact Test Co"), db_session, auth=TEST_AUTH)
    contact = await create_contact(
        ContactRequest(deal_id=deal["deal_id"], name="Jane CFO", role="CFO"), db_session
    )
    assert contact["role"] == "CFO"
    assert contact["data_classification"] == "PII"

    contacts = await list_deal_contacts(deal["deal_id"], db_session)
    assert any(c["contact_id"] == contact["contact_id"] for c in contacts)


async def test_invalid_role_rejected(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Bad Role Co"), db_session, auth=TEST_AUTH)
    with pytest.raises(HTTPException) as exc_info:
        await create_contact(ContactRequest(deal_id=deal["deal_id"], name="X", role="Not A Role"), db_session)
    assert exc_info.value.status_code == 400


async def test_patch_contact(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Patch Contact Co"), db_session, auth=TEST_AUTH)
    contact = await create_contact(ContactRequest(deal_id=deal["deal_id"], name="Original Name"), db_session)
    updated = await patch_contact(contact["contact_id"], ContactPatchRequest(name="New Name"), db_session)
    assert updated["name"] == "New Name"
