# Handoff: Mobile / responsive support

> **For Claude Code.** Apply mobile-responsive layouts so every view works on recent iPhones
> (~390–430px CSS width) **without changing the desktop experience**. All changes are additive and
> scoped inside `max-width` / container `(max-width:)` queries — desktop renders byte-for-byte as today.
>
> Ground truth: the design prototype reflows correctly at 402px (open `design/Agent Orange.html` and
> click the **MOBILE** toggle in its top bar). The reference source files fetched alongside this brief
> already contain the finished CSS/markup — port the same rules into `web/`.

## What changed (and why)
Most views already reflowed via the app shell's **container query** (`@container (max-width:700px)` on
`.app-shell`, which has `container-type:inline-size`): sidebar → bottom tab bar, card grids → one column,
metric/route rows stack. The gaps were:

### 1. Filing Timeline — reorganised for mobile (the one real break)
The desktop Gantt (12-month track + 120px lane labels) is illegible below ~700px. **Keep the Gantt
exactly as-is on desktop**; add a parallel mobile view from the **same `LANES` data**:
- Wrap the existing Gantt `<Panel>` in `<div className="tl-desktop">`.
- Add a `<div className="tl-mobile">` agenda: one card per company (`Glyph` + ticker + `StatusChip`),
  then one row per bar — REPORTED / PREDICTED / WATCHING with the period+date right-aligned.
- Toggle with: `.tl-mobile{display:none}` by default; inside the existing `@container (max-width:700px)`
  block add `.tl-desktop{display:none}` and `.tl-mobile{display:flex;flex-direction:column;gap:12px}`.
- Full markup is in `design/screens/Timeline.tsx`; the `.tla-*` styles are in `design/styles/app.css`
  (search `timeline — mobile agenda`). Copy both verbatim into `web/src/screens/Timeline.tsx` and your
  global stylesheet.

### 2. Add Companies (browse + discover flow) — `design/addflow/Add Companies.html`
This is a standalone prototype that becomes the Companies "Add" flow. It had **no breakpoint**. Added one
`@media (max-width:640px)` block (search the file for `Mobile (recent iPhones`):
- Toolbar stacks: search full-width, sort + Grid/Table toggle below.
- Sector grid → single column.
- **Table view scrolls horizontally** instead of clipping: `.tbl-wrap{overflow-x:auto}` +
  `table.sp-tbl{min-width:580px}` (this was the real defect — the dense table was being cut off).
- Selection tray reflows: count + Clear + Add on row 1, selected chips scroll on row 2.
- Discovery rows / candidate cards wrap.
Port these rules when you build the Companies add flow.

### 3. Feature Flags / Labs demo — `design/features/Feature Flags.html`
The settings rail was a fixed 330px sidebar that crushed content on a phone. Added `@media (max-width:720px)`:
the layout stacks (`.fd-wrap{flex-direction:column}`), the **flags rail moves full-width to the top**
(`order:1`, `position:static`, `width:100%`) above the demo. This is the Labs section of Settings — apply
the same stack-rail-on-top pattern wherever the flags panel lands.

## Acceptance
- [ ] At 390–430px: Timeline shows the vertical agenda (not a crushed Gantt); Add Companies table scrolls
      rather than clips; Feature Flags/Labs stacks with controls on top.
- [ ] At ≥1024px every view is **identical to before** (diff the desktop DOM/screenshots if unsure).
- [ ] Bottom tab bar, single-column card grids, and stacked rows still behave (these already worked).
- [ ] No new console errors. `web/` builds clean. Commit.

## Out of scope
- Don't restyle desktop. Don't introduce new breakpoints beyond those above unless a view genuinely needs one.
- Don't touch the provenance drawer width logic — `width:min(460px,92vw)` is already correct on a phone.
