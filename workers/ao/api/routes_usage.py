from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ao.api import schemas as s
from ao.api.deps import current_user_id, get_db
from ao.api.serializers import serialize_usage

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("", response_model=s.Usage)
async def get_usage(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    return await serialize_usage(db, user_id)
