"""Smoke tests for the new deal-team-members endpoints (Corporate Credit Data Model v0.2)."""
import pytest
from fastapi import HTTPException

from app.api.deal_team import (
    TeamMemberRequest,
    create_team_member,
    delete_team_member,
    list_team_members,
)
from app.api.deals import CreateDealRequest, create_deal

TEST_AUTH = {"sub": "test-user"}


async def test_create_list_and_delete_team_member(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Team Test Co"), db_session, auth=TEST_AUTH)
    member = await create_team_member(
        deal["deal_id"], TeamMemberRequest(team_member="Alex Analyst", role_on_deal="Analyst"), db_session
    )
    assert member["role_on_deal"] == "Analyst"

    members = await list_team_members(deal["deal_id"], db_session)
    assert any(m["team_id"] == member["team_id"] for m in members)

    deleted = await delete_team_member(deal["deal_id"], member["team_id"], db_session)
    assert deleted["ok"] is True
    assert await list_team_members(deal["deal_id"], db_session) == []


async def test_invalid_role_on_deal_rejected(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Bad Team Role Co"), db_session, auth=TEST_AUTH)
    with pytest.raises(HTTPException) as exc_info:
        await create_team_member(deal["deal_id"], TeamMemberRequest(team_member="X", role_on_deal="Manager"), db_session)
    assert exc_info.value.status_code == 400
