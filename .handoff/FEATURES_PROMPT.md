Read FEATURES.md at the repo root and implement the three flag-gated earnings
features for Agent Orange: Consensus vs Actual, Conflict-Resolution Workspace,
and Guidance Tracking.

HARD REQUIREMENT — compartmentalization (FEATURES.md §0):
  • One Settings feature flag per feature (consensus / conflict / guidance).
  • Each feature is a pure conditional render over OPTIONAL data:
    flags.x && <Feature/>  — never refactor existing components to DEPEND on it.
  • Turning a feature off makes ONLY its surfaces disappear; every other screen
    renders exactly like today. Turning all three off must be indistinguishable
    from pre-feature main.
  • No cross-feature coupling. Backend does no work for disabled features.

Build order: (1) flag system — settings model GET/PUT /settings/flags, a
useFeatureFlags() hook with a localStorage cache to avoid gating flash, and a
"LABS · FEATURE FLAGS" panel in screens/Settings.tsx; (2) Consensus; (3)
Conflict; (4) Guidance (UI now, extractor can ship behind the off flag).

Merge additively into web/src — do not overwrite diverged files. Ground truth:
open design/features/Feature Flags.html (toggle each flag live) and
design/features/Feature Explorations.html (full detail). Verify with the §6
acceptance checklist; web/ must build clean (tsc + vite). Do not commit until green.
