"""Orchestrator — wires monitoring → extraction → validation → narrative → notify.

Idempotent: stages are no-ops if already complete for a (filing_id, stage)
pair. Activity rows are written by each stage via run_log; this module owns
the cross-stage flow control.

When ANTHROPIC_API_KEY isn't set, the LLM stages log a warning and exit
gracefully — monitoring still runs and new filings are still recorded.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.agents import confidence, extraction, monitoring, narrative, validation
from ao.agents.runlog import run_log
from ao.db import models as m
from ao.integrations import edgar_client
from ao.logging import get_logger
from ao.notify import dispatcher
from ao.notify.events import Event

log = get_logger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


async def run_one(session: AsyncSession, user_id: str, ticker: str) -> None:
    """Run a single end-to-end pipeline pass for one ticker."""
    ticker = ticker.upper()
    company = (await session.execute(
        select(m.Company).where(
            m.Company.user_id == user_id, m.Company.ticker == ticker,
        )
    )).scalar_one_or_none()
    if company is None:
        log.warning("pipeline.unknown_ticker", ticker=ticker)
        return

    # --- 1. Monitor ----------------------------------------------------
    new_filing = await monitoring.poll_company(session, user_id, company)
    if new_filing is None:
        return

    # --- 2. Download the primary doc ----------------------------------
    if new_filing.source_url and company.cik:
        try:
            local = await edgar_client.download_filing(
                company.cik, new_filing.accession or "", new_filing.source_url,
            )
            new_filing.local_path = str(local)
            await session.commit()
        except Exception as exc:  # noqa: BLE001
            async with run_log(session, user_id, ticker, stage="download",
                               company_id=company.id) as rec:
                rec.set(level="error", message=f"Filing download failed: {exc}")
            return

    if not new_filing.local_path:
        return

    # --- 3. Extract ----------------------------------------------------
    from pathlib import Path
    extracted = await extraction.extract_filing(
        session, user_id,
        company_id=company.id, ticker=ticker,
        pdf_path=Path(new_filing.local_path),
    )
    if not extracted:
        return

    # --- 4. Validate ---------------------------------------------------
    verdict = await validation.validate_metrics(
        session, user_id,
        company_id=company.id, ticker=ticker,
        extracted=extracted,
    )

    # Group extracted metric locations by key. The accepted display_value is
    # whichever the validator chose; we keep ALL locations as provenance.
    by_key: dict[str, list[extraction.ExtractedMetric]] = {}
    for e in extracted:
        by_key.setdefault(e.key, []).append(e)

    accept: dict[str, str] = {}
    confs: dict[str, str] = {}
    if verdict:
        for v in verdict.per_metric:
            accept[v.key] = v.accept_value or (
                by_key[v.key][0].display_value if v.key in by_key else ""
            )
            confs[v.key] = v.conf

    # --- 5. Persist Result + Metric + Provenance ---------------------
    result_row = m.Result(
        id=uuid4().hex, company_id=company.id, filing_id=new_filing.id,
        period=new_filing.period or "?",
        period_end=new_filing.period_end or "",
        reported_on=new_filing.reported_on or _now(),
        validated_on=_now() if verdict and verdict.passed else None,
        validation_passed=bool(verdict and verdict.passed),
        validation_rule=verdict.rule if verdict else "",
        validation_detail=verdict.detail if verdict else "",
        validation_corroborations=verdict.corroborations if verdict else 0,
        validation_conflict=verdict.conflict if verdict else False,
        is_latest=True,
    )
    session.add(result_row)

    # Demote any prior latest.
    prior_latest = (await session.execute(
        select(m.Result).where(
            m.Result.company_id == company.id, m.Result.is_latest == True,  # noqa: E712
            m.Result.id != result_row.id,
        )
    )).scalars().all()
    for r in prior_latest:
        r.is_latest = False

    for key, locations in by_key.items():
        metric = m.Metric(
            id=uuid4().hex, result_id=result_row.id,
            key=key,
            display_value=accept.get(key, locations[0].display_value),
            raw_value=locations[0].raw_value,
            yoy=None, conf=confs.get(key, "med"),
        )
        session.add(metric)
        for i, loc in enumerate(locations):
            session.add(m.Provenance(
                id=uuid4().hex, metric_id=metric.id, rank=i,
                source_label=loc.source_label, url=new_filing.source_url or "",
                page=loc.page, quote=loc.quote,
            ))

    # Review items for any conflicts.
    if verdict and verdict.conflict:
        for v in verdict.per_metric:
            if v.conf == "low" and v.alternative_values:
                rv = m.ReviewItem(
                    id=f"rv-{uuid4().hex[:6]}",
                    user_id=user_id, company_id=company.id,
                    result_id=result_row.id,
                    period=new_filing.period or "?",
                    period_end=new_filing.period_end or "",
                    field=v.key, reason=v.reason or "Value conflict across sources",
                    conf="low", found_on=_now(),
                )
                session.add(rv)
                for j, alt in enumerate(v.alternative_values):
                    session.add(m.ReviewCandidate(
                        id=uuid4().hex, review_item_id=rv.id,
                        value=alt.get("value", ""),
                        source=alt.get("source", ""),
                        page=int(alt.get("page", 0)),
                        weight="", rank=j,
                    ))

    await session.commit()

    # --- 6. Narrative -------------------------------------------------
    if verdict and verdict.passed:
        current = {e.key: e.display_value for e in extracted}
        story = await narrative.write_narrative(
            session, user_id,
            company_id=company.id, ticker=ticker, current=current,
        )
        if story:
            result_row.narrative = story
            await session.commit()

    # --- 6b. Confidence assessment ------------------------------------
    # Runs regardless of validation outcome: a failed validation is itself a
    # low-confidence signal that should drag the score down.
    await confidence.assess_confidence(
        session, user_id, company_id=company.id, ticker=ticker,
    )

    # --- 7. Notify ----------------------------------------------------
    if verdict and verdict.passed:
        company.status = "validated"
        await session.commit()
        await dispatcher.dispatch(Event(
            type="validated", ticker=ticker,
            payload={
                "period": new_filing.period or "?",
                "revenue": next((e.display_value for e in extracted if e.key == "Revenue"), "?"),
                "eps_diluted": next(
                    (e.display_value for e in extracted if e.key == "EPS · diluted"),
                    "?",
                ),
            },
        ))
    elif verdict and verdict.conflict:
        company.status = "review"
        await session.commit()
        await dispatcher.dispatch(Event(
            type="review.added", ticker=ticker,
            payload={
                "field": next((v.key for v in verdict.per_metric if v.conf == "low"), "?"),
                "reason": verdict.detail[:120],
            },
        ))
    # Always fire company.updated so the UI invalidates its cache.
    await dispatcher.dispatch(Event(type="company.updated", ticker=ticker))
