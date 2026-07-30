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

### Backend — complete, in PR review (commit `f62793d`)
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

### Frontend — Phase 0 (foundation) complete
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

## Next steps

Frontend phases 1–5 (backend is a fixed, already-shipped contract for all of
these — no backend work required):

1. **Phase 1 — Sponsors, Funds, Portfolio, Inbox.** Fully independent new
   routes built on the Phase 0 primitives. Inbox is a rename/rebuild of the
   current review-queue UI onto `app/api/inbox.py`.
2. **Phase 2 — Pipeline.** Table view dark-launched at `/pipeline`, then
   kanban view, then cutover (`/` redirects, `DashboardPage` deleted,
   `ReviewBanner` moves to the new Pipeline page). Migrates off the legacy
   `bucket`/`stage` model onto `pipeline_stage`/`status`.
3. **Phase 3 — Deal Detail.** Shell + overview tab, then underwriting (writes
   `utils/creditFormulas.ts`, shared with Formulas tab and the New Deal
   modal), then documents/activity/notes tabs, then the hand-rolled Gantt
   timeline tab (highest-effort, sequenced last), then formulas.
4. **Phase 4 — Executive Summary + Chat.** Exec Summary needs Deal Detail as
   a click target; Chat has no dependencies and can slot in once convenient.
5. **Phase 5 — Nav cutover.** Restructure `NavBar` into PIPELINE / DEAL
   MANAGEMENT / TOOLS sections, decide `/analytics` placement, delete
   `api/analytics.ts`/`useAnalytics.ts` if still confirmed dead.

Also open, not blocking frontend work:
- Provision the Railway S3-compatible bucket + set `STORAGE_*` env vars so
  document upload/download stops 503ing.
- Verify the chat model id (`claude-sonnet-4-6` in `app/api/chat.py`) is a
  real, intended model before the Chat page goes live.
- Add `STORAGE_*` vars to `.env.example`.
