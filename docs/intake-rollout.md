# Intake pipeline rollout (backend)

## What changed

| Area | Behaviour |
|------|-----------|
| Mail sync | Microsoft Graph **delta** per mailbox + folder (`graph_sync_state`). A page checkpoint (`next_link`) is saved after every page, so an interrupted scan resumes mid-sync. A 410 clears the link and reseeds from the last 7 days. Folders that fail 5 times in a row are **parked** until an operator un-parks them. Graph calls retry 429/5xx with `Retry-After`/backoff and refresh the token once on 401. |
| Scan safety | One scan at a time across replicas via a Postgres advisory lock held on a **dedicated connection** (released in `finally`). Each message is claimed (`UNIQUE(user_email, graph_message_id)`) and committed before the model call. The same `internetMessageId` seen in another mailbox is not classified twice. |
| Crash recovery | Because the lock is held, any `processing` claim from a *different* run is orphaned. It is marked `retry` immediately (up to 3 attempts, then `error`), taken over if Graph redelivers the message, or re-fetched by id if it does not. A message deleted in Graph becomes `source_removed`. One poison message is requeued; it never stops the scan. |
| Accounting | `scan_runs` (counters, tokens, cost, rejection reasons), `llm_calls` (one row per model call, **including extraction**). Budgets: 400 messages / 600 calls / $15 per run, $60 per rolling day (computed from `llm_calls`). |
| Classification | Async structured output; the model picks a numbered candidate and the **server** resolves the deal id. Every proposed field update needs evidence and passes the credit allowlist + validator; nothing is applied until a reviewer approves it. |
| Attachments | Only after an email produces a suggestion. Every attachment gets a recorded outcome in `email_scan_log.attachment_summary` (`stored` / `duplicate` / `skipped` + reason / `failed` + attempts). Failed fetches are retried on later scans (3 attempts). Files are stored **unfiled**, keyed by sha256, with message provenance (`deal_document_email_logs`). |
| Storage | `StorageBackend` interface with S3-compatible and local backends. Each document row pins its `storage_backend`, so switching `STORAGE_BACKEND` later does not strand old files; access is gated on the row's backend. Deleting a document or deal removes the blob (best effort, after the DB commit). |
| Extraction | Opt-in, tracked (`deal_extraction_runs`) and reviewable (`deal_extraction_candidates`). See below. |

## Migrations

Applied automatically at startup by `migrations/runner.py`, in order:

1. `036_graph_sync` — `graph_sync_state`
2. `037_email_mining_upgrade` — `scan_runs`, `llm_calls`, scan-log/suggestion columns, partial-unique suggestion dedupe
3. `038_documents_attachments_extraction` — nullable `deal_id`, sha256 (+ per-deal / unfiled unique indexes), provenance, `deal_extraction_runs`
4. `039_scan_recovery_and_delta_state` — `email_scan_log.retry_count/change_key/source_removed_at`, sync-state ops columns
5. `040_extraction_candidates` — `deal_extraction_candidates`, run `document_ids/trigger/requested_by`, `llm_calls.extraction_run_id`

All additive and idempotent (`IF NOT EXISTS`). Existing integer ids for suggestions, scan logs and documents are preserved. **Run order matters only in that 039/040 need 036–038.** There are no down-migrations; roll back by disabling flags, not by dropping tables.

> `deal_documents.deal_id` is `ON DELETE SET NULL` (so email attachments can sit unfiled). `DELETE /api/deals/{id}` now deletes the deal's documents explicitly; previously they would have become "unfiled".

## Feature flags

Attachment ingestion and extraction are **separate** flags. Extraction requires ingestion (it works on stored attachments), so `document_extraction_enabled` is `false` unless both are set.

| Env | Default | Effect |
|-----|---------|--------|
| `ATTACHMENT_INGESTION_ENABLED` | `false` | Store worthwhile email attachments as unfiled documents |
| `DOCUMENT_EXTRACTION_ENABLED` | `false` | Allow extraction runs (needs ingestion) |
| `STORAGE_BACKEND` | `s3` | `s3` or `local`; `STORAGE_LOCAL_PATH` for local |
| `GRAPH_FOLDERS` | `inbox,sentitems` | Folders to delta-sync |
| `CLASSIFIER_MODEL` / `EXTRACTION_MODEL` | `claude-sonnet-4-6` | Model ids |
| `SCAN_INTERVAL_MINUTES` | `240` | Scheduler cadence |

`GET /api/meta/features` reports the **effective** state (including `document_extraction_requires_ingestion` when the extraction flag is set without ingestion). The UI must trust this endpoint and nothing else.

## Extraction behaviour

* Text via Azure Document Intelligence (preferred) or a local PDF fallback; typed candidates from the model, restricted to Corporate Credit fields: `deal_size_m, hold_amount_m, spread_bps, total_leverage, dscr, fccr, interest_coverage, ltm_revenue_m, ltm_ebitda_m, ebitda_margin, tenor_months, maturity_date, security, oid_pct, sofr_floor_pct, nda_date, target_close`. No real-estate fields.
* Every candidate is stored with evidence, source document, confidence and a **disposition**:
  `applied` (blank field, one clear value, confidence ≥ 0.85) · `suggested` (ambiguous or underwriting-locked) · `conflict` (documents disagree) · `differs_from_current` (field already populated) · `matches_existing` · `corroborating` · `superseded` · `invalid` (failed validator) · `accepted` / `rejected` (reviewer).
* Populated values are **never overwritten automatically**. A reviewer may accept a candidate over a populated field only with `overwrite=true`. Underwriting fields on deals at `loi_signed`+ cannot be filled by extraction or accepted from a candidate.
* Triggers: new-deal approval, matched-suggestion approval, assigning an unfiled document to a deal, or `POST /api/deals/{id}/extractions` with explicit document ids (the backfill path for existing files). Runs retry up to 3 times, are swept if a worker dies, and record tokens/cost/model/errors.

## Rollout

1. **Deploy with both flags off.** Confirm migrations applied (`SELECT max(version) FROM corporate_credit.schema_migrations` should be `040_extraction_candidates`; startup logs the runner), then `POST /api/admin/scan` and check `GET /api/admin/scan-runs` and `GET /api/admin/sync-state`.
2. **Dry-run the backlog:** `python scripts/backfill.py --days 14 --dry-run` (counts messages, projects an upper-bound cost).
3. **Backfill history** (optional, capped):
   `python scripts/backfill.py --days 14 --user a@x.com --folder inbox --execute --max-messages 300 --max-cost 10`.
   It walks an independent delta query and never touches the live watermark. If it stops on budget, re-run the same command; seen messages are skipped without a model call.
4. **Watch** `scan_runs.error_counts` (rejection reasons), `GET /api/admin/cost` (24h spend by purpose), and parked folders in `/api/admin/sync-state`.
5. **Enable attachments** (`ATTACHMENT_INGESTION_ENABLED=true`). New emails that produce suggestions will store files as unfiled documents; check Inbox → attachments and `GET /api/inbox/unfiled-documents`. *Existing* messages are not re-ingested automatically — re-drive them by clearing `attachment_summary` on specific `email_scan_log` rows or re-running a backfill after deleting those logs.
6. **Enable extraction** (`DOCUMENT_EXTRACTION_ENABLED=true`). Start with a few deals via `POST /api/deals/{id}/extractions`; review candidates in the deal's Documents tab; watch `llm_calls` where `purpose='extract_document'`.

### Operating a parked folder
`POST /api/admin/sync-state/{id}/unpark` (add `?resync=true` to also drop the delta link and reseed).

## Rollback
* Flip a flag off to stop attachment storage / extraction immediately; stored data stays.
* To pause scanning, unset Azure/Anthropic credentials (the scheduler gate) or stop the service. A crash mid-scan is safe: claims are recovered on the next run.
* Do not drop the new tables/columns.

## Known limitations
* Edited/flag-changed messages that Graph re-delivers are **not** re-classified (the claim row dedupes them) to avoid paying for read/unread churn; `change_key` is recorded for a future opt-in.
* Messages classified `no_match` never have attachments stored.
* Item/reference attachments and files over 25 MB are skipped (and recorded as skipped).
* `deal_documents` unique-sha indexes are per deal / per unfiled, so the same bytes may legitimately exist on two deals.
* Live Graph, Anthropic and Azure Document Intelligence calls are covered by fakes in tests, not exercised against a real tenant.

## Tests
```bash
docker run -d --name hc-deal-test-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=hc_deal_test -p 5544:5432 postgres:16
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5544/hc_deal_test python -m pytest tests -q
```
CI runs the same on every backend change (`.github/workflows/backend.yml`).
