"""Wipe fetched + derived data so the UI looks like a first-time experience.

Cleared:
  - filings, results, metrics, provenance, agent_runs
  - prices, news, insider_tx, usage_daily, confidence_assessments
  - review_items, review_candidates
  - companies (and their per-company sources + per-company source overrides)

Reset to defaults (deleted then reseeded from seed.default_routing_rules):
  - routing_rules — so Settings → RESET reverts per-stage model picks to the
    canonical demo combo even if the user changed them via Settings → Routing.

Kept:
  - users, data_sources (per-user registry of feeds), providers,
    notification_prefs, settings, feature_flags, validation_thresholds,
    source_suggestions
"""
from __future__ import annotations

from sqlalchemy import delete, select

from ao.db import models as m
from ao.db.engine import create_all, get_engine, get_sessionmaker
from ao.db.seed import default_routing_rules
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
            m.ConfidenceAssessment,
            m.CompanySourceOverride,
            m.Source,
            m.Company,
        ):
            await session.execute(delete(model))

        # Reset routing rules to their canonical defaults — one row per
        # (user, task). Wipe, then reseed from the single source of truth.
        await session.execute(delete(m.RoutingRule))
        user_ids = (await session.execute(select(m.User.id))).scalars().all()
        for uid in user_ids:
            session.add_all(default_routing_rules(uid))

        await session.commit()
    await get_engine().dispose()
    log.info("wipe.done")
