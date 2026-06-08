.PHONY: setup seed dev api daemon web test build clean

# One-time setup: Python venv + npm install
setup:
	cd workers && python3.12 -m venv .venv && .venv/bin/pip install --upgrade pip
	cd workers && .venv/bin/pip install -e ".[dev]"
	cd web && npm install

# Reset + seed the DB
seed:
	cd workers && .venv/bin/python -m ao.db.seed

# Run the API only (foreground)
api:
	cd workers && .venv/bin/uvicorn ao.main:app --port 8000 --reload

# Run the scheduler daemon only (foreground)
daemon:
	cd workers && .venv/bin/python -m ao.daemon

# Run the UI dev server only (foreground)
web:
	cd web && VITE_API_BASE=http://localhost:8000/api/v1 npm run dev

# Bring up everything via overmind (requires `brew install overmind` or `tmuxinator`).
dev:
	overmind start -f Procfile.dev

# Tests + type-check
test:
	cd workers && .venv/bin/pytest -q
	cd web && npm run build

build:
	cd web && npm run build

clean:
	rm -rf workers/.venv workers/var/ao.db* web/node_modules web/dist
