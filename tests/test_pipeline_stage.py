"""
Unit tests for the pipeline_stage backfill/derivation logic — the highest-risk
piece of the 11-stage migration, since it decides how every existing Excel-era
deal maps onto the new funnel. No database required.
"""
from app.domain.pipeline_stage import (
    PIPELINE_STAGES,
    UNDERWRITING_LOCK_STAGE,
    derive_pipeline_stage,
    is_underwriting_locked,
    stage_index,
)


def test_pipeline_stages_has_eleven_values():
    assert len(PIPELINE_STAGES) == 11
    assert len(set(PIPELINE_STAGES)) == 11  # no duplicates


def test_closed_bucket_maps_to_portfolio_monitoring():
    stage, status = derive_pipeline_stage("Closed", "Closed", "P", "P", "P", "P", "P")
    assert stage == "portfolio_monitoring"
    assert status == "Closed"


def test_ioi_signed_maps_to_loi_signed():
    stage, status = derive_pipeline_stage("Active-Diligence", "Pre-LOI Diligence", "P", "P", "P", "P", "P")
    assert stage == "loi_signed"
    assert status == "Active"


def test_ioi_offered_without_signed_maps_to_loi_negotiation():
    stage, _ = derive_pipeline_stage("Active-Diligence", "Pre-LOI Diligence", "P", "P", "P", "P", None)
    assert stage == "loi_negotiation"


def test_mgmt_meeting_without_ioi_maps_to_pre_loi_diligence():
    stage, _ = derive_pipeline_stage("Active-Diligence", "Pre-LOI Diligence", "P", "P", "P", None, None)
    assert stage == "pre_loi_diligence"


def test_dataroom_only_maps_to_pre_loi_diligence():
    stage, _ = derive_pipeline_stage("Active-Diligence", None, "P", "P", None, None, None)
    assert stage == "pre_loi_diligence"


def test_nda_only_maps_to_screening():
    stage, _ = derive_pipeline_stage("Active-Discussions", None, "P", None, None, None, None)
    assert stage == "screening"


def test_no_milestones_maps_to_intake_triage():
    stage, status = derive_pipeline_stage("Active-Discussions", "Initial Conversations", None, None, None, None, None)
    assert stage == "intake_triage"
    assert status == "Active"


def test_dead_hold_with_pass_text_maps_to_passed_status():
    _, status = derive_pipeline_stage("Dead-Hold", "Passed on valuation", None, None, None, None, None)
    assert status == "Passed"


def test_dead_hold_with_hold_text_maps_to_on_hold_status():
    _, status = derive_pipeline_stage("Dead-Hold", "On Hold pending Q2 financials", None, None, None, None, None)
    assert status == "On Hold"


def test_dead_hold_ambiguous_text_defaults_to_passed():
    """Flagged ambiguous case — no clear hold/pass signal, defaults to Passed."""
    _, status = derive_pipeline_stage("Dead-Hold", "some other note", None, None, None, None, None)
    assert status == "Passed"


def test_dead_hold_runs_same_milestone_ladder():
    """A stalled deal's pipeline_stage reflects where it stalled, not just its status."""
    stage, status = derive_pipeline_stage("Dead-Hold", "On Hold", "P", None, None, None, None)
    assert stage == "screening"
    assert status == "On Hold"


def test_stage_index_orders_the_funnel():
    assert stage_index("sourcing") == 0
    assert stage_index("portfolio_monitoring") == 10
    assert stage_index("loi_signed") < stage_index("post_loi_diligence")


def test_stage_index_unknown_returns_negative_one():
    assert stage_index(None) == -1
    assert stage_index("not_a_real_stage") == -1


def test_underwriting_lock_boundary():
    lock_idx = stage_index(UNDERWRITING_LOCK_STAGE)
    before = PIPELINE_STAGES[lock_idx - 1]
    assert not is_underwriting_locked(before)
    assert is_underwriting_locked(UNDERWRITING_LOCK_STAGE)
    assert is_underwriting_locked(PIPELINE_STAGES[-1])
