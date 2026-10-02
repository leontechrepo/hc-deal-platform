"""Opt-in Corporate Credit document extraction — typed, evidence-backed candidates."""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

from anthropic import AsyncAnthropic
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.activity import log_activity
from app.db.documents import suggestion_email_log_scope
from app.db.models.deals import Deal, DealUpdateLog
from app.db.models.documents import (
    CANDIDATE_NEEDS_REVIEW,
    DealDocument,
    DealDocumentEmailLog,
    DealExtractionCandidate,
    DealExtractionRun,
)
from app.db.models.suggestions import LLMCall, PendingSuggestion
from app.domain.field_updates import ALLOWED_FIELD_UPDATES
from app.domain.pricing import Usage, estimate_cost
from app.services.extraction_plan import HIGH_CONFIDENCE, RawCandidate, plan_candidates
from app.services.ocr import extract_layout_text
from app.storage.base import get_storage

logger = logging.getLogger(__name__)

MIN_CONFIDENCE = 0.50
MAX_ATTEMPTS = 3
MAX_DOCUMENTS_PER_RUN = 10
HEAD_CHARS = 80_000
TAIL_CHARS = 40_000

# Explicitly Corporate Credit — never copy RE property/cap-rate fields.
EXTRACTION_FIELDS: frozenset[str] = frozenset({
    "deal_size_m", "hold_amount_m", "spread_bps", "total_leverage",
    "dscr", "fccr", "interest_coverage", "ltm_revenue_m", "ltm_ebitda_m",
    "ebitda_margin", "tenor_months", "maturity_date", "security",
    "oid_pct", "sofr_floor_pct", "nda_date", "target_close",
}) & ALLOWED_FIELD_UPDATES

SUPPORTED_CONTENT_TYPES = frozenset({
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
})
SUPPORTED_SUFFIXES = frozenset({".pdf", ".docx", ".xlsx", ".pptx", ".png", ".jpg", ".jpeg"})

TOOL = {
    "name": "extract_credit_document_fields",
    "description": "Return only facts explicitly stated in this Corporate Credit document.",
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["fields"],
        "properties": {
            "fields": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["field", "value", "confidence", "evidence"],
                    "properties": {
                        "field": {"type": "string"},
                        "value": {"type": "string"},
                        "confidence": {"type": "number"},
                        "evidence": {"type": "string"},
                    },
                },
            }
        },
    },
}


@dataclass(frozen=True)
class Candidate:
    field: str
    value: str
    confidence: float
    evidence: str
    document_id: int


def document_supported(document: DealDocument) -> bool:
    content_type = (document.content_type or "").split(";")[0].strip().lower()
    suffix = Path(document.name or "").suffix.lower()
    return content_type in SUPPORTED_CONTENT_TYPES or suffix in SUPPORTED_SUFFIXES


def text_window(text: str) -> str:
    if len(text) <= HEAD_CHARS + TAIL_CHARS:
        return text
    return f"{text[:HEAD_CHARS]}\n\n[... middle omitted ...]\n\n{text[-TAIL_CHARS:]}"


def _prompt() -> str:
    return f"""You extract facts from a Corporate Credit / private credit document.
Return only fields from this allowlist: {', '.join(sorted(EXTRACTION_FIELDS))}

Rules:
- Return one item per explicitly stated fact, with an exact supporting quote.
- Never infer missing numbers or dates.
- Confidence: 0.90-1 explicit labelled value; 0.70-0.89 light parsing; 0.50-0.69 ambiguous; below 0.50 omit.
- Dates use YYYY-MM-DD. Money in millions for *_m fields. Percentages as points.
- Do not return commentary, people, or computed fields."""


def parse_tool_fields(
    raw_fields: list[dict[str, Any]], document_id: int
) -> tuple[list[dict[str, Any]], list[Candidate]]:
    stored: list[dict[str, Any]] = []
    candidates: list[Candidate] = []
    for item in raw_fields:
        try:
            field = str(item["field"])
            value = str(item["value"]).strip()
            confidence = float(item["confidence"])
            evidence = str(item["evidence"]).strip()
        except (KeyError, TypeError, ValueError):
            continue
        if field not in EXTRACTION_FIELDS or not value or not evidence or not 0 <= confidence <= 1:
            continue
        stored.append({
            "field": field, "value": value,
            "confidence": confidence, "evidence": evidence,
        })
        if confidence >= MIN_CONFIDENCE:
            candidates.append(Candidate(field, value, confidence, evidence, document_id))
    return stored, candidates


async def extract_document(document: DealDocument) -> tuple[list[Candidate], dict[str, int]]:
    if not document_supported(document):
        document.processing_status = "skipped"
        return [], {"input_tokens": 0, "output_tokens": 0}
    if not document.storage_key:
        raise RuntimeError("document_has_no_storage_key")

    body = await get_storage(document.storage_backend).get(document.storage_key)
    text = await extract_layout_text(body)
    if not text.strip():
        raise RuntimeError("document_has_no_text")
    if not settings.ANTHROPIC_API_KEY:
        raise RuntimeError("anthropic_not_configured")

    started = time.monotonic()
    response = await AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY).messages.create(
        model=settings.EXTRACTION_MODEL,
        max_tokens=4096,
        system=_prompt(),
        tools=[TOOL],
        tool_choice={"type": "tool", "name": TOOL["name"]},
        messages=[{"role": "user", "content": f"Document text:\n\n{text_window(text)}"}],
        timeout=settings.EXTRACTION_TIMEOUT_SECONDS,
    )
    raw_fields: list[dict[str, Any]] = []
    for block in response.content:
        if block.type == "tool_use" and block.name == TOOL["name"]:
            raw_fields = block.input.get("fields", [])  # type: ignore[union-attr]
            break

    stored, candidates = parse_tool_fields(raw_fields, document.id)
    document.extracted_data = {"version": 1, "fields": stored}
    confidences = [c.confidence for c in candidates]
    document.extraction_confidence = (
        Decimal(str(sum(confidences) / len(confidences))).quantize(Decimal("0.001"))
        if confidences else None
    )
    document.human_review_required = any(
        MIN_CONFIDENCE <= v < HIGH_CONFIDENCE for v in confidences
    )
    document.processing_status = (
        "needs_review" if document.human_review_required else "extracted"
    )
    usage = getattr(response, "usage", None)
    return candidates, {
        "input_tokens": int(getattr(usage, "input_tokens", 0) or 0),
        "output_tokens": int(getattr(usage, "output_tokens", 0) or 0),
        "request_id": getattr(response, "id", None),
        "latency_ms": int((time.monotonic() - started) * 1000),
        "stop_reason": getattr(response, "stop_reason", None),
    }


async def _scoped_documents(
    db: AsyncSession, suggestion: PendingSuggestion, deal_id: uuid.UUID
) -> list[DealDocument]:
    scope = await suggestion_email_log_scope(db, suggestion)
    if not scope:
        return []
    return list(
        (
            await db.execute(
                select(DealDocument).where(
                    DealDocument.deal_id == deal_id,
                    DealDocument.status == "active",
                    or_(
                        DealDocument.email_scan_log_id.in_(scope),
                        DealDocument.id.in_(
                            select(DealDocumentEmailLog.document_id).where(
                                DealDocumentEmailLog.email_scan_log_id.in_(scope)
                            )
                        ),
                    ),
                ).order_by(DealDocument.created_at, DealDocument.id)
            )
        ).scalars().all()
    )


def _record_llm_call(db: AsyncSession, run: DealExtractionRun, usage: dict[str, Any]) -> None:
    """Extraction spend goes in the same ledger as classification (cost views, budgets)."""
    usage_obj = Usage(input_tokens=usage["input_tokens"], output_tokens=usage["output_tokens"])
    db.add(
        LLMCall(
            extraction_run_id=run.id,
            purpose="extract_document",
            model=settings.EXTRACTION_MODEL,
            input_tokens=usage["input_tokens"],
            output_tokens=usage["output_tokens"],
            estimated_cost_usd=estimate_cost(settings.EXTRACTION_MODEL, usage_obj),
            latency_ms=usage.get("latency_ms"),
            stop_reason=usage.get("stop_reason"),
            request_id=usage.get("request_id"),
        )
    )


async def _persist_and_apply(
    db: AsyncSession,
    run: DealExtractionRun,
    deal: Deal,
    documents: list[DealDocument],
    candidates: list[Candidate],
) -> list[dict[str, Any]]:
    """Store every candidate with a disposition; auto-apply only the clear, blank-field ones."""
    # A retried run re-plans from scratch, but never discards a reviewer's decision.
    await db.execute(
        delete(DealExtractionCandidate).where(
            DealExtractionCandidate.run_id == run.id,
            DealExtractionCandidate.status.notin_(("accepted", "rejected")),
        )
    )
    planned = plan_candidates(
        [RawCandidate(c.field, c.value, c.confidence, c.evidence, c.document_id) for c in candidates],
        current_values=lambda f: getattr(deal, f, None),
        pipeline_stage=deal.pipeline_stage,
        status=deal.status,
    )

    applied: list[dict[str, Any]] = []
    for item in planned:
        cand = item.candidate
        db.add(
            DealExtractionCandidate(
                run_id=run.id,
                deal_id=deal.id,
                document_id=cand.document_id,
                field=cand.field,
                raw_value=cand.value,
                display_value=item.display,
                confidence=cand.confidence,
                evidence=cand.evidence,
                status=item.status,
                reason=item.reason,
                current_value=item.current,
            )
        )
        if item.status == "applied":
            old = getattr(deal, cand.field, None)
            setattr(deal, cand.field, item.value)
            db.add(
                DealUpdateLog(
                    deal_id=deal.id,
                    field_changed=cand.field,
                    old_value=None if old is None else str(old),
                    new_value=str(item.value),
                    source="document_extraction",
                    email_subject=None,
                )
            )
            applied.append({
                "field": cand.field, "value": cand.value, "confidence": cand.confidence,
                "evidence": cand.evidence, "document_id": cand.document_id,
            })

    if applied:
        deal.updated_by = "document_extraction"
        await log_activity(
            db, deal.id, "Document Extraction", "document",
            "Filled from documents: " + ", ".join(i["field"] for i in applied[:8]),
        )

    needs_review = [p for p in planned if p.status in CANDIDATE_NEEDS_REVIEW]
    review_docs = {p.candidate.document_id for p in needs_review}
    for document in documents:
        if document.processing_status == "failed":
            continue
        document.human_review_required = document.id in review_docs
        document.processing_status = "needs_review" if document.id in review_docs else "extracted"

    run.extracted_fields = {
        p.candidate.field: {
            "field": p.candidate.field, "value": p.candidate.value,
            "confidence": p.candidate.confidence, "evidence": p.candidate.evidence,
            "document_id": p.candidate.document_id, "status": p.status,
        }
        for p in planned if p.status not in ("invalid", "superseded", "corroborating")
    }
    run.applied_fields = applied
    run.applied_field_count = len(applied)
    run.low_confidence_fields = sorted({p.candidate.field for p in needs_review})
    run.conflicts = sorted({p.candidate.field for p in planned if p.status == "conflict"})
    return applied


async def refresh_document_review_state(db: AsyncSession, document_ids: set[int | None]) -> None:
    """After a reviewer resolves candidates, clear the document's review flag if none remain."""
    for document_id in {d for d in document_ids if d is not None}:
        remaining = (
            await db.execute(
                select(DealExtractionCandidate.id).where(
                    DealExtractionCandidate.document_id == document_id,
                    DealExtractionCandidate.status.in_(tuple(CANDIDATE_NEEDS_REVIEW)),
                ).limit(1)
            )
        ).first()
        document = await db.get(DealDocument, document_id)
        if document is not None and document.processing_status in ("needs_review", "extracted"):
            document.human_review_required = remaining is not None
            document.processing_status = "needs_review" if remaining else "extracted"


def _safe_error(exc: Exception) -> str:
    known = {
        "document_has_no_storage_key",
        "document_has_no_text",
        "anthropic_not_configured",
    }
    message = str(exc)
    return message if message in known else type(exc).__name__


async def enqueue_extraction_run(
    db: AsyncSession,
    *,
    deal_id: uuid.UUID,
    suggestion_id: int | None,
    document_ids: list[int] | None = None,
    trigger: str = "approval",
    requested_by: str | None = None,
) -> DealExtractionRun | None:
    if not settings.document_extraction_enabled:
        return None
    run = DealExtractionRun(
        deal_id=deal_id,
        suggestion_id=suggestion_id,
        status="pending",
        document_ids=document_ids,
        trigger=trigger,
        requested_by=requested_by,
    )
    db.add(run)
    await db.flush()
    return run


async def process_run(db: AsyncSession, run_id: uuid.UUID) -> bool:
    run = await db.scalar(
        select(DealExtractionRun)
        .where(DealExtractionRun.id == run_id)
        .with_for_update(skip_locked=True)
    )
    if run is None or run.status == "complete":
        return False
    run.status = "processing"
    run.started_at = run.started_at or datetime.now(timezone.utc)
    await db.flush()

    suggestion = (
        await db.get(PendingSuggestion, run.suggestion_id) if run.suggestion_id else None
    )
    deal = await db.get(Deal, run.deal_id)
    if deal is None:
        run.status = "error"
        run.last_error = "source_not_found"
        run.finished_at = datetime.now(timezone.utc)
        return True

    if run.document_ids:
        documents = list(
            (
                await db.execute(
                    select(DealDocument).where(
                        DealDocument.id.in_(run.document_ids),
                        DealDocument.deal_id == deal.id,
                        DealDocument.status == "active",
                    ).order_by(DealDocument.id)
                )
            ).scalars().all()
        )
    elif suggestion is None:
        documents = list(
            (
                await db.execute(
                    select(DealDocument).where(
                        DealDocument.deal_id == deal.id,
                        DealDocument.status == "active",
                        DealDocument.source == "email_attachment",
                    )
                )
            ).scalars().all()
        )
    else:
        documents = await _scoped_documents(db, suggestion, deal.id)

    documents = documents[:MAX_DOCUMENTS_PER_RUN]
    if not documents:
        expired = datetime.now(timezone.utc) - run.created_at > timedelta(minutes=10)
        run.status = "error" if expired else "pending"
        run.last_error = "no_extractable_documents" if expired else "waiting_for_documents"
        if run.status == "error":
            run.finished_at = datetime.now(timezone.utc)
        return True

    run.retry_count += 1
    candidates: list[Candidate] = []
    errors: dict[str, str] = {}
    for document in documents:
        try:
            if (
                document.processing_status in {"extracted", "needs_review"}
                and document.extracted_data
            ):
                _, extracted = parse_tool_fields(
                    document.extracted_data.get("fields", []), document.id
                )
                usage = {"input_tokens": 0, "output_tokens": 0}
            else:
                extracted, usage = await extract_document(document)
            candidates.extend(extracted)
            run.input_tokens += usage["input_tokens"]
            run.output_tokens += usage["output_tokens"]
            if usage["input_tokens"] or usage["output_tokens"]:
                _record_llm_call(db, run, usage)
        except Exception as exc:  # noqa: BLE001
            logger.exception("document extraction failed for %s", document.id)
            document.processing_status = "failed"
            errors[str(document.id)] = _safe_error(exc)

    failed_document_count = len(errors)
    if failed_document_count and run.retry_count < MAX_ATTEMPTS:
        run.status = "pending"
        run.last_error = "document_failures_retrying"
        run.document_errors = errors
        run.model = settings.EXTRACTION_MODEL
        run.estimated_cost_usd = estimate_cost(
            settings.EXTRACTION_MODEL,
            Usage(input_tokens=run.input_tokens, output_tokens=run.output_tokens),
        )
        run.finished_at = None
        return True

    applied = await _persist_and_apply(db, run, deal, documents, candidates)
    run.document_errors = errors or None
    run.model = settings.EXTRACTION_MODEL
    run.estimated_cost_usd = estimate_cost(
        settings.EXTRACTION_MODEL,
        Usage(input_tokens=run.input_tokens, output_tokens=run.output_tokens),
    )
    supported = sum(1 for d in documents if document_supported(d))
    all_failed = supported > 0 and failed_document_count == supported
    run.status = "error" if all_failed else "complete"
    run.last_error = (
        "all_documents_failed" if all_failed
        else ("partial_document_failure" if failed_document_count else None)
    )
    run.finished_at = datetime.now(timezone.utc)
    return True


async def process_pending_runs(db: AsyncSession, limit: int = 5) -> int:
    stale_before = datetime.now(timezone.utc) - timedelta(minutes=5)
    stale = list(
        (
            await db.execute(
                select(DealExtractionRun).where(
                    DealExtractionRun.status == "processing",
                    DealExtractionRun.updated_at < stale_before,
                ).with_for_update(skip_locked=True).limit(limit)
            )
        ).scalars().all()
    )
    for run in stale:
        run.status = "pending" if run.retry_count < MAX_ATTEMPTS else "error"
        run.last_error = "worker_interrupted"
    if stale:
        await db.commit()

    ids = list(
        (
            await db.execute(
                select(DealExtractionRun.id)
                .where(
                    DealExtractionRun.status == "pending",
                    DealExtractionRun.retry_count < MAX_ATTEMPTS,
                )
                .order_by(DealExtractionRun.created_at)
                .limit(limit)
            )
        ).scalars().all()
    )
    changed = 0
    for run_id in ids:
        if await process_run(db, run_id):
            changed += 1
        await db.commit()
    return changed


async def process_run_background(run_id: uuid.UUID) -> None:
    from app.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            await process_run(db, run_id)
            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("deal extraction run %s crashed", run_id)
            run = await db.get(DealExtractionRun, run_id)
            if run is not None:
                run.retry_count += 1
                run.status = "pending" if run.retry_count < MAX_ATTEMPTS else "error"
                run.last_error = "worker_crashed"
                if run.status == "error":
                    run.finished_at = datetime.now(timezone.utc)
                await db.commit()
