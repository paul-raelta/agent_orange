"""Monitoring poll — rule-based EDGAR check.

For each company, fetch EDGAR submissions JSON. Compare the top accession
number against the most recent `filings.accession` row in our DB. If new
and the form is in {10-Q, 10-K, 8-K} (8-K with item 2.02 only), enqueue
the extraction stage.

No LLM required for the canonical path — Haiku only kicks in for ambiguous
IR-site press releases (not implemented in v1; the EDGAR path is enough).
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.agents import source_registry
from ao.agents.runlog import run_log
from ao.db import models as m
from ao.integrations import edgar_client
from ao.logging import get_logger

log = get_logger(__name__)

PERIODIC_FORMS = {"10-Q", "10-K"}  # full income statement → reliable extraction
EARNINGS_FORMS = PERIODIC_FORMS | {"8-K"}  # 8-K-2.02 is also valid but rare


async def poll_company(
    session: AsyncSession, user_id: str, company: m.Company
) -> m.Filing | None:
    """Return the newly-discovered Filing, or None if nothing new.

    Does NOT trigger extraction itself — that's pipeline.py's job. This stage
    just creates the Filing row + logs the agent_runs row.
    """
    if not company.cik:
        async with run_log(session, user_id, company.ticker, stage="monitor",
                           company_id=company.id) as rec:
            rec.set(level="warn", message="No CIK on file — discovery hasn't run yet.")
        return None

    # Ask the registry for enabled 'filings' sources. Built-in sec_edgar is
    # the only fetcher that returns the EDGAR submissions shape today, so we
    # use whichever resolved fetcher is for source_id 'sec_edgar'. A future
    # enhancement could blend multiple filing-source results; v1 keeps it
    # simple — disabled sec_edgar means we skip the poll entirely.
    filing_sources = await source_registry.enabled_for(
        session, user_id, kind="filings", company_id=company.id,
    )
    edgar = next((s for s in filing_sources if s.source_id == "sec_edgar"), None)
    if edgar is None:
        async with run_log(session, user_id, company.ticker, stage="monitor",
                           company_id=company.id) as rec:
            rec.set(level="info",
                    message="Skipped: SEC EDGAR source is disabled in Settings → Data sources.")
        return None
    try:
        data = await edgar.fetcher(cik=company.cik)
    except Exception as exc:  # noqa: BLE001
        await source_registry.record_fetch(
            session, user_id, "sec_edgar", ok=False, error=str(exc),
        )
        async with run_log(session, user_id, company.ticker, stage="monitor",
                           company_id=company.id) as rec:
            rec.set(level="error", message=f"EDGAR fetch failed: {exc}")
        return None
    await source_registry.record_fetch(session, user_id, "sec_edgar", ok=True)

    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    accs = recent.get("accessionNumber", [])
    dates = recent.get("filingDate", [])
    primary_docs = recent.get("primaryDocument", [])

    # Prefer 10-Q / 10-K (have the full income statement Opus needs) over 8-K
    # (mostly material-event announcements; only the rare 8-K-2.02 is earnings).
    # Iterate the recent feed once: pick the first 10-Q/10-K, falling back to
    # an 8-K only if no quarterly/annual is in the window.
    periodic_idx: int | None = None
    eightk_idx: int | None = None
    for i, f in enumerate(forms):
        if f in PERIODIC_FORMS and periodic_idx is None:
            periodic_idx = i
            break
        if f == "8-K" and eightk_idx is None:
            eightk_idx = i
    target_idx = periodic_idx if periodic_idx is not None else eightk_idx
    if target_idx is None:
        async with run_log(session, user_id, company.ticker, stage="monitor",
                           company_id=company.id) as rec:
            rec.set(level="info", message="No earnings form in recent EDGAR feed.")
        return None

    accession = accs[target_idx]
    filing_date = dates[target_idx]
    primary = primary_docs[target_idx] if target_idx < len(primary_docs) else ""

    # Skip if we already have this accession.
    existing = (await session.execute(
        select(m.Filing).where(
            m.Filing.company_id == company.id, m.Filing.accession == accession,
        )
    )).scalar_one_or_none()
    if existing is not None:
        async with run_log(session, user_id, company.ticker, stage="monitor",
                           company_id=company.id) as rec:
            rec.set(level="info",
                    message=f"No new filings — latest known {accession} ({forms[target_idx]}).")
        return None

    # New filing! Create the row.
    filing = m.Filing(
        id=uuid4().hex, company_id=company.id,
        form_type=forms[target_idx], period="?", period_end=filing_date,
        reported_on=filing_date, accession=accession, source_url=primary,
        discovered_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
    )
    session.add(filing)
    async with run_log(session, user_id, company.ticker, stage="monitor",
                       company_id=company.id) as rec:
        rec.set(
            level="ok",
            message=f"New {forms[target_idx]} detected — accession {accession}, filed {filing_date}.",
        )
    return filing
