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

from ao.agents.runlog import run_log
from ao.db import models as m
from ao.integrations import edgar_client
from ao.logging import get_logger

log = get_logger(__name__)

EARNINGS_FORMS = {"10-Q", "10-K", "8-K"}


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

    try:
        data = await edgar_client.submissions(company.cik)
    except Exception as exc:  # noqa: BLE001
        async with run_log(session, user_id, company.ticker, stage="monitor",
                           company_id=company.id) as rec:
            rec.set(level="error", message=f"EDGAR fetch failed: {exc}")
        return None

    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    accs = recent.get("accessionNumber", [])
    dates = recent.get("filingDate", [])
    primary_docs = recent.get("primaryDocument", [])

    # Find the most-recent earnings form (10-Q/10-K/8-K). 8-K filtering by
    # item is best-effort: SEC publishes items in a different recent field
    # array; we accept all 8-K and let extraction reject non-earnings ones.
    target_idx: int | None = None
    for i, f in enumerate(forms):
        if f in EARNINGS_FORMS:
            target_idx = i
            break
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
