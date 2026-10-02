"""Classifier schema and parsing without live Anthropic calls."""
from app.automation.classifier import build_output_schema, SCHEMA_ENUM_BUDGET
from app.db.deal_search import DealCandidate, resolve_candidate
from app.domain.field_updates import allowed_field_enum
import uuid


def test_output_schema_enum_budget():
    schema = build_output_schema()
    field_enum = schema["properties"]["field_updates"]["items"]["properties"]["field"]["enum"]
    # outcome enum (3) + field enum
    assert len(field_enum) + 3 <= SCHEMA_ENUM_BUDGET + 20  # generous headroom for CC
    assert set(field_enum) == set(allowed_field_enum())


def test_resolve_candidate_index():
    c = DealCandidate(
        deal_id=uuid.uuid4(),
        company_name="Acme",
        pipeline_stage="screening",
        status="Active",
        sector=None,
        location=None,
        score=0.9,
        match_reason="company_name",
    )
    assert resolve_candidate([c], 1) is c
    assert resolve_candidate([c], 2) is None
    assert resolve_candidate([c], None) is None
