"""Run-related routes: POST /run, POST /companies/{ticker}/run, GET /discovery/{job_id}.

The full agent pipeline isn't wired yet. For now POST /run records an activity
row and returns a fresh lastSync — enough for the UI's RUN ALL AGENTS button
to round-trip. POST /companies (discovery) returns a stub job_id and the
discovery polling endpoint returns a synthesized `found` result after a beat.

Replaced by the real pipeline once agents/pipeline.py lands.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.agents import pipeline_state
from ao.agents.pipeline import run_one
from ao.api import schemas as s
from ao.api.deps import current_user_id, get_db
from ao.db import models as m
from ao.db.engine import get_sessionmaker
from ao.logging import get_logger

log = get_logger(__name__)


async def _bg_run(user_id: str, ticker: str) -> None:
    """Fire-and-forget pipeline run; opens its own session so the request can return."""
    pipeline_state.mark_started(user_id, ticker)
    Session = get_sessionmaker()
    try:
        async with Session() as session:
            await run_one(session, user_id, ticker)
    except Exception as exc:  # noqa: BLE001
        log.error("bg_run.failed", ticker=ticker, error=str(exc))
    finally:
        pipeline_state.mark_finished(user_id, ticker)


async def _bg_run_all(user_id: str) -> None:
    """One-click full refresh: pipeline per company, plus price/news/insider
    pulls and window recompute. So a freshly-wiped UI lights up fully after
    a single RUN ALL AGENTS click.

    Data refreshes the confidence score reads (prices, history backfill,
    news/insider) run BEFORE the per-company pipeline so each pipeline's
    confidence assessment sees fresh inputs. Window recompute runs last so it
    reflects any filings the pipeline just discovered."""
    from ao.scheduler.jobs import (
        backfill_prices, recompute_windows, refresh_news_insider,
        refresh_prices,
    )

    Session = get_sessionmaker()
    async with Session() as session:
        rows = (await session.execute(
            select(m.Company.ticker).where(
                m.Company.user_id == user_id, m.Company.archived_at.is_(None)
            )
        )).all()

    # (Queue is populated synchronously by the route handler before the bg
    # task starts; see POST /run. We re-queue defensively in case _bg_run_all
    # was invoked through a path that bypasses the handler.)
    pipeline_state.queue_tickers(user_id, [t for (t,) in rows])

    # Pre-pipeline data refreshes — confidence reads these.
    for label, fn in (
        ("prices", refresh_prices),
        ("backfill_prices", backfill_prices),
        ("news_insider", refresh_news_insider),
    ):
        try:
            await fn()
        except Exception as exc:  # noqa: BLE001
            log.error("bg_run_all.side_refresh_failed", step=label, error=str(exc))

    # Per-company pipeline (monitor → extract → validate → narrative →
    # confidence → notify).
    for (ticker,) in rows:
        try:
            await _bg_run(user_id, ticker)
        except Exception as exc:  # noqa: BLE001
            log.error("bg_run_all.company_failed", ticker=ticker, error=str(exc))

    # Window recompute last — reflects newly discovered filings.
    try:
        await recompute_windows()
    except Exception as exc:  # noqa: BLE001
        log.error("bg_run_all.side_refresh_failed", step="windows", error=str(exc))

router = APIRouter(tags=["run"])

# In-memory job state for discovery (replaced by a real job table when agents
# land). Keyed by job_id → {phase, result}. Process-local — fine for v1.
_discovery_jobs: dict[str, dict] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _human_now() -> str:
    return datetime.now(timezone.utc).strftime("%b %d · %H:%M")


@router.post("/run", response_model=s.RunResponse)
async def run_all(
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    job_id = uuid4().hex
    db.add(m.AgentRun(
        user_id=user_id, agent="system", stage="run_all",
        level="info", message="Manual run requested for all agents.",
    ))
    await db.commit()
    # Synchronously queue tickers BEFORE returning so the frontend's
    # onSuccess refetch picks up `pipelineRun` immediately — otherwise the
    # background task races the refetch and the QUEUED pill flashes late.
    tickers = (await db.execute(
        select(m.Company.ticker).where(
            m.Company.user_id == user_id, m.Company.archived_at.is_(None)
        )
    )).all()
    pipeline_state.queue_tickers(user_id, [t for (t,) in tickers])
    background.add_task(_bg_run_all, user_id)
    return s.RunResponse(jobId=job_id, lastSync=_human_now())


@router.post("/companies/{ticker}/run", response_model=s.RunResponse)
async def trigger_run_one(
    ticker: str,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    job_id = uuid4().hex
    db.add(m.AgentRun(
        user_id=user_id, agent=ticker.upper(), stage="run_one",
        level="info", message=f"Manual run requested for {ticker.upper()}.",
    ))
    await db.commit()
    # Synchronously queue the ticker so the watchlist's first refetch sees
    # the QUEUED state — _bg_run flips it to RUNNING when the bg task starts.
    pipeline_state.queue_tickers(user_id, [ticker.upper()])
    background.add_task(_bg_run, user_id, ticker)
    return s.RunResponse(jobId=job_id, lastSync=_human_now())


@router.post("/companies", response_model=s.RunResponse)
async def add_company(body: s.AddCompanyRequest):
    """Kicks off discovery. The real agent pipeline replaces this stub.

    A small allowlist of tickers returns competing IR `candidates[]` so the
    UI's "⚑ CONFIRM IR" step is exercisable end-to-end against the stub.
    The user's pick rides back via POST /companies/batch primaryIr.
    """
    job_id = uuid4().hex
    ticker = body.ticker.upper()
    ir = (
        "ir.amd.com" if ticker == "AMD"
        else f"investors.{ticker.lower()}.com"
    )
    # Demo set: tickers where the public IR page is split between a corporate
    # and a long-form quarterly-results page. The user picks one as primary.
    AMBIGUOUS = {
        "AMD": [
            ("https://ir.amd.com", "Corporate investor relations homepage"),
            ("https://ir.amd.com/quarterly-results", "Quarterly results & filings"),
        ],
        "GOOGL": [
            ("https://abc.xyz/investor", "Alphabet investor relations"),
            ("https://abc.xyz/investor/news/", "Press releases & earnings"),
        ],
        "META": [
            ("https://investor.fb.com", "Meta investor homepage"),
            ("https://investor.fb.com/financials/", "Financials & filings"),
        ],
    }
    candidates: list[s.IRCandidate] | None = None
    if ticker in AMBIGUOUS:
        candidates = [s.IRCandidate(url=u, note=n) for (u, n) in AMBIGUOUS[ticker]]
    _discovery_jobs[job_id] = {
        "phase": "found",
        "result": s.DiscoveryResultPayload(
            ir=ir,
            sec=f"EDGAR · search “{ticker}”",
            cadence="Quarterly (inferred from last 8 filings)",
            window="predicted ±10 days around prior dates",
            candidates=candidates,
        ).model_dump(),
    }
    return s.RunResponse(jobId=job_id, lastSync=_now())


@router.get("/discovery/{job_id}", response_model=s.DiscoveryStatus)
async def get_discovery(job_id: str):
    job = _discovery_jobs.get(job_id)
    if job is None:
        return s.DiscoveryStatus(phase="error", error="Unknown job_id")
    return s.DiscoveryStatus(
        phase=job["phase"],
        result=s.DiscoveryResultPayload(**job["result"]) if job.get("result") else None,
    )
