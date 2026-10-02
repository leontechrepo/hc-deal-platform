"""Extraction parsing tests (planning and review live in test_extraction_workflow)."""
from app.services.deal_extraction import parse_tool_fields


def test_parse_tool_fields_filters_unknown():
    stored, candidates = parse_tool_fields(
        [
            {"field": "deal_size_m", "value": "12.5", "confidence": 0.9, "evidence": "Facility: $12.5M"},
            {"field": "cap_rate", "value": "5.8", "confidence": 0.9, "evidence": "should not appear"},
            {"field": "spread_bps", "value": "400", "confidence": 0.4, "evidence": "too low"},
        ],
        document_id=1,
    )
    fields = {s["field"] for s in stored}
    assert "deal_size_m" in fields
    assert "cap_rate" not in fields
    assert all(c.field != "spread_bps" for c in candidates)  # below MIN_CONFIDENCE
