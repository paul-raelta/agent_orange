"""All ORM models. Schema follows plan §2.

Portability rules:
- Only TEXT/INTEGER/REAL columns (no SQLite JSON type; no Postgres ARRAY).
- JSON-like lists stored as TEXT and parsed in the app (`models_json`).
- Timestamps stored as ISO-8601 TEXT UTC. We rely on app code (not DB defaults)
  for `now()` so SQLite and Postgres behave identically.
- UUID PKs as TEXT.
- Every user-scoped row has `user_id` from day one so adding real auth later is
  a data-model no-op.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ao.db.base import Base


# --- small helpers ----------------------------------------------------------
def _uuid() -> str:
    return uuid4().hex


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# --- users ------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, default=_now_iso, nullable=False)


# --- companies --------------------------------------------------------------
class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (
        UniqueConstraint("user_id", "ticker", name="uq_company_user_ticker"),
        Index("ix_company_user_status", "user_id", "status"),
        Index("ix_company_user_ticker", "user_id", "ticker"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    ticker: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    sector: Mapped[str] = mapped_column(String, default="")
    currency: Mapped[str] = mapped_column(String, default="USD")
    cadence: Mapped[str] = mapped_column(String, default="Quarterly")  # Quarterly | Semi-annual
    fiscal_note: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="watching")  # validated|review|watching|error
    source_mode: Mapped[str] = mapped_column(String, default="auto")  # auto|guided|advanced
    cik: Mapped[str | None] = mapped_column(String, nullable=True)
    ir_url: Mapped[str | None] = mapped_column(String, nullable=True)

    # Portfolio
    shares: Mapped[float] = mapped_column(Float, default=0.0)
    cost_basis: Mapped[float] = mapped_column(Float, default=0.0)

    # nextWindow (computed by cadence.py, persisted for fast reads)
    next_window_from: Mapped[str | None] = mapped_column(String, nullable=True)
    next_window_to: Mapped[str | None] = mapped_column(String, nullable=True)
    next_window_label: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[str] = mapped_column(String, default=_now_iso, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, default=_now_iso, nullable=False)
    # Soft-delete marker. When non-null the company is hidden from the watchlist
    # but related rows (filings/results/metrics/prices/news/insider/agent_runs)
    # are kept. Permanent purge — DELETE /companies/{ticker} — requires the row
    # to be archived first.
    archived_at: Mapped[str | None] = mapped_column(String, nullable=True)

    sources: Mapped[list["Source"]] = relationship(
        back_populates="company", cascade="all, delete-orphan"
    )
    filings: Mapped[list["Filing"]] = relationship(back_populates="company")
    results: Mapped[list["Result"]] = relationship(back_populates="company")


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)  # 'IR' | 'SEC'
    label: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str | None] = mapped_column(String, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    company: Mapped["Company"] = relationship(back_populates="sources")


# --- filings + results + metrics + provenance -------------------------------
class Filing(Base):
    __tablename__ = "filings"
    __table_args__ = (Index("ix_filing_company_period", "company_id", "period_end"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id"), nullable=False)
    form_type: Mapped[str] = mapped_column(String)  # 10-Q, 10-K, 8-K, press_release
    period: Mapped[str] = mapped_column(String)
    period_end: Mapped[str] = mapped_column(String)  # ISO date
    reported_on: Mapped[str] = mapped_column(String)  # ISO date
    accession: Mapped[str | None] = mapped_column(String, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    local_path: Mapped[str | None] = mapped_column(String, nullable=True)
    pages: Mapped[int | None] = mapped_column(Integer, nullable=True)
    discovered_at: Mapped[str] = mapped_column(String, default=_now_iso)
    processed_at: Mapped[str | None] = mapped_column(String, nullable=True)

    company: Mapped["Company"] = relationship(back_populates="filings")


class Result(Base):
    __tablename__ = "results"
    __table_args__ = (
        UniqueConstraint("company_id", "period", name="uq_result_company_period"),
        Index("ix_result_company_latest", "company_id", "is_latest"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id"), nullable=False)
    filing_id: Mapped[str | None] = mapped_column(String, ForeignKey("filings.id"), nullable=True)
    period: Mapped[str] = mapped_column(String, nullable=False)
    period_end: Mapped[str] = mapped_column(String, nullable=False)
    reported_on: Mapped[str] = mapped_column(String, nullable=False)

    validated_on: Mapped[str | None] = mapped_column(String, nullable=True)
    validation_passed: Mapped[bool] = mapped_column(Boolean, default=False)
    validation_rule: Mapped[str] = mapped_column(String, default="")
    validation_detail: Mapped[str] = mapped_column(Text, default="")
    validation_corroborations: Mapped[int] = mapped_column(Integer, default=0)
    validation_conflict: Mapped[bool] = mapped_column(Boolean, default=False)

    narrative: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_latest: Mapped[bool] = mapped_column(Boolean, default=False)

    company: Mapped["Company"] = relationship(back_populates="results")
    metrics: Mapped[list["Metric"]] = relationship(
        back_populates="result", cascade="all, delete-orphan", order_by="Metric.id"
    )


class Metric(Base):
    __tablename__ = "metrics"
    __table_args__ = (Index("ix_metric_result_key", "result_id", "key"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    result_id: Mapped[str] = mapped_column(String, ForeignKey("results.id"), nullable=False)
    key: Mapped[str] = mapped_column(String, nullable=False)
    display_value: Mapped[str] = mapped_column(String, nullable=False)
    raw_value: Mapped[float] = mapped_column(Float, nullable=False)
    yoy: Mapped[float | None] = mapped_column(Float, nullable=True)
    conf: Mapped[str] = mapped_column(String, default="med")  # high|med|low

    result: Mapped["Result"] = relationship(back_populates="metrics")
    provenance: Mapped[list["Provenance"]] = relationship(
        back_populates="metric",
        cascade="all, delete-orphan",
        order_by="Provenance.rank",
    )


class Provenance(Base):
    __tablename__ = "provenance"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    metric_id: Mapped[str] = mapped_column(String, ForeignKey("metrics.id"), nullable=False)
    source_label: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, default="")
    page: Mapped[int] = mapped_column(Integer, default=0)
    quote: Mapped[str] = mapped_column(Text, default="")
    rank: Mapped[int] = mapped_column(Integer, default=0)

    metric: Mapped["Metric"] = relationship(back_populates="provenance")


# --- review queue -----------------------------------------------------------
class ReviewItem(Base):
    __tablename__ = "review_items"
    __table_args__ = (Index("ix_review_user_resolved", "user_id", "resolved_at"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"rv-{_uuid()[:6]}")
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id"), nullable=False)
    result_id: Mapped[str | None] = mapped_column(String, ForeignKey("results.id"), nullable=True)
    period: Mapped[str] = mapped_column(String)
    period_end: Mapped[str] = mapped_column(String)
    field: Mapped[str] = mapped_column(String, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    conf: Mapped[str] = mapped_column(String, default="med")
    found_on: Mapped[str] = mapped_column(String, default=_now_iso)
    snippet_source: Mapped[str] = mapped_column(String, default="")
    snippet_url: Mapped[str] = mapped_column(String, default="")
    snippet_page: Mapped[int] = mapped_column(Integer, default=0)
    snippet_quote: Mapped[str] = mapped_column(Text, default="")
    resolved_choice: Mapped[str | None] = mapped_column(String, nullable=True)
    resolved_at: Mapped[str | None] = mapped_column(String, nullable=True)

    candidates: Mapped[list["ReviewCandidate"]] = relationship(
        back_populates="review_item",
        cascade="all, delete-orphan",
        order_by="ReviewCandidate.rank",
    )


class ReviewCandidate(Base):
    __tablename__ = "review_candidates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    review_item_id: Mapped[str] = mapped_column(String, ForeignKey("review_items.id"), nullable=False)
    value: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str] = mapped_column(String, default="")
    page: Mapped[int] = mapped_column(Integer, default=0)
    weight: Mapped[str] = mapped_column(String, default="")
    rank: Mapped[int] = mapped_column(Integer, default=0)

    review_item: Mapped["ReviewItem"] = relationship(back_populates="candidates")


# --- agent activity / cost --------------------------------------------------
class AgentRun(Base):
    __tablename__ = "agent_runs"
    __table_args__ = (
        Index("ix_agent_runs_user_time", "user_id", "started_at"),
        Index("ix_agent_runs_user_agent_time", "user_id", "agent", "started_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    company_id: Mapped[str | None] = mapped_column(String, ForeignKey("companies.id"), nullable=True)
    agent: Mapped[str] = mapped_column(String, default="system")  # ticker or 'system'
    stage: Mapped[str] = mapped_column(String, default="")
    level: Mapped[str] = mapped_column(String, default="info")  # ok|warn|info|error
    message: Mapped[str] = mapped_column(Text, default="")
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String, nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    started_at: Mapped[str] = mapped_column(String, default=_now_iso, nullable=False)
    finished_at: Mapped[str | None] = mapped_column(String, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)


class UsageDaily(Base):
    __tablename__ = "usage_daily"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "day", "model", "task", name="uq_usage_daily_user_day_model_task"
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    day: Mapped[str] = mapped_column(String, nullable=False)  # YYYY-MM-DD
    model: Mapped[str] = mapped_column(String, nullable=False)
    task: Mapped[str] = mapped_column(String, nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    runs: Mapped[int] = mapped_column(Integer, default=0)


# --- prices / news / insider -------------------------------------------------
class Price(Base):
    __tablename__ = "prices"
    __table_args__ = (Index("ix_price_company_time", "company_id", "ts"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id"), nullable=False)
    ts: Mapped[str] = mapped_column(String, nullable=False)  # ISO
    price: Mapped[float] = mapped_column(Float, nullable=False)
    day_change: Mapped[float] = mapped_column(Float, default=0.0)


class News(Base):
    __tablename__ = "news"
    __table_args__ = (Index("ix_news_company_time", "company_id", "ts"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id"), nullable=False)
    ts: Mapped[str] = mapped_column(String, nullable=False)
    headline: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(String, default="")
    source: Mapped[str] = mapped_column(String, default="")


class InsiderTx(Base):
    __tablename__ = "insider_tx"
    __table_args__ = (Index("ix_insider_company_time", "company_id", "ts"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(String, ForeignKey("companies.id"), nullable=False)
    ts: Mapped[str] = mapped_column(String, nullable=False)
    insider_name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="")
    transaction_type: Mapped[str] = mapped_column(String, default="")  # BUY|SELL
    shares: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[float] = mapped_column(Float, default=0.0)
    value: Mapped[float] = mapped_column(Float, default=0.0)
    filing_url: Mapped[str] = mapped_column(String, default="")


# --- routing + providers + settings -----------------------------------------
class RoutingRule(Base):
    __tablename__ = "routing_rules"
    __table_args__ = (UniqueConstraint("user_id", "task", name="uq_routing_user_task"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    task: Mapped[str] = mapped_column(String, nullable=False)
    desc: Mapped[str] = mapped_column(String, default="")
    model: Mapped[str] = mapped_column(String, nullable=False)


class Provider(Base):
    __tablename__ = "providers"
    __table_args__ = (UniqueConstraint("user_id", "provider_id", name="uq_provider_user_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    provider_id: Mapped[str] = mapped_column(String, nullable=False)  # anthropic|openai|google
    name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="planned")  # active|planned
    auth_label: Mapped[str] = mapped_column(String, default="")
    models_json: Mapped[str] = mapped_column(Text, default="[]")  # JSON list as TEXT


class NotificationPref(Base):
    __tablename__ = "notification_prefs"

    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    email: Mapped[str] = mapped_column(String, default="")
    phone: Mapped[str] = mapped_column(String, default="")
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sms_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    on_validated: Mapped[bool] = mapped_column(Boolean, default=True)
    on_review: Mapped[bool] = mapped_column(Boolean, default=True)
    on_watching_started: Mapped[bool] = mapped_column(Boolean, default=False)
    on_budget_80: Mapped[bool] = mapped_column(Boolean, default=True)


class Setting(Base):
    __tablename__ = "settings"

    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), primary_key=True)
    budget_usd: Mapped[float] = mapped_column(Float, default=50.0)
    poll_frequency: Mapped[str] = mapped_column(
        String, default="Daily 06:00 + every 4h inside a predicted window"
    )
    run_mode: Mapped[str] = mapped_column(
        String, default="Offline / unsupervised — queue conflicts for review"
    )
    default_validation_rule: Mapped[str] = mapped_column(
        String, default="Cross-reference EPS in ≥2 locations"
    )


# --- financial data sources (agent fetchers) --------------------------------
class DataSource(Base):
    """A financial-data feed the agents fetch from. Built-ins (sec_edgar,
    finnhub_*, ir_fetcher) are seeded per user at boot; user-origin rows are
    added through POST /data-sources and resolve to the generic HTTP fetcher.

    Disabling a row stops new fetches from that source but does NOT rewrite
    historical provenance — past metrics keep their recorded source labels.
    """
    __tablename__ = "data_sources"
    __table_args__ = (
        UniqueConstraint("user_id", "source_id", name="uq_data_source_user_id"),
        Index("ix_data_source_user_kind_enabled", "user_id", "kind", "enabled"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    source_id: Mapped[str] = mapped_column(String, nullable=False)  # sec_edgar | finnhub_* | ir_fetcher | usr_<uuid>
    name: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)  # filings|quote|news|insider|ir
    origin: Mapped[str] = mapped_column(String, default="builtin")  # builtin|user
    status: Mapped[str] = mapped_column(String, default="active")  # active|planned|error
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    base_url: Mapped[str | None] = mapped_column(String, nullable=True)
    auth_label: Mapped[str] = mapped_column(String, default="")
    auth_secret_ref: Mapped[str | None] = mapped_column(String, nullable=True)  # env-var NAME, never the secret
    config_json: Mapped[str] = mapped_column(Text, default="{}")
    last_ok_at: Mapped[str | None] = mapped_column(String, nullable=True)
    last_error: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, default=_now_iso, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, default=_now_iso, nullable=False)


class CompanySourceOverride(Base):
    """Per-company override of a global DataSource's enabled flag.

    A row exists only when the company deviates from the global default; absent
    rows mean "use whatever the DataSource is set to in Settings". This keeps
    the table small even when the user toggles a lot of (company, source)
    combinations back to default.

    The agent pipeline asks `source_registry.enabled_for(..., company_id=...)`,
    which merges DataSource.enabled with any override row.
    """
    __tablename__ = "company_source_overrides"
    __table_args__ = (
        UniqueConstraint(
            "company_id", "data_source_id", name="uq_csoverride_company_source"
        ),
        Index("ix_csoverride_company", "company_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    company_id: Mapped[str] = mapped_column(
        String, ForeignKey("companies.id"), nullable=False
    )
    data_source_id: Mapped[str] = mapped_column(
        String, ForeignKey("data_sources.id"), nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, default=_now_iso, nullable=False)


class SourceSuggestion(Base):
    """User-submitted 'please fetch from X' record. Table-only — no email/notify.
    Browse via GET /api/v1/source-suggestions when you want to triage."""
    __tablename__ = "source_suggestions"
    __table_args__ = (Index("ix_source_sug_user_status", "user_id", "status"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    ticker: Mapped[str | None] = mapped_column(String, nullable=True)
    url: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String, default="submitted")  # submitted|reviewing|live|rejected
    submitted_at: Mapped[str] = mapped_column(String, default=_now_iso, nullable=False)
    reviewed_at: Mapped[str | None] = mapped_column(String, nullable=True)
