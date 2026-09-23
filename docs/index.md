# HC Deal Platform — Documentation

Internal deal pipeline management tool for Corporate Credit. Tracks healthcare deals, monitors inboxes for relevant emails via Microsoft Graph, and uses Claude AI to propose deal updates for human review.

- [App Guide](app-guide.md) — stack, local development, project structure, deployment
- [API Reference](api-reference.md) — the FastAPI routers mounted under `app/api/`

## Recent changes

- **2026-09-22 ([#24](https://github.com/leontechrepo/hc-deal-platform/pull/24)) — Aikido dependency security update.** Bumped `frontend/package.json` / `frontend/package-lock.json`: `react-router-dom` `^7.16.0` → `^7.18.2` (and its `react-router` peer to `7.18.4`), `recharts` `^3.8.1` → `^3.9.1` (pulling in `immer` 10.2.0 → 11.1.18 and `reselect` 5.1.1 → 5.2.0), `@clerk/shared` 4.14.0 → 4.33.0, and `js-cookie` 3.0.7 → 3.0.8, among other transitive lockfile updates. No application code changed — dependency versions only.
