"""Async engine + session factory.

One engine per process (lazy via lru_cache). FastAPI dep `get_session()` yields
a session; everything in the app uses `AsyncSession`. SQLite for v1; the URL
in config swaps to Postgres later with zero code change.

NOTE on SQLite + async: aiosqlite is single-writer. For a solo-user app
that's fine. Concurrent writes from the scheduler + API + agent pipeline can
cause `database is locked` errors briefly under load — set busy timeout via
the connect args below to absorb that.
"""
from __future__ import annotations

from functools import lru_cache
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from ao.config import get_settings


@lru_cache(maxsize=1)
def get_engine() -> AsyncEngine:
    settings = get_settings()
    connect_args: dict = {}
    if settings.database_url.startswith("sqlite"):
        # 5s busy-wait for the writer lock. Plenty for solo use.
        connect_args["timeout"] = 5
    return create_async_engine(
        settings.database_url,
        connect_args=connect_args,
        future=True,
        echo=False,
    )


@lru_cache(maxsize=1)
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        bind=get_engine(),
        expire_on_commit=False,
        class_=AsyncSession,
    )


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency. Yields a session and closes it on exit."""
    Session = get_sessionmaker()
    async with Session() as session:
        yield session


async def create_all() -> None:
    """Build the schema from ORM models. v1 uses this instead of Alembic.

    Migrating to Postgres later → run `alembic init`, generate the initial
    migration from the existing schema, then this function goes away.
    """
    from ao.db import models  # noqa: F401 — registers tables on Base.metadata
    from ao.db.base import Base

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# Columns added to existing tables after the initial schema was first applied.
# Each entry is (table, column, {dialect: type}). create_all() handles new
# tables; this list handles new columns on existing tables, idempotently.
# The Postgres type strings match what SQLAlchemy emits for the equivalent
# model columns (String → TEXT, Float → DOUBLE PRECISION, Boolean → BOOLEAN).
_COLUMN_MIGRATIONS: list[tuple[str, str, dict[str, str]]] = [
    ("companies", "archived_at", {"sqlite": "TEXT", "postgresql": "TEXT"}),
    ("companies", "logo_url", {"sqlite": "TEXT", "postgresql": "TEXT"}),
    ("results", "eps_gaap_value",
     {"sqlite": "REAL", "postgresql": "DOUBLE PRECISION"}),
    ("results", "eps_non_gaap_value",
     {"sqlite": "REAL", "postgresql": "DOUBLE PRECISION"}),
    ("results", "eps_sign_flip",
     {"sqlite": "INTEGER DEFAULT 0", "postgresql": "BOOLEAN DEFAULT FALSE"}),
    ("feature_flags", "demo_mode",
     {"sqlite": "INTEGER DEFAULT 0", "postgresql": "BOOLEAN DEFAULT FALSE"}),
    ("results", "validation_demo_synthetic",
     {"sqlite": "INTEGER DEFAULT 0", "postgresql": "BOOLEAN DEFAULT FALSE"}),
]


async def ensure_schema() -> None:
    """Run create_all() + idempotent column adds for existing DBs.

    Called from the API lifespan startup AND the daemon's startup so an
    existing seed-from-an-older-version DB self-heals without requiring a
    re-seed or manual ALTER. Both processes can race this safely: existence
    checks + "IF NOT EXISTS" on Postgres + a swallowed duplicate-column
    error on SQLite make repeated runs cooperative.
    """
    await create_all()
    engine = get_engine()
    url = str(engine.url)
    if url.startswith("sqlite"):
        await _ensure_columns_sqlite(engine)
    elif url.startswith("postgresql"):
        await _ensure_columns_postgres(engine)


async def _ensure_columns_sqlite(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        for table, column, types in _COLUMN_MIGRATIONS:
            type_ = types["sqlite"]
            rows = (
                await conn.exec_driver_sql(f"PRAGMA table_info({table})")
            ).fetchall()
            cols = {r[1] for r in rows}
            if column in cols:
                continue
            try:
                await conn.exec_driver_sql(
                    f"ALTER TABLE {table} ADD COLUMN {column} {type_}"
                )
            except Exception:  # noqa: BLE001
                # Race: another process added the column between PRAGMA and
                # ALTER. Re-check; only re-raise if it genuinely failed.
                rows2 = (
                    await conn.exec_driver_sql(f"PRAGMA table_info({table})")
                ).fetchall()
                if column not in {r[1] for r in rows2}:
                    raise


async def _ensure_columns_postgres(engine: AsyncEngine) -> None:
    # Postgres ≥ 9.6 supports ADD COLUMN IF NOT EXISTS, which is racing-safe
    # across replicas — no need for a pre-check or duplicate-column swallow.
    async with engine.begin() as conn:
        for table, column, types in _COLUMN_MIGRATIONS:
            type_ = types["postgresql"]
            await conn.exec_driver_sql(
                f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "{column}" {type_}'
            )
