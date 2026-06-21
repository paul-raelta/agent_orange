# Handoff: Three earnings features — flag-gated & compartmentalized

> **For Claude Code.** Implement three new, independently toggleable features for Agent Orange:
> **(1) Consensus vs Actual**, **(2) Conflict-Resolution Workspace**, **(3) Guidance Tracking**.
> The hard requirement: each is **feature-flagged from Settings** and **compartmentalized** — every
> feature is a conditional render (`flags.x && <Feature/>`) over **optional** data, so turning it off
> makes its surface disappear with **zero impact** on any other feature. No deep integration, no
> shared-state coupling, no data migrations that break when a flag is off.
>
> Visual + behavioral ground truth: open `design/features/Feature Flags.html` (live flag demo —
> toggle each and watch surfaces appear/disappear) and `design/features/Feature Explorations.html`
> (the three features at full detail). Build to match. Merge additively; build + commit when green.

---

## 0. The compartmentalization contract (read first)
This is the whole point — honor it for all three features:

1. **One flag per feature**, stored in app settings (see §1). Default: all **on** in dev, your call for prod.
2. **Render gate only.** Each feature appears as `{flags.x && <Thing/>}` or by conditionally adding a tab/column. Never refactor an existing component's core so that it *depends* on the new feature.
3. **Optional data.** New fields on `Company`/`Metric`/`ReviewItem` are all optional (`?`). Existing screens must render identically when the fields are absent **or** the flag is off.
4. **No cross-feature coupling.** Consensus must not import from Guidance, etc. Disabling one cannot affect another (the demo proves this: conflict stays on while consensus+guidance go off).
5. **Backend is lazy.** Endpoints/extractors for a feature should no-op (or simply not be called) when its flag is off — don't spend Finnhub calls or extraction compute on disabled features.

If a change can't be expressed as "gate + optional field," stop and reconsider — it's too invasive.

---

## 1. Feature-flag system (build once, first)

### Settings model (`types.ts`)
```ts
export type FeatureFlags = {
  consensus: boolean
  conflict: boolean
  guidance: boolean
}
export const DEFAULT_FLAGS: FeatureFlags = { consensus: true, conflict: true, guidance: true }
```

### Persistence
- **Backend:** extend the existing settings surface — `GET /settings/flags` → `FeatureFlags`,
  `PUT /settings/flags`. Mirror how `NotificationPrefs` is already done (`GET|PUT /settings/notifications`).
- **Client:** `useFeatureFlags()` hook in `hooks.ts` (React-Query, like `useNotificationPrefs`), with a
  **localStorage cache** (`ao-feature-flags`) read synchronously on first paint so gating doesn't fl/ flash.
  Provide a `setFlag(key, value)` mutation that PUTs and invalidates.

### Settings UI (`screens/Settings.tsx`)
Add a **"LABS · FEATURE FLAGS"** panel (style matches the demo's right rail): one row per feature —
name, one-line description, the surfaces it affects, and a toggle (`.sw`/existing toggle component).
Copy the three descriptions verbatim from `design/features/Feature Flags.html`.

### Consuming flags
```ts
const { flags } = useFeatureFlags()
// gate a surface:
{flags.consensus && <BeatBanner … />}
```
That's the only integration pattern used below.

---

## 2. Feature 1 — Consensus vs Actual  `flags.consensus`
**Data (`types.ts`, all optional):**
```ts
// on Metric:
consensus?: { estimate: number; estimateLabel: string; surprisePct: number; sourceCount: number }
```
Source: a Street-estimates provider (Finnhub `/stock/earnings` or `/stock/eps-estimate` style). Attach to
each `Metric` in `GET /companies` + `GET /companies/:ticker`. **Only fetch/attach when `flags.consensus`.**

**Gating points (all conditional renders — see demo):**
- `screens/Watchlist.tsx` card: when on, the metric cell shows `+x.x% vs est` and the status corner shows a
  `BEAT/MISS/IN LINE` badge; when off, the existing YoY delta + status chip (unchanged).
- `screens/Company.tsx`: a **beat/miss banner** under the header (`{flags.consensus && …}`), and the RESULTS
  table gains **CONSENSUS** + **SURPRISE** columns (conditional `<th>/<td>` — keep the base columns intact).
- Provenance drawer: optionally show the estimate's source line next to the figure.

**Effort: S.** No new endpoint — extends existing company payloads with one optional field.

---

## 3. Feature 2 — Conflict-Resolution Workspace  `flags.conflict`
**Data (`types.ts`):** promote the existing `validation.conflict?: boolean` into an optional structured object
on `ReviewItem` (leave the boolean for back-comat if present):
```ts
conflict?: {
  metric: string; period: string
  sources: { id: 'A' | 'B'; kind: 'SEC' | 'IR'; label: string; url: string;
             value: string; snippet: string; confidence: 'high'|'med'|'low'; note: string }[]
}
```

**Gating point (one swap, fully isolated):** in the Review queue (`screens/Review.tsx`), an item renders the
**ConflictWorkspace** component **iff** `flags.conflict && item.conflict`; otherwise the existing simple
review row (Confirm / Flag) — unchanged. The workspace = two source columns (value, highlighted snippet, page
ref, source link, confidence) + a decision rail (Accept A / Accept B / Flag for analyst / Both wrong +
**required note**). See `design/features/Feature Explorations.html` (artboard 2) for full layout.

**Resolution:** reuse the existing resolve endpoint, extended — `POST /review-queue/:id/resolve` now accepts
`{ choice: 'A'|'B'|'flag'|'both-wrong', note: string, pinnedValue?: string }`. Emit the existing
**`review.added`/`review.resolved`** SSE so the queue refreshes. No new stream.

**Effort: M.** New component + one richer payload + one richer resolve body. Nothing else moves.

---

## 4. Feature 3 — Guidance Tracking  `flags.guidance`
**Data (`types.ts`, optional):**
```ts
// on Company:
guidance?: {
  metric: string; period: string; low: string; high: string;
  prior?: string; direction: 'raised' | 'cut' | 'maintained';
  provenance: { url: string; page: string; snippet: string }
}[]
```

**Gating points:**
- `screens/Company.tsx`: conditionally insert a **GUIDANCE** tab into the tab array
  (`flags.guidance ? [...tabs w/ GUIDANCE] : tabs`) — the tab panel lists each metric's forward range,
  `was X` struck-through, a raised/cut/maintained badge, and the provenance sentence. When off, the tab
  isn't in the list and `Company` renders exactly as today.
- `screens/Watchlist.tsx` (optional): a small `guidance raised ▲` flag on the card footer when present.
- New endpoint `GET /companies/:ticker/guidance` → `Company['guidance']`, **only called when flag on**.

**Backend lift:** forward-looking extraction from management commentary / earnings call (the real work).
Until the extractor exists, the endpoint may return `[]` — the tab shows an empty state; nothing breaks.

**Effort: M–L (backend).** Do last; it reuses the beat/miss framing from Feature 1.

---

## 5. Suggested build order
1. **Flag system** (§1) — settings model, hook, LABS panel. Nothing else works without it.
2. **Consensus** (§2) — cheapest, unblocks framing.
3. **Conflict** (§3) — isolated component swap; the strongest demo.
4. **Guidance** (§4) — UI quick; backend extractor is the long pole (can ship behind the flag, off, until ready).

## 6. Acceptance criteria
- [ ] Settings has a **LABS · FEATURE FLAGS** panel with three working toggles; state persists (PUT + localStorage) and survives reload with no flash of un-gated UI.
- [ ] **Each toggle independently** shows/hides only its own surfaces; with a feature **off**, the affected screens render byte-for-byte like today (diff the DOM if unsure). Matches `design/features/Feature Flags.html`.
- [ ] Consensus: surprise chips + beat/miss banner + CONS/SURP columns appear only when on.
- [ ] Conflict: review item uses the workspace only when `flags.conflict && item.conflict`; resolve writes back and the queue updates via SSE.
- [ ] Guidance: GUIDANCE tab present only when on; empty state is graceful when the extractor returns `[]`.
- [ ] Turning **all three off** leaves an app indistinguishable from pre-feature `main`. No console errors. `web/` builds clean (tsc + vite).
- [ ] Backend does no work for disabled features (no estimate fetch / no guidance extraction / no workspace payload).
- [ ] Commit.

## 7. Out of scope
- Don't refactor existing screens beyond the conditional gates described.
- Don't couple features to each other or to a shared "earnings" module.
- Keep the terminal aesthetic — restrained, token-driven, no new colors.
