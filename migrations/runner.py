import importlib
import re
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def run_migrations(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        applied = {
            row[0]
            for row in (await conn.execute(text("SELECT version FROM schema_migrations"))).fetchall()
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
