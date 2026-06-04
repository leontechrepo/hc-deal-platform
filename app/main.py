import os
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db.session import AsyncSessionLocal, init_db

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    if settings.AZURE_CLIENT_ID and settings.ANTHROPIC_API_KEY:
        scheduler = AsyncIOScheduler()

        async def _scan_job():
            from app.automation.scanner import run_scan
            async with AsyncSessionLocal() as db:
                count = await run_scan(db)
                if count:
                    print(f"[scheduler] Email scan processed {count} emails")

        scheduler.add_job(
            _scan_job,
            "interval",
            minutes=settings.SCAN_INTERVAL_MINUTES,
            id="email_scan",
        )
        scheduler.start()
        app.state.scheduler = scheduler
    else:
        app.state.scheduler = None

    yield

    if getattr(app.state, "scheduler", None):
        app.state.scheduler.shutdown()


app = FastAPI(title="LHP Private Credit Pipeline", lifespan=lifespan)

from app.api.dashboard import router as dashboard_router
from app.api.deals import router as deals_router

app.include_router(dashboard_router)
app.include_router(deals_router)

# Serve React build — only when frontend/dist exists (skips gracefully in dev)
if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(index)
    # Dev mode fallback: tell the developer to start the Vite dev server
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(
        "Frontend not built. Run: cd frontend && npm run dev",
        status_code=503,
    )
