"""GET /universe — the selectable S&P 500 roster for the Add Companies flow.

v1 serves from the static seed in `ao.data.sp500_seed` (162 rows) so the
screen renders identically online or offline. For any ticker that's already
on the user's watchlist, we overlay the live Price snapshot so the price the
user sees is the same one the watchlist shows. `tracked` is derived per
request from the user's active (non-archived) companies.

Snapshot-refresh from Finnhub for non-tracked tickers is left as a follow-up
(scheduled job that mutates a UniverseSnapshot table) — out of scope for v1
per the handoff: "static-roster v1 is acceptable".
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.api import schemas as s
from ao.api.deps import current_user_id, get_db
from ao.api.serializers import _latest_price
from ao.data.sp500_seed import SP500_SEED
from ao.db import models as m

router = APIRouter(tags=["universe"])


@router.get("/universe", response_model=list[s.UniverseCompany])
async def get_universe(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    # Active (non-archived) tracked companies → ticker → company_id.
    rows = (await db.execute(
        select(m.Company.ticker, m.Company.id).where(
            m.Company.user_id == user_id,
            m.Company.archived_at.is_(None),
        )
    )).all()
    tracked = {t: cid for (t, cid) in rows}

    out: list[s.UniverseCompany] = []
    for seed in SP500_SEED:
        ticker = seed["ticker"]
        cid = tracked.get(ticker)
        price = float(seed["price"])
        day_change = float(seed["dayChange"])
        if cid is not None:
            live_price, live_dc = await _latest_price(db, cid)
            if live_price > 0:
                price = live_price
                day_change = live_dc
        out.append(s.UniverseCompany(
            ticker=ticker, name=seed["name"], sector=seed["sector"],
            price=price, dayChange=day_change,
            mcap=float(seed["mcap"]),
            earn=seed["earn"], earnDays=int(seed["earnDays"]),
            tracked=cid is not None,
        ))
    return out
