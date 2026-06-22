"""Ticker → CIK lookup against SEC's public mapping.

`resolve_cik(ticker)` returns a zero-padded 10-digit CIK string (the form
`edgar_client.submissions()` expects), or None if the ticker isn't on SEC's
public list (OTC, ADR, transient fetch failure).

The mapping comes from `https://www.sec.gov/files/company_tickers.json`
(~150 KB, every exchange-listed ticker→CIK pair). No auth required, but SEC's
fair-use policy mandates the polite User-Agent in `config.edgar_user_agent`.

Two caches:
- In-memory dict keyed by uppercased ticker, populated on first call.
- On-disk JSON at `workers/var/cache/company_tickers.json`, refreshed if older
  than 24h. Avoids hammering SEC on every Add Companies call.
"""
from __future__ import annotations

import json
import time
from typing import Any

import httpx

from ao.config import CACHE_DIR, get_settings
from ao.logging import get_logger

log = get_logger(__name__)

SOURCE_URL = "https://www.sec.gov/files/company_tickers.json"
CACHE_PATH = CACHE_DIR / "company_tickers.json"
TTL_SECONDS = 24 * 60 * 60

_index: dict[str, str] | None = None  # uppercased ticker → padded CIK string


def _headers() -> dict[str, str]:
    return {"User-Agent": get_settings().edgar_user_agent}


def _pad(cik_int: int) -> str:
    return str(cik_int).zfill(10)


def _index_from_payload(payload: dict[str, Any]) -> dict[str, str]:
    out: dict[str, str] = {}
    for row in payload.values():
        if not isinstance(row, dict):
            continue
        ticker = str(row.get("ticker", "")).strip().upper()
        cik = row.get("cik_str")
        if ticker and isinstance(cik, int):
            out[ticker] = _pad(cik)
    return out


async def _load_index() -> dict[str, str]:
    """Return the parsed ticker→CIK map; fetch + write cache when stale."""
    global _index
    if _index is not None:
        return _index

    if CACHE_PATH.exists() and (time.time() - CACHE_PATH.stat().st_mtime) < TTL_SECONDS:
        try:
            payload = json.loads(CACHE_PATH.read_text())
            _index = _index_from_payload(payload)
            log.info("cik.cache_hit", entries=len(_index))
            return _index
        except (json.JSONDecodeError, OSError) as exc:
            log.warning("cik.cache_read_failed", error=str(exc))

    try:
        async with httpx.AsyncClient(headers=_headers(), timeout=20.0) as client:
            r = await client.get(SOURCE_URL)
            r.raise_for_status()
            payload = r.json()
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("cik.fetch_failed", error=str(exc))
        _index = {}
        return _index

    try:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(json.dumps(payload))
    except OSError as exc:
        log.warning("cik.cache_write_failed", error=str(exc))

    _index = _index_from_payload(payload)
    log.info("cik.fetched", entries=len(_index))
    return _index


async def resolve_cik(ticker: str) -> str | None:
    """Look up CIK for `ticker`. Returns zero-padded 10-digit string or None."""
    if not ticker:
        return None
    idx = await _load_index()
    return idx.get(ticker.strip().upper())
