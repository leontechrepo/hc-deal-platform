"""Admin endpoints for scan runs and cost visibility."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.db.graph_sync import MAX_CONSECUTIVE_FAILURES, is_parked, unpark
from app.db.models.graph_sync import GraphSyncState
from app.db.models.suggestions import EmailScanLog, LLMCall, ScanRun
from app.db.session import get_db

router = APIRouter(prefix="/api/admin", dependencies=[Depends(require_auth)])


@router.get("/scan-runs")
async def list_scan_runs(limit: int = 20, db: AsyncSession = Depends(get_db)):
    rows = list(
        (
            await db.execute(
                select(ScanRun).order_by(ScanRun.started_at.desc()).limit(min(limit, 100))
            )
        ).scalars().all()
    )
    return [
        {
            "id": str(r.id),
            "trigger": r.trigger,
            "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "messages_seen": r.messages_seen,
            "messages_classified": r.messages_classified,
            "messages_filtered": r.messages_filtered,
            "messages_deduped": r.messages_deduped,
            "suggestions_created": r.suggestions_created,
            "field_updates_proposed": r.field_updates_proposed,
            "field_updates_rejected": r.field_updates_rejected,
            "estimated_cost_usd": float(r.estimated_cost_usd or 0),
            "input_tokens": r.input_tokens,
            "output_tokens": r.output_tokens,
            "error_counts": r.error_counts,
            "error_message": r.error_message,
        }
        for r in rows
    ]


@router.get("/cost")
async def daily_cost(db: AsyncSession = Depends(get_db)):
    """24h spend from the LLM ledger, so classification and extraction both count."""
    since = datetime.now(timezone.utc) - timedelta(days=1)
    rows = (
        await db.execute(
            select(
                LLMCall.purpose,
                func.coalesce(func.sum(LLMCall.estimated_cost_usd), 0),
                func.count(),
            )
            .where(LLMCall.created_at > since)
            .group_by(LLMCall.purpose)
        )
    ).all()
    by_purpose = {
        purpose: {"estimated_cost_usd": float(Decimal(cost or 0)), "calls": calls}
        for purpose, cost, calls in rows
    }
    return {
        "window_hours": 24,
        "estimated_cost_usd": sum(v["estimated_cost_usd"] for v in by_purpose.values()),
        "by_purpose": by_purpose,
    }


def _sync_row(state: GraphSyncState) -> dict:
    return {
        "id": str(state.id),
        "user_email": state.user_email,
        "folder": state.folder,
        "mode": "resuming_page" if state.next_link else ("delta" if state.delta_link else "needs_seed"),
        "has_delta_link": bool(state.delta_link),
        "mid_sync": bool(state.next_link),
        "last_synced_at": state.last_synced_at.isoformat() if state.last_synced_at else None,
        "last_error": state.last_error,
        "consecutive_failures": state.consecutive_failures,
        "parked": is_parked(state),
        "parked_at": state.parked_at.isoformat() if state.parked_at else None,
        "max_failures": MAX_CONSECUTIVE_FAILURES,
        "resync_count": state.resync_count,
        "last_resync_at": state.last_resync_at.isoformat() if state.last_resync_at else None,
    }


@router.get("/sync-state")
async def list_sync_state(db: AsyncSession = Depends(get_db)):
    """Per mailbox/folder delta state plus claim backlog, for operators."""
    states = list(
        (await db.execute(select(GraphSyncState).order_by(GraphSyncState.user_email, GraphSyncState.folder)))
        .scalars().all()
    )
    backlog_rows = (
        await db.execute(
            select(EmailScanLog.action_taken, func.count())
            .where(EmailScanLog.action_taken.in_(("processing", "retry", "error")))
            .group_by(EmailScanLog.action_taken)
        )
    ).all()
    return {
        "folders": [_sync_row(s) for s in states],
        "claims": {action: count for action, count in backlog_rows},
    }


@router.post("/sync-state/{state_id}/unpark")
async def unpark_sync_state(
    state_id: str, resync: bool = False, db: AsyncSession = Depends(get_db)
):
    import uuid as _uuid

    try:
        key = _uuid.UUID(state_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Unknown sync state")
    state = await db.get(GraphSyncState, key)
    if state is None:
        raise HTTPException(status_code=404, detail="Unknown sync state")
    await unpark(db, state, resync=resync)
    await db.commit()
    return _sync_row(state)
