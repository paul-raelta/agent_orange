"""Wipe fetched + derived data so the UI looks like a first-time experience.

Cleared:
  - filings, results, metrics, provenance, agent_runs
  - prices, news, insider_tx, usage_daily
  - review_items, review_candidates

Kept (so the user can immediately re-run agents against the same config):
  - users, companies, sources, routing_rules, providers, notification_prefs, settings

Reset on companies:
  - status → 'watching'
  - next_window_* cleared

After wipe we re-seed the SanDisk-style review queue demos so the Review screen
has something to show — they're useful as a UI demo even before live data lands.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.config import get_settings
from ao.db import models as m
from ao.db.engine import create_all, get_engine, get_sessionmaker
from ao.db.seed import SNDK_TABLE, uuid_hex
from ao.logging import get_logger, setup_logging

log = get_logger(__name__)


async def wipe(reseed_demo_review: bool = True) -> None:
    """Clear fetched data; optionally re-seed the demo review queue items."""
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
        ):
            await session.execute(delete(model))

        # Reset per-company state that depends on fetched data.
        companies = (await session.execute(select(m.Company))).scalars().all()
        for c in companies:
            c.status = "watching"
            c.next_window_from = None
            c.next_window_to = None
            c.next_window_label = None

        # Optionally re-seed the SNDK demo review items so Review has content.
        if reseed_demo_review:
            sndk = next((c for c in companies if c.ticker == "SNDK"), None)
            if sndk is not None:
                user_id = get_settings().user_id
                now = datetime.now(timezone.utc)
                found_recent = (now - timedelta(hours=5)).isoformat(timespec="seconds")

                rv1 = m.ReviewItem(
                    id=f"rv-{uuid_hex()[:6]}",
                    user_id=user_id, company_id=sndk.id,
                    period="Fiscal Q4", period_end="Jun 27, 2026",
                    field="EPS · diluted",
                    reason="EPS conflict across sources (demo)",
                    conf="low", found_on=found_recent,
                    snippet_source=SNDK_TABLE["source_label"],
                    snippet_url=SNDK_TABLE["url"],
                    snippet_page=SNDK_TABLE["page"],
                    snippet_quote=SNDK_TABLE["quote"],
                )
                session.add(rv1)
                session.add_all([
                    m.ReviewCandidate(
                        id=uuid_hex(), review_item_id=rv1.id, value="$0.82",
                        source="Press release headline", page=1,
                        weight="GAAP, headline", rank=0,
                    ),
                    m.ReviewCandidate(
                        id=uuid_hex(), review_item_id=rv1.id, value="$0.79",
                        source="8-K Exhibit 99.1 (p.11)", page=11,
                        weight="schedule, footnoted", rank=1,
                    ),
                ])

                rv2 = m.ReviewItem(
                    id=f"rv-{uuid_hex()[:6]}",
                    user_id=user_id, company_id=sndk.id,
                    period="Fiscal Q4", period_end="Jun 27, 2026",
                    field="Net income",
                    reason="Net income found in only one location (demo)",
                    conf="med", found_on=found_recent,
                    snippet_source=SNDK_TABLE["source_label"],
                    snippet_url=SNDK_TABLE["url"],
                    snippet_page=SNDK_TABLE["page"],
                    snippet_quote=SNDK_TABLE["quote"],
                )
                session.add(rv2)
                session.add(m.ReviewCandidate(
                    id=uuid_hex(), review_item_id=rv2.id, value="$118M",
                    source="8-K Exhibit 99.1 (p.11)", page=11,
                    weight="single source", rank=0,
                ))

        await session.commit()
    await get_engine().dispose()
    log.info("wipe.done", reseeded_demo=reseed_demo_review)
