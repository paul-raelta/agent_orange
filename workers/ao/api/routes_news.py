from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.api import schemas as s
from ao.api.deps import current_user_id, get_db
from ao.db import models as m

router = APIRouter(prefix="/companies", tags=["news"])


async def _resolve_company(db: AsyncSession, user_id: str, ticker: str) -> m.Company:
    row = (await db.execute(
        select(m.Company).where(
            m.Company.user_id == user_id, m.Company.ticker == ticker.upper()
        )
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, f"Unknown company '{ticker}'")
    return row


@router.get("/{ticker}/news", response_model=list[s.NewsItem])
async def list_news(
    ticker: str, limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    c = await _resolve_company(db, user_id, ticker)
    rows = (await db.execute(
        select(m.News).where(m.News.company_id == c.id)
        .order_by(desc(m.News.ts)).limit(limit)
    )).scalars().all()
    return [
        s.NewsItem(ts=n.ts, headline=n.headline, summary=n.summary, url=n.url, source=n.source)
        for n in rows
    ]


@router.get("/{ticker}/insider", response_model=list[s.InsiderTx])
async def list_insider(
    ticker: str, limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    c = await _resolve_company(db, user_id, ticker)
    rows = (await db.execute(
        select(m.InsiderTx).where(m.InsiderTx.company_id == c.id)
        .order_by(desc(m.InsiderTx.ts)).limit(limit)
    )).scalars().all()
    return [
        s.InsiderTx(
            ts=ix.ts, insider=ix.insider_name, role=ix.role,
            type=("BUY" if ix.transaction_type == "BUY" else "SELL"),
            shares=ix.shares, price=ix.price, value=ix.value, url=ix.filing_url,
        )
        for ix in rows
    ]
