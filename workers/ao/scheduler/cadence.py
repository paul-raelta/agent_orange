"""Compute the predicted next filing window from a company's prior cadence.

next_window_from = next_period_end + mean(reporting_lag) - max(stdev, 5d)
next_window_to   = next_period_end + mean(reporting_lag) + max(stdev, 7d)
next_period_end  = last_period_end + cadence_delta (90d quarterly, 182d semi)
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.db import models as m


@dataclass
class Window:
    from_: date
    to: date
    label: str


def _parse(d: str) -> date | None:
    try:
        return date.fromisoformat(d)
    except Exception:
        return None


async def compute_next_window(
    session: AsyncSession, company: m.Company
) -> Window | None:
    rows = (await session.execute(
        select(m.Filing)
        .where(m.Filing.company_id == company.id)
        .order_by(desc(m.Filing.reported_on)).limit(8)
    )).scalars().all()
    if not rows:
        return None

    # Parse period_end → reported_on lag for each filing where both are dates.
    # A single filing is enough: pstdev collapses to 0 and the min ±5/7d clamps
    # below provide the window width until more history accumulates.
    lags = []
    period_ends = []
    for r in rows:
        pe = _parse(r.period_end or "")
        rep = _parse(r.reported_on or "")
        if pe and rep:
            lags.append((rep - pe).days)
            period_ends.append(pe)
    if not lags or not period_ends:
        return None

    delta_days = 90 if company.cadence == "Quarterly" else 182
    next_period_end = max(period_ends) + timedelta(days=delta_days)
    mean_lag = int(statistics.mean(lags))
    stdev_lag = int(statistics.pstdev(lags)) if len(lags) > 1 else 0

    from_ = next_period_end + timedelta(days=mean_lag - max(stdev_lag, 5))
    to = next_period_end + timedelta(days=mean_lag + max(stdev_lag, 7))
    return Window(
        from_=from_, to=to,
        label=f"{company.cadence[:1]} expected",
    )
