# Phase 1 backend report — Intake upgrade

## Backend changes

### Graph sync & scan control
- Replaced sliding time-window polling with Microsoft Graph **delta sync** per mailbox/folder (`app/graph/mail.py`, `app/db/graph_sync.py`, migration `036`).
- Added Graph HTTP retry/backoff, 401 token refresh, and 410 delta-token reseeding (`app/graph/http.py`, cached auth in `app/graph/auth.py`).
- Scanner uses session **advisory lock**, claim-before-classify (`UNIQUE (user_email, graph_message_id)`), per-message commits, stale `processing` claim recovery, scan budgets, and `scan_runs` / `llm_calls` observability (`app/automation/scanner.py`, migration `037`).

### Classification & approvals
- Async structured classifier with server-side company search (model picks index; server resolves UUID) — `app/automation/classifier.py`, `app/db/deal_search.py`.
- Corporate Credit field allowlist + validators with required evidence and funnel rules — `app/domain/field_updates.py`, `validate_stage_transition` in `app/domain/pipeline_stage.py`.
- Inbox approve/assign/reject preserve integer IDs, `/api/review-queue` aliases, legacy `stage` field; apply validators, file attachments, optional extraction enqueue — `app/api/inbox.py`.

### Attachments & storage
- Selective attachment policy + Graph fetch (`app/domain/attachments.py`, `app/graph/attachments.py`, `app/automation/attachments.py`), behind `ATTACHMENT_INGESTION_ENABLED`.
- Unfiled documents until approve/assign; sha256 dedupe; provenance tables — migration `038`, `app/db/documents.py`.
- Storage interface with **local** and **S3** backends; each row stores `storage_backend` — `app/storage/{base,local,s3,documents}.py`.

### Document extraction
- Independently flagged via `DOCUMENT_EXTRACTION_ENABLED` (also requires attachments).
- CC-only field allowlist (no RE property/cap-rate fields); never overwrites populated values; conflicts/low confidence → human review — `app/services/deal_extraction.py`, `app/services/ocr.py`.
- Minute scheduler job + status API `GET /api/deal-extractions/{run_id}`.

### APIs
- `GET /api/meta/features`, `GET /api/admin/scan-runs`, `GET /api/admin/cost`, unfiled document listing/filing on inbox.
- Extended document payloads with provenance/extraction fields.

## Migrations & rollout

See [docs/intake-rollout.md](docs/intake-rollout.md).

Order: `036_graph_sync` → `037_email_mining_upgrade` → `038_documents_attachments_extraction`.

Flags stay **off** by default. Enable attachments, then extraction, after verifying scan_runs cost/rejection metrics.

Backfill: `python scripts/backfill.py --days 14 --dry-run` then without `--dry-run`.

## Hardening added after review of the first implementation
- Advisory lock moved to a dedicated connection and released in `finally` (a session lock across a pooled, committing session could strand or fail to unlock).
- Orphaned `processing` claims are re-queued (not deleted), taken over on redelivery, or re-fetched by id; poison messages requeue instead of failing the scan.
- Graph `removed` entries stamp `email_scan_log.source_removed_at`; sync-state ops endpoints (`/api/admin/sync-state`, `/unpark`) added; backfill honours `--user/--folder/--days` on execute.
- Attachment outcomes (including skip reasons and failures) persisted per attachment, with retry; `store_document` is race- and orphan-safe.
- Extraction candidates persisted with dispositions and a reviewer API; cost recorded in `llm_calls`; `oid_pct`/`sofr_floor_pct` validators added; underwriting lock enforced for extraction.
- Fixed: `ebitda_margin` stored as a fraction while the UI edits points; `log_activity` called without `description`; `deal_activity` type violating a CHECK; extraction background task started before commit; deal deletion turning documents into unfiled ones and never deleting blobs (un-awaited coroutine); approval writing unparseable values raw into typed columns.

## Tests performed

`DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5544/hc_deal_test python -m pytest tests -q` → see the final report for the current count. New coverage: `test_scan_recovery.py` (lock, orphan takeover/redrive, poison message, cross-mailbox dedupe, resume from checkpoint, 410 reseed, removed ids), `test_extraction_workflow.py` (planner, tracked runs, conflicts, no-overwrite, reviewer actions, underwriting lock), `test_intake_flow.py` (attachment dispositions/retry, filing + duplicate prevention, approval validation, inbox provenance, scanner evidence/validator enforcement), extended `test_storage.py` and `test_deal_documents_api.py`.
