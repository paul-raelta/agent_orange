from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ao.api import schemas as s
from ao.api.deps import current_user_id, get_db
from ao.api.serializers import serialize_activity

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=list[s.ActivityRow])
async def list_activity(
    ticker: str | None = None,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    return await serialize_activity(db, user_id, ticker=ticker)
