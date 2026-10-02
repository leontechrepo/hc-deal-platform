"""Extract text from credit documents.

Uses Azure Document Intelligence when configured; otherwise falls back to a
lightweight PDF text extract via pypdf if available, else empty.
"""
from __future__ import annotations

import io
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


async def extract_layout_text(body: bytes) -> str:
    if settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and settings.AZURE_DOCUMENT_INTELLIGENCE_KEY:
        try:
            return await _azure_di(body)
        except Exception:
            logger.exception("Azure Document Intelligence failed; trying local extract")

    return _local_pdf_text(body)


async def _azure_di(body: bytes) -> str:
    from azure.ai.documentintelligence.aio import DocumentIntelligenceClient
    from azure.core.credentials import AzureKeyCredential

    client = DocumentIntelligenceClient(
        endpoint=settings.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
        credential=AzureKeyCredential(settings.AZURE_DOCUMENT_INTELLIGENCE_KEY),
    )
    async with client:
        poller = await client.begin_analyze_document(
            "prebuilt-layout", body=body, content_type="application/octet-stream"
        )
        result = await poller.result()
    return (result.content or "").strip()


def _local_pdf_text(body: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        try:
            from PyPDF2 import PdfReader  # type: ignore
        except ImportError:
            return ""
    try:
        reader = PdfReader(io.BytesIO(body))
        parts = []
        for page in reader.pages[:50]:
            parts.append(page.extract_text() or "")
        return "\n".join(parts).strip()
    except Exception:
        logger.exception("Local PDF text extract failed")
        return ""
