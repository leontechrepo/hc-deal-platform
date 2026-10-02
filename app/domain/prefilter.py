"""Cheap heuristics that keep obvious non-deal mail away from the model."""
from __future__ import annotations

from dataclasses import dataclass

SKIP_SUBJECT_PREFIXES: tuple[str, ...] = (
    "accepted:",
    "declined:",
    "tentative:",
    "canceled:",
    "cancelled:",
    "automatic reply:",
    "out of office:",
    "auto-reply:",
    "autoreply:",
    "undeliverable:",
    "read:",
)

SKIP_SENDER_PATTERNS: tuple[str, ...] = (
    "noreply@",
    "no-reply@",
    "donotreply@",
    "do-not-reply@",
    "notifications@",
    "mailer-daemon@",
    "postmaster@",
    "bounce@",
    "calendar-notification@",
)


@dataclass(frozen=True)
class FilterResult:
    skip: bool
    reason: str | None = None


def is_low_value(subject: str | None, sender: str | None) -> FilterResult:
    """Whether a message can be dropped without reading it.

    Prefix matching on the subject, not substring: an email titled
    "Read: our notes on Acme Health" is a real message, while "Read: <subject>"
    as a prefix is a read receipt.
    """
    normalized_subject = (subject or "").strip().lower()
    for prefix in SKIP_SUBJECT_PREFIXES:
        if normalized_subject.startswith(prefix):
            return FilterResult(True, f"subject_prefix:{prefix.rstrip(':')}")

    normalized_sender = (sender or "").strip().lower()
    for pattern in SKIP_SENDER_PATTERNS:
        if pattern in normalized_sender:
            return FilterResult(True, f"sender:{pattern.rstrip('@')}")

    return FilterResult(False)
