# Quickstart — running Agent Orange locally

The whole thing is three processes: the **API** (FastAPI on :8000), the
**UI** (Vite on :5173), and the **scheduler daemon** (APScheduler — optional;
needed for automatic polling). All three run from the repo root.

## One-time setup

```bash
cd ~/agent_orange       # or wherever you cloned it
make setup              # creates workers/.venv, installs Python + npm deps
make seed               # populates the local DB with NVDA + SNDK + MU
```

Add your secrets to `workers/.env` (gitignored — never committed). The file
is created from `.env.example`; the values you need:

| Variable | What for | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | LLM stages (extract / validate / narrative) | console.anthropic.com → API Keys |
| `FINNHUB_API_KEY` | Live prices, news, insider tx | finnhub.io → free tier |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Email notifications | myaccount.google.com/apppasswords |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | SMS notifications | console.twilio.com |
| `USER_EMAIL` / `USER_PHONE` | Recipient of notifications | yours |

Without `ANTHROPIC_API_KEY` the rest of the system still runs — the LLM
stages just log "anthropic.not_configured" and skip.

## Running it

### Option A — three terminals (simplest)

```bash
make api        # terminal 1 — API on http://localhost:8000
make web        # terminal 2 — UI on http://localhost:5173
make daemon     # terminal 3 — scheduler (only when you want auto-polling)
```

Open <http://localhost:5173>.

### Option B — one command (overmind)

```bash
brew install overmind    # one-time
make dev                 # api + daemon + web all together
```

Ctrl-C kills all three.

### Verifying it's up

- API healthz: `curl http://localhost:8000/healthz` → `{"status":"ok"}`
- API docs: <http://localhost:8000/docs> (interactive Swagger UI)
- UI: <http://localhost:5173> — Watchlist loads with NVDA / SNDK / MU cards

## Triggering pipeline runs

The scheduler does this automatically when running, but you can also trigger
runs from the UI or CLI.

### From the UI

- **Watchlist** → **RUN ALL AGENTS** button (top right) — kicks the full
  pipeline for every tracked company. Status icon spins; lastSync updates.
- Per-company: open the deep-dive, future "RUN" button there (next iteration).

### From the CLI

```bash
cd workers
.venv/bin/ao run NVDA         # full pipeline: monitor → extract → validate → narrative → notify
.venv/bin/ao poll NVDA        # monitoring only — checks EDGAR for new filings
.venv/bin/ao discover AMD     # discovery only — CIK + IR site + cadence inference
.venv/bin/ao seed             # reset + reseed everything
.venv/bin/ao seed NVDA        # just one ticker
```

### What polls happen on the scheduler

When `make daemon` is running:

| Job | Cadence | What it does |
|---|---|---|
| `poll-<TICKER>` | Daily 06:00 UTC (one per company) | Checks EDGAR for new 10-Q/10-K/8-K; if new → downloads + extracts + validates + narrates + notifies |
| `refresh-prices` | Every 5 minutes during US market hours (13:30–20:00 UTC weekdays) | Pulls Finnhub `/quote` for every company → updates portfolio value |
| `refresh-news-insider` | Every 30 minutes | Pulls last 30 days of news + Form 4 insider transactions |
| `recompute-windows` | Daily 00:05 UTC | Recomputes each company's predicted next-filing window from history |

## Smoke testing individual integrations

```bash
cd workers
.venv/bin/ao finnhub-test NVDA   # live quote + 3 recent news + 3 insider tx
.venv/bin/ao edgar-test 1045810  # SEC EDGAR submissions for NVDA's CIK
.venv/bin/ao ir-test https://investor.nvidia.com   # IR-site reachability + PDF links
.venv/bin/ao notify-test email   # sends a real test email
.venv/bin/ao notify-test sms     # sends a real test SMS
```

Each command prints the live response. If a key is missing the command tells
you which env var to set.

## Typical user flows

### "Did anything new file overnight?"

```bash
.venv/bin/ao poll NVDA    # one-shot manual check
# or just leave `make daemon` running and check the UI
```

The Activity screen (`/activity` in the UI) shows every agent run — successful
polls log as INFO, new-filing detections as OK, conflicts as WARN.

### "I bought 100 more NVDA at $185 — update my position"

Open the NVDA deep-dive (`/company/NVDA`) → the portfolio editor row under
the header → change SHARES + COST BASIS / SHARE → SAVE. The Watchlist
portfolio strip updates immediately.

### "I want to add a new ticker"

`/companies` → **ADD COMPANY** → type ticker → DISCOVER SOURCES → confirm.
The agent looks up the CIK on SEC EDGAR and infers cadence from the last 8
filings. (The full LLM-driven discovery agent comes online when
`ANTHROPIC_API_KEY` is set.)

### "Something needs my review"

When validation finds a conflict (e.g. GAAP vs non-GAAP EPS, like the
seeded SanDisk case), a Review Queue badge appears on the sidebar. Click
**Review** → pick one of the candidate values → USE $X.XX, or REJECT.

### "Stop the scheduler"

If you're running via `make daemon`, just Ctrl-C the terminal.
If via `make dev` (overmind), Ctrl-C kills all three processes.
APScheduler jobs are persisted in SQLite, so they don't lose state between
restarts.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| UI shows "Loading…" forever | API isn't running | `make api`; check :8000/healthz |
| `RUN ALL AGENTS` does nothing visible | Scheduler not running | `make daemon` for auto-polling, or `ao run NVDA` for one-shot |
| LLM stages skipped | `ANTHROPIC_API_KEY` not set | Add to `workers/.env` |
| Email test fails with `5.7.8 BadCredentials` | 2-Step Verification not enabled on Gmail account, or wrong App Password | Enable 2SV; regenerate App Password |
| SMS test fails | Twilio trial account needs verified recipient | Verify your phone in Twilio Console |
| `database is locked` | Concurrent writes from API + daemon (rare) | The 5s busy timeout absorbs this; retry the operation |
| Vite says "address in use" | UI already running | `lsof -i :5173` to find PID |

## Where everything lives

- DB: `workers/var/ao.db` (SQLite — delete to reset)
- Filing cache: `workers/var/cache/` (downloaded PDFs / HTML)
- Logs: stdout of whichever process produced them; structlog formats them
- Secrets: `workers/.env` (gitignored)
- UI build: `web/dist/` (only after `npm run build`)
