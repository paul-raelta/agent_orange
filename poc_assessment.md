# Agent Orange — POC vs Requirements Assessment

Inputs reviewed: the POC codebase (`web/` + `workers/`) and its documentation, the client
requirements document (`Agent_Orange.docx`), and the first-pass distillation (`project1.md`).

---

## Executive Summary

The POC has built roughly **25–30% of what the client asked for — but it is the hard 25%**.
The agentic infrastructure (SEC EDGAR filing detection, download, LLM extraction with
page-level provenance, validation and human review queue, scheduler, SMS/email channels,
watchlist + per-company deep-dive UI) is real and working. What is largely missing is the
**analytical content**, and the client's requirements are almost entirely analytical: daily
valuation ratios vs a benchmark, a deep quarterly metrics engine across all three financial
statements, capital-allocation and return-on-capital analysis, MD&A/transcript tone, macro
context, and ≥10%-move emergency alerts. The client asked for a metrics engine; the POC built
a filings-ingestion platform with five metrics on top.

Two existing POC features (consensus beat/miss and guidance tracking) **actively contradict**
the client's stated philosophy — long-term thesis strength, not EPS beats or guidance wiggles —
and should be removed from the client-facing product. Mobile work and demo-mode fixtures are
also not needed.

`project1.md` is a ~90% faithful distillation of the docx. Its main defects: it over-interprets
the confidentiality requirement into an impossible "no exposure to external systems" rule, and
it omits the docx's most important framing sentence (the anti-goal about short-term noise).

**The build will start from a fresh repository** rather than evolving the POC. This is the
right call: the POC's data model is shaped around a filings-validation pipeline with five
fixed metrics, while the product needs a general time-series metrics store — retrofitting is
more work than starting clean, and a fresh repo sheds the contradicting features, mobile work,
demo fixtures, and documentation sprawl for free. The caveat: a set of proven, self-contained
modules (EDGAR client, CIK resolver, notification dispatch, the extraction technique) should
be transplanted, not rewritten. See the carry-over inventory in section D.

The recommended path is a six-phase build, each ending in a developer-driven demo on real
tickers that maps to a section of the client's own document. A key technical decision shapes
the middle phases: most standardized line items the client wants are available
**deterministically and free from SEC XBRL companyfacts data** — no LLM needed — which
repositions the existing Opus pipeline to what genuinely needs AI (segments, organic vs
acquisition, covenants, debt maturities, MD&A tone, KPIs). Koyfin access is resolved (paid
account), leaving covenant/transcript data availability as the main open sourcing question —
a client conversation, not an engineering problem.

---

## A. How closely the POC meets the docx requirements

**Headline: ~25–30% coverage, concentrated in infrastructure rather than analytics.**

| Requirement area | Coverage | Notes |
|---|---|---|
| Daily Metrics (P/E, PEG, PEGY vs benchmark index + diff) | **0%** | Nothing exists. No valuation ratios, no benchmark comparison. This is the client's #1 daily-use feature. |
| Quarterly engine — P&L depth | ~20% | Revenue, net income, gross margin, EPS basic/diluted extracted with provenance. No segments, no organic-vs-acquisition split, no operating margin, no growth acceleration, no cost-growth ratio. YoY field exists in the schema but is never computed. |
| Quarterly engine — balance sheet | **0%** | No cash position, cash/market-cap, net debt, interest coverage, covenants, or debt maturities. |
| Quarterly engine — cash flow | **0%** | No FCF, cash conversion, or capex analysis. |
| Misc calcs (ROIC, ROE, capital allocation, SBC/dilution) | ~10% | Form 4 insider buy/sell is ingested (matches "is management buying or selling"). Nothing else. |
| MD&A / transcript tone analysis | 0% | Not implemented. |
| Industry KPIs (subscribers, backlog, etc.) | 0% | Not implemented. |
| External factors (macro indices, comparables, force majeure) | ~15% | Per-ticker news feed exists (Finnhub). No S&P/DJIA/VIX/treasury tracking, no comparable-company monitoring, no sentiment. |
| Index drift, options sentiment | 0% | Not implemented. |
| Emergency SMS alerts (≥10% moves) | ~40% | Twilio SMS + email + per-event opt-in fully built — but wired to pipeline events (validated/review), not price/metric moves. The channel exists; the trigger doesn't. |
| Dashboard format (green/red, percent-first, dual view) | ~50% | Portfolio view + per-company drill-down exist and match the dual-view ask. Green/red status coding exists. But display is dollar-first, not percent-first with dollar toggle, and there is no relative-comparison framing. |
| Add company (name + ticker), US-only | ~70% | S&P 500 browser + CIK resolution works for stocks. No bonds. No free-text entry outside the seeded universe of 162. |
| Themes / advisor lists (defence, regional banks, SaaS…) | 0% | No categorization concept. |
| Potential vs Selected investment distinction | 0% | One flat watchlist; no "evaluating" vs "invested" lifecycle. |
| Koyfin integration | 0% | Finnhub used instead. Koyfin (paid account confirmed) becomes the primary price/fundamentals source in the rebuild. |
| Confidentiality / IP | Partial | Single-user local app, so incidental. Tickers and filing content are sent to Finnhub and Anthropic — see clarification flag under section C. |
| Desktop-first, weekly deliberate use | Yes | Matches by default. |

---

## B. What's missing, and what the POC has that isn't needed

### Missing (the build-list)

Everything scored 0–20% above. In priority order of client value:

1. Daily valuation ratios (P/E, PEG, PEGY) vs benchmark, with diff
2. The full quarterly metrics engine across all three statements plus derived ratios
   (FCF, ROIC/ROE, net debt, cash conversion, capital allocation, dilution)
3. The ≥10% SMS alert trigger
4. Percent-first formatting and portfolio/theme organization
5. Macro index tracker and news reframed as external factors
6. MD&A/transcript tone analysis and industry KPIs
7. Index drift and options sentiment

### In the POC but not needed — some actively contradicts the docx

- **Consensus vs Actual (beat/miss banners, surprise columns)** — the docx is explicit:
  *"It is not about whether EPS beat analysts' expectation… all of which may impact the share
  price in the short term but are irrelevant over the course of a decade."* This LABS feature
  is philosophically opposed to the product. Remove or permanently flag off.
- **Guidance tracking** — the same quote covers *"small changes in profit guidance."* Also a
  stub. Drop it.
- **Mobile responsiveness work** (MOBILE.md, 700px breakpoint, mobile handoffs) — the client
  explicitly wants large-screen desktop only. Sunk cost; stop investing.
- **Demo mode / replay fixtures** — dev-only convenience; the client-facing path should be
  real-use flow. Keep internally if useful, never client-facing.
- **Model routing UI, cost/budget dashboards, help assistant** — operator tooling, not client
  requirements. Keep for internal use; de-emphasize in demos.
- **IR fetcher, custom data sources, suggest-a-source** — not requested; parked is fine.

### Not requested but worth keeping

The provenance / validation / review-queue / confidence machinery. The client never asked for
it, but their opening line asks for *"a reliable tool"*, and an AI that reads 10-Qs needs
exactly this trust layer. It is also the POC's genuinely differentiated IP. Keep it — but do
not expand it further until analytical breadth catches up.

---

## C. project1.md vs the docx

**Alignment is high — roughly 90% faithful** — with a good structural reorganization (the
daily/quarterly/external taxonomy, the data-sources table, and the open questions on
index-drift alerts are genuine improvements). Issues found:

1. **Over-interpretation on IP.** project1.md says *"No exposure of selected investments to
   external systems."* The docx actually says the client wants confidentiality on selections
   and to limit distribution of the *tool* as IP. Taken literally, project1.md's version
   prohibits sending tickers to Koyfin, Finnhub, or Anthropic — which makes the product
   impossible. Needs a client conversation; soften to "restricted access; watchlist not shared
   with humans; third-party API calls limited to what is technically necessary."
2. **The anti-goal is missing.** The docx's most important framing sentence — long-term thesis
   strength, *not* EPS beats, guidance wiggles, or market reactions — appears nowhere in
   project1.md. It kills two existing POC features and should shape every screen. Add it as an
   explicit non-goal.
3. **Alert spec slightly garbled.** project1.md says "Relevant Index on a Selected Metric";
   the docx says a ≥10% move in *a Daily Metric, a Selected Investment (i.e. its price), or a
   Relevant Index*. The security's own price move is a trigger and should be stated.
4. **Minor omissions.** Growth *accelerating vs decelerating* (asked explicitly in the docx);
   the process dependencies (client will arrange JP Morgan advisor access to map 10-Q line
   items; KPIs are to be copied from analyst research papers); and "Daily Metrics — TBD"
   contradicts the later section where they are in fact defined (P/E, PEG, PEGY).

---

## D. Fresh start: decision and carry-over inventory

**Decision: start a fresh repository. Greenfield the data model and UI; transplant proven
modules as code and proven techniques as patterns.**

Why a fresh start is right here:

- **The data model doesn't fit.** The POC schema centers on filings → results → five fixed
  metrics with per-filing validation. The product needs a general time-series store: many
  metrics per security per period (daily and quarterly series), benchmark series, derived
  ratios computed in code, plus a security lifecycle (Potential vs Selected) and themes.
  Retrofitting that onto the existing models — migrating every table, serializer, and screen —
  is more work than designing it clean.
- **Dead weight drops for free.** Consensus/guidance LABS features, mobile responsiveness,
  demo-mode fixtures, and a large documentation/handoff sprawl simply don't get ported —
  no archaeology, no risk of half-removed code paths.
- **Clean IP story.** A fresh history with no fixture data or exploratory commits supports the
  client's confidentiality/IP expectations.

The caveat: the POC de-risked real engineering, and rewriting it would be waste. Port it as
libraries into the new repo.

### Carry over (port the code)

| Asset | Location in POC | Why |
|---|---|---|
| EDGAR client | `workers/ao/integrations/edgar_client.py` | Filing detection + rate-limited download; proven against SEC fair-use limits. |
| CIK resolver | `workers/ao/integrations/cik_resolver.py` | Ticker → CIK with 24h cache; needed on day one of Add Companies. |
| Notification dispatch | `workers/ao/notify/` | Twilio SMS + Gmail SMTP + per-event opt-in, graceful degradation. Phase 5 rewires the triggers; the channels are done. |
| SSRF-guarded fetcher | `safe_fetch` middle-path | Small, security-sensitive, already hardened. |
| S&P 500 universe seed | `/universe` data | Saves re-sourcing the roster. |

### Carry over (port the technique, rework the target)

| Asset | Why |
|---|---|
| Opus extraction with tool use, page-aware citations, quote verification | The provenance approach is the POC's core IP. Re-aim it at segments, organic-vs-acquisition, covenants, debt maturities, MD&A — not at line items XBRL provides. |
| Validation thresholds + review-queue design | The reconcile-or-escalate pattern (and its tolerance bands) applies to every LLM-extracted figure; rebuild the queue on the new schema. |
| APScheduler dual-mode pattern (in-process dev / external prod) | Proven deploy-portable design; trivially recreated. |
| Wire-contract discipline (`types.ts` + serializer gate) | Keep the pattern; the contract itself is new. |
| Design tokens / terminal aesthetic / provenance drawer | Carry the design language; rebuild screens percent-first around the new metrics model. |

### Leave behind

DB schema and serializers, demo mode + fixtures, consensus and guidance features, mobile CSS
and breakpoints, portfolio P&L strip (rebuilt percent-first), help assistant, cost/budget
dashboards and model-routing UI (rebuild later if wanted), Finnhub as primary source (Koyfin
takes over; optionally keep Finnhub for news and Form 4 insider feeds if Koyfin doesn't cover
them), and all handoff scripts / PROGRESS.md-style documentation.

### Does this change the phases?

Scope, sequencing, and demo goals are unchanged. Two adjustments: Phase 1 absorbs the
greenfield scaffolding (new repo, requirements-shaped schema, module transplants) — its
"remove the contradicting features" work becomes simply *don't port them*. And with the Koyfin
paid account confirmed, the data-provider spike shrinks from a risk item to a verification
task. Later phases should run faster with no legacy constraints.

---

## Recommended build: phased plan

Each phase ends in a developer-driven interactive demo on **real tickers** (no fixtures), and
each demo maps to a section of the client's own document so progress is legible to them.

**Key technical decision shaping phases 2–3:** most standardized line items the client wants
(revenue, net income, EPS, cash, total debt, operating cash flow, capex, shares outstanding,
dividends, buybacks) are available **deterministically from SEC XBRL companyfacts JSON** — no
LLM, no PDF parsing, free, and exact. The POC's Opus-on-PDF pipeline should be repositioned to
what genuinely needs AI: segment breakdowns, organic-vs-acquisition, covenants, debt maturity
schedules, MD&A tone, and KPIs. Hybrid XBRL-first + LLM-for-the-rest is cheaper, more
reliable, and keeps deterministic math in code. The existing provenance/validation layer then
applies mostly to the LLM-extracted subset.

### Phase 1 — Greenfield foundation + Daily Metrics dashboard (the daily-use win)

- New repository scaffold; schema designed around the requirements from day one: securities
  with a **Potential vs Selected** lifecycle, **themes/lists** (defence, regional banks, etc.),
  a time-series metrics store (daily and quarterly series), and benchmark series.
- Transplant the carry-over modules (section D): EDGAR client, CIK resolver, notification
  dispatch, safe_fetch, universe seed. Consensus/guidance, demo mode, and mobile work are
  simply not ported.
- **Koyfin integration** (paid account — access confirmed): wire it up as the primary price
  and fundamentals source. Early in the phase, verify field coverage for the ratio inputs —
  growth estimates for PEG, dividend yield for PEGY, and index-level ratios — and note any
  gaps to fill from a secondary source.
- Compute **P/E, PEG, PEGY** per company, the same ratios for the benchmark index, and the
  **diff** — as pure functions in code over the stored series.
- Formatting from the start: percent-first everywhere, green-up/red-down, dollar toggle.
- **Demo:** client watches their real tickers added, then sees the daily valuation dashboard
  vs benchmark — the exact "Daily Metrics" section of their document, live.

### Phase 2 — Quarterly engine I: P&L depth + trends

- XBRL companyfacts ingestion; multi-quarter history (8+ quarters) backfilled automatically on
  company add.
- Revenue growth QoQ/YoY with acceleration/deceleration; gross and operating margin trends;
  EPS basic/diluted trends; gross-profit-growth vs cost-growth ratio.
- LLM extraction extended to **segment-level** revenue/margin and organic-vs-acquisition
  commentary (where the existing Opus pipeline and provenance drawer earn their keep).
- Trend visualizations in the deep-dive, all percent-first.
- **Demo:** open one Selected Investment and walk the client through their "Consolidated
  Statement of Operations" checklist item by item, with provenance clicks back to the filing.

### Phase 3 — Quarterly engine II: balance sheet, cash flow, capital allocation

- Balance sheet: cash trend, cash/market-cap, net debt trend, interest coverage
  (interest expense / FCF).
- Cash flow: FCF growth QoQ/YoY, cash conversion (OCF vs net income), capex % of cash flow.
- ROIC and ROE trends (pure functions in code, XBRL inputs).
- Capital allocation breakdown: dividends (with rate of change), buybacks, debt repayment,
  acquisitions, internal investment.
- Share count/dilution: diluted shares trend, SBC dilution, and the already-built Form 4
  insider feed surfaced here.
- LLM pass on notes for the **debt maturity schedule**; covenant monitoring flagged as
  best-effort (covenant terms often live in credit agreements, not 10-Qs — raise with client).
- **Demo:** the complete 10-Q review — all three statements plus misc calcs — for a company
  the client picks.

### Phase 4 — Narrative & external factors

- MD&A + earnings-call-transcript tone analysis: quarter-over-quarter deltas, topics
  management stopped mentioning (transcript source needs selecting — flag to client).
- Industry KPI extraction (subscribers, backlog, same-store sales) seeded from analyst
  research the client's advisors provide.
- Macro index tracker: S&P 500, DJIA, VIX, treasury rates (free via FRED/market data), with a
  trend panel.
- News feed reframed as External Factors with relevance tagging; comparable/competitor company
  mapping per Selected Investment.
- **Demo:** "what changed this quarter and around it" — narrative card plus external-context
  panel per holding.

### Phase 5 — Alerting, hardening, handover readiness

- The ≥10% move trigger on daily metrics, security prices, and Relevant Indices → existing
  Twilio SMS channel; in-app alert center with acknowledge/suppress (answers project1.md's
  open questions).
- Weekly review digest; portfolio-view polish for the slow, deliberate weekly session.
- Confidentiality hardening: auth, access restriction, documented data-flow to third parties
  for the client's sign-off.
- Deployed instance the client can log into between sessions.

### Phase 6 — Stretch (only if client re-prioritizes)

Index drift alerts, options sentiment indicator, and fixed-income/bond support — all real
requirements but the lowest value-per-effort in the docx, and bonds in particular need a
data-source decision before any build.

### Questions to put to the client before Phase 1

1. Confidentiality: is sending tickers to data providers and filings to Anthropic acceptable
   (it is technically required)?
2. Bonds: which fixed-income instruments, and how urgent? (Suggest deferring.)
3. Transcripts: paid transcript provider vs IR-page scraping?
4. Confirm that beat/miss vs analyst consensus should be excluded entirely (their document
   implies yes).

---

## Strategic summary

The rebuild starts from a fresh repository, but the POC's de-risked engineering survives as
transplanted modules and proven techniques (section D) — what gets rebuilt is the data model
and UI, which were shaped by the wrong requirements. The product work ahead is a metrics
engine, and roughly 70% of those metrics can be computed deterministically from free XBRL data
plus the Koyfin feed (paid account confirmed) — meaning the phases above are more about
breadth of well-understood work than technical risk. The main open sourcing question is
covenant/transcript data availability, which is a client conversation, not an engineering
problem.
