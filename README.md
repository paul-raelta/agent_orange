# Agent Orange

AI agents that fetch, validate, and monitor public-company quarterly/annual
results — with full provenance on every number. An investor keeps a watchlist;
one agent per company knows where that company's results live (SEC EDGAR +
the IR site), polls for new filings on an unpredictable schedule, extracts
the key figures, cross-references each one for confidence, and routes
anything it can't auto-validate to a human review queue.

The full product brief — screen specs, data contract, design tokens — lives
in [`design/HANDOFF.md`](design/HANDOFF.md).

## Aim of the app

An automated equity-watchlist agent. You give it tickers; it watches their
filings + market data, extracts the financial figures with provenance back
to the source, flags anything that doesn't reconcile, and tells you what's
worth knowing — so you don't have to read 10-Qs yourself.

### Sources it collects

Per user, per ticker, all toggleable in Settings → Data Sources, with
per-company overrides on the deep-dive:

- **SEC EDGAR** — submissions feed, 10-Q / 10-K / 8-K / Form 4 detection
- **Finnhub quote** — live price, refreshed every 5 min in market hours
- **Finnhub news** — last 30 days of headlines per ticker
- **Finnhub insider** — Form 4 transactions, newest first
- **IR fetcher** — investor-relations page for press releases (per-company
  IR URL set on the deep-dive)
- **User-added custom feeds** — any `https://` URL, fetched through the
  SSRF-guarded `safe_fetch` middle-path (DNS pre-resolve, private-IP block,
  10s timeout, 5 MB cap, ≤3 redirects each re-validated)
- **Suggest-a-source** — wishlist table users can post into

Each source can be toggled globally in Settings or overridden per-ticker on
the deep-dive (e.g. disable IR fetcher for NVDA only). Per-company
overrides are stored in a sparse `company_source_overrides` table —
absence of a row means "inherit the global flag".

### What it gives back

After the agents run:

1. **Watchlist portfolio strip** — total value, cost basis, unrealized P&L
   across your holdings
2. **Per-ticker deep-dive** — extracted GAAP figures with provenance back
   to the filing, live quote, 30-day news, insider tx
3. **AI narrative card** — 2–3 sentence "what's worth knowing" (≤200 tokens,
   gated on `ANTHROPIC_API_KEY`)
4. **Review queue** — anything that doesn't reconcile. Canonical case:
   SanDisk GAAP diluted EPS $0.79 on the schedule vs adjusted $0.82 in the
   press release → routed to REVIEW instead of silently picking one
5. **Notifications** — SMS (Twilio, live) + email (Gmail SMTP, needs app
   password), per-event opt-in
6. **Live UI updates** — SSE pushes `company.updated` / `review.added` so
   the screen reflects pipeline progress without refresh
7. **RUN ALL AGENTS overlay** — the full-screen Document Examiner playing
   each watchlisted ticker as a chapter (DISCOVER → FETCH → PARSE → EXTRACT
   → CROSS-CHECK → VALIDATE), cumulative counters, and a final summary like
   `2 validated, 1 routed to REVIEW (SNDK)`
8. **Watchlist hygiene** — ARCHIVE a ticker from its deep-dive (it stops
   being polled / refreshed / included in RUN ALL); RESTORE from
   `/companies → ARCHIVED`; PERMANENTLY DELETE (double-confirmed)
   cascades the full per-ticker history — filings, metrics, provenance,
   prices, news, insider, agent runs, sources, review items

Short version: **collect filings + quotes + news + insider tx → extract
figures with provenance → reconcile, route conflicts to a human review
queue, surface a short narrative + notifications.**

## Demo

A ~86-second product walkthrough (autoplay + captions + simulated cursor)
lives at [`docs/index.html`](docs/index.html) and is the publishable file —
served as **<https://paul-raelta.github.io/agent_orange/>** once GitHub
Pages is enabled (Settings → Pages → Branch: `main`, Folder: `/docs`). The
editable source is in [`design/demo/`](design/demo/); see that folder's
[README](design/demo/README.md) for the bundle layout and re-bundle
instructions.

## Layout

```
agent_orange/
  design/       HTML/React prototype + HANDOFF.md (the original brief) + demo/ bundle
  docs/         GitHub-Pages-published demo (single self-contained index.html)
  screenshots/  Rendered captures of every screen
  web/          Production UI — Vite + React 18 + TypeScript
  workers/      Agentic backend — Python + FastAPI + SQLite + APScheduler
  Makefile      One-line targets: setup, seed, dev, api, daemon, web, test, build
  Procfile.dev  3-process dev runtime (api + scheduler + web) for overmind
```

## Quick start

```bash
make setup           # creates workers/.venv, installs Python + npm deps
make seed            # populates workers/var/ao.db with NVDA + SNDK + MU
make api             # API at http://localhost:8000  (one terminal)
make web             # UI at http://localhost:5173   (another terminal)
make daemon          # scheduler — polls EDGAR + Finnhub on cadence (optional)
```

Or run all three together with [overmind](https://github.com/DarthSim/overmind):
```bash
brew install overmind
make dev
```

Then open <http://localhost:5173>.

## web/ — the UI

Pixel-faithful reimplementation of the prototype.

- **Vite + React 18 + TypeScript**, React Router, TanStack Query
- **Token-driven CSS** — `src/styles/tokens.css` + a ThemeProvider rewriting
  CSS variables (accent / surface / mono / density). The optional Tweaks
  panel (⚙ bottom-right) is the in-app theme switcher
- **Responsive** at a 700px container-query breakpoint
- **Live updates** via SSE on `/api/v1/events` — Watchlist + Review queue
  refresh without a page reload as the backend processes filings
- All seven screens ported plus new portfolio strip (Watchlist), AI narrative
  card + portfolio editor + NEWS / INSIDER tabs + PLANNED future-feature
  tiles (Company deep-dive), NOTIFICATIONS panel (Settings)

## workers/ — the agentic backend

Python 3.12 + FastAPI + SQLite + SQLAlchemy 2.x async + APScheduler.

- **API**: 41 endpoints serving the wire contract from `web/src/types.ts`,
  with the serializer layer in `ao/api/serializers.py` as the contract gate
- **Integrations**: SEC EDGAR (filing detection + download), Finnhub
  (quotes / news / Form 4 insider tx), Anthropic SDK (Opus + tool use for
  extraction, validation, narrative), Gmail SMTP, Twilio SMS
- **Agent pipeline**: monitor → download → extract → validate → narrative →
  notify. Idempotent per `(filing_id, stage)`. LLM stages gracefully no-op
  when `ANTHROPIC_API_KEY` isn't set
- **Scheduler**: APScheduler running poll_company (per ticker, daily 06:00
  UTC), refresh_prices (5 min during US market hours), refresh_news_insider
  (30 min), recompute_windows (daily). Portable — same code runs locally
  now and on Cloud Run later via `AO_SCHEDULER_MODE=external`
- **Notifications**: UI (SSE), email (Gmail SMTP), SMS (Twilio). Per-event
  opt-in via the Settings → NOTIFICATIONS panel

See [`workers/README.md`](workers/README.md) for the full CLI surface and a
status matrix of what's wired vs. what needs API keys.

## Hosting (planned)

Firebase Hosting (UI) → Cloud Run (workers API + scheduler service) → Cloud
SQL Postgres, with Cloud Scheduler driving the polling cadence and Secret
Manager holding API keys. See HANDOFF §13. The migration is config-only:
swap `DATABASE_URL`, set `AO_SCHEDULER_MODE=external`, point `VITE_API_BASE`
at the Cloud Run URL.
