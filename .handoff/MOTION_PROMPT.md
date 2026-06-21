Read MOTION.md at the repo root and implement the motion / UX-polish layer.

The two new files (web/src/styles/motion.css, web/src/motion/motion.tsx) are already
in place. Do the WIRING described in MOTION.md, merging additively into the existing
components — do NOT overwrite their logic:
  1. import './styles/motion.css' in main.tsx (after app.css)
  2. wrap card grids in <Reveal> (Watchlist, AddCompanies, Review, Companies)
  3. add pathLength={1} to the Spark <path> (primitives.tsx)
  4. swap the Watchlist loading spinner for <SkeletonCard> + .mo-fadein crossfade
  5. selection polish in AddCompanies (sector ripple via .rippling + --i, tray .mo-roll)
  6. usePriceFlash in Price; <CountUp> for P&L + usage stats
  7. tab underline ink in Company.tsx; .drawer-stagger on the Drawer body
Everything must respect prefers-reduced-motion (already handled in motion.css/JS).

Verify: web/ builds clean (tsc + vite); the Watchlist entrance, skeletons, selection
polish, tab slide and drawer fade match design/motion/Motion Lab.html (open it).
Keep it restrained — terminal aesthetic. Do not commit until it builds and runs.
