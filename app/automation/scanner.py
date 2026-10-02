"""The scan loop: Graph delta → prefilter → classifier → review queue.

Hardened relative to the prior HC scanner:
* Per-message commit and claim-before-classify
* Advisory lock across replicas
* Delta watermarks instead of sliding time windows
* Cross-mailbox internet_message_id dedupe
* Structured classification with server-side validation
"""
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession

from app.automation.budget import BudgetExceeded, ScanBudget
from app.automation.classifier import (
    ClassificationResult,
    DealSearcher,
    LLMCallRecord,
    classify_email,
)
from app.automation.dedupe import new_deal_discriminator, suggestion_dedupe_key
from app.core.config import settings
from app.db.deal_search import search_deals_by_company
from app.db.graph_sync import (
    advance_watermark,
    get_or_create_sync_state,
    is_parked,
    record_failure,
    reset_for_resync,
)
from app.db.models.deals import Deal
from app.db.models.sponsors import Sponsor
from app.db.models.suggestions import (
    EmailScanLog,
    LLMCall,
    PendingSuggestion,
    PendingSuggestionEmailLog,
    ScanRun,
)
from app.domain.email_text import email_domain, prepare_email_text, sender_address, sender_name
from app.domain.field_updates import FieldContext, is_large_move, validate_field_update
from app.domain.prefilter import is_low_value
from app.graph.http import DeltaTokenExpired, GraphError
from app.graph.mail import fetch_delta_page, fetch_message, initial_delta_url

logger = logging.getLogger(__name__)

# 'HCCS' as int — stable across deploys.
SCAN_LOCK_KEY = 0x48434353
SEED_WINDOW_DAYS = 7
MAX_CLAIM_RETRIES = 3


@dataclass
class ScanOutcome:
    run_id: uuid.UUID | None
    status: str
    messages_seen: int = 0
    messages_classified: int = 0
    suggestions_created: int = 0
    estimated_cost_usd: Decimal = Decimal("0")

    def __int__(self) -> int:
        """Back-compat for callers that treated run_scan as returning a count."""
        return self.messages_classified


class _DbSearcher(DealSearcher):
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def by_company(self, query: str):
        return await search_deals_by_company(self._db, query)


class ScanLock:
    """Cross-replica scan lock held on its own connection.

    pg_advisory_lock is session-scoped. The scan commits constantly on its
    AsyncSession and may be handed a different pooled connection after any
    commit, so locking through that session can leave the lock stranded on one
    connection and fail to unlock on another. Holding it on a dedicated
    connection for the whole run makes acquire/release unambiguous.
    """

    def __init__(self, bind: Any) -> None:
        self._bind = bind
        self._conn: AsyncConnection | None = None

    async def acquire(self) -> bool:
        conn = await self._bind.connect()
        try:
            got = bool(
                (await conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": SCAN_LOCK_KEY})).scalar()
            )
            await conn.commit()
        except Exception:
            await conn.close()
            raise
        if not got:
            await conn.close()
            return False
        self._conn = conn
        return True

    async def release(self) -> None:
        conn, self._conn = self._conn, None
        if conn is None:
            return
        try:
            await conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": SCAN_LOCK_KEY})
            await conn.commit()
        except Exception:  # noqa: BLE001
            logger.exception("Advisory unlock failed; discarding the lock connection")
            await conn.invalidate()  # closing the socket drops the session lock
        finally:
            await conn.close()


async def recover_stale_claims(db: AsyncSession, *, current_run_id: uuid.UUID | None = None) -> int:
    """Re-queue claims left in 'processing' by an interrupted worker.

    Called only while holding the scan lock, so no other worker can legitimately
    own a 'processing' row from a different run — every such row is orphaned
    and is marked 'retry' immediately rather than after a timeout. Rows that
    keep dying are parked as 'error' after MAX_CLAIM_RETRIES.
    """
    stmt = select(EmailScanLog).where(EmailScanLog.action_taken == "processing")
    if current_run_id is not None:
        stmt = stmt.where(EmailScanLog.scan_run_id.is_distinct_from(current_run_id))
    rows = list((await db.execute(stmt)).scalars().all())
    for row in rows:
        row.retry_count = (row.retry_count or 0) + 1
        if row.retry_count > MAX_CLAIM_RETRIES:
            row.action_taken = "error"
            row.error = f"abandoned after {MAX_CLAIM_RETRIES} interrupted attempts"
        else:
            row.action_taken = "retry"
    if rows:
        await db.commit()
        logger.warning("Re-queued %d orphaned processing claims", len(rows))
    return len(rows)


async def _redrive_retry_claims(
    db: AsyncSession, run: ScanRun, *, budget: ScanBudget, client: Any
) -> None:
    """Re-fetch and process claims marked 'retry' whose message won't be redelivered."""
    rows = list(
        (
            await db.execute(
                select(EmailScanLog).where(EmailScanLog.action_taken == "retry")
            )
        ).scalars().all()
    )
    for log in rows:
        try:
            message = await fetch_message(
                client, user_email=log.user_email, message_id=log.graph_message_id
            )
        except Exception as exc:  # noqa: BLE001 - leave it 'retry' for the next run
            logger.warning("Re-fetch of %s failed: %s", log.graph_message_id, exc)
            log.error = str(exc)[:500]
            await db.commit()
            continue
        if message is None:
            log.action_taken = "source_removed"
            log.source_removed_at = datetime.now(timezone.utc)
            await db.commit()
            continue
        log.action_taken = "processing"
        log.scan_run_id = run.id
        await db.commit()
        await _process_claimed(db, run, log, message, user=log.user_email, budget=budget, client=client)


async def _prior_day_cost(db: AsyncSession) -> Decimal:
    total = (
        await db.execute(
            select(func.coalesce(func.sum(LLMCall.estimated_cost_usd), 0)).where(
                LLMCall.created_at > datetime.now(timezone.utc) - timedelta(days=1)
            )
        )
    ).scalar_one()
    return Decimal(total or 0)


async def run_scan(
    db: AsyncSession,
    *,
    trigger: str = "scheduler",
    budget: ScanBudget | None = None,
    client: Any | None = None,
    users: list[str] | None = None,
    folders: list[str] | None = None,
    backfill_days: int | None = None,
) -> ScanOutcome:
    """Run one scan.

    ``users``/``folders`` narrow the run to a subset of the configured mailboxes
    (they cannot add mailboxes). ``backfill_days`` walks an independent delta
    query from that many days ago *without* reading or advancing the stored
    watermark, so the live sync is untouched; the per-message claims make a
    re-run cheap and idempotent.
    """
    configured = settings.monitored_users
    users = [u for u in (users or configured) if u in configured]
    folders = folders or settings.graph_folders
    if not users:
        logger.info("No monitored mailboxes configured; nothing to scan")
        return ScanOutcome(run_id=None, status="completed")

    if not settings.AZURE_CLIENT_ID or not settings.ANTHROPIC_API_KEY:
        return ScanOutcome(run_id=None, status="completed")

    from app.db import session as db_session_module

    lock = ScanLock(db.bind or db_session_module.engine)
    if not await lock.acquire():
        logger.info("Another scan holds the lock; skipping this run")
        return ScanOutcome(run_id=None, status="skipped_locked")

    try:
        run = ScanRun(trigger=trigger, users_scanned=users)
        db.add(run)
        await db.flush()
        await db.commit()

        await recover_stale_claims(db, current_run_id=run.id)

        budget = budget or ScanBudget()
        budget.prior_day_cost_usd = await _prior_day_cost(db)
        owns_client = client is None
        client = client or httpx.AsyncClient(timeout=90.0)

        try:
            await _redrive_retry_claims(db, run, budget=budget, client=client)
            await _retry_failed_attachments(db, client=client)
            for user in users:
                for folder in folders:
                    try:
                        await _scan_folder(
                            db, run, user=user, folder=folder, budget=budget,
                            client=client, backfill_days=backfill_days,
                        )
                    except (GraphError, DeltaTokenExpired) as exc:
                        logger.exception("Graph failure on %s/%s", user, folder)
                        run.error_message = str(exc)[:1000]
            run.status = "completed"
        except BudgetExceeded as exc:
            logger.warning("Scan stopped early: %s", exc)
            run.status = "budget_exceeded"
        except Exception as exc:  # noqa: BLE001
            logger.exception("Scan failed")
            await db.rollback()
            run.status = "failed"
            run.error_message = str(exc)[:1000]
        finally:
            if owns_client:
                await client.aclose()

        await _finish(db, run)
        return _outcome(run)
    finally:
        await lock.release()


def _outcome(run: ScanRun) -> ScanOutcome:
    return ScanOutcome(
        run_id=run.id,
        status=run.status,
        messages_seen=run.messages_seen,
        messages_classified=run.messages_classified,
        suggestions_created=run.suggestions_created,
        estimated_cost_usd=Decimal(run.estimated_cost_usd or 0),
    )


async def _finish(db: AsyncSession, run: ScanRun) -> None:
    run.finished_at = datetime.now(timezone.utc)
    await db.flush()
    await db.commit()


async def _scan_folder(
    db: AsyncSession,
    run: ScanRun,
    *,
    user: str,
    folder: str,
    budget: ScanBudget,
    client: Any,
    backfill_days: int | None = None,
) -> None:
    if backfill_days is not None:
        await _backfill_folder(
            db, run, user=user, folder=folder, days=backfill_days, budget=budget, client=client
        )
        return

    state = await get_or_create_sync_state(db, user_email=user, folder=folder)
    await db.commit()

    if is_parked(state):
        logger.error(
            "Skipping %s/%s — parked after %d consecutive failures",
            user, folder, state.consecutive_failures,
        )
        return

    url = state.resume_url or initial_delta_url(
        user, folder,
        since=datetime.now(timezone.utc) - timedelta(days=SEED_WINDOW_DAYS),
    )

    while url:
        try:
            page = await fetch_delta_page(client, url=url)
        except DeltaTokenExpired:
            await reset_for_resync(db, state, reason="delta token expired")
            await db.commit()
            return
        except GraphError as exc:
            await record_failure(db, state, error=str(exc))
            await db.commit()
            raise

        run.graph_requests += 1
        await _mark_removed(db, user=user, graph_ids=page.removed_ids)
        for message in page.messages:
            await _process_message(
                db, run, message, user=user, folder=folder, budget=budget, client=client
            )

        await advance_watermark(
            db, state, next_link=page.next_link, delta_link=page.delta_link
        )
        await db.flush()
        await db.commit()
        url = page.next_link


async def _backfill_folder(
    db: AsyncSession,
    run: ScanRun,
    *,
    user: str,
    folder: str,
    days: int,
    budget: ScanBudget,
    client: Any,
) -> None:
    url: str | None = initial_delta_url(
        user, folder, since=datetime.now(timezone.utc) - timedelta(days=days)
    )
    while url:
        page = await fetch_delta_page(client, url=url)
        run.graph_requests += 1
        for message in page.messages:
            await _process_message(
                db, run, message, user=user, folder=folder, budget=budget, client=client
            )
        await db.commit()
        url = page.next_link


async def _mark_removed(db: AsyncSession, *, user: str, graph_ids: list[str]) -> None:
    """Graph reported these messages deleted/moved: stamp the log so the UI can say so.

    Suggestions are left pending (a reviewer may still act on the evidence); the
    email log's source_removed_at is what the inbox API surfaces.
    """
    if not graph_ids:
        return
    await db.execute(
        update(EmailScanLog)
        .where(
            EmailScanLog.user_email == user,
            EmailScanLog.graph_message_id.in_(graph_ids),
            EmailScanLog.source_removed_at.is_(None),
        )
        .values(source_removed_at=datetime.now(timezone.utc))
    )
    await db.commit()


def _parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


async def _process_message(
    db: AsyncSession,
    run: ScanRun,
    message: dict[str, Any],
    *,
    user: str,
    folder: str,
    budget: ScanBudget,
    client: Any,
) -> None:
    run.messages_seen += 1
    budget.record_message()

    graph_id = message.get("id")
    if not graph_id:
        return

    subject = message.get("subject")
    sender = sender_address(message)

    log = EmailScanLog(
        scan_run_id=run.id,
        user_email=user,
        folder=folder,
        graph_message_id=graph_id,
        internet_message_id=message.get("internetMessageId"),
        thread_id=message.get("conversationId"),
        subject=subject,
        sender_address=sender,
        sender_domain=email_domain(sender),
        sender_name=sender_name(message),
        received_at=_parse_ts(message.get("receivedDateTime")),
        has_attachments=bool(message.get("hasAttachments")),
        change_key=message.get("changeKey"),
        action_taken="processing",
    )
    try:
        async with db.begin_nested():
            db.add(log)
            await db.flush()
    except IntegrityError:
        # Someone claimed this message already. Under the scan lock the only
        # 'processing' rows from other runs are orphans from a crashed worker,
        # so take them over instead of treating redelivery as a duplicate.
        existing = (
            await db.execute(
                select(EmailScanLog).where(
                    EmailScanLog.user_email == user,
                    EmailScanLog.graph_message_id == graph_id,
                )
            )
        ).scalar_one()
        orphaned = existing.action_taken in ("retry",) or (
            existing.action_taken == "processing" and existing.scan_run_id != run.id
        )
        if not orphaned:
            run.messages_deduped += 1
            return
        existing.retry_count = (existing.retry_count or 0) + 1
        if existing.retry_count > MAX_CLAIM_RETRIES:
            existing.action_taken = "error"
            existing.error = f"abandoned after {MAX_CLAIM_RETRIES} interrupted attempts"
            await db.commit()
            return
        existing.action_taken = "processing"
        existing.scan_run_id = run.id
        existing.change_key = message.get("changeKey")
        log = existing

    await db.commit()
    await _process_claimed(db, run, log, message, user=user, budget=budget, client=client)


async def _process_claimed(
    db: AsyncSession,
    run: ScanRun,
    log: EmailScanLog,
    message: dict[str, Any],
    *,
    user: str,
    budget: ScanBudget,
    client: Any,
) -> None:
    """Run a claimed message to a terminal state; unexpected failures requeue it."""
    log_id = log.id
    try:
        await _classify_and_queue(db, run, log, message, user=user, budget=budget, client=client)
    except BudgetExceeded:
        raise
    except Exception as exc:  # noqa: BLE001 - one poison message must not stop the scan
        logger.exception("Message %s failed; requeueing claim", log_id)
        await db.rollback()
        await db.refresh(run)  # rollback expires it; later counters would lazy-load
        row = await db.get(EmailScanLog, log_id)
        if row is not None:
            row.retry_count = (row.retry_count or 0) + 1
            row.error = str(exc)[:500]
            row.action_taken = "error" if row.retry_count > MAX_CLAIM_RETRIES else "retry"
            await db.commit()


async def _classify_and_queue(
    db: AsyncSession,
    run: ScanRun,
    log: EmailScanLog,
    message: dict[str, Any],
    *,
    user: str,
    budget: ScanBudget,
    client: Any,
) -> None:
    subject = log.subject
    sender = log.sender_address

    verdict = is_low_value(subject, sender)
    if verdict.skip:
        log.action_taken = "filtered"
        log.error = verdict.reason
        run.messages_filtered += 1
        await db.commit()
        return

    if await _seen_in_other_mailbox(db, log):
        log.action_taken = "duplicate_across_mailbox"
        run.messages_deduped += 1
        await db.commit()
        return

    prepared = prepare_email_text(message)
    log.body_snippet = prepared.snippet[:500] if prepared.snippet else None
    log.body_source = prepared.source
    log.prepared_chars = prepared.prepared_chars

    try:
        budget.check()
    except BudgetExceeded:
        await db.delete(log)
        await db.commit()
        raise

    result, calls = await classify_email(
        prepared.text, searcher=_DbSearcher(db), received_at=log.received_at
    )
    _record_calls(db, run, log, calls)
    budget.record_calls(len(calls), Decimal(result.cost_usd or 0))
    run.messages_classified += 1

    log.claude_summary = result.reasoning or None
    if result.error:
        log.action_taken = "error"
        log.error = result.error
        await db.commit()
        return

    if not result.is_confident or result.outcome == "no_match":
        log.action_taken = "no_match"
        await db.commit()
        return

    if result.outcome == "matched":
        await _queue_matched(db, run, log, result)
    elif result.outcome == "new_deal":
        await _queue_new_deal(db, run, log, result)

    await db.commit()

    if settings.ATTACHMENT_INGESTION_ENABLED and log.has_attachments:
        await _ingest_for_log(db, log, message, user=user, client=client)


async def _ingest_for_log(
    db: AsyncSession, log: EmailScanLog, message: dict[str, Any] | None, *, user: str, client: Any
) -> None:
    """Ingest attachments; a failure is recorded on the log and retried next scan."""
    from app.automation.attachments import ingest_attachments_for_log

    try:
        await ingest_attachments_for_log(db, log, message, client=client, user=user)
        await db.commit()
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        logger.warning("Attachment ingest failed for %s: %s", log.id, exc)
        log.attachment_summary = [
            {"disposition": "failed", "reason": f"list_failed: {str(exc)[:160]}",
             "attempts": 1 + max(
                 (e.get("attempts") or 0 for e in (log.attachment_summary or [])), default=0)}
        ]
        await db.commit()
        return
    await _file_documents_for_already_approved(log.id, log.subject)


async def _retry_failed_attachments(
    db: AsyncSession, *, client: Any, limit: int = 50
) -> None:
    from app.automation.attachments import has_retryable_failures

    if not settings.ATTACHMENT_INGESTION_ENABLED:
        return
    candidates = list(
        (
            await db.execute(
                select(EmailScanLog)
                .where(
                    EmailScanLog.has_attachments.is_(True),
                    EmailScanLog.attachment_summary.is_not(None),
                    EmailScanLog.action_taken.in_(("queued_for_review", "new_deal_detected")),
                )
                .order_by(EmailScanLog.processed_at.desc())
                .limit(500)
            )
        ).scalars().all()
    )
    pending = [c for c in candidates if has_retryable_failures(c.attachment_summary)][:limit]
    for log in pending:
        await _ingest_for_log(db, log, None, user=log.user_email, client=client)


async def _file_documents_for_already_approved(log_id: int, subject: str | None) -> None:
    from app.db.session import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            from app.db.documents import file_documents_for_approved_email
            outcome = await file_documents_for_approved_email(session, log_id)
            if outcome.changed:
                await session.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not file attachments for already-approved %r: %s", subject, exc)


async def _seen_in_other_mailbox(db: AsyncSession, log: EmailScanLog) -> bool:
    if not log.internet_message_id:
        return False
    existing = (
        await db.execute(
            select(EmailScanLog.id).where(
                EmailScanLog.internet_message_id == log.internet_message_id,
                EmailScanLog.id != log.id,
                EmailScanLog.action_taken.in_(
                    ("queued_for_review", "new_deal_detected", "no_match")
                ),
            ).limit(1)
        )
    ).scalar_one_or_none()
    return existing is not None


def _record_calls(
    db: AsyncSession, run: ScanRun, log: EmailScanLog, calls: list[LLMCallRecord]
) -> None:
    for call in calls:
        db.add(
            LLMCall(
                scan_run_id=run.id,
                email_scan_log_id=log.id,
                purpose="classify_body",
                model=call.model,
                tool_round=call.tool_round,
                input_tokens=call.usage.input_tokens,
                output_tokens=call.usage.output_tokens,
                cache_read_tokens=call.usage.cache_read_tokens,
                cache_write_tokens=call.usage.cache_write_tokens,
                estimated_cost_usd=call.cost_usd,
                latency_ms=call.latency_ms,
                stop_reason=call.stop_reason,
                request_id=call.request_id,
                error=call.error,
            )
        )
        run.input_tokens += call.usage.input_tokens
        run.output_tokens += call.usage.output_tokens
        run.cache_read_tokens += call.usage.cache_read_tokens
        run.cache_write_tokens += call.usage.cache_write_tokens
        run.estimated_cost_usd = Decimal(run.estimated_cost_usd or 0) + Decimal(
            call.cost_usd or 0
        )


async def _queue_matched(
    db: AsyncSession,
    run: ScanRun,
    log: EmailScanLog,
    result: ClassificationResult,
) -> None:
    if result.matched_candidate is None:
        log.action_taken = "no_match"
        return
    deal = (
        await db.execute(select(Deal).where(Deal.id == result.matched_candidate.deal_id))
    ).scalar_one_or_none()
    if deal is None:
        log.action_taken = "no_match"
        return

    log.matched_deal_id = deal.id
    log.action_taken = "queued_for_review"

    if result.commentary:
        ts = datetime.now(timezone.utc).strftime("%Y/%m/%d")
        await _upsert(
            db, run, log,
            deal_id=deal.id,
            kind="commentary",
            field="commentary",
            suggested_value=f"{ts}: [Auto] {result.commentary}",
            evidence=None,
            confidence=result.confidence,
            current_value=deal.commentary,
            email_snippet=log.body_snippet,
        )

    ctx_base = dict(
        current_stage=deal.pipeline_stage,
        current_status=deal.status,
        email_received_at=log.received_at,
    )
    for proposal in result.field_updates:
        field_name = proposal.get("field", "")
        raw_value = proposal.get("value", "")
        evidence = (proposal.get("evidence") or "").strip()
        run.field_updates_proposed += 1

        if not evidence:
            _count_rejection(run, "missing_evidence")
            continue

        current = getattr(deal, field_name, None)
        validated = validate_field_update(
            field_name, raw_value, FieldContext(current_value=current, **ctx_base)
        )
        if not validated.ok:
            _count_rejection(run, validated.reason or "unknown")
            continue

        await _upsert(
            db, run, log,
            deal_id=deal.id,
            kind="field_update",
            field=field_name,
            suggested_value=validated.display,
            current_value=None if current is None else str(current),
            evidence=evidence,
            confidence=result.confidence,
            requires_attention=is_large_move(field_name, validated.value, current),
            email_snippet=log.body_snippet,
        )

    # Best-effort sponsor suggestion from sender domain.
    if not deal.sponsor_id and log.sender_domain:
        sponsor = (
            await db.execute(
                select(Sponsor).where(Sponsor.email_domain == log.sender_domain)
            )
        ).scalar_one_or_none()
        if sponsor:
            await _upsert(
                db, run, log,
                deal_id=deal.id,
                kind="field_update",
                field="sponsor_id",
                suggested_value=str(sponsor.id),
                evidence=f"Sender domain {log.sender_domain} matches sponsor {sponsor.name}",
                confidence=0.7,
                email_snippet=log.body_snippet,
            )


def _count_rejection(run: ScanRun, reason: str) -> None:
    run.field_updates_rejected += 1
    counts = dict(run.error_counts or {})
    counts[reason] = counts.get(reason, 0) + 1
    run.error_counts = counts


async def _queue_new_deal(
    db: AsyncSession,
    run: ScanRun,
    log: EmailScanLog,
    result: ClassificationResult,
) -> None:
    payload = result.new_deal or {}
    log.action_taken = "new_deal_detected"
    log.claude_summary = payload.get("summary")
    await _upsert(
        db, run, log,
        deal_id=None,
        kind="new_deal",
        field="new_deal",
        payload=payload,
        suggested_value=json.dumps({
            "company_name": payload.get("company_name", ""),
            "sector": payload.get("sector", ""),
            "summary": payload.get("summary", ""),
        }),
        evidence=None,
        confidence=result.confidence,
        discriminator=new_deal_discriminator(payload),
        email_snippet=log.body_snippet,
        estimated_size_m=payload.get("estimated_size_m"),
        estimated_sector=payload.get("sector"),
    )


async def record_suggestion_email(
    db: AsyncSession, suggestion: PendingSuggestion, log_id: int
) -> None:
    existing = (
        await db.execute(
            select(PendingSuggestionEmailLog).where(
                PendingSuggestionEmailLog.suggestion_id == suggestion.id,
                PendingSuggestionEmailLog.email_scan_log_id == log_id,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(
            PendingSuggestionEmailLog(
                suggestion_id=suggestion.id, email_scan_log_id=log_id
            )
        )
        await db.flush()


async def _upsert(
    db: AsyncSession,
    run: ScanRun,
    log: EmailScanLog,
    *,
    deal_id: uuid.UUID | None,
    kind: str,
    field: str | None = None,
    suggested_value: str | None = None,
    current_value: str | None = None,
    evidence: str | None = None,
    payload: dict | None = None,
    confidence: float = 0.0,
    requires_attention: bool = False,
    discriminator: str | None = None,
    email_snippet: str | None = None,
    estimated_size_m: float | None = None,
    estimated_sector: str | None = None,
) -> None:
    key = suggestion_dedupe_key(
        deal_id=deal_id,
        thread_id=log.thread_id,
        kind=kind,
        field=field,
        discriminator=discriminator,
    )
    existing = (
        await db.execute(
            select(PendingSuggestion).where(
                PendingSuggestion.dedupe_key == key,
                PendingSuggestion.status == "pending",
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        existing.suggested_value = suggested_value
        existing.current_value = current_value
        existing.evidence = evidence
        existing.payload = payload
        existing.confidence = confidence
        existing.requires_attention = requires_attention
        existing.claude_summary = evidence or existing.claude_summary
        existing.email_scan_log_id = log.id
        existing.email_subject = log.subject
        existing.email_snippet = email_snippet
        if estimated_size_m is not None:
            existing.estimated_size_m = estimated_size_m
        if estimated_sector is not None:
            existing.estimated_sector = estimated_sector
        await record_suggestion_email(db, existing, log.id)
        run.suggestions_updated += 1
        await db.flush()
        return

    suggestion = PendingSuggestion(
        deal_id=deal_id,
        email_scan_log_id=log.id,
        kind=kind,
        suggested_field=field or kind,
        suggested_value=suggested_value,
        current_value=current_value,
        evidence=evidence,
        payload=payload,
        confidence=confidence,
        requires_attention=requires_attention,
        claude_summary=evidence or (payload or {}).get("summary"),
        email_subject=log.subject,
        email_snippet=email_snippet,
        estimated_size_m=estimated_size_m,
        estimated_sector=estimated_sector,
        dedupe_key=key,
        source="email_scan",
        status="pending",
    )
    db.add(suggestion)
    await db.flush()
    await record_suggestion_email(db, suggestion, log.id)
    run.suggestions_created += 1
