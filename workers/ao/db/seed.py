"""Seed the DB with the prototype fixture (NVDA + SNDK + MU).

Usage:
    python -m ao.db.seed         # reset + seed everything
    python -m ao.db.seed nvda    # reset + seed just NVDA
"""
from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import delete, select


def uuid_hex() -> str:
    return uuid4().hex

from ao.config import ensure_var_dirs, get_settings
from ao.db import models as m
from ao.db.engine import create_all, get_engine, get_sessionmaker
from ao.logging import get_logger, setup_logging

log = get_logger(__name__)


# NVDA is the demo anchor — the only ticker with real fixture content for the
# Document Examiner overlay. We ensure it exists on every app start (and after
# wipe) so the RUN ALL AGENTS hero chapter always has something to play, even
# on a fresh DB where the user has only added their own tickers.
async def ensure_demo_anchor(session) -> None:
    settings = get_settings()
    await session.merge(
        m.User(id=settings.user_id, email=settings.user_email, phone=settings.user_phone)
    )
    existing = (await session.execute(
        select(m.Company).where(
            m.Company.user_id == settings.user_id, m.Company.ticker == "NVDA",
        )
    )).scalar_one_or_none()
    if existing is not None:
        return
    company = m.Company(
        id=uuid_hex(), user_id=settings.user_id, ticker="NVDA",
        name="NVIDIA Corporation", sector="Semiconductors", currency="USD",
        cadence="Quarterly", fiscal_note="FY ends late Jan",
        status="watching", source_mode="auto",
        cik="0001045810", ir_url="https://investor.nvidia.com",
    )
    session.add(company)
    await session.flush()
    session.add_all([
        m.Source(company_id=company.id, kind="IR",
                 label="investor.nvidia.com", is_primary=True),
        m.Source(company_id=company.id, kind="SEC",
                 label="EDGAR · CIK 0001045810"),
        m.Price(company_id=company.id, ts=_now(), price=182.4, day_change=2.12),
    ])
    await session.commit()


# --- Provenance snippets (verbatim from the prototype's data.js) ------------
NVDA_NIPS = dict(
    source_label="10-Q · Note 3 — Net Income Per Share",
    url="investor.nvidia.com/.../q1fy26-10q.pdf",
    page=9,
    quote=(
        "Net income per share: Basic (1) $2.40  $0.77 · Diluted (2) $2.39  $0.76. "
        "(1) Net income divided by basic weighted average shares. "
        "(2) Net income divided by diluted weighted average shares."
    ),
)
NVDA_IS = dict(
    source_label="10-Q · Condensed Consolidated Statements of Income",
    url="investor.nvidia.com/.../q1fy26-10q.pdf",
    page=5,
    quote=(
        "Net income $58,321 · Net income per share — Diluted $2.39 · "
        "Diluted weighted average shares 24,391"
    ),
)
NVDA_PR = dict(
    source_label="Press release — Q1 FY26 results",
    url="nvidianews.nvidia.com/.../q1-fiscal-2026",
    page=1,
    quote=(
        "Record first-quarter revenue of $93.2 billion, up 69% from a year ago. "
        "GAAP earnings per diluted share of $2.39, up 214% from a year ago."
    ),
)
SNDK_PR = dict(
    source_label="Press release — fiscal Q4 results",
    url="investors.sandisk.com/news/.../fy-q4",
    page=1,
    quote="Revenue of $1.95 billion. GAAP net income of $0.82 per diluted share.",
)
SNDK_TABLE = dict(
    source_label="8-K Exhibit 99.1 — financial schedules",
    url="sec.gov/cgi-bin/browse-edgar?CIK=SNDK",
    page=11,
    quote=(
        "Diluted net income per share $0.79 — figure differs from press-release "
        "headline ($0.82) by $0.03; reconciliation references non-GAAP adjustments."
    ),
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


async def _wipe(session) -> None:
    """Delete all rows in reverse FK order. Keeps the user row."""
    for model in (
        m.Provenance,
        m.Metric,
        m.Result,
        m.Filing,
        m.Source,
        m.ReviewCandidate,
        m.ReviewItem,
        m.AgentRun,
        m.Price,
        m.News,
        m.InsiderTx,
        m.UsageDaily,
        m.RoutingRule,
        m.Provider,
        m.DataSource,
        m.SourceSuggestion,
        m.NotificationPref,
        m.Setting,
        m.Company,
    ):
        await session.execute(delete(model))


def _add_company(session, **kwargs) -> m.Company:
    # Pre-assign id so child rows can reference it before flush.
    kwargs.setdefault("id", uuid_hex())
    c = m.Company(**kwargs)
    session.add(c)
    return c


def _add_result(session, company: m.Company, *, period, period_end, reported_on,
                validated_on=None, validation, narrative=None, is_latest=False) -> m.Result:
    r = m.Result(
        id=uuid_hex(),
        company_id=company.id,
        period=period,
        period_end=period_end,
        reported_on=reported_on,
        validated_on=validated_on,
        validation_passed=validation["passed"],
        validation_rule=validation["rule"],
        validation_detail=validation["detail"],
        validation_corroborations=validation["corroborations"],
        validation_conflict=validation.get("conflict", False),
        narrative=narrative,
        is_latest=is_latest,
    )
    session.add(r)
    return r


def _add_metric(session, result: m.Result, *, key, display_value, raw_value, yoy, conf, provs):
    metric = m.Metric(
        id=uuid_hex(),
        result_id=result.id, key=key, display_value=display_value,
        raw_value=raw_value, yoy=yoy, conf=conf,
    )
    session.add(metric)
    for i, p in enumerate(provs):
        session.add(m.Provenance(metric_id=metric.id, rank=i, **p))


# --- per-company seed helpers -----------------------------------------------
def _seed_nvda(session, user: m.User) -> m.Company:
    c = _add_company(
        session,
        user_id=user.id, ticker="NVDA", name="NVIDIA Corporation",
        sector="Semiconductors", currency="USD",
        cadence="Quarterly", fiscal_note="FY ends late Jan",
        status="validated", source_mode="auto",
        cik="0001045810", ir_url="https://investor.nvidia.com",
        shares=50, cost_basis=120.0,
        next_window_from="Aug 18, 2026", next_window_to="Sep 02, 2026",
        next_window_label="Q2 FY26 expected",
    )
    session.add_all([
        m.Source(company_id=c.id, kind="IR", label="investor.nvidia.com", is_primary=True),
        m.Source(company_id=c.id, kind="SEC", label="EDGAR · CIK 0001045810"),
    ])

    history = [
        ("Q1 FY26", "Apr 26 ’26", "$93.2B", "$58.32B", "$2.39", "$2.40", "75.1%", "high"),
        ("Q4 FY25", "Jan 25 ’26", "$71.4B", "$24.10B", "$0.81", "$0.82", "73.0%", "high"),
        ("Q3 FY25", "Oct 27 ’25", "$57.0B", "$19.30B", "$0.76", "$0.78", "74.6%", "high"),
        ("Q2 FY25", "Jul 28 ’25", "$46.7B", "$16.60B", "$0.68", "$0.69", "75.1%", "high"),
        ("Q1 FY25", "Apr 28 ’25", "$26.0B", "$14.88B", "$0.61", "$0.62", "78.4%", "high"),
    ]
    for i, (period, end, rev, ni, epsD, epsB, gm, conf) in enumerate(history):
        is_latest = i == 0
        validation = (
            dict(passed=True, rule="Cross-reference EPS in ≥2 locations",
                 detail=("“Net income per share” found on p.5 (income statement), "
                         "p.9 (Note 3) and in the press release. Diluted EPS $2.39 "
                         "agrees across all three."),
                 corroborations=3)
            if is_latest else
            dict(passed=True, rule="Cross-reference EPS in ≥2 locations",
                 detail="Auto-validated.", corroborations=2)
        )
        r = _add_result(
            session, c,
            period=period, period_end=end,
            reported_on=("May 27, 2026" if is_latest else end),
            validated_on=("May 27, 2026 · 02:14" if is_latest else end),
            validation=validation,
            narrative=(
                "Q1 FY26 revenue of $93.2B is 69% higher than Q1 FY25 ($26.0B); "
                "diluted EPS of $2.39 is 3.9× last quarter's $0.81 and 3.9× "
                "prior-year Q1 ($0.61). Gross margin 75.1% held flat sequentially."
            ) if is_latest else None,
            is_latest=is_latest,
        )
        if is_latest:
            _add_metric(session, r, key="Revenue", display_value=rev, raw_value=93200,
                        yoy=69.0, conf="high", provs=[NVDA_PR])
            _add_metric(session, r, key="Net income", display_value=ni, raw_value=58321,
                        yoy=210.6, conf="high", provs=[NVDA_IS])
            _add_metric(session, r, key="EPS · diluted", display_value=epsD, raw_value=2.39,
                        yoy=214.5, conf="high", provs=[NVDA_NIPS, NVDA_IS, NVDA_PR])
            _add_metric(session, r, key="EPS · basic", display_value=epsB, raw_value=2.40,
                        yoy=211.7, conf="high", provs=[NVDA_NIPS])
            _add_metric(session, r, key="Gross margin", display_value=gm, raw_value=75.1,
                        yoy=2.3, conf="med", provs=[NVDA_PR])
        else:
            # History rows: lighter — display strings only, no provenance.
            for key, val, raw in [
                ("Revenue", rev, 0.0),
                ("Net income", ni, 0.0),
                ("EPS · diluted", epsD, 0.0),
                ("EPS · basic", epsB, 0.0),
                ("Gross margin", gm, 0.0),
            ]:
                session.add(m.Metric(
                    result_id=r.id, key=key, display_value=val,
                    raw_value=raw, yoy=None, conf=conf,
                ))

    # Live price snapshot (so portfolio value reads non-zero immediately)
    session.add(m.Price(company_id=c.id, ts=_now(), price=182.4, day_change=2.12))
    return c


def _seed_sndk(session, user: m.User) -> m.Company:
    c = _add_company(
        session, user_id=user.id, ticker="SNDK", name="SanDisk Corporation",
        sector="Storage / Flash memory", currency="USD",
        cadence="Quarterly", fiscal_note="Spun off from WDC",
        status="review", source_mode="guided",
        cik="2023554", ir_url="https://investors.sandisk.com",
        shares=200, cost_basis=48.5,
        next_window_from="Oct 28, 2026", next_window_to="Nov 12, 2026",
        next_window_label="Fiscal Q1 expected",
    )
    session.add_all([
        m.Source(company_id=c.id, kind="IR", label="investors.sandisk.com", is_primary=True),
        m.Source(company_id=c.id, kind="SEC", label="EDGAR · CIK 0002023554"),
    ])

    history = [
        ("Fiscal Q4 ’26", "Jun 27 ’26", "$1.95B", "$118M", "$0.82?", "$0.83?", "31.2%", "low"),
        ("Fiscal Q3 ’26", "Mar 28 ’26", "$1.87B", "$104M", "$0.74", "$0.75", "30.1%", "high"),
        ("Fiscal Q2 ’26", "Dec 27 ’25", "$1.81B", "$99M", "$0.70", "$0.71", "29.4%", "high"),
        ("Fiscal Q1 ’26", "Sep 27 ’25", "$1.74B", "$86M", "$0.61", "$0.62", "28.0%", "high"),
    ]
    for i, (period, end, rev, ni, epsD, epsB, gm, conf) in enumerate(history):
        is_latest = i == 0
        validation = (
            dict(passed=False, rule="Cross-reference EPS in ≥2 locations",
                 detail=("Press release headline reports diluted EPS $0.82, but the 8-K financial "
                         "schedule (p.11) shows $0.79. Difference attributed to non-GAAP adjustments — "
                         "needs human decision on which figure to record."),
                 corroborations=2, conflict=True)
            if is_latest else
            dict(passed=True, rule="Cross-reference EPS in ≥2 locations",
                 detail="Auto-validated.", corroborations=2)
        )
        r = _add_result(
            session, c, period=period, period_end=end,
            reported_on=("Jul 30, 2026" if is_latest else end),
            validated_on=(None if is_latest else end),
            validation=validation,
            is_latest=is_latest,
        )
        if is_latest:
            _add_metric(session, r, key="Revenue", display_value=rev, raw_value=1950,
                        yoy=11.4, conf="high", provs=[SNDK_PR])
            _add_metric(session, r, key="Net income", display_value=ni, raw_value=118,
                        yoy=None, conf="med", provs=[SNDK_TABLE])
            _add_metric(session, r, key="EPS · diluted", display_value=epsD, raw_value=0.82,
                        yoy=None, conf="low", provs=[SNDK_PR, SNDK_TABLE])
        else:
            for key, val in [("Revenue", rev), ("Net income", ni), ("EPS · diluted", epsD),
                             ("EPS · basic", epsB), ("Gross margin", gm)]:
                session.add(m.Metric(result_id=r.id, key=key, display_value=val,
                                      raw_value=0.0, yoy=None, conf=conf))

    session.add(m.Price(company_id=c.id, ts=_now(), price=51.2, day_change=-1.34))
    return c


def _seed_mu(session, user: m.User) -> m.Company:
    c = _add_company(
        session, user_id=user.id, ticker="MU", name="Micron Technology",
        sector="Memory / Storage semis", currency="USD",
        cadence="Quarterly", fiscal_note="FY ends late Aug",
        status="watching", source_mode="auto",
        cik="0000723125", ir_url="https://investors.micron.com",
        shares=75, cost_basis=95.0,
        next_window_from="Sep 22, 2026", next_window_to="Oct 06, 2026",
        next_window_label="Q4 FY26 — watching now",
    )
    session.add_all([
        m.Source(company_id=c.id, kind="IR", label="investors.micron.com", is_primary=True),
        m.Source(company_id=c.id, kind="SEC", label="EDGAR · CIK 0000723125"),
    ])

    history = [
        ("Q3 FY26", "May 28 ’26", "$9.80B", "$2.10B", "$1.85", "$1.87", "39.5%", "high"),
        ("Q2 FY26", "Feb 27 ’26", "$9.10B", "$1.80B", "$1.61", "$1.63", "38.2%", "high"),
        ("Q1 FY26", "Nov 28 ’25", "$8.70B", "$1.58B", "$1.41", "$1.43", "37.0%", "high"),
        ("Q4 FY25", "Aug 28 ’25", "$7.75B", "$1.32B", "$1.18", "$1.20", "35.3%", "high"),
    ]
    for i, (period, end, rev, ni, epsD, epsB, gm, conf) in enumerate(history):
        is_latest = i == 0
        validation = dict(
            passed=True, rule="Cross-reference EPS in ≥2 locations",
            detail="Diluted EPS $1.85 agrees between income statement (p.6) and Note 4 (p.12).",
            corroborations=2,
        )
        r = _add_result(
            session, c, period=period, period_end=end,
            reported_on=("Jun 25, 2026" if is_latest else end),
            validated_on=("Jun 25, 2026 · 16:40" if is_latest else end),
            validation=validation, is_latest=is_latest,
        )
        if is_latest:
            _add_metric(session, r, key="Revenue", display_value=rev, raw_value=9800,
                        yoy=31.2, conf="high", provs=[])
            _add_metric(session, r, key="Net income", display_value=ni, raw_value=2100,
                        yoy=88.0, conf="high", provs=[])
            _add_metric(session, r, key="EPS · diluted", display_value=epsD, raw_value=1.85,
                        yoy=92.7, conf="high", provs=[])
        else:
            for key, val in [("Revenue", rev), ("Net income", ni), ("EPS · diluted", epsD),
                             ("EPS · basic", epsB), ("Gross margin", gm)]:
                session.add(m.Metric(result_id=r.id, key=key, display_value=val,
                                      raw_value=0.0, yoy=None, conf=conf))

    session.add(m.Price(company_id=c.id, ts=_now(), price=134.8, day_change=0.58))
    return c


def _seed_review_queue(session, user: m.User, sndk: m.Company) -> None:
    rv1 = m.ReviewItem(
        id=f"rv-{uuid_hex()[:6]}",
        user_id=user.id, company_id=sndk.id,
        period="Fiscal Q4", period_end="Jun 27, 2026",
        field="EPS · diluted", reason="EPS conflict across sources",
        conf="low", found_on="Jul 30, 2026 · 09:12",
        snippet_source=SNDK_TABLE["source_label"], snippet_url=SNDK_TABLE["url"],
        snippet_page=SNDK_TABLE["page"], snippet_quote=SNDK_TABLE["quote"],
    )
    session.add(rv1)
    session.add_all([
        m.ReviewCandidate(review_item_id=rv1.id, value="$0.82",
                          source="Press release headline", page=1,
                          weight="GAAP, headline", rank=0),
        m.ReviewCandidate(review_item_id=rv1.id, value="$0.79",
                          source="8-K Exhibit 99.1 (p.11)", page=11,
                          weight="schedule, footnoted", rank=1),
    ])

    rv2 = m.ReviewItem(
        id=f"rv-{uuid_hex()[:6]}",
        user_id=user.id, company_id=sndk.id,
        period="Fiscal Q4", period_end="Jun 27, 2026",
        field="Net income", reason="Net income found in only one location",
        conf="med", found_on="Jul 30, 2026 · 09:12",
        snippet_source=SNDK_TABLE["source_label"], snippet_url=SNDK_TABLE["url"],
        snippet_page=SNDK_TABLE["page"], snippet_quote=SNDK_TABLE["quote"],
    )
    session.add(rv2)
    session.add(m.ReviewCandidate(
        review_item_id=rv2.id, value="$118M",
        source="8-K Exhibit 99.1 (p.11)", page=11,
        weight="single source", rank=0,
    ))


def _seed_activity(session, user: m.User, companies: dict[str, m.Company]) -> None:
    # Backdate the seed activity relative to seed time so the demo rows are
    # always in the recent past — otherwise any live RUN ALL AGENTS click writes
    # rows that sort BELOW the seeded ones (text-DESC on ISO timestamps).
    from datetime import timedelta
    now = datetime.now(timezone.utc)

    def at(hours_ago: float) -> str:
        return (now - timedelta(hours=hours_ago)).isoformat(timespec="seconds")

    rows = [
        # SNDK Q4 — most recent demo activity (a few hours ago)
        (at(7.0), "SNDK", "warn", 41200, 0.62,
         "Extracted Q4 figures — EPS conflict ($0.82 vs $0.79). Routed to Review Queue."),
        (at(7.1), "SNDK", "ok", 88400, 1.33,
         "New 8-K detected on investors.sandisk.com. Downloaded Exhibit 99.1 (14 pp)."),
        (at(8.0), "SNDK", "info", 1800, 0.03,
         "Scheduled poll — checking IR + EDGAR for fiscal Q4 release."),
        # MU scheduled poll — a day ago
        (at(24.0), "MU", "info", 1750, 0.03,
         "Scheduled poll — no new filing. Next expected window Sep 22 – Oct 06."),
        # NVDA Q1 reporting — about 12 days ago (the narrative says "May 27")
        (at(24.0 * 12), "NVDA", "ok", 52600, 0.79,
         "Validation PASSED — diluted EPS $2.39 corroborated in 3 locations. Recorded Q1 FY26."),
        (at(24.0 * 12 + 0.01), "NVDA", "ok", 96100, 1.44,
         "Parsed 10-Q (38 pp) + press release. Extracted 5 metrics."),
        (at(24.0 * 12 + 0.02), "NVDA", "info", 2100, 0.03,
         "New 10-Q detected on investor.nvidia.com — triggered extraction run."),
    ]
    for t, ticker, level, tokens, cost, msg in rows:
        session.add(m.AgentRun(
            user_id=user.id,
            company_id=companies.get(ticker).id if ticker in companies else None,
            agent=ticker, stage="seed", level=level,
            message=msg, input_tokens=tokens // 2, output_tokens=tokens // 2,
            cost_usd=cost, started_at=t,
        ))


def _seed_data_sources(session, user: m.User) -> None:
    """Seed the built-in financial-data sources. User can disable/configure
    them on Settings; they're recreated on a fresh seed."""
    has_finnhub = bool(get_settings().finnhub_api_key)
    finnhub_auth = "API key set" if has_finnhub else "Missing FINNHUB_API_KEY"
    finnhub_status = "active" if has_finnhub else "planned"
    builtins = [
        dict(source_id="sec_edgar", name="SEC EDGAR", kind="filings",
             auth_label="No key required", auth_secret_ref=None,
             status="active", base_url="https://data.sec.gov"),
        dict(source_id="finnhub_quote", name="Finnhub — quote", kind="quote",
             auth_label=finnhub_auth, auth_secret_ref="FINNHUB_API_KEY",
             status=finnhub_status, base_url="https://finnhub.io/api/v1"),
        dict(source_id="finnhub_news", name="Finnhub — company news", kind="news",
             auth_label=finnhub_auth, auth_secret_ref="FINNHUB_API_KEY",
             status=finnhub_status, base_url="https://finnhub.io/api/v1"),
        dict(source_id="finnhub_insider", name="Finnhub — insider transactions",
             kind="insider",
             auth_label=finnhub_auth, auth_secret_ref="FINNHUB_API_KEY",
             status=finnhub_status, base_url="https://finnhub.io/api/v1"),
        dict(source_id="ir_fetcher", name="Investor-relations site fetcher",
             kind="ir",
             auth_label="No key required", auth_secret_ref=None,
             status="active", base_url=None),
    ]
    for b in builtins:
        session.add(m.DataSource(
            user_id=user.id, origin="builtin", enabled=True, **b,
        ))


def default_routing_rules(user_id: str) -> list[m.RoutingRule]:
    """Canonical per-stage routing for a user. Single source of truth — used
    by both the first-time seed and Settings → RESET so the two paths can't
    drift apart."""
    return [
        m.RoutingRule(user_id=user_id, task="Source discovery",
                      desc="Find where a company's results live (IR site, EDGAR).",
                      model="Claude Sonnet 4"),
        m.RoutingRule(user_id=user_id, task="Monitoring poll",
                      desc="Cheap recurring check for a new filing.",
                      model="Claude Haiku 4"),
        m.RoutingRule(user_id=user_id, task="Extraction",
                      desc="Pull figures from filings & PDFs.",
                      model="Claude Opus 4"),
        m.RoutingRule(user_id=user_id, task="Validation",
                      desc="Cross-reference numbers across the document.",
                      model="Claude Sonnet 4"),
    ]


def _seed_routing_providers(session, user: m.User) -> None:
    settings = get_settings()
    session.add_all(default_routing_rules(user.id))
    session.add_all([
        m.Provider(user_id=user.id, provider_id="anthropic",
                   name="Anthropic — Claude", status="active",
                   auth_label="Connected via Claude subscription",
                   models_json='["Claude Opus 4","Claude Sonnet 4","Claude Haiku 4"]'),
        m.Provider(user_id=user.id, provider_id="openai", name="OpenAI — GPT",
                   status="planned", auth_label="Add API key",
                   models_json='["GPT-5","GPT-5 mini"]'),
        m.Provider(user_id=user.id, provider_id="google", name="Google — Gemini",
                   status="planned", auth_label="Add API key",
                   models_json='["Gemini 2.5 Pro","Gemini 2.5 Flash"]'),
    ])
    session.add(m.NotificationPref(
        user_id=user.id, email=settings.user_email, phone=settings.user_phone,
        email_enabled=True, sms_enabled=True,
        on_validated=True, on_review=True, on_watching_started=False, on_budget_80=True,
    ))
    session.add(m.Setting(user_id=user.id))


def _seed_usage(session, user: m.User) -> None:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    session.add_all([
        m.UsageDaily(user_id=user.id, day=today, model="Claude Opus 4",
                     task="Extraction · Validation",
                     input_tokens=400_000, output_tokens=420_000,
                     cost_usd=11.9, runs=24),
        m.UsageDaily(user_id=user.id, day=today, model="Claude Sonnet 4",
                     task="Discovery · Monitoring polls",
                     input_tokens=210_000, output_tokens=210_000,
                     cost_usd=6.7, runs=18),
    ])


# --- entrypoint -------------------------------------------------------------
async def seed_all(only_ticker: str | None = None) -> None:
    setup_logging("INFO")
    ensure_var_dirs()
    settings = get_settings()
    log.info("seed.start", only=only_ticker, db=settings.database_url)

    await create_all()
    Session = get_sessionmaker()
    async with Session() as session:
        # Ensure single user.
        user = m.User(id=settings.user_id, email=settings.user_email, phone=settings.user_phone)
        await session.merge(user)
        await session.flush()
        user = await session.get(m.User, settings.user_id)
        assert user is not None

        await _wipe(session)
        await session.flush()

        wanted = {only_ticker.upper()} if only_ticker else {"NVDA", "SNDK", "MU"}
        companies: dict[str, m.Company] = {}
        if "NVDA" in wanted:
            companies["NVDA"] = _seed_nvda(session, user)
        if "SNDK" in wanted:
            companies["SNDK"] = _seed_sndk(session, user)
        if "MU" in wanted:
            companies["MU"] = _seed_mu(session, user)
        await session.flush()

        if "SNDK" in companies:
            _seed_review_queue(session, user, companies["SNDK"])
        _seed_activity(session, user, companies)
        _seed_routing_providers(session, user)
        _seed_data_sources(session, user)
        _seed_usage(session, user)

        await session.commit()
    await get_engine().dispose()
    log.info("seed.done", companies=list(companies.keys()))


def main() -> None:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(seed_all(only))


if __name__ == "__main__":
    main()
