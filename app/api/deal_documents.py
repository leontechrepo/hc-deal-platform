import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_actor_name, require_auth
from app.core.config import settings
from app.db.activity import log_activity
from app.db.documents import content_hash, find_duplicate
from app.db.models import Deal, DealDocument
from app.db.models.documents import (
    CANDIDATE_NEEDS_REVIEW,
    DOCUMENT_CATEGORIES,
    PROCESSING_STATUSES,
    DealExtractionCandidate,
)
from app.db.models.suggestions import EmailScanLog
from app.db.session import get_db
from app.storage import documents as storage
from app.storage.base import StorageError, backend_configured, content_disposition, get_storage

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 50 * 1024 * 1024

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


def _document_to_dict(
    doc: DealDocument,
    *,
    source_email: dict | None = None,
    pending_review: int = 0,
) -> dict:
    return {
        "id": doc.id,
        "deal_id": str(doc.deal_id) if doc.deal_id else None,
        "name": doc.name,
        "category": doc.category,
        "doc_type": doc.doc_type,
        "content_type": doc.content_type,
        "size_bytes": doc.size_bytes,
        "sha256": doc.sha256,
        "source": doc.source,
        "storage_backend": doc.storage_backend,
        "status": doc.status,
        "uploaded_by": doc.uploaded_by,
        "processing_status": doc.processing_status,
        "extracted_data": doc.extracted_data,
        "extraction_confidence": (
            float(doc.extraction_confidence)
            if doc.extraction_confidence is not None
            else None
        ),
        "human_review_required": doc.human_review_required,
        "email_scan_log_id": doc.email_scan_log_id,
        "graph_attachment_id": doc.graph_attachment_id,
        "skip_reason": doc.skip_reason,
        "filed": doc.deal_id is not None,
        "source_email": source_email,
        "pending_review_count": pending_review,
        "created_at": doc.created_at.isoformat(),
    }


async def _decorate(docs: list[DealDocument], db: AsyncSession) -> list[dict]:
    """Attach email provenance and open-review counts in two queries, not N+1."""
    log_ids = {d.email_scan_log_id for d in docs if d.email_scan_log_id}
    emails: dict[int, dict] = {}
    if log_ids:
        for log in (
            await db.execute(select(EmailScanLog).where(EmailScanLog.id.in_(log_ids)))
        ).scalars().all():
            emails[log.id] = {
                "id": log.id,
                "subject": log.subject,
                "sender": log.sender_address,
                "sender_name": log.sender_name,
                "received_at": log.received_at.isoformat() if log.received_at else None,
                "source_removed": log.source_removed_at is not None,
            }
    pending: dict[int, int] = {}
    doc_ids = [d.id for d in docs]
    if doc_ids:
        rows = (
            await db.execute(
                select(DealExtractionCandidate.document_id, func.count())
                .where(
                    DealExtractionCandidate.document_id.in_(doc_ids),
                    DealExtractionCandidate.status.in_(tuple(CANDIDATE_NEEDS_REVIEW)),
                )
                .group_by(DealExtractionCandidate.document_id)
            )
        ).all()
        pending = {doc_id: n for doc_id, n in rows}
    return [
        _document_to_dict(
            d, source_email=emails.get(d.email_scan_log_id), pending_review=pending.get(d.id, 0)
        )
        for d in docs
    ]


async def _get_deal_or_404(deal_id: uuid.UUID, db: AsyncSession) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.get("/deals/{deal_id}/documents")
async def list_documents(deal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(
        select(DealDocument)
        .where(DealDocument.deal_id == deal_id, DealDocument.status == "active")
        .order_by(DealDocument.created_at.desc())
    )
    return await _decorate(list(result.scalars().all()), db)


@router.post("/deals/{deal_id}/documents")
async def upload_document(
    deal_id: uuid.UUID,
    file: UploadFile = File(...),
    category: str = Form(...),
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    await _get_deal_or_404(deal_id, db)
    if category not in DOCUMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category!r}")
    if not settings.storage_configured:
        raise HTTPException(status_code=503, detail="Document storage is not configured yet")

    uploaded_by = get_actor_name(auth)
    body = await file.read()
    if len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 50 MB upload limit")

    digest = content_hash(body)
    existing = await find_duplicate(db, sha256=digest, deal_id=deal_id)
    if existing is not None:
        return {**_document_to_dict(existing), "duplicate": True}

    storage_key = storage.make_storage_key(deal_id, file.filename or "document")
    backend_name = await storage.put_object(storage_key, body, file.content_type)

    doc = DealDocument(
        deal_id=deal_id,
        name=file.filename or "document",
        category=category,
        doc_type=(
            (file.filename or "").rsplit(".", 1)[-1].upper()
            if "." in (file.filename or "")
            else None
        ),
        content_type=file.content_type,
        size_bytes=len(body),
        sha256=digest,
        storage_backend=backend_name,
        storage_key=storage_key,
        source="upload",
        uploaded_by=uploaded_by,
    )
    try:
        async with db.begin_nested():
            db.add(doc)
            await db.flush()
    except IntegrityError:
        # Lost a race on the per-deal sha256 unique index: drop our copy, return the winner.
        try:
            await storage.delete_object(storage_key, backend=backend_name)
        except Exception:  # noqa: BLE001
            logger.warning("Could not remove orphaned upload %s", storage_key, exc_info=True)
        winner = await find_duplicate(db, sha256=digest, deal_id=deal_id)
        if winner is None:
            raise
        return {**_document_to_dict(winner), "duplicate": True}

    await log_activity(
        db, deal_id, uploaded_by, "document",
        f"Uploaded document: {doc.name} ({category})",
    )
    return {**_document_to_dict(doc), "duplicate": False}


@router.get("/documents/{document_id}/download")
async def download_document(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DealDocument).where(
            DealDocument.id == document_id, DealDocument.status == "active"
        )
    )
    doc = result.scalar_one_or_none()
    if not doc or not doc.storage_key:
        raise HTTPException(status_code=404, detail="Document not found")
    # Gate on the backend this row was written to, not the currently active one.
    if not backend_configured(doc.storage_backend):
        raise HTTPException(status_code=503, detail="Document storage is not configured yet")

    backend = get_storage(doc.storage_backend)
    url = await backend.url_for(doc.storage_key, download_name=doc.name)
    if url:
        return RedirectResponse(url, status_code=302)

    # Local backend — stream bytes directly.
    try:
        body = await backend.get(doc.storage_key)
    except StorageError as exc:
        raise HTTPException(status_code=404, detail="Document bytes not found") from exc
    return Response(
        content=body,
        media_type=doc.content_type or "application/octet-stream",
        headers={"Content-Disposition": content_disposition(doc.name)},
    )


class DocumentPatchRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    processing_status: Optional[str] = None
    human_review_required: Optional[bool] = None


@router.patch("/documents/{document_id}")
async def patch_document(
    document_id: int, body: DocumentPatchRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(DealDocument).where(DealDocument.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    updates = body.model_dump(exclude_unset=True)
    if "category" in updates and updates["category"] not in DOCUMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {updates['category']!r}")
    if (
        "processing_status" in updates
        and updates["processing_status"] is not None
        and updates["processing_status"] not in PROCESSING_STATUSES
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid processing_status: {updates['processing_status']!r}",
        )
    for field, value in updates.items():
        setattr(doc, field, value)
    doc.updated_at = datetime.now(timezone.utc)
    return _document_to_dict(doc)


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    result = await db.execute(select(DealDocument).where(DealDocument.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.status = "deleted"
    doc.updated_at = datetime.now(timezone.utc)
    if doc.deal_id:
        await log_activity(
            db, doc.deal_id, get_actor_name(auth), "document",
            f"Deleted document: {doc.name}",
        )

    await db.commit()

    if doc.storage_key:
        try:
            await storage.delete_object(doc.storage_key, backend=doc.storage_backend)
        except Exception:  # noqa: BLE001 - the row is already soft-deleted; an orphan is harmless
            logger.warning("Could not delete object %s", doc.storage_key, exc_info=True)

    return {"ok": True, "document_id": document_id}
