.PHONY: setup seed dev api daemon web test test-e2e build clean

# One-time setup: Python venv + npm install
setup:
	cd workers && python3.12 -m venv .venv && .venv/bin/pip install --upgrade pip
	cd workers && .venv/bin/pip install -e ".[dev]"
	cd web && npm install

# Reset + seed the DB
seed:
	cd workers && .venv/bin/python -m ao.db.seed

# Run the API only (foreground). Bound to 0.0.0.0 so LAN devices can hit it.
api:
	cd workers && .venv/bin/uvicorn ao.main:app --host 0.0.0.0 --port 8000 --reload

# Run the scheduler daemon only (foreground)
daemon:
	cd workers && .venv/bin/python -m ao.daemon

# Run the UI dev server only (foreground). Vite binds to 0.0.0.0 via
# vite.config.ts and prints both Local + Network URLs on startup.
web:
	cd web && npm run dev

# Bring up everything via overmind (requires `brew install overmind` or `tmuxinator`).
dev:
	overmind start -f Procfile.dev

# Tests + type-check
test:
	cd workers && .venv/bin/pytest -q
	cd web && npm run build

build:
	cd web && npm run build

# Run the headless-browser smoke suite (Playwright auto-starts api+daemon+web)
test-e2e:
	npm run test:e2e

clean:
	rm -rf workers/.venv workers/var/ao.db* workers/var/ao.test.db* web/node_modules web/dist
