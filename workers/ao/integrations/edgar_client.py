"""SEC EDGAR client.

Two surfaces:
- `submissions(cik)` — JSON snapshot of all recent filings for a company.
- `download_filing(cik, accession, primary)` — fetch a primary doc into the
  local cache. Path returned for downstream pdf_extractor to read.

EDGAR requires a real contact in the User-Agent (per SEC's fair-use policy);
config.py builds it. Rate limit: 10 req/s; bucket at 8.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx

from ao.config import CACHE_DIR, get_settings
from ao.logging import get_logger
from ao.util.ratelimit import TokenBucket

log = get_logger(__name__)

_bucket = TokenBucket(rate_per_sec=8.0, capacity=8)


def _headers() -> dict[str, str]:
    return {"User-Agent": get_settings().edgar_user_agent}


def _pad_cik(cik: str) -> str:
    """EDGAR pads CIKs to 10 digits in submissions URLs."""
    return cik.zfill(10)


async def submissions(cik: str) -> dict[str, Any]:
    """Return EDGAR's submissions JSON for `cik`."""
    url = f"https://data.sec.gov/submissions/CIK{_pad_cik(cik)}.json"
    await _bucket.acquire()
    async with httpx.AsyncClient(headers=_headers(), timeout=20.0) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.json()


async def download_filing(
    cik: str, accession: str, primary_filename: str
) -> Path:
    """Download one document from a filing's index and cache it locally.

    accession is the dash-included form, e.g. "0001045810-26-000012". The
    URL form drops the dashes for the path.
    """
    acc_nodash = accession.replace("-", "")
    url = (
        f"https://www.sec.gov/Archives/edgar/data/"
        f"{int(cik)}/{acc_nodash}/{primary_filename}"
    )
    await _bucket.acquire()
    dest = CACHE_DIR / f"{cik}_{acc_nodash}_{primary_filename}"
    if dest.exists():
        log.info("edgar.cache_hit", path=str(dest))
        return dest

    async with httpx.AsyncClient(headers=_headers(), timeout=60.0, follow_redirects=True) as client:
        r = await client.get(url)
        r.raise_for_status()
        dest.write_bytes(r.content)
    log.info("edgar.fetched", path=str(dest), size=len(r.content))
    return dest
