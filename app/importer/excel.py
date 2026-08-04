"""
Parse Corporate Credit Deal Pipeline Excel and upsert into PostgreSQL.

Usage:
    conda activate hc-deal-platform
    python -m app.importer.excel "data/LHP Private Credit - Deal Pipeline (2026.05.28).xlsx"
"""
from __future__ import annotations

import asyncio
import re
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

import openpyxl

from app.db.session import AsyncSessionLocal, init_db
from app.domain.pipeline_stage import derive_pipeline_stage


# Column indices (0-based) in the "Internal Pipeline" sheet
COL_NUM = 2
COL_COMPANY = 3
COL_LOCATION = 4
COL_STAGE = 5
COL_SECTOR_FULL = 6
COL_SECTOR_PRIMARY = 7
COL_SUBSECTOR = 8
COL_SIZE = 9
COL_SECURITY = 10
COL_UOP = 11
COL_SOURCE = 12
COL_TIMING = 14
COL_COMPETITION = 15
COL_NDA = 16
COL_DATAROOM = 17
COL_MGMT_MEETING = 18
COL_IOI_OFFERED = 19
COL_IOI_SIGNED = 20
COL_TARGET_CLOSE = 21
COL_COMMENTARY = 22
COL_LTM_REVENUE = 25
COL_LTM_EBITDA = 26
COL_EBITDA_MARGIN = 27
COL_UPFRONT = 28
COL_DDTL = 29
COL_TOTAL_FUNDED = 30
COL_CASH_INT = 34
COL_PIK_INT = 35
COL_TOTAL_INT = 36
COL_REASONS = 38

SECTION_HEADERS = {
    "Closed",
    "Active - Diligence",
    "Active - Discussions",
    "Dead / Hold",
}
SKIP_PREFIXES = ("Total -", "Copy Paste")


def _str(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _date(v: Any) -> date | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    return None


def _extract_last_updated(commentary: str | None) -> date | None:
    """Pull the most recent YYYY/MM/DD date from the commentary log."""
    if not commentary:
        return None
    matches = re.findall(r"(\d{4}/\d{2}/\d{2})", commentary)
    if not matches:
        return None
    try:
        return datetime.strptime(sorted(matches)[-1], "%Y/%m/%d").date()
    except ValueError:
        return None


def _bucket_from_header(header: str) -> str:
    mapping = {
        "Closed": "Closed",
        "Active - Diligence": "Active-Diligence",
        "Active - Discussions": "Active-Discussions",
        "Dead / Hold": "Dead-Hold",
    }
    return mapping.get(header, header)


def parse_excel(path: str | Path) -> list[dict]:
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    ws = wb["Internal Pipeline"]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    deals: list[dict] = []
    current_bucket = None

    for row in rows:
        if len(row) <= COL_COMPANY:
            continue
        cell_num = row[COL_NUM] if len(row) > COL_NUM else None
        cell_company = row[COL_COMPANY] if len(row) > COL_COMPANY else None

        # Section header detection
        if isinstance(cell_num, str):
            header = cell_num.strip()
            if header in SECTION_HEADERS:
                current_bucket = _bucket_from_header(header)
            continue

        # Skip total/annotation rows
        if not isinstance(cell_num, (int, float)):
            continue
        if not isinstance(cell_company, str) or not cell_company.strip():
            continue
        if any(cell_company.startswith(p) for p in SKIP_PREFIXES):
            continue

        def col(idx: int) -> Any:
            return row[idx] if len(row) > idx else None

        commentary = _str(col(COL_COMMENTARY))
        deal = {
            "company_name": cell_company.strip(),
            "location": _str(col(COL_LOCATION)),
            "bucket": current_bucket,
            "stage": _str(col(COL_STAGE)),
            "sector_full": _str(col(COL_SECTOR_FULL)),
            "sector_primary": _str(col(COL_SECTOR_PRIMARY)),
            "subsector": _str(col(COL_SUBSECTOR)),
            "deal_size_m": _float(col(COL_SIZE)),
            "security": _str(col(COL_SECURITY)),
            "uop": _str(col(COL_UOP)),
            "source": _str(col(COL_SOURCE)),
            "timing_qtr": _str(col(COL_TIMING)),
            "competition": _str(col(COL_COMPETITION)),
            "nda": _str(col(COL_NDA)),
            "dataroom": _str(col(COL_DATAROOM)),
            "mgmt_meeting": _str(col(COL_MGMT_MEETING)),
            "ioi_offered": _str(col(COL_IOI_OFFERED)),
            "ioi_signed": _str(col(COL_IOI_SIGNED)),
            "target_close": _date(col(COL_TARGET_CLOSE)),
            "commentary": commentary,
            "last_updated": _extract_last_updated(commentary) or _date(col(COL_TARGET_CLOSE)),
            "ltm_revenue_m": _float(col(COL_LTM_REVENUE)),
            "ltm_ebitda_m": _float(col(COL_LTM_EBITDA)),
            "ebitda_margin": _float(col(COL_EBITDA_MARGIN)),
            "committed_upfront_m": _float(col(COL_UPFRONT)),
            "committed_ddtl_m": _float(col(COL_DDTL)),
            "total_funded_m": _float(col(COL_TOTAL_FUNDED)),
            "cash_int_pct": _float(col(COL_CASH_INT)),
            "pik_int_pct": _float(col(COL_PIK_INT)),
            "total_int_pct": _float(col(COL_TOTAL_INT)),
            "reasons_for_passing": _str(col(COL_REASONS)),
            "updated_by": "excel_import",
        }
        deals.append(deal)

    return deals


async def _upsert(deals: list[dict]) -> None:
    from sqlalchemy import text

    await init_db()

    async with AsyncSessionLocal() as session:
        for d in deals:
            result = await session.execute(
                text("SELECT id FROM deals WHERE company_name = :name"),
                {"name": d["company_name"]},
            )
            row = result.fetchone()
            if row:
                # Update all fields except created_at
                await session.execute(
                    text("""
                        UPDATE deals SET
                            location=:location, stage=:stage,
                            sector_full=:sector_full, sector_primary=:sector_primary,
                            subsector=:subsector, deal_size_m=:deal_size_m,
                            security=:security, uop=:uop, source=:source,
                            timing_qtr=:timing_qtr, competition=:competition,
                            nda=:nda, dataroom=:dataroom, mgmt_meeting=:mgmt_meeting,
                            ioi_offered=:ioi_offered, ioi_signed=:ioi_signed,
                            target_close=:target_close, commentary=:commentary,
                            last_updated=:last_updated,
                            ltm_revenue_m=:ltm_revenue_m, ltm_ebitda_m=:ltm_ebitda_m,
                            ebitda_margin=:ebitda_margin,
                            committed_upfront_m=:committed_upfront_m,
                            committed_ddtl_m=:committed_ddtl_m,
                            total_funded_m=:total_funded_m,
                            cash_int_pct=:cash_int_pct, pik_int_pct=:pik_int_pct,
                            total_int_pct=:total_int_pct,
                            reasons_for_passing=:reasons_for_passing,
                            updated_by=:updated_by, updated_at=NOW()
                        WHERE id=:id
                    """),
                    {**d, "id": row[0]},
                )
            else:
                # New deal (not yet touched by the granular pipeline_stage UI) —
                # derive its initial pipeline_stage/status from the legacy
                # bucket/stage/milestone fields, same as the migration 004
                # backfill. Existing deals are NOT re-derived on UPDATE above:
                # once a deal is being tracked in the new UI, pipeline_stage is
                # advanced manually there and must not be regressed by a stale
                # Excel re-import that has no visibility into the finer stages
                # (post_loi_diligence / ic_approval / documentation).
                pipeline_stage, status = derive_pipeline_stage(
                    d["bucket"], d["stage"], d["nda"], d["dataroom"],
                    d["mgmt_meeting"], d["ioi_offered"], d["ioi_signed"],
                )
                await session.execute(
                    text("""
                        INSERT INTO deals (
                            company_name, location, bucket, stage,
                            sector_full, sector_primary, subsector,
                            deal_size_m, security, uop, source,
                            timing_qtr, competition, nda, dataroom,
                            mgmt_meeting, ioi_offered, ioi_signed, target_close,
                            commentary, last_updated,
                            ltm_revenue_m, ltm_ebitda_m, ebitda_margin,
                            committed_upfront_m, committed_ddtl_m, total_funded_m,
                            cash_int_pct, pik_int_pct, total_int_pct,
                            reasons_for_passing, updated_by,
                            pipeline_stage, status
                        ) VALUES (
                            :company_name, :location, :bucket, :stage,
                            :sector_full, :sector_primary, :subsector,
                            :deal_size_m, :security, :uop, :source,
                            :timing_qtr, :competition, :nda, :dataroom,
                            :mgmt_meeting, :ioi_offered, :ioi_signed, :target_close,
                            :commentary, :last_updated,
                            :ltm_revenue_m, :ltm_ebitda_m, :ebitda_margin,
                            :committed_upfront_m, :committed_ddtl_m, :total_funded_m,
                            :cash_int_pct, :pik_int_pct, :total_int_pct,
                            :reasons_for_passing, :updated_by,
                            :pipeline_stage, :status
                        )
                    """),
                    {**d, "pipeline_stage": pipeline_stage, "status": status},
                )
        await session.commit()


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python -m app.importer.excel <path-to-excel>")
        sys.exit(1)
    path = Path(sys.argv[1])
    if not path.exists():
        print(f"File not found: {path}")
        sys.exit(1)

    print(f"Parsing {path.name}...")
    deals = parse_excel(path)
    print(f"Found {len(deals)} deals. Upserting into database...")
    asyncio.run(_upsert(deals))
    print(f"Done. {len(deals)} deals loaded.")


if __name__ == "__main__":
    main()
