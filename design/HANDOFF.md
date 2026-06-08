# Handoff: Agent Orange — Financial-Results Monitoring UI

> **For Claude Code — start here.**
> This bundle contains a high-fidelity **design reference** (an HTML/React prototype) for "Agent Orange", an app that runs AI agents to fetch, validate, and monitor public-company quarterly/annual results. Your job is **not** to ship the prototype HTML. Your job is to **recreate these designs as a real, production app** in the repo `paul-raelta/agent_orange`, following the architecture below, and then **commit and push** your work.
>
> The prototype lives in `design/`. Open `design/Agent Orange.html` in a browser to see the intended look and behavior (all six screens + the company deep-dive + provenance drawer + the Tweaks panel). Read `design/app/*.jsx` for exact markup, and `design/app/data.js` for the **data contract** (the single most important file — see §6).

---

## 1. Overview
Agent Orange lets an investor maintain a watchlist of companies (owned + watching) and assigns an **agent per company** that:
1. knows *where* that company's results live (its IR site, and SEC EDGAR as a structured backbone — sources differ per company, e.g. NVDA's IR PDF vs. SanDisk's elsewhere),
2. **monitors** for new results on an unpredictable schedule (results for a period ending Jun 30 might appear anytime from late-July to late-September), so this is a *polling* problem, not a one-shot fetch,
3. **extracts** key figures (revenue, net income, EPS basic/diluted, margins, guidance),
4. **validates** each figure by cross-referencing it elsewhere in the filing (e.g. EPS appearing both in the income statement and in a "Net Income Per Share" note), assigning a confidence level, and
5. routes anything it can't confidently auto-validate to a **human review queue**.

The UI surfaces all of this with full **provenance** (every number links back to source URL + page + the exact snippet it was read from), a **timeline** of predicted filing windows, an **activity log**, **token/cost** tracking, and **provider/model routing** (Claude now; GPT/Gemini later).

## 2. About the design files
The files in `design/` are **design references created in HTML/React-via-Babel** — a prototype showing intended look and behavior, **not** production code to copy verbatim. Recreate them in the target stack (§4) using that stack's idioms (real ES modules, a router, a data-fetching layer, a real CSS strategy). Keep the visual result pixel-faithful; replace the prototype's scaffolding (CDN React, in-browser Babel, `window.*` globals, `window.AO_DATA` fixture) with production equivalents.

## 3. Fidelity
**High-fidelity.** Colors, typography, spacing, layout, and interactions are final and intentional (Bloomberg-terminal aesthetic: dark, monospace-led, dense, one orange accent). Reproduce the UI pixel-faithfully. Exact tokens are in §10.

### Screenshots
`screenshots/` contains rendered captures of every screen for quick visual reference (open the HTML for the interactive source of truth):
`01-watchlist` · `02-company-detail` · `03-validation-provenance` (validation tab) · `04-timeline` · `05-review-queue` · `06-companies-add` · `07-activity-log` · `08-settings` · `09-mobile-watchlist` (responsive ≤700px) · `10-provenance-drawer` (the per-number source drawer — EPS cross-referenced across 3 sources).

## 4. Target architecture & repo layout
Create this structure in `paul-raelta/agent_orange` (currently empty):

```
agent_orange/
  design/      ← the prototype from this bundle (copy in as-is, for reference)
  web/         ← production UI you build (Vite + React + TypeScript)
  workers/     ← the agentic backend (see §12) — stub now, build out later
  README.md    ← repo overview (you write this)
  .gitignore   ← node_modules, dist, .env, etc.
```

**Recommended `web/` stack:**
- **Vite + React 18 + TypeScript** (replaces CDN React + in-browser Babel).
- **React Router** for navigation — the prototype's route ids map 1:1: `watchlist`, `timeline`, `review`, `companies`, `activity`, `settings`, plus a `company/:ticker` detail route.
- **TanStack Query (React Query)** for the data layer — wraps the API described in §6. This is the seam that replaces `window.AO_DATA`.
- **CSS:** the prototype uses CSS custom properties on `:root`. Port them verbatim into a `tokens.css` (or vanilla-extract / Tailwind theme). The whole design is token-driven — don't hardcode hex in components.
- Container queries drive the desktop↔mobile reflow at **700px** (prototype uses `@container (max-width:700px)` on the app shell). Keep that approach.

**Git (do this after building):**
```bash
# from the agent_orange repo root, with the design/ web/ workers/ structure in place
git add .
git commit -m "Initial commit: design reference + Vite UI scaffold"
git push origin main
```
The user has an SSH host alias `github-paulraelta` configured for this repo's identity; if the remote isn't set, use:
`git remote add origin git@github-paulraelta:paul-raelta/agent_orange.git`

## 5. Screens / Views
All screens render inside an **app shell**: a 212px left sidebar (brand, nav, usage meter) + scrollable content. Below 700px (container width) the sidebar becomes a bottom tab bar and content stacks to one column. There is also a Desktop/Mobile preview toggle in the prototype's top bar — that's a *prototype affordance only*; the real app is just responsive and doesn't need the toggle.

### 5.1 Watchlist (default route)
- **Purpose:** at-a-glance status of every tracked company.
- **Layout:** header (title "WATCHLIST", a status summary line "N agents · X watching · Y needs review · Z validated", last-sync time, and a "RUN ALL AGENTS" primary button). Below: a 3-column grid of company cards (`grid-template-columns: repeat(3, minmax(0,1fr)); gap:16px`); 1 column under 700px.
- **Company card** (`.wl-card`): left status accent bar (3px: green=validated, blue=review, amber=watching). Top row: ticker monogram glyph + ticker (17px/700) + company name (10px muted, truncates) and a status chip. Price row: price (16px/600) + day-change (green/red with ▲/▼) + an EPS sparkline (SVG). A period band (top/bottom hairline borders) showing "LATEST/LAST REPORTED" + period label (accent) + period-end date. A 3-up metric grid (`repeat(3, minmax(0,1fr))`, each cell `min-width:0`): metric label (8.5px uppercase, truncates) + confidence badge + value (16px/600) + YoY delta. Footer varies by status: review → a blue CTA button "⚑ N items need your review →"; watching → an amber pulsing dot + next-window text; validated → green "✓ N× corroborated · validated <timestamp>".
- Clicking a card → company deep-dive.

### 5.2 Company deep-dive (`company/:ticker`)
- **Purpose:** full history + validation + provenance for one company.
- Header: back link, ticker (22px) + sector, name + cadence + fiscal note, price, status chip. A "SOURCES" row of pills (IR primary, SEC EDGAR + CIK) and the source mode (auto/guided/advanced). If status=review, a blue banner with "OPEN REVIEW QUEUE →".
- **Tabs:** RESULTS / VALIDATION / AGENT RUNS.
  - **RESULTS:** a horizontally-scrollable table — rows = Revenue, Net income, EPS diluted, EPS basic, Gross margin, + a confidence row; columns = last 5 periods (latest column highlighted with a faint accent tint and left sticky metric column). Clicking the latest column's confidence badge opens the provenance drawer.
  - **VALIDATION:** a pass/fail card (green pass / amber needs-review) showing the rule, a prose detail, corroboration count, and a conflict flag; then a list of metric rows (label, value, YoY, confidence, "N sources ›") — clicking a row opens the provenance drawer.
  - **AGENT RUNS:** the activity log filtered to this company.
- **Provenance drawer** (right slide-over, ~460px, scrim, Esc to close): the metric value (26px) + confidence + YoY, a help blurb, then one block per source: source title, page number (accent), URL (blue, truncates), and the exact quoted snippet (sans-serif, left accent border). This is the literal embodiment of the validation idea — show the user *where* each number came from.

### 5.3 Timeline (`timeline`)
- **Purpose:** predicted filing windows + live watching state.
- A months-across track (Apr→Dec in the demo) with a dashed "NOW" marker. One lane per company: a glyph + ticker label, then on the track — a green dot marker for "reported & recorded" events and a bar for the predicted window (orange, hatched) or "watching now" (amber, pulsing). Legend at the bottom. Clicking a lane → that company.

### 5.4 Review queue (`review`)
- **Purpose:** human-in-the-loop resolution of findings the agent couldn't auto-validate.
- A list of review cards (left blue accent bar). Each: ticker (clickable) + period + confidence + found-timestamp; a reason line ("**EPS · diluted** — EPS conflict across sources"); a row of candidate values (each a card: big value + source + weight note; the chosen one highlights green); a provenance snippet block; and an actions row ("USE $0.82", "USE $0.79", "REJECT"). On resolve, the card dims, shows "✓ Recorded <choice> · removed from queue".

### 5.5 Companies (config) (`companies`)
- **Purpose:** configure tracked companies + add new ones.
- Header with "ADD COMPANY". The add flow is a panel with a **MINIMAL / ADVANCED** segmented toggle: type a ticker → "DISCOVER SOURCES" → an animated discovery list (resolve ticker → locate EDGAR CIK → scan IR site → infer cadence) → a "sources found" result (primary IR, SEC, inferred cadence, next window). ADVANCED additionally exposes: pinned source URL, cadence select (Quarterly 4×/yr / Semi-annual 2×/yr / Auto-detect), a metric multi-select (chips), and a validation-rule select. Confirm → "START WATCHING <TICKER>".
- Below: a list of configured companies (glyph, ticker+name, source pills, cadence, mode, status chip). Click → deep-dive.

### 5.6 Activity (`activity`)
- A filter bar (ALL + one per ticker) and a terminal-style log: each row = timestamp (muted), agent ticker (colored), message (sans-serif), and tokens·cost on the right. Levels: ok (green agent), warn (amber message), info (muted).

### 5.7 Settings (`settings`)
- **USAGE** panel: big $-this-month vs budget, a progress bar, tokens/runs/% stats, and a per-model breakdown (Opus for extraction/validation, Sonnet for discovery/monitoring).
- **PROVIDERS** panel: cards for Anthropic Claude (ACTIVE), OpenAI GPT (PLANNED), Google Gemini (PLANNED). This is the provider-agnostic seam — the UI never hardcodes a provider.
- **MODEL ROUTING** panel: per-task model assignment (Source discovery / Monitoring poll / Extraction / Validation) as segmented controls (Haiku/Sonnet/Opus) — cheap models for cheap work, strong models for extraction/validation.
- **SCHEDULE & VALIDATION DEFAULTS**: poll frequency, run mode (offline/unsupervised), default validation rule, notification triggers.

## 6. Data contract (THE critical seam)
The prototype reads everything from a single global `window.AO_DATA` (see `design/app/data.js`). In production, **delete the fixture and serve this exact shape from the `workers/` API**, consumed via React Query. Components shouldn't change. Top-level shape:

```ts
type AOData = {
  companies: Company[];
  reviewQueue: ReviewItem[];
  activity: ActivityRow[];
  usage: Usage;
  providers: Provider[];
  routing: RoutingRule[];
};

type Company = {
  ticker: string; name: string; sector: string;
  price: number; dayChange: number; currency: string;
  cadence: "Quarterly" | "Semi-annual"; fiscalNote: string;
  status: "validated" | "review" | "watching" | "error";
  sourceMode: "auto" | "guided" | "advanced";
  sources: { kind: "IR" | "SEC"; label: string; primary?: boolean }[];
  latest: {
    period: string; periodEnd: string; reportedOn: string; validatedOn: string | null;
    metrics: Metric[];
    validation: { passed: boolean; rule: string; detail: string;
                  corroborations: number; conflict?: boolean };
  };
  sparkEps: number[]; sparkLabels: string[];
  nextWindow: { from: string; to: string; label: string };
  history: { period: string; end: string; rev: string; ni: string;
             epsD: string; epsB: string; gm: string; conf: Conf }[];
};

type Metric = { key: string; value: string; raw: number; yoy: number | null;
                conf: Conf; prov: Provenance[] };
type Provenance = { source: string; url: string; page: number; quote: string };
type Conf = "high" | "med" | "low";

type ReviewItem = {
  id: string; ticker: string; period: string; periodEnd: string;
  reason: string; conf: Conf; foundOn: string; field: string;
  candidates: { value: string; source: string; page: number; weight: string }[];
  snippet: Provenance;
};
type ActivityRow = { t: string; agent: string; level: "ok"|"warn"|"info";
                     tokens: number; cost: number; msg: string };
type Usage = { monthTokens: number; monthCost: number; budget: number; runs: number;
               byModel: { model: string; task: string; share: number; cost: number }[] };
type Provider = { id: string; name: string; status: "active"|"planned";
                  auth: string; models: string[] };
type RoutingRule = { task: string; desc: string; model: string };
```

**Suggested REST endpoints** (map onto the above): `GET /companies`, `GET /companies/:ticker`, `GET /review-queue`, `POST /review-queue/:id/resolve {choice}`, `GET /activity?ticker=`, `GET /usage`, `GET /providers`, `GET /routing`, `POST /companies {ticker, mode, ...}`, `POST /run` (trigger all agents). Money/EPS values are pre-formatted strings in the prototype (`value`) with a numeric `raw` alongside for charts — keep both, or move formatting to the client.

## 7. Interactions & behavior
- **Run all agents:** button enters a "RUNNING…" state, then resolves and updates last-sync. In production this kicks off agent jobs and the UI subscribes to status (poll or websocket).
- **Provenance drawer:** opens from confidence badges / metric rows; closes on scrim click or Esc; slides in from right (0.24s cubic-bezier).
- **Review resolve:** optimistic — card dims and shows recorded choice; POSTs the decision.
- **Add company:** ticker → discovery (animated ~1.9s in the demo; real = live agent run) → confirm.
- **Responsive:** single breakpoint at 700px container width (sidebar→bottom tabs, grids→1col).
- **Reduced motion:** the pulsing "watching" dots/bars should respect `prefers-reduced-motion`.

## 8. State management
Server state via React Query (companies, review queue, activity, usage, providers, routing). Local UI state: current route (router), open company, active tab, open drawer + its metric, review resolutions (until refetch), add-company flow phase, and theme tweaks (§11). No global store needed beyond the query cache.

## 9. Status & confidence semantics
- **Status:** `validated`→green `#4ec77a`, `review`→blue `#5aa2f0`, `watching`→amber `#e3a52e` (pulsing), `error`→red `#ff6b5e`.
- **Confidence:** `high`→green, `med`→amber, `low`→red, rendered as a 3-bar glyph + label.
- **Delta:** ≥0 green with ▲, <0 red with ▼, null → muted "—".

## 10. Design tokens (exact)
```css
/* color */
--bg:#07090c;  --panel:#0d1117;  --panel-2:#11161d;  --raised:#161d27;
--line:#222b37;  --line-soft:#1a212b;
--text:#e4e8ee;  --text-2:#929dac;  --text-3:#5f6975;
--accent:#e8723a;  --accent-soft:rgba(232,114,58,.13);  --accent-line:rgba(232,114,58,.40);
--green:#4ec77a;  --red:#ff6b5e;  --amber:#e3a52e;  --blue:#5aa2f0;
/* type */
--mono:'IBM Plex Mono', ui-monospace, monospace;   /* data, tickers, labels, nav */
--sans:'IBM Plex Sans', system-ui, sans-serif;     /* prose, snippets, descriptions */
/* radius */
--r:7px;
```
- **Fonts (Google):** IBM Plex Mono (400/500/600/700), IBM Plex Sans (400/500/600). Optional alternates exposed via Tweaks: JetBrains Mono, Space Mono.
- **Type scale (px):** screen title 20 / .13em; section/panel titles 10.5 / .13em uppercase; ticker 17; price 16; metric value 16; big stat 26–30; labels 8.5–10 uppercase; body/prose 11–12 (sans). Mono is the default UI face; sans only for multi-line prose and provenance quotes.
- **Spacing:** screen padding 26/30px (18/16 compact, 18/16 mobile); card padding 16 (12 compact); grid gap 16 (12 compact); panel radius `--r`; hairline borders `--line`/`--line-soft`.
- **Motion:** drawer 0.24s cubic-bezier(.4,0,.2,1); watching pulse 1.6–2s; card hover translateY(-2px).

## 11. Theming / Tweaks
The prototype includes a runtime theming layer (the "Tweaks" panel) that maps to a few knobs — implement these as a settings/theme provider that writes CSS variables / toggles classes on the root:
- **Accent** — sets `--accent` and derives `--accent-soft` / `--accent-line` via `color-mix(in srgb, <accent> 14%/42%, transparent)`. Curated set: `#e8723a` (default), `#46b1c9`, `#d7a13b`, `#9a86f0`.
- **Surface** — three presets overriding `--bg/--panel/--panel-2/--raised/--line/--line-soft`: `carbon` (default, values above), `slate` (`#0b0f15 / #121822 / #18202c / #1f2836 / #2b3645 / #202836`), `black` (`#000 / #0a0a0c / #101013 / #16161a / #232327 / #1a1a1e`).
- **Mono type** — `--mono` ∈ { IBM Plex Mono, JetBrains Mono, Space Mono }.
- **Density** — `compact` class tightens paddings (see §10).
- **Card sparklines** — toggle to hide `.spark`.
(See `design/app/app.jsx` `applyTweaks()` and `BG_PRESETS`/`FONT_PRESETS` for the exact mapping.)

## 12. `workers/` — the agentic backend (sketch for later)
Not part of the UI build, but here's the intended shape so the data contract makes sense:
- **Per-company agent** with stages matching the routing table: *discovery* (find IR URL + SEC EDGAR CIK), *monitoring poll* (cheap recurring check for a new 8-K/10-Q/press release — use a cheap model), *extraction* (parse the filing/PDF for the metric set), *validation* (cross-reference each figure ≥2 places; on agreement → high confidence + auto-record; on conflict/single-source → push a `ReviewItem`).
- **Scheduling:** the filing date is unpredictable, so poll on a cadence that intensifies inside the predicted window (e.g. daily baseline + every-4h within `nextWindow`). **Cloud Scheduler → Cloud Run** is the natural fit.
- **Sources:** prefer **SEC EDGAR** as the structured backbone (8-K/10-Q have predictable structure and a reliable per-company CIK); use the IR site/press release as corroboration and for figures EDGAR formats differently. SanDisk-style cases (results stored somewhere bespoke) are exactly why discovery + per-company source pinning exist.
- **Provider routing:** the model used per stage is config (`routing`), not hardcoded — start all-Claude (Opus for extraction/validation, Sonnet/Haiku for discovery/monitoring), keep GPT/Gemini behind the same interface. **Anthropic API key in Secret Manager.** (Note: the consumer Claude *subscription* and the Claude *API* are billed separately — the cost meter models API spend.)
- **Storage:** Firestore (or Cloud SQL) for companies, recorded results + provenance, review items, activity, usage.
- **Validation rule** is per-company configurable; default = "cross-reference EPS in ≥2 locations".

## 13. Hosting (GCP)
- **UI (`web/` Vite build):** Firebase Hosting (CDN, simple deploy) — recommended; or Cloud Storage + Cloud CDN.
- **Backend (`workers/`):** Cloud Run (scales to zero) + Cloud Scheduler (cadence) + Firestore (data) + Secret Manager (API keys).
- Flow: **Firebase Hosting → Cloud Run API → Firestore ← Cloud Scheduler**, with the UI's data layer pointing at the Cloud Run API instead of the `AO_DATA` fixture.

## 14. Files in this bundle
- `design/Agent Orange.html` — entry; all CSS (design tokens + every component style) lives in its `<style>` block, plus font links and script order.
- `design/app/data.js` — the `AO_DATA` fixture = **the data contract** (§6). Mirror this shape from the API.
- `design/app/components.jsx` — shared primitives: `StatusChip`, `Conf`, `Delta`, `Spark`, `Panel`, `Btn`, `Price`, `Drawer`, `ProvenanceItem`, `Glyph`, `STATUS`.
- `design/app/screens1.jsx` — `Watchlist`, `Company` (deep-dive), `LogList`.
- `design/app/screens2.jsx` — `Timeline`, `Review`, `Companies`, `Activity`, `Settings`.
- `design/app/app.jsx` — app shell, routing (state-based — replace with React Router), Desktop/Mobile toggle (prototype-only), and the Tweaks/theming layer (`applyTweaks`, presets).
- `design/app/tweaks-panel.jsx` — the prototype's theming panel scaffold (reference for §11; not needed in production unless you want an in-app theme switcher).

---
*Generated as a design handoff. The README is self-sufficient — implement from it; open the HTML for visual ground truth.*
