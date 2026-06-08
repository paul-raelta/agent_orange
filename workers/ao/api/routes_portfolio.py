from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ao.api import schemas as s
from ao.api.deps import current_user_id, get_db
from ao.api.serializers import serialize_portfolio_totals

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/totals", response_model=s.PortfolioTotals)
async def get_totals(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    return await serialize_portfolio_totals(db, user_id)
