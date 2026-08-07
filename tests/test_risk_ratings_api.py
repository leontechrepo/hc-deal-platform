"""Smoke tests for the new risk-ratings endpoints (Corporate Credit Data Model v0.2)."""
from app.api.deals import CreateDealRequest, create_deal
from app.api.risk_ratings import RiskRatingRequest, create_risk_rating, list_risk_ratings

TEST_AUTH = {"sub": "test-user"}


async def test_create_and_list_risk_rating(db_session):
    deal = await create_deal(CreateDealRequest(company_name="Risk Rating Test Co"), db_session, auth=TEST_AUTH)
    rating = await create_risk_rating(
        deal["deal_id"], RiskRatingRequest(rating_date="2026-01-01", risk_grade="2", rationale="Stable performance"), db_session
    )
    assert rating["risk_grade"] == "2"

    ratings = await list_risk_ratings(deal["deal_id"], db_session)
    assert any(r["rating_id"] == rating["rating_id"] for r in ratings)
