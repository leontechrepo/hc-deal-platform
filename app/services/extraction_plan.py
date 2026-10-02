"""Decide what to do with each extracted candidate. Pure — no I/O.

Dispositions (stored on ``deal_extraction_candidates.status``):

applied               blank field, one clear value, confidence >= HIGH_CONFIDENCE
suggested             blank field, valid value, but ambiguous / locked -> human review
conflict              documents disagree and neither clearly wins -> human review
differs_from_current  field already populated with a different value -> human review
matches_existing      field already populated with the same value (nothing to do)
corroborating         agrees with the winning value for its field
superseded            disagrees with, and is clearly weaker than, the winning value
invalid               failed the credit field validator

Populated values are never overwritten here; only a reviewer can do that.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from app.domain.field_updates import FieldContext, validate_field_update
from app.domain.pipeline_stage import UNDERWRITING_FIELDS, is_underwriting_locked

HIGH_CONFIDENCE = 0.85
CONFLICT_MARGIN = 0.10


@dataclass(frozen=True)
class RawCandidate:
    field: str
    value: str
    confidence: float
    evidence: str
    document_id: int


@dataclass(frozen=True)
class Planned:
    candidate: RawCandidate
    status: str
    reason: str | None = None
    value: Any | None = None  # validated, DB-typed
    display: str | None = None
    current: str | None = None


def _blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _same(a: Any, b: Any) -> bool:
    if a is None or b is None:
        return False
    try:
        from decimal import Decimal

        return Decimal(str(a)) == Decimal(str(b))
    except Exception:  # noqa: BLE001 - non-numeric: compare as text
        return str(a).strip().lower() == str(b).strip().lower()


def plan_candidates(
    candidates: list[RawCandidate],
    *,
    current_values: Callable[[str], Any],
    pipeline_stage: str | None,
    status: str | None,
) -> list[Planned]:
    locked = is_underwriting_locked(pipeline_stage)
    by_field: dict[str, list[RawCandidate]] = {}
    for candidate in candidates:
        by_field.setdefault(candidate.field, []).append(candidate)

    planned: list[Planned] = []
    for field, items in by_field.items():
        current = current_values(field)
        current_text = None if _blank(current) else str(current)
        ctx = FieldContext(current_value=None, current_stage=pipeline_stage, current_status=status)

        valid: list[tuple[RawCandidate, Any, str | None]] = []
        for item in items:
            result = validate_field_update(field, item.value, ctx)
            if not result.ok:
                planned.append(Planned(item, "invalid", result.reason, current=current_text))
            else:
                valid.append((item, result.value, result.display))
        if not valid:
            continue

        groups: dict[str, list[tuple[RawCandidate, Any, str | None]]] = {}
        for entry in valid:
            groups.setdefault(str(entry[1]), []).append(entry)

        def best(group):  # highest confidence, then lowest document id (deterministic)
            return sorted(group, key=lambda e: (-e[0].confidence, e[0].document_id))[0]

        ranked = sorted(
            groups.values(), key=lambda g: (-best(g)[0].confidence, best(g)[0].document_id)
        )
        top = ranked[0]
        contested = len(ranked) > 1 and (
            best(top)[0].confidence - best(ranked[1])[0].confidence < CONFLICT_MARGIN
        )
        if contested:
            for entry in valid:
                planned.append(Planned(
                    entry[0], "conflict", "documents disagree on this field",
                    value=entry[1], display=entry[2], current=current_text,
                ))
            continue

        for group in ranked[1:]:
            for entry in group:
                planned.append(Planned(
                    entry[0], "superseded", "weaker than the winning value",
                    value=entry[1], display=entry[2], current=current_text,
                ))

        winner = best(top)
        w_candidate, w_value, w_display = winner
        if not _blank(current):
            disposition = "matches_existing" if _same(w_value, current) else "differs_from_current"
            reason = None if disposition == "matches_existing" else "field already has a value"
        elif field in UNDERWRITING_FIELDS and locked:
            disposition, reason = "suggested", "underwriting_locked"
        elif w_candidate.confidence >= HIGH_CONFIDENCE:
            disposition, reason = "applied", None
        else:
            disposition, reason = "suggested", "confidence below auto-apply threshold"

        for entry in top:
            is_winner = entry is winner
            planned.append(Planned(
                entry[0],
                disposition if is_winner else (
                    "corroborating" if disposition != "matches_existing" else "matches_existing"
                ),
                reason if is_winner else None,
                value=entry[1], display=entry[2], current=current_text,
            ))
    return planned
