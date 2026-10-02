"""Async structured email classification for Corporate Credit deals."""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from anthropic import AsyncAnthropic

from app.core.config import settings
from app.db.deal_search import DealCandidate, resolve_candidate
from app.domain.field_updates import allowed_field_enum, field_format_hints
from app.domain.pipeline_stage import PIPELINE_STAGES, STAGE_DEFINITIONS, STATUSES
from app.domain.pricing import Usage, estimate_cost

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 4
MAX_TOKENS = 4096
MIN_CONFIDENCE = 0.65
SCHEMA_ENUM_BUDGET = 30

SEARCH_BY_COMPANY_TOOL: dict[str, Any] = {
    "name": "search_deals_by_company",
    "description": (
        "Search the active Corporate Credit pipeline by company / borrower name. "
        "Call this when the email mentions a company that may already be a deal. "
        "You may call more than once with alternate spellings. Returns a numbered "
        "list of candidates, or an empty list. Never invent a deal identifier."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "company_name": {
                "type": "string",
                "description": "Company name as written in the email.",
            }
        },
        "required": ["company_name"],
        "additionalProperties": False,
    },
}

TOOLS = [SEARCH_BY_COMPANY_TOOL]


def build_output_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["outcome", "confidence", "reasoning"],
        "properties": {
            "outcome": {
                "type": "string",
                "enum": ["matched", "new_deal", "no_match"],
            },
            "confidence": {"type": "number"},
            "reasoning": {
                "type": "string",
                "description": "One sentence explaining the outcome.",
            },
            "candidate_index": {
                "type": "integer",
                "description": "matched only: 1-based index from the latest search.",
            },
            "commentary": {
                "type": "string",
                "description": "matched only: one sentence, at most 200 characters.",
            },
            "field_updates": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["field", "value", "evidence"],
                    "properties": {
                        "field": {"type": "string", "enum": allowed_field_enum()},
                        "value": {"type": "string"},
                        "evidence": {
                            "type": "string",
                            "description": "Exact supporting phrase from the email.",
                        },
                    },
                },
            },
            "new_deal": {
                "type": "object",
                "additionalProperties": False,
                "required": ["company_name"],
                "properties": {
                    "company_name": {"type": "string"},
                    "sector": {"type": "string"},
                    "summary": {"type": "string"},
                    "estimated_size_m": {"type": "number"},
                },
            },
        },
    }


def build_system_prompt() -> str:
    stages = "\n".join(
        f"{i + 1}. {stage} — {STAGE_DEFINITIONS[stage]}"
        for i, stage in enumerate(PIPELINE_STAGES)
    )
    return f"""You read a healthcare private-credit firm's email and propose updates \
to its Corporate Credit deal pipeline. Every proposal is reviewed by a person \
before it changes any record.

# Your task

Decide whether the email concerns a deal already in the pipeline, describes a \
new healthcare credit opportunity, or is not deal-related.

Search with search_deals_by_company before concluding a match. Answer with the \
candidate number, never a UUID. If nothing convincing comes back, use new_deal \
or no_match — do not settle for the closest deal.

# Pipeline stages, in order

{stages}

A deal advances one stage at a time. Propose a stage change only when the email \
states the milestone was reached. Never propose skipping or moving backward.

Statuses: {', '.join(STATUSES)}.

# What you may propose

commentary — on a matched deal, one present-tense sentence, at most 200 characters.

field_updates — only for facts stated outright, with evidence quoting the exact \
supporting phrase. If you cannot quote it, do not propose it.

{field_format_hints()}

new_deal — a genuine healthcare investment opportunity introduction. Not market \
reports, newsletters, calendar mail, or vendor solicitations.

# Judgment

Confidence 0–1. Reserve 0.85+ for unambiguous identification and explicit facts. \
Prefer no_match over a low-quality guess.
"""


@dataclass
class ClassificationResult:
    outcome: str = "no_match"
    confidence: float = 0.0
    reasoning: str = ""
    matched_candidate: DealCandidate | None = None
    commentary: str | None = None
    field_updates: list[dict[str, str]] = field(default_factory=list)
    new_deal: dict[str, Any] | None = None
    usage: Usage = field(default_factory=Usage)
    cost_usd: Any = 0
    rounds: int = 0
    error: str | None = None

    @property
    def is_confident(self) -> bool:
        return self.confidence >= MIN_CONFIDENCE


@dataclass
class LLMCallRecord:
    model: str
    tool_round: int
    usage: Usage
    cost_usd: Any
    latency_ms: int
    stop_reason: str | None
    request_id: str | None
    error: str | None = None


class DealSearcher:
    async def by_company(self, query: str) -> list[DealCandidate]:  # pragma: no cover
        raise NotImplementedError


def _client() -> AsyncAnthropic:
    return AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


async def classify_email(
    prepared_text: str,
    *,
    searcher: DealSearcher,
    client: AsyncAnthropic | None = None,
    model: str | None = None,
    received_at: datetime | None = None,
) -> tuple[ClassificationResult, list[LLMCallRecord]]:
    client = client or _client()
    model = model or settings.CLASSIFIER_MODEL
    system_prompt = build_system_prompt()

    messages: list[dict[str, Any]] = [{"role": "user", "content": prepared_text}]
    calls: list[LLMCallRecord] = []
    total_usage = Usage()
    last_candidates: list[DealCandidate] = []

    for round_index in range(MAX_TOOL_ROUNDS):
        started = time.monotonic()
        try:
            # Prefer structured outputs when available; fall back to tools-only.
            kwargs: dict[str, Any] = {
                "model": model,
                "max_tokens": MAX_TOKENS,
                "system": [{
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }],
                "tools": TOOLS,
                "messages": messages,
            }
            try:
                response = await client.messages.create(
                    **kwargs,
                    output_config={
                        "format": {
                            "type": "json_schema",
                            "schema": build_output_schema(),
                        },
                    },
                )
            except TypeError:
                response = await client.messages.create(**kwargs)
            except Exception as structured_exc:
                # Older API / model without output_config —
                # retry without it rather than failing the email.
                if "output_config" in str(structured_exc) or "json_schema" in str(structured_exc):
                    response = await client.messages.create(**kwargs)
                else:
                    raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("Classifier call failed: %s", exc)
            calls.append(
                LLMCallRecord(
                    model=model,
                    tool_round=round_index,
                    usage=Usage(),
                    cost_usd=0,
                    latency_ms=int((time.monotonic() - started) * 1000),
                    stop_reason=None,
                    request_id=None,
                    error=str(exc)[:500],
                )
            )
            return (
                ClassificationResult(
                    usage=total_usage, rounds=round_index, error=str(exc)[:500]
                ),
                calls,
            )

        usage = Usage.from_response(response.usage)
        total_usage = total_usage + usage
        calls.append(
            LLMCallRecord(
                model=model,
                tool_round=round_index,
                usage=usage,
                cost_usd=estimate_cost(model, usage),
                latency_ms=int((time.monotonic() - started) * 1000),
                stop_reason=response.stop_reason,
                request_id=getattr(response, "_request_id", None),
            )
        )

        if response.stop_reason == "refusal":
            return (
                ClassificationResult(
                    usage=total_usage, rounds=round_index + 1, error="refused"
                ),
                calls,
            )

        tool_uses = [
            b for b in response.content if getattr(b, "type", None) == "tool_use"
        ]
        if not tool_uses:
            result = _parse_answer(response, last_candidates)
            result.usage = total_usage
            result.cost_usd = estimate_cost(model, total_usage)
            result.rounds = round_index + 1
            return result, calls

        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for block in tool_uses:
            candidates = await _run_tool(block, searcher)
            if candidates is not None:
                last_candidates = candidates
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": json.dumps(
                    [c.for_model(i) for i, c in enumerate(last_candidates, start=1)]
                    if candidates is not None
                    else {"error": f"unknown tool: {block.name}"}
                ),
            })
        messages.append({"role": "user", "content": tool_results})

    return (
        ClassificationResult(
            usage=total_usage,
            cost_usd=estimate_cost(model, total_usage),
            rounds=MAX_TOOL_ROUNDS,
            error="max_rounds",
        ),
        calls,
    )


async def _run_tool(block, searcher: DealSearcher) -> list[DealCandidate] | None:
    payload = block.input or {}
    if block.name == "search_deals_by_company":
        return await searcher.by_company(
            payload.get("company_name") or payload.get("query") or ""
        )
    logger.warning("Classifier asked for an unknown tool: %s", block.name)
    return None


def _parse_answer(response, candidates: list[DealCandidate]) -> ClassificationResult:
    text_block = next(
        (b for b in response.content if getattr(b, "type", None) == "text"), None
    )
    if text_block is None:
        return ClassificationResult(error="no_text_block")

    raw = text_block.text.strip()
    if raw.startswith("```"):
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return ClassificationResult(error="unparseable_answer")

    outcome = payload.get("outcome", "no_match")
    result = ClassificationResult(
        outcome=outcome,
        confidence=float(payload.get("confidence") or 0.0),
        reasoning=payload.get("reasoning", ""),
        commentary=payload.get("commentary"),
        field_updates=payload.get("field_updates") or [],
        new_deal=payload.get("new_deal"),
    )

    if outcome == "matched":
        matched = resolve_candidate(candidates, payload.get("candidate_index"))
        if matched is None:
            return ClassificationResult(
                outcome="no_match",
                confidence=result.confidence,
                reasoning=result.reasoning,
                error="unresolvable_candidate",
            )
        result.matched_candidate = matched

    if outcome == "new_deal" and not result.new_deal:
        return ClassificationResult(
            outcome="no_match",
            confidence=result.confidence,
            reasoning=result.reasoning,
            error="new_deal_without_payload",
        )

    return result
