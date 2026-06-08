"""ORM → wire-format adapters.

This file is THE contract gate. Every JSON payload the UI receives passes
through one of these functions. If you change a field shape here, web/src/types.ts
must change with it (and vice-versa). Keep the two files in lockstep.

Read-side composition: the serializers do their own queries (lightweight
joins) rather than depending on relationship-lazy-load — async SQLAlchemy
sessions don't support lazy load outside a sync context.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from ao.api import schemas as s
from ao.db import models as m


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def _latest_price(session: AsyncSession, company_id: str) -> tuple[float, float]:
    """Return (price, day_change). Falls back to (0, 0) if no snapshot yet."""
    row = (await session.execute(
        select(m.Price.price, m.Price.day_change)
        .where(m.Price.company_id == company_id)
        .order_by(desc(m.Price.ts)).limit(1)
    )).first()
    return (float(row.price), float(row.day_change)) if row else (0.0, 0.0)


# ---------------------------------------------------------------------------
# Company
# ---------------------------------------------------------------------------


async def serialize_company(
    session: AsyncSession, c: m.Company, *, include_news: bool = False,
) -> s.Company:
    """Build the wire-format Company for one ORM row.

    `include_news=True` is the deep-dive path (GET /companies/{ticker}); the
    list path (GET /companies) keeps payloads small by omitting news+insider.
    """
    # --- sources --------------------------------------------------------
    src_rows = (await session.execute(
        select(m.Source).where(m.Source.company_id == c.id)
    )).scalars().all()
    sources = [
        s.Source(kind=src.kind, label=src.label,  # type: ignore[arg-type]
                 primary=True if src.is_primary else None)
        for src in src_rows
    ]

    # --- latest result + metrics + provenance ---------------------------
    latest_row = (await session.execute(
        select(m.Result).where(m.Result.company_id == c.id, m.Result.is_latest == True)  # noqa: E712
    )).scalar_one_or_none()

    metrics: list[s.Metric] = []
    validation = s.Validation(passed=False, rule="", detail="", corroborations=0, conflict=None)
    narrative: str | None = None
    period = period_end = reported_on = ""
    validated_on: str | None = None

    if latest_row is not None:
        period = latest_row.period
        period_end = latest_row.period_end
        reported_on = latest_row.reported_on
        validated_on = latest_row.validated_on
        narrative = latest_row.narrative
        validation = s.Validation(
            passed=latest_row.validation_passed,
            rule=latest_row.validation_rule,
            detail=latest_row.validation_detail,
            corroborations=latest_row.validation_corroborations,
            conflict=True if latest_row.validation_conflict else None,
        )

        metric_rows = (await session.execute(
            select(m.Metric).where(m.Metric.result_id == latest_row.id)
        )).scalars().all()
        for mr in metric_rows:
            prov_rows = (await session.execute(
                select(m.Provenance)
                .where(m.Provenance.metric_id == mr.id)
                .order_by(m.Provenance.rank)
            )).scalars().all()
            metrics.append(s.Metric(
                key=mr.key, value=mr.display_value, raw=mr.raw_value,
                yoy=mr.yoy, conf=mr.conf,  # type: ignore[arg-type]
                prov=[
                    s.Provenance(source=p.source_label, url=p.url, page=p.page, quote=p.quote)
                    for p in prov_rows
                ],
            ))

    # --- history (last 5 results) + sparkline ---------------------------
    hist_rows = (await session.execute(
        select(m.Result).where(m.Result.company_id == c.id)
        .order_by(desc(m.Result.period_end)).limit(5)
    )).scalars().all()

    history: list[s.HistoryRow] = []
    for hr in hist_rows:
        # Map this period's metrics into the history row.
        hmetrics = {
            mm.key: mm
            for mm in (await session.execute(
                select(m.Metric).where(m.Metric.result_id == hr.id)
            )).scalars().all()
        }
        history.append(s.HistoryRow(
            period=hr.period, end=hr.period_end,
            rev=hmetrics.get("Revenue").display_value if "Revenue" in hmetrics else "—",
            ni=hmetrics.get("Net income").display_value if "Net income" in hmetrics else "—",
            epsD=hmetrics.get("EPS · diluted").display_value if "EPS · diluted" in hmetrics else "—",
            epsB=hmetrics.get("EPS · basic").display_value if "EPS · basic" in hmetrics else "—",
            gm=hmetrics.get("Gross margin").display_value if "Gross margin" in hmetrics else "—",
            conf=hmetrics.get("EPS · diluted").conf if "EPS · diluted" in hmetrics else "med",  # type: ignore[arg-type]
        ))

    # spark = EPS diluted across history, oldest → newest, raw if present else 0
    spark_pairs = []
    for hr in reversed(hist_rows):
        mm = (await session.execute(
            select(m.Metric).where(
                m.Metric.result_id == hr.id, m.Metric.key == "EPS · diluted"
            )
        )).scalar_one_or_none()
        if mm and mm.raw_value:
            spark_pairs.append((hr.period, float(mm.raw_value)))
    sparkLabels = [p[0] for p in spark_pairs]
    sparkEps = [p[1] for p in spark_pairs]

    # --- portfolio (live price × shares) --------------------------------
    price, day_change = await _latest_price(session, c.id)
    value = float(c.shares) * price
    cost = float(c.shares) * float(c.cost_basis)
    unrealized = value - cost
    unrealizedPct = (unrealized / cost * 100.0) if cost > 0 else 0.0
    portfolio = s.Portfolio(
        shares=float(c.shares), costBasis=float(c.cost_basis),
        value=value, unrealized=unrealized, unrealizedPct=unrealizedPct,
    )

    # --- next window ----------------------------------------------------
    nextWindow = s.NextWindow(
        from_=c.next_window_from or "",
        to=c.next_window_to or "",
        label=c.next_window_label or "",
    )

    # --- optional news + insider ----------------------------------------
    news: list[s.NewsItem] | None = None
    insider: list[s.InsiderTx] | None = None
    if include_news:
        news_rows = (await session.execute(
            select(m.News).where(m.News.company_id == c.id)
            .order_by(desc(m.News.ts)).limit(20)
        )).scalars().all()
        news = [
            s.NewsItem(ts=n.ts, headline=n.headline, summary=n.summary, url=n.url, source=n.source)
            for n in news_rows
        ]
        ins_rows = (await session.execute(
            select(m.InsiderTx).where(m.InsiderTx.company_id == c.id)
            .order_by(desc(m.InsiderTx.ts)).limit(20)
        )).scalars().all()
        insider = [
            s.InsiderTx(
                ts=ix.ts, insider=ix.insider_name, role=ix.role,
                type=("BUY" if ix.transaction_type == "BUY" else "SELL"),
                shares=ix.shares, price=ix.price, value=ix.value, url=ix.filing_url,
            )
            for ix in ins_rows
        ]

    return s.Company(
        ticker=c.ticker, name=c.name, sector=c.sector,
        price=price, dayChange=day_change, currency=c.currency,
        cadence=c.cadence,  # type: ignore[arg-type]
        fiscalNote=c.fiscal_note,
        status=c.status,  # type: ignore[arg-type]
        sourceMode=c.source_mode,  # type: ignore[arg-type]
        sources=sources,
        latest=s.LatestPeriod(
            period=period, periodEnd=period_end, reportedOn=reported_on,
            validatedOn=validated_on, metrics=metrics, validation=validation,
        ),
        sparkEps=sparkEps, sparkLabels=sparkLabels,
        nextWindow=nextWindow, history=history,
        portfolio=portfolio, narrative=narrative,
        news=news, insider=insider,
    )


async def serialize_companies(session: AsyncSession, user_id: str) -> list[s.Company]:
    rows = (await session.execute(
        select(m.Company).where(m.Company.user_id == user_id).order_by(m.Company.ticker)
    )).scalars().all()
    return [await serialize_company(session, c) for c in rows]


async def serialize_portfolio_totals(
    session: AsyncSession, user_id: str
) -> s.PortfolioTotals:
    rows = (await session.execute(
        select(m.Company).where(m.Company.user_id == user_id)
    )).scalars().all()
    total_value = 0.0
    total_cost = 0.0
    for c in rows:
        price, _ = await _latest_price(session, c.id)
        total_value += float(c.shares) * price
        total_cost += float(c.shares) * float(c.cost_basis)
    unrealized = total_value - total_cost
    pct = (unrealized / total_cost * 100.0) if total_cost > 0 else 0.0
    return s.PortfolioTotals(
        totalValue=total_value, totalCost=total_cost,
        unrealized=unrealized, unrealizedPct=pct,
    )


# ---------------------------------------------------------------------------
# Review queue
# ---------------------------------------------------------------------------


async def serialize_review_queue(
    session: AsyncSession, user_id: str
) -> list[s.ReviewItem]:
    rows = (await session.execute(
        select(m.ReviewItem)
        .where(m.ReviewItem.user_id == user_id, m.ReviewItem.resolved_at.is_(None))
        .order_by(desc(m.ReviewItem.found_on))
    )).scalars().all()

    out: list[s.ReviewItem] = []
    for rv in rows:
        c = await session.get(m.Company, rv.company_id)
        candidates = (await session.execute(
            select(m.ReviewCandidate)
            .where(m.ReviewCandidate.review_item_id == rv.id)
            .order_by(m.ReviewCandidate.rank)
        )).scalars().all()
        out.append(s.ReviewItem(
            id=rv.id,
            ticker=c.ticker if c else "??",
            period=rv.period, periodEnd=rv.period_end,
            reason=rv.reason, conf=rv.conf,  # type: ignore[arg-type]
            foundOn=rv.found_on, field=rv.field,
            candidates=[
                s.ReviewCandidate(value=k.value, source=k.source, page=k.page, weight=k.weight)
                for k in candidates
            ],
            snippet=s.Provenance(
                source=rv.snippet_source, url=rv.snippet_url,
                page=rv.snippet_page, quote=rv.snippet_quote,
            ),
        ))
    return out


# ---------------------------------------------------------------------------
# Activity / Usage / Providers / Routing
# ---------------------------------------------------------------------------


def _fmt_activity_ts(ts: str) -> str:
    """ISO 'YYYY-MM-DDTHH:MM:SS±00:00' → human 'Jun 08 21:23:39'.
    Anything we can't parse passes through verbatim."""
    try:
        dt = datetime.fromisoformat(ts)
        return dt.strftime("%b %d %H:%M:%S")
    except (ValueError, TypeError):
        return ts


async def serialize_activity(
    session: AsyncSession, user_id: str, ticker: str | None = None
) -> list[s.ActivityRow]:
    stmt = select(m.AgentRun).where(m.AgentRun.user_id == user_id)
    if ticker:
        stmt = stmt.where(m.AgentRun.agent == ticker)
    stmt = stmt.order_by(desc(m.AgentRun.started_at)).limit(200)
    rows = (await session.execute(stmt)).scalars().all()
    return [
        s.ActivityRow(
            t=_fmt_activity_ts(r.started_at), agent=r.agent,
            level=r.level if r.level in ("ok", "warn", "info") else "info",  # type: ignore[arg-type]
            tokens=r.input_tokens + r.output_tokens, cost=r.cost_usd, msg=r.message,
        ) for r in rows
    ]


async def serialize_usage(session: AsyncSession, user_id: str) -> s.Usage:
    today_yyyymm = _today_str()[:7]  # current month prefix
    rows = (await session.execute(
        select(m.UsageDaily).where(
            m.UsageDaily.user_id == user_id,
            m.UsageDaily.day.startswith(today_yyyymm),
        )
    )).scalars().all()

    settings_row = await session.get(m.Setting, user_id)
    budget = float(settings_row.budget_usd) if settings_row else 50.0

    by_model: dict[tuple[str, str], dict] = {}
    total_tokens = 0
    total_cost = 0.0
    total_runs = 0
    for r in rows:
        key = (r.model, r.task)
        agg = by_model.setdefault(key, {"input": 0, "output": 0, "cost": 0.0, "runs": 0})
        agg["input"] += r.input_tokens
        agg["output"] += r.output_tokens
        agg["cost"] += r.cost_usd
        agg["runs"] += r.runs
        total_tokens += r.input_tokens + r.output_tokens
        total_cost += r.cost_usd
        total_runs += r.runs

    by_model_out: list[s.UsageByModel] = []
    for (model, task), agg in by_model.items():
        share = int(round(agg["cost"] / total_cost * 100)) if total_cost > 0 else 0
        by_model_out.append(s.UsageByModel(model=model, task=task, share=share, cost=agg["cost"]))

    return s.Usage(
        monthTokens=round(total_tokens / 1_000_000, 2),
        monthCost=round(total_cost, 2),
        budget=budget, runs=total_runs,
        byModel=by_model_out,
    )


async def serialize_providers(session: AsyncSession, user_id: str) -> list[s.Provider]:
    rows = (await session.execute(
        select(m.Provider).where(m.Provider.user_id == user_id).order_by(m.Provider.name)
    )).scalars().all()
    return [
        s.Provider(
            id=r.provider_id, name=r.name,
            status=r.status,  # type: ignore[arg-type]
            auth=r.auth_label, models=json.loads(r.models_json or "[]"),
        )
        for r in rows
    ]


async def serialize_routing(session: AsyncSession, user_id: str) -> list[s.RoutingRule]:
    rows = (await session.execute(
        select(m.RoutingRule).where(m.RoutingRule.user_id == user_id)
    )).scalars().all()
    return [s.RoutingRule(task=r.task, desc=r.desc, model=r.model) for r in rows]


async def serialize_notification_prefs(
    session: AsyncSession, user_id: str
) -> s.NotificationPrefs:
    row = await session.get(m.NotificationPref, user_id)
    if row is None:
        return s.NotificationPrefs(
            email="", phone="", emailEnabled=False, smsEnabled=False,
            onValidated=True, onReview=True, onWatchingStarted=False, onBudget80=True,
        )
    return s.NotificationPrefs(
        email=row.email, phone=row.phone,
        emailEnabled=row.email_enabled, smsEnabled=row.sms_enabled,
        onValidated=row.on_validated, onReview=row.on_review,
        onWatchingStarted=row.on_watching_started, onBudget80=row.on_budget_80,
    )
