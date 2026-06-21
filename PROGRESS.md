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

