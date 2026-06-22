"""Wipe fetched + derived data so the UI looks like a first-time experience.

Cleared:
  - filings, results, metrics, provenance, agent_runs
  - prices, news, insider_tx, usage_daily
  - review_items, review_candidates
  - companies (and their per-company sources + per-company source overrides)

Kept:
  - users, data_sources (per-user registry of feeds), routing_rules,
    providers, notification_prefs, settings, source_suggestions
"""
from __future__ import annotations

from sqlalchemy import delete

from ao.db import models as m
from ao.db.engine import create_all, get_engine, get_sessionmaker
from ao.logging import get_logger, setup_logging

log = get_logger(__name__)


async def wipe() -> None:
    """Clear fetched data and tracked companies."""
    setup_logging("INFO")
    await create_all()
    Session = get_sessionmaker()
    async with Session() as session:
        # Order matters — delete child tables before parents.
        for model in (
            m.Provenance,
            m.Metric,
            m.Result,
            m.Filing,
            m.ReviewCandidate,
            m.ReviewItem,
            m.AgentRun,
            m.Price,
            m.News,
            m.InsiderTx,
            m.UsageDaily,
            m.CompanySourceOverride,
            m.Source,
            m.Company,
        ):
            await session.execute(delete(model))

        await session.commit()
    await get_engine().dispose()
    log.info("wipe.done")
