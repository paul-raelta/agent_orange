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
