"""Pydantic v2 wire schemas — kept in lockstep with web/src/types.ts.

Every JSON payload the UI consumes is produced by one of these models. Field
names use camelCase to match the existing TS contract; Pydantic's
`populate_by_name=True` + `model_config` aliases handle the ORM→camel mapping
in serializers.py.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------

Conf = Literal["high", "med", "low"]
Status = Literal["validated", "review", "watching", "error"]
SourceKind = Literal["IR", "SEC"]
Cadence = Literal["Quarterly", "Semi-annual"]
SourceMode = Literal["auto", "guided", "advanced"]
ActivityLevel = Literal["ok", "warn", "info"]


class WireBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


# ---------------------------------------------------------------------------
# Existing wire types (mirror web/src/types.ts)
# ---------------------------------------------------------------------------


class Provenance(WireBase):
    source: str
    url: str
    page: int
    quote: str


class Metric(WireBase):
    key: str
    value: str
    raw: float
    yoy: float | None = None
    conf: Conf
    prov: list[Provenance] = Field(default_factory=list)


class Validation(WireBase):
    passed: bool
    rule: str
    detail: str
    corroborations: int
    conflict: bool | None = None


class Source(WireBase):
    kind: SourceKind
    label: str
    primary: bool | None = None


class HistoryRow(WireBase):
    period: str
    end: str
    rev: str
    ni: str
    epsD: str
    epsB: str
    gm: str
    conf: Conf


class NextWindow(WireBase):
    from_: str = Field(serialization_alias="from", validation_alias="from")
    to: str
    label: str


class LatestPeriod(WireBase):
    period: str
    periodEnd: str
    reportedOn: str
    validatedOn: str | None = None
    metrics: list[Metric]
    validation: Validation


# ---------------------------------------------------------------------------
# New types (portfolio / narrative / news / insider / notifications)
# ---------------------------------------------------------------------------


class Portfolio(WireBase):
    shares: float
    costBasis: float
    value: float       # shares * latest price
    unrealized: float  # value - shares*costBasis
    unrealizedPct: float


class PortfolioTotals(WireBase):
    totalValue: float
    totalCost: float
    unrealized: float
    unrealizedPct: float


class NewsItem(WireBase):
    ts: str
    headline: str
    summary: str
    url: str
    source: str


class InsiderTx(WireBase):
    ts: str
    insider: str
    role: str
    type: Literal["BUY", "SELL"]
    shares: int
    price: float
    value: float
    url: str


class NotificationPrefs(WireBase):
    email: str
    phone: str
    emailEnabled: bool
    smsEnabled: bool
    onValidated: bool
    onReview: bool
    onWatchingStarted: bool
    onBudget80: bool


# ---------------------------------------------------------------------------
# Top-level entity payloads
# ---------------------------------------------------------------------------


class Company(WireBase):
    ticker: str
    name: str
    sector: str
    price: float
    dayChange: float
    currency: str
    cadence: Cadence
    fiscalNote: str
    status: Status
    sourceMode: SourceMode
    sources: list[Source]
    latest: LatestPeriod
    sparkEps: list[float]
    sparkLabels: list[str]
    nextWindow: NextWindow
    history: list[HistoryRow]
    # New fields
    portfolio: Portfolio
    narrative: str | None = None
    # Only set on GET /companies/{ticker}; list endpoint omits these
    news: list[NewsItem] | None = None
    insider: list[InsiderTx] | None = None


class ReviewCandidate(WireBase):
    value: str
    source: str
    page: int
    weight: str


class ReviewItem(WireBase):
    id: str
    ticker: str
    period: str
    periodEnd: str
    reason: str
    conf: Conf
    foundOn: str
    field: str
    candidates: list[ReviewCandidate]
    snippet: Provenance


class ActivityRow(WireBase):
    t: str
    agent: str
    level: ActivityLevel
    tokens: int
    cost: float
    msg: str


class UsageByModel(WireBase):
    model: str
    task: str
    share: int
    cost: float


class Usage(WireBase):
    monthTokens: float
    monthCost: float
    budget: float
    runs: int
    byModel: list[UsageByModel]


class Provider(WireBase):
    id: str
    name: str
    status: Literal["active", "planned"]
    auth: str
    models: list[str]


class RoutingRule(WireBase):
    task: str
    desc: str
    model: str


# ---------------------------------------------------------------------------
# Data sources — the financial-data feeds the agents fetch from
# ---------------------------------------------------------------------------

DataSourceKind = Literal["filings", "quote", "news", "insider", "ir"]
DataSourceStatus = Literal["active", "planned", "error"]
DataSourceOrigin = Literal["builtin", "user"]


class DataSource(WireBase):
    id: str
    sourceId: str
    name: str
    kind: DataSourceKind
    origin: DataSourceOrigin
    status: DataSourceStatus
    enabled: bool
    baseUrl: str | None = None
    authLabel: str
    authSecretRef: str | None = None
    lastOkAt: str | None = None
    lastError: str | None = None


class AddDataSourceRequest(WireBase):
    name: str
    url: str
    kind: DataSourceKind
    note: str | None = None


class PatchDataSourceRequest(WireBase):
    enabled: bool | None = None
    baseUrl: str | None = None
    name: str | None = None


class TestDataSourceResult(WireBase):
    ok: bool
    status: int | None = None
    contentType: str
    preview: str
    error: str | None = None


SourceSuggestionStatus = Literal["submitted", "reviewing", "live", "rejected"]


class SourceSuggestion(WireBase):
    id: str
    ticker: str | None = None
    url: str
    kind: str | None = None
    note: str
    status: SourceSuggestionStatus
    submittedAt: str
    reviewedAt: str | None = None


class CreateSourceSuggestionRequest(WireBase):
    url: str
    ticker: str | None = None
    kind: str | None = None
    note: str | None = None


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------


class PositionRequest(WireBase):
    shares: float
    costBasis: float


class ResolveReviewRequest(WireBase):
    choice: str


class AddCompanyRequest(WireBase):
    ticker: str
    mode: SourceMode = "auto"
    pinnedUrl: str | None = None
    cadence: Cadence | None = None
    validationRule: str | None = None


class RunResponse(WireBase):
    jobId: str
    lastSync: str


class DiscoveryResultPayload(WireBase):
    ir: str
    sec: str
    cadence: str
    window: str


class DiscoveryStatus(WireBase):
    phase: Literal["discovering", "found", "error"]
    result: DiscoveryResultPayload | None = None
    error: str | None = None
