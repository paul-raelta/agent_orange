"""FastAPI dependencies.

`current_user_id` is the auth seam — returns the hardcoded user in v1. When
real auth lands, this dep parses a bearer token / session cookie and resolves
to the real user_id. Every row in the DB is already keyed by user_id so no
data migration is needed.
"""
from __future__ import annotations

from typing import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from ao.config import get_settings
from ao.db.engine import get_sessionmaker


async def get_db() -> AsyncIterator[AsyncSession]:
    Session = get_sessionmaker()
    async with Session() as session:
        yield session


def current_user_id() -> str:
    return get_settings().user_id
