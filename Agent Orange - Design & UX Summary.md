# Agent Orange — Design & UX Summary

> A working summary of the design and UX of **Agent Orange** as built so far — the product concept, the design system, every screen, the signature interactions, and the deliverables produced. Use this as the single reference for where the design stands and how it's put together.

---

## 1. Product concept

Agent Orange employs **AI agents to monitor public companies' earnings** and supplement an investor's trading decisions. The user keeps a watchlist of owned + watched tickers; an **agent per company** is responsible for:

1. **Knowing where results live** — each company's investor-relations site differs (NVDA's IR PDF vs. SanDisk's elsewhere), with **SEC EDGAR** as a structured backbone/cross-check.
2. **Monitoring on an unpredictable schedule** — results for a period (e.g. ending Jun 30) can drop anytime from late-July to late-September, so this is a *polling* problem with cadence that intensifies inside a predicted window.
3. **Extracting** the figures that drive trades (revenue, net income, EPS basic/diluted, margins, guidance).
4. **Validating** each figure by cross-referencing it elsewhere in the filing (e.g. EPS appearing in both the income statement and a "Net Income Per Share" note), assigning a **confidence** level.
5. **Routing conflicts to a human** — anything that can't be auto-validated goes to a review queue.

Everything is surfaced with **full provenance** (every number links to source URL + page + the exact snippet it came from). The backend workers are agentic and provider-agnostic (Claude Opus now; GPT/Gemini behind the same interface later).

**Decoupling principle:** the UI only ever reads a single data shape (`AO_DATA` / a typed contract). The fixture is swapped for the real agent backend with zero UI change — the seam that keeps frontend and backend independently replaceable.

---

## 2. Design system

No external brand was supplied, so Agent Orange established its own **Bloomberg-terminal aesthetic**: dark, monospace-led, dense, serious, with a single warm accent (a nod to the name "Agent Orange").

### 2.1 Color tokens (exact)
The whole UI is token-driven — never hardcode hex.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#07090c` | near-black cool background |
| `--panel` | `#0d1117` | panel surface |
| `--panel-2` | `#11161d` | raised panel / header strip |
| `--raised` | `#161d27` | tiles, glyphs |
| `--line` | `#222b37` | hairline border |
| `--line-soft` | `#1a212b` | softer divider |
| `--text` | `#e4e8ee` | primary text |
| `--text-2` | `#929dac` | secondary text |
| `--text-3` | `#5f6975` | muted / labels |
| `--accent` | `#e8723a` | **brand orange** (single accent) |
| `--accent-soft` | `rgba(232,114,58,.13)` | accent tint fill |
| `--accent-line` | `rgba(232,114,58,.40)` | accent border |
| `--green` | `#4ec77a` | validated / up / high confidence |
| `--red` | `#ff6b5e` | down / error / low confidence |
| `--amber` | `#e3a52e` | watching / medium confidence |
| `--blue` | `#5aa2f0` | review / info |

### 2.2 Typography
- **`--mono`: IBM Plex Mono** (400/500/600/700) — the default UI face: data, tickers, labels, nav, tables.
- **`--sans`: IBM Plex Sans** (400/500/600) — prose, descriptions, provenance quotes only.
- Optional alternates exposed via Tweaks: JetBrains Mono, Space Mono.
- **Scale (px):** screen title 20 / .13em · panel titles 10.5 uppercase · ticker 17 · price 16 · metric value 16 · big stat 26–30 · labels 8.5–10 uppercase · body 11–12 (sans).

### 2.3 Spacing, shape, motion
- Radius token `--r: 7px`; hairline borders throughout; generous internal padding with dense data.
- Screen padding 26/30px (18/16 compact + mobile); card padding 16 (12 compact); grid gap 16.
- Motion: drawer slide 0.24s cubic-bezier(.4,0,.2,1); "watching" pulse 1.6–2s; card hover translateY(-2px). All animation respects `prefers-reduced-motion`.

### 2.4 Status & confidence semantics
- **Status:** `validated`→green · `review`→blue · `watching`→amber (pulsing) · `error`→red.
- **Confidence:** `high`→green · `med`→amber · `low`→red, drawn as a 3-bar glyph + label.
- **Delta:** ≥0 green ▲ · <0 red ▼ · null → muted "—".

---

## 3. Information architecture

A persistent **app shell**: a 212px left sidebar (brand, nav, live usage meter) + scrollable content. Routes:

| Route | Purpose |
|---|---|
| **Watchlist** (default) | At-a-glance status of every tracked company |
| **Timeline** | Predicted filing windows + live "watching" state |
| **Review** | Human-in-the-loop resolution of conflicting findings |
| **Companies** | Configure tracked companies + add new ones |
| **Activity** | Transparent per-agent run log |
| **Settings** | Usage/budget, provider & model routing, schedule defaults |
| **Company** (`company/:ticker`) | Deep-dive: history, validation, provenance, news/insider |

**Responsive:** a single container-query breakpoint at **700px** flips the sidebar into a bottom tab bar and collapses grids to one column.

**Sample data:** NVDA (just reported → *Validated*), SNDK/SanDisk (found, conflicting → *Needs Review*), MU/Micron (memory/storage peer → *Watching* for an unpredictable date).

---

## 4. Screens

### 4.1 Watchlist (home)
- Header: title, status summary line ("N agents · X watching · Y review · Z validated"), last-sync, **RUN ALL AGENTS** button.
- **Portfolio P&L strip** (live-priced; e.g. +29% unrealized).
- 3-column grid of **company cards**: status accent bar (green/blue/amber), ticker monogram glyph, price + day change + EPS sparkline, latest period band, a 3-up metric grid (value + YoY delta + confidence badge), and a status-specific footer (review CTA / next-window note / "✓ corroborated, validated").

### 4.2 Company deep-dive
- Header (ticker, sector, name, cadence, price, status), a **SOURCES** row (IR primary + SEC EDGAR CIK) and source mode (auto/guided/advanced).
- An **AI "what's worth knowing" narrative** card.
- Editable **position** (shares / cost basis → live P&L).
- Tabs: **RESULTS** (scrollable last-5-quarters table, latest column highlighted, confidence row), **VALIDATION** (pass/fail card + per-metric rows), **NEWS**, **INSIDER**, **AGENT RUNS**.
- **Provenance drawer** (right slide-over): metric value + confidence + YoY, then one block per source (title, page, URL, exact quote). This is the literal embodiment of the validation idea — e.g. EPS $2.39 traced to income statement p.5, Note 3 p.9, and the press release.

### 4.3 Timeline
Months-across track with a "NOW" marker; one lane per company showing reported markers (green dots) and **predicted windows** (orange) / "watching now" (amber, pulsing). Agents start watching at the left edge of a window.

### 4.4 Review queue
Cards (blue accent) for findings that couldn't auto-validate. The hero case: SanDisk diluted EPS **$0.82** (press-release headline) vs **$0.79** (8-K schedule). Candidate values shown side-by-side with source weighting + the provenance snippet; the user picks one or rejects → it's recorded and removed.

### 4.5 Companies (config) + Add flow
List of configured companies (sources, cadence, mode, status). **Add company** has a **MINIMAL / ADVANCED** segmented toggle: type a ticker → animated "discover sources" (resolve ticker → locate EDGAR CIK → scan IR → infer cadence) → confirm. Advanced exposes pinned source URL, cadence, metric selection, and validation rule.

### 4.6 Activity log
Filterable (all + per ticker) terminal-style feed — timestamp, agent, message, tokens·cost — with ok/warn/info levels.

### 4.7 Settings
- **Usage** — $-this-month vs budget, tokens/runs, per-model breakdown.
- **Providers** — Anthropic Claude (ACTIVE), OpenAI GPT (PLANNED), Google Gemini (PLANNED): the provider-agnostic seam.
- **Model routing** — per task (discovery/monitoring/extraction/validation) as segmented Haiku/Sonnet/Opus controls — cheap models for cheap work, Opus where it counts.
- **Schedule & validation defaults** — poll cadence, offline/unsupervised run mode, default validation rule, notification triggers.

---

## 5. Signature interactions

### 5.1 The Agent Run — "Document Examiner" (centerpiece)
Clicking **Run All Agents** launches a full-screen overlay where the **document is the hero**. It plays the real agentic story for **every tracked company in turn**:

1. **DISCOVER** — "searching SEC EDGAR + IR"; located filings appear as found sources.
2. **FETCH + open** — the filing opens as authentic EDGAR-style **white "paper"** (Form 10-Q cover, Condensed Consolidated Statements of Income, press release).
3. **EXAMINE** — a magnifier/lens **zooms to each section**; figures are **circled / boxed / underlined directly on the page**; captured values fly into an **Extracted Data** panel with provenance + confidence.
4. **CROSS-CHECK / VALIDATE** — multi-source agreement raises confidence (NVDA: EPS $2.39 corroborated ×3 → HIGH); conflicts are caught (SanDisk $0.82 vs $0.79 → review); Micron shows the "no new filing, watching" monitor.
5. Framed by a slim telemetry rail: live counters (pages read · tables parsed · figures captured · sources x-ref'd · Opus spend), elapsed, a `DISCOVER→FETCH→PARSE→EXTRACT→VALIDATE` pipeline, and a per-company progress rail. Ends with an **EXAMINATION COMPLETE** summary, then returns to the watchlist.

**Persistence:** the run is a background job — **▾ minimize** docks it to a small live progress widget (bottom-right) that keeps updating while the user navigates anywhere in the app; **⤢ expand** returns to the live document view. It renders on `document.body`, so route/screen changes never interrupt it.

*Design intent:* convey that the tool is an intelligent, exhaustive data miner reading the **actual documents** — not an abstract progress bar.

### 5.2 Provenance everywhere
Every figure is traceable to source + page + exact snippet via the deep-dive drawer — the trust mechanism behind "is this number corroborated elsewhere?"

### 5.3 Notifications
Email + SMS mocks (macOS Mail inbox + iPhone Messages) showing the "it reaches you" promise — validated / needs-review / watching alerts land the moment results drop.

### 5.4 Tweaks
An in-prototype control panel: **accent** (4 curated colors via `color-mix`), **surface** (Carbon / Slate / Black), **mono type** (Plex / JetBrains / Space), **density** (cozy / compact), **card sparklines** toggle — all applied live via CSS variables and persisted.

---

## 6. Deliverables produced

| Deliverable | What it is |
|---|---|
| **Interactive prototype** | The full app (watchlist, deep-dive, timeline, review, companies, activity, settings) — React/Babel, the design reference. |
| **Claude Code handoff package** | Build brief (repo layout, Vite + React + TS stack, screen specs, exact tokens, the data contract, GCP hosting) + design files + screenshots — used to build the real `web/` app. |
| **Demo video** | A self-running ~1:53 device-aware walkthrough: autoplay, captions (dynamic placement + cross-fade), simulated cursor, camera-follow, notifications scene, mobile showcase, suspenseful outro with contact. Desktop → interactive HTML; iPhone → tap-to-fullscreen MP4 (chromeless, rotates). |
| **Document Examiner module** | The multi-company, persistent Agent Run overlay (`examiner.css` + `examiner.js` + `examiner-docs.js`) — vanilla JS/CSS, drop-in for `web/`, driven by a replaceable per-company fixture. |

**Target production architecture (GCP):** Firebase Hosting (UI) → Cloud Run API (agents) → Firestore (data) ← Cloud Scheduler (cadence), with Secret Manager for API keys. Repo layout: `design/` (mockups) · `web/` (Vite app) · `workers/` (agents).

---

## 7. Design principles in force

- **The data contract is the seam** — UI reads one shape; backend is swappable; provider/model routing is config, never hardcoded.
- **Trust through provenance** — every number is traceable; confidence is earned by corroboration; conflicts go to a human, agents never guess.
- **Token-driven visuals** — one accent, semantic status colors, mono-led density; no invented colors.
- **Show the work** — the examiner and activity log make the agents' reading visible and auditable, building confidence that real data is being mined.
- **Responsive & accessible** — single 700px breakpoint, `prefers-reduced-motion` respected, 44px mobile hit targets.

---

*This document summarizes the design/UX state of Agent Orange. The visual source of truth is the interactive prototype; the integration source of truth is the Claude Code handoff README.*
