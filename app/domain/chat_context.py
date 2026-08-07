"""
Builds the system-prompt context for the Credit Co-Pilot chat (app/api/chat.py),
reusing the same "summarize real data into a system block" pattern as
app/automation/scanner.py's _build_system_prompt.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Deal, DealActivity, DealNote, Fund, Sponsor
from app.db.models.portfolio import PortfolioPosition
from app.db.models.timeline import DealTimelineTask, DealTimelineWorkstream

_MAX_DEALS_IN_CONTEXT = 50

_BASE_INSTRUCTIONS = """You are the Credit Co-Pilot for Leon Capital Group, a healthcare private credit firm. \
You are grounded in the firm's real deal, sponsor, fund, and portfolio data below — never invent figures that \
aren't present in this context. If asked about something not covered here, say so plainly rather than guessing. \
Keep answers concise (a few sentences) unless asked for detail.

Formatting. Your replies render as markdown in a narrow chat panel, so keep the structure light: short \
paragraphs, `-` bullets, `**bold**` on the decision-relevant figure, and GFM tables only for genuinely \
tabular data with three or more rows. Never use emoji — the brand does not use them; say "Behavioral Health", \
not an emoji plus the name. Skip `---` rules and `#`/`##` headings for a short answer; a bold lead-in reads \
better in a bubble this width. Voice is precise and institutional: lead with the number, abbreviate currency \
($33.1M), keep percentages and multiples exact (7.08%, 3.24x), and use bps for spreads."""


def _deal_line(d: Deal, sponsor_name: str | None, fund_name: str | None) -> str:
    parts = [
        f"ID {d.id}: {d.company_name}",
        f"stage={d.pipeline_stage}", f"status={d.status}", f"sector={d.sector_primary or '—'}",
    ]
    if d.deal_size_m is not None:
        parts.append(f"facility=${d.deal_size_m}M")
    if d.total_leverage is not None:
        parts.append(f"leverage={d.total_leverage}x")
    if d.all_in_rate is not None:
        parts.append(f"all_in_rate={d.all_in_rate}%")
    if d.dscr is not None:
        parts.append(f"dscr={d.dscr}x")
    if sponsor_name:
        parts.append(f"sponsor={sponsor_name}")
    if fund_name:
        parts.append(f"fund={fund_name}")
    return "- " + ", ".join(parts)


async def _deal_detail_block(db: AsyncSession, deal: Deal) -> str:
    sponsor_name = fund_name = None
    if deal.sponsor_id:
        sponsor_name = (await db.execute(select(Sponsor.name).where(Sponsor.id == deal.sponsor_id))).scalar_one_or_none()
    if deal.fund_id:
        fund_name = (await db.execute(select(Fund.name).where(Fund.id == deal.fund_id))).scalar_one_or_none()

    notes = (await db.execute(
        select(DealNote).where(DealNote.deal_id == deal.id).order_by(DealNote.created_at.desc()).limit(5)
    )).scalars().all()
    activity = (await db.execute(
        select(DealActivity).where(DealActivity.deal_id == deal.id).order_by(DealActivity.created_at.desc()).limit(10)
    )).scalars().all()
    workstreams = (await db.execute(
        select(DealTimelineWorkstream).where(DealTimelineWorkstream.deal_id == deal.id)
    )).scalars().all()
    tasks_summary = ""
    if workstreams:
        tasks = (await db.execute(
            select(DealTimelineTask).where(DealTimelineTask.workstream_id.in_([w.id for w in workstreams]))
        )).scalars().all()
        open_tasks = [t for t in tasks if t.status != "Complete"]
        tasks_summary = "\n".join(f"  - {t.name} ({t.status}, due {t.end_date})" for t in open_tasks[:10])

    lines = [
        "FOCUSED DEAL (the user is viewing this deal's page):",
        _deal_line(deal, sponsor_name, fund_name),
        f"  next_action: {deal.next_action or '—'}",
        f"  recent notes: " + ("; ".join(n.body for n in notes) or "none"),
        f"  recent activity: " + ("; ".join(a.description for a in activity) or "none"),
    ]
    if tasks_summary:
        lines.append("  open timeline tasks:\n" + tasks_summary)
    return "\n".join(lines)


async def build_chat_context(db: AsyncSession, deal_id: uuid.UUID | None = None) -> str:
    deal_rows = (await db.execute(
        select(Deal).where(Deal.status.notin_(["Passed", "Dead"])).order_by(Deal.updated_at.desc()).limit(_MAX_DEALS_IN_CONTEXT)
    )).scalars().all()

    sponsor_ids = {d.sponsor_id for d in deal_rows if d.sponsor_id}
    fund_ids = {d.fund_id for d in deal_rows if d.fund_id}
    sponsors_by_id = {}
    if sponsor_ids:
        for sp in (await db.execute(select(Sponsor).where(Sponsor.id.in_(sponsor_ids)))).scalars().all():
            sponsors_by_id[sp.id] = sp.name
    funds_by_id = {}
    if fund_ids:
        for f in (await db.execute(select(Fund).where(Fund.id.in_(fund_ids)))).scalars().all():
            funds_by_id[f.id] = f.name

    deal_lines = "\n".join(
        _deal_line(d, sponsors_by_id.get(d.sponsor_id), funds_by_id.get(d.fund_id)) for d in deal_rows
    )

    all_sponsors = (await db.execute(select(Sponsor))).scalars().all()
    sponsor_rollup = "\n".join(
        f"- {sp.name}: type={sp.sponsor_type or '—'}, aum=${sp.aum_m}M" if sp.aum_m else f"- {sp.name}"
        for sp in all_sponsors
    ) or "none tracked"

    all_funds = (await db.execute(select(Fund))).scalars().all()
    fund_rollup = "\n".join(
        f"- {f.name}: status={f.status or '—'}, "
        + (f"available=${f.available_capital_m}M" if f.available_capital_m is not None else "available=—")
        for f in all_funds
    ) or "none tracked"

    positions = (await db.execute(select(PortfolioPosition))).scalars().all()
    total_exposure = sum(float(p.current_balance_m or 0) for p in positions)
    watch_count = sum(1 for p in positions if p.risk == "Watch")
    portfolio_summary = f"{len(positions)} funded positions, ${total_exposure:.1f}M total exposure, {watch_count} on watch"

    blocks = [
        _BASE_INSTRUCTIONS,
        "",
        "ACTIVE/RELEVANT DEALS:",
        deal_lines or "none",
        "",
        "SPONSORS:",
        sponsor_rollup,
        "",
        "FUNDS:",
        fund_rollup,
        "",
        "PORTFOLIO SUMMARY:",
        portfolio_summary,
    ]

    if deal_id:
        deal_res = await db.execute(select(Deal).where(Deal.id == deal_id))
        deal = deal_res.scalar_one_or_none()
        if deal:
            blocks.append("")
            blocks.append(await _deal_detail_block(db, deal))

    return "\n".join(blocks)
