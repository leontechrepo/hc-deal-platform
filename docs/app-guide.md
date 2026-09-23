# App Guide

## Stack

- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL
- **Frontend**: React 19 + Vite + TypeScript, React Router 7, Recharts 3, Tailwind CSS 4
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

## Project structure

```
app/
  api/          # FastAPI route handlers (deals, dashboard, inbox, underwriting, etc. — see api-reference.md)
  automation/   # Email scanner (Microsoft Graph + Claude)
  core/         # Config, auth (Clerk JWT verification)
  db/           # SQLAlchemy models, session, init_db
  graph/        # Microsoft Graph auth + mail client
  importer/     # Excel import for deal pipeline data
frontend/
  src/
    api/        # Typed API clients (React Query)
    components/ # UI components (DealTable, KPIStrip, ReviewBanner, …)
    pages/      # DashboardPage, LoginPage, LogsPage
migrations/
  runner.py     # Idempotent migration runner (tracks versions in schema_migrations)
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

## Deployment (Railway)

The FastAPI backend serves the pre-built React frontend from `frontend/dist`.

```bash
cd frontend && npm install && npm run build && cd ..
railway up --service hc-deal-platform -m "your message"
```

Live URL: `https://hc-deal-platform-production.up.railway.app`

## Frontend dependency notes

As of 2026-09-22 ([#24](https://github.com/leontechrepo/hc-deal-platform/pull/24)), `react-router-dom`, `recharts`, `@clerk/shared`, and `js-cookie` are pinned to patched versions resolving Aikido security findings — see [docs/index.md → Recent changes](index.md#recent-changes).
