---
title: API / Interface Reference
nav_order: 3
---

# API / Interface Reference

## Environment variables

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
| `STORAGE_BUCKET_NAME` | Railway S3-compatible bucket for deal document uploads |
| `STORAGE_ENDPOINT_URL` | Bucket's S3-compatible endpoint URL |
| `STORAGE_ACCESS_KEY_ID` | Bucket access key ID |
| `STORAGE_SECRET_ACCESS_KEY` | Bucket secret access key |
| `STORAGE_REGION` | Bucket region (default: `auto`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key for the frontend; must be set in `frontend/.env` (Vite's env root), read via `import.meta.env` in `frontend/src/main.tsx` |

## API surface

Route handlers live under `app/api/` (deals, dashboard). See that
directory for exact request/response shapes; this repo does not currently
publish a separate OpenAPI reference beyond the FastAPI `/docs` UI
exposed in development mode.

## Dependency notes

- [#22](https://github.com/leontechrepo/hc-deal-platform/pull/22) pinned
  `fastapi>=0.133.0` and an explicit `starlette>=1.0.1` floor (resolving
  `fastapi==0.141.1` / `starlette==1.6.0`) to close a critical Starlette
  CVE. No request/response contract changed.
