"""
DB-backed smoke tests for the extended /api/deals surface. See conftest.py for
how to point these at a throwaway Postgres — skipped automatically otherwise.
"""
import pytest

from app.api.deals import (
    CreateDealRequest,
    PatchRequest,
    create_deal,
    list_deals,
    patch_deal,
)
from app.domain.pipeline_stage import PIPELINE_STAGES, STATUSES


async def test_list_deals_always_has_pipeline_stage_and_status(db_session):
    await create_deal(CreateDealRequest(company_name="Smoke Test Co"), db_session)

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
    )
    deals = await list_deals(db_session)
    deal = next(d for d in deals if d["id"] == result["deal_id"])
    assert deal["total_leverage"] == 4.0
    assert deal["all_in_rate"] == 9.82


async def test_underwriting_fields_lock_after_loi_signed(db_session):
    result = await create_deal(CreateDealRequest(company_name="Lock Test Co", deal_size_m=10.0), db_session)
    deal_id = result["deal_id"]

    await patch_deal(deal_id, PatchRequest(field="pipeline_stage", value="loi_signed"), db_session)

    with pytest.raises(Exception) as exc_info:
        await patch_deal(deal_id, PatchRequest(field="deal_size_m", value=99), db_session)
    assert getattr(exc_info.value, "status_code", None) == 409
