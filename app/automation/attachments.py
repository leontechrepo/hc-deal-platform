"""Selective attachment ingestion after a worthwhile classification.

Every attachment gets a recorded disposition in ``EmailScanLog.attachment_summary``
(stored / duplicate / skipped / failed) so reviewers can see *why* a file is or
is not in the system. Failed fetches carry an ``attempts`` counter and are retried
on later scans up to MAX_ATTACHMENT_ATTEMPTS.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.documents import store_document
from app.db.models.suggestions import EmailScanLog
from app.domain.attachments import (
    MAX_MESSAGE_BYTES,
    classify_attachment,
    safe_filename,
    summarize,
)
from app.graph.attachments import fetch_attachment_bytes, list_attachments

logger = logging.getLogger(__name__)

MAX_ATTACHMENT_ATTEMPTS = 3


def has_retryable_failures(summary: list[dict[str, Any]] | None) -> bool:
    return any(
        entry.get("disposition") == "failed"
        and (entry.get("attempts") or 0) < MAX_ATTACHMENT_ATTEMPTS
        for entry in (summary or [])
    )


async def ingest_attachments_for_log(
    db: AsyncSession,
    log: EmailScanLog,
    message: dict[str, Any] | None = None,
    *,
    client: Any,
    user: str,
) -> list[dict[str, Any]]:
    attachments = await list_attachments(
        client, user_email=user, message_id=log.graph_message_id
    )
    previous = {
        e.get("graph_attachment_id"): e
        for e in (log.attachment_summary or [])
        if e.get("graph_attachment_id")
    }
    entries = summarize(attachments)
    log.attachment_count = len(attachments)

    running_total = 0
    for attachment, entry in zip(attachments, entries):
        attachment_id = attachment.get("id")
        entry["graph_attachment_id"] = attachment_id
        prior = previous.get(attachment_id)
        if prior and prior.get("disposition") in ("stored", "duplicate", "skipped"):
            entry.update({k: v for k, v in prior.items() if k not in entry or k in (
                "disposition", "reason", "document_id", "sha256")})
            continue
        attempts = (prior or {}).get("attempts", 0)

        decision = classify_attachment(attachment)
        if not decision.store or not attachment_id:
            entry.update(disposition="skipped", reason=decision.reason or "no_attachment_id")
            continue
        size = attachment.get("size") or 0
        if running_total + size > MAX_MESSAGE_BYTES:
            entry.update(disposition="skipped", reason="message_budget")
            continue
        running_total += size

        try:
            body = await fetch_attachment_bytes(
                client,
                user_email=user,
                message_id=log.graph_message_id,
                attachment_id=attachment_id,
            )
            if not body:
                entry.update(disposition="skipped", reason="empty_body")
                continue
            document, created = await store_document(
                db,
                name=safe_filename(attachment.get("name")),
                body=body,
                content_type=attachment.get("contentType"),
                doc_type=decision.doc_type,
                deal_id=None,
                source="email_attachment",
                email_scan_log_id=log.id,
                graph_attachment_id=attachment_id,
                uploaded_by="email_scan",
            )
            entry.update(
                disposition="stored" if created else "duplicate",
                document_id=str(document.id),
                sha256=document.sha256,
            )
        except Exception as exc:  # noqa: BLE001 - one bad file must not sink the rest
            logger.warning("Attachment %s on log %s failed: %s", attachment_id, log.id, exc)
            entry.update(disposition="failed", reason=str(exc)[:200], attempts=attempts + 1)

    log.attachment_summary = entries
    await db.flush()
    return entries
