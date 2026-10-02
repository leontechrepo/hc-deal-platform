"""Feature flags and vocab for the UI."""
from fastapi import APIRouter, Depends

from app.core.auth import require_auth
from app.core.config import settings
from app.domain.pipeline_stage import PIPELINE_STAGES, STATUSES

router = APIRouter(prefix="/api/meta", dependencies=[Depends(require_auth)])


@router.get("/features")
async def features():
    return {
        "attachment_ingestion_enabled": settings.ATTACHMENT_INGESTION_ENABLED,
        "document_extraction_enabled": settings.document_extraction_enabled,
        "storage_backend": settings.STORAGE_BACKEND,
        "storage_configured": settings.storage_configured,
        "graph_folders": settings.graph_folders,
        # Why extraction might be off, so the UI can say it instead of guessing.
        "document_extraction_flag": settings.DOCUMENT_EXTRACTION_ENABLED,
        "document_extraction_requires_ingestion": (
            settings.DOCUMENT_EXTRACTION_ENABLED and not settings.ATTACHMENT_INGESTION_ENABLED
        ),
        "extraction_model": settings.EXTRACTION_MODEL if settings.document_extraction_enabled else None,
        "email_scanning_configured": bool(
            settings.AZURE_CLIENT_ID and settings.ANTHROPIC_API_KEY and settings.monitored_users
        ),
    }


@router.get("/pipeline-stages")
async def pipeline_stages():
    return {"stages": PIPELINE_STAGES, "statuses": STATUSES}
