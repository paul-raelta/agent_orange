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
