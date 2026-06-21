Read MOBILE.md at the repo root and make Agent Orange responsive for recent
iPhones (~390–430px CSS width) WITHOUT changing the desktop experience.

Hard rule: every change is additive and scoped inside a max-width / container
(max-width:) query. At ≥1024px every view must render byte-for-byte as it does
today — diff desktop screenshots if unsure.

Three things to apply (full detail + finished reference CSS/markup in MOBILE.md
and the design/ files just fetched):
  1. Filing Timeline — keep the desktop Gantt as-is; add the parallel vertical
     "agenda" mobile view from the same LANES data, toggled inside the existing
     @container (max-width:700px) block (.tl-desktop hidden, .tl-mobile shown).
     Markup: design/screens/Timeline.tsx · styles: design/styles/app.css
     (search "timeline — mobile agenda").
  2. Add Companies flow — port the @media (max-width:640px) block from
     design/addflow/Add Companies.html: stacked toolbar, single-column grid, and
     critically the table view must scroll horizontally (overflow-x:auto +
     min-width) instead of clipping. Selection tray + discovery rows reflow.
  3. Feature Flags / Labs settings — port the @media (max-width:720px) block from
     design/features/Feature Flags.html: layout stacks, flags rail goes
     full-width to the top (order:1, position:static) above the content.

Most other views already reflow via the app-shell container query (sidebar →
bottom tab bar, grids → one column) — verify those still work, don't rebuild them.
No new console errors; web/ must build clean. Do not commit until green.
