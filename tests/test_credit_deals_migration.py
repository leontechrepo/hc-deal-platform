"""
Regression coverage for the deals -> credit_deals UUID primary key
conversion (migrations 015-017). See conftest.py for how to point these at a
throwaway Postgres — skipped automatically otherwise.
"""
import uuid

from sqlalchemy import text

from app.api.deals import CreateDealRequest, create_deal, get_deal

TEST_AUTH = {"sub": "test-user"}

_DEPENDENT_UUID_COLUMNS = [
    ("deal_update_log", "deal_id"),
    ("email_scan_log", "matched_deal_id"),
    ("pending_suggestions", "deal_id"),
    ("deal_activity", "deal_id"),
    ("deal_notes", "deal_id"),
    ("deal_documents", "deal_id"),
    ("deal_timeline_workstreams", "deal_id"),
    ("portfolio_positions", "deal_id"),
    ("chat_sessions", "deal_id"),
]


async def test_credit_deals_table_exists_with_uuid_pk(db_session):
    old_table = (await db_session.execute(text("SELECT to_regclass('deals')"))).scalar()
    assert old_table is None, "the old integer-PK 'deals' table should no longer exist"

    new_table = (await db_session.execute(text("SELECT to_regclass('credit_deals')"))).scalar()
    assert new_table is not None, "'credit_deals' should exist after the cutover migration"

    id_type = (await db_session.execute(text(
        "SELECT data_type FROM information_schema.columns "
        "WHERE table_schema = 'corporate_credit' AND table_name = 'credit_deals' AND column_name = 'id'"
    ))).scalar()
    assert id_type == "uuid"


async def test_dependent_fk_columns_are_uuid(db_session):
    for table, column in _DEPENDENT_UUID_COLUMNS:
        data_type = (await db_session.execute(text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_schema = 'corporate_credit' AND table_name = :table AND column_name = :column"
        ), {"table": table, "column": column})).scalar()
        assert data_type == "uuid", f"{table}.{column} should be uuid, got {data_type!r}"


async def test_deal_id_round_trips_as_uuid_string(db_session):
    result = await create_deal(CreateDealRequest(company_name="UUID Round Trip Co"), db_session, auth=TEST_AUTH)
    deal_id = result["deal_id"]

    # Doesn't raise -> deal_id is a real UUID, not an int or arbitrary string.
    parsed = uuid.UUID(str(deal_id))

    fetched = await get_deal(parsed, db_session)
    assert fetched["id"] == str(parsed)
