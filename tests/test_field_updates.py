"""Corporate Credit field update validators."""
from datetime import datetime, timezone

import pytest

from app.domain.field_updates import (
    ALLOWED_FIELD_UPDATES,
    FieldContext,
    VALIDATORS,
    coerce_field,
    validate_field_update,
)
from app.domain.pipeline_stage import PIPELINE_STAGES


def test_validators_cover_allowlist():
    assert set(VALIDATORS) == set(ALLOWED_FIELD_UPDATES)


def test_pipeline_stage_requires_adjacent_forward():
    ctx = FieldContext(
        current_value="sourcing",
        current_stage="sourcing",
        current_status="Active",
    )
    ok = validate_field_update("pipeline_stage", "intake_triage", ctx)
    assert ok.ok
    skip = validate_field_update("pipeline_stage", "screening", ctx)
    assert not skip.ok
    assert skip.reason == "stage_skip"


def test_evidence_gate_is_caller_side_but_missing_value_rejected():
    ctx = FieldContext(current_stage="screening", current_status="Active")
    result = validate_field_update("deal_size_m", "not-a-number", ctx)
    assert not result.ok


def test_deal_size_parses_millions():
    ctx = FieldContext()
    result = validate_field_update("deal_size_m", "12.5M", ctx)
    assert result.ok
    assert float(result.value) == 12.5


def test_spread_bps():
    result = validate_field_update("spread_bps", "425 bps", FieldContext())
    assert result.ok
    assert result.value == 425


def test_coerce_field_round_trip_display():
    validated = validate_field_update("ebitda_margin", "28%", FieldContext())
    assert validated.ok
    coerced = coerce_field("ebitda_margin", validated.display)
    assert coerced == validated.value


def test_no_change_rejected():
    ctx = FieldContext(current_value="Signed", current_stage="nda_execution", current_status="Active")
    result = validate_field_update("nda_status", "Signed", ctx)
    assert not result.ok
    assert result.reason == "no_change"


def test_all_pipeline_stages_known():
    assert len(PIPELINE_STAGES) == 11
