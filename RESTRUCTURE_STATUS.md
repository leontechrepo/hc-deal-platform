# Corporate Credit Platform Restructure — Status

Tracking doc for the full-stack rebuild driven by the Claude Design mockup
("Corporate Credit Platform", DesignSync project `b72afa53-1876-4b14-90f7-94dd68434546`).
Full design detail lives in two plan files:
- Master plan (backend + full frontend design): `~/.claude/plans/restructure-the-ui-use-ethereal-hare.md`
- Frontend Phase 0 plan: `~/.claude/plans/claude-plans-restructure-the-ui-use-eth-serialized-eagle.md`

## What we're doing

Rebuilding the deal platform from a 4-page pipeline tracker into the full mockup:
a navy/gold sidebar app with Pipeline, Deal Detail, Executive Summary, Inbox,
Sponsors, Funds, Portfolio, and a Claude-backed Credit Co-Pilot chat. Split into
a backend pass (schema/migrations/endpoints) and a frontend pass (routes/UI),
each staged and verified in its own sub-phases so nothing ships on fake data
and the existing app keeps working throughout.

## Done

### Backend — complete, merged (PR #3, commit `2317d66`)
- All 9 migrations (004–012): `pipeline_stage`/`status` backfill onto the
  11-stage funnel, structural/covenant fields, `sponsors`/`funds`/`fund_lps`,
  `portfolio_positions`/`portfolio_monitoring_tests`, `deal_documents`,
  `deal_activity`/`deal_notes`, `deal_timeline_workstreams`/`tasks`,
  `chat_sessions`/`chat_messages`, inbox enrichment fields.
- `app/db/models/` split into a package; every new router wired in
  `app/main.py`: `sponsors`, `funds`, `portfolio`, `deal_documents`,
  `deal_activity`, `deal_timeline`, `inbox` (renamed from review-queue),
  `chat`. Extended `app/api/deals.py` (`GET/POST` single-deal, 409
  underwriting lock past `loi_signed`).
- Real Claude-backed `POST /api/chat` (`app/api/chat.py`,
  `app/domain/chat_context.py`).
- Document storage code is real (`app/storage/documents.py`, S3-compatible)
  but the Railway bucket isn't provisioned yet — 503s until env vars are set.
- `frontend/` untouched by this commit — old app kept working throughout.

### Frontend — Phase 0 (foundation) complete, merged (PR #4, commit `19d3201`)
- Real design tokens pulled from the DesignSync project's synced design
  system (`_ds_manifest.json`): navy `#0a1f44`, gold `#c9a84c`, Cormorant
  Garamond/Jost/DM Mono, plus the full shadow/panel/chat token set — split
  into `frontend/src/styles/tokens.css` + `styles/base.css`.
- Real Leon logo (`frontend/src/assets/leon-logo.png`) pulled from DesignSync,
  now rendered in the sidebar.
- `--nav-width-{expanded,collapsed}` CSS vars replace hardcoded widths in
  `App.tsx`/`NavBar.module.css`.
- New `frontend/src/components/ui/` primitives: `Badge`, `KPITile`/`KPIGrid`,
  `DataTable`, `InlineEditText`, `ConfidenceBadge`, `ApproveRejectActions`,
  `Button`, `Card`, `Modal`, `Tabs`, `Slider`, `ProgressBar`, `EmptyState`.
- `StagePill`, `KPIStrip`, `InlineEdit`, `DealTable`, `ReviewBanner` refactored
  into thin wrappers over those primitives — same props, no behavior change.
- Verified: `tsc --noEmit` clean, production build succeeds, login page
  screenshot-checked (correct fonts/colors, zero console errors), and
  Dashboard/Logs/Analytics/NavBar collapse manually verified by the user
  signed in via Clerk SSO.

### Frontend — Phase 1 (Sponsors, Funds, Portfolio, Inbox) complete, merged (PR #5, commit `532d4bb`)
- Four fully independent new routes (`/sponsors`, `/funds`, `/portfolio`,
  `/inbox`) built entirely on the Phase 0 primitives — no backend changes.
- `types.ts`/`api/`/`hooks/` layers added per resource
  (`{sponsors,funds,portfolio,inbox}.ts` × 2), mirroring the existing
  `deals`/`reviewQueue` pattern.
- New shared components: `PipelineStageBadge` (11-stage enum tone map) and
  `PipelineDealsMiniTable`, reused by both Sponsors and Funds cards.
- Sponsors and Funds get full create/edit/delete (Funds incl. nested LP
  CRUD via `LPTable`/`LPFormModal`); Portfolio gets monitoring-field edits +
  a test-log flow (`MonitoringTestDrawer`) with a follow-up prompt for the
  `next_test_date` the API clears after logging a test; Inbox gets
  approve/assign/reject against `/api/inbox` (`InboxCard`,
  `AssignToDealControl`) — no create affordance on Portfolio or Inbox,
  matching what the backend actually supports.
- `ReviewBanner`/`DashboardPage` deliberately left untouched — that move is
  still Phase 2 scope (see below). Codex review caught and fixed two P1s
  before merge: `useInbox.ts` was invalidating a separate `['inbox']` cache
  key instead of sharing `['review-queue']` with `useReviewQueue.ts` (same
  underlying `pending_suggestions` data via aliased endpoints — now fixed
  so Inbox, ReviewBanner, and the NavBar scan handler all stay in sync);
  numeric inputs across the new forms were missing `step="any"`, silently
  blocking fractional leverage/DSCR/fee values.
- Verified: `tsc --noEmit` clean, production build succeeds, backend boots
  locally against the real `hc_deal` Postgres DB with migrations 004–012
  already applied, and `/api/{sponsors,funds,portfolio,inbox}` all correctly
  require auth. **Not done**: interactive authenticated click-through via
  Clerk SSO (sandbox in that session blocked both the Clerk API and browser
  automation) — recommend a manual pass over the create/edit/delete flows
  and the Portfolio test-logging UI before leaning on this in production.

### Frontend — Phase 2 (Pipeline: table + kanban + cutover + New Deal modal) complete, merged (PR #6, commit `d501d13`)

- New `PipelinePage` (`/pipeline`) fully migrated off the legacy `bucket`/
  `stage` model onto `pipeline_stage`/`status`: `PipelineTable` groups deals
  into the 11 `pipeline_stage` sections (was legacy `stage`), a status-filter
  tab row (Active/On Hold/Passed/Dead/Closed/All, default Active) replaces
  the old bucket tabs, `KanbanBoard` adds a second view (`?view=kanban`) with
  hand-rolled native-HTML5 drag-and-drop across all 11 columns (no new
  dependency — consistent with this repo's no-component-library convention),
  patching `pipeline_stage` via the existing `usePatchDeal` on drop.
- New `NewDealModal` (`?new=1`) wires up the backend's `POST /api/deals`
  (fully built since PR #3 but never exposed anywhere on the frontend until
  now) — the only UI in the app that can create a deal. Every numeric input
  uses `step="any"` (the Phase 1 P1 regression is now a standing checklist
  item, not repeated).
- `types.ts`'s `Deal` interface extended with every field `_deal_to_dict`
  already returned but the frontend type didn't carry (`pipeline_stage`,
  `status`, and the full structural/financial/covenant set) — `useDeals()`
  could not previously drive stage-based UI at all. Added `createDeal()`/
  `useCreateDeal()` alongside the existing `listDeals`/`patchDeal` pattern.
- `ReviewBanner` (moved here from Dashboard) now shows `PipelineStageBadge`/
  `pipeline_stage` instead of the legacy `StagePill`/`stage`. Extracted a
  shared `StatusBadge` (`components/shared/StatusBadge.tsx`) out of
  `PipelineDealsMiniTable`'s local copy for reuse in the new table/kanban.
- Cutover done: `/` redirects to `/pipeline`, `DashboardPage` and the entire
  legacy `components/DealTable/` directory deleted (confirmed dead —
  `StagePill`'s only other consumer was `ReviewBanner`, now migrated).
  `NavBar`'s Dashboard entry replaced with a Pipeline entry, same position.
- Verified: `tsc --noEmit` clean, production build succeeds, backend boots
  locally against the real `hc_deal` Postgres DB (80/18/27/3/1/3 deals spread
  across `intake_triage`/`screening`/`pre_loi_diligence`/`loi_negotiation`/
  `loi_signed`/`portfolio_monitoring`), `GET /api/deals` correctly requires
  auth, signed-out flow renders cleanly with zero console errors (headless
  Playwright check). **Not done**: interactive authenticated click-through
  (same sandbox limitation as Phase 1 — this instance's Clerk sign-in is
  Microsoft SSO restricted to `leoncapitalgroup.com` accounts, not scriptable
  headlessly) — recommend a manual pass over table/kanban drag-and-drop/New
  Deal/status tabs/cutover before leaning on this in production.
- **Known, not fixed here**: `GET /api/kpis` is still 100% `bucket`-derived
  (backend is a fixed, already-shipped contract for this pass) — the KPI
  strip on the new Pipeline page shows the same legacy-bucket numbers as
  before, unrelated to the page's now-fully-migrated table/kanban/status
  logic. Not a regression.
- Codex review caught and fixed one P2 before merge: the New Deal modal lets
  a deal be created directly at `portfolio_monitoring`, but `POST
  /api/deals` never called `ensure_portfolio_position` (only `PATCH` did) —
  so that deal was invisible to `GET /api/portfolio` despite showing up in
  the pipeline. Fixed to match the manual-PATCH and inbox-approval paths,
  with a regression test (`tests/test_deals_api.py`).

### Frontend — Phase 3a (Deal Detail: shell + overview + activity + notes) complete

- New `/deals/:dealId` route (`DealDetailPage`), fetches the deal once via a
  new `useDeal(dealId)` (`GET /api/deals/{id}`, not previously exposed on the
  frontend) and hands it to nested tab routes via `<Outlet context={{deal}}/>`.
  Shell: back-link to Pipeline, company name + `PipelineStageBadge`/
  `StatusBadge`, a `KPIGrid` (Deal Size/Total Leverage/All-In Rate/Risk
  Score), and a new `StageTracker` (`components/shared/StageTracker.tsx`) —
  a horizontal 11-stage progress tracker sourced from
  `PipelineStageBadge.tsx`'s existing `PIPELINE_STAGES`/`formatPipelineStage`.
  `ui/Tabs`'s existing (previously unused for this) routed-`NavLink` mode
  drives real sub-route tabs; later phases just append more `{key,label,to}`
  entries, no shell changes needed.
- **Overview tab**: read/edit every non-underwriting `Deal` field
  (company/classification, deal terms, process & status, commentary) via
  `InlineEditText` plus two small file-local `EditableSelect`/`EditableDate`
  helpers for enum/date fields. Fields in the backend's `UNDERWRITING_FIELDS`
  set (`deal_size_m`, `security`, etc.) are deliberately read-only here —
  they 409 once `pipeline_stage >= loi_signed` and their edit UI (with
  lock-aware handling) belongs to the not-yet-built Underwriting tab. Legacy
  P-flag milestones and `target_close` are read-only (never editable via
  `PATCH` at all).
- **Activity tab**: read-only feed on `GET /api/deals/{id}/activity` — a
  `DataTable` of the auto-logged audit trail, no manual-entry form (there's
  no product reason for one).
- **Notes tab**: full CRUD (`GET/POST/PATCH/DELETE .../notes`) — add, inline-
  edit (`InlineEditText`), delete.
- Click-through entry point: `company_name` in `PipelineTable` and
  `KanbanCard` now links to `/deals/:id` — previously the page would have
  been unreachable except by typing a URL.
- **Fast-follow fix**: every mutating endpoint that logs a `DealActivity`
  from a manual edit (`patch_deal`) hardcoded the literal string `"user"` as
  the actor, so the Activity tab couldn't show who actually made a change.
  `PatchRequest` gained an optional `actor` field (backend defaults to
  `"user"` if omitted, so existing callers are unaffected); the frontend
  threads a real display name through via a new `useCurrentActor()` hook
  (Clerk's `useUser()` — `fullName` falling back to the primary email),
  passed from `usePatchDeal()`/`OverviewTab`'s edit controls and from
  `NotesTab`'s note-author field.
- Verified: `tsc --noEmit` clean, production build succeeds, backend/frontend
  boot locally against the real `hc_deal` Postgres DB, manual click-through
  via Clerk SSO (table + kanban entry points, all three tabs, field/select/
  date edits with toast confirmation, note add/edit/delete, both light and
  dark mode).
- **Deliberately deferred** (see Next steps): Underwriting tab, Formulas tab
  (both shipped in Phase 3b below), Documents tab (blocked — Railway bucket
  still unprovisioned, uploads/downloads 503), Timeline tab (hand-rolled
  Gantt, still deferred).

### Frontend — Phase 3b (Deal Detail: underwriting + formulas) complete

- New **Underwriting tab**: covers the full `UNDERWRITING_FIELDS` set (27
  fields — Deal Terms/Financials/Covenants sections) with lock-aware editing —
  a `LockAwareText`/`LockAwareDate` pair (file-local, mirroring Overview's
  `EditableSelect`/`EditableDate`) renders `InlineEditText`/a date input when
  `!deal.underwriting_locked`, plain read-only text otherwise. No client-side
  lock recomputation — `deal.underwriting_locked` is already server-computed
  and read directly. A `LockedBanner` appears once the deal reaches
  `loi_signed` or later.
- New `frontend/src/utils/creditFormulas.ts` — deliberately scoped to only
  `computeAllInRate`/`computeTotalLeverage`, the two formulas the backend
  itself already derives deterministically on deal creation. `dscr`/`fccr`/
  `interest_coverage` stay plain manually-entered fields — the backend never
  derives them and no formula for them exists anywhere in this repo's plans,
  so none was invented for a lending platform where that would read as
  house methodology.
- **Sensitivity Simulator** (`components/dealDetail/SensitivitySimulator.tsx`,
  4× `ui/Slider` — previously built in Phase 0 with zero consumers until now)
  + **Scenario Table** (`components/dealDetail/ScenarioTable.tsx`): two rows,
  "Current (Saved)" (the deal's actual stored values, never recomputed) vs.
  "Simulated" (whatever the 4 sliders are dialed to, computed via
  `creditFormulas.ts`) — deliberately not labeled "Downside/Upside" to avoid
  presenting an invented stress-magnitude as a calibrated risk view; the user
  drives the simulation.
- **Excel export — architecture deviation from the original plan.** The
  master plan called for a client-side `xlsx` (SheetJS) npm dependency with
  live formula cells. `xlsx@0.18.5` (the only version on the npm registry)
  carries two unpatched high-severity advisories (prototype pollution, ReDoS)
  that SheetJS only fixes via their own CDN, not npm. Since this backend
  already depends on `openpyxl` (used by the Excel deal-importer), the export
  moved server-side instead: new `GET /api/deals/{id}/underwriting/export`
  (`app/api/deals.py`) builds the workbook with `openpyxl`, with **live
  formula cells** (`=B1/B2`, `=B3+B4/100`, not baked values) matching the
  plan's actual requirement, returned via `StreamingResponse`. The frontend's
  `ExcelExportButton` fetches it as a `Blob` (new `apiFetchBlob` in
  `api/client.ts`, since the existing `apiFetch` always parses JSON) and
  triggers a browser download — no `xlsx` npm dependency was ever added.
- New **Formulas tab**: reference cards for the two backend-confirmed
  formulas only (plugged-in inputs, computed value, actual stored value side
  by side — surfaces drift on old Excel-imported deals without trying to
  "fix" it). DSCR/FCCR/Interest Coverage are explicitly called out as
  no-formula-enforced, pointing back to the Underwriting tab.
- Verified: `tsc --noEmit` clean, production build succeeds, backend imports
  cleanly under the project's `.venv` (confirms `openpyxl`/`python-multipart`
  resolve correctly), backend/frontend boot locally against the real
  `hc_deal` Postgres DB.

## Next steps

Frontend phases 3c–5 (backend is a fixed, already-shipped contract for all of
these — no backend work required):

1. **Phase 3c — Deal Detail: Documents, Timeline.** Documents tab (blocked
   until the Railway S3 bucket is provisioned — `storage_configured` still
   gates uploads/downloads with a 503; re-check via the Railway MCP/CLI once
   its session auth is refreshed), then the hand-rolled Gantt timeline tab
   (`GanttChart`/`WorkstreamRow`/`TaskBar`/`MilestoneMarker`, backed by the
   already-built `app/api/deal_timeline.py` + 2 templates — highest-effort
   remaining piece, sequenced last for exactly that reason).
2. **Phase 4 — Executive Summary + Chat.** Exec Summary needs Deal Detail as
   a click target; Chat has no dependencies and can slot in once convenient.
3. **Phase 5 — Nav cutover.** Restructure `NavBar` into PIPELINE / DEAL
   MANAGEMENT / TOOLS sections (folding in the Sponsors/Funds/Portfolio/Inbox
   items added flat in Phase 1, plus Pipeline added flat in Phase 2), decide
   `/analytics` placement, delete `api/analytics.ts`/`useAnalytics.ts` if
   still confirmed dead.

Also open, not blocking frontend work:
- Provision the Railway S3-compatible bucket + set `STORAGE_*` env vars so
  document upload/download stops 503ing.
- Verify the chat model id (`claude-sonnet-4-6` in `app/api/chat.py`) is a
  real, intended model before the Chat page goes live.
- Add `STORAGE_*` vars to `.env.example`.
