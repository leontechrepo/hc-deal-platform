---
title: Home
nav_order: 1
---

# HC Deal Platform

Internal deal pipeline management tool for Corporate Credit. Tracks
healthcare deals, monitors inboxes for relevant emails via Microsoft
Graph, and uses Claude AI to propose deal updates for human review.

- [App Guide](guide.md) — stack, local development, project structure, and
  deployment
- [API Reference](api-reference.md) — environment variables and the API
  surface

## Recent changes reflected in this documentation

- [#22](https://github.com/leontechrepo/hc-deal-platform/pull/22)
  "Tighten FastAPI floor to >=0.133.0 for Starlette CVE fix": Aikido
  flagged Starlette for a critical CVE requiring `starlette>=1.0.1`. The
  previous open-ended `fastapi>=0.111.0` floor would likely already
  resolve a compatible FastAPI (FastAPI has allowed `starlette>=1.0.0`
  since its own `0.133.0` release), but with no lockfile the
  actually-deployed version was unverified, so the floor is now pinned
  explicitly to `fastapi>=0.133.0` plus an explicit `starlette>=1.0.1`
  floor. Verified the SPA fallback's `FileResponse(index)` call
  (`app/main.py`) already uses positional arguments, not the removed
  `method=` kwarg — no code change needed there. No other Starlette
  1.0-removed API usage found. 60 tests passed (67 skipped, DB-dependent)
  against the resolved `fastapi==0.141.1` / `starlette==1.6.0`.
