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

    scheduler = AsyncIOScheduler()
    if settings.AZURE_CLIENT_ID and settings.ANTHROPIC_API_KEY:
        async def _scan_job():
            from app.automation.scanner import run_scan
            async with AsyncSessionLocal() as db:
                outcome = await run_scan(db, trigger="scheduler")
                if outcome.messages_classified:
                    print(
                        f"[scheduler] Email scan {outcome.status}: "
                        f"classified={outcome.messages_classified} "
                        f"cost=${outcome.estimated_cost_usd}"
                    )

        scheduler.add_job(
            _scan_job,
            "interval",
            minutes=settings.SCAN_INTERVAL_MINUTES,
            id="email_scan",
            max_instances=1,
            coalesce=True,
        )

    if settings.document_extraction_enabled:
        async def _extraction_job():
            from app.services.deal_extraction import process_pending_runs
            async with AsyncSessionLocal() as db:
                changed = await process_pending_runs(db)
                if changed:
                    print(f"[scheduler] Processed {changed} extraction run(s)")

        scheduler.add_job(
            _extraction_job,
            "interval",
            minutes=1,
            id="document_extraction",
            max_instances=1,
            coalesce=True,
        )

    if scheduler.get_jobs():
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
from app.api.companies import router as companies_router
from app.api.contacts import router as contacts_router
from app.api.deal_team import router as deal_team_router
from app.api.competition import router as competition_router
from app.api.capital_structure import router as capital_structure_router
from app.api.underwriting import router as underwriting_router
from app.api.screening import router as screening_router
from app.api.covenants import router as covenants_router
from app.api.amendments import router as amendments_router
from app.api.risk_ratings import router as risk_ratings_router
from app.api.approvals import router as approvals_router
from app.api.meta import router as meta_router
from app.api.admin import router as admin_router
from app.api.extractions import router as extractions_router

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
app.include_router(companies_router)
app.include_router(contacts_router)
app.include_router(deal_team_router)
app.include_router(competition_router)
app.include_router(capital_structure_router)
app.include_router(underwriting_router)
app.include_router(screening_router)
app.include_router(covenants_router)
app.include_router(amendments_router)
app.include_router(risk_ratings_router)
app.include_router(approvals_router)
app.include_router(meta_router)
app.include_router(admin_router)
app.include_router(extractions_router)

if (FRONTEND_DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(index)
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(
        "Frontend not built. Run: cd frontend && npm run dev",
        status_code=503,
    )
