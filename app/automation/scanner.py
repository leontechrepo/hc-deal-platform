"""
Email scanner: reads two M365 inboxes, sends each email through Claude to match
against existing deals, and writes updates back to the database.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Deal, DealUpdateLog, EmailScanLog, PendingSuggestion
from app.graph.mail import fetch_messages_since

_SKIP_SUBJECT_PREFIXES = (
    "accepted:", "declined:", "tentative:",
    "automatic reply:", "out of office:", "auto-reply:",
)
_SKIP_SENDER_PATTERNS = ("noreply@", "no-reply@", "donotreply@")


def _is_low_value(subject: str, sender: str) -> bool:
    subj = subject.lower().strip()
    if any(subj.startswith(p) for p in _SKIP_SUBJECT_PREFIXES):
        return True
    return any(p in sender.lower() for p in _SKIP_SENDER_PATTERNS)


def _build_system_prompt(deals: list[Deal]) -> str:
    deal_list = "\n".join(
        f"- ID {d.id}: {d.company_name} (stage: {d.stage}, bucket: {d.bucket}, sector: {d.sector_primary})"
        for d in deals
        if d.bucket not in ("Dead-Hold",)
    )
    return f"""You are a deal pipeline assistant for Leon Healthcare Partners (LHP), a healthcare private credit firm.

Active deals in pipeline:
{deal_list}

When given an email, return ONLY valid JSON in one of these formats:

Matched existing deal:
{{"matched": true, "deal_id": 123, "confidence": 0.9, "commentary": "One sentence update (max 120 chars).", "field_updates": [{{"field": "nda", "value": "P", "reasoning": "NDA confirmed signed"}}]}}
(omit field_updates if no structural changes are clearly evidenced)

New healthcare investment opportunity not in pipeline:
{{"matched": false, "new_deal": true, "confidence": 0.75, "company_name": "Acme Health", "sector": "Cardiology", "summary": "Brief one-sentence description."}}

No match / not relevant:
{{"matched": false}}

Updatable fields: stage, bucket, nda, mgmt_meeting, ioi_offered, ioi_signed.
Rules:
- confidence 0.0-1.0; use 0.85+ only when unambiguous
- commentary max 120 characters
- Only propose field_updates when evidence is explicit (e.g. "NDA was executed today")
- new_deal only for genuine healthcare investment opportunity introductions
- Do not match calendar accepts/declines, meeting invites, or internal admin messages"""


async def _classify_email(
    subject: str,
    body: str,
    deals: list[Deal],
    anthropic_client,
) -> dict:
    import anthropic

    system = _build_system_prompt(deals)
    email_text = f"Subject: {subject}\n\n{body[:2000]}"

    message = anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=[
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": email_text}],
    )

    raw = message.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"matched": False}


async def _upsert_suggestion(
    db: AsyncSession,
    *,
    deal_id: int | None,
    thread_id: str | None,
    scan_log_id: int,
    suggested_field: str,
    suggested_value: str | None,
    claude_summary: str | None,
    email_subject: str,
    confidence: float,
    current_value: str | None = None,
) -> None:
    """Create suggestion or update an existing pending one for the same (deal, thread, field)."""
    if thread_id:
        deal_filter = (
            PendingSuggestion.deal_id.is_(None)
            if deal_id is None
            else PendingSuggestion.deal_id == deal_id
        )
        existing_result = await db.execute(
            select(PendingSuggestion)
            .join(EmailScanLog, PendingSuggestion.email_scan_log_id == EmailScanLog.id)
            .where(
                deal_filter,
                PendingSuggestion.status == "pending",
                PendingSuggestion.suggested_field == suggested_field,
                EmailScanLog.thread_id == thread_id,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            existing.suggested_value = suggested_value
            existing.claude_summary = claude_summary
            existing.confidence = confidence
            existing.email_subject = email_subject
            existing.email_scan_log_id = scan_log_id
            return

    db.add(PendingSuggestion(
        deal_id=deal_id,
        email_scan_log_id=scan_log_id,
        suggested_field=suggested_field,
        suggested_value=suggested_value,
        claude_summary=claude_summary,
        email_subject=email_subject,
        confidence=confidence,
        current_value=current_value,
        source="email_scan",
        status="pending",
    ))


async def run_scan(db: AsyncSession) -> int:
    if not settings.AZURE_CLIENT_ID or not settings.ANTHROPIC_API_KEY:
        return 0

    import anthropic
    anthropic_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    result = await db.execute(select(Deal))
    deals = result.scalars().all()

    since = datetime.now(timezone.utc) - timedelta(minutes=settings.SCAN_INTERVAL_MINUTES + 30)
    processed = 0

    async with httpx.AsyncClient(timeout=30) as client:
        for user_email in settings.monitored_users:
            try:
                messages = await fetch_messages_since(user_email, since, client)
            except Exception as e:
                print(f"[scanner] Error fetching mail for {user_email}: {e}")
                continue

            for msg in messages:
                msg_id = msg.get("id", "")
                thread_id = msg.get("conversationId")
                subject = msg.get("subject", "") or ""
                body = (msg.get("body") or {}).get("content", msg.get("bodyPreview", ""))
                sender = (msg.get("from") or {}).get("emailAddress", {}).get("address", "")
                received_str = msg.get("receivedDateTime")
                received_at = None
                if received_str:
                    try:
                        received_at = datetime.fromisoformat(received_str.replace("Z", "+00:00"))
                    except ValueError:
                        pass

                # Skip already-processed messages
                existing_log = await db.execute(
                    select(EmailScanLog).where(EmailScanLog.graph_message_id == msg_id)
                )
                if existing_log.scalar_one_or_none():
                    continue

                # Skip calendar responses and auto-replies without calling Claude
                if _is_low_value(subject, sender):
                    db.add(EmailScanLog(
                        graph_message_id=msg_id,
                        user_email=user_email,
                        subject=subject,
                        thread_id=thread_id,
                        received_at=received_at,
                        action_taken="filtered",
                    ))
                    processed += 1
                    continue

                try:
                    result_cls = await _classify_email(subject, body, deals, anthropic_client)
                except Exception as e:
                    print(f"[scanner] Claude error on msg {msg_id}: {e}")
                    result_cls = {"matched": False}

                confidence = float(result_cls.get("confidence") or 0.0)

                scan_log = EmailScanLog(
                    graph_message_id=msg_id,
                    user_email=user_email,
                    subject=subject,
                    thread_id=thread_id,
                    received_at=received_at,
                    matched_deal_id=None,
                    claude_summary=None,
                    action_taken="no_match",
                )
                db.add(scan_log)
                await db.flush()

                if result_cls.get("matched") and confidence >= 0.65:
                    deal_id = result_cls.get("deal_id")
                    commentary = result_cls.get("commentary", "")
                    field_updates = result_cls.get("field_updates") or []

                    deal_res = await db.execute(select(Deal).where(Deal.id == deal_id))
                    deal = deal_res.scalar_one_or_none()
                    if deal:
                        scan_log.matched_deal_id = deal_id
                        scan_log.claude_summary = commentary
                        scan_log.action_taken = "queued_for_review"

                        ts = datetime.now(timezone.utc).strftime("%Y/%m/%d")
                        await _upsert_suggestion(
                            db,
                            deal_id=deal_id,
                            thread_id=thread_id,
                            scan_log_id=scan_log.id,
                            suggested_field="commentary",
                            suggested_value=f"{ts}: [Auto] {commentary}",
                            claude_summary=commentary,
                            email_subject=subject,
                            confidence=confidence,
                            current_value=deal.commentary,
                        )

                        for fu in field_updates:
                            field = fu.get("field", "")
                            value = fu.get("value", "")
                            if field and hasattr(deal, field):
                                await _upsert_suggestion(
                                    db,
                                    deal_id=deal_id,
                                    thread_id=thread_id,
                                    scan_log_id=scan_log.id,
                                    suggested_field=field,
                                    suggested_value=str(value),
                                    claude_summary=fu.get("reasoning", ""),
                                    email_subject=subject,
                                    confidence=confidence,
                                    current_value=str(getattr(deal, field) or ""),
                                )

                elif result_cls.get("new_deal") and confidence >= 0.65:
                    company_name = result_cls.get("company_name", "")
                    sector = result_cls.get("sector", "")
                    summary = result_cls.get("summary", "")

                    scan_log.action_taken = "new_deal_detected"
                    scan_log.claude_summary = summary

                    await _upsert_suggestion(
                        db,
                        deal_id=None,
                        thread_id=thread_id,
                        scan_log_id=scan_log.id,
                        suggested_field="new_deal",
                        suggested_value=json.dumps({
                            "company_name": company_name,
                            "sector": sector,
                            "summary": summary,
                        }),
                        claude_summary=summary,
                        email_subject=subject,
                        confidence=confidence,
                    )

                processed += 1

    await db.commit()
    return processed
