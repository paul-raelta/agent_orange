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


class MetricConsensus(WireBase):
    """Optional Street-estimate context attached to a Metric when
    flags.consensus is on. `surprisePct` = (actual − estimate) / |estimate| * 100."""
    estimate: float
    estimateLabel: str
    surprisePct: float
    sourceCount: int


class Metric(WireBase):
    key: str
    value: str
    raw: float
    yoy: float | None = None
    conf: Conf
    prov: list[Provenance] = Field(default_factory=list)
    # Only populated when flags.consensus is on. Frontend renders surprise
    # chips + the CONS/SURP columns conditionally on this field.
    consensus: MetricConsensus | None = None


class Validation(WireBase):
    passed: bool
    rule: str
    detail: str
    corroborations: int
    conflict: bool | None = None


ConfidenceBand = Literal["high", "medium", "low"]
ConfidenceImpact = Literal["positive", "neutral", "negative"]


class ConfidenceFactor(WireBase):
    name: str
    weight: float
    impact: ConfidenceImpact
    signal: str
    detail: str


class Confidence(WireBase):
    """Overall LLM financial-confidence score for a company. `pct` (0-100) is
    the headline; `band` is the canonical label derived from pct; `factors` is
    the transparent breakdown driving the score."""
    pct: int
    band: ConfidenceBand
    summary: str
    factors: list[ConfidenceFactor] = Field(default_factory=list)
    computedAt: str


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


class FeatureFlags(WireBase):
    """LABS feature flags. Each toggle gates one optional earnings feature.
    When off, the backend short-circuits the related work (no estimate
    fetches, no guidance extraction, no workspace payload) and the UI
    hides the corresponding surface — render contract is `flags.x && <Thing/>`.
    """
    consensus: bool = True
    conflict: bool = True
    guidance: bool = True
    demo_mode: bool = False


class ValidationThresholds(WireBase):
    """Per-user tolerance bands for the validation stage. Two cross-document
    sources must agree within these to count as corroborated (conf=high).
    Anything outside flips the metric to a conflict and queues it for review."""
    epsAbs: float = 0.001
    marginPct: float = 0.1
    revenuePct: float = 1.0


# ---------------------------------------------------------------------------
# Top-level entity payloads
# ---------------------------------------------------------------------------


class GuidanceProvenance(WireBase):
    url: str
    page: str
    snippet: str


GuidanceDirection = Literal["raised", "cut", "maintained"]


class GuidanceItem(WireBase):
    metric: str
    period: str
    low: str
    high: str
    prior: str | None = None
    direction: GuidanceDirection
    provenance: GuidanceProvenance


PipelineRunState = Literal["running", "queued"]


class PipelineRun(WireBase):
    """Set when the company's agent pipeline is mid-run. Drives the
    REFRESHING / QUEUED indicator on the watchlist card."""
    state: PipelineRunState
    startedAt: str | None = None  # ISO timestamp, only for state="running"
    etaRemainingSeconds: int


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
    # Overall financial-confidence score (replaces the per-metric high/med/low
    # as the headline). Null until the first assessment has been computed.
    confidence: Confidence | None = None
    # Number of unresolved ReviewItem rows for this company. Drives the
    # "N items need your review" footer button on the watchlist card.
    openReviewCount: int = 0
    # Only set on GET /companies/{ticker}; list endpoint omits these
    news: list[NewsItem] | None = None
    insider: list[InsiderTx] | None = None
    # When non-null the company is soft-deleted: hidden from the watchlist by
    # default, returned by GET /companies?archived=true, and DELETE is allowed.
    archivedAt: str | None = None
    # Optional investor-relations URL. When set, ir_fetcher uses it during the
    # discover step instead of (or in addition to) the user-global IR source.
    irUrl: str | None = None
    # Real company logo (CDN URL from Finnhub /stock/profile2). Null falls
    # back to the 2-letter ticker monogram in the UI.
    logoUrl: str | None = None
    # Forward guidance — only populated when flags.guidance is on; the dedicated
    # GET /companies/{ticker}/guidance endpoint is the canonical fetch.
    guidance: list[GuidanceItem] | None = None
    # Set while the agent pipeline is running or queued for this company.
    # Null means idle. UI uses this to show the REFRESHING / QUEUED pill.
    pipelineRun: PipelineRun | None = None


class ReviewCandidate(WireBase):
    value: str
    source: str
    page: int
    weight: str


ConflictSourceId = Literal["A", "B"]


class ConflictSource(WireBase):
    id: ConflictSourceId
    kind: SourceKind
    label: str
    url: str
    value: str
    snippet: str
    confidence: Conf
    note: str


class ReviewConflict(WireBase):
    metric: str
    period: str
    sources: list[ConflictSource]


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
    # Only attached when flags.conflict is on AND this review row has at least
    # two competing sources worth showing in the side-by-side workspace.
    conflict: ReviewConflict | None = None


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


class CompanyDataSource(WireBase):
    """A DataSource as it applies to one company: same fields as the global
    DataSource plus `effectiveEnabled` (override applied) and `overridden`
    (true iff a company-scoped override row exists for this pair)."""
    id: str
    sourceId: str
    name: str
    kind: DataSourceKind
    origin: DataSourceOrigin
    status: DataSourceStatus
    enabled: bool  # global flag from the data_sources table
    effectiveEnabled: bool  # what the agents actually see for this company
    overridden: bool
    baseUrl: str | None = None
    authLabel: str
    authSecretRef: str | None = None
    lastOkAt: str | None = None
    lastError: str | None = None


class PatchCompanySourceRequest(WireBase):
    enabled: bool


class PatchCompanyRequest(WireBase):
    irUrl: str | None = None


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
    # Optional fields used by the Conflict workspace (flags.conflict). The
    # simple Review path still POSTs just { choice }, which validates fine.
    note: str | None = None
    pinnedValue: str | None = None


class AddCompanyRequest(WireBase):
    ticker: str
    mode: SourceMode = "auto"
    pinnedUrl: str | None = None
    cadence: Cadence | None = None
    validationRule: str | None = None


class RunResponse(WireBase):
    jobId: str
    lastSync: str


class IRCandidate(WireBase):
    url: str
    note: str


class DiscoveryResultPayload(WireBase):
    ir: str
    sec: str
    cadence: str
    window: str
    # Optional competing IR pages — populated when discovery finds more than
    # one plausible IR site. The UI surfaces a "CONFIRM IR" step and the user's
    # pick rides back to the server via POST /companies/batch primaryIr.
    candidates: list[IRCandidate] | None = None


class DiscoveryStatus(WireBase):
    phase: Literal["discovering", "found", "error"]
    result: DiscoveryResultPayload | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Add Companies (browse the S&P 500 + batch-commit selection)
# ---------------------------------------------------------------------------


class UniverseCompany(WireBase):
    """One row in the Add Companies browse grid. v1 serves from the static
    S&P 500 seed roster + Price snapshot for tracked tickers."""
    ticker: str
    name: str
    sector: str
    price: float
    dayChange: float
    mcap: float          # $B
    earn: str            # next-earnings display label, e.g. "Aug 06"
    earnDays: int
    tracked: bool
    logoUrl: str | None = None
    demoReady: bool = False


class BatchAddRequest(WireBase):
    tickers: list[str]
    primaryIr: dict[str, str] = Field(default_factory=dict)
