"""
DB-backed smoke tests for the extended /api/deals surface. See conftest.py for
how to point these at a throwaway Postgres — skipped automatically otherwise.
"""
import pytest
from sqlalchemy import select

from app.api.deals import (
    EDITABLE_FIELDS,
    CreateDealRequest,
    DealUpdateRequest,
    PatchRequest,
    create_deal,
    delete_deal,
    get_deal,
    list_deals,
    patch_deal,
    update_deal,
)
from app.db.models.activity import DealActivity, DealNote
from app.db.models.documents import DealDocument
from app.db.models.portfolio import PortfolioPosition
from app.db.models.timeline import DealTimelineTask, DealTimelineWorkstream
from app.domain.pipeline_stage import PIPELINE_STAGES, STATUSES
from fastapi import HTTPException

TEST_AUTH = {"sub": "test-user"}


async def test_list_deals_always_has_pipeline_stage_and_status(db_session):
    await create_deal(CreateDealRequest(company_name="Smoke Test Co"), db_session, auth=TEST_AUTH)

    deals = await list_deals(db_session)
    assert len(deals) >= 1
    for d in deals:
        assert d["pipeline_stage"] in PIPELINE_STAGES
        assert d["status"] in STATUSES


async def test_create_deal_computes_derived_fields(db_session):
    result = await create_deal(
        CreateDealRequest(company_name="Derived Fields Co", deal_size_m=20.0, ltm_ebitda_m=5.0,
                           spread_bps=525, sofr_rate=4.57),
        db_session,
        auth=TEST_AUTH,
    )
    deals = await list_deals(db_session)
    deal = next(d for d in deals if d["id"] == result["deal_id"])
    assert deal["total_leverage"] == 4.0
    assert deal["all_in_rate"] == 9.82


async def test_creating_deal_at_portfolio_monitoring_creates_position(db_session):
    result = await create_deal(
        CreateDealRequest(company_name="Born Funded Co", pipeline_stage="portfolio_monitoring", deal_size_m=15.0),
        db_session,
        auth=TEST_AUTH,
    )
    deal_id = result["deal_id"]

    position = (
        await db_session.execute(select(PortfolioPosition).where(PortfolioPosition.deal_id == deal_id))
    ).scalar_one_or_none()
    assert position is not None
    assert position.original_amount_m == 15.0


async def test_underwriting_fields_lock_after_loi_signed(db_session):
    result = await create_deal(CreateDealRequest(company_name="Lock Test Co", deal_size_m=10.0), db_session, auth=TEST_AUTH)
    deal_id = result["deal_id"]

    await patch_deal(deal_id, PatchRequest(field="pipeline_stage", value="loi_signed"), db_session, auth=TEST_AUTH)

    with pytest.raises(Exception) as exc_info:
        await patch_deal(deal_id, PatchRequest(field="deal_size_m", value=99), db_session, auth=TEST_AUTH)
    assert getattr(exc_info.value, "status_code", None) == 409


def test_deal_update_request_fields_match_editable_fields():
    # `reasoning` is metadata for the approval_log write-through (required when
    # `status` moves to a terminal value), not itself a Deal column.
    assert set(DealUpdateRequest.model_fields) - {"reasoning"} == EDITABLE_FIELDS


async def test_update_deal_saves_multiple_fields_in_one_call(db_session):
    result = await create_deal(CreateDealRequest(company_name="Bulk Update Co"), db_session, auth=TEST_AUTH)
    deal_id = result["deal_id"]

    updated = await update_deal(
        deal_id,
        DealUpdateRequest(location="Austin, TX", sector_primary="Healthcare", status="On Hold", reasoning="Sponsor requested a pause"),
        db_session,
        auth=TEST_AUTH,
    )
    assert updated["ok"] is True
    assert set(updated["updated_fields"]) == {"location", "sector_primary", "status"}
    assert updated["deal"]["location"] == "Austin, TX"
    assert updated["deal"]["sector_primary"] == "Healthcare"
    assert updated["deal"]["status"] == "On Hold"


async def test_update_deal_rejects_locked_fields_when_underwriting_locked(db_session):
    result = await create_deal(CreateDealRequest(company_name="Bulk Lock Co", deal_size_m=10.0), db_session, auth=TEST_AUTH)
    deal_id = result["deal_id"]
    await patch_deal(deal_id, PatchRequest(field="pipeline_stage", value="loi_signed"), db_session, auth=TEST_AUTH)

    with pytest.raises(HTTPException) as exc_info:
        await update_deal(
            deal_id,
            DealUpdateRequest(deal_size_m=99, location="New City"),
            db_session,
            auth=TEST_AUTH,
        )
    assert exc_info.value.status_code == 409
    assert "deal_size_m" in str(exc_info.value.detail)


async def test_update_deal_resubmitting_unchanged_locked_field_is_not_a_violation(db_session):
    result = await create_deal(CreateDealRequest(company_name="Resubmit Co", deal_size_m=10.0), db_session, auth=TEST_AUTH)
    deal_id = result["deal_id"]
    await patch_deal(deal_id, PatchRequest(field="pipeline_stage", value="loi_signed"), db_session, auth=TEST_AUTH)

    # A full edit-modal save resubmits every field it renders, including
    # locked underwriting ones at their existing value — that must be a
    # no-op for those fields, not a 409, as long as nothing actually changes.
    updated = await update_deal(
        deal_id,
        DealUpdateRequest(deal_size_m=10.0, security=None, location="New City"),
        db_session,
        auth=TEST_AUTH,
    )
    assert updated["ok"] is True
    assert updated["updated_fields"] == ["location"]
    assert updated["deal"]["location"] == "New City"
    assert updated["deal"]["deal_size_m"] == 10.0


async def test_update_deal_rejects_locked_field_changed_in_same_request_as_lock_transition(db_session):
    result = await create_deal(CreateDealRequest(company_name="Transition Lock Co", deal_size_m=10.0), db_session, auth=TEST_AUTH)
    deal_id = result["deal_id"]

    # Not yet locked — but this single request both advances the deal to
    # loi_signed AND changes a locked field. The lock must be evaluated
    # against the resulting stage, not the stage before the request.
    with pytest.raises(HTTPException) as exc_info:
        await update_deal(
            deal_id,
            DealUpdateRequest(pipeline_stage="loi_signed", deal_size_m=99),
            db_session,
            auth=TEST_AUTH,
        )
    assert exc_info.value.status_code == 409
    assert "deal_size_m" in str(exc_info.value.detail)


async def test_update_deal_rejects_invalid_enum(db_session):
    result = await create_deal(CreateDealRequest(company_name="Bulk Enum Co"), db_session, auth=TEST_AUTH)
    deal_id = result["deal_id"]

    with pytest.raises(HTTPException) as exc_info:
        await update_deal(deal_id, DealUpdateRequest(status="Not A Real Status"), db_session, auth=TEST_AUTH)
    assert exc_info.value.status_code == 400


async def test_patch_deal_status_to_terminal_requires_reasoning(db_session):
    result = await create_deal(CreateDealRequest(company_name="Terminal Patch Co"), db_session, auth=TEST_AUTH)
    deal_id = result["deal_id"]

    with pytest.raises(HTTPException) as exc_info:
        await patch_deal(deal_id, PatchRequest(field="status", value="Dead"), db_session, auth=TEST_AUTH)
    assert exc_info.value.status_code == 400

    patched = await patch_deal(
        deal_id, PatchRequest(field="status", value="Dead", reasoning="Lost to a competing lender"), db_session, auth=TEST_AUTH
    )
    assert patched["value"] == "Dead"


async def test_update_deal_status_to_terminal_requires_reasoning(db_session):
    result = await create_deal(CreateDealRequest(company_name="Terminal Bulk Update Co"), db_session, auth=TEST_AUTH)
    deal_id = result["deal_id"]

    with pytest.raises(HTTPException) as exc_info:
        await update_deal(deal_id, DealUpdateRequest(status="Closed"), db_session, auth=TEST_AUTH)
    assert exc_info.value.status_code == 400

    updated = await update_deal(
        deal_id, DealUpdateRequest(status="Closed", reasoning="Funded and closed"), db_session, auth=TEST_AUTH
    )
    assert updated["deal"]["status"] == "Closed"


async def test_delete_deal_cascades_child_records(db_session):
    result = await create_deal(
        CreateDealRequest(company_name="Cascade Delete Co", pipeline_stage="portfolio_monitoring", deal_size_m=12.0),
        db_session,
        auth=TEST_AUTH,
    )
    deal_id = result["deal_id"]

    db_session.add(DealNote(deal_id=deal_id, author="tester", body="a note"))
    db_session.add(DealDocument(deal_id=deal_id, name="doc.pdf", category="NDA"))
    workstream = DealTimelineWorkstream(deal_id=deal_id, name="Diligence")
    db_session.add(workstream)
    await db_session.flush()
    db_session.add(DealTimelineTask(workstream_id=workstream.id, name="Kickoff call"))
    await db_session.flush()

    position = (
        await db_session.execute(select(PortfolioPosition).where(PortfolioPosition.deal_id == deal_id))
    ).scalar_one_or_none()
    assert position is not None

    deleted = await delete_deal(deal_id, db_session, auth=TEST_AUTH)
    assert deleted["ok"] is True
    assert deleted["company_name"] == "Cascade Delete Co"

    with pytest.raises(HTTPException) as exc_info:
        await get_deal(deal_id, db_session)
    assert exc_info.value.status_code == 404

    assert (await db_session.execute(select(DealNote).where(DealNote.deal_id == deal_id))).scalar_one_or_none() is None
    assert (await db_session.execute(select(DealDocument).where(DealDocument.deal_id == deal_id))).scalar_one_or_none() is None
    assert (
        await db_session.execute(select(DealTimelineWorkstream).where(DealTimelineWorkstream.deal_id == deal_id))
    ).scalar_one_or_none() is None
    assert (
        await db_session.execute(select(DealTimelineTask).where(DealTimelineTask.workstream_id == workstream.id))
    ).scalar_one_or_none() is None
    assert (
        await db_session.execute(select(PortfolioPosition).where(PortfolioPosition.deal_id == deal_id))
    ).scalar_one_or_none() is None
    assert (
        await db_session.execute(select(DealActivity).where(DealActivity.deal_id == deal_id))
    ).scalar_one_or_none() is None
