# API Reference

All endpoints are FastAPI routers mounted under `app/api/` (see `app/main.py` for exact prefixes and mount order). This page is a map of what each router owns — for exact request/response schemas, read the router source directly or use the live FastAPI-generated schema at `/docs` on a running instance.

| Router | Owns |
|---|---|
| `deals.py` | Core deal CRUD and pipeline fields, plus summary/reporting endpoints: `GET /api/kpis` (pipeline/portfolio KPIs) and `GET /api/analytics` (funnel, pass reasons, deal sources, deals by quarter) |
| `dashboard.py` | Empty legacy router (no endpoints) — dashboard KPI/summary views moved to the React SPA, backed by `deals.py`'s `/api/kpis` and `/api/analytics` |
| `inbox.py` | Mined-mail review queue (Microsoft Graph scan results, Claude-proposed updates) |
| `deal_activity.py` | Deal activity/audit feed |
| `deal_documents.py` | Deal document upload/download/storage |
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
