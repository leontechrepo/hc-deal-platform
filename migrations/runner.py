import importlib
import re
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def run_migrations(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        # So a brand-new database can bootstrap `schema_migrations` (and everything
        # after it) straight into the target schema.
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS corporate_credit"))

        # `schema_migrations` moves from `public` into `corporate_credit` as part of
        # migration 014. Until that move has actually happened, `public` still holds
        # the real applied-migrations history -- don't let search_path's preference
        # for `corporate_credit` resolve the unqualified name below to a fresh, empty
        # table there and shadow it (which would make every prior migration look
        # unapplied and re-run from scratch).
        in_public = (await conn.execute(
            text("SELECT to_regclass('public.schema_migrations') IS NOT NULL")
        )).scalar()
        history_schema = "public" if in_public else "corporate_credit"

        await conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {history_schema}.schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        applied = {
            row[0]
            for row in (await conn.execute(
                text(f"SELECT version FROM {history_schema}.schema_migrations")
            )).fetchall()
        }

    migrations_dir = Path(__file__).parent
    migration_files = sorted(
        f for f in migrations_dir.glob("[0-9]*.py") if f.stem not in applied
    )

    for path in migration_files:
        version = path.stem
        module = importlib.import_module(f"migrations.{version}")
        print(f"Applying migration: {version}")
        async with engine.begin() as conn:
            await module.upgrade(conn)
            await conn.execute(
                text("INSERT INTO schema_migrations (version) VALUES (:v)"),
                {"v": version},
            )
        print(f"  ✓ {version}")
