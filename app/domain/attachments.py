"""Which attachments are worth keeping for Corporate Credit."""
from __future__ import annotations

import os
import re
import unicodedata
from dataclasses import dataclass
from typing import Any

STORABLE_TYPES: dict[str, str] = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "application/vnd.ms-excel": "XLS",
    "application/vnd.ms-excel.sheet.macroenabled.12": "XLSM",
    "text/csv": "CSV",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/msword": "DOC",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
    "application/vnd.ms-powerpoint": "PPT",
    "application/zip": "ZIP",
    "application/x-zip-compressed": "ZIP",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
}

BLOCKED_EXTENSIONS: frozenset[str] = frozenset({
    ".exe", ".dll", ".js", ".vbs", ".scr", ".bat", ".cmd", ".com",
    ".jar", ".ps1", ".msi", ".app", ".sh", ".pif", ".lnk",
})

MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
MAX_MESSAGE_BYTES = 60 * 1024 * 1024
INLINE_IMAGE_BYTES = 25 * 1024
FILE_ATTACHMENT_TYPE = "#microsoft.graph.fileAttachment"

_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9._-]+")
_REPEATED_DOTS = re.compile(r"\.{2,}")


@dataclass(frozen=True)
class AttachmentDecision:
    store: bool
    reason: str | None = None
    doc_type: str | None = None


def safe_filename(raw: str | None, *, fallback: str = "attachment") -> str:
    name = unicodedata.normalize("NFKD", raw or "")
    name = os.path.basename(name).replace("\\", "/")
    name = os.path.basename(name)
    name = _UNSAFE_CHARS.sub("_", name)
    name = _REPEATED_DOTS.sub(".", name).strip("._")
    if not name:
        return fallback
    stem, dot, ext = name.rpartition(".")
    if dot:
        return f"{stem[:80]}.{ext[:12]}" if stem else fallback
    return name[:80]


def is_signature_noise(attachment: dict[str, Any]) -> bool:
    if attachment.get("isInline"):
        return True
    content_type = (attachment.get("contentType") or "").lower()
    size = attachment.get("size") or 0
    return content_type.startswith("image/") and size < INLINE_IMAGE_BYTES


def classify_attachment(attachment: dict[str, Any]) -> AttachmentDecision:
    if attachment.get("@odata.type") not in (None, FILE_ATTACHMENT_TYPE):
        return AttachmentDecision(False, "not_a_file_attachment")
    if is_signature_noise(attachment):
        return AttachmentDecision(False, "inline_or_signature")
    name = attachment.get("name") or ""
    extension = os.path.splitext(name.lower())[1]
    if extension in BLOCKED_EXTENSIONS:
        return AttachmentDecision(False, "blocked_extension")
    size = attachment.get("size") or 0
    if size <= 0:
        return AttachmentDecision(False, "empty")
    if size > MAX_ATTACHMENT_BYTES:
        return AttachmentDecision(False, "too_large")
    content_type = (attachment.get("contentType") or "").lower().split(";")[0].strip()
    doc_type = STORABLE_TYPES.get(content_type)
    if doc_type is None:
        return AttachmentDecision(False, "unsupported_type")
    return AttachmentDecision(True, doc_type=doc_type)


def select_attachments(
    attachments: list[dict[str, Any]],
    *,
    max_total_bytes: int = MAX_MESSAGE_BYTES,
) -> tuple[list[tuple[dict[str, Any], AttachmentDecision]], dict[str, int]]:
    keep: list[tuple[dict[str, Any], AttachmentDecision]] = []
    reasons: dict[str, int] = {}
    running_total = 0
    for attachment in attachments:
        decision = classify_attachment(attachment)
        if not decision.store:
            reason = decision.reason or "unknown"
            reasons[reason] = reasons.get(reason, 0) + 1
            continue
        size = attachment.get("size") or 0
        if running_total + size > max_total_bytes:
            reasons["message_budget"] = reasons.get("message_budget", 0) + 1
            continue
        running_total += size
        keep.append((attachment, decision))
    return keep, reasons


def summarize(attachments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "name": attachment.get("name"),
            "content_type": attachment.get("contentType"),
            "size": attachment.get("size"),
            "inline": bool(attachment.get("isInline")),
        }
        for attachment in attachments
    ]
