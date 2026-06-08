# Agent Orange

AI agents that fetch, validate, and monitor public-company quarterly/annual
results — with full provenance on every number. An investor keeps a watchlist;
one agent per company knows where that company's results live (SEC EDGAR +
the IR site), polls for new filings on an unpredictable schedule, extracts
the key figures, cross-references each one for confidence, and routes
anything it can't auto-validate to a human review queue.

The full product brief — screen specs, data contract, design tokens — lives
in [`design/HANDOFF.md`](design/HANDOFF.md).

## Layout

```
agent_orange/
  design/       HTML/React prototype + HANDOFF.md (the original brief)
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

- **API**: 20 endpoints serving the wire contract from `web/src/types.ts`,
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
