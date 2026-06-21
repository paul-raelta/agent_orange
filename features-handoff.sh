#!/usr/bin/env bash
# =============================================================================
# Agent Orange — Three earnings features (flag-gated) handoff
# Fetches the spec + design references into the repo, then launches Claude Code
# to implement Consensus / Conflict / Guidance behind Settings feature flags.
#
# USAGE (from the repo root, e.g. ~/.../agent_orange):
#   bash features-handoff.sh           fetch + launch Claude Code
#   bash features-handoff.sh --fetch   fetch only
#   bash features-handoff.sh --clean   remove transfer scaffolding
#
# URLs are security-scoped and expire ~1h after generation. If a fetch 404s,
# ask the designer to re-mint and regenerate this script.
# =============================================================================
set -euo pipefail

if [[ ! -d web/src || ! -d workers ]]; then
  echo "✗ Run this from the agent_orange repo root (expected ./web/src and ./workers)." >&2
  exit 1
fi

PROMPT_DIR=".handoff"

read -r -d '' MANIFEST <<'EOF' || true
FEATURES.md	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/design_handoff_agent_orange/FEATURES.md?t=35fdd6b02ddd51350307ed325d184a3cd386bfedd8aac5fade610249f97eb6a1.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782038770.fp&direct=1
design/features/Feature Flags.html	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/features/Feature%20Flags.html?t=ee93361ea1ba7613000d87d3d7b72f4cdd62ef5e5d996689f2ca48bf673b0e71.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782038770.fp&direct=1
design/features/flagdemo.jsx	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/features/flagdemo.jsx?t=801cf4635adf62712244bc4009f2f2a3a64aba6227a0d2b9d096bc5c6dfdfbe3.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782038771.fp&direct=1
design/features/Feature Explorations.html	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/features/Feature%20Explorations.html?t=94ecc69827989e940a0b8af4e427b15b7c6d8480aa5332f088c1ebc424e89de9.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782038771.fp&direct=1
design/features/mocks.jsx	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/features/mocks.jsx?t=82c541ea0f6113fd3aaddc213980accdfef46793ce9c7d048b7f7ad58a3eb444.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782038772.fp&direct=1
design/features/design-canvas.jsx	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/features/design-canvas.jsx?t=9c5ab94f5adce4e09d23a054c8b540e703ca6b4d440b88b984ed27d44da50dd2.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782038772.fp&direct=1
EOF

read -r -d '' CC_PROMPT <<'EOF' || true
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
EOF

fetch_all() {
  echo "→ Fetching feature spec + design references…"
  mkdir -p design/features "$PROMPT_DIR"
  while IFS=$'\t' read -r dest url; do
    [[ -z "${dest:-}" ]] && continue
    mkdir -p "$(dirname "$dest")"
    echo "  • $dest"
    curl -fsSL "$url" -o "$dest"
  done <<< "$MANIFEST"
  printf '%s\n' "$CC_PROMPT" > "$PROMPT_DIR/FEATURES_PROMPT.md"
  echo "✓ Files in place. Brief: FEATURES.md  |  Demo: design/features/Feature Flags.html"
}

launch_cc() {
  if command -v claude >/dev/null 2>&1; then
    echo "→ Launching Claude Code…"
    claude "$(cat "$PROMPT_DIR/FEATURES_PROMPT.md")"
  else
    echo "ℹ Claude Code CLI ('claude') not found. Start it and paste:"
    echo "----------------------------------------------------------------------"
    cat "$PROMPT_DIR/FEATURES_PROMPT.md"
    echo "----------------------------------------------------------------------"
  fi
}

clean() {
  echo "→ Removing transfer scaffolding (keeps FEATURES.md + design/features/)…"
  rm -rf "$PROMPT_DIR"
  rm -f features-handoff.sh
  echo "✓ Cleaned."
}

case "${1:-}" in
  --clean) clean ;;
  --fetch) fetch_all ;;
  "")      fetch_all; launch_cc ;;
  *) echo "Unknown option: $1 (use --fetch | --clean)"; exit 1 ;;
esac
