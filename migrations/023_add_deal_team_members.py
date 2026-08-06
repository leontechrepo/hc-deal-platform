from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade(conn: AsyncConnection) -> None:
    await conn.execute(text("""
        DO $$ BEGIN
            CREATE TYPE deal_team_role_enum AS ENUM ('Lead','Analyst','Associate');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    """))
    # Named deal_team_members, not deal_team — that name collides with the
    # existing credit_deals.deal_team TEXT[] legacy array column.
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS deal_team_members (
            team_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            deal_id      UUID NOT NULL REFERENCES credit_deals(id) ON DELETE CASCADE,
            team_member  VARCHAR(255) NOT NULL,
            role_on_deal deal_team_role_enum,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_deal_team_members_deal_id ON deal_team_members(deal_id)"))

    # Backfill from the legacy array (role unknown -> NULL). The array column
    # itself is left in place, unused going forward — not worth a breaking
    # drop yet, given nothing else in this migration set removes columns.
    await conn.execute(text("""
        INSERT INTO deal_team_members (deal_id, team_member, role_on_deal)
        SELECT id, member, NULL
        FROM credit_deals, unnest(deal_team) AS member
        WHERE deal_team IS NOT NULL
    """))
