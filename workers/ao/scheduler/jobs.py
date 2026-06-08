"""Job functions invoked by the in-process APScheduler — and, later, by Cloud
Scheduler hitting POST /internal/jobs/* endpoints. The function bodies are the
same in either world; the trigger source is what changes.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select

from ao.agents.pipeline import run_one
from ao.config import get_settings
from ao.db import models as m
from ao.db.engine import get_sessionmaker
from ao.integrations import finnhub_client
from ao.logging import get_logger
from ao.scheduler.cadence import compute_next_window

log = get_logger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


async def poll_company(ticker: str) -> None:
    """Run the full pipeline (monitor → extract → validate → narrative) for one ticker."""
    user_id = get_settings().user_id
    Session = get_sessionmaker()
    async with Session() as session:
        await run_one(session, user_id, ticker)


async def refresh_prices() -> None:
    """Pull current quote for every tracked company. Cheap; runs frequently."""
    user_id = get_settings().user_id
    Session = get_sessionmaker()
    async with Session() as session:
        rows = (await session.execute(
            select(m.Company).where(m.Company.user_id == user_id)
        )).scalars().all()
        for c in rows:
            q = await finnhub_client.quote(c.ticker)
            if not q or "c" not in q:
                continue
            session.add(m.Price(
                id=uuid4().hex, company_id=c.id, ts=_now_iso(),
                price=float(q["c"]), day_change=float(q.get("dp", 0.0)),
            ))
        await session.commit()
    log.info("scheduler.prices_refreshed", count=len(rows))


async def refresh_news_insider() -> None:
    """Pull Finnhub company news + insider transactions per company."""
    user_id = get_settings().user_id
    Session = get_sessionmaker()
    async with Session() as session:
        rows = (await session.execute(
            select(m.Company).where(m.Company.user_id == user_id)
        )).scalars().all()
        for c in rows:
            # News
            news = await finnhub_client.company_news(c.ticker, days=30)
            seen_urls = {
                u for (u,) in (await session.execute(
                    select(m.News.url).where(m.News.company_id == c.id)
                )).all()
            }
            for n in news[:20]:
                url = n.get("url", "")
                if not url or url in seen_urls:
                    continue
                ts = datetime.fromtimestamp(
                    n.get("datetime", 0), tz=timezone.utc,
                ).isoformat(timespec="seconds")
                session.add(m.News(
                    id=uuid4().hex, company_id=c.id, ts=ts,
                    headline=n.get("headline", "")[:255],
                    summary=n.get("summary", "")[:500],
                    url=url, source=n.get("source", ""),
                ))
            # Insider
            insider = await finnhub_client.insider_transactions(c.ticker)
            seen_keys = {
                (k1, k2, k3) for (k1, k2, k3) in (await session.execute(
                    select(m.InsiderTx.ts, m.InsiderTx.insider_name, m.InsiderTx.shares)
                    .where(m.InsiderTx.company_id == c.id)
                )).all()
            }
            for tx in insider[:50]:
                name = tx.get("name", "")
                shares = int(tx.get("share", 0) or 0)
                ts = tx.get("transactionDate") or tx.get("filingDate") or ""
                key = (ts, name, shares)
                if not name or key in seen_keys:
                    continue
                code = (tx.get("transactionCode") or "").upper()
                ttype = "BUY" if code in {"P", "A"} else "SELL"
                price = float(tx.get("transactionPrice", 0) or 0)
                session.add(m.InsiderTx(
                    id=uuid4().hex, company_id=c.id, ts=ts,
                    insider_name=name, role=tx.get("position", "") or "",
                    transaction_type=ttype, shares=shares, price=price,
                    value=shares * price,
                    filing_url=tx.get("source", "") or "",
                ))
        await session.commit()
    log.info("scheduler.news_insider_refreshed")


async def recompute_windows() -> None:
    """Re-derive each company's nextWindow from its filing history."""
    user_id = get_settings().user_id
    Session = get_sessionmaker()
    async with Session() as session:
        rows = (await session.execute(
            select(m.Company).where(m.Company.user_id == user_id)
        )).scalars().all()
        for c in rows:
            w = await compute_next_window(session, c)
            if w is None:
                continue
            c.next_window_from = w.from_.isoformat()
            c.next_window_to = w.to.isoformat()
            c.next_window_label = w.label
        await session.commit()
    log.info("scheduler.windows_recomputed")
