#!/usr/bin/env bash
# Start/stop/status for local dev: Postgres (Docker), FastAPI backend, Vite frontend.
# See .claude/skills/dev-servers/SKILL.md for the full runbook this encodes.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT=8000
FRONTEND_PORT=5173
POSTGRES_PORT=5432
# When :5432 is occupied by another project's Postgres (common on this machine),
# we fall back to a dedicated HC container on this port instead of fighting for 5432.
HC_PG_FALLBACK_PORT=5435
HC_PG_FALLBACK_NAME=hc-deal-eyeball-pg
BACKEND_LOG=/tmp/hc-deal-platform-backend.log
FRONTEND_LOG=/tmp/hc-deal-platform-frontend.log
PG_CONTAINER_NAME=hc-deal-db
UVICORN_BIN="${UVICORN_BIN:-/opt/miniconda3/envs/hc-deal-platform/bin/uvicorn}"
NPM_BIN="${NPM_BIN:-$(command -v npm)}"

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

# Cursor/agent terminals tear down their process group on exit. Plain
# `nohup … & disown` stays in that group and dies with the shell. Double-fork
# + setsid detaches into a new session that survives the launcher.
run_detached() {
  local cwd="$1"
  local log="$2"
  shift 2
  # Remaining args are the command to exec.
  /usr/bin/python3 - "$cwd" "$log" "$@" <<'PY'
import os, sys

cwd, log, cmd = sys.argv[1], sys.argv[2], sys.argv[3:]

if os.fork() > 0:
    raise SystemExit(0)
os.setsid()
if os.fork() > 0:
    raise SystemExit(0)

os.chdir(cwd)
os.umask(0o022)

# stdio → log /dev/null
log_fd = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
os.dup2(log_fd, 1)
os.dup2(log_fd, 2)
os.close(log_fd)
devnull = os.open(os.devnull, os.O_RDONLY)
os.dup2(devnull, 0)
os.close(devnull)

os.execvp(cmd[0], cmd)
PY
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

# Returns 0 if postgres/postgres can connect to host:port/db.
pg_auth_ok() {
  local host="$1" port="$2" db="$3"
  /opt/miniconda3/envs/hc-deal-platform/bin/python - "$host" "$port" "$db" <<'PY' 2>/dev/null
import asyncio, sys
try:
    import asyncpg
except ImportError:
    raise SystemExit(1)

async def main():
    host, port, db = sys.argv[1], int(sys.argv[2]), sys.argv[3]
    try:
        conn = await asyncpg.connect(
            user="postgres", password="postgres", database=db, host=host, port=port, timeout=3
        )
        await conn.close()
    except Exception:
        raise SystemExit(1)

asyncio.run(main())
PY
}

ensure_fallback_postgres() {
  ensure_docker || return 1
  if docker ps --format '{{.Names}}' | grep -qx "$HC_PG_FALLBACK_NAME"; then
    echo "Using dedicated $HC_PG_FALLBACK_NAME on :$HC_PG_FALLBACK_PORT."
  elif docker ps -a --format '{{.Names}}' | grep -qx "$HC_PG_FALLBACK_NAME"; then
    echo "Starting existing $HC_PG_FALLBACK_NAME container..."
    docker start "$HC_PG_FALLBACK_NAME" >/dev/null
  else
    echo "Creating dedicated $HC_PG_FALLBACK_NAME on :$HC_PG_FALLBACK_PORT (shared :$POSTGRES_PORT is not HC)..."
    docker run -d --name "$HC_PG_FALLBACK_NAME" \
      -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=hc_deal \
      -p "$HC_PG_FALLBACK_PORT:5432" postgres:17 >/dev/null
  fi
  wait_for_port "$HC_PG_FALLBACK_PORT" 40 || {
    echo "Fallback Postgres did not come up on :$HC_PG_FALLBACK_PORT." >&2
    return 1
  }
  export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:${HC_PG_FALLBACK_PORT}/hc_deal"
}

# Load DATABASE_URL from repo .env into the shell if unset. Used so a Railway
# (or other remote) URL in .env wins over the local Docker fallback.
load_database_url_from_env_file() {
  if [ -n "${DATABASE_URL:-}" ]; then
    return 0
  fi
  local env_file="$REPO_ROOT/.env"
  [ -f "$env_file" ] || return 0
  local line value
  line="$(grep -E '^[[:space:]]*DATABASE_URL=' "$env_file" | tail -1 || true)"
  [ -n "$line" ] || return 0
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  export DATABASE_URL="$value"
}

# True when DATABASE_URL points off-localhost (Railway TCP proxy, etc.).
database_url_is_remote() {
  case "${DATABASE_URL:-}" in
    *"@localhost:"*|*"@127.0.0.1:"*|*"@::1:"*) return 1 ;;
    *"@"*) return 0 ;;
    *) return 1 ;;
  esac
}

ensure_postgres() {
  load_database_url_from_env_file

  # Prefer an already-exported / .env DATABASE_URL (caller override or Railway).
  if [ -n "${DATABASE_URL:-}" ]; then
    if database_url_is_remote; then
      echo "Using remote DATABASE_URL from environment/.env (skipping local Postgres)."
      return 0
    fi
    echo "Using DATABASE_URL from environment."
    return 0
  fi

  if is_listening "$POSTGRES_PORT"; then
    if pg_auth_ok localhost "$POSTGRES_PORT" hc_deal; then
      echo "Postgres already listening on :$POSTGRES_PORT — reusing it."
      return 0
    fi
    echo "Postgres on :$POSTGRES_PORT is not accepting HC credentials — falling back."
    ensure_fallback_postgres
    return $?
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

  if [ ! -x "$UVICORN_BIN" ]; then
    echo "uvicorn not found at $UVICORN_BIN (conda env hc-deal-platform)." >&2
    return 1
  fi

  : >"$BACKEND_LOG"
  echo "Starting backend on :$BACKEND_PORT (log: $BACKEND_LOG)..."
  # Pass DATABASE_URL through the environment of the detached process.
  if [ -n "${DATABASE_URL:-}" ]; then
    run_detached "$REPO_ROOT" "$BACKEND_LOG" \
      /usr/bin/env "DATABASE_URL=$DATABASE_URL" \
      "$UVICORN_BIN" app.main:app --reload --host 127.0.0.1 --port "$BACKEND_PORT"
  else
    run_detached "$REPO_ROOT" "$BACKEND_LOG" \
      "$UVICORN_BIN" app.main:app --reload --host 127.0.0.1 --port "$BACKEND_PORT"
  fi

  wait_for_port "$BACKEND_PORT" 40 || {
    echo "Backend didn't come up — check $BACKEND_LOG" >&2
    tail -20 "$BACKEND_LOG" >&2 || true
    return 1
  }
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

  : >"$FRONTEND_LOG"
  echo "Starting frontend on :$FRONTEND_PORT (log: $FRONTEND_LOG)..."
  # --strictPort: fail loudly instead of silently picking a different port.
  # --host 127.0.0.1: bind IPv4 explicitly so curl/browser agree on the port.
  run_detached "$REPO_ROOT/frontend" "$FRONTEND_LOG" \
    "$NPM_BIN" run dev -- --port "$FRONTEND_PORT" --strictPort --host 127.0.0.1

  wait_for_port "$FRONTEND_PORT" 40 || {
    echo "Frontend didn't come up — check $FRONTEND_LOG" >&2
    tail -20 "$FRONTEND_LOG" >&2 || true
    return 1
  }
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
  # Kill the whole process group when possible so uvicorn --reload children die.
  kill $pids 2>/dev/null || true
  sleep 1
  pids="$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill -9 $pids 2>/dev/null || true
  fi
}

status() {
  is_listening "$POSTGRES_PORT" && echo "Postgres: UP   (:$POSTGRES_PORT)" || echo "Postgres: down (:$POSTGRES_PORT)"
  if is_listening "$HC_PG_FALLBACK_PORT"; then
    echo "HC DB:    UP   (:$HC_PG_FALLBACK_PORT, dedicated)"
  fi
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
