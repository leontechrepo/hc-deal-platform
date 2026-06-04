# HC Deal Platform

Internal deal pipeline management tool for LHP Private Credit. Tracks healthcare deals, monitors inboxes for relevant emails via Microsoft Graph, and uses Claude AI to propose deal updates for human review.

## Stack

- **Backend**: FastAPI + SQLAlchemy (async) + PostgreSQL
- **Frontend**: React 19 + Vite + TypeScript
- **Auth**: Clerk (JWT via JWKS)
- **AI**: Anthropic Claude
- **Email**: Microsoft Graph API (client credentials)
- **Scheduler**: APScheduler (email scan every 4 hours)

## Local Development

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

3. Copy `.env.example` to `.env` and fill in secrets:
   ```bash
   cp .env.example .env
   ```

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

   Frontend runs at `http://localhost:5173` and proxies API calls to `http://localhost:8000`.

## Project Structure

```
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

## Database Migrations

Migrations live in `migrations/` and run automatically when the app starts via `init_db()`. To add a migration, create `migrations/00N_description.py` with an `async def upgrade(conn)` function.

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLAlchemy async URL (`postgresql+asyncpg://...`) |
| `AZURE_TENANT_ID` | Azure AD tenant for Microsoft Graph |
| `AZURE_CLIENT_ID` | Azure app client ID |
| `AZURE_CLIENT_SECRET` | Azure app client secret |
| `MONITORED_USER_1` | First inbox to scan (full email address) |
| `MONITORED_USER_2` | Second inbox to scan |
| `ANTHROPIC_API_KEY` | Claude API key |
| `SCAN_INTERVAL_MINUTES` | Email scan frequency in minutes (default: 240) |
| `CLERK_JWKS_URL` | Clerk JWKS endpoint for JWT verification |

## Deployment (Railway)

The app is deployed on Railway. The FastAPI backend serves the pre-built React frontend from `frontend/dist`.

```bash
# 1. Build frontend
cd frontend && npm install && npm run build && cd ..

# 2. Deploy (uses .railwayignore — includes frontend/dist, excludes node_modules)
railway up --service hc-deal-platform -m "your message"
```

Live URL: `https://hc-deal-platform-production.up.railway.app`
