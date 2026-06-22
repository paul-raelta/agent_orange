# PROGRESS — Agent Orange

## Goal
Recreate the `design/` prototype as a real production app — UI + backend —
and ship something the user can run locally today, with seams in place to
lift to Cloud Run later.

## Current state — UI + backend complete; LLM stages gated on Anthropic key

**UI (`web/`)**
- Vite + React 18 + TS, React Router, TanStack Query, ThemeProvider
- All seven prototype screens ported pixel-faithfully
- New product features layered in:
  - Watchlist portfolio strip (total value / cost / unrealized P&L)
  - Per-card position line on Watchlist cards (when shares > 0)
  - Company deep-dive: AI narrative card, portfolio editor (shares + cost basis),
    new NEWS + INSIDER tabs, PLANNED tiles for future features
  - Settings: NOTIFICATIONS panel (email + phone + per-event opt-in), Providers
    simplified to Anthropic-active + OpenAI/Gemini static-planned
- Live updates via SSE on `/api/v1/events` — React Query invalidates on
  `company.updated` / `review.added`
- Production build passes (`npm run build`, 101 modules)

**Backend (`workers/`)**
- Python 3.12, FastAPI, SQLAlchemy 2.x async, SQLite (Postgres-portable),
  APScheduler
- 20 REST endpoints; serializer layer is the contract gate against `types.ts`
- Data model: 18 tables, all `user_id`-keyed for future multi-tenant
- Integrations live: SEC EDGAR, Finnhub (quote/news/insider), Twilio SMS
  (smoke-tested with real SMS delivery), Gmail SMTP (needs App Password to
  send), Anthropic SDK (needs API key to fire LLM stages)
- Agent pipeline: monitor → download → extract → validate → narrative → notify
  - Monitoring + discovery work today against live EDGAR (no LLM needed for
    those stages — rule-based / deterministic)
  - Extraction / validation / narrative gracefully no-op when no Anthropic key,
    log `anthropic.not_configured` and exit clean
- Scheduler running per plan §7: per-ticker daily poll, 5-min price refresh,
  30-min news/insider refresh, daily window recompute
- Notifications dispatcher wired through pipeline; user prefs per-event;
  SSE broadcast for UI live updates

## Key decisions baked in
- **GAAP vs non-GAAP EPS conflicts → always queue for review.** The SanDisk
  demo case from the prototype is the canonical demo of routing-to-review.
- **News last 30 days**, insider all Form 4s newest first.
- **Portfolio strip inline above Watchlist grid.** Keeps `screen-hd` clean.
- **SSE not websockets** for v1 live updates. Cloud Run-compatible.
- **Narrative cap 200 tokens** for the 2-3 sentence "what's worth knowing".
- **Single tsconfig** (not project references) — simpler with no real gain
  from splitting.
- **Daemon is a plain Python process** — no launchd/systemd; runs identically
  locally and on Cloud Run.

## Live data flowing right now (no LLM keys needed)
- NVDA / SNDK / MU live quotes refreshing every 5 min during market hours
- 20 news headlines + 50 insider transactions per ticker from Finnhub
- EDGAR submissions checked daily for new filings; 10-Q accession
  `0001045810-26-000052` (NVDA Q1, filed 2026-05-20) already detected

## What's left before LLM stages light up
- Add `ANTHROPIC_API_KEY` to `workers/.env`
- (optional) Add `GMAIL_APP_PASSWORD` for the email notification channel

## Next step
Commit and push everything to `paul-raelta/agent_orange` via the existing
`github.com.paul-raelta` SSH host alias (id_rsa).

---

## Increment — DATA SOURCES registry + user-suggested feeds

**Goal:** give the user a single view of where the agents fetch financial
data from, let them toggle / add / suggest sources, and stop hardcoding the
clients inside agent stages.

**What landed**
- DB: two new tables — `data_sources` (built-ins + user-added rows, per user)
  and `source_suggestions` (wishlist table-only, no email/notify).
- Seed: 5 built-ins per user — `sec_edgar`, `finnhub_quote`,
  `finnhub_news`, `finnhub_insider`, `ir_fetcher`. Idempotent
  `source_registry.ensure_builtins()` runs lazily so an existing DB without
  the seed step still works.
- SSRF guard: `ao/util/safe_fetch.py` — https-only, DNS pre-resolve with
  block on loopback / link-local / private / reserved IPs, 10s timeout,
  5 MB cap, ≤3 redirects each re-validated. Verified by blocking
  http/file/localhost/127/169.254/10.x.
- Generic fetcher: `ao/integrations/generic_fetcher.py` wraps `safe_fetch`
  for any user-supplied URL.
- Registry seam: `ao/agents/source_registry.py` exposes
  `enabled_for(session, user_id, kind)` returning ordered fetchers. Stages
  call it instead of importing concrete clients.
- Pipeline rewire: `agents/monitoring.py` + `scheduler/jobs.py`
  (`refresh_prices`, `refresh_news_insider`) now ask the registry; disabled
  sources log a clean skip into `agent_runs`. Disabled sources DON'T rewrite
  historical provenance — old `metrics`/`provenance` rows keep their labels.
- API: new `routes_sources.py` — GET/PATCH/POST/DELETE `/data-sources`,
  POST `/data-sources/{id}/test`, GET/POST `/source-suggestions`. Built-ins
  refuse DELETE. PATCH accepts `enabled` / `name` / `baseUrl`.
- Frontend: `types.ts` + `api.ts` + `hooks.ts` mirror the new endpoints.
  New `DataSourcesPanel` on Settings shows status dot + kind chip +
  last-ok / last-error + ENABLED/DISABLED toggle. Custom-source add form
  validates `https://` client-side and re-tests automatically on save.
  Suggest-a-source form posts to the `source_suggestions` table.

**Verification done**
- `npm run build` (web) — green.
- Backend import — `from ao.main import app` — green; 34 routes.
- `GET /data-sources` returns 5 built-ins after lazy seed.
- PATCH toggles, POST adds (rejecting `http://`), DELETE refuses built-ins,
  POST `/test` returns a body preview for a real URL.
- Monitoring with EDGAR disabled writes
  `"Skipped: SEC EDGAR source is disabled in Settings → Data sources."`
  to `agent_runs`.

**Decisions baked in**
- Disabled sources still show in historical provenance (gate is on NEW
  fetches only).
- Custom-URL fetching uses the SSRF middle-path guard, not a strict allowlist.
- Suggestions are table-only; browse via `GET /source-suggestions`.

**Files touched**
- `workers/ao/db/models.py`, `db/seed.py`
- `workers/ao/util/safe_fetch.py` (new)
- `workers/ao/integrations/generic_fetcher.py` (new)
- `workers/ao/agents/source_registry.py` (new)
- `workers/ao/agents/monitoring.py`, `scheduler/jobs.py`
- `workers/ao/api/schemas.py`, `api/serializers.py`,
  `api/routes_sources.py` (new), `main.py`
- `web/src/types.ts`, `api.ts`, `hooks.ts`,
  `screens/Settings.tsx`, `styles/app.css`

**Next step**
Visual QA on Settings: open `/settings`, confirm the DATA SOURCES panel
renders the five built-ins with their status dots, exercise toggle / add
/ test / suggest. Then commit.

---

## Increment — Agent Run examiner overlay wired into RUN ALL AGENTS

**Goal:** the RUN ALL AGENTS button plays the full-screen Document Examiner
overlay, examining every watchlisted ticker in sequence as its own
chapter, then refreshes the watchlist so freshly extracted figures appear.

### Phase 1 — plumbing + AppShell hook (NVDA only, by accident)

- `web/src/agent-run/examiner.{css,js}` — engine + styles, vanilla JS,
  same files as `agent_orange_examiner/src/`.
- `web/src/agent-run/examiner-docs.js` (new) — defined
  `window.EXAMINER_COMPANIES`, a per-ticker registry of
  `{ DOCS, EXTRACT, SOURCES }` matching the shape in
  `agent_orange_examiner/README.md`. **Initially only NVDA was populated**
  — overlay visibly examined NVDA on every run regardless of which
  tickers the backend was actually running for.
- `web/index.html` — loads `examiner-docs.js` before `examiner.js` so the
  registry is in place when the engine reads it.
- `examiner.js` — inline `DOCS/EXTRACT/SOURCES` consts replaced with
  `let` slots hydrated from the registry; originals kept as `FALLBACK_*`
  so the engine still plays if the docs script fails to load.
- `web/src/layout/AppShell.tsx` — `runAll()` calls
  `window.AgentRun.reset(); window.AgentRun.start();` and sets
  `window.onAgentRunComplete = () => qc.invalidateQueries({ queryKey: keys.companies })`.
- `web/src/screens/Watchlist.tsx` — removed the duplicate local AgentRun
  wiring (and the now-unused `useQueryClient` / `keys` imports); the
  button just calls `runAll()` from the shell context now.

### Phase 2 — actually sequential per-ticker

- `examiner-docs.js` — added **SNDK** (Q4 FY26 10-K + IR press release;
  GAAP diluted EPS $0.79 on the schedules vs "adjusted" diluted EPS
  $0.82 in the press release — the canonical demo of the routing-to-
  REVIEW path) and **MU** (Q3 FY26 10-Q + press release, clean
  corroboration like NVDA). Registry now: `{ NVDA, SNDK, MU }`.
- `examiner.js` — `run()` rewritten as an async sequence:
  - `start(tickersArg)` accepts a single string, an array, or
    undefined; filters to tickers present in the registry; sets
    `playlist` accordingly.
  - `runOne(idx, ticker)` plays one ticker as a chapter (DISCOVER →
    FETCH → PARSE → EXTRACT → CROSS-CHECK → VALIDATE) and resolves on
    completion.
  - Between chapters: sources column / extracted-data column / paper
    are cleared; brand subtitle shows `examining <ticker> filings · N
    of M`; pipeline rail resets to `discover`.
  - Counters are cumulative — `tweenCountersTo(target, durMs)`
    animates from the displayed value to a new cumulative target so
    pages / tables / figures / sources / cost climb monotonically
    across the whole run.
  - SNDK's `conflict` flag on the adjusted-EPS extract row drives a
    red "✗ conflicts with GAAP figure — routed to REVIEW" badge and a
    `EPS DIVERGENCE … routed to REVIEW` validate phase; aggregate
    summary reports `2 validated, 1 routed to REVIEW (SNDK)`.
- `AppShell.tsx` — pulls `useCompanies()` and passes
  `companies.map(c => c.ticker)` to `AgentRun.start()`.

**Decisions baked in**
- Engine stays vanilla JS, registry-driven; new tickers slot in via
  `EXAMINER_COMPANIES` without touching the engine.
- Counters accumulate (don't reset per chapter) — totals row in the
  summary then reflects the whole run.
- AppShell owns the overlay launch and completion callback so every
  entry point to RUN ALL AGENTS gets identical behavior.
- Tickers not present in the registry are silently dropped from the
  playlist; if the playlist ends up empty the first registry key plays
  as a fallback (so the overlay never goes black-screen).

**Verification done**
- `npm run build` green: 102 modules transformed.
- TS check passes. `start` signature widened to
  `(tickers?: string | string[])`.
- SNDK chapter ends in `EPS DIVERGENCE … routed to REVIEW`; NVDA and
  MU chapters end with `corroborated ×3` validation.

**Files touched**
- `web/index.html`
- `web/src/agent-run/examiner.js`
- `web/src/agent-run/examiner-docs.js` (new in phase 1, expanded in phase 2)
- `web/src/layout/AppShell.tsx`
- `web/src/screens/Watchlist.tsx`

**Next step**
Visual QA: open `/`, click RUN ALL AGENTS, confirm the overlay plays
NVDA → SNDK → MU chapters, that SNDK's EPS divergence renders red and
ends in `routed to REVIEW`, and that the aggregate summary shows
`2 validated, 1 routed to REVIEW (SNDK)`.

---

## Increment — archive / delete companies + per-company source overrides

**Goal:** users can take companies off the watchlist (and permanently
purge them) and scope data sources per ticker without affecting other
tickers.

### Phase A — archive / restore / permanently delete

- **DB:** new `companies.archived_at TEXT NULL` column. Idempotent
  ALTER applied at API startup by a new `ensure_schema()` in
  `workers/ao/db/engine.py`, called from the lifespan hook in
  `workers/ao/main.py`. Existing DBs self-heal — no re-seed needed.
  `ensure_schema()` runs `create_all()` (picks up new tables) plus a
  `_COLUMN_MIGRATIONS` list for column adds.
- **Backend:** `routes_companies.py` gains
  - `POST /companies/{ticker}/archive` (idempotent),
  - `POST /companies/{ticker}/restore`,
  - `DELETE /companies/{ticker}` (refuses 409 unless archived; cascades
    review_candidates → review_items → metrics → results → filings →
    provenance → prices → news → insider_tx → agent_runs → sources via
    ORM cascade → company).
  - `GET /companies?archived=true|false` returns active vs archived
    lists. `serialize_companies` takes the flag and filters on the
    `archived_at` column.
  - Scheduler jobs (`refresh_prices`, `refresh_news_insider`,
    `recompute_windows`), `scheduler/scheduler.py` and
    `routes_run._bg_run_all` skip archived companies so they don't get
    polled or refreshed in the background.
  - `serialize_company` emits `archivedAt` on the wire.
- **Frontend:**
  - `Company.tsx` (deep-dive) header gains an **ARCHIVE** ghost button.
    Confirm → `useArchiveCompany()` → navigate back to `/`.
  - `Companies.tsx` (`/companies`) gains an **ARCHIVED (N)** toggle in
    the header. When toggled on, an archived panel renders below with
    a **RESTORE** ghost button and a **PERMANENTLY DELETE** danger
    button per row. Delete is double-confirmed.
  - `Company` type gains `archivedAt?: string | null`.

### Phase B — per-company source overrides + IR URL

- **DB:** new table `company_source_overrides(id, company_id,
  data_source_id, enabled, updated_at)` with a unique constraint on
  (company_id, data_source_id). A row exists only when the company
  diverges from the global DataSource enabled flag — keeps the table
  small. `Company.ir_url` already existed on the model; now surfaced.
- **Backend:**
  - `source_registry.enabled_for(session, user_id, kind, *, company_id=None)`
    — when `company_id` is given, pulls every kind-matching DataSource
    (not just enabled), then applies the override map; absent rows
    fall through to the global flag. Existing callers stay unchanged
    semantically (no company_id → original behavior).
  - `monitoring.py` (the filings stage) and the scheduler's
    `refresh_prices` / `refresh_news_insider` loops now pass
    `company_id=c.id` so overrides take effect for the real fetchers.
  - `routes_companies.py` gains
    - `PATCH /companies/{ticker}` (body `{irUrl}`), validating
      `https://`,
    - `GET /companies/{ticker}/sources` → list of `CompanyDataSource`
      rows annotated with `effectiveEnabled` and `overridden`,
    - `PATCH /companies/{ticker}/sources/{data_source_id}` (body
      `{enabled}`) upserts an override,
    - `DELETE /companies/{ticker}/sources/{data_source_id}` removes
      the override, reverting to the global flag.
  - New wire types: `CompanyDataSource`, `PatchCompanySourceRequest`,
    `PatchCompanyRequest`. `Company` schema gains `irUrl`.
- **Frontend:**
  - `Company.tsx` deep-dive gains a **DATA SOURCES · per-company**
    panel below the static SOURCES pill row. Lists each global source
    with its effective enabled state (status dot + ENABLED/DISABLED
    label + per-company-override-vs-global-default marker), a
    DISABLE/ENABLE toggle, and a RESET button that appears once an
    override exists.
  - Below the source list, an **IR URL** input + SAVE button, wired
    to `usePatchCompany`. Validates `https://` client-side, posts via
    `PATCH /companies/{ticker}`.
  - New hooks: `useCompanySources`, `usePatchCompanySource`,
    `useResetCompanySource`, `usePatchCompany`.

**Decisions baked in**
- Soft + hard delete (per user request): every Remove is two clicks
  (archive then delete from /companies). Active rows can't be
  hard-deleted by accident.
- Cascade is explicit in `DELETE /companies/{ticker}` — no
  reliance-on-FK-cascade-only behavior, which SQLite doesn't enforce
  by default.
- Per-company overrides on global sources (per user request): the
  data_sources table stays per-user, and a tiny override table only
  records deviations. Global toggles in Settings still apply to all
  tickers; per-ticker toggles on the deep-dive override that.
- `ir_url` lives on Company (already in the model) — exposed via the
  Company wire schema, edited via `PATCH /companies/{ticker}`.

**Verification done**
- Backend: `python -c "from ao.main import app"` → 41 routes (was 37).
- Frontend: `npm run build` → 102 modules, green.
- Schedulers/pipeline filtered to active companies; archived tickers
  no longer get polled.

**Files touched**
- `workers/ao/db/models.py` — `Company.archived_at`,
  `CompanySourceOverride`.
- `workers/ao/db/engine.py` — `ensure_schema()` + column migrations.
- `workers/ao/main.py` — call `ensure_schema()` in lifespan startup.
- `workers/ao/api/schemas.py` — `Company.archivedAt`, `Company.irUrl`,
  `CompanyDataSource`, `PatchCompanySourceRequest`,
  `PatchCompanyRequest`.
- `workers/ao/api/serializers.py` — archive filter + irUrl + archivedAt
  in the wire shape; portfolio totals exclude archived.
- `workers/ao/api/routes_companies.py` — archive/restore/delete +
  PATCH company + GET/PATCH/DELETE per-company source.
- `workers/ao/api/routes_run.py` — `_bg_run_all` skips archived.
- `workers/ao/scheduler/jobs.py`, `scheduler/scheduler.py` — archived
  filter; `enabled_for(..., company_id=...)` per company in the
  per-ticker loops.
- `workers/ao/agents/source_registry.py` —
  `enabled_for(..., company_id=None)` with override merging.
- `workers/ao/agents/monitoring.py` — pass `company_id` to
  `enabled_for`.
- `web/src/types.ts`, `api.ts`, `hooks.ts`,
  `screens/Companies.tsx`, `screens/Company.tsx`.

**Next step**
Visual QA:
1. `/company/NVDA` — click ARCHIVE, confirm, you're returned to `/`
   and NVDA is gone from the watchlist (overlay would skip it on next
   RUN ALL). Open `/companies`, click ARCHIVED (1), confirm RESTORE
   brings it back, then archive again and confirm PERMANENTLY DELETE
   wipes it (double-confirm) — try /company/NVDA after and expect a
   404.
2. `/company/SNDK` — in DATA SOURCES · per-company, click DISABLE on
   SEC EDGAR. The label flips to `per-company override · DISABLED`,
   RESET appears. Save an IR URL (`https://investor.sandisk.com`).
   Click RESET on EDGAR and the label reverts to `global default`.
3. Open `/settings` → DATA SOURCES — confirm SEC EDGAR global toggle
   is independent of the SNDK override (toggling global off should
   not affect a SNDK-enabled override; toggling global on does not
   override a SNDK-disabled override).

---

## Increment — RESET TO FIRST-TIME STATE now also wipes companies

**Goal:** the destructive Settings → FIRST-TIME EXPERIENCE button removes
every tracked company too, so after a reset no tickers exist and the user
re-adds them from scratch.

**What changed**
- `workers/ao/db/wipe.py` — rewritten. Now deletes (in order):
  Provenance → Metric → Result → Filing → ReviewCandidate → ReviewItem
  → AgentRun → Price → News → InsiderTx → UsageDaily →
  CompanySourceOverride → Source → Company. SNDK demo-review reseed
  removed (no companies to attach it to). Kept: users, data_sources,
  routing_rules, providers, notification_prefs, settings,
  source_suggestions.
- `workers/ao/api/routes_admin.py` — dropped `reseed_demo_review` query
  param. `POST /admin/wipe` is now a parameterless reset.
- `workers/ao/cli.py` — dropped the `--no-demo` flag from `ao wipe`.
- `web/src/screens/Settings.tsx` — panel copy updated: hint reads
  `destructive — wipes tracked companies + all fetched data`; body
  explains companies are removed and need re-adding before RUN ALL.

**Verification done**
- `npm run build` → 102 modules, green.
- `python -c "from ao.main import app"` → 41 routes.
- `from ao.db.wipe import wipe` + `from ao.cli import wipe as cli_wipe`
  imports green.

**Files touched**
- `workers/ao/db/wipe.py`
- `workers/ao/api/routes_admin.py`
- `workers/ao/cli.py`
- `web/src/screens/Settings.tsx`

**Next step**
Visual QA: open `/settings` → FIRST-TIME EXPERIENCE, click RESET, confirm.
Watchlist should be empty after wipe; `/companies` shows no active or
archived rows.

---

## Increment — Add Companies backend (GET /universe + POST /companies/batch)

**Goal:** finish the Add Companies feature per `ADD_COMPANIES.md`. Frontend
was already merged (additive — `types.ts`, `api.ts`, `hooks.ts`,
`screens/Companies.tsx`, `screens/AddCompanies.tsx`, `data/sp500.ts`,
`styles/app.css`). This increment registers the universe router and
implements the batch-commit endpoint + a candidates path on discovery so the
CONFIRM-IR step is exercisable end-to-end against the stub.

**What landed**
- `workers/ao/main.py` — register `routes_universe.router` under `/api/v1`.
  GET `/universe` was already implemented; now reachable.
- `workers/ao/api/routes_companies.py` — new
  `POST /companies/batch` (the "START WATCHING ALL" action). Per ticker:
  - skip if already tracked (active OR archived) — idempotent;
  - look up name/sector/seed price from `data/sp500_seed.py`;
  - persist `Company(status=watching, source_mode=auto, ir_url)`;
  - create IR + SEC `Source` rows (IR primary, label derived from
    `primaryIr[ticker]` if the user picked from candidates, else
    `investors.<ticker>.com`);
  - seed an initial `Price` snapshot from the universe seed so the
    watchlist row + portfolio math show a non-zero price until the
    price-refresh job catches up;
  - emit SSE `company.updated` per ticker so the UI invalidates
    `companies` + `portfolio/totals` live.
- `workers/ao/api/routes_run.py` — extended the discovery stub: a small
  allowlist (AMD, GOOGL, META) returns two IR `candidates[]` so the UI's
  ⚑ CONFIRM IR card renders end-to-end. Other tickers resolve straight to
  ✓ SOURCES FOUND, unchanged.

**Verification done**
- `npm run build` (web) → 104 modules, green; tsc clean.
- `python -c "from ao.main import app"` → routes include
  `GET /api/v1/universe`, `POST /api/v1/companies/batch`,
  `POST /api/v1/companies`, `GET /api/v1/discovery/{job_id}`.
- In-process httpx smoke test against the ASGI app:
  - GET `/universe` → 200, 162 rows with the right shape; `AAPL` tracked
    flag flips to True after a batch-add.
  - POST `/companies/batch {tickers:[WMT]}` → 200, returns a Company with
    `name=Walmart`, `sector=Consumer Staples`, `price=70.0`, IR
    `investors.wmt.com` (default), and emits `company.updated`. Walmart
    appears as `tracked:true` in `/universe` immediately after.
  - Re-running the same batch → returns `[]` (idempotent — already tracked).
  - POST `/companies {ticker:"AMD"}` → discovery result includes
    two-element `candidates[]`; AAPL returns `candidates=None`.

**Decisions baked in**
- Static-roster v1 per the handoff. `GET /universe` reads `SP500_SEED` (162
  rows) and overlays a live `Price` snapshot for tracked tickers; non-tracked
  rows show seed prices. The scheduled universe-refresh job is left as the
  follow-up the handoff calls out.
- Batch endpoint doesn't re-run discovery server-side — it trusts the
  client-supplied `primaryIr[ticker]` and falls back to
  `investors.<ticker>.com` for tickers where the user didn't pick a
  candidate. This matches the current stub discovery shape and keeps the
  batch fast (no N×EDGAR fetches inside the request). When the real
  discovery pipeline lands, the batch endpoint will read the cached job
  result instead.
- Idempotency check covers both active AND archived companies — re-adding
  an archived ticker doesn't create a duplicate. (Restore path stays via
  `POST /companies/{ticker}/restore`.)

**Files touched**
- `workers/ao/main.py` — `app.include_router(routes_universe.router, …)`.
- `workers/ao/api/routes_companies.py` — `POST /companies/batch`.
- `workers/ao/api/routes_run.py` — `candidates[]` allowlist on stub
  discovery.
- `PROGRESS.md` — this entry.

**Next step (now superseded — see NVDA-anchor increment below)**
Visual QA against `design/addflow/Add Companies.html` (ground truth):
1. `/companies` → ADD COMPANIES → grid renders sector groups in S&P 500
   GICS order; switching to TABLE preserves selection and sort.
2. Search/sort/sector chips filter live; selection tray sticks to the
   bottom and shows the count.
3. Pick AMD + a couple others, ADD → discovery rail cascades; AMD shows
   the ⚑ CONFIRM IR card; the others end in ✓ SOURCES FOUND.
4. Pick a candidate for AMD → CONFIRMED.
5. START WATCHING ALL → success screen shows the count; back on
   `/companies` the new tickers appear; running it again with the same
   selection adds zero.
6. Already-tracked tickers render as disabled TRACKING in the browse grid
   and table.

---

## Increment — NVDA demo anchor + background-tasks rail

**Goal:** the agent pipeline only has real fixture content (DOCS / EXTRACT /
SOURCES) for NVDA / SNDK / MU, and the document pipeline short-circuits for
any Company row without a `cik` (which is every ticker added through the
Add Companies flow). Result: clicking RUN ALL on a watchlist of user-added
tickers showed the NVDA fallback chapter for no reason and did nothing
EDGAR-side. Decision: pin NVDA as the demo hero — always present, always the
chapter the overlay plays — and represent every other watchlisted ticker as
a static "BACKGROUND TASKS" pill rail (refreshing → ✓ done) above the
examiner. The Finnhub quote / news / insider jobs still run for real for
those tickers; only the doc-search animation is reserved for NVDA.

### Backend

- `workers/ao/db/seed.py` — new `ensure_demo_anchor(session)` that
  idempotently `merge`s the default user and inserts an NVDA `Company`
  (cik `0001045810`, ir `https://investor.nvidia.com`, status `watching`,
  source_mode `auto`) plus IR + SEC `Source` rows and a seed `Price` row.
  No-op if any NVDA Company exists for the user — active OR archived.
- `workers/ao/main.py` lifespan — after `ensure_schema()`, opens a session
  and calls `ensure_demo_anchor`, so every app boot guarantees NVDA is on
  the watchlist (or sitting in archive if the user soft-deleted it).
- `workers/ao/db/wipe.py` — after the destructive wipe commits, calls
  `ensure_demo_anchor` so the Settings → FIRST-TIME EXPERIENCE reset
  leaves NVDA standing.
- `workers/ao/api/routes_companies.py` `DELETE /{ticker}` — refuses NVDA
  with `409 NVDA is the demo anchor and can't be permanently deleted.
  Archive is allowed.` Soft archive / restore still work normally.

### Frontend

- `web/src/screens/Companies.tsx` — hides the PERMANENTLY DELETE button on
  the NVDA row in the ARCHIVED panel; RESTORE is still there.
- `web/src/agent-run/examiner.js` —
  - `start(tickersArg)` now splits its input into `playlist` (tickers with
    fixtures — get bespoke chapters) and `backgroundList` (everything
    else — get a rail pill). De-duped first.
  - New `rc-bg-rail` strip rendered between `rc-top` and `rc-body` with
    `data-bg-pills`; hidden when `backgroundList` is empty.
  - `hydrateBackgroundRail()` writes one pill per background ticker
    (ticker · `quote · news · insider` · `refreshing…`).
  - `startBackgroundRail(totalMs)` flips each pill to `done` ✓ on a
    static stride: starts at 1.2s, evenly distributed across the chapter
    timeline, all complete ≥1.5s before the summary card. Real Finnhub
    work happens in the backend regardless.
  - Summary line gets a trailing clause when background tickers exist:
    `… refreshed quotes + news + insider for N more (AAPL, MSFT, …)`.
- `web/src/agent-run/examiner.css` — `.rc-bg-rail` / `.rc-bg-pill` styles
  (refreshing-state border in accent, done-state in green with a faded ✓
  ring; pills wrap; matches the dark terminal aesthetic of the rest of
  the overlay).

**Decisions baked in**
- Soft-delete model: backend allows NVDA archive (`POST /archive`) and
  restore but refuses hard `DELETE /companies/NVDA`. UI hides the danger
  button on NVDA's archived row to match.
- Static rail (not live) — predictable demo timing matters more than tying
  the ✓ to actual `record_fetch` events. The data is still fresh in the
  watchlist after the overlay closes because the Finnhub jobs really run.
- Background-rail pills show three kinds (`quote · news · insider`) as a
  single line, not three separate ticks — keeps the rail compact even with
  10+ tickers.
- ensure_demo_anchor inserts only the bare Company + Sources + a seed
  Price. No metric / provenance / history rows on fresh boot; those land
  the first time the real pipeline runs against NVDA's CIK.

**Verification done**
- Backend: `python -c "from ao.main import app"` → 43 routes.
- Frontend: `npm run build` → 104 modules, green.

**Files touched**
- `workers/ao/db/seed.py` — `ensure_demo_anchor()`.
- `workers/ao/db/wipe.py` — invoke after wipe.
- `workers/ao/main.py` — invoke in lifespan startup.
- `workers/ao/api/routes_companies.py` — 409 on `DELETE /NVDA`.
- `web/src/screens/Companies.tsx` — hide delete on NVDA.
- `web/src/agent-run/examiner.js` — playlist/backgroundList split + rail.
- `web/src/agent-run/examiner.css` — rail styles.

**Next step**
Visual QA: from a fresh wipe, NVDA appears on the watchlist alone. Add 3
non-fixture tickers (AAPL, MSFT, GOOGL). RUN ALL AGENTS: overlay plays
NVDA chapter; rail under the brand line shows three pills refreshing →
✓ done staggered across the run; summary card reads
`… refreshed quotes + news + insider for 3 more (AAPL, MSFT, GOOGL)`.
Try ARCHIVE on NVDA from `/company/NVDA` — succeeds; `/companies` ARCHIVED
panel shows NVDA with RESTORE but NOT PERMANENTLY DELETE. Manually hit
`DELETE /api/v1/companies/NVDA` and confirm it returns 409.

---

## Increment — Motion / UX-polish layer wired in

**Goal:** apply the small, tasteful motion layer described in `MOTION.md`
using the two already-dropped files (`web/src/styles/motion.css` and
`web/src/motion/motion.tsx`). Restrained, terminal-aesthetic, fully
`prefers-reduced-motion` aware.

**What changed (wiring only — no overwrites of existing logic)**
- `web/src/main.tsx` — `import './styles/motion.css'` after `app.css`.
- `web/src/components/primitives.tsx` —
  - `Spark` `<path>` gets `pathLength={1}` so `.reveal .spark path` can
    trace the line on entrance.
  - `Price` now calls `usePriceFlash(price)` and applies `tick-up` /
    `tick-down` to `.price-val` on price change.
  - `Drawer` body wrapper gains `drawer-stagger` so child blocks fade up
    in sequence when the drawer opens.
- `web/src/screens/Watchlist.tsx` —
  - Replaces the `<Loading>` fallback with a 6-card grid of
    `<SkeletonCard>`; real grid wrapper uses `mo-fadein` + `<Reveal>` so
    cards stagger in over the skeletons.
  - Portfolio strip totals + unrealized% animate via a local
    `AnimatedMoney` helper that picks the M/k divisor then drives
    `<CountUp>` so the existing fmtMoney suffix isn't lost.
- `web/src/screens/AddCompanies.tsx` —
  - Each sector `.ac-grid` wrapped in `<Reveal>`; `Card` accepts an
    `index` prop and sets `style={{ '--i': index }}` so the CSS ripple
    on `.ac-group.rippling` cascades across the row.
  - `toggleSector` takes the sector name; on Select-all it sets a
    `rippling[sector]=true` for 600ms.
  - Tray count number wrapped in `<span className="mo-roll"
    key={count}>` so it re-mounts and rolls on change.
- `web/src/screens/Review.tsx` — `.rv-list` wrapped in `<Reveal>`.
- `web/src/screens/Companies.tsx` — `.cfg-list` wrapped in `<Reveal>`.
- `web/src/screens/Company.tsx` —
  - Deep-dive tabs get a `.tab-ink` underline driven by `useTabInk` over
    refs collected per-tab; `activeTabBtn` is re-resolved in a
    `useEffect([tab, isLoading, c])` so the ink lands correctly on
    initial mount (refs are null until after first render).
- `web/src/screens/Settings.tsx` — USAGE panel headline cost + tokens /
  runs / pct stats now use `<CountUp>`.
- `web/src/layout/AppShell.tsx` — sidebar nav usage `$` + `M tok`
  numbers use `<CountUp>` (single mount; only animates on value change
  thereafter, so route navigation doesn't re-trigger).

**Decisions baked in**
- `AnimatedMoney` chooses the unit (`M` / `k` / none) first, then drives
  CountUp on the scaled value — preserves the watchlist's existing
  fmtMoney appearance instead of dropping suffixes.
- Tab-ink active element is resolved through a `useState`/`useEffect`
  pair rather than reading `tabRefs.current[idx]` straight into
  `useTabInk` at render time; necessary because the ref callbacks fire
  AFTER first render so the synchronous read would always start at
  width=0.
- All wiring is additive — no component's existing prop API or layout
  changed except the new `index` prop on `Card` (default 0, backwards
  compatible).
- Reduced motion is fully delegated to `motion.css`'s
  `@media (prefers-reduced-motion: reduce)` block and the JS guards
  inside `motion.tsx` (`CountUp` / `usePriceFlash`).

**Verification done**
- `npm run build` (web) — green: tsc clean, vite built, 106 modules
  (was 104).
- Visual QA against `design/motion/Motion Lab.html` left for the user
  (dev server not launched in this turn).

**Files touched**
- `web/src/main.tsx`
- `web/src/components/primitives.tsx`
- `web/src/screens/Watchlist.tsx`
- `web/src/screens/AddCompanies.tsx`
- `web/src/screens/Review.tsx`
- `web/src/screens/Companies.tsx`
- `web/src/screens/Company.tsx`
- `web/src/screens/Settings.tsx`
- `web/src/layout/AppShell.tsx`

**Next step**
Visual QA in the browser:
1. `/` — refresh; expect 6 skeleton cards, then the real grid crossfades
   in with cards staggering up + sparklines tracing themselves. Portfolio
   strip numbers tick up from 0 once.
2. `/companies` → ADD COMPANIES — sector grids fade-rise on first mount;
   click "Select all" on a sector — check marks ripple across cards left
   → right; tray count digit rolls in on change.
3. `/company/NVDA` — click between tabs; the orange ink bar slides under
   the active tab. Click a confidence badge — drawer slides in and the
   inner blocks fade up in sequence.
4. macOS "Reduce motion" on (System Settings → Accessibility → Display) —
   everything should render at final state instantly, no transitions or
   loops.

---

## Increment — Three flag-gated earnings features (FEATURES.md)

**Goal:** ship Consensus vs Actual, Conflict-Resolution Workspace, and
Guidance Tracking — each behind one LABS feature flag, compartmentalized so
turning all three off is byte-for-byte indistinguishable from pre-feature
main.

### Flag system

- **DB:** new `feature_flags` table — per-user row, three boolean columns
  (consensus / conflict / guidance). Picked up by `create_all()` on
  startup; no column migration needed.
- **Backend:** `GET|PUT /api/v1/settings/flags` modelled on the existing
  notifications endpoints. New schema `FeatureFlags` and
  `serialize_feature_flags()`. Defaults: all three on.
- **Frontend:** `FeatureFlags` + `DEFAULT_FLAGS` in `types.ts`. New
  `useFeatureFlags()` in `hooks.ts` reads the localStorage cache
  (`ao-feature-flags`) synchronously on first paint so gating never
  flashes, then PUTs through React Query with optimistic write-back.
- **Settings UI:** `LABS · FEATURE FLAGS` panel rendered above the
  DATA SOURCES panel. One row per feature: name, description, surfaces,
  toggle. Copy lifted verbatim from `design/features/Feature Flags.html`.

### Feature 1 — Consensus vs Actual (`flags.consensus`)

- **Schema:** `Metric.consensus?: { estimate, estimateLabel, surprisePct,
  sourceCount }`.
- **Provider:** `ao/integrations/consensus_provider.py` (stub) — known
  estimates for the demo tickers (NVDA / SNDK / MU) plus a ~1.8%-below-
  actual fallback. Imported ONLY when `flags.consensus` is True inside
  `serialize_company()`. No estimate fetch happens when the flag is off.
- **Watchlist card:** beat/miss badge replaces the status chip when at
  least one metric has consensus; each metric line swaps `+x.x% YoY` for
  `+x.x% vs est` (green/red/flat).
- **Deep-dive header:** `<ConsensusBanner />` rendered above the review
  banner. EPS-vs-est headline + "N of M metrics above estimate" tail.
- **Results table:** conditional `CONS` and `SURP` `<th>/<td>` columns
  added; existing period columns untouched.

### Feature 2 — Conflict-Resolution Workspace (`flags.conflict`)

- **Schema:** `ReviewItem.conflict?: { metric, period, sources[] }` where
  each source has `id ('A'|'B'), kind ('SEC'|'IR'), label, url, value,
  snippet, confidence, note`.
- **Serializer:** `_build_conflict()` derives the rich payload from the
  existing candidate rows whenever ≥2 candidates are present AND
  `flags.conflict` is True. Source kind inferred from the candidate's
  `source` label (heuristic: `8-K / 10-K / 10-Q / EDGAR / exhibit 99 →
  SEC`, else `IR`). Rank → confidence (rank 0 = high, rank 1 = med).
- **Review queue:** new `<ConflictWorkspaceItem />` swapped in for any
  item that has the conflict block when `flags.conflict` is on. Two
  source columns (value, highlighted snippet, source link, confidence,
  note) + decision rail (Accept A / B / Flag / Both-wrong) with a
  required-when-flagged note input.
- **Resolve endpoint:** `POST /review-queue/:id/resolve` body extended to
  `{ choice, note?, pinnedValue? }`. The simple `{ choice }` shape still
  validates so the non-workspace path is unchanged. The `pinnedValue`
  (e.g. "$0.96") is persisted into `resolved_choice`; falls back to the
  abstract choice ('A'|'B'|'flag'|'both-wrong') when not supplied.

### Feature 3 — Guidance Tracking (`flags.guidance`)

- **Schema:** `Company.guidance?: GuidanceItem[]` plus a dedicated
  `GET /api/v1/companies/{ticker}/guidance` endpoint. Returns `[]`
  immediately when `flags.guidance` is off — no extraction work.
- **Provider:** `ao/integrations/guidance_provider.py` (stub) — three
  NVDA rows + one SNDK + one MU. Real extractor is the long pole; the UI
  shows a graceful empty state for any other ticker.
- **Deep-dive:** GUIDANCE tab inserted into the tab array between
  VALIDATION and NEWS when the flag is on; the tab carries the `tab-new`
  dot. The panel lists each guidance row (range, struck-through prior,
  raised/cut/maintained badge, provenance sentence with link). Auto-
  resets to RESULTS if the tab disappears mid-session.

### Compartmentalization invariants

- Every gate is a pure `flags.x && <Thing/>` (or array-conditional tab
  insert). No existing component was refactored to depend on a new field.
- Schema additions are all `Optional` (Pydantic) / `?` (TS). When the
  backend doesn't attach the field — flag off, or no data — every
  existing screen renders identically.
- Backend is lazy:
  - `consensus_provider.consensus_for` only imported / called inside
    `if flags.consensus: …` in the serializer.
  - `guidance_provider.guidance_for` only called inside the route after
    `if not flags.guidance: return []`.
  - `_build_conflict()` returns None for `flags.conflict=False`.
- No cross-feature imports. Each provider is an isolated module.

### Verification

- `npm run build` → tsc clean, 107 modules (was 106), 64.93 KB CSS.
- `python -c "from ao.main import app"` → 46 routes (was 43); the three
  new endpoints are `/settings/flags` (GET/PUT) and
  `/companies/{ticker}/guidance`.
- ASGI in-process smoke test:
  - `GET /settings/flags` → defaults `{consensus:true, conflict:true,
    guidance:true}` for a new user.
  - PUT toggles persist and reflect on the next GET.
  - `GET /companies/NVDA` with `consensus=on` → every metric carries a
    `consensus` block with realistic surprise%; with `consensus=off` →
    zero metrics carry it.
  - `GET /companies/NVDA/guidance` with `guidance=on` → 3 items; with
    `guidance=off` → 0 items.
  - Review queue conflict block is None when `conflict=off`.

### Files touched

- `workers/ao/db/models.py` — `FeatureFlag` table.
- `workers/ao/api/schemas.py` — `FeatureFlags`, `MetricConsensus`,
  `GuidanceItem`, `GuidanceProvenance`, `ConflictSource`,
  `ReviewConflict`. Extended `Metric`, `Company`, `ReviewItem`,
  `ResolveReviewRequest`.
- `workers/ao/api/serializers.py` — `serialize_feature_flags`,
  `_build_conflict`, flag-aware `serialize_company` +
  `serialize_review_queue`.
- `workers/ao/api/routes_settings.py` — `GET|PUT /settings/flags`.
- `workers/ao/api/routes_review.py` — extended resolve body handling.
- `workers/ao/api/routes_companies.py` — `GET /{ticker}/guidance`.
- `workers/ao/integrations/consensus_provider.py` (new).
- `workers/ao/integrations/guidance_provider.py` (new).
- `web/src/types.ts` — `FeatureFlags`, `DEFAULT_FLAGS`,
  `MetricConsensus`, `ReviewConflict`, `ConflictSource`,
  `GuidanceItem`, `GuidanceProvenance`. Extended `Metric`, `Company`,
  `ReviewItem`.
- `web/src/api.ts` — `getFeatureFlags`, `putFeatureFlags`,
  `getGuidance`, `resolveReviewRich`.
- `web/src/hooks.ts` — `useFeatureFlags`, `useGuidance`, extended
  `useResolveReview`.
- `web/src/screens/Settings.tsx` — `FeatureFlagsPanel`.
- `web/src/screens/Watchlist.tsx` — `BeatBadge`, `cardBeatSummary`,
  per-metric surprise line.
- `web/src/screens/Company.tsx` — `ConsensusBanner`, CONS/SURP
  columns, GUIDANCE tab + panel.
- `web/src/screens/Review.tsx` — `ConflictWorkspaceItem`.
- `web/src/styles/app.css` — `.ff-*`, `.sw`, `.beat-badge`,
  `.wl-metric-surp`, `.co-cons-banner`, `.cons-col`, `.cw-*`,
  `.tab-new`, `.gd-*` blocks appended.

### Decisions baked in

- LABS panel sits between PROVIDERS and DATA SOURCES on Settings.
- Defaults all-on (dev posture). Toggling is the only way to flip them;
  no env override.
- Stub estimate/guidance providers per the handoff's "ship behind the
  flag, off, until ready" guidance. Swap in real provider calls when
  the extractors land — interface stays the same.
- ConflictWorkspaceItem derives source kind from candidate label text
  (8-K / 10-Q / EDGAR → SEC, else IR). Good enough for the demo paths
  and trivial to override when richer source metadata lands.
- Did NOT add the optional watchlist `guidance raised ▲` footer chip —
  it would require attaching guidance to the company-list payload,
  which the backend-lazy rule disallows for a list view.

### Next step

Visual QA:
1. `/settings` — LABS · FEATURE FLAGS panel renders three rows; toggle
   each and watch the corresponding surfaces appear/disappear without a
   reload. Refresh: state survives (localStorage + PUT).
2. `/` — Watchlist NVDA card shows BEAT badge + per-metric `+x.x% vs est`
   lines when consensus is on; reverts to YoY deltas + status chip when
   off.
3. `/company/NVDA` — beat/miss banner above the tabs; CONS/SURP columns
   in the results table; GUIDANCE tab between VALIDATION and NEWS. With
   guidance on, three rows (Revenue / Gross margin / Opex) render with
   raised/maintained badges and provenance sentences.
4. `/review` — when the SNDK demo review item is present (re-seed or
   ad-hoc), the row renders as the two-column workspace with VS chip and
   decision rail. With conflict flag off, the simple row returns.
5. Turn all three off — diff the rendered DOM against pre-feature main.
   Should be visually identical apart from the LABS panel itself.

---

## Increment — Help / User Guide page wired into the app (Option A)

**Goal:** ship `HELP.md`'s self-contained Help page (annotated screenshots
with numbered pins → callouts, sticky TOC, scroll-spy) into the running app
so users can reach it from the nav.

**What changed**
- Copied `design/help/` → `web/public/help/` verbatim. Vite serves it at
  `/help/Help.html` (relative `img/*.jpg` and `helpdata.js` references
  resolve under `/help/`).
- `web/src/layout/AppShell.tsx` — extended the NAV array with an
  `external: true` Help item (`?` glyph, `to: /help/Help.html`); the
  render block branches on `external` and emits a plain `<a target="_blank"
  rel="noopener noreferrer">` instead of a `<NavLink>` (so the browser does
  a real navigation and doesn't try to hand the URL to React Router).
  Because the existing mobile container-query reuses the same `nav-list`,
  the Help item appears in both desktop sidebar and the mobile tab bar
  without extra CSS.

**Decisions baked in**
- **Option A (static asset), not Option B (React port).** Help is a
  one-shell page with vanilla JS; porting it into the React app would mean
  re-implementing scroll-spy + pin/callout hover-linking in `useEffect`
  for zero user-visible gain. The handoff explicitly recommends Option A.
- **`target="_blank"` for the Help link.** Keeps the user's app state
  (current screen, query cache, watchlist scroll position) intact while
  they consult docs. Help has no link back to the app, so opening in-tab
  would orphan them.
- **Did NOT add runtime gating on the Labs section (§10 of the help).**
  The three feature flags (consensus / conflict / guidance) default ON,
  and the help section is documentation about features that exist — even
  with all flags off, the docs are still useful as the user toggles them
  on. Adding a `localStorage.getItem('ao-feature-flags')` guard inside the
  static help page would couple it to app internals for marginal UX gain.

**Verification done**
- `npm run build` → tsc clean, 107 modules (unchanged), vite built; help
  bundle copied to `dist/help/` (Help.html + helpdata.js + 12 jpgs).
- `vite preview` smoke test on port 4321:
  - `GET /help/Help.html` → 200 (23,222 bytes — full shell)
  - `GET /help/img/watchlist.jpg` → 200 (40,179 bytes)
  - `GET /help/helpdata.js` → 200 (25,342 bytes)
- AppShell renders Help in both nav modes by virtue of the single
  `nav-list` (the 700px container query restyles the same list as a
  bottom tab bar).

**Files touched**
- `web/public/help/Help.html` (new — copied from design)
- `web/public/help/helpdata.js` (new — copied from design)
- `web/public/help/img/*.jpg` (new — 12 screenshots copied from design)
- `web/src/layout/AppShell.tsx` — `NavItem` type + `external` branch.

**Next step**
Visual QA in the browser:
1. Open the app, click the `?` HELP item in the sidebar — Help page opens
   in a new tab at `/help/Help.html`. All 12 screenshots load; sticky
   TOC on the left is populated by `helpdata.js`.
2. Scroll the page — the active TOC link updates as each section's
   image enters view (IntersectionObserver-driven scroll-spy).
3. Hover a numbered pin on any screenshot — the matching callout
   highlights (and vice-versa).
4. Resize the browser ≤700px — the desktop sidebar collapses into the
   mobile tab bar; the HELP item appears alongside the other six.

---

## Increment — Mobile responsive (recent iPhones ~390–430px)

**Goal:** make every Agent Orange view usable at iPhone widths without
changing the desktop experience. Per `MOBILE.md`, every rule is additive
and scoped inside a `max-width` / container `(max-width:)` query — at
≥1024px the rendered DOM is byte-for-byte identical to pre-change.

Three views needed real work; the rest already reflowed via the existing
`@container (max-width: 700px)` on `.app-shell`.

### 1. Filing Timeline — vertical mobile agenda

- `web/src/screens/Timeline.tsx` — desktop Gantt wrapped in
  `<div className="tl-desktop">`. New `<div className="tl-mobile">`
  agenda added below it, built from the same `LANES` constant: one card
  per ticker (`Glyph` + ticker + `StatusChip`) with REPORTED / PREDICTED
  / WATCHING rows + period label, ported verbatim from
  `design/screens/Timeline.tsx`. `StatusChip` added to the primitives
  import.
- `web/src/styles/app.css` — `.tla-*` styles copied from
  `design/styles/app.css` (after `.lg-watching`, before
  `/* Review queue */`). Toggle added inside the existing
  `@container (max-width: 700px)` block: `.tl-desktop{display:none}` /
  `.tl-mobile{display:flex;flex-direction:column;gap:12px}`.

### 2. Add Companies — mobile reflow

- `web/src/styles/app.css` — new `@media (max-width:640px)` block
  appended after `.ac-done-sub`. Ported from
  `design/addflow/Add Companies.html`'s mobile rules, remapped to the
  `.ac-*` class names the web app uses (design used the plain
  `.toolbar` / `.search` / `.sg-grid` / `.tbl-wrap` / `.sp-tbl` /
  `.tray-*` / `.disc-*` / `.cand` / `.done-hero` system).
  - Toolbar gap-tightened; `.ac-search` becomes flex-basis 100%, sort +
    grid/table seg sit on row 2.
  - `.ac-grid` collapses to single column.
  - `.ac-group-hd` wraps; sector select-all stays compact.
  - **The real defect:** dense table was being clipped. Now
    `.ac-tblwrap{overflow-x:auto;-webkit-overflow-scrolling:touch}` +
    `table.ac-tbl{min-width:580px}`.
  - Selection tray reflows: count + clear + Add on row 1, chips scroll
    on row 2 (`.ac-tray-in{flex-wrap:wrap}` + explicit order on
    `.ac-tray-count` / `.ac-tray-clear` / `.ac-tray-in .btn-primary`
    / `.ac-tray-chips`).
  - Discovery rows + candidate cards wrap.

### 3. Feature Flags / LABS panel

- `web/src/styles/app.css` — new `@media (max-width:720px)` block
  appended after `.sw:disabled`. Note: web/'s Settings page is a single
  column of `<Panel>` components — the design HTML's `.fd-wrap` /
  `.fd-rail` two-pane layout doesn't exist here, so the stack-rail-on-
  top intent is already structurally satisfied (the LABS panel sits
  above the DATA SOURCES panel in the Settings stack at
  `Settings.tsx:131-133`). The mobile block therefore tightens
  `.ff-row` padding/gap + nudges type sizes for narrow screens.

### Compliance with hard rule

- All three rule blocks live inside `max-width:` queries (≤640px / ≤700px
  container / ≤720px) — at ≥1024px nothing matches, so desktop is
  byte-for-byte identical.
- The Timeline JSX adds two new wrapper divs (`.tl-desktop` /
  `.tl-mobile`); `.tl-mobile` has `display:none` outside the container
  query, so it contributes only inert markup at desktop widths.

**Verification done**
- `npm run build` (web) — green: tsc clean, vite built, 107 modules
  transformed (unchanged), CSS 67.40 KB (was 64.93 KB).
- No new console errors expected — additive CSS + JSX wrappers only.

**Files touched**
- `MOBILE.md` (read — no edits)
- `web/src/screens/Timeline.tsx`
- `web/src/styles/app.css`

**Next step**
Visual QA at 390–430px:
1. `/timeline` — Gantt disappears, vertical agenda renders one card per
   ticker with REPORTED / PREDICTED / WATCHING rows.
2. `/companies` → ADD COMPANIES — toolbar stacks, sector grid is single
   column, TABLE view scrolls horizontally (no clip). Selection tray
   reflows; discovery rows wrap.
3. `/settings` — LABS · FEATURE FLAGS panel reads cleanly; toggles align
   right of each row.
4. At ≥1024px diff the three screens against pre-change — should be
   byte-for-byte identical.

---

## Bugfix — Examiner overlay didn't load on Railway deploy

**Symptom:** running RUN ALL AGENTS locally opened the interactive
document-scanning overlay; the same build deployed on Railway never opened
the overlay.

**Cause:** `web/index.html` referenced the examiner assets at
`/src/agent-run/examiner.css|.js|-docs.js`. The Vite dev server maps
`/src/...` to disk, so the three plain `<link>` / `<script defer>` tags
worked in local dev. Production `vite build` does NOT ship `dist/src/`, so
on Railway those URLs 404 and `window.AgentRun` was never defined —
`runAll()` in `AppShell.tsx` then no-op'd.

**Fix:** moved `examiner.css`, `examiner.js`, and `examiner-docs.js` from
`web/src/agent-run/` to `web/public/agent-run/` (Vite copies `public/`
verbatim into `dist/`) and changed the three references in
`web/index.html` from `/src/agent-run/...` to `/agent-run/...`. The empty
`web/src/agent-run/` directory was removed.

**Verification done**
- `npm run build` → green, 106 modules, dist now contains
  `dist/agent-run/{examiner.css,examiner.js,examiner-docs.js}`.
- `dist/index.html` references `/agent-run/...` directly.
- `serve.json` `rewrites: **` still falls back to `index.html` only when
  the real file is missing, so the new asset paths resolve correctly under
  `serve` on Railway.

**Files touched**
- `web/index.html`
- `web/public/agent-run/{examiner.css,examiner.js,examiner-docs.js}` (moved)
- `web/src/agent-run/` (removed)

**Next step**
Redeploy to Railway and verify the overlay opens on RUN ALL AGENTS.

---

## Bugfix — Timeline showed removed companies; deep-dive hung on "loading"

**Symptom:** archiving / permanently deleting a company from the watchlist still
left it on `/timeline`, and clicking that ticker took the user to
`/company/<TICKER>` which sat on "Loading…" forever.

**Cause:**
1. `web/src/screens/Timeline.tsx` had a hardcoded `LANES = [NVDA, SNDK, MU]`
   demo array. Lanes were never driven by the live watchlist, so removed
   tickers stayed and newly added ones never appeared.
2. `useCompany` in `web/src/hooks.ts` used React Query's default `retry: 3`
   with exponential backoff. A 404 from a removed ticker therefore spun
   through ~3 retries before falling through to the "Unknown company" empty
   state — long enough to look like an infinite loading state.

**Fix:**
- Timeline now consumes `useCompanies()`. A `monthFraction()` helper parses
  `latest.reportedOn` and `nextWindow.from`/`to` ("May 27, 2026") into the
  fractional month-indices the desktop Gantt + mobile agenda already use.
  Bar type is derived from `company.status` (validated/review → reported
  marker + window bar; watching → reported marker + watching bar). Empty
  watchlist shows a "No companies on the watchlist yet" panel; tickers
  without a parseable schedule still get a card on mobile with a
  "NO SCHEDULE YET" row.
- `useCompany` now sets `retry: false`, so 404s surface the existing
  "Unknown company" empty state immediately.

**Verification done**
- `npm run build` → tsc clean, vite built, 106 modules.

**Files touched**
- `web/src/screens/Timeline.tsx` (rewritten)
- `web/src/hooks.ts` — `useCompany` no-retry

**Next step**
Visual QA: archive NVDA from `/company/NVDA`, open `/timeline` and confirm
NVDA's lane is gone. Add a new ticker via Add Companies and confirm it
appears on the timeline (empty bars + "NO SCHEDULE YET" on mobile is fine
for brand-new rows). Manually visit `/company/FOO` for a non-existent
ticker → "Unknown company "FOO"." renders right away with no spinner.

---

## Bugfix — PERMANENTLY DELETE 500'd silently; company stayed on the list

**Symptom:** archiving a company then clicking PERMANENTLY DELETE on the
`/companies` ARCHIVED panel did nothing — the row stayed.

**Cause:** `DELETE /api/v1/companies/{ticker}` referenced
`m.Provenance.company_id`, a column that doesn't exist (Provenance only
has `metric_id`). SQLAlchemy raised `AttributeError` at expression
construction, FastAPI 500ed, and the React mutation's `onSuccess` (which
invalidates the companies + archived-companies queries) never ran.
Additionally the route didn't clean up `CompanySourceOverride` rows for
the company, so any per-company source override would leave a dangling
FK if SQLite enforcement were on.

**Fix:** in `workers/ao/api/routes_companies.py::delete_company`:
- Walk the Result → Metric → Provenance chain by collecting `metric_ids`
  from the company's results, then deleting Provenance by `metric_id`,
  then Metric by `id`, then Result.
- Add an explicit `delete(CompanySourceOverride).where(company_id == cid)`.
- Source rows still cascade via the ORM relationship on `await db.delete(row)`.

**Verification done**
- `python -c "from ao.main import app"` → 46 routes (unchanged).
- ASGI in-process smoke test: add AAPL → archive → DELETE → 204; archived
  list no longer contains AAPL; GET `/companies/AAPL` → 404.
- Confirmed pre-fix bug by direct import: `m.Provenance.company_id` raises
  `AttributeError`, which would 500 the request regardless of whether any
  Result / Metric / Provenance rows existed.

**Files touched**
- `workers/ao/api/routes_companies.py` — `delete_company` rewritten.

**Next step**
Visual QA: `/company/<ticker>` → ARCHIVE → `/companies` → ARCHIVED → click
PERMANENTLY DELETE, double-confirm. The row should disappear immediately
from both panels; `GET /api/v1/companies/<ticker>` returns 404.

---

## Feature — In-app Help Assistant (grounded chat agent)

**Goal:** ship a friendly chat panel reachable on every screen that answers
questions about using the app — grounded in a verified corpus so it never
invents features and never gives investment advice.

**Decisions**
- Corpus lives in two places by necessity (Python prompt + JS prototype) but
  with a "keep in sync" header. Python is the source the LLM actually sees;
  the prototype `design/help/agent/knowledge.js` is the human spec.
- Streaming POST (not GET EventSource) because the corpus is ~18 KB and we
  need it in the request body; the client reads chunks via a
  `ReadableStream` reader and parses SSE frames manually.
- New `help` routing stage pinned to Haiku via settings — Q&A doesn't need
  Opus, and grounding makes a small model accurate enough.
- Real Anthropic call wired; without a key, the route falls back to a
  canned friendly reply so dev still works.

**Current state**
- Backend: `workers/ao/help/{knowledge,prompt}.py` + `routes_help.py`
  registered at `/api/v1/help/ask`. Verified live with the configured
  Anthropic key — acceptance scenarios (advice / off-topic / made-up
  feature / add-a-company) all pass.
- Frontend: `web/src/help/{HelpAgent,stream,screen,starters}.tsx?` mounted
  in `AppShell`. Launcher persists open/closed in localStorage; the
  current route auto-fills the `screen` field; streamed deltas render
  token by token.
- `npm run build` clean (110 modules).

**Files touched**
- `workers/ao/help/{__init__,knowledge,prompt}.py` (new)
- `workers/ao/api/routes_help.py` (new)
- `workers/ao/{main,config}.py` and `workers/ao/agents/registry.py`
- `web/src/help/{HelpAgent.tsx,stream.ts,screen.ts,starters.ts}` (new)
- `web/src/layout/AppShell.tsx`, `web/src/styles/app.css`

**Next step**
None blocking. Future work: add a 👍/👎 feedback signal + an unanswered-
question log to drive corpus updates (handoff §"Keep it grounded &
improving").

---

## Increment — Playwright headless-browser smoke suite

**Goal:** stop catching UI regressions only by eyeballing. Stand up a
Playwright suite that drives the real app end-to-end against real APIs so
breakage fails the build instead of needing a manual repro.

**What landed (per `UI_TEST_PLAN.md`)**
- `playwright.config.ts` at repo root — Chromium only, serial workers,
  auto-spawns api+daemon+web with `DATABASE_URL` pointed at a throwaway
  `workers/var/ao.test.db` so the real `ao.db` is never touched.
- 9 specs under `tests/e2e/` (one per feature), 11 tests total, ~14 s
  end-to-end. All 11 green on a fresh DB.
- `tests/e2e/_setup.ts` — `wipeDb` / `addCompany` / `archive` / `restore`
  helpers; each spec wipes in `beforeEach` so it starts from the demo NVDA
  anchor. Spec 05 (review queue) additionally invokes `python -m ao.db.seed`
  in `beforeAll` because wipe doesn't reseed review items.
- Mobile-viewport pass folded into specs 01 + 04 (regression guard for the
  iOS Safari bottom-nav fix in 4a6b1f5).
- `npm run test:e2e` + `make test-e2e` targets, plus `.gitignore` entries
  for `test-results/`, `playwright-report/`, `workers/var/ao.test.db*`.

**Issues found and fixed by the suite**
- `useFeatureFlags` had `initialData: readFlagsCache()` + `staleTime: 30_000`
  with no `initialDataUpdatedAt`. If localStorage was empty or stale, React
  Query treated the DEFAULT_FLAGS fallback as fresh for 30 s and never
  refetched — so the LABS panel showed the wrong state until the user
  toggled something. Set `initialDataUpdatedAt: 0` so initial-from-cache is
  treated as stale and refetches on mount. `web/src/hooks.ts`.

**Workarounds baked in**
- Playwright 1.61 + Node 23 crashes on test discovery
  (`context.conditions?.includes is not a function` in its ESM loader hook).
  `scripts/patch-playwright.cjs` runs on `postinstall` to wrap the call site
  with `Array.from(...)`. Idempotent. Drop when Playwright > 1.61 ships a
  Node 23 fix.

**Out of scope (per plan)**
Cross-browser (Firefox/WebKit), Vitest/RTL component tests, CI wiring,
deeper per-feature edge-case coverage, mocked/offline mode — all explicitly
deferred to follow-ups.

**Next step**
None blocking. When CI is wired up: drop `reuseExistingServer` (already
gated on `!CI`) and pre-install chromium in the workflow image. Keep
considering whether `wipe()` should reseed review items so spec 05 can stop
shelling out to Python.


---

## Overall LLM Financial Confidence % (replaces per-metric high/med/low headline)

**Goal**
Replace the headline confidence indicator (per-metric high/med/low, which only
measured inter-document agreement within one filing) with a company-level,
LLM-derived financial-confidence PERCENTAGE (0-100), colour-coded red→amber→green,
with a transparent factor-by-factor breakdown. The score blends: (a) inter-doc
agreement on filings (the existing validation, folded in), (b) cross-source/
cross-period consistency, (c) insider activity + news, (d) share-price trend and
whether filings/news direction aligns with recent price direction.

**Key decisions (why)**
- Dedicated `confidence_assessments` table, not columns on `Result`: the score is
  per-company and recomputed daily independent of filing periods (`Result.is_latest`
  rotates). Breakdown stored as JSON-as-TEXT per the portability rules. New table →
  auto-created by `create_all()`, no `_COLUMN_MIGRATIONS` entry needed.
- Deterministic stats computed in code (agreement tally, EPS continuity, insider
  buy/sell, price slope/% changes, alignment); the LLM only weighs + explains, never
  does math. Audit trail stored in `inputs_json`.
- Band (high/medium/low) always re-derived from pct in code (`confidence.band_for`:
  ≥70/≥40/<40) so colour and label can never disagree; the LLM's proposed band is ignored.
- Recompute daily (scheduler) + on every new filing (pipeline). Daily job has a 20h
  idempotency guard so a same-day filing recompute doesn't double-bill Opus.
- Historical price: added `finnhub_client.stock_candles` + daily `backfill_prices`
  job storing into the existing `prices` table. `/stock/candle` is premium → on
  no-data it returns [] and the trend falls back to accumulated snapshots; thin
  coverage is signalled to the LLM via `data_points`/`coverage_days` to down-weight.
- Per-metric high/med/low badges kept in the validation tab / provenance drawer as
  supporting detail; the % is the new headline.

**Changed files**
- Backend: `db/models.py` (ConfidenceAssessment), `agents/confidence.py` (new stage),
  `agents/prompts.py` (CONFIDENCE_SYSTEM/TOOL + PROMPT_VERSION_CONFIDENCE),
  `agents/registry.py` (confidence→Validation routing), `agents/pipeline.py` (call
  after narrative), `scheduler/jobs.py` (backfill_prices, recompute_confidence,
  _hours_since), `scheduler/scheduler.py` (00:10/00:15 jobs), `api/routes_run.py`
  (RUN ALL reordered: data refreshes before pipelines), `api/schemas.py` +
  `api/serializers.py` (Confidence wire type on Company),
  `integrations/finnhub_client.py` (stock_candles).
- Frontend: `types.ts` (Confidence types), `components/primitives.tsx`
  (ConfidenceGauge + ConfidenceBreakdown + confColor lerp), `screens/Company.tsx`
  (header gauge + breakdown drawer), `screens/Watchlist.tsx` (compact card gauge),
  `styles/app.css` (.confg*, .cfb*).

**Verified**
- `npm run build` (tsc + vite) clean; backend imports clean; ruff clean on new code
  (only pre-existing unused `desc` import in pipeline.py remains, untouched).
- Live DB checks: `confidence_assessments` table created with all columns; stat
  assembly runs on empty + populated companies without crashing; serializer returns
  None pre-assessment and a populated Confidence after; trend math (rising series →
  slope +1, +% changes, aligns_with_price True); 20h guard helper correct.

**Next step**
Manual UI smoke with a real ANTHROPIC_API_KEY (run pipeline for a ticker, confirm
gauge + breakdown render and colour matches pct). Optionally add a Playwright spec
for the confidence gauge/drawer.

---

## Increment — User-configurable validation thresholds

**Goal:** the tolerance bands that decide "corroborated vs route-to-review"
used to be hard-coded literals (`$0.001` EPS, `0.1%` margins, `1%` revenue)
inside the `VALIDATION_SYSTEM` prompt string. Move them into per-user state
that gets interpolated into the prompt at run time, and expose a Settings
panel for editing.

**What landed**
- **DB:** new `validation_thresholds` table — `(user_id PK, eps_abs Float
  default 0.001, margin_pct Float default 0.1, revenue_pct Float default
  1.0)`. Picked up by `create_all()` in `ensure_schema()` at app boot, so
  existing SQLite files self-heal on next startup.
- **Backend prompt:** `prompts.py` — `VALIDATION_SYSTEM` constant replaced
  with `validation_system(eps_abs, margin_pct, revenue_pct)` builder.
  Bumped `PROMPT_VERSION_VALIDATION` v1 → v2. Module-level
  `VALIDATION_SYSTEM = validation_system()` kept so any future caller using
  the constant still gets defaults. `validate_metrics()` now loads
  `serialize_validation_thresholds(session, user_id)` and passes the three
  floats into `validation_system()` before each Anthropic call.
- **Backend API:** `GET|PUT /api/v1/settings/thresholds` modelled on
  `/settings/flags`. PUT clamps negatives to 0; values pass through
  otherwise. New `ValidationThresholds` Pydantic schema and
  `serialize_validation_thresholds()` helper.
- **Frontend:** `ValidationThresholds` type + `DEFAULT_THRESHOLDS` in
  `types.ts`; `api.getValidationThresholds` / `putValidationThresholds`;
  `useValidationThresholds()` hook with optimistic-cache write-through.
  New `VALIDATION — review thresholds` panel on Settings, between LABS and
  DATA SOURCES. Three numeric inputs (EPS / Margins / Revenue), SAVE +
  DEFAULTS buttons. SAVE is disabled until the draft diverges.
- **CSS:** `.thr-input` + `.thr-actions` in `app.css` so the input row sits
  cleanly in the `.ff-row` slot the `.sw` toggle uses on the LABS panel.

**Decisions baked in**
- Per-user, not global — same model as `feature_flags` /
  `notification_prefs`. The default-when-no-row path keeps every existing
  user untouched (returns the historic literals).
- GAAP-vs-non-GAAP EPS still always routes to review, regardless of band.
  That rule lives in the prompt body (`prompts.py` final line of
  `validation_system()`), not in any number.
- Builder function instead of `.format()` on the constant — keeps the
  prompt body literal-safe (no curly brace escaping) and makes the
  defaulted constant a one-line `validation_system()` call.
- Hard-clamp negatives to 0 on PUT (rather than 422). Treat the input as
  "I don't want a tolerance" → all disagreement becomes a conflict.
- Did NOT expose this in the UI on the deep-dive validation card; bands
  are a global setting per user, not a per-company override. (If a future
  need arises, add a `company_id` column to the table, fall back to
  user-scope when absent.)

**Verification done**
- `npm run build` → tsc clean, 110 modules (was 107), 60.29 KB CSS.
- `python -c "from ao.main import app"` → 38 routes; new ones present:
  `GET|PUT /api/v1/settings/thresholds`.
- `validation_system(eps=0.02, margin=0.5, revenue=2.5)` interpolation
  smoke: returns a string containing `$0.02`, `0.5%`, `2.5%` in the right
  positions.
- ASGI in-process smoke (with `ensure_schema()` to create the new table):
  - `GET /settings/thresholds` → 200 `{epsAbs: 0.001, marginPct: 0.1,
    revenuePct: 1.0}` for fresh user.
  - `PUT` with `{0.05, 0.25, 1.5}` → 200 echo; subsequent GET reflects.
  - `PUT` with negatives → 200 `{0, 0, 0}` (clamped).
  - `PUT` back to defaults → 200 confirmed.

**Files touched**
- `workers/ao/db/models.py` — new `ValidationThreshold` model.
- `workers/ao/agents/prompts.py` — `validation_system()` builder,
  `PROMPT_VERSION_VALIDATION = "v2"`.
- `workers/ao/agents/validation.py` — load thresholds, pass into builder.
- `workers/ao/api/schemas.py` — `ValidationThresholds` wire schema.
- `workers/ao/api/serializers.py` — `serialize_validation_thresholds`.
- `workers/ao/api/routes_settings.py` — `GET|PUT /settings/thresholds`.
- `web/src/types.ts` — `ValidationThresholds`, `DEFAULT_THRESHOLDS`.
- `web/src/api.ts` — `getValidationThresholds`, `putValidationThresholds`.
- `web/src/hooks.ts` — `useValidationThresholds`, `keys.validationThresholds`.
- `web/src/screens/Settings.tsx` — `ValidationThresholdsPanel` +
  `THRESH_DEFS`.
- `web/src/styles/app.css` — `.thr-input`, `.thr-actions`.

**Next step**
Visual QA: `/settings` → VALIDATION panel renders between LABS and DATA
SOURCES with three numeric rows. Edit any value → SAVE enables; click →
hint disappears. Refresh → values persist. With Anthropic key wired, run
the pipeline against NVDA and inspect the next `agent_runs` row tagged
`validation` — the system prompt sent (logged in `model` / `prompt_version`
trace, if surfaced) should reflect the new bands. Click DEFAULTS → fields
revert to `0.001 / 0.1 / 1.0`; SAVE re-enables.

---

## Increment — CIK resolution in Add Companies + remove NVDA demo anchor

**Goal:** the realistic real-data demo flow. Click "wipe everything" → truly
empty watchlist (today it restored NVDA). Add any S&P 500 ticker via Add
Companies → backend resolves a real SEC CIK from SEC's public ticker map →
the EDGAR pipeline fires for that ticker on RUN ALL AGENTS → real
confidence outcomes emerge. Replaces the "NVDA-always-present demo anchor"
posture from the previous increment.

**What landed**
- **New module:** `workers/ao/integrations/cik_resolver.py`. `resolve_cik(ticker)`
  pulls SEC's `https://www.sec.gov/files/company_tickers.json` (~150 KB,
  every exchange-listed ticker→CIK pair) on first call, parses to an
  in-memory dict, and caches the raw JSON to
  `workers/var/cache/company_tickers.json` with a 24h TTL. Reuses the
  polite User-Agent (`config.edgar_user_agent`) and the same `httpx.AsyncClient`
  pattern `edgar_client.py` uses. Returns zero-padded 10-digit string or
  `None` (OTC/ADR/transient fetch failure → row is still persisted, pipeline
  no-ops cleanly).
- **Wired into `POST /companies/batch`** (`workers/ao/api/routes_companies.py`)
  — after looking up name/sector/seed price from `sp500_seed`, also resolves
  CIK and writes it to `Company.cik`. The SEC `Source` row label becomes
  `EDGAR · CIK 0000909832` (was `EDGAR · search "COST"`). Unresolved tickers
  log `cik.unresolved` but still persist.
- **NVDA demo anchor removed everywhere:**
  - `workers/ao/main.py` lifespan — dropped the `ensure_demo_anchor()` call;
    only `ensure_schema()` remains on startup.
  - `workers/ao/db/wipe.py` — dropped the post-wipe NVDA restore. Wipe is
    now fully destructive.
  - `workers/ao/api/routes_companies.py::delete_company` — dropped the 409
    refusal on `DELETE /companies/NVDA`. Hard-delete works for any archived
    company.
  - `web/src/screens/Companies.tsx` — dropped the special-case hiding of
    the PERMANENTLY DELETE button on NVDA's archived row.
  - `ensure_demo_anchor()` kept in `db/seed.py` as a function for the
    `python -m ao.db.seed` CLI; just not auto-called anywhere.
- **Examiner overlay graceful empty-playlist:** `web/public/agent-run/examiner.js`
  — when the watchlist has no fixture-equipped tickers (NVDA/SNDK/MU not
  present), no longer falls back to playing NVDA's fixture chapter. Runs
  background-rail only with subtitle "scanning watchlist · N companies"
  and summary "Refreshed quotes + news + insider for N companies (…)".
  Behavior unchanged when fixture tickers are on the list.
- **SNOW added to the SP500 grid:** `workers/ao/data/sp500_seed.py` +
  `web/src/data/sp500.ts` — Snowflake (Information Technology, $210, mcap
  $68B). Total roster now 163 rows. SNOW is required for the LOW-confidence
  demo path and wasn't in the static roster before.
- **Tests:** `tests/e2e/_setup.ts` — `wipeDb` now follows the wipe with
  `addCompany('NVDA')` via the batch endpoint so existing specs that assume
  an NVDA row continue to work. CIK is resolved live; the produced row is
  functionally equivalent to the old demo-anchor row.

**Verification done**
- `npm run build` (web) — green, 110 modules.
- `python -c "from ao.main import app"` — green, 49 routes.
- CIK resolver smoke (live SEC fetch): NVDA → `0001045810`, COST →
  `0000909832`, DIS → `0001744489`, SNOW → `0001640147`, gibberish → None.
- ASGI in-process smoke: `POST /companies/batch {tickers:["COST","DIS","SNOW"]}`
  → 200, three rows persisted with correct CIKs. SSE `company.updated`
  fires per ticker. `wipe()` after add → 0 companies remain (no NVDA
  auto-restore).
- Playwright e2e suite — running.

**Decisions baked in**
- Per-user CIK cache is intentionally process-global (module-level dict +
  shared on-disk file). The map is the same for every user and is public
  data; no point per-user.
- Discovery (`POST /companies` stub) is unchanged — CIK is resolved by the
  batch endpoint, not surfaced through the discovery rail. Could be added
  later to display "✓ CIK 0000909832 found" in the discovery card.
- SP500_SEED's `tracked` field stays advisory only — the universe overlay
  reads from the DB. SP500 changes don't bring any company into the live
  watchlist.
- Demo tickers (researched, evidence verified against Q1/Q2 2026 filings):
  - 🟢 COST (Costco) — clean GAAP only, EPS $4.93 +15.2% YoY, expected
    HIGH confidence (~75-90%).
  - 🟡 DIS (Disney) — moderate GAAP/adjusted gap ($1.34/$1.63), down YoY
    with stock falling, expected MEDIUM (~45-65%).
  - 🔴 SNOW (Snowflake) — catastrophic GAAP −$0.90 vs non-GAAP +$0.39
    (sign flip), validation rule fires deterministically, expected LOW
    (~20-38%) plus a review-queue row.

**Files touched**
- `workers/ao/integrations/cik_resolver.py` (new)
- `workers/ao/api/routes_companies.py` — resolve CIK on batch add; drop
  NVDA delete guard.
- `workers/ao/main.py` — drop `ensure_demo_anchor` from lifespan.
- `workers/ao/db/wipe.py` — drop post-wipe `ensure_demo_anchor`.
- `workers/ao/data/sp500_seed.py` — SNOW added.
- `web/public/agent-run/examiner.js` — background-only mode for empty
  fixture playlist.
- `web/src/screens/Companies.tsx` — drop NVDA-specific delete hide.
- `web/src/data/sp500.ts` — SNOW added.
- `tests/e2e/_setup.ts` — re-add NVDA after wipe for back-compat.

**Next step**
Visual QA (the user-described "real use" flow):
1. `/settings` → FIRST-TIME EXPERIENCE → confirm RESET. Reload `/`. The
   watchlist is empty (only the empty state). `/companies` shows zero
   active and zero archived.
2. `/companies` → ADD COMPANIES → search COST, DIS, SNOW → select each →
   ADD → discovery rail completes → START WATCHING ALL.
3. Confirm `sqlite3 workers/var/ao.db "SELECT ticker, cik FROM companies;"`
   returns the three rows with `0000909832`, `0001744489`, `0001640147`.
4. RUN ALL AGENTS → overlay plays the background-rail (no faked NVDA
   chapter). Behind the scenes EDGAR fetch → extraction → validation →
   confidence runs against real Anthropic for all three. Allow ~30-60s
   for the full pipeline.
5. Reload `/`. Three cards with distinct gauges:
   - COST: green ring, ~75-90% (HIGH band)
   - DIS: amber ring, ~45-65% (MEDIUM)
   - SNOW: red ring, ~20-38% (LOW), status `review`; `/review` shows a row
     with $-0.90 vs $0.39 candidates.

---

## Increment — REFRESHING / QUEUED indicator on watchlist cards

**Goal:** the agent pipeline takes ~75 s per company (EDGAR fetch +
extraction + validation + narrative + confidence), and runs serially for
RUN ALL AGENTS. Today the cards don't change until each company's pipeline
fully commits, so the user is staring at unchanged cards for minutes with
no signal that work is happening. Need an on-card REFRESHING pill with a
rough ETA so the wait is legible.

**What landed**
- **New module:** `workers/ao/agents/pipeline_state.py` — in-memory tracker
  with two module-level dicts (`_running`, `_queue`). Functions
  `queue_tickers(user_id, tickers)`, `mark_started(user_id, ticker)`,
  `mark_finished(user_id, ticker)`, `status_for(user_id, ticker)`.
  Process-local, intentional — fine for v1 single-process deploy. Survives
  no restarts, which is correct (any in-flight pipeline was killed too).
  Default per-ticker budget: 75 s.
- **`workers/ao/api/routes_run.py`:**
  - `_bg_run` now wraps the pipeline body in `mark_started/mark_finished`
    so the state flips correctly even on exceptions.
  - `POST /run` (RUN ALL AGENTS) synchronously loads tickers + calls
    `pipeline_state.queue_tickers` BEFORE returning, so the frontend's
    onSuccess refetch immediately sees `pipelineRun: {state: "queued"}` on
    every card. Otherwise the BackgroundTasks would race the refetch.
  - `POST /companies/{ticker}/run` same: queues synchronously.
  - `_bg_run_all` keeps a defensive `queue_tickers` call (idempotent).
- **Wire schema** (`workers/ao/api/schemas.py`): new `PipelineRun`
  `{state: "running" | "queued", startedAt?: str, etaRemainingSeconds: int}`.
  Optional field on `Company`.
- **Serializer** (`workers/ao/api/serializers.py::_build_pipeline_run`):
  reads `pipeline_state.status_for(user_id, ticker)` and serializes.
- **Frontend:**
  - `web/src/types.ts` mirrors `PipelineRun`.
  - `web/src/screens/Watchlist.tsx` renders a `<PipelineBadge>` in
    `.wl-card-top-right` whenever `c.pipelineRun` is non-null. Format
    "REFRESHING · ~45s" (orange, pulsing dot) or "QUEUED · ~2m" (gray).
    Compact `fmtEta()` switches `Ns` ↔ `Nm` at the 60 s boundary.
  - `web/src/styles/app.css` — `.wl-pipeline-pill` + `.queued` variant.
  - `web/src/hooks.ts::useCompanies` — `refetchInterval: 3000` while any
    company has `pipelineRun`, otherwise off. ETA naturally counts down on
    the server side as elapsed grows.

**Decisions baked in**
- Tracker is in-memory module-level state. No DB schema change. Trades
  durability for simplicity — multi-process deploys would need a small DB
  table or Redis here, but the user is on the single-process posture.
- The queue is per-user FIFO. Pipelines run serially. So all queued cards
  show ETAs stacked behind the running one (running ETA + position × 75 s).
- The route handler does the synchronous queue, not `_bg_run_all`. Eliminates
  the race window where the frontend's first refetch would see no state.
- `etaRemainingSeconds` clamps to 0 — never goes negative. The card shows
  "FINISHING…" in that case until the pipeline actually completes and the
  badge disappears.
- 75 s budget is a back-of-envelope (monitoring ~5 s + extraction ~30-45 s +
  validation ~10 s + narrative ~5 s + confidence ~10-15 s). Tune later if
  the actual distribution lands far off.
- Adaptive polling sits beside the existing SSE invalidation — not a
  replacement. SSE still fires `company.updated` on each stage commit.

**Verification done**
- `python -c "from ao.main import app"` — green, 49 routes.
- `npm run build` (web) — green, 110 modules.
- `pipeline_state` unit smoke: queue 3 tickers; first running shows 75 s ETA;
  queued #2 shows 75 s; queued #3 shows 150 s; 2 s wait → all decrement
  correctly; finish #1 + start #2 → roles cycle.
- ASGI in-process smoke: `POST /companies/batch {tickers:["COST","DIS","SNOW"]}`,
  then `pipeline_state.queue_tickers + mark_started` for COST, then
  `GET /companies` → COST `running` (startedAt + 75 s ETA), DIS `queued` 75 s,
  SNOW `queued` 150 s.
- Playwright e2e — running.

**Files touched**
- `workers/ao/agents/pipeline_state.py` (new)
- `workers/ao/api/routes_run.py` — mark in _bg_run; synchronous queue in
  POST /run and POST /companies/{ticker}/run.
- `workers/ao/api/schemas.py` — `PipelineRun` + `Company.pipelineRun`.
- `workers/ao/api/serializers.py` — `_build_pipeline_run`.
- `web/src/types.ts` — `PipelineRun`.
- `web/src/screens/Watchlist.tsx` — `<PipelineBadge>` + `fmtEta`.
- `web/src/styles/app.css` — `.wl-pipeline-pill`.
- `web/src/hooks.ts` — `refetchInterval` driven by `pipelineRun` presence.

**Next step**
Live test: wipe → add COST/DIS/SNOW → RUN ALL AGENTS. Expected sequence:
1. All three cards show a gray QUEUED pill within ~1 second of clicking.
   ETAs stack: ~1m / ~2m / ~3m.
2. As the data-refresh phase finishes, COST's pill flips to orange
   REFRESHING with a 75 s countdown.
3. Card data updates (price, confidence gauge, narrative) when COST's
   pipeline commits each stage.
4. COST's pill disappears. DIS flips to REFRESHING. SNOW remains QUEUED
   with ~1 m ETA.
5. Continues serially until all three pills are gone.

---

## Increment — Demo polish: multi-recipient notifs · unsupported notice · Recommended row

**Goal:** three small surfaces to make demos and exploration smoother.

**What landed**
- **Multi-recipient SMS / email.** `workers/ao/notify/dispatcher.py` —
  added `_split_recipients(s)` (comma-separated, trim, drop empties) and
  changed the dispatch tail to loop over the parsed list, wrapping each
  send in try/except so one bad address logs `notify.email.send_failed`
  / `notify.sms.send_failed` and the rest still go out. DB schema
  unchanged — `NotificationPref.email` / `phone` remain single TEXT
  columns; the comma-list lives inside that one string. Settings panel
  (`web/src/screens/Settings.tsx`) — email input dropped to `type="text"`
  (HTML5 `email` rejects commas), both fields gained multi-recipient
  placeholders + a `comma-separate multiple recipients` hint line.
- **"Company not yet supported" notice on watchlist cards.** New
  `web/src/data/supported.ts` exports `SUPPORTED_TICKERS = {NVDA, SNDK,
  MU, COST, DIS, SNOW}` + `isSupported(ticker)`. In
  `web/src/screens/Watchlist.tsx::CompanyCard`, when `!isSupported`,
  the metrics grid + period block + footer collapse into a single
  dashed-bordered notice block ("Company not yet supported — Detailed
  extraction and confidence coverage will land in a future release.").
  Top-right badges, price row, and position block stay intact. New
  `.wl-unsupported` class added to `web/src/styles/app.css`.
- **Recommended section on Add Companies.** Same `SUPPORTED_TICKERS`
  constant feeds a pinned `.ac-group` at the top of the browse-grid view
  in `web/src/screens/AddCompanies.tsx`. Header reads
  `Recommended · 6 cos · quick access · full data coverage`. Always
  shows all six cards in grid view (ignores search / sector chip);
  sector groups below still filter as before. Tickers also remain in
  their normal sector group below — the recommended row is additive.

**Decisions baked in**
- DB unchanged. The comma-list lives inside a single TEXT column. Lower
  friction than introducing a JSON array; trivial to parse at dispatch
  time.
- Per-recipient try/except in the dispatcher loop. One malformed
  address shouldn't abort delivery to valid ones.
- Supported-ticker allowlist is a frontend-only concept. The backend
  still runs the pipeline for any ticker; the notice only governs
  what's shown on the watchlist card.
- `SUPPORTED_TICKERS` is the single source of truth; same constant
  feeds both surfaces (watchlist notice + Recommended row) so the demo
  set is defined in exactly one place.
- Recommended row pinned to grid view only (table view is itself a
  full-density browse mode; no quick-access bar needed). Ignores
  search/sector chips by design — it's a fixed shortcut, not a filtered
  subset.

**Verification done**
- `npm run build` → tsc clean, vite built, 111 modules (was 110), 63.0
  KB CSS.
- `python -c "from ao.main import app"` → 49 routes (unchanged).
- `_split_recipients` unit smoke: `"a@x.com, b@x.com ,,  c@x.com"` →
  `["a@x.com", "b@x.com", "c@x.com"]`; `""` → `[]`.

**Files touched**
- `workers/ao/notify/dispatcher.py` — `_split_recipients` + per-
  recipient send loops.
- `web/src/screens/Settings.tsx` — NOTIFICATIONS field types / labels /
  hints.
- `web/src/data/supported.ts` *(new)* — `SUPPORTED_TICKERS` +
  `isSupported`.
- `web/src/screens/Watchlist.tsx` — unsupported-card branch.
- `web/src/screens/AddCompanies.tsx` — `recommended` memo + pinned
  `.ac-group` above sector groups.
- `web/src/styles/app.css` — `.wl-unsupported`, `.wl-unsupported-dot`,
  `.wl-unsupported-copy`, `.wl-unsupported-title`, `.wl-unsupported-sub`.

**Next step**
Visual QA:
1. `/settings` → NOTIFICATIONS: enter `a@example.com, b@example.com`
   in EMAIL ADDRESSES and `+353123, +1555` in PHONE NUMBERS, SAVE.
   Trigger a `validated` event and confirm both recipients receive.
2. `/` after `wipe` + `add WMT`: card shows price + position + the
   "Company not yet supported" notice. Add `COST`: full card.
3. `/companies` → ADD COMPANIES: top of grid shows
   `Recommended · 6 cos` with NVDA, SNDK, MU, COST, DIS, SNOW. Typing
   in search and clicking sector chips leaves the recommended row
   untouched; sector groups below filter normally.

---

## Increment — Company-card explainability tooltips + period="?" root-cause fix

**Goal:** users couldn't tell what the BEAT/MISS badge or the CONS/SURP
columns meant, and the "LATEST" row on the watchlist card often showed
`?` for the reporting period. Add hover tooltips for the first two; fix
the `?` at the source instead of papering over it in the UI.

**What changed**
- `web/src/screens/Watchlist.tsx` — `BeatBadge` gets a `title` explaining
  the avg-surprise-% threshold rule (>+0.5% beat, <−0.5% miss, else in
  line).
- `web/src/screens/Company.tsx` — same tooltip pattern on
  `ConsensusBanner` (EPS-only wording) and on the `CONS` / `SURP`
  `<th>` headers in the results table.
- `web/src/components/primitives.tsx` already uses the same native
  `title=""` pattern, so no new tooltip component / CSS needed.
- `workers/ao/agents/monitoring.py` — root cause of `period="?"` was
  that the monitor never read EDGAR's `periodOfReport` field. Now:
  - extracts `recent.get("periodOfReport", [])` alongside form /
    accession / filingDate;
  - new `_derive_period_label(form_type, period_of_report_iso)` →
    `"FY2025"` for 10-Ks, `"Q3 2025"` for 10-Qs / 8-Ks, falls back to
    the form name (e.g. `"8-K"`) when EDGAR omits the period;
  - Filing row now sets `period=…label…` and
    `period_end=period_of_report or filing_date` (period_end was
    incorrectly the filing date before — should be the period-end
    date).
  - The `or "?"` fallbacks in `agents/pipeline.py:102,149` stay as
    belt-and-braces but should never fire in practice.

**Decisions baked in**
- Native HTML `title=""` over a custom tooltip component — matches the
  existing pattern, zero CSS overhead.
- No DB migration / backfill. The wipe-and-rehydrate flow ([[feedback_
  no_demo_anchor]]) clears stale `period="?"` rows; the next monitoring
  poll writes the proper label.
- Tooltip wording describes what the column *means*, not the current
  stub implementation status of `consensus_provider.py`.

**Verification (visual QA TBD)**
1. Dev server → Watchlist → hover BEAT/MISS pill → tooltip describes
   threshold rule. Open a company → hover headline BEAT pill + CONS /
   SURP column headers → all three tooltips appear.
2. Wipe DB, add a supported S&P-500 ticker, let monitoring run once →
   `LATEST` reads e.g. `Q3 2025 ended 2025-09-30`, never `?`.
3. Add a ticker whose latest filing is an 8-K with no `periodOfReport`
   in EDGAR → label falls back to `"8-K"` instead of `?`.

**Files touched**
- `web/src/screens/Watchlist.tsx`
- `web/src/screens/Company.tsx`
- `workers/ao/agents/monitoring.py`

**Next step**
Visual QA per the three points above, then commit.

---

## Increment — Real company logos everywhere in the UI

**Goal:** swap the 2-letter ticker monogram for real CDN-hosted company
logos in every place the UI renders a company (Watchlist, Companies,
Company deep-dive, Review queue, Filing Timeline, Add Companies browse
grid, and the Agent Run examiner overlay), without losing the existing
monogram as a graceful fallback.

**What landed**
- Backend
  - `Company.logo_url` column (`workers/ao/db/models.py`); idempotent
    migration via `engine.py:_COLUMN_MIGRATIONS`.
  - `Company.logoUrl` on the wire (`api/schemas.py`,
    `api/serializers.py`); `UniverseCompany.logoUrl` likewise.
  - `finnhub_client.company_profile(symbol)` — wraps
    `/stock/profile2`. Called inside `POST /companies/batch` right after
    `resolve_cik`, persists the returned `logo` URL. Best-effort: a
    failed fetch leaves `logo_url=None`, UI shows monogram.
  - Lifespan startup (`main.py`) fires a background task that fills
    `logo_url` for any pre-existing Company row where it is null.
- Universe seed
  - `workers/ao/data/sp500_logos.py` (new) — `LOGO_BY_TICKER` map keyed
    by S&P 500 ticker. Generated by `workers/scripts/seed_logos.py`
    (new) which iterates `SP500_SEED` and calls
    `finnhub_client.company_profile`. Re-run on roster changes.
  - First run resolved 153/163 tickers.
  - `routes_universe.py` emits `logoUrl` per row.
- Frontend
  - `Glyph` (`web/src/components/primitives.tsx`) and `MonoGlyph`
    (`AddCompanies.tsx`) take an optional `logoUrl`; render an
    `<img loading="lazy">` and fall back to the 2-letter monogram on
    error or null URL.
  - CSS (`web/src/styles/app.css`) — `.glyph img` and `.ac-glyph img`
    keep the 34×34 tile, white background reads cleanly against the
    panel surface, status-accent bar (the `::after`) stays visible.
  - `Company.logoUrl` + `UniverseCompany.logoUrl` added to `types.ts`.
  - Threaded `logoUrl` through every call site: Watchlist, Companies
    (active + archived), Company deep-dive, Review (looked up from
    `useCompanies`), Timeline (both desktop + mobile lanes),
    AddCompanies (grid + discovery confirmation row).
- Examiner overlay
  - `AgentRun.start(...)` widened to also accept
    `{ticker, logoUrl}[]`; signature kept back-compat with
    `string | string[]`.
  - `AppShell.runAll()` passes
    `companies.map(c => ({ticker, logoUrl}))`.
  - `examiner.js` renders a small `<img>` in the brand subtitle next to
    `examining <ticker> filings · …` and inside each background-rail
    pill. `examiner.css` adds `.rc-sub-logo` (16×16) and `.rc-bg-logo`
    (14×14).

**Decisions baked in**
- **URL only, no local mirroring.** Browser fetches images directly
  from `static.finnhub.io`. Simple; survives wipes. Re-introducing
  local mirroring later only needs a `safe_fetch` + storage swap inside
  `_backfill_missing_logos`.
- **Finnhub `/stock/profile2` as source of truth.** Already-integrated
  provider, no new keys. 10 of 163 SP500 tickers came back with no
  logo (e.g. T, F, V) — fallback monogram covers those silently. The
  same lookup path runs in the batch-add and in the lifespan backfill.
- **Eager universe seed.** Opening Add Companies must not trigger 153
  external calls; the seed file ships the mapping. `seed_logos.py` is
  one-shot, re-run when the roster changes.
- **Single chokepoint.** Both `Glyph` and `MonoGlyph` swap the same
  way (img-on-success, monogram-on-error) — adding new screens later
  needs no new fallback logic.

**Verification done**
- Backend: `python -c "from ao.main import app"` — 49 routes (was 46).
- Frontend: `npm run build` → tsc clean, 111 modules transformed (was
  107), 63.26 KB CSS gz 11.87 KB. No new bundle.
- In-process ASGI smoke (`AsyncClient` against `app`):
  - `GET /api/v1/universe` → 163 rows, 153 carry `logoUrl`; `AAPL` row
    returns
    `https://static2.finnhub.io/file/publicdatany/finnhubimage/stock_logo/AAPL.png`.
  - `POST /api/v1/companies/batch {tickers:["AAPL"]}` returns the new
    row with `logoUrl` populated; SSE `company.updated` fires.
- `ensure_schema()` ran successfully — `PRAGMA table_info(companies)`
  on the live SQLite shows `logo_url` in the column list.

**Files touched**
- `workers/ao/db/models.py` — `Company.logo_url`.
- `workers/ao/db/engine.py` — `_COLUMN_MIGRATIONS` row.
- `workers/ao/api/schemas.py` — `Company.logoUrl`, `UniverseCompany.logoUrl`.
- `workers/ao/api/serializers.py` — emit `logoUrl`.
- `workers/ao/integrations/finnhub_client.py` — `company_profile()`.
- `workers/ao/api/routes_companies.py` — fetch profile2 in batch-add.
- `workers/ao/api/routes_universe.py` — emit `logoUrl` from
  `LOGO_BY_TICKER`.
- `workers/ao/data/sp500_logos.py` (new).
- `workers/scripts/seed_logos.py` (new).
- `workers/ao/main.py` — `_backfill_missing_logos` task in lifespan.
- `web/src/components/primitives.tsx` — `Glyph` renders img + fallback.
- `web/src/screens/AddCompanies.tsx` — `MonoGlyph` renders img +
  fallback; threaded `logoUrl` at both call sites.
- `web/src/types.ts` — `Company.logoUrl`, `UniverseCompany.logoUrl`.
- `web/src/screens/{Watchlist,Companies,Company,Review,Timeline}.tsx`
  — threaded `logoUrl` through to `Glyph`.
- `web/src/styles/app.css` — `.glyph img`, `.ac-glyph img`.
- `web/src/layout/AppShell.tsx` — pass `{ticker,logoUrl}[]` to
  `AgentRun.start`.
- `web/public/agent-run/examiner.js` — widened `start()` signature,
  `logoByTicker` map, `<img>` in brand subtitle + background-rail pills.
- `web/public/agent-run/examiner.css` — `.rc-sub-logo`, `.rc-bg-logo`.

**Next step**
Visual QA in the browser:
1. `/` Watchlist — every card glyph is a real logo; brokenness gracefully
   falls back to the 2-letter monogram for any non-Finnhub ticker (e.g.
   T, F, V, MO).
2. `/companies` (active + ARCHIVED panel) — same.
3. `/company/NVDA` (or AAPL) — deep-dive header shows the real logo.
4. `/timeline` — desktop Gantt lanes + mobile agenda cards both show
   logos.
5. `/companies` → ADD COMPANIES — every tile in the browse grid shows
   a real logo (10 SP500 tickers are missing and stay as monograms).
6. RUN ALL AGENTS — examiner brand subtitle gains the per-ticker logo,
   background-rail pills each show a tiny logo on the left.

Note: a one-row AAPL company exists in the local DB from the in-process
batch-add smoke test. Either archive it from `/companies` or use the
Settings → FIRST-TIME EXPERIENCE wipe if you want a clean watchlist
again.

---

## Increment — Spread demo confidence scores + put SNOW into review

**Problem (user-reported):** COST, DIS, SNOW all landed in the 60–70%
band on the watchlist and none of them needed validation. The demo set
was meant to show HIGH / MEDIUM / LOW with SNOW landing in the review
queue.

**Root cause:** the extraction prompt was hardcoded to pull GAAP-only
EPS ("EPS · diluted — diluted earnings per share, GAAP"). SNOW's
non-GAAP +$0.39 vs its GAAP −$0.90 sign-flip therefore never reached
validation, so `validation_conflict` never fired, no review row was
created, and the confidence agent saw near-identical inputs for all
three.

**Design choice (confirmed with user via AskUserQuestion):**
- Conflict rule: sign-flip OR >50% magnitude gap. Routine same-sign
  adjusted gaps (DIS at $1.34 / $1.63) are NOT conflicts; the sign-flip
  (SNOW) IS.
- Spread: match PROGRESS targets — COST ~80%, DIS ~55%, SNOW ~30%.
  Achieved by surfacing the `eps_gap` magnitude into the confidence
  agent's inputs and giving the prompt explicit target bands per case.

**What landed**
- **Extraction prompt** (`workers/ao/agents/prompts.py`,
  `PROMPT_VERSION_EXTRACTION v1→v2`): for EPS metrics, extract BOTH
  the GAAP figure (income statement) AND any adjusted / non-GAAP
  figure (reconciliation, MD&A, press-release exhibit) when present;
  tag each location's `source_label` to make the distinction explicit
  ("Income statement (GAAP)" vs "Non-GAAP reconciliation" /
  "Adjusted EPS · MD&A"). GAAP-only filings still extract just the
  GAAP value.
- **Validation prompt** (`PROMPT_VERSION_VALIDATION v2→v3`): GAAP vs
  non-GAAP EPS only conflicts on opposite signs OR magnitude >50% of
  |GAAP|. Routine same-sign gaps record at `conf="med"` with no
  conflict flag.
- **Result columns** (`workers/ao/db/models.py`, `db/engine.py`): new
  `eps_gaap_value`, `eps_non_gaap_value`, `eps_sign_flip` columns on
  `results`. Added to `_COLUMN_MIGRATIONS` so existing DBs self-heal
  on next startup.
- **Pipeline** (`workers/ao/agents/pipeline.py`): new
  `_classify_eps_label()` + `_eps_gap()` helpers derive the
  GAAP/non-GAAP pair from extracted locations (tag-based, with a
  fallback that treats untagged labels as GAAP). The triple is
  persisted on the Result row alongside the validation outcome.
- **Confidence** (`workers/ao/agents/confidence.py`,
  `PROMPT_VERSION_CONFIDENCE v1→v2`): `_agreement_stats` now includes
  an `eps_gap` dict (`{gaap_value, non_gaap_value, pct_diff,
  sign_flip}` — null when the latest filing is GAAP-only). The
  CONFIDENCE_SYSTEM prompt has explicit target bands:
    - `eps_gap=null` → target ≥75%
    - `sign_flip=true` → target 20-40%
    - `sign_flip=false, pct_diff>50` → target 35-55%
    - `sign_flip=false, pct_diff≤50` → target 45-65%
  The LLM still weighs the other three factors; the EPS-gap target is
  the dominant lever.

**Verification done**
- `python -c "from ao.main import app"` → 49 routes (unchanged).
- `npm run build` (web) → tsc clean, 111 modules, 63.26 KB CSS.
- `ensure_schema()` ALTER added `eps_gaap_value`, `eps_non_gaap_value`,
  `eps_sign_flip` (REAL / REAL / INTEGER) to `results` on the live
  SQLite.
- `_eps_gap()` unit smoke:
  - COST-like (single GAAP location) → `(4.93, None, False)`
  - DIS-like (GAAP $1.34 + adjusted $1.63) → `(1.34, 1.63, False)`
  - SNOW-like (GAAP −$0.90 + non-GAAP +$0.39) → `(-0.9, 0.39, True)`
  - Legacy untagged → first location treated as GAAP; no gap.
- `_classify_eps_label`: GAAP / non-GAAP / adjusted / unknown all
  classified correctly.

**Decisions baked in**
- Source-label tagging (not a separate metric key) for non-GAAP. The
  validator already sees both values under "EPS · diluted" so the
  conflict path it already had still fires.
- The 50% threshold + sign-flip are the only conflict triggers; the
  validation prompt is explicit so the LLM stays deterministic.
- The eps_gap fields are deterministic (computed in `pipeline.py`);
  the confidence LLM only weighs and explains.
- Did NOT add a deterministic floor/cap on `overall_pct` — the prompt
  target bands carry the spread. Revisit if real-run scores drift.

**Files touched**
- `workers/ao/agents/prompts.py` — EXTRACTION_SYSTEM (v2),
  `validation_system()` (v3), CONFIDENCE_SYSTEM (v2).
- `workers/ao/agents/pipeline.py` — `_classify_eps_label` +
  `_eps_gap` helpers, eps_gap fields on the new Result row.
- `workers/ao/agents/confidence.py` — eps_gap in `_agreement_stats`.
- `workers/ao/db/models.py` — three new columns on `Result`.
- `workers/ao/db/engine.py` — `_COLUMN_MIGRATIONS` entries.

**Next step**
Live test with an Anthropic key configured:
1. `/settings` → wipe. Add COST / DIS / SNOW via Add Companies.
2. RUN ALL AGENTS → wait ~3 min for the three pipelines.
3. Verify:
   - COST card: green ring ~75-90%, no review row.
   - DIS card: amber ring ~45-65%, no review row; deep-dive
     provenance shows both the GAAP and the adjusted EPS rows.
   - SNOW card: red ring ~20-40%, status `review`; `/review`
     shows a row with GAAP −$0.90 vs non-GAAP +$0.39 candidates.

---

## Increment — Persistent universe cache + mirrored logos

**Problem:** Add Companies took a long time to load — 163 rows + 153
logo image fetches from `static.finnhub.io` on every cold visit. React
Query's in-memory cache also evaporates on browser reload.

**What landed**
1. **localStorage cache of `/universe`** (`web/src/hooks.ts`). The
   `useUniverse` hook now reads `ao-universe-cache-v1` from
   localStorage as React Query `initialData` (with
   `initialDataUpdatedAt`). The grid renders synchronously from the
   cache; the network request continues in the background and
   overwrites the cache on success. Survives both browser reload AND
   server restart since the cache lives in the browser.
2. **Mirrored 153 SP500 logos into the repo at
   `web/public/logos/<TICKER>.png`** via
   `workers/scripts/mirror_logos.py`. The script downloads every URL
   in `LOGO_BY_TICKER`, then rewrites `ao/data/sp500_logos.py` so each
   ticker maps to `/logos/<TICKER>.png`. 5.4 MB total on disk, largest
   is SBUX at 111 KB. Idempotent — re-runs only fetch missing files;
   `--force` re-downloads everything.
3. **Serializer prefers the mirror over the stored Finnhub URL**
   (`workers/ao/api/serializers.py`). `logoUrl` is now
   `LOGO_BY_TICKER.get(c.ticker) or c.logo_url` — even pre-existing
   tracked rows (e.g. the AAPL one from the earlier smoke test) load
   logos from `/logos/` instead of `static.finnhub.io`.

**Decisions baked in**
- PNGs committed to the repo (per user ask). The repo grows by ~5.4 MB.
- One-shot mirror script — not part of `npm run build` or app startup.
  Re-run sequence: `python -m scripts.seed_logos` (refresh Finnhub
  URLs) → `python -m scripts.mirror_logos` (download new ones).
- Mirror wins over DB. Non-SP500 tickers a user adds keep their
  external Finnhub URL via `Company.logo_url` as a fallback.
- localStorage key versioned (`-v1`) so future schema bumps can
  invalidate cleanly.

**Verification done**
- ASGI smoke: `GET /api/v1/universe` → AAPL row carries
  `logoUrl=/logos/AAPL.png`; `GET /api/v1/companies` → tracked AAPL
  ALSO reports `/logos/AAPL.png` (mirror override applied).
- `npm run build` → tsc clean, 111 modules transformed.
- `ls web/public/logos/ | wc -l` → 153.

**Files touched**
- `workers/scripts/mirror_logos.py` (new).
- `workers/ao/data/sp500_logos.py` — values rewritten from Finnhub
  URLs to `/logos/<TICKER>.png`.
- `workers/ao/api/serializers.py` — mirror lookup wins over DB
  `logo_url`.
- `web/src/hooks.ts` — `useUniverse` reads/writes localStorage.
- `web/public/logos/*.png` (new — 153 files, ~5.4 MB).

**Next step**
Visual QA in the browser:
1. Open `/companies` → ADD COMPANIES. DevTools Network tab should show
   logos loading from `localhost:5173/logos/*.png` (Vite static
   handler) instead of `static.finnhub.io`.
2. Reload the page — universe payload comes from localStorage (no
   spinner before the grid renders); a background `/universe` call
   updates the cache.
3. Restart `ao-api` → reload — same instant-render experience.
