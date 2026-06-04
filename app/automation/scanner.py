"""
Email scanner: reads two M365 inboxes, sends each email through Claude to match
against existing deals, and writes updates back to the database.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import Deal, DealUpdateLog, EmailScanLog, PendingSuggestion
from app.graph.mail import fetch_messages_since


def _build_system_prompt(deals: list[Deal]) -> str:
    deal_list = "\n".join(
        f"- ID {d.id}: {d.company_name} (stage: {d.stage}, sector: {d.sector_primary})"
        for d in deals
        if d.bucket not in ("Dead-Hold",)
    )
    return f"""You are a deal pipeline assistant for Leon Healthcare Partners (LHP), a healthcare private credit firm.

Active deals in pipeline:
{deal_list}

When given an email, determine:
1. Does this email relate to any of the deals listed above?
2. If yes, what is the deal ID and a concise one-sentence status update?

Return ONLY valid JSON in this exact format:
{{"matched": true, "deal_id": 123, "summary": "One sentence update extracted from the email."}}
OR
{{"matched": false}}

Rules:
- Match by company name, project name, or obvious reference.
- If uncertain, return {{"matched": false}}.
- Keep summary under 120 characters.
- Do not match internal admin emails or generic messages."""


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
        max_tokens=256,
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
    # Strip markdown fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"matched": False}


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

                # Skip already processed
                existing = await db.execute(
                    select(EmailScanLog).where(EmailScanLog.graph_message_id == msg_id)
                )
                if existing.scalar_one_or_none():
                    continue

                subject = msg.get("subject", "")
                body = (msg.get("body") or {}).get("content", msg.get("bodyPreview", ""))
                received_str = msg.get("receivedDateTime")
                received_at = None
                if received_str:
                    try:
                        received_at = datetime.fromisoformat(received_str.replace("Z", "+00:00"))
                    except ValueError:
                        pass

                try:
                    result_cls = await _classify_email(subject, body, deals, anthropic_client)
                except Exception as e:
                    print(f"[scanner] Claude error on msg {msg_id}: {e}")
                    result_cls = {"matched": False}

                matched_deal_id = None
                action = "no_match"
                summary = None
                scan_log_id = None

                # Write the scan log first so we can link it to the suggestion
                scan_log = EmailScanLog(
                    graph_message_id=msg_id,
                    user_email=user_email,
                    subject=subject,
                    received_at=received_at,
                    matched_deal_id=None,
                    claude_summary=None,
                    action_taken="no_match",
                )
                db.add(scan_log)
                await db.flush()  # get scan_log.id

                if result_cls.get("matched"):
                    deal_id = result_cls.get("deal_id")
                    summary = result_cls.get("summary", "")

                    deal_res = await db.execute(select(Deal).where(Deal.id == deal_id))
                    deal = deal_res.scalar_one_or_none()
                    if deal:
                        matched_deal_id = deal_id
                        action = "queued_for_review"

                        # Queue for human review — do NOT write to deals directly
                        ts = datetime.now(timezone.utc).strftime("%Y/%m/%d")
                        proposed = f"{ts}: [Auto] {summary}"
                        db.add(PendingSuggestion(
                            deal_id=deal_id,
                            email_scan_log_id=scan_log.id,
                            suggested_field="commentary",
                            suggested_value=proposed,
                            claude_summary=summary,
                            email_subject=subject,
                            source="email_scan",
                            status="pending",
                        ))

                scan_log.matched_deal_id = matched_deal_id
                scan_log.claude_summary = summary
                scan_log.action_taken = action
                processed += 1

    await db.commit()
    return processed
