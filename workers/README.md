# workers/ — Agentic backend

Python + FastAPI + SQLite. The agentic backend that produces the data the
`web/` UI consumes. Serves the data contract from
[`../design/HANDOFF.md`](../design/HANDOFF.md) §6 verbatim.

## Quick start

```bash
# from repo root
make setup       # creates workers/.venv, installs deps, npm install
make seed        # populates workers/var/ao.db with NVDA + SNDK + MU fixture
make api         # uvicorn on :8000
# in another shell
make web         # vite on :5173 — opens automatically
# in another shell (optional — runs the scheduler)
make daemon
```

Or all three at once via overmind:
```bash
brew install overmind   # one-time
make dev                # api + daemon + web together
```

Open <http://localhost:5173>. The UI hits the API on :8000.

## What's wired

| Stage | Status | Notes |
| --- | --- | --- |
| API surface (41 endpoints) | ✅ live | All routes from plan §3 + data-sources + archive |
| Serializers (wire contract) | ✅ live | Round-trip with `web/src/types.ts` |
| EDGAR client | ✅ live | Submissions JSON + filing download |
| Finnhub client | ✅ live | Quotes + news + insider tx |
| Twilio SMS | ✅ live | Smoke-tested with `ao notify-test sms` |
| Gmail SMTP | 🟡 needs App Password | Set `GMAIL_APP_PASSWORD` in `.env` |
| Monitoring (rule-based) | ✅ live | Detects new 10-Q/10-K/8-K from EDGAR |
| Discovery (deterministic) | ✅ live | Ticker → CIK + IR + cadence |
| Extraction (Opus + tool use) | 🟡 needs `ANTHROPIC_API_KEY` | Otherwise gracefully no-ops |
| Validation (Opus structured) | 🟡 needs `ANTHROPIC_API_KEY` | Otherwise gracefully no-ops |
| Narrative (Opus 2-3 sentences) | 🟡 needs `ANTHROPIC_API_KEY` | Otherwise gracefully no-ops |
| Confidence (Opus structured) | 🟡 needs `ANTHROPIC_API_KEY` | Company-level 0–100 score; runs after narrative + daily. See [`../CONFIDENCE.md`](../CONFIDENCE.md) |
| Notifications dispatcher | ✅ live | UI (SSE) + email + SMS, per-event opt-in |
| Scheduler (APScheduler) | ✅ live | poll/prices/news/windows/backfill/confidence jobs; skips archived |
| Data Sources registry | ✅ live | Built-ins + user-added + suggestions; SSRF-guarded |
| Per-company source overrides | ✅ live | Sparse overrides table; archive/restore/hard-delete |
| Schema self-heal | ✅ live | `ensure_schema()` at API startup adds new columns idempotently |

## CLI

```bash
.venv/bin/ao seed             # reset + reseed everything
.venv/bin/ao seed nvda        # seed one ticker
.venv/bin/ao run nvda         # full pipeline pass for one ticker
.venv/bin/ao poll nvda        # monitoring only — checks EDGAR for new filings
.venv/bin/ao discover AMD     # discovery only — CIK lookup + cadence
.venv/bin/ao extract NVDA path/to/10q.pdf   # extract a local PDF (no DB writes)
.venv/bin/ao notify-test sms  # send a real test SMS via Twilio
.venv/bin/ao notify-test email
.venv/bin/ao finnhub-test NVDA
.venv/bin/ao edgar-test 1045810
.venv/bin/ao ir-test https://investor.nvidia.com
```

## Secrets

Drop credentials into `workers/.env` (gitignored). See `.env.example` for the
full list. The two keys you don't yet have configured:

- `ANTHROPIC_API_KEY` — required for extraction / validation / narrative stages
- `GMAIL_APP_PASSWORD` — required for the email notification channel
  ([generate one](https://myaccount.google.com/apppasswords))

Without them the rest of the system runs; the LLM stages just log
`anthropic.not_configured` and skip cleanly.

## Migration path to Cloud Run

The seams from plan §9 are in place:
- `pydantic_settings.BaseSettings` reads env → swap in Secret Manager bindings.
- SQLAlchemy 2.x async — change `DATABASE_URL` to Cloud SQL Postgres.
- `AO_SCHEDULER_MODE=external` disables APScheduler; Cloud Scheduler hits
  the same `scheduler/jobs.py` functions via `/internal/jobs/*` endpoints.
- `auth seam` — every row already has `user_id`; flip `current_user_id` from
  hardcoded to OAuth-resolved.
