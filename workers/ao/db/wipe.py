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
    """Clear fetched data and tracked companies.

    Order matters — child tables must be deleted before their parents.
    Postgres enforces FK constraints; SQLite (local) does not by default,
    so a wrong order silently passes locally but raises on Railway and
    rolls the whole transaction back, leaving companies in place.

    FK chain (children point up):
      Provenance → Metric → Result → Filing → Company
      ReviewCandidate → ReviewItem → Result/Company
      AgentRun/Price/News/InsiderTx/CompanySourceOverride/Source → Company
      UsageDaily → User (independent of Company)
    """
    setup_logging("INFO")
    await create_all()
    Session = get_sessionmaker()
    async with Session() as session:
        for model in (
            m.Provenance,
            m.Metric,
            m.ReviewCandidate,
            m.ReviewItem,
            m.Result,
            m.Filing,
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
