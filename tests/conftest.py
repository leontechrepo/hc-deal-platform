"""
DB-backed tests need a real Postgres to run migrations against — point
DATABASE_URL at a throwaway database before running pytest, e.g.:

    docker run -d --name hc-deal-test-pg -e POSTGRES_PASSWORD=postgres \\
        -e POSTGRES_DB=hc_deal_test -p 5544:5432 postgres:16
    DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5544/hc_deal_test \\
        pytest

Tests that need a database are skipped automatically if it isn't reachable,
so `pytest` still runs the pure-logic unit tests on a machine with no DB.
"""
import asyncio

import pytest
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings


@pytest.fixture
async def db_engine():
    # Must match app/db/session.py's connect_args — without it, unqualified
    # table names in migrations/queries resolve via Postgres's default
    # search_path ("$user", public) instead of corporate_credit, silently
    # operating on a different (and possibly stale/duplicate) set of tables
    # than the real app ever touches.
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        connect_args={"server_settings": {"search_path": "corporate_credit,public"}},
    )
    try:
        async with engine.connect():
            pass
    except Exception:
        pytest.skip(f"No reachable database at {settings.DATABASE_URL} — set DATABASE_URL to run DB-backed tests")

    from migrations.runner import run_migrations
    await run_migrations(engine)

    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    from sqlalchemy.ext.asyncio import async_sessionmaker

    import app.db.session as sess
    sess.engine = db_engine
    sess.AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)

    async with sess.AsyncSessionLocal() as session:
        yield session
        await session.rollback()
