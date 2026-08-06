"""Smoke tests for the new competition-assessments endpoints (Corporate Credit Data Model v0.2)."""
import pytest
from fastapi import HTTPException

from app.api.competition import CompetitionAssessmentRequest, create_competition_assessment, list_competition_assessments
from app.api.deals import CreateDealRequest, create_deal

TEST_AUTH = {"sub": "test-user"}


async def test_create_and_list_competition_assessment(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Competition Test Co"), db_session, auth=TEST_AUTH)
    assessment = await create_competition_assessment(
        deal["deal_id"], CompetitionAssessmentRequest(competition_level="High", notes="Two other bidders"), db_session
    )
    assert assessment["competition_level"] == "High"

    assessments = await list_competition_assessments(deal["deal_id"], db_session)
    assert any(a["assessment_id"] == assessment["assessment_id"] for a in assessments)


async def test_invalid_competition_level_rejected(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Bad Level Co"), db_session, auth=TEST_AUTH)
    with pytest.raises(HTTPException) as exc_info:
        await create_competition_assessment(
            deal["deal_id"], CompetitionAssessmentRequest(competition_level="Extreme"), db_session
        )
    assert exc_info.value.status_code == 400
