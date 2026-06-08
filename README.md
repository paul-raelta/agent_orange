# Agent Orange

AI agents that fetch, validate, and monitor public-company quarterly/annual
results — with full provenance on every number. An investor keeps a watchlist;
one agent per company knows where that company's results live, polls for new
filings on an unpredictable schedule, extracts the key figures, cross-references
each one for confidence, and routes anything it can't auto-validate to a human
review queue.

This repo is the productionized build of a design handoff. The full product
brief — screen specs, data contract, interaction details, design tokens — lives
in [`design/HANDOFF.md`](design/HANDOFF.md).

## Layout

```
agent_orange/
  design/       Design reference: the HTML/React prototype + HANDOFF.md (the brief)
  screenshots/  Rendered captures of every screen
  web/          Production UI — Vite + React 18 + TypeScript (built)
  workers/      Agentic backend — stub for now (see design/HANDOFF.md §12)
```

## web/ — the UI

The production reimplementation of the prototype, pixel-faithful to the design.

- **Vite + React 18 + TypeScript** — replaces the prototype's CDN React + in-browser Babel.
- **React Router** — routes `watchlist` (`/`), `timeline`, `review`, `companies`,
  `activity`, `settings`, plus the `company/:ticker` deep-dive.
- **TanStack Query** — the data layer. `src/hooks.ts` wraps `src/api.ts`, which is
  the single seam that replaces the prototype's `window.AO_DATA` global. Today it
  resolves the in-repo fixture (`src/data.ts`); to go live, point `api.ts` at the
  `workers/` REST API and delete the fixture — components don't change.
- **Token-driven CSS** — `src/styles/tokens.css` holds the design tokens as CSS
  custom properties; nothing hardcodes hex. A `ThemeProvider` rewrites a subset at
  runtime (accent / surface / mono font / density) — the in-app **Tweaks** panel
  (⚙, bottom-right) is the optional theme switcher.
- **Responsive** at a single 700px breakpoint via a container query on the app
  shell (sidebar → bottom tab bar, grids → one column).

```bash
cd web
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to web/dist
npm run preview  # serve the production build
```

## workers/ — the agentic backend

Not built yet — a stub. The intended shape (per-company agents with
discovery → monitoring poll → extraction → validation stages, scheduled polling
that intensifies inside a predicted filing window, SEC EDGAR as the structured
backbone, provider-agnostic model routing) is sketched in
[`design/HANDOFF.md`](design/HANDOFF.md) §12. The UI's data contract (§6) is the
interface it must serve.

## Hosting (planned)

Firebase Hosting (UI) → Cloud Run API (`workers/`) → Firestore, with Cloud
Scheduler driving the polling cadence and Secret Manager holding API keys. See
HANDOFF §13.
