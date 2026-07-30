"""
The 11-stage pipeline funnel and derivation of (pipeline_stage, status) from the
legacy Excel-era fields (bucket, stage, nda, dataroom, mgmt_meeting, ioi_offered,
ioi_signed).

This is the single source of truth for the mapping — used by migration
004_pipeline_stage.py (one-time backfill), app/importer/excel.py (every
re-import), and any future deal-creation path that only has legacy fields to
work from.
"""
from __future__ import annotations

PIPELINE_STAGES: list[str] = [
    "sourcing",
    "intake_triage",
    "nda_execution",
    "screening",
    "pre_loi_diligence",
    "loi_negotiation",
    "loi_signed",
    "post_loi_diligence",
    "ic_approval",
    "documentation",
    "portfolio_monitoring",
]

STAGE_INDEX: dict[str, int] = {stage: i for i, stage in enumerate(PIPELINE_STAGES)}

STATUSES: list[str] = ["Active", "On Hold", "Passed", "Dead", "Closed"]

# Underwriting fields become read-only once a deal reaches this stage or later.
UNDERWRITING_LOCK_STAGE = "loi_signed"

# Deal fields that drive the credit model — locked from further PATCH edits
# once a deal reaches UNDERWRITING_LOCK_STAGE or later (enforced server-side in
# app/api/deals.py, mirroring the frontend's read-only Underwriting tab rule).
UNDERWRITING_FIELDS: frozenset[str] = frozenset({
    "deal_size_m", "hold_amount_m", "security",
    "total_leverage", "spread_bps", "base_rate", "sofr_rate", "all_in_rate",
    "tenor_months", "amortization", "oid_pct", "sofr_floor_pct",
    "call_protection", "maturity_date",
    "ltm_revenue_m", "ltm_ebitda_m", "ebitda_margin",
    "revenue_growth_pct", "ebitda_growth_pct", "capex_m", "fcf_m",
    "dscr", "fccr", "interest_coverage",
    "max_leverage_covenant", "min_fccr_covenant", "capex_limit_covenant_m",
})


def stage_index(pipeline_stage: str | None) -> int:
    """Position of a stage in the funnel, or -1 if unknown/None."""
    if pipeline_stage is None:
        return -1
    return STAGE_INDEX.get(pipeline_stage, -1)


def is_underwriting_locked(pipeline_stage: str | None) -> bool:
    """True once a deal has reached loi_signed or any later stage."""
    idx = stage_index(pipeline_stage)
    return idx >= STAGE_INDEX[UNDERWRITING_LOCK_STAGE]


def _is_done(value: str | None) -> bool:
    return (value or "").strip().upper() == "P"


def _derive_status(bucket: str | None, stage: str | None) -> str:
    b = (bucket or "").strip()
    s = (stage or "").strip().lower()

    if b == "Closed":
        return "Closed"
    if b == "Dead-Hold":
        if "pass" in s:
            return "Passed"
        if "hold" in s:
            return "On Hold"
        # Ambiguous — no clear "hold" vs "pass" signal in the legacy stage text.
        # Defaults to Passed; flagged for manual post-backfill audit.
        return "Passed"
    # Active-Diligence / Active-Discussions / unrecognized bucket
    return "Active"


def _derive_stage_from_milestones(
    bucket: str | None,
    stage: str | None,
    nda: str | None,
    dataroom: str | None,
    mgmt_meeting: str | None,
    ioi_offered: str | None,
    ioi_signed: str | None,
) -> str:
    if (bucket or "").strip() == "Closed":
        return "portfolio_monitoring"

    legacy_stage = (stage or "").strip().lower()

    # Ladder — highest attained milestone wins. Ambiguous: ioi_signed=='P' can't
    # be distinguished between loi_signed / post_loi_diligence / ic_approval /
    # documentation with only legacy fields — defaults to loi_signed, flagged
    # for manual triage post-backfill.
    if _is_done(ioi_signed):
        return "loi_signed"
    if _is_done(ioi_offered):
        return "loi_negotiation"
    if legacy_stage == "pre-loi diligence" or _is_done(mgmt_meeting):
        return "pre_loi_diligence"
    if _is_done(dataroom):
        return "pre_loi_diligence"
    if _is_done(nda):
        return "screening"
    # No milestones set — sourcing/nda_execution are never distinguishable from
    # the legacy data and so are never backfilled into; only populated going
    # forward for genuinely new deals.
    return "intake_triage"


def derive_pipeline_stage(
    bucket: str | None,
    stage: str | None,
    nda: str | None,
    dataroom: str | None,
    mgmt_meeting: str | None,
    ioi_offered: str | None,
    ioi_signed: str | None,
) -> tuple[str, str]:
    """Derive (pipeline_stage, status) from the legacy bucket/stage/milestone fields."""
    pipeline_stage = _derive_stage_from_milestones(
        bucket, stage, nda, dataroom, mgmt_meeting, ioi_offered, ioi_signed
    )
    status = _derive_status(bucket, stage)
    return pipeline_stage, status
