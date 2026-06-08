# PROGRESS — Agent Orange

## Goal
Recreate the `design/` prototype as a real production UI in `web/` (Vite + React
18 + TS), pixel-faithful, then commit + push to `paul-raelta/agent_orange`.

## Current state — UI build complete, building cleanly
- `web/` scaffolded: Vite + React 18 + TS, React Router, TanStack Query, ThemeProvider.
- All seven screens ported pixel-faithfully from the prototype:
  Watchlist, Company deep-dive (+ provenance drawer), Timeline, Review, Companies
  (+ add/discovery flow), Activity, Settings.
- CSS ported verbatim into `src/styles/{tokens,app}.css` (device-frame / desktop-
  mobile toggle dropped — prototype-only; layout is responsive via the 700px
  container query).
- Data contract typed in `src/types.ts`; fixture in `src/data.ts`; the data seam
  is `src/api.ts` (resolves fixture today, swap to workers/ API later) consumed via
  React Query hooks in `src/hooks.ts`.
- `npm run build` passes (tsc + vite, 101 modules). Preview serves 200.

## Key decisions
- **Single tsconfig** (no project references) — composite + noEmit conflict under
  `tsc -b`; simpler to include `src` + `vite.config.ts` in one config with `tsc`.
- **Outlet context** carries run-all `running`/`lastSync` at shell level so it
  persists across navigation (mirrors the prototype's App-level state).
- **Handoff doc preserved**: original root `README.md` moved to `design/HANDOFF.md`;
  new root `README.md` is the repo overview per §4.
- **Tweaks panel** kept as an optional in-app theme switcher (⚙ bottom-right),
  rebuilt from the app's own design system instead of the prototype's host-protocol
  glass panel.

## Next step
Commit everything and push to `origin` (git@github-paulraelta:paul-raelta/agent_orange.git)
using SSH key `~/.ssh/id_ed25519_paul-raelta`. workers/ remains a stub (README only).
