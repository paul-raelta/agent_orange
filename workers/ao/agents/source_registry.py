"""Source registry — maps (user, kind) → ordered list of enabled fetchers.

A "kind" is one of: filings | quote | news | insider | ir. Each agent stage
that hits external APIs asks the registry for the fetchers it should call,
instead of importing a specific client directly. That lets the user toggle
sources on/off, add custom URLs, or (eventually) prioritise one over another
without code changes.

Disabling a source stops new fetches; it does NOT rewrite any historical
provenance already recorded against that source.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.db import models as m
from ao.integrations import (
    edgar_client,
    finnhub_client,
    generic_fetcher,
    ir_fetcher,
)
from ao.logging import get_logger

log = get_logger(__name__)


# A fetcher is a callable taking a context dict (ticker, cik, url, etc.) and
# returning whatever shape the calling stage expects. The calling stage knows
# what to do with the result; the registry just delivers callables in order.
Fetcher = Callable[..., Awaitable[Any]]


@dataclass
class ResolvedSource:
    source_id: str
    name: str
    origin: str
    kind: str
    fetcher: Fetcher
    base_url: str | None
    config: dict


# ---------------------------------------------------------------------------
# Built-in fetcher adapters
#
# Each adapter normalises the diverse signatures of our concrete integration
# clients (edgar.submissions(cik), finnhub.quote(symbol), ir_fetcher.fetch(url))
# behind a uniform `(**ctx)` keyword-only call. Calling stages pass whatever
# context they have; the adapter pulls what it needs.
# ---------------------------------------------------------------------------

async def _edgar_submissions(**ctx: Any) -> Any:
    cik = ctx.get("cik")
    if not cik:
        return None
    return await edgar_client.submissions(cik)


async def _finnhub_quote(**ctx: Any) -> Any:
    ticker = ctx.get("ticker")
    if not ticker:
        return None
    return await finnhub_client.quote(ticker)


async def _finnhub_news(**ctx: Any) -> Any:
    ticker = ctx.get("ticker")
    if not ticker:
        return []
    return await finnhub_client.company_news(ticker, days=ctx.get("days", 30))


async def _finnhub_insider(**ctx: Any) -> Any:
    ticker = ctx.get("ticker")
    if not ticker:
        return []
    return await finnhub_client.insider_transactions(ticker)


async def _ir_fetch(**ctx: Any) -> Any:
    url = ctx.get("url")
    if not url:
        return None
    return await ir_fetcher.fetch(url)


BUILTIN_FETCHERS: dict[str, Fetcher] = {
    "sec_edgar": _edgar_submissions,
    "finnhub_quote": _finnhub_quote,
    "finnhub_news": _finnhub_news,
    "finnhub_insider": _finnhub_insider,
    "ir_fetcher": _ir_fetch,
}


def _user_fetcher_for(source: m.DataSource) -> Fetcher:
    """Adapter for a user-added DataSource — fetches its base_url through
    safe_fetch and returns the FetchOutcome to the caller."""
    base_url = source.base_url or ""

    async def _fetch(**_ctx: Any) -> Any:
        if not base_url:
            return None
        return await generic_fetcher.fetch_url(base_url)

    return _fetch


# ---------------------------------------------------------------------------
# Defaults — built-ins that should exist for every user
# ---------------------------------------------------------------------------

BUILTIN_SPECS = [
    dict(source_id="sec_edgar", name="SEC EDGAR", kind="filings",
         auth_label="No key required", auth_secret_ref=None,
         base_url="https://data.sec.gov"),
    dict(source_id="finnhub_quote", name="Finnhub — quote", kind="quote",
         auth_label="API key required", auth_secret_ref="FINNHUB_API_KEY",
         base_url="https://finnhub.io/api/v1"),
    dict(source_id="finnhub_news", name="Finnhub — company news", kind="news",
         auth_label="API key required", auth_secret_ref="FINNHUB_API_KEY",
         base_url="https://finnhub.io/api/v1"),
    dict(source_id="finnhub_insider", name="Finnhub — insider transactions",
         kind="insider", auth_label="API key required",
         auth_secret_ref="FINNHUB_API_KEY",
         base_url="https://finnhub.io/api/v1"),
    dict(source_id="ir_fetcher", name="Investor-relations site fetcher",
         kind="ir", auth_label="No key required", auth_secret_ref=None,
         base_url=None),
]


async def ensure_builtins(session: AsyncSession, user_id: str) -> None:
    """Make sure every BUILTIN_SPECS row exists for `user_id`. Idempotent.
    Called lazily on first registry access so an existing DB without seed
    still works."""
    existing = {
        row.source_id for row in (await session.execute(
            select(m.DataSource).where(m.DataSource.user_id == user_id)
        )).scalars().all()
    }
    added = False
    for spec in BUILTIN_SPECS:
        if spec["source_id"] in existing:
            continue
        # Status defaults to active for keyless sources; finnhub_* flip to
        # 'planned' until the FINNHUB_API_KEY env-var is populated. The
        # actual check happens in finnhub_client.is_configured() at call time;
        # the status here is a UI hint only.
        from ao.config import get_settings
        has_key = (
            spec["auth_secret_ref"] is None
            or (spec["auth_secret_ref"] == "FINNHUB_API_KEY"
                and bool(get_settings().finnhub_api_key))
        )
        session.add(m.DataSource(
            user_id=user_id, origin="builtin", enabled=True,
            status="active" if has_key else "planned",
            **spec,
        ))
        added = True
    if added:
        await session.commit()


# ---------------------------------------------------------------------------
# Public API used by agent stages
# ---------------------------------------------------------------------------

async def enabled_for(
    session: AsyncSession, user_id: str, kind: str,
) -> list[ResolvedSource]:
    """Return ordered enabled sources for a kind. Built-ins first, then
    user-origin (in created_at order)."""
    await ensure_builtins(session, user_id)
    rows = (await session.execute(
        select(m.DataSource).where(
            m.DataSource.user_id == user_id,
            m.DataSource.kind == kind,
            m.DataSource.enabled == True,  # noqa: E712
        ).order_by(m.DataSource.origin.desc(), m.DataSource.created_at)
    )).scalars().all()
    out: list[ResolvedSource] = []
    for row in rows:
        if row.origin == "builtin":
            fetcher = BUILTIN_FETCHERS.get(row.source_id)
            if fetcher is None:
                log.warning("source_registry.unknown_builtin", source=row.source_id)
                continue
        else:
            fetcher = _user_fetcher_for(row)
        out.append(ResolvedSource(
            source_id=row.source_id, name=row.name, origin=row.origin,
            kind=row.kind, fetcher=fetcher, base_url=row.base_url,
            config={},
        ))
    return out


async def record_fetch(
    session: AsyncSession, user_id: str, source_id: str,
    *, ok: bool, error: str | None = None,
) -> None:
    """Update last_ok_at / last_error on a DataSource row. Cheap heartbeat
    that powers the green/red dot on the UI."""
    row = (await session.execute(
        select(m.DataSource).where(
            m.DataSource.user_id == user_id,
            m.DataSource.source_id == source_id,
        )
    )).scalar_one_or_none()
    if row is None:
        return
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if ok:
        row.last_ok_at = now
        row.last_error = None
        if row.status == "error":
            row.status = "active"
    else:
        row.last_error = (error or "unknown error")[:255]
        row.status = "error"
    row.updated_at = now
    await session.commit()
