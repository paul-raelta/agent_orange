# Plan: Headless-Browser UI Smoke Suite

## Context

Agent Orange has grown to ~7 main routes and ~8 major features (portfolio, timeline, review queue, company deep-dive, activity log, settings, help assistant, agent runs) with no UI tests of any kind. Recent commits show a steady stream of UI regressions getting caught manually (e.g. "Timeline showing removed companies", "doc scan view fix", "mobile bottom-nav pin on iOS"). We want a Playwright smoke suite that drives the real app in a headless browser and asserts each main feature still works end-to-end, so these break the build instead of needing to be eyeballed.

Decisions already made:
- **Hit real APIs end-to-end.** Tests run against real Anthropic / Finnhub / etc. Real $ per run. The `make api`, `make daemon`, `make web` services all come up.
- **Dedicated test DB per run.** Sets `DATABASE_URL` to a throwaway sqlite path; real `workers/var/ao.db` untouched.
- **Smoke depth — one happy-path spec per feature.** ~9 specs, target < 5 min total wall-clock.
- **Playwright auto-starts api+web+daemon** via `webServer` config; single `npm run test:e2e` command.

## Approach

Playwright is already a dev-dep at the repo root (`package.json`) but unconfigured. Add a `playwright.config.ts` plus a `tests/e2e/` folder with one `*.spec.ts` per feature. The config spawns api+daemon+web with `DATABASE_URL` pointing at `workers/var/ao.test.db` (deleted before each full run), waits for `http://localhost:5173`, then runs specs serially against Chromium. Each spec calls `POST /api/v1/admin/wipe` in `test.beforeEach` so it starts from the demo NVDA seed.

Mobile / responsive checks ride along inside the relevant specs (set viewport in the spec) rather than getting their own file — keeps the file count to one-per-feature.

## Files to add

All paths relative to repo root.

- **`playwright.config.ts`** (root) — base URL `http://localhost:5173`, `testDir: 'tests/e2e'`, `webServer` array launching three commands (api, daemon, web) with `DATABASE_URL=sqlite+aiosqlite:///./var/ao.test.db` exported, `reuseExistingServer: !process.env.CI`, single worker (DB wipe between tests needs serial), Chromium only for v1.
- **`tests/e2e/_setup.ts`** — shared helpers: `wipeDb(request)` calling `POST /api/v1/admin/wipe`, `addCompany(request, ticker)` calling the batch endpoint as a fast fixture for specs that need a non-NVDA company without UI driving the discovery flow.
- **`tests/e2e/01-navigation.spec.ts`** — load `/`, click each top-nav link (Watchlist → Timeline → Review → Companies → Activity → Settings), assert URL + a unique element per page. Also mobile viewport pass to confirm bottom-nav is reachable and `position: fixed` works (regression guard for the iOS Safari bug in commit `4a6b1f5`).
- **`tests/e2e/02-companies-add-remove.spec.ts`** — go to `/companies`, open Add flow, search for a known S&P 500 ticker (e.g. `AAPL`), confirm, wait for it to appear in the table. Then archive it → assert it leaves the active list and shows in archived view. Restore → asserts. Permanently delete → asserts gone (regression guard for commit `3379971`).
- **`tests/e2e/03-portfolio-edit.spec.ts`** — open `/company/NVDA`, edit shares + cost basis, save, reload, assert values persist. Assert portfolio totals strip in `AppShell` updates.
- **`tests/e2e/04-timeline.spec.ts`** — visit `/timeline`, assert seeded NVDA card renders. Archive NVDA via API, reload timeline, assert NVDA no longer present (the specific regression in `3379971`). Restore. Mobile-viewport pass: assert the vertical agenda layout renders.
- **`tests/e2e/05-review-queue.spec.ts`** — `/review` lists at least one demo review item (post-wipe seeds these). Pick the first candidate value, submit, assert item leaves the queue (SSE-driven removal — give it up to 5s).
- **`tests/e2e/06-settings-flags.spec.ts`** — go to `/settings`, toggle the `consensus` LABS flag on, visit a company deep-dive, assert consensus column / badge appears in DOM. Toggle off, assert it disappears.
- **`tests/e2e/07-activity-log.spec.ts`** — `/activity` renders without error, lists at least one run entry after triggering one via `POST /api/v1/companies/NVDA/run`. Filter by ticker `NVDA`, assert filtered list non-empty.
- **`tests/e2e/08-help-assistant.spec.ts`** — on any page, open the floating help launcher, type a question ("How do I add a company?"), submit, assert a streamed answer appears within 30s. Assert open/closed state persists across reload (localStorage `ao-help-open`).
- **`tests/e2e/09-run-all-agents.spec.ts`** — click RUN ALL AGENTS from `/`, assert button enters running state and a new entry shows up in `/activity` within a generous timeout (60s). Does **not** wait for full pipeline completion — just confirms the button → daemon → activity log wiring is alive. Real LLM cost: ~one short Haiku call per company in seed.
- **`package.json`** (root) — add `"test:e2e": "playwright test"` script and `@playwright/test` dev-dep (currently only the lower-level `playwright` package is installed).
- **`Makefile`** — add a `test-e2e:` target running `npm run test:e2e` and add a `clean` line to drop `workers/var/ao.test.db*`.
- **`.gitignore`** — add `workers/var/ao.test.db*`, `test-results/`, `playwright-report/`, `.playwright/`.

## Reusable bits to lean on

- `POST /api/v1/admin/wipe` (`workers/ao/api/routes_admin.py`) — per-test reset, already wipes and reseeds demo state.
- `POST /api/v1/companies/batch` (`workers/ao/api/routes_companies.py`) — fast non-UI company seeding from `_setup.ts`.
- `DATABASE_URL` env (`workers/ao/config.py:42`) — already swappable, no code change needed to point at a test DB.
- Existing `Procfile.dev` lines — copy verbatim into Playwright `webServer.command` strings, just prefix with the DB override.

## Out of scope (v1)

- Cross-browser (Firefox/WebKit) — Chromium only for now. Trivial to add later.
- Component unit tests (Vitest, RTL) — separate effort.
- CI wiring (.github/workflows) — leave for a follow-up so the user can validate locally first.
- Per-feature edge-case coverage (empty states, error toasts, flag-gated variants beyond consensus, doc-scan path) — these belong in the comprehensive tier, not smoke.
- Mocked / offline mode — explicitly chosen against; real APIs only.

## Verification

1. `make setup` already done.
2. `npm install` at repo root to pick up `@playwright/test`.
3. `npx playwright install chromium` (one-time browser binary).
4. Ensure `workers/.env` has live Anthropic + Finnhub keys.
5. `npm run test:e2e` — Playwright auto-starts api+daemon+web on a test DB, runs all 9 specs serially, reports pass/fail.
6. `npx playwright show-report` to inspect any failure with screenshots + traces.
7. Manually break one feature (e.g. comment out the archive filter in `Timeline.tsx`) and confirm `04-timeline.spec.ts` fails — proves the suite actually catches regressions.
