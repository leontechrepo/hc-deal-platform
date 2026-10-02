"""Suggestion dedupe keys for thread-level inbox card collapse."""
from __future__ import annotations

import hashlib
import re
import uuid

_SEP = "\x1f"
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize_company_name(name: str | None) -> str:
    text = (name or "").strip().lower()
    text = _NON_ALNUM.sub(" ", text)
    return " ".join(text.split())


def suggestion_dedupe_key(
    *,
    deal_id: uuid.UUID | None,
    thread_id: str | None,
    kind: str,
    field: str | None = None,
    discriminator: str | None = None,
) -> str:
    parts = [
        str(deal_id) if deal_id else "-",
        thread_id or "-",
        kind,
        field or "-",
        discriminator or "-",
    ]
    return hashlib.sha256(_SEP.join(parts).encode()).hexdigest()


def new_deal_discriminator(payload: dict) -> str:
    """Distinguish two new-deal suggestions on the same thread by company name."""
    return normalize_company_name(payload.get("company_name")) or "unknown"
