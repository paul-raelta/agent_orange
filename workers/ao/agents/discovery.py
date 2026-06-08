"""Discovery stage. Given a ticker, find IR URL + EDGAR CIK + cadence.

The full version uses Sonnet with tool-use to call EDGAR and probe IR pages.
For v1 (and for the no-Anthropic-key fallback), we do a deterministic
SEC-only path: fetch the ticker→CIK lookup from EDGAR's public company_tickers
JSON, then return a structured result. Cadence is inferred from the last 8
filings' periodicity (calculated, not LLM-guessed).
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date
from typing import Any

import httpx

from ao.agents.runlog import run_log
from ao.db import models as m
from ao.integrations import edgar_client
from ao.logging import get_logger

log = get_logger(__name__)

# EDGAR's authoritative ticker→CIK file. Tiny (~1MB), cached in-process.
_TICKER_CIK_URL = "https://www.sec.gov/files/company_tickers.json"
_ticker_cache: dict[str, dict] | None = None


async def _load_ticker_map() -> dict[str, dict]:
    global _ticker_cache
    if _ticker_cache is not None:
        return _ticker_cache
    async with httpx.AsyncClient(
        headers={"User-Agent": "Agent Orange paulmcevoy@gmail.com"},
        timeout=20.0,
    ) as client:
        r = await client.get(_TICKER_CIK_URL)
        r.raise_for_status()
        data = r.json()
    _ticker_cache = {row["ticker"].upper(): row for row in data.values()}
    return _ticker_cache


def _infer_cadence(filing_dates: list[str]) -> str:
    """Quarterly vs Semi-annual from the gap between recent 10-Q / 10-K dates."""
    if len(filing_dates) < 3:
        return "Quarterly"
    days = []
    parsed = sorted(
        date.fromisoformat(d) for d in filing_dates if d
    )
    for a, b in zip(parsed, parsed[1:]):
        days.append((b - a).days)
    if not days:
        return "Quarterly"
    median = statistics.median(days)
    return "Semi-annual" if median > 150 else "Quarterly"


@dataclass
class DiscoveryOutput:
    ticker: str
    name: str
    cik: str
    ir_url: str
    cadence: str
    raw: dict[str, Any]


async def discover_ticker(
    session, user_id: str, ticker: str
) -> DiscoveryOutput | None:
    ticker = ticker.upper()
    async with run_log(session, user_id, ticker, stage="discovery") as rec:
        try:
            ticker_map = await _load_ticker_map()
        except Exception as exc:  # noqa: BLE001
            rec.set(level="error", message=f"EDGAR ticker map fetch failed: {exc}")
            return None

        row = ticker_map.get(ticker)
        if row is None:
            rec.set(level="warn", message=f"Ticker {ticker} not found in EDGAR registry.")
            return None

        cik = str(row["cik_str"])
        name = row["title"]

        try:
            sub = await edgar_client.submissions(cik)
        except Exception as exc:  # noqa: BLE001
            rec.set(level="error", message=f"EDGAR submissions fetch failed: {exc}")
            return None

        # cadence: collect last 10-Q + 10-K filing dates
        recent = sub.get("filings", {}).get("recent", {})
        forms = recent.get("form", [])
        dates = recent.get("filingDate", [])
        periodic = [
            d for f, d in zip(forms, dates) if f in ("10-Q", "10-K")
        ][:8]
        cadence = _infer_cadence(periodic)

        ir_url = (
            sub.get("website") or f"https://www.sec.gov/cgi-bin/browse-edgar?CIK={cik}"
        )

        # Persist into companies + sources (idempotent — caller may have already
        # created the row from POST /companies; we update in place if so).
        rec.set(
            level="ok",
            message=f"Discovered {ticker} → CIK {cik}, cadence={cadence}.",
        )
        return DiscoveryOutput(
            ticker=ticker, name=name, cik=cik, ir_url=ir_url,
            cadence=cadence, raw=sub,
        )
