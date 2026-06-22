"""Confidence assessment stage — overall financial-confidence percentage.

Blends four signals into one 0-100 score with a transparent per-factor
breakdown:
  (a) inter-document agreement on the latest filing (the existing validation),
  (b) cross-source / cross-period consistency,
  (c) insider activity + recent news,
  (d) share-price trend and whether filings/news direction aligns with it.

All arithmetic is done deterministically in code and handed to the LLM as a
stats dict; the model only weighs and explains — it never recomputes math. The
result is persisted as a ConfidenceAssessment row (is_latest=True, prior
demoted). Self-assembles its inputs from the DB so the daily scheduler job can
call it with only a company_id.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.agents import prompts
from ao.agents.registry import model_for
from ao.agents.runlog import run_log
from ao.db import models as m
from ao.integrations import anthropic_client
from ao.logging import get_logger

log = get_logger(__name__)

MAX_TOKENS = 2048


@dataclass
class ConfidenceFactor:
    name: str
    weight: float
    impact: str  # positive|neutral|negative
    signal: str
    detail: str


@dataclass
class ConfidenceOutput:
    overall_pct: int
    band: str  # high|medium|low
    summary: str
    factors: list[ConfidenceFactor] = field(default_factory=list)


def band_for(pct: int) -> str:
    """Canonical band from a percentage. Single source of truth — the UI
    colour-codes off the raw pct, but the text label comes from here."""
    if pct >= 70:
        return "high"
    if pct >= 40:
        return "medium"
    return "low"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _parse_ts(ts: str) -> datetime | None:
    try:
        dt = datetime.fromisoformat(ts)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Deterministic stat assembly
# ---------------------------------------------------------------------------


async def _agreement_stats(session: AsyncSession, company_id: str) -> dict:
    """Factor (a): inter-document agreement on the latest filing."""
    latest = (await session.execute(
        select(m.Result).where(
            m.Result.company_id == company_id, m.Result.is_latest == True,  # noqa: E712
        )
    )).scalar_one_or_none()
    if latest is None:
        return {"has_result": False}
    metrics = (await session.execute(
        select(m.Metric).where(m.Metric.result_id == latest.id)
    )).scalars().all()
    tally = {"high": 0, "med": 0, "low": 0}
    for mr in metrics:
        tally[mr.conf] = tally.get(mr.conf, 0) + 1
    # Distinct provenance source labels across the latest metrics.
    metric_ids = [mr.id for mr in metrics]
    sources: set[str] = set()
    if metric_ids:
        prov = (await session.execute(
            select(m.Provenance.source_label).where(
                m.Provenance.metric_id.in_(metric_ids)
            )
        )).scalars().all()
        sources = {p for p in prov if p}
    return {
        "has_result": True,
        "period": latest.period,
        "validation_passed": bool(latest.validation_passed),
        "validation_conflict": bool(latest.validation_conflict),
        "corroborations": int(latest.validation_corroborations or 0),
        "conf_tally": tally,
        "metric_count": len(metrics),
        "distinct_sources": len(sources),
    }


async def _consistency_stats(session: AsyncSession, company_id: str) -> dict:
    """Factor (b): cross-period continuity over the last ~5 results."""
    results = (await session.execute(
        select(m.Result).where(m.Result.company_id == company_id)
        .order_by(desc(m.Result.period_end)).limit(5)
    )).scalars().all()
    eps_series: list[float] = []
    low_conf_periods = 0
    for r in reversed(results):  # oldest → newest
        rows = (await session.execute(
            select(m.Metric).where(m.Metric.result_id == r.id)
        )).scalars().all()
        for mr in rows:
            if mr.key == "EPS · diluted" and mr.raw_value is not None:
                eps_series.append(float(mr.raw_value))
            if mr.conf == "low":
                low_conf_periods += 1
                break
    sign_reversals = 0
    for i in range(1, len(eps_series)):
        if eps_series[i] == 0 or eps_series[i - 1] == 0:
            continue
        if (eps_series[i] > 0) != (eps_series[i - 1] > 0):
            sign_reversals += 1
    return {
        "periods_available": len(results),
        "eps_series": [round(v, 4) for v in eps_series],
        "eps_sign_reversals": sign_reversals,
        "periods_with_low_conf_metric": low_conf_periods,
    }


async def _insider_news_stats(session: AsyncSession, company_id: str) -> dict:
    """Factor (c): insider buy/sell balance (~90d) + recent headlines."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat(
        timespec="seconds"
    )
    ins = (await session.execute(
        select(m.InsiderTx).where(
            m.InsiderTx.company_id == company_id, m.InsiderTx.ts >= cutoff,
        )
    )).scalars().all()
    buys = sum(1 for t in ins if t.transaction_type == "BUY")
    sells = sum(1 for t in ins if t.transaction_type == "SELL")
    net_value = sum(
        (t.value if t.transaction_type == "BUY" else -t.value) for t in ins
    )
    news = (await session.execute(
        select(m.News).where(m.News.company_id == company_id)
        .order_by(desc(m.News.ts)).limit(10)
    )).scalars().all()
    return {
        "insider_window_days": 90,
        "insider_buys": buys,
        "insider_sells": sells,
        "insider_net_value_usd": round(net_value, 2),
        "recent_headlines": [n.headline for n in news if n.headline],
    }


def _slope_sign(prices: list[float]) -> int:
    """Sign of the least-squares slope over a price series (+1/0/-1)."""
    n = len(prices)
    if n < 2:
        return 0
    xs = list(range(n))
    mx = sum(xs) / n
    my = sum(prices) / n
    num = sum((xs[i] - mx) * (prices[i] - my) for i in range(n))
    if num > 1e-9:
        return 1
    if num < -1e-9:
        return -1
    return 0


def _pct_change_over(rows: list[tuple[datetime, float]], days: int) -> float | None:
    """% change from the price closest-on-or-before (latest - `days`) to latest."""
    if len(rows) < 2:
        return None
    latest_ts, latest_px = rows[-1]
    target = latest_ts - timedelta(days=days)
    ref = None
    for ts, px in rows:
        if ts <= target:
            ref = px
        else:
            break
    if ref is None or ref == 0:
        return None
    return round((latest_px - ref) / ref * 100.0, 2)


async def _price_trend_stats(
    session: AsyncSession, company_id: str, consistency: dict,
) -> dict:
    """Factor (d): price-trend stats + alignment with the earnings direction."""
    rows = (await session.execute(
        select(m.Price.ts, m.Price.price).where(m.Price.company_id == company_id)
        .order_by(m.Price.ts)
    )).all()
    series: list[tuple[datetime, float]] = []
    for ts, px in rows:
        dt = _parse_ts(ts)
        if dt is not None and px is not None:
            series.append((dt, float(px)))
    coverage_days = 0
    if len(series) >= 2:
        coverage_days = (series[-1][0] - series[0][0]).days
    prices_only = [p for _, p in series]
    slope = _slope_sign(prices_only)

    # Earnings direction from the EPS series (latest vs prior).
    eps = consistency.get("eps_series", [])
    earnings_dir = 0
    if len(eps) >= 2 and eps[-2] != 0:
        earnings_dir = 1 if eps[-1] > eps[-2] else (-1 if eps[-1] < eps[-2] else 0)

    aligns: bool | None = None
    if slope != 0 and earnings_dir != 0:
        aligns = (slope > 0) == (earnings_dir > 0)

    return {
        "data_points": len(series),
        "coverage_days": coverage_days,
        "pct_change_30d": _pct_change_over(series, 30),
        "pct_change_90d": _pct_change_over(series, 90),
        "price_slope_sign": slope,
        "earnings_direction": earnings_dir,
        "aligns_with_price": aligns,
    }


async def _assemble_inputs(session: AsyncSession, company_id: str) -> dict:
    agreement = await _agreement_stats(session, company_id)
    consistency = await _consistency_stats(session, company_id)
    insider_news = await _insider_news_stats(session, company_id)
    price = await _price_trend_stats(session, company_id, consistency)
    return {
        "inter_document_agreement": agreement,
        "cross_source_consistency": consistency,
        "insider_and_news": insider_news,
        "price_trend": price,
    }


# ---------------------------------------------------------------------------
# Stage entry point
# ---------------------------------------------------------------------------


async def assess_confidence(
    session: AsyncSession, user_id: str, *,
    company_id: str, ticker: str,
) -> ConfidenceOutput | None:
    """Compute + persist the overall confidence assessment for one company."""
    async with run_log(session, user_id, ticker, stage="confidence",
                       company_id=company_id) as rec:
        if not anthropic_client.is_configured():
            rec.set(level="warn",
                    message="ANTHROPIC_API_KEY not set — confidence skipped.")
            return None

        inputs = await _assemble_inputs(session, company_id)
        if not inputs["inter_document_agreement"].get("has_result"):
            rec.set(level="warn",
                    message="No validated result yet — confidence skipped.")
            return None

        model = await model_for(session, user_id, "confidence")
        result: dict[str, Any] = await anthropic_client.complete(
            model=model,
            system=prompts.CONFIDENCE_SYSTEM,
            messages=[{"role": "user", "content": json.dumps(inputs)}],
            tools=[prompts.CONFIDENCE_TOOL],
            tool_choice={"type": "tool", "name": "record_confidence"},
            max_tokens=MAX_TOKENS,
        )

        rec.set(
            model=model,
            prompt_version=prompts.PROMPT_VERSION_CONFIDENCE,
            input_tokens=result["input_tokens"],
            output_tokens=result["output_tokens"],
            cost_usd=result["cost_usd"],
        )

        out: ConfidenceOutput | None = None
        for block in result["raw"].content:
            if getattr(block, "type", None) == "tool_use":
                args = block.input
                pct = max(0, min(100, int(args.get("overall_pct", 0))))
                out = ConfidenceOutput(
                    overall_pct=pct,
                    band=band_for(pct),  # re-derive canonically; ignore LLM band
                    summary=args.get("summary", ""),
                    factors=[
                        ConfidenceFactor(
                            name=f.get("name", ""),
                            weight=float(f.get("weight", 0.0)),
                            impact=f.get("impact", "neutral"),
                            signal=f.get("signal", ""),
                            detail=f.get("detail", ""),
                        )
                        for f in args.get("factors", [])
                    ],
                )
                break

        if out is None:
            rec.set(level="error", message="Confidence tool was not called.")
            return None

        await _persist(session, company_id, out, inputs, model)
        rec.set(
            level="ok",
            message=f"Confidence {out.overall_pct}% ({out.band}) — {len(out.factors)} factors.",
        )
        return out


async def _persist(
    session: AsyncSession, company_id: str, out: ConfidenceOutput,
    inputs: dict, model: str,
) -> None:
    row = m.ConfidenceAssessment(
        id=uuid4().hex, company_id=company_id,
        overall_pct=out.overall_pct, band=out.band, summary=out.summary,
        factors_json=json.dumps([
            {"name": f.name, "weight": f.weight, "impact": f.impact,
             "signal": f.signal, "detail": f.detail}
            for f in out.factors
        ]),
        inputs_json=json.dumps(inputs),
        prompt_version=prompts.PROMPT_VERSION_CONFIDENCE, model=model,
        is_latest=True, computed_at=_now_iso(),
    )
    session.add(row)
    # Demote any prior latest for this company.
    prior = (await session.execute(
        select(m.ConfidenceAssessment).where(
            m.ConfidenceAssessment.company_id == company_id,
            m.ConfidenceAssessment.is_latest == True,  # noqa: E712
            m.ConfidenceAssessment.id != row.id,
        )
    )).scalars().all()
    for p in prior:
        p.is_latest = False
    await session.commit()
