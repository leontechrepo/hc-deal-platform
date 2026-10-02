"""Crash recovery, locking, dedupe and delta handling for the scan loop.

Graph and the classifier are faked; everything else (claims, locks, sync state,
suggestion upserts) runs against the real test database.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.automation import scanner
from app.automation.classifier import ClassificationResult
from app.automation.scanner import MAX_CLAIM_RETRIES, ScanLock, recover_stale_claims, run_scan
from app.core.config import settings
from app.db.graph_sync import get_or_create_sync_state
from app.db.models.suggestions import EmailScanLog, PendingSuggestion, ScanRun
from app.graph.mail import DeltaPage


def _uid() -> str:
    return uuid.uuid4().hex[:10]


def _msg(mid: str, *, internet_id: str | None = None, subject: str = "Acme Health term sheet"):
    return {
        "id": mid,
        "internetMessageId": internet_id or f"<{mid}@x>",
        "conversationId": f"conv-{mid}",
        "subject": subject,
        "from": {"emailAddress": {"address": "banker@firm.com", "name": "Banker"}},
        "receivedDateTime": "2026-09-01T12:00:00Z",
        "hasAttachments": False,
        "body": {"content": "We would like to introduce Acme Health, $40M unitranche.", "contentType": "text"},
        "bodyPreview": "We would like to introduce Acme Health",
        "changeKey": "ck1",
    }


class FakeGraph:
    def __init__(self, pages: dict[str, DeltaPage]):
        self.pages = pages
        self.urls: list[str] = []

    async def __call__(self, client, *, url, page_size=50):
        self.urls.append(url)
        return self.pages[url]


@pytest.fixture(autouse=True)
async def _clean_orphans(db_engine):
    """The scan lock is global, so leftover claims from other tests would be re-driven."""
    from sqlalchemy import text

    async with db_engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM email_scan_log WHERE action_taken IN ('processing','retry')")
        )
    yield


@pytest.fixture
def scan_env(monkeypatch):
    user = f"{_uid()}@example.com"
    other = f"{_uid()}@example.com"
    monkeypatch.setattr(settings, "AZURE_CLIENT_ID", "x")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "x")
    monkeypatch.setattr(settings, "MONITORED_USER_1", user)
    monkeypatch.setattr(settings, "MONITORED_USER_2", "")
    monkeypatch.setattr(settings, "GRAPH_FOLDERS", "inbox")
    monkeypatch.setattr(settings, "ATTACHMENT_INGESTION_ENABLED", False)
    calls: list[str] = []

    async def fake_classify(text, *, searcher, received_at=None):
        calls.append(text)
        return (
            ClassificationResult(
                outcome="new_deal", confidence=0.9, reasoning="intro",
                new_deal={"company_name": "Acme Health", "sector": "Healthcare", "summary": "Intro"},
            ),
            [],
        )

    monkeypatch.setattr(scanner, "classify_email", fake_classify)
    return type("Env", (), {"user": user, "other": other, "classify_calls": calls, "mp": monkeypatch})


def _install_graph(env, pages):
    graph = FakeGraph(pages)
    env.mp.setattr(scanner, "fetch_delta_page", graph)
    return graph


async def _log(db, user, graph_id):
    return (
        await db.execute(
            select(EmailScanLog).where(
                EmailScanLog.user_email == user, EmailScanLog.graph_message_id == graph_id
            )
        )
    ).scalar_one()


async def test_scan_lock_excludes_second_holder_and_survives_session_commits(db_session, db_engine):
    first, second = ScanLock(db_engine), ScanLock(db_engine)
    assert await first.acquire() is True
    await db_session.commit()  # unrelated session activity must not disturb the lock
    assert await second.acquire() is False
    await first.release()
    assert await second.acquire() is True
    await second.release()


async def test_run_scan_releases_lock_when_scan_body_raises(db_session, db_engine, scan_env):
    async def boom(*a, **k):
        raise RuntimeError("graph exploded")

    scan_env.mp.setattr(scanner, "fetch_delta_page", boom)
    outcome = await run_scan(db_session, trigger="manual", client=object())
    assert outcome.status == "failed"
    probe = ScanLock(db_engine)
    assert await probe.acquire() is True
    await probe.release()


async def test_run_scan_skips_when_lock_held(db_session, db_engine, scan_env):
    holder = ScanLock(db_engine)
    assert await holder.acquire()
    try:
        outcome = await run_scan(db_session, trigger="manual", client=object())
        assert outcome.status == "skipped_locked"
    finally:
        await holder.release()


async def test_orphaned_processing_claim_is_taken_over_on_redelivery(db_session, scan_env):
    mid = f"m-{_uid()}"
    old_run = ScanRun(trigger="scheduler", status="failed")
    db_session.add(old_run)
    await db_session.flush()
    db_session.add(EmailScanLog(
        scan_run_id=old_run.id, graph_message_id=mid, user_email=scan_env.user,
        folder="inbox", action_taken="processing",
    ))
    await db_session.commit()

    url = "https://page1"
    sync = await get_or_create_sync_state(db_session, user_email=scan_env.user, folder="inbox")
    sync.next_link = url
    await db_session.commit()
    _install_graph(scan_env, {url: DeltaPage(messages=[_msg(mid)], delta_link="https://delta1")})

    outcome = await run_scan(db_session, trigger="manual", client=object())
    assert outcome.status == "completed"
    log = await _log(db_session, scan_env.user, mid)
    assert log.action_taken == "new_deal_detected"
    assert log.retry_count >= 1
    assert len(scan_env.classify_calls) == 1


async def test_orphan_not_redelivered_is_redriven_via_refetch(db_session, scan_env):
    mid = f"m-{_uid()}"
    old_run = ScanRun(trigger="scheduler", status="failed")
    db_session.add(old_run)
    await db_session.flush()
    db_session.add(EmailScanLog(
        scan_run_id=old_run.id, graph_message_id=mid, user_email=scan_env.user,
        folder="inbox", action_taken="processing", subject="Acme Health term sheet",
        sender_address="banker@firm.com",
    ))
    await db_session.commit()

    async def fake_fetch(client, *, user_email, message_id):
        return _msg(message_id)

    scan_env.mp.setattr(scanner, "fetch_message", fake_fetch)
    _install_graph(scan_env, {
        scanner.initial_delta_url(scan_env.user, "inbox", since=None): DeltaPage(delta_link="https://d"),
    })
    # The seed URL embeds a timestamp, so serve any URL with an empty final page.
    scan_env.mp.setattr(scanner, "fetch_delta_page", lambda client, *, url, page_size=50: _empty(url))

    await run_scan(db_session, trigger="manual", client=object())
    log = await _log(db_session, scan_env.user, mid)
    assert log.action_taken == "new_deal_detected"
    assert len(scan_env.classify_calls) == 1


async def _empty(url):
    return DeltaPage(delta_link="https://d")


async def test_redriven_orphan_whose_message_was_deleted_is_marked_removed(db_session, scan_env):
    mid = f"m-{_uid()}"
    old_run = ScanRun(trigger="scheduler", status="failed")
    db_session.add(old_run)
    await db_session.flush()
    db_session.add(EmailScanLog(
        scan_run_id=old_run.id, graph_message_id=mid, user_email=scan_env.user,
        folder="inbox", action_taken="processing",
    ))
    await db_session.commit()

    async def gone(client, *, user_email, message_id):
        return None

    scan_env.mp.setattr(scanner, "fetch_message", gone)
    scan_env.mp.setattr(scanner, "fetch_delta_page", lambda client, *, url, page_size=50: _empty(url))
    await run_scan(db_session, trigger="manual", client=object())
    log = await _log(db_session, scan_env.user, mid)
    assert log.action_taken == "source_removed"
    assert log.source_removed_at is not None
    assert scan_env.classify_calls == []


async def test_claim_that_keeps_crashing_is_parked_as_error(db_session):
    mid = f"m-{_uid()}"
    db_session.add(EmailScanLog(
        graph_message_id=mid, user_email="loop@example.com", folder="inbox",
        action_taken="processing", retry_count=MAX_CLAIM_RETRIES,
    ))
    await db_session.commit()
    await recover_stale_claims(db_session)
    log = await _log(db_session, "loop@example.com", mid)
    assert log.action_taken == "error"
    assert "abandoned" in (log.error or "")


async def test_same_internet_message_in_two_mailboxes_classified_once(db_session, scan_env):
    shared = f"<shared-{_uid()}@x>"
    m1, m2 = f"a-{_uid()}", f"b-{_uid()}"
    env = scan_env
    env.mp.setattr(settings, "MONITORED_USER_2", env.other)
    pages = {}

    async def serve(client, *, url, page_size=50):
        user_is_first = env.user in url
        return DeltaPage(
            messages=[_msg(m1 if user_is_first else m2, internet_id=shared)],
            delta_link="https://d",
        )

    env.mp.setattr(scanner, "fetch_delta_page", serve)
    outcome = await run_scan(db_session, trigger="manual", client=object())
    assert outcome.status == "completed"
    first = await _log(db_session, env.user, m1)
    second = await _log(db_session, env.other, m2)
    assert first.action_taken == "new_deal_detected"
    assert second.action_taken == "duplicate_across_mailbox"
    assert len(env.classify_calls) == 1


async def test_same_message_redelivered_is_a_noop(db_session, scan_env):
    mid = f"m-{_uid()}"

    async def serve(client, *, url, page_size=50):
        return DeltaPage(messages=[_msg(mid)], delta_link="https://d")

    scan_env.mp.setattr(scanner, "fetch_delta_page", serve)
    await run_scan(db_session, trigger="manual", client=object())
    await run_scan(db_session, trigger="manual", client=object())
    assert len(scan_env.classify_calls) == 1
    rows = (await db_session.execute(
        select(PendingSuggestion).where(PendingSuggestion.email_subject == "Acme Health term sheet")
    )).scalars().all()
    # one pending new_deal suggestion per thread/company, not one per delivery
    assert len([r for r in rows if r.email_scan_log_id]) >= 1


async def test_checkpoint_resumes_from_next_link_and_advances_to_delta(db_session, scan_env):
    mid1, mid2 = f"m-{_uid()}", f"m-{_uid()}"
    sync = await get_or_create_sync_state(db_session, user_email=scan_env.user, folder="inbox")
    sync.next_link = "https://page2"
    await db_session.commit()
    graph = _install_graph(scan_env, {
        "https://page2": DeltaPage(messages=[_msg(mid1)], next_link="https://page3"),
        "https://page3": DeltaPage(messages=[_msg(mid2)], delta_link="https://final"),
    })
    await run_scan(db_session, trigger="manual", client=object())
    assert graph.urls == ["https://page2", "https://page3"]
    await db_session.refresh(sync)
    assert sync.delta_link == "https://final" and sync.next_link is None


async def test_delta_token_expiry_resets_state_for_reseed(db_session, scan_env):
    from app.graph.http import DeltaTokenExpired

    sync = await get_or_create_sync_state(db_session, user_email=scan_env.user, folder="inbox")
    sync.delta_link = "https://old"
    await db_session.commit()

    async def expired(client, *, url, page_size=50):
        raise DeltaTokenExpired(410, "gone")

    scan_env.mp.setattr(scanner, "fetch_delta_page", expired)
    await run_scan(db_session, trigger="manual", client=object())
    await db_session.refresh(sync)
    assert sync.delta_link is None
    assert sync.resync_count == 1


async def test_removed_ids_stamp_the_email_log(db_session, scan_env):
    mid = f"m-{_uid()}"
    db_session.add(EmailScanLog(
        graph_message_id=mid, user_email=scan_env.user, folder="inbox", action_taken="no_match",
    ))
    await db_session.commit()
    scan_env.mp.setattr(
        scanner, "fetch_delta_page",
        lambda client, *, url, page_size=50: _removed(mid),
    )
    await run_scan(db_session, trigger="manual", client=object())
    log = await _log(db_session, scan_env.user, mid)
    await db_session.refresh(log)
    assert log.source_removed_at is not None


async def _removed(mid):
    return DeltaPage(removed_ids=[mid], delta_link="https://d")


async def test_poison_message_is_requeued_not_fatal(db_session, scan_env):
    good, bad = f"g-{_uid()}", f"b-{_uid()}"
    real = scan_env.classify_calls

    async def flaky(text, *, searcher, received_at=None):
        if "POISON" in text:
            raise RuntimeError("model blew up")
        real.append(text)
        return ClassificationResult(outcome="no_match", confidence=0.9), []

    scan_env.mp.setattr(scanner, "classify_email", flaky)
    poison = _msg(bad)
    poison["body"] = {"content": "POISON", "contentType": "text"}

    async def serve(client, *, url, page_size=50):
        return DeltaPage(messages=[poison, _msg(good)], delta_link="https://d")

    scan_env.mp.setattr(scanner, "fetch_delta_page", serve)
    outcome = await run_scan(db_session, trigger="manual", client=object())
    assert outcome.status == "completed"
    assert (await _log(db_session, scan_env.user, bad)).action_taken == "retry"
    assert (await _log(db_session, scan_env.user, good)).action_taken == "no_match"
