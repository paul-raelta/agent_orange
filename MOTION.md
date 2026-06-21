# Handoff: Motion / UX polish for Agent Orange

> **For Claude Code.** Add a small, tasteful motion layer to the existing `web/` app.
> Two new files are provided (`styles/motion.css`, `motion/motion.tsx`); the rest is
> **wiring** — applying classes/components into existing screens. Everything is
> token-driven and `prefers-reduced-motion`-aware. Keep it restrained: this is a
> Bloomberg-style terminal, not a consumer app. Visual ground truth: open
> `design/motion/Motion Lab.html` (every effect, with toggles).
>
> Merge additively — do not overwrite existing component logic. When done, build + commit.

## Effects shipping (the agreed default set)
Staggered card rise · sparkline trace · skeleton loaders + crossfade · select snap ·
tray count-roll · sector select ripple · price tick flash · count-up stats ·
card hover glow · tab underline slide · drawer content fade.

## New files (drop in, no conflict)
- `web/src/styles/motion.css`
- `web/src/motion/motion.tsx` — exports `useEntrance`, `Reveal`, `CountUp`, `usePriceFlash`, `SkeletonCard`, `useTabInk`.

## 0. Activate
In `web/src/main.tsx`, import the stylesheet **after** `app.css`:
```ts
import './styles/app.css'
import './styles/motion.css'
```

## 1. Page entrance — staggered rise  (Watchlist, Companies, Review)
Wrap each card grid in `<Reveal>` (it becomes the grid element, so pass the grid class):
```tsx
import { Reveal } from '../motion/motion'
// Watchlist.tsx — was: <div className="wl-grid"> … </div>
<Reveal className="wl-grid">
  {companies.map((c) => <CompanyCard key={c.ticker} … />)}
</Reveal>
```
Apply the same to: `AddCompanies.tsx` (each sector `.ac-grid`), `Review.tsx` (the review-card list), `Companies.tsx` (`.cfg-list`). For single blocks (the Watchlist P&L strip, a banner) add the `reveal-item` class + toggle `is-entering` via `useEntrance()` — or just wrap them too. Children fade+rise with a 40ms stagger; resting state is fully visible (degrades safely).

## 2. Sparkline trace
In `components/primitives.tsx`, add `pathLength="1"` to the `<path>` inside `Spark`:
```tsx
<path d={d} pathLength={1} fill="none" stroke={color} strokeWidth="1.5" />
```
That's all — `.reveal .spark path` in motion.css draws it on entrance.

## 3. Skeleton loaders (replace the spinner)
Where companies are loading (Watchlist), render a grid of `<SkeletonCard>` instead of `<Loading>`, then crossfade the real grid in:
```tsx
import { SkeletonCard } from '../motion/motion'
if (!companies) return (
  <div className="wl-grid">{Array.from({length:6}).map((_,i)=><SkeletonCard key={i}/>)}</div>
)
// when loaded, add className="mo-fadein" to the real grid wrapper for the crossfade
```
(Optionally update `components/Loading.tsx` to render skeletons so every screen benefits.)

## 4. Selection polish  (AddCompanies.tsx)
- **Select snap** — already automatic via `.ac-card.sel .ac-check` in motion.css. No code.
- **Sector ripple** — in `selectAll(sector)`, add a transient class so the checks cascade, and tag each card with its index:
  ```tsx
  // when rendering cards in a group:
  <div className="ac-card …" style={{ ['--i' as string]: i }} …>
  // group wrapper gets 'rippling' for ~600ms after Select all:
  <div className={'ac-group' + (rippling[sector] ? ' rippling' : '')}>
  ```
  Set `rippling[sector]=true` on select-all, clear after 600ms.
- **Tray count roll** — wrap the count number so it re-mounts on change:
  ```tsx
  <span className="ac-tray-count"><span className="mo-roll" key={selected.size}>{selected.size}</span> selected</span>
  ```

## 5. Price tick flash  (when live prices update)
In `components/primitives.tsx` `Price`, flash the value on change:
```tsx
import { usePriceFlash } from '../motion/motion'
export function Price({ price, change }) {
  const flash = usePriceFlash(price)
  return <span className="price"><span className={'price-val ' + flash}>{price.toFixed(2)}</span>…</span>
}
```
Harmless until live updates arrive (it only flashes on change).

## 6. Count-up stats
Use `<CountUp>` for headline numbers: Watchlist P&L strip (`totalValue`, `unrealized`), Settings/AppShell usage `$`:
```tsx
import { CountUp } from '../motion/motion'
<span className="pf-val"><CountUp value={totals.totalValue} prefix="$" /></span>
```

## 7. Card hover glow
Pure CSS (`.wl-card:hover`, `.ac-card:hover`) — already active once motion.css is imported. No code.

## 8. Tab underline slide  (Company.tsx deep-dive tabs)
Add a moving ink bar under the active tab:
```tsx
import { useRef } from 'react'
import { useTabInk } from '../motion/motion'
const refs = useRef<(HTMLButtonElement|null)[]>([])
const ink = useTabInk(refs.current[TABS.indexOf(tab)] ?? null)
// in the .tabs container: give each button ref={el=>refs.current[i]=el}, then:
<span className="tab-ink" style={ink} />
```

## 9. Drawer content fade  (provenance Drawer in primitives.tsx)
Wrap the drawer body children in `.drawer-stagger`:
```tsx
<div className="drawer-bd drawer-stagger">{children}</div>
```
Blocks fade up in sequence when the drawer opens.

## 10. Reduced motion
Handled in motion.css (`@media (prefers-reduced-motion: reduce)` snaps everything to final state, kills loops). `CountUp`/`usePriceFlash` check it in JS. Nothing else to do.

## Acceptance
- [ ] `web/` builds clean (tsc + vite).
- [ ] Watchlist loads with a staggered card rise + sparkline trace; refresh shows skeletons → crossfade.
- [ ] Add Companies: select snaps, "Select all" ripples, tray count rolls.
- [ ] Deep-dive tab underline slides; provenance drawer content fades in.
- [ ] Toggle OS "reduce motion" → everything still renders correctly, no animation.
- [ ] Matches `design/motion/Motion Lab.html`. Commit.

## Tuning
Global feel lives in `:root` of motion.css: `--mo-dur` (0.42s), `--mo-dur-slow` (0.9s, sparkline), `--mo-ease`. Adjust once, applies everywhere.
