#!/usr/bin/env bash
# Start/stop/status for local dev: Postgres (Docker), FastAPI backend, Vite frontend.
# See .claude/skills/dev-servers/SKILL.md for the full runbook this encodes.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT=8000
FRONTEND_PORT=5173
POSTGRES_PORT=5432
BACKEND_LOG=/tmp/hc-deal-platform-backend.log
FRONTEND_LOG=/tmp/hc-deal-platform-frontend.log
PG_CONTAINER_NAME=hc-deal-db

is_listening() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for_port() {
  local port="$1" tries="${2:-30}"
  for _ in $(seq 1 "$tries"); do
    is_listening "$port" && return 0
    sleep 1
  done
  return 1
}

ensure_docker() {
  docker info >/dev/null 2>&1 && return 0
  echo "Docker daemon not running — launching Docker Desktop (cold start can take ~30-60s)..."
  open -a Docker
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "Docker did not become ready in time." >&2
  return 1
}

ensure_postgres() {
  if is_listening "$POSTGRES_PORT"; then
    # Something is already serving Postgres on 5432 — on this machine that's
    # usually a shared local container (e.g. "vigorous_hertz") used by several
    # Leon Capital projects, already holding the hc_deal database. Never stop,
    # restart, or remove whatever owns this port — just use it as-is.
    echo "Postgres already listening on :$POSTGRES_PORT — reusing it."
    return 0
  fi

  ensure_docker || return 1

  if docker ps -a --format '{{.Names}}' | grep -qx "$PG_CONTAINER_NAME"; then
    echo "Starting existing $PG_CONTAINER_NAME container..."
    docker start "$PG_CONTAINER_NAME" >/dev/null
  else
    echo "No Postgres found on :$POSTGRES_PORT — creating a dedicated $PG_CONTAINER_NAME container..."
    docker run -d --name "$PG_CONTAINER_NAME" \
      -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=hc_deal \
      -p "$POSTGRES_PORT:5432" postgres:17 >/dev/null
  fi

  wait_for_port "$POSTGRES_PORT" 30 || { echo "Postgres did not come up." >&2; return 1; }
}

start_backend() {
  if is_listening "$BACKEND_PORT"; then
    echo "Backend already running on :$BACKEND_PORT — leaving it alone."
    return 0
  fi
  ensure_postgres || return 1

  echo "Starting backend on :$BACKEND_PORT (log: $BACKEND_LOG)..."
  (
    cd "$REPO_ROOT"
    nohup conda run --no-capture-output -n hc-deal-platform uvicorn app.main:app --reload --port "$BACKEND_PORT" > "$BACKEND_LOG" 2>&1 &
    disown
  )
  wait_for_port "$BACKEND_PORT" 30 || { echo "Backend didn't come up — check $BACKEND_LOG" >&2; return 1; }
  echo "Backend up: http://localhost:$BACKEND_PORT"
}

start_frontend() {
  if is_listening "$FRONTEND_PORT"; then
    echo "Frontend already running on :$FRONTEND_PORT — leaving it alone."
    return 0
  fi

  if [ ! -d "$REPO_ROOT/frontend/node_modules" ]; then
    echo "frontend/node_modules missing — running npm install first (one-time cost)..."
    (cd "$REPO_ROOT/frontend" && npm install)
  fi

  echo "Starting frontend on :$FRONTEND_PORT (log: $FRONTEND_LOG)..."
  (
    cd "$REPO_ROOT/frontend"
    # --strictPort: fail loudly instead of silently picking a different port,
    # which is how we ended up with a confusing second instance on :5174 before.
    nohup npm run dev -- --port "$FRONTEND_PORT" --strictPort > "$FRONTEND_LOG" 2>&1 &
    disown
  )
  wait_for_port "$FRONTEND_PORT" 30 || { echo "Frontend didn't come up — check $FRONTEND_LOG" >&2; return 1; }
  echo "Frontend up: http://localhost:$FRONTEND_PORT"
}

# Kills only whatever is bound to the given port right now, rather than a
# name/pattern match (pkill -f vite, etc.) — a pattern match has no idea which
# project's dev server it's about to kill and can take out an unrelated one.
kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    echo "Nothing listening on :$port."
    return 0
  fi
  echo "Stopping process(es) on :$port (pid: $pids)..."
  kill $pids 2>/dev/null || true
}

status() {
  is_listening "$POSTGRES_PORT" && echo "Postgres: UP   (:$POSTGRES_PORT)" || echo "Postgres: down (:$POSTGRES_PORT)"
  is_listening "$BACKEND_PORT"  && echo "Backend:  UP   (:$BACKEND_PORT, http://localhost:$BACKEND_PORT)"  || echo "Backend:  down (:$BACKEND_PORT)"
  is_listening "$FRONTEND_PORT" && echo "Frontend: UP   (:$FRONTEND_PORT, http://localhost:$FRONTEND_PORT)" || echo "Frontend: down (:$FRONTEND_PORT)"
}

cmd="${1:-start}"
case "$cmd" in
  start)
    ok=1
    start_backend || ok=0
    start_frontend || ok=0
    echo
    status
    [ "$ok" -eq 1 ] || exit 1
    ;;
  stop)
    # Postgres is intentionally left running — it's shared with other projects.
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: $0 {start|stop|status}" >&2
    exit 1
    ;;
esac
