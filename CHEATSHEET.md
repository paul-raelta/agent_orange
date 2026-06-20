# Agent Orange — dev cheat sheet

All commands run from the repo root (`/Users/paulmcevoy/agent_orange`) unless noted.

## One-time setup

```
brew install overmind tmux
```

(Python venv for the API: see `QUICKSTART.md` if `workers/.venv` doesn't exist.)

## Start everything

```
make dev
```

Runs three processes via `Procfile.dev`:
- `api`    — FastAPI on http://localhost:8000
- `daemon` — background worker
- `web`    — Vite dev server on http://localhost:5173

Open the UI at **http://localhost:5173**.

## Stop everything

`Ctrl-C` in the terminal running `make dev` — stops all three cleanly.

From another terminal:
```
overmind quit
```

## While it's running (second terminal)

| Command                  | What it does                                    |
| ------------------------ | ----------------------------------------------- |
| `overmind connect web`   | Attach to one process's logs (`Ctrl-b d` exits) |
| `overmind connect api`   | Same, for the API                               |
| `overmind restart web`   | Restart one process, leave the others alone     |
| `overmind ps`            | List running processes                          |

## Just the front-end (no API)

```
cd web && npm run dev
```

The Watchlist will stick on **Loading…** because `/companies` 404s — fine for
CSS/JS work that doesn't depend on data, not enough to click **RUN ALL AGENTS**.

## Just the API

```
cd workers && .venv/bin/uvicorn ao.main:app --host 0.0.0.0 --port 8000 --reload
```

## URLs

- UI:           http://localhost:5173
- API:          http://localhost:8000/api/v1
- API docs:     http://localhost:8000/docs
