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


app = FastAPI(title="Corporate Credit Pipeline", lifespan=lifespan)

from app.api.dashboard import router as dashboard_router
from app.api.deals import router as deals_router
from app.api.sponsors import router as sponsors_router
from app.api.funds import router as funds_router
from app.api.portfolio import router as portfolio_router
from app.api.deal_documents import router as deal_documents_router
from app.api.deal_activity import router as deal_activity_router
from app.api.deal_timeline import router as deal_timeline_router
from app.api.inbox import router as inbox_router
from app.api.chat import router as chat_router

app.include_router(dashboard_router)
app.include_router(deals_router)
app.include_router(sponsors_router)
app.include_router(funds_router)
app.include_router(portfolio_router)
app.include_router(deal_documents_router)
app.include_router(deal_activity_router)
app.include_router(deal_timeline_router)
app.include_router(inbox_router)
app.include_router(chat_router)

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
