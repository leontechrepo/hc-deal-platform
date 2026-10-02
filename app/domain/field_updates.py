"""Corporate Credit field update allowlist and validators.

Double whitelist: field name in ALLOWED_FIELD_UPDATES AND a per-field validator
must accept the raw string. Pure functions — no I/O.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any, Callable, Container

from app.domain.pipeline_stage import (
    PIPELINE_STAGES,
    STATUSES,
    TERMINAL_STATUSES,
    stage_index,
    validate_stage_transition,
)

# Credit-specific writable surface for email-derived proposals.
ALLOWED_FIELD_UPDATES: frozenset[str] = frozenset({
    "pipeline_stage",
    "status",
    "next_action",
    "nda_status",
    "nda_date",
    "target_close",
    "deal_size_m",
    "hold_amount_m",
    "spread_bps",
    "total_leverage",
    "dscr",
    "fccr",
    "interest_coverage",
    "ltm_revenue_m",
    "ltm_ebitda_m",
    "ebitda_margin",
    "tenor_months",
    "maturity_date",
    "security",
    "oid_pct",
    "sofr_floor_pct",
})

NDA_STATUSES = frozenset({"Not Started", "Sent", "Signed"})


@dataclass(frozen=True)
class Validated:
    ok: bool
    value: Any | None = None
    display: str | None = None
    reason: str | None = None


@dataclass(frozen=True)
class FieldContext:
    current_value: Any = None
    current_stage: str | None = None
    current_status: str | None = None
    email_received_at: datetime | None = None


Validator = Callable[[str, FieldContext], Validated]

_MONEY_SUFFIXES = {"k": Decimal("0.001"), "m": Decimal("1"), "b": Decimal("1000")}
_MONEY_CLEAN = re.compile(r"[,$\s]")
_MONEY_SUFFIXED = re.compile(r"^([0-9.]+)\s*([kmb])$", re.IGNORECASE)


def _parse_millions(raw: str) -> Decimal | None:
    """Parse deal-size style values into millions: '12.5', '$12.5M', '12500000'."""
    text = _MONEY_CLEAN.sub("", (raw or "").strip())
    if not text:
        return None
    match = _MONEY_SUFFIXED.match(text)
    try:
        if match:
            amount = Decimal(match.group(1))
            suffix = match.group(2).lower()
            if suffix == "m":
                return amount.quantize(Decimal("0.01"))
            if suffix == "k":
                return (amount / Decimal(1000)).quantize(Decimal("0.01"))
            if suffix == "b":
                return (amount * Decimal(1000)).quantize(Decimal("0.01"))
        value = Decimal(text)
        # Bare large numbers are dollars → convert to millions.
        if value >= Decimal(1000):
            return (value / Decimal(1_000_000)).quantize(Decimal("0.01"))
        return value.quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None


def _millions(min_v: Decimal, max_v: Decimal) -> Validator:
    def check(raw: str, ctx: FieldContext) -> Validated:
        amount = _parse_millions(raw)
        if amount is None:
            return Validated(False, reason="unparseable_money")
        if not (min_v <= amount <= max_v):
            return Validated(False, reason="money_out_of_range")
        return Validated(True, amount, f"{amount}M")

    return check


def _percent_points(min_v: Decimal, max_v: Decimal, as_fraction: bool = True) -> Validator:
    def check(raw: str, ctx: FieldContext) -> Validated:
        text = (raw or "").replace("%", "").strip()
        try:
            points = Decimal(text)
        except (InvalidOperation, ValueError):
            return Validated(False, reason="unparseable_percent")
        if not (min_v <= points <= max_v):
            return Validated(False, reason="percent_out_of_range")
        if as_fraction:
            return Validated(
                True, (points / Decimal(100)).quantize(Decimal("0.0001")), f"{points}%"
            )
        return Validated(True, points.quantize(Decimal("0.0001")), f"{points}%")

    return check


def _ratio(min_v: Decimal, max_v: Decimal) -> Validator:
    def check(raw: str, ctx: FieldContext) -> Validated:
        text = (raw or "").strip().rstrip("xX")
        try:
            value = Decimal(text)
        except (InvalidOperation, ValueError):
            return Validated(False, reason="unparseable_ratio")
        if not (min_v <= value <= max_v):
            return Validated(False, reason="ratio_out_of_range")
        return Validated(True, value.quantize(Decimal("0.01")), str(value))

    return check


def _bps(raw: str, ctx: FieldContext) -> Validated:
    text = (raw or "").strip().lower().replace("bps", "").replace("bp", "").strip()
    try:
        value = int(Decimal(text))
    except (InvalidOperation, ValueError):
        return Validated(False, reason="unparseable_bps")
    if not (0 <= value <= 2000):
        return Validated(False, reason="bps_out_of_range")
    return Validated(True, value, f"{value} bps")


def _int_range(min_v: int, max_v: int) -> Validator:
    def check(raw: str, ctx: FieldContext) -> Validated:
        try:
            value = int(Decimal((raw or "").strip()))
        except (InvalidOperation, ValueError):
            return Validated(False, reason="unparseable_int")
        if not (min_v <= value <= max_v):
            return Validated(False, reason="int_out_of_range")
        return Validated(True, value, str(value))

    return check


def _date_field(max_years_ahead: int, max_days_past: int) -> Validator:
    def check(raw: str, ctx: FieldContext) -> Validated:
        text = (raw or "").strip()
        try:
            parsed = date.fromisoformat(text[:10])
        except ValueError:
            return Validated(False, reason="unparseable_date")
        anchor = (
            ctx.email_received_at.date()
            if ctx.email_received_at
            else date.today()
        )
        if parsed > anchor + timedelta(days=365 * max_years_ahead):
            return Validated(False, reason="date_too_far_ahead")
        if parsed < anchor - timedelta(days=max_days_past):
            return Validated(False, reason="date_too_far_past")
        return Validated(True, parsed, parsed.isoformat())

    return check


def _enum(values: Container[str]) -> Validator:
    def check(raw: str, ctx: FieldContext) -> Validated:
        text = (raw or "").strip()
        if text not in values:
            return Validated(False, reason="not_in_enum")
        return Validated(True, text, text)

    return check


def _short_text(max_len: int) -> Validator:
    def check(raw: str, ctx: FieldContext) -> Validated:
        text = " ".join((raw or "").split())
        if not text:
            return Validated(False, reason="empty")
        if len(text) > max_len:
            return Validated(False, reason="too_long")
        return Validated(True, text, text)

    return check


def _pipeline_stage(raw: str, ctx: FieldContext) -> Validated:
    stage = (raw or "").strip()
    if stage not in PIPELINE_STAGES:
        return Validated(False, reason="not_a_stage")
    if ctx.current_status in TERMINAL_STATUSES:
        return Validated(False, reason="deal_is_terminal")
    error = validate_stage_transition(ctx.current_stage, stage, allow_skip=False)
    if error:
        return Validated(False, reason="stage_skip")
    if stage_index(stage) <= stage_index(ctx.current_stage):
        return Validated(False, reason="not_forward")
    return Validated(True, stage, stage)


def _status(raw: str, ctx: FieldContext) -> Validated:
    status = (raw or "").strip()
    if status not in STATUSES:
        return Validated(False, reason="not_a_status")
    return Validated(True, status, status)


VALIDATORS: dict[str, Validator] = {
    "pipeline_stage": _pipeline_stage,
    "status": _status,
    "next_action": _short_text(200),
    "nda_status": _enum(NDA_STATUSES),
    "nda_date": _date_field(2, 365),
    "target_close": _date_field(3, 180),
    "maturity_date": _date_field(15, 365),
    "deal_size_m": _millions(Decimal("0.5"), Decimal("5000")),
    "hold_amount_m": _millions(Decimal("0.1"), Decimal("2000")),
    "ltm_revenue_m": _millions(Decimal("0"), Decimal("50000")),
    "ltm_ebitda_m": _millions(Decimal("-1000"), Decimal("10000")),
    # Stored as percentage points (28 = 28%) — the UI labels and edits these in %.
    "ebitda_margin": _percent_points(Decimal("0"), Decimal("100"), as_fraction=False),
    "oid_pct": _percent_points(Decimal("0"), Decimal("20"), as_fraction=False),
    "sofr_floor_pct": _percent_points(Decimal("0"), Decimal("10"), as_fraction=False),
    "spread_bps": _bps,
    "total_leverage": _ratio(Decimal("0"), Decimal("20")),
    "dscr": _ratio(Decimal("0"), Decimal("20")),
    "fccr": _ratio(Decimal("0"), Decimal("20")),
    "interest_coverage": _ratio(Decimal("0"), Decimal("50")),
    "tenor_months": _int_range(1, 240),
    "security": _short_text(120),
}

_missing = set(VALIDATORS) ^ set(ALLOWED_FIELD_UPDATES)
if _missing:
    raise RuntimeError(
        "VALIDATORS and ALLOWED_FIELD_UPDATES must cover exactly the same fields: "
        f"{_missing}"
    )

LARGE_MOVE_RATIO = Decimal("0.40")
_MONEY_FIELDS = frozenset({"deal_size_m", "hold_amount_m", "ltm_revenue_m", "ltm_ebitda_m"})


def validate_field_update(field: str, raw_value: str, ctx: FieldContext) -> Validated:
    if field not in ALLOWED_FIELD_UPDATES:
        return Validated(False, reason="field_not_allowed")
    validator = VALIDATORS.get(field)
    if validator is None:
        return Validated(False, reason="no_validator")
    result = validator(raw_value, ctx)
    if not result.ok:
        return result
    if ctx.current_value is not None and _same_value(result.value, ctx.current_value):
        return Validated(False, reason="no_change")
    return result


def _same_value(new: Any, current: Any) -> bool:
    if isinstance(new, Decimal):
        try:
            return new == Decimal(str(current))
        except (InvalidOperation, ValueError):
            return False
    return str(new) == str(current)


def is_large_move(field: str, new_value: Any, current_value: Any) -> bool:
    if field not in _MONEY_FIELDS or current_value in (None, 0):
        return False
    try:
        current = Decimal(str(current_value))
        proposed = Decimal(str(new_value))
    except (InvalidOperation, ValueError):
        return False
    if current == 0:
        return False
    return abs(proposed - current) / abs(current) > LARGE_MOVE_RATIO


def allowed_field_enum() -> list[str]:
    return sorted(ALLOWED_FIELD_UPDATES)


def field_format_hints() -> str:
    return "\n".join([
        "- pipeline_stage: next adjacent stage only",
        f"- status: one of {', '.join(STATUSES)}",
        "- nda_status: Not Started | Sent | Signed",
        "- deal_size_m, hold_amount_m, ltm_revenue_m, ltm_ebitda_m: millions "
        '("12.5" or "12.5M")',
        '- ebitda_margin, oid_pct, sofr_floor_pct: percentage points ("28", not "0.28")',
        "- spread_bps: integer basis points",
        "- total_leverage, dscr, fccr, interest_coverage: decimal ratios",
        "- tenor_months: integer months",
        '- nda_date, target_close, maturity_date: ISO 8601 ("2026-09-30")',
        "- next_action, security: short text",
    ])


def coerce_field(field: str, raw_value: str) -> Any:
    """Re-parse a stored display/suggested string at approval time."""
    result = validate_field_update(
        field, raw_value, FieldContext(current_value=None, current_stage=None)
    )
    if not result.ok:
        # For pipeline_stage at approval, humans may skip with allow_skip —
        # still coerce enum membership.
        if field == "pipeline_stage" and (raw_value or "").strip() in PIPELINE_STAGES:
            return (raw_value or "").strip()
        if field == "status" and (raw_value or "").strip() in STATUSES:
            return (raw_value or "").strip()
        raise ValueError(result.reason or "invalid_value")
    return result.value
