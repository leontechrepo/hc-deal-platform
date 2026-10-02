"""Storing and filing deal documents with email provenance."""
from __future__ import annotations

import hashlib
import logging
import uuid
from typing import NamedTuple

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.documents import DealDocument, DealDocumentEmailLog
from app.db.models.suggestions import (
    EmailScanLog,
    PendingSuggestion,
    PendingSuggestionEmailLog,
)
from app.storage.base import StorageBackend, get_storage

logger = logging.getLogger(__name__)


def content_hash(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


class FilingOutcome(NamedTuple):
    attached: int
    discarded: int

    @property
    def changed(self) -> bool:
        return self.attached > 0 or self.discarded > 0


async def find_duplicate(
    db: AsyncSession, *, sha256: str, deal_id: uuid.UUID | None
) -> DealDocument | None:
    stmt = select(DealDocument).where(
        DealDocument.sha256 == sha256,
        DealDocument.status == "active",
        DealDocument.deal_id == deal_id if deal_id else DealDocument.deal_id.is_(None),
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def _remember_source_email(
    db: AsyncSession, document: DealDocument, email_scan_log_id: int | None
) -> None:
    if email_scan_log_id is None:
        return
    already = (
        await db.execute(
            select(DealDocumentEmailLog).where(
                DealDocumentEmailLog.document_id == document.id,
                DealDocumentEmailLog.email_scan_log_id == email_scan_log_id,
            )
        )
    ).scalar_one_or_none()
    if already is not None:
        return
    db.add(
        DealDocumentEmailLog(
            document_id=document.id, email_scan_log_id=email_scan_log_id
        )
    )
    await db.flush()


async def store_document(
    db: AsyncSession,
    *,
    name: str,
    body: bytes,
    content_type: str | None = None,
    doc_type: str | None = None,
    category: str | None = None,
    deal_id: uuid.UUID | None = None,
    source: str = "upload",
    email_scan_log_id: int | None = None,
    graph_attachment_id: str | None = None,
    uploaded_by: str | None = None,
    storage: StorageBackend | None = None,
) -> tuple[DealDocument, bool]:
    storage = storage or get_storage()
    digest = content_hash(body)

    existing = await find_duplicate(db, sha256=digest, deal_id=deal_id)
    if existing is not None:
        await _remember_source_email(db, existing, email_scan_log_id)
        return existing, False

    folder = f"active/{deal_id}" if deal_id else "active/unfiled"
    key = storage.key_for(name, folder)
    await storage.put(key, body, content_type)

    document = DealDocument(
        deal_id=deal_id,
        name=name,
        category=category,
        doc_type=doc_type,
        content_type=content_type,
        size_bytes=len(body),
        sha256=digest,
        storage_backend=storage.name,
        storage_key=key,
        source=source,
        email_scan_log_id=email_scan_log_id,
        graph_attachment_id=graph_attachment_id,
        uploaded_by=uploaded_by,
        processing_status="pending",
    )
    try:
        async with db.begin_nested():
            db.add(document)
            await db.flush()
    except IntegrityError:
        # Lost a race against the sha256 unique index: drop our orphan object
        # and return the winner.
        await _discard_object(storage, key)
        winner = await find_duplicate(db, sha256=digest, deal_id=deal_id)
        if winner is None:
            raise
        await _remember_source_email(db, winner, email_scan_log_id)
        return winner, False
    except Exception:
        await _discard_object(storage, key)
        raise
    await _remember_source_email(db, document, email_scan_log_id)
    return document, True


async def _discard_object(storage: StorageBackend, key: str) -> None:
    try:
        await storage.delete(key)
    except Exception:  # noqa: BLE001
        logger.warning("Could not remove orphaned object %s", key, exc_info=True)


async def suggestion_email_log_scope(
    db: AsyncSession, suggestion: PendingSuggestion
) -> list[int]:
    ids: set[int] = set()
    if suggestion.email_scan_log_id:
        ids.add(suggestion.email_scan_log_id)
    rows = (
        await db.execute(
            select(PendingSuggestionEmailLog.email_scan_log_id).where(
                PendingSuggestionEmailLog.suggestion_id == suggestion.id
            )
        )
    ).scalars().all()
    ids.update(rows)
    return list(ids)


async def file_documents_for_approved_email(
    db: AsyncSession, email_scan_log_id: int
) -> FilingOutcome:
    """Attach unfiled documents from this email to the approved deal."""
    suggestions = list(
        (
            await db.execute(
                select(PendingSuggestion).where(
                    PendingSuggestion.status == "approved",
                    or_(
                        PendingSuggestion.email_scan_log_id == email_scan_log_id,
                        PendingSuggestion.id.in_(
                            select(PendingSuggestionEmailLog.suggestion_id).where(
                                PendingSuggestionEmailLog.email_scan_log_id
                                == email_scan_log_id
                            )
                        ),
                    ),
                )
            )
        ).scalars().all()
    )
    deal_ids = {s.deal_id for s in suggestions if s.deal_id}
    if len(deal_ids) != 1:
        return FilingOutcome(0, 0)
    deal_id = deal_ids.pop()

    docs = list(
        (
            await db.execute(
                select(DealDocument).where(
                    DealDocument.status == "active",
                    DealDocument.deal_id.is_(None),
                    or_(
                        DealDocument.email_scan_log_id == email_scan_log_id,
                        DealDocument.id.in_(
                            select(DealDocumentEmailLog.document_id).where(
                                DealDocumentEmailLog.email_scan_log_id
                                == email_scan_log_id
                            )
                        ),
                    ),
                )
            )
        ).scalars().all()
    )

    attached = 0
    discarded = 0
    for doc in docs:
        duplicate = None
        if doc.sha256:
            duplicate = await find_duplicate(db, sha256=doc.sha256, deal_id=deal_id)
        if duplicate is not None:
            doc.status = "deleted"
            await _remember_source_email(db, duplicate, email_scan_log_id)
            discarded += 1
            continue
        doc.deal_id = deal_id
        attached += 1
    await db.flush()
    return FilingOutcome(attached, discarded)


async def file_documents_for_suggestion(
    db: AsyncSession, suggestion: PendingSuggestion, deal_id: uuid.UUID
) -> FilingOutcome:
    scope = await suggestion_email_log_scope(db, suggestion)
    if not scope:
        return FilingOutcome(0, 0)
    attached = discarded = 0
    for log_id in scope:
        # Temporarily set deal via each log's unfiled docs.
        docs = list(
            (
                await db.execute(
                    select(DealDocument).where(
                        DealDocument.status == "active",
                        DealDocument.deal_id.is_(None),
                        or_(
                            DealDocument.email_scan_log_id == log_id,
                            DealDocument.id.in_(
                                select(DealDocumentEmailLog.document_id).where(
                                    DealDocumentEmailLog.email_scan_log_id == log_id
                                )
                            ),
                        ),
                    )
                )
            ).scalars().all()
        )
        for doc in docs:
            duplicate = None
            if doc.sha256:
                duplicate = await find_duplicate(db, sha256=doc.sha256, deal_id=deal_id)
            if duplicate is not None:
                doc.status = "deleted"
                await _remember_source_email(db, duplicate, log_id)
                discarded += 1
                continue
            doc.deal_id = deal_id
            attached += 1
    await db.flush()
    return FilingOutcome(attached, discarded)
