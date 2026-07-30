from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.core.config import settings
from app.db.activity import log_activity
from app.db.models import Deal, DealDocument
from app.db.models.documents import DOCUMENT_CATEGORIES
from app.db.session import get_db
from app.storage import documents as storage

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


def _document_to_dict(doc: DealDocument) -> dict:
    return {
        "id": doc.id,
        "deal_id": doc.deal_id,
        "name": doc.name,
        "category": doc.category,
        "doc_type": doc.doc_type,
        "size_bytes": doc.size_bytes,
        "status": doc.status,
        "uploaded_by": doc.uploaded_by,
        "created_at": doc.created_at.isoformat(),
    }


async def _get_deal_or_404(deal_id: int, db: AsyncSession) -> Deal:
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.get("/deals/{deal_id}/documents")
async def list_documents(deal_id: int, db: AsyncSession = Depends(get_db)):
    await _get_deal_or_404(deal_id, db)
    result = await db.execute(
        select(DealDocument)
        .where(DealDocument.deal_id == deal_id, DealDocument.status == "active")
        .order_by(DealDocument.created_at.desc())
    )
    return [_document_to_dict(d) for d in result.scalars().all()]


@router.post("/deals/{deal_id}/documents")
async def upload_document(
    deal_id: int,
    file: UploadFile = File(...),
    category: str = Form(...),
    uploaded_by: str = Form("user"),
    db: AsyncSession = Depends(get_db),
):
    await _get_deal_or_404(deal_id, db)
    if category not in DOCUMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category!r}")
    if not settings.storage_configured:
        raise HTTPException(status_code=503, detail="Document storage is not configured yet")

    body = await file.read()
    storage_key = storage.make_storage_key(deal_id, file.filename or "document")
    storage.put_object(storage_key, body, file.content_type)

    doc = DealDocument(
        deal_id=deal_id,
        name=file.filename or "document",
        category=category,
        doc_type=(file.filename or "").rsplit(".", 1)[-1].upper() if "." in (file.filename or "") else None,
        size_bytes=len(body),
        storage_key=storage_key,
        uploaded_by=uploaded_by,
    )
    db.add(doc)
    await db.flush()

    await log_activity(
        db, deal_id, uploaded_by, "document",
        f"Uploaded document: {doc.name} ({category})",
    )

    return _document_to_dict(doc)


@router.get("/documents/{document_id}/download")
async def download_document(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DealDocument).where(DealDocument.id == document_id, DealDocument.status == "active"))
    doc = result.scalar_one_or_none()
    if not doc or not doc.storage_key:
        raise HTTPException(status_code=404, detail="Document not found")
    if not settings.storage_configured:
        raise HTTPException(status_code=503, detail="Document storage is not configured yet")
    url = storage.presigned_get_url(doc.storage_key)
    return RedirectResponse(url, status_code=302)


class DocumentPatchRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None


@router.patch("/documents/{document_id}")
async def patch_document(document_id: int, body: DocumentPatchRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DealDocument).where(DealDocument.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    updates = body.model_dump(exclude_unset=True)
    if "category" in updates and updates["category"] not in DOCUMENT_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category: {updates['category']!r}")
    for field, value in updates.items():
        setattr(doc, field, value)
    doc.updated_at = datetime.now(timezone.utc)
    return _document_to_dict(doc)


@router.delete("/documents/{document_id}")
async def delete_document(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DealDocument).where(DealDocument.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.status = "deleted"
    doc.updated_at = datetime.now(timezone.utc)
    await log_activity(db, doc.deal_id, "user", "document", f"Deleted document: {doc.name}")
    return {"ok": True, "document_id": document_id}
