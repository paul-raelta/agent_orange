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
