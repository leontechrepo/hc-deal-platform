from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

# (table, fk_column, uuid_column, on_delete) — the cutover pairs every
# dependent table's original integer FK column with the parallel UUID
# column added in migration 015/016, and the ON DELETE behavior to restore
# on the new FK once it points at credit_deals(id) instead of deals(id).
_DEPENDENT_FKS = [
    ("deal_update_log", "deal_id", "deal_uuid_id", "CASCADE"),
    ("email_scan_log", "matched_deal_id", "matched_deal_uuid_id", "SET NULL"),
    ("pending_suggestions", "deal_id", "deal_uuid_id", "CASCADE"),
    ("deal_activity", "deal_id", "deal_uuid_id", "CASCADE"),
    ("deal_notes", "deal_id", "deal_uuid_id", "CASCADE"),
    ("deal_documents", "deal_id", "deal_uuid_id", "CASCADE"),
    ("deal_timeline_workstreams", "deal_id", "deal_uuid_id", "CASCADE"),
    ("portfolio_positions", "deal_id", "deal_uuid_id", "CASCADE"),
    ("chat_sessions", "deal_id", "deal_uuid_id", "SET NULL"),
]

_INDEX_RENAMES = [
    ("idx_deals_stage", "idx_credit_deals_stage"),
    ("idx_deals_bucket", "idx_credit_deals_bucket"),
    ("idx_deals_sector_primary", "idx_credit_deals_sector_primary"),
    ("idx_deals_pipeline_stage", "idx_credit_deals_pipeline_stage"),
    ("idx_deals_status", "idx_credit_deals_status"),
    ("idx_deals_sponsor_id", "idx_credit_deals_sponsor_id"),
    ("idx_deals_fund_id", "idx_credit_deals_fund_id"),
]


async def upgrade(conn: AsyncConnection) -> None:
    # Step 3 (final cutover) of the deals -> credit_deals UUID primary key
    # conversion. This is the point of no return for this migration runner
    # (no downgrade support) — everything in 015/016 was purely additive and
    # safe to leave half-done; this file must be rehearsed against a real
    # data clone and run against production only from a fresh backup.

    # 1. Re-run the migration 015 backfill one last time. Rows written by
    #    old app code between migration 016 and this cutover can still have
    #    a NULL uuid column — silently, for the tables where 016 didn't (or
    #    couldn't yet) enforce NOT NULL — because the old integer FK column
    #    is about to be dropped below. This UPDATE is idempotent (WHERE ...
    #    IS NULL) and closes that gap immediately before the point where it
    #    would otherwise become permanent data loss.
    for table, fk_column, uuid_column, _on_delete in _DEPENDENT_FKS:
        await conn.execute(text(f"""
            UPDATE {table} t SET {uuid_column} = d.uuid_id
            FROM deals d WHERE d.id = t.{fk_column} AND t.{uuid_column} IS NULL
        """))

    # 2. Drop every dependent table's old integer FK column. Postgres
    #    auto-drops the FK constraint (and, for portfolio_positions, the
    #    UNIQUE constraint) defined on that column along with it — no need
    #    to name/guess the underlying constraint.
    for table, fk_column, _uuid_column, _on_delete in _DEPENDENT_FKS:
        await conn.execute(text(f"ALTER TABLE {table} DROP COLUMN IF EXISTS {fk_column}"))

    # 3. Drop deals' old integer PK column — safe now that no FK anywhere
    #    still references it.
    await conn.execute(text("ALTER TABLE deals DROP COLUMN IF EXISTS id"))

    # 4. Promote the UUID column to be the real id/PK and rename the table.
    #    USING INDEX reuses the unique index from migration 015 instead of
    #    building a new one, and Postgres renames that index to match the
    #    constraint name automatically.
    await conn.execute(text("ALTER TABLE deals RENAME COLUMN uuid_id TO id"))
    await conn.execute(text(
        "ALTER TABLE deals ADD CONSTRAINT deals_pkey PRIMARY KEY USING INDEX idx_deals_uuid_id"
    ))
    await conn.execute(text("ALTER TABLE deals RENAME TO credit_deals"))

    # 5. Rename each dependent's UUID column into the real FK name and
    #    re-add its foreign key against credit_deals(id).
    for table, fk_column, uuid_column, on_delete in _DEPENDENT_FKS:
        await conn.execute(text(f"ALTER TABLE {table} RENAME COLUMN {uuid_column} TO {fk_column}"))
        await conn.execute(text(f"""
            ALTER TABLE {table} ADD CONSTRAINT {table}_{fk_column}_fkey
            FOREIGN KEY ({fk_column}) REFERENCES credit_deals(id) ON DELETE {on_delete}
        """))

    # portfolio_positions' 1:1-with-a-deal invariant was enforced by a
    # UNIQUE constraint that got dropped along with its old column in step 2
    # — restore it on the renamed column.
    await conn.execute(text(
        "ALTER TABLE portfolio_positions ADD CONSTRAINT portfolio_positions_deal_id_key UNIQUE (deal_id)"
    ))

    # 6. Cosmetic: rename the old idx_deals_* indexes so `\d credit_deals`
    #    doesn't show index names referencing a table that no longer exists.
    for old_name, new_name in _INDEX_RENAMES:
        await conn.execute(text(f"ALTER INDEX IF EXISTS {old_name} RENAME TO {new_name}"))
