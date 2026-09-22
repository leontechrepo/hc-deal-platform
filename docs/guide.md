---
title: App Guide
nav_order: 2
---

# App Guide

## Stack

- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL
- **Frontend**: React 19 + Vite + TypeScript
- **Auth**: Clerk (JWT via JWKS)
- **AI**: Anthropic Claude
- **Email**: Microsoft Graph API (client credentials)
- **Scheduler**: APScheduler (email scan every `SCAN_INTERVAL_MINUTES`, default 240)

## Repository layout

```text
app/
  api/          # FastAPI route handlers (deals, dashboard)
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
  001_initial.py
  002_pending_suggestions.py
```

## Local development

### Prerequisites

- Python 3.13+
- Node.js 18+
- Docker (for local Postgres)

### Setup

1. Start local Postgres:

   ```bash
   docker run -d --name hc-deal-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=hc_deal -p 5432:5432 postgres:17
   ```

2. Create and activate a virtual environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env` and fill in secrets.

4. Start the backend (migrations run automatically on startup):

   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

5. In a separate terminal, start the frontend dev server:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Frontend runs at `http://localhost:5173` and proxies API calls to
   `http://localhost:8000`.

## Database migrations

Migrations live in `migrations/` and run automatically when the app
starts, via `init_db()`. To add one, create
`migrations/00N_description.py` with an `async def upgrade(conn)`
function.

## Testing

See the backend test suite (60 tests, plus 67 DB-dependent tests skipped
without a live Postgres — per the [#22](https://github.com/leontechrepo/hc-deal-platform/pull/22)
dependency-bump verification).

## Deployment (Railway)

The app is deployed on Railway. The FastAPI backend serves the pre-built
React frontend from `frontend/dist`.

```bash
# 1. Build frontend
cd frontend && npm install && npm run build && cd ..

# 2. Deploy (uses .railwayignore — includes frontend/dist, excludes node_modules)
railway up --service hc-deal-platform -m "your message"
```

Live URL: `https://hc-deal-platform-production.up.railway.app`
