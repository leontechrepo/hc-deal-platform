# App Guide

## Stack

- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL
- **Frontend**: React 19 + Vite + TypeScript, React Router 7, Recharts 3, Tailwind CSS 4, `@leontechrepo/leon-ui` shell/theme (GitHub Packages)
- **Auth**: Clerk (JWT via JWKS)
- **AI**: Anthropic Claude
- **Email**: Microsoft Graph API (client credentials)
- **Scheduler**: APScheduler (email scan every `SCAN_INTERVAL_MINUTES`, default 240)

## Local development

```bash
# 1. Local Postgres (matches the DATABASE_URL in .env.example below)
docker run -d --name hc-deal-db -e POSTGRES_PASSWORD=leon -e POSTGRES_USER=leon -e POSTGRES_DB=hc_deals -p 5432:5432 postgres:17

# 2. Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in secrets
uvicorn app.main:app --reload --port 8000   # migrations run automatically on startup

# 3. Frontend (separate terminal)
cd frontend
npm install
npm run dev   # http://localhost:5173, proxies API calls to :8000
```

`frontend/.npmrc` points the `@leontechrepo/*` scope at GitHub Packages and reads `LEON_UI_TOKEN` (a GitHub PAT with `read:packages`) to install `@leontechrepo/leon-ui`; export it in your shell before `npm install` locally.

## Project structure

```
app/
  api/          # FastAPI route handlers (deals, dashboard, inbox, admin, meta, extractions, underwriting, etc. — see api-reference.md)
  automation/   # Email scanner (Microsoft Graph delta sync + Claude classifier), attachment ingestion
  core/         # Config, auth (Clerk JWT verification)
  db/           # SQLAlchemy models, session, init_db, Graph sync state
  domain/       # Field-update validation, pipeline stages, pricing, attachment/email-text helpers
  graph/        # Microsoft Graph auth + mail client, attachment fetch
  importer/     # Excel import for deal pipeline data
frontend/
  src/
    api/        # Typed API clients (React Query)
    components/ # UI components (DealTable, KPIStrip, ReviewBanner, inbox review form, …)
    pages/      # DashboardPage, LoginPage, LogsPage, InboxPage, PipelinePage, …
migrations/
  runner.py     # Idempotent migration runner (tracks versions in schema_migrations)
scripts/
  backfill.py   # Dry-run/execute a bounded historical mail backfill independent of the live watermark — see docs/intake-rollout.md#rollout
```

Migrations live in `migrations/` and run automatically when the app starts via `init_db()`. To add one, create `migrations/00N_description.py` with an `async def upgrade(conn)` function.

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLAlchemy async URL (`postgresql+asyncpg://...`) |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | Microsoft Graph app credentials |
| `MONITORED_USER_1` / `MONITORED_USER_2` | Inboxes to scan (full email addresses) |
| `ANTHROPIC_API_KEY` | Claude API key |
| `SCAN_INTERVAL_MINUTES` | Email scan frequency in minutes (default: 240) |
| `CLERK_JWKS_URL` | Clerk JWKS endpoint for JWT verification |
| `STORAGE_BUCKET_NAME` / `STORAGE_ENDPOINT_URL` / `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` / `STORAGE_REGION` | Railway S3-compatible bucket for deal document uploads |
| `ATTACHMENT_INGESTION_ENABLED` / `DOCUMENT_EXTRACTION_ENABLED` / `STORAGE_BACKEND` / `GRAPH_FOLDERS` / `CLASSIFIER_MODEL` / `EXTRACTION_MODEL` | Intake v2 pipeline flags and settings — see [Intake pipeline rollout → Feature flags](intake-rollout.md#feature-flags) for defaults and effects |

## Deployment (Railway)

As of 2026-10-02, the Docker image is built in two stages (`Dockerfile`): a `node:22-slim` stage builds the frontend and is then discarded, and only its `frontend/dist` output is copied into the shipped `python:3.13-slim` image — so the frontend's npm auth token never lands in the deployed image's layers. Railway must expose two **build-time** service variables (passed through as Docker build `ARG`s):

- `LEON_UI_TOKEN` — GitHub PAT (`read:packages`) used only during `npm install` in the build stage, to install the private `@leontechrepo/leon-ui` package via `frontend/.npmrc`.
- `VITE_CLERK_PUBLISHABLE_KEY` — baked into the built frontend bundle by Vite at build time.

```bash
railway up --service hc-deal-platform -m "your message"
```

Railway builds the image from the `Dockerfile` (no separate local `npm run build` step is needed or committed); `frontend/.dockerignore` keeps local `node_modules` and env files out of the build context.

Live URL: `https://hc-deal-platform-production.up.railway.app`

## Frontend dependency notes

As of 2026-09-22 ([#24](https://github.com/leontechrepo/hc-deal-platform/pull/24)), `react-router-dom`, `recharts`, `@clerk/shared`, and `js-cookie` are pinned to patched versions resolving Aikido security findings — see [docs/index.md → Recent changes](index.md#recent-changes).
