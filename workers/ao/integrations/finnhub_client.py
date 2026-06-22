"""Finnhub REST wrapper.

Four endpoints used: /quote, /company-news, /stock/insider-transactions,
/stock/candle. Free tier: 60 req/min. Token-bucket at 50/min to leave
headroom; on 429 we log and let the caller retry on the next scheduler tick.

If FINNHUB_API_KEY is missing, all functions return empty lists / None — the
scheduler still ticks, just with no fresh data.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx

from ao.config import get_settings
from ao.logging import get_logger
from ao.util.ratelimit import TokenBucket

log = get_logger(__name__)

BASE_URL = "https://finnhub.io/api/v1"
_bucket = TokenBucket(rate_per_sec=50 / 60, capacity=20)  # 50 req / 60s


def is_configured() -> bool:
    return bool(get_settings().finnhub_api_key)


async def _get(client: httpx.AsyncClient, path: str, params: dict | None = None) -> Any:
    settings = get_settings()
    params = {**(params or {}), "token": settings.finnhub_api_key}
    await _bucket.acquire()
    r = await client.get(BASE_URL + path, params=params, timeout=15.0)
    if r.status_code == 429:
        log.warning("finnhub.rate_limited", path=path)
        return None
    r.raise_for_status()
    return r.json()


async def quote(symbol: str) -> dict | None:
    """{c: current, dp: daily-pct-change}. None on missing data."""
    if not is_configured():
        return None
    async with httpx.AsyncClient() as client:
        return await _get(client, "/quote", {"symbol": symbol})


async def company_profile(symbol: str) -> dict | None:
    """`/stock/profile2` — returns {logo, weburl, name, country, exchange, …}.

    None when Finnhub is unconfigured, the symbol is unknown (Finnhub returns
    an empty object), or the network errored. Best-effort: callers persist
    the `logo` field and fall back to the ticker monogram if absent.
    """
    if not is_configured():
        return None
    try:
        async with httpx.AsyncClient() as client:
            data = await _get(client, "/stock/profile2", {"symbol": symbol})
    except (httpx.HTTPError, ValueError):
        log.warning("finnhub.profile.failed", symbol=symbol)
        return None
    if not isinstance(data, dict) or not data:
        return None
    return data


async def company_news(symbol: str, *, days: int = 30) -> list[dict]:
    if not is_configured():
        return []
    today = date.today()
    start = today - timedelta(days=days)
    async with httpx.AsyncClient() as client:
        data = await _get(
            client, "/company-news",
            {"symbol": symbol, "from": start.isoformat(), "to": today.isoformat()},
        )
    return data or []


async def insider_transactions(symbol: str) -> list[dict]:
    if not is_configured():
        return []
    async with httpx.AsyncClient() as client:
        data = await _get(
            client, "/stock/insider-transactions", {"symbol": symbol},
        )
    return (data or {}).get("data", []) if isinstance(data, dict) else []


async def stock_candles(
    symbol: str, *, days: int = 365, resolution: str = "D",
) -> list[dict]:
    """Daily price history as [{ts: iso-date, close: float}], oldest→newest.

    NOTE: /stock/candle is premium on the current free tier and commonly
    returns 403 / {"s": "no_data"}. We treat any non-"ok" response as "no
    history available" and return [] so callers fall back to the price
    snapshots accumulated by refresh_prices.
    """
    if not is_configured():
        return []
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    async with httpx.AsyncClient() as client:
        data = await _get(
            client, "/stock/candle",
            {
                "symbol": symbol, "resolution": resolution,
                "from": int(start.timestamp()), "to": int(now.timestamp()),
            },
        )
    if not isinstance(data, dict) or data.get("s") != "ok":
        return []
    closes = data.get("c") or []
    stamps = data.get("t") or []
    out: list[dict] = []
    for close, t in zip(closes, stamps):
        try:
            ts = datetime.fromtimestamp(int(t), tz=timezone.utc).isoformat(
                timespec="seconds"
            )
            out.append({"ts": ts, "close": float(close)})
        except (ValueError, TypeError, OSError):
            continue
    return out
