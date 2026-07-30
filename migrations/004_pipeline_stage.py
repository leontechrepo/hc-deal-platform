from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.domain.pipeline_stage import PIPELINE_STAGES, STATUSES, derive_pipeline_stage

_STAGE_LIST_SQL = ", ".join(f"'{s}'" for s in PIPELINE_STAGES)
_STATUS_LIST_SQL = ", ".join(f"'{s}'" for s in STATUSES)


async def upgrade(conn: AsyncConnection) -> None:
    # Add columns first with no constraint — backfill before locking them down,
    # so a bad backfill row rolls back the whole migration (single transaction)
    # instead of failing partway through with columns already constrained.
    await conn.execute(text("ALTER TABLE deals ADD COLUMN IF NOT EXISTS pipeline_stage TEXT"))
    await conn.execute(text("ALTER TABLE deals ADD COLUMN IF NOT EXISTS status TEXT"))

    rows = (await conn.execute(text(
        "SELECT id, bucket, stage, nda, dataroom, mgmt_meeting, ioi_offered, ioi_signed FROM deals"
    ))).fetchall()

    for row in rows:
        deal_id, bucket, stage, nda, dataroom, mgmt_meeting, ioi_offered, ioi_signed = row
        pipeline_stage, status = derive_pipeline_stage(
            bucket, stage, nda, dataroom, mgmt_meeting, ioi_offered, ioi_signed
        )
        await conn.execute(
            text("UPDATE deals SET pipeline_stage = :pipeline_stage, status = :status WHERE id = :id"),
            {"pipeline_stage": pipeline_stage, "status": status, "id": deal_id},
        )

    await conn.execute(text(f"""
        ALTER TABLE deals ADD CONSTRAINT chk_deals_pipeline_stage
        CHECK (pipeline_stage IN ({_STAGE_LIST_SQL}))
    """))
    await conn.execute(text(f"""
        ALTER TABLE deals ADD CONSTRAINT chk_deals_status
        CHECK (status IN ({_STATUS_LIST_SQL}))
    """))
    await conn.execute(text("ALTER TABLE deals ALTER COLUMN pipeline_stage SET NOT NULL"))
    await conn.execute(text("ALTER TABLE deals ALTER COLUMN status SET NOT NULL"))

    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deals_pipeline_stage ON deals(pipeline_stage)"))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status)"))
