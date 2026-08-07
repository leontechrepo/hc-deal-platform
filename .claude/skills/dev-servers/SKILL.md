---
name: dev-servers
description: >-
  Start, stop, or check the hc-deal-platform local dev stack (Postgres via
  Docker, FastAPI backend on :8000, Vite frontend on :5173) in one shot. Use
  this whenever asked to run/start/restart the app, start the backend and/or
  frontend, or verify a frontend change locally — instead of manually running
  Docker/uvicorn/npm commands one at a time.
---

# hc-deal-platform dev servers

Run `scripts/dev-servers.sh {start|stop|status}` from the repo root instead of
manually chaining `docker run` / `conda run -n hc-deal-platform` / `uvicorn` /
`npm run dev` commands. It encodes a few non-obvious, previously
time-consuming gotchas specific to this machine/repo:

- **Postgres is usually already running, shared across projects.** This
  machine keeps a long-lived Docker container (commonly named something like
  `vigorous_hertz`, not `hc-deal-db`) bound to `:5432` and shared by several
  Leon Capital repos (`amara`, `fdl_exec`, `hc_deal`, `marketing_platform`,
  `uma`). The script checks if *anything* is listening on `:5432` first and
  reuses it as-is — it never stops/restarts/removes an existing Postgres
  container, and only creates a dedicated `hc-deal-db` container as a
  fallback if nothing is listening at all. `.env`'s `DATABASE_URL` already
  points at `postgres:postgres@localhost:5432/hc_deal`, which works against
  the shared container too.
- **Docker Desktop is often not running.** Starting it cold (`open -a
  Docker`) takes ~30-60s before `docker info` succeeds. The script polls for
  readiness instead of guessing with a fixed sleep.
- **Don't blindly kill dev servers by name/pattern.** A generic `pkill -f
  vite` or `pkill -f uvicorn` can kill an unrelated project's dev server (or
  a teammate's session) that happens to match the same process name. `stop`
  looks up the actual PID bound to `:8000`/`:5173` via `lsof` and kills only
  that.
- **Check before starting.** If something is already listening on
  `:8000`/`:5173`, the script leaves it alone rather than spawning a
  duplicate on a fallback port (which is exactly how a stray, confusing
  second Vite instance on `:5174` showed up once before). If you need a
  fresh instance, run `stop` first, then `start`.

## Usage

```bash
./scripts/dev-servers.sh start   # idempotent: skips anything already running
./scripts/dev-servers.sh status  # quick up/down check for all three
./scripts/dev-servers.sh stop    # stops backend + frontend only; Postgres is left running (shared)
```

Logs land at `/tmp/hc-deal-platform-backend.log` and
`/tmp/hc-deal-platform-frontend.log` — `tail -f` those instead of the
foreground terminal since both processes are started detached (`nohup` +
`disown`).

## Assumptions

- The `hc-deal-platform` conda environment already exists with
  `requirements.txt` installed (backend). If not: `conda create -n
  hc-deal-platform python=3.11 && conda run -n hc-deal-platform pip install -r
  requirements.txt` once, first. (This repo previously used a `.venv/` —
  retired in favor of the conda env; don't recreate `.venv/`.)
- `frontend/node_modules/` — the script runs `npm install` automatically if
  missing.
- `.env` exists at the repo root (copy from `.env.example` if not — see
  `README.md`).
- Docker Desktop is installed (`/Applications/Docker.app`).

After `start`, sign in via Clerk SSO at `http://localhost:5173` to verify
signed-in pages — there's no headless test session available in this repo.
