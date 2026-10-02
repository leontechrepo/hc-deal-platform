#!/usr/bin/env python3
"""Historical mailbox backfill through the normal claim/classify path.

Walks an independent Graph delta query from --days ago for each selected
mailbox/folder. It never reads or advances the live delta watermark, and
per-message claims make re-runs idempotent (already-seen messages are skipped
without a model call), so an interrupted or budget-stopped backfill is simply
re-run.

Usage:
  python scripts/backfill.py --days 14 --dry-run                 # estimate volume + cost
  python scripts/backfill.py --days 14 --user a@x.com --folder inbox --execute \
      --max-messages 300 --max-cost 10
"""
from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import httpx

from app.core.config import settings
from app.db.session import AsyncSessionLocal, init_db
from app.graph.mail import fetch_messages_since

# Rough per-message cost used only for the dry-run projection.
ESTIMATED_COST_PER_MESSAGE_USD = Decimal("0.02")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill mailbox history without touching delta state")
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--user", action="append", help="limit to this configured mailbox (repeatable)")
    parser.add_argument("--folder", action="append", help="limit to this folder (repeatable)")
    parser.add_argument("--limit", type=int, default=None, help="dry-run: cap messages counted per mailbox")
    parser.add_argument("--max-messages", type=int, default=400)
    parser.add_argument("--max-cost", type=Decimal, default=Decimal("15"))
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="count messages and project cost (default)")
    mode.add_argument("--execute", action="store_true", help="classify and queue suggestions")
    args = parser.parse_args()

    users = [u for u in (args.user or settings.monitored_users) if u in settings.monitored_users]
    folders = args.folder or settings.graph_folders
    if not users:
        raise SystemExit("No matching monitored mailboxes (check --user against MONITORED_USER_*)")

    await init_db()

    if not args.execute:
        since = datetime.now(timezone.utc) - timedelta(days=args.days)
        total = 0
        async with httpx.AsyncClient(timeout=90.0) as client:
            for user in users:
                for folder in folders:
                    messages = await fetch_messages_since(
                        client, user_email=user, folder=folder, since=since, limit=args.limit
                    )
                    print(f"{user}/{folder}: {len(messages)} messages since {since.isoformat()}")
                    total += len(messages)
        projected = ESTIMATED_COST_PER_MESSAGE_USD * total
        print(f"Dry run: {total} messages, projected ~${projected} (upper bound; prefilter/dedupe skip many)")
        return

    from app.automation.budget import ScanBudget
    from app.automation.scanner import run_scan

    async with AsyncSessionLocal() as db:
        outcome = await run_scan(
            db,
            trigger="backfill",
            users=users,
            folders=folders,
            backfill_days=args.days,
            budget=ScanBudget(max_messages=args.max_messages, max_cost_usd=args.max_cost),
        )
    print(
        f"Backfill finished: status={outcome.status} seen={outcome.messages_seen} "
        f"classified={outcome.messages_classified} suggestions={outcome.suggestions_created} "
        f"cost=${outcome.estimated_cost_usd}"
    )
    if outcome.status == "budget_exceeded":
        print("Budget reached — re-run the same command to continue (seen messages are skipped).")


if __name__ == "__main__":
    asyncio.run(main())
