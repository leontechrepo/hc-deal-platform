"""Company/deal lookup for the email classifier.

The model never sees or emits a deal UUID — it picks a 1-based index from a
short candidate list and the server resolves the id.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.deals import Deal

RESULT_LIMIT = 5
EXCLUDED_STATUSES = ("Passed", "Dead")
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


@dataclass(frozen=True)
class DealCandidate:
    deal_id: uuid.UUID
    company_name: str
    pipeline_stage: str
    status: str
    sector: str | None
    location: str | None
    score: float
    match_reason: str

    def for_model(self, index: int) -> dict:
        return {
            "index": index,
            "company_name": self.company_name,
            "pipeline_stage": self.pipeline_stage,
            "status": self.status,
            "sector": self.sector,
            "location": self.location,
            "match_score": round(self.score, 2),
            "match_reason": self.match_reason,
        }


def _normalize(text: str) -> str:
    return " ".join(_NON_ALNUM.sub(" ", (text or "").lower()).split())


def _score(query: str, name: str) -> float:
    q = _normalize(query)
    n = _normalize(name)
    if not q or not n:
        return 0.0
    if q == n:
        return 1.0
    if q in n or n in q:
        return 0.85
    q_tokens = set(q.split())
    n_tokens = set(n.split())
    if not q_tokens:
        return 0.0
    overlap = len(q_tokens & n_tokens) / len(q_tokens)
    return overlap


async def search_deals_by_company(
    db: AsyncSession, query: str, *, limit: int = RESULT_LIMIT
) -> list[DealCandidate]:
    q = (query or "").strip()
    if not q:
        return []

    deals = list(
        (
            await db.execute(
                select(Deal).where(~Deal.status.in_(list(EXCLUDED_STATUSES)))
            )
        ).scalars().all()
    )

    scored: list[DealCandidate] = []
    for deal in deals:
        score = _score(q, deal.company_name)
        if score < 0.45:
            continue
        scored.append(
            DealCandidate(
                deal_id=deal.id,
                company_name=deal.company_name,
                pipeline_stage=deal.pipeline_stage,
                status=deal.status,
                sector=deal.sector_primary,
                location=deal.location,
                score=score,
                match_reason="company_name",
            )
        )
    scored.sort(key=lambda c: (-c.score, c.company_name))
    return scored[:limit]


def resolve_candidate(
    candidates: list[DealCandidate], index: int | None
) -> DealCandidate | None:
    if index is None:
        return None
    try:
        i = int(index)
    except (TypeError, ValueError):
        return None
    if i < 1 or i > len(candidates):
        return None
    return candidates[i - 1]
