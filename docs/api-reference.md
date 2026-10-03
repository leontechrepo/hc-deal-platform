# API Reference

All endpoints are FastAPI routers mounted under `app/api/` (see `app/main.py` for exact prefixes and mount order). This page is a map of what each router owns — for exact request/response schemas, read the router source directly or use the live FastAPI-generated schema at `/docs` on a running instance.

| Router | Owns |
|---|---|
| `deals.py` | Core deal CRUD and pipeline fields, plus summary/reporting endpoints: `GET /api/kpis` (pipeline/portfolio KPIs) and `GET /api/analytics` (funnel, pass reasons, deal sources, deals by quarter) |
| `dashboard.py` | Empty legacy router (no endpoints) — dashboard KPI/summary views moved to the React SPA, backed by `deals.py`'s `/api/kpis` and `/api/analytics` |
| `inbox.py` | Mined-mail review queue (Microsoft Graph scan results, Claude-proposed updates). As of 2026-10-02 ([intake v2](intake-rollout.md)), group-level review replaces one-suggestion-at-a-time actions: `POST /api/inbox/groups/{id}/accept` and `POST /api/inbox/groups/{id}/dismiss` apply a whole email's edited field values atomically, `GET /api/inbox/groups/{id}/email` reads the message body live from Graph (not cached), and `GET /api/inbox/unfiled-documents` lists email attachments stored but not yet assigned to a deal — see [Intake pipeline rollout](intake-rollout.md). |
| `admin.py` | **Added 2026-10-02.** Operator visibility into the mail-sync pipeline: `GET /api/admin/scan-runs` (recent `scan_runs` rows — counters, tokens, cost, rejection reasons), `GET /api/admin/cost` (trailing-24h spend from `llm_calls`, grouped by purpose), `GET /api/admin/sync-state` (per mailbox/folder Graph delta state plus the claim backlog by status), and `POST /api/admin/sync-state/{id}/unpark` (`?resync=true` to also drop the delta link and reseed) for a folder parked after repeated failures. See [Intake pipeline rollout](intake-rollout.md). |
| `meta.py` | **Added 2026-10-02.** UI-facing flags and vocab: `GET /api/meta/features` reports the *effective* rollout state (`attachment_ingestion_enabled`, `document_extraction_enabled`, `storage_backend`/`storage_configured`, `graph_folders`, and `document_extraction_requires_ingestion` when extraction is flagged on without ingestion) — the UI trusts this endpoint rather than inferring flags itself. `GET /api/meta/pipeline-stages` returns the stage/status vocab. |
| `extractions.py` | **Added 2026-10-02.** Document-extraction runs and reviewable candidates: `GET /api/deal-extractions/{run_id}`, `GET /api/deals/{deal_id}/extractions` (runs + candidates + pending-review count for a deal's Documents tab), `POST /api/deals/{deal_id}/extractions` (manual/backfill run over explicit `document_ids`, `202` while it runs in the background), `POST /api/extraction-candidates/{id}/accept` (`overwrite` required to replace an already-populated field; blocked for underwriting-locked fields on a deal at `loi_signed`+), and `POST /api/extraction-candidates/{id}/reject`. See [Intake pipeline rollout → Extraction behaviour](intake-rollout.md#extraction-behaviour). |
| `deal_activity.py` | Deal activity/audit feed |
| `deal_documents.py` | Deal document upload/download/storage. As of 2026-10-02, also backs the unfiled-document surface (attachments stored before being assigned to a deal) and the extraction trigger on assignment — see [Intake pipeline rollout](intake-rollout.md). |
| `deal_team.py` | Team member assignment on a deal |
| `deal_timeline.py` | Diligence/closing timeline (workstreams and tasks) |
| `amendments.py` | Deal amendment records |
| `approvals.py` | Governance approval records |
| `capital_structure.py` | Capital stack / tranche modeling |
| `covenants.py` | Loan covenant tracking |
| `risk_ratings.py` | Risk rating records |
| `competition.py` | Competitive-process tracking |
| `underwriting.py` | Underwriting workflow/fields |
| `screening.py` | Deal screening/intake |
| `sponsors.py` | Sponsor entity records |
| `companies.py` | Company entity records |
| `contacts.py` | Contact entity records |
| `funds.py` | Fund records |
| `portfolio.py` | Portfolio-level views |
| `chat.py` | Claude-backed chat/assistant endpoint |

Auth: every route is protected by Clerk JWT verification (`app/core/`), verified against `CLERK_JWKS_URL`.
