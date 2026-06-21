# Handoff: Help / User Guide page

> **For Claude Code.** Ship the **Agent Orange help page** into the production app. It's a self-contained,
> data-driven guide: one HTML shell (`Help.html`) + a content array (`helpdata.js`) + 12 annotated
> screenshots (`img/*.jpg`). The annotations (numbered pins → callouts) are pure HTML/CSS/JS over the
> images — no build step, no framework. Your job is to make it reachable from the app and keep it in sync.

## What it is
A single long-scroll page with a sticky table-of-contents, covering all 12 feature areas (Watchlist,
Company deep-dive, Validation & provenance, Timeline, Review, Adding companies, Activity, Settings, the
Document Examiner, Labs features, Personalization, Mobile). Each section = an annotated screenshot with
numbered component callouts + a short "how to use it". The Examiner (§9) is a CSS diagram, not a screenshot.

## Files (fetched into `design/help/` by the script)
- `design/help/Help.html` — shell: styles, hero, TOC, render logic.
- `design/help/helpdata.js` — **all content** lives here (one array of section objects). Edit copy / pins / callouts here.
- `design/help/img/*.jpg` — 12 screenshots (9 reused from the existing handoff captures; 3 freshly captured for the newer features).

## Integrate into `web/`
Pick the lightest path that fits the app:

**Option A — static asset (simplest, recommended).**
1. Copy `design/help/` → `web/public/help/` (so Vite serves it verbatim at `/help/Help.html`).
2. Add a **Help** entry to the sidebar nav (and the mobile tab overflow) linking to `/help/Help.html`
   (open in a new tab, or route to it). Use the existing nav item styling; a `?` or book glyph fits.
3. Done — it's a self-contained page; no React port needed.

**Option B — React route (if you want it in-shell).**
Port `Help.html` to a `screens/Help.tsx` route at `/help`: move the `<style>` into the app's CSS strategy,
keep `helpdata.js` as a typed `help.ts` data module, and render the sections with the same markup. The
pin/callout hover-linking and scroll-spy are ~30 lines of vanilla JS — reimplement as a small `useEffect`.
More work; only do this if the guide must live inside the app shell rather than open standalone.

## Keep it honest
- The screenshots reflect the **prototype/as-built** UI. If a screen changes materially in `web/`, recapture
  that one image (same framing) and drop it in `img/` — the pins are percentage-positioned, so small visual
  changes don't break them, but big layout changes will need pin tweaks in `helpdata.js`.
- The Labs section (§10) documents Consensus / Conflict / Guidance — keep it gated behind the same feature
  flags (see `FEATURES.md`); if those ship, the help section is already written.

## Acceptance
- [ ] `/help` (or the linked path) opens the guide; TOC scroll-spy + pin/callout hover-linking work.
- [ ] A Help link exists in the app nav (desktop + mobile).
- [ ] Images load (check the `img/` path resolves under your chosen host location).
- [ ] `web/` builds clean. Commit.
