"""APScheduler bootstrap. Schedules per plan §7.

In dev: run via `python -m ao.daemon` (preferred; avoids uvicorn --reload
double-spawning jobs).
In Cloud Run later: AO_SCHEDULER_MODE=external disables this; Cloud
Scheduler hits POST /internal/jobs/* with the same handler bodies.
"""
from __future__ import annotations

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from ao.config import get_settings
from ao.db import models as m
from ao.db.engine import get_sessionmaker
from ao.logging import get_logger
from ao.scheduler import jobs

log = get_logger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    scheduler = AsyncIOScheduler(timezone="UTC")

    # One company-specific job per tracked company. Loaded fresh on boot;
    # the schedule is recomputed on `recompute_windows`.
    user_id = get_settings().user_id
    Session = get_sessionmaker()
    async with Session() as session:
        companies = (await session.execute(
            select(m.Company).where(
                m.Company.user_id == user_id, m.Company.archived_at.is_(None)
            )
        )).scalars().all()
    for c in companies:
        scheduler.add_job(
            jobs.poll_company,
            CronTrigger(hour=6, minute=0),  # daily baseline 06:00 UTC
            args=[c.ticker],
            id=f"poll-{c.ticker}",
            replace_existing=True,
        )

    # Cross-company jobs.
    scheduler.add_job(
        jobs.refresh_prices,
        IntervalTrigger(minutes=5),
        id="refresh-prices", replace_existing=True,
    )
    scheduler.add_job(
        jobs.refresh_news_insider,
        IntervalTrigger(minutes=30),
        id="refresh-news-insider", replace_existing=True,
    )
    scheduler.add_job(
        jobs.recompute_windows,
        CronTrigger(hour=0, minute=5),
        id="recompute-windows", replace_existing=True,
    )
    # Daily price-history backfill (00:10) → confidence recompute (00:15),
    # ordered after windows so each step reads the freshest upstream data.
    scheduler.add_job(
        jobs.backfill_prices,
        CronTrigger(hour=0, minute=10),
        id="backfill-prices", replace_existing=True,
    )
    scheduler.add_job(
        jobs.recompute_confidence,
        CronTrigger(hour=0, minute=15),
        id="recompute-confidence", replace_existing=True,
    )

    scheduler.start()
    _scheduler = scheduler
    log.info("scheduler.started", jobs=[j.id for j in scheduler.get_jobs()])
    return scheduler


async def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
