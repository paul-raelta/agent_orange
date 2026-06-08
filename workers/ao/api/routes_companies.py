from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.api import schemas as s
from ao.api.deps import current_user_id, get_db
from ao.api.serializers import serialize_companies, serialize_company
from ao.db import models as m

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=list[s.Company])
async def list_companies(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    return await serialize_companies(db, user_id)


@router.get("/{ticker}", response_model=s.Company)
async def get_company(
    ticker: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    row = (await db.execute(
        select(m.Company).where(
            m.Company.user_id == user_id, m.Company.ticker == ticker.upper()
        )
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, f"Unknown company '{ticker}'")
    return await serialize_company(db, row, include_news=True)


@router.post("/{ticker}/position", response_model=s.Company)
async def set_position(
    ticker: str,
    body: s.PositionRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    row = (await db.execute(
        select(m.Company).where(
            m.Company.user_id == user_id, m.Company.ticker == ticker.upper()
        )
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, f"Unknown company '{ticker}'")
    row.shares = body.shares
    row.cost_basis = body.costBasis
    await db.commit()
    await db.refresh(row)
    return await serialize_company(db, row, include_news=True)
