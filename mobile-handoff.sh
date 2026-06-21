#!/usr/bin/env bash
# =============================================================================
# Agent Orange — Mobile / responsive handoff
# Fetches the mobile brief + finished reference files into the repo, then
# launches Claude Code to apply the responsive layouts to web/ (desktop
# untouched — every rule is scoped inside a max-width / container query).
#
# USAGE (from the repo root, e.g.  ~/.../agent_orange):
#   bash mobile-handoff.sh           fetch + launch Claude Code
#   bash mobile-handoff.sh --fetch   fetch only
#   bash mobile-handoff.sh --clean   remove transfer scaffolding
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
MOBILE.md	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/design_handoff_agent_orange/MOBILE.md?t=543c6ffc267b6e91116bf5c5fd7ed504d6eb7214b6534fec054ad53251d244e1.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782045013.fp&direct=1
design/screens/Timeline.tsx	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/screens/Timeline.tsx?t=6482dbff3dc91bbf42c93d8cf69531e5f76e567a5dc8fad0abffa1a51894c117.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782045013.fp&direct=1
design/styles/app.css	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/styles/app.css?t=60c26e905e6489c5d4331137cc4c3e18f42778cb50e7d95a5b2bc6ca05c39cf2.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782045014.fp&direct=1
design/addflow/Add Companies.html	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/addflow/Add%20Companies.html?t=5e695d2bccd92a297a037fa9aceb0f8f3698b7588de77ae5a13414d3be43e7c3.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782045014.fp&direct=1
design/features/Feature Flags.html	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/features/Feature%20Flags.html?t=51a9dd73304493c37ec5bf091d14ab6d60fa63ecf01e628e84df3d8338ecf52e.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782045015.fp&direct=1
design/Agent Orange.html	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/Agent%20Orange.html?t=e23dd536e61b4c0d6d1f2c915eeff956425705466da99a248b0de5f77b95146e.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782045015.fp&direct=1
design/app/screens2.jsx	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/app/screens2.jsx?t=4715cb45d77b5eed1c06e84c1799f84dd2d609f6d4a5c7b7573e165ccadeb8e8.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782045016.fp&direct=1
EOF

read -r -d '' CC_PROMPT <<'EOF' || true
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
EOF

fetch_all() {
  echo "→ Fetching mobile brief + reference files…"
  mkdir -p design/screens design/styles design/addflow design/features design/app "$PROMPT_DIR"
  while IFS=$'\t' read -r dest url; do
    [[ -z "${dest:-}" ]] && continue
    mkdir -p "$(dirname "$dest")"
    echo "  • $dest"
    curl -fsSL "$url" -o "$dest"
  done <<< "$MANIFEST"
  printf '%s\n' "$CC_PROMPT" > "$PROMPT_DIR/MOBILE_PROMPT.md"
  echo "✓ Files in place. Brief: MOBILE.md  |  Toggle MOBILE in design/Agent Orange.html to preview."
}

launch_cc() {
  if command -v claude >/dev/null 2>&1; then
    echo "→ Launching Claude Code…"
    claude "$(cat "$PROMPT_DIR/MOBILE_PROMPT.md")"
  else
    echo "ℹ Claude Code CLI ('claude') not found. Start it and paste:"
    echo "----------------------------------------------------------------------"
    cat "$PROMPT_DIR/MOBILE_PROMPT.md"
    echo "----------------------------------------------------------------------"
  fi
}

clean() {
  echo "→ Removing transfer scaffolding (keeps MOBILE.md + design/)…"
  rm -rf "$PROMPT_DIR"
  rm -f mobile-handoff.sh
  echo "✓ Cleaned."
}

case "${1:-}" in
  --clean) clean ;;
  --fetch) fetch_all ;;
  "")      fetch_all; launch_cc ;;
  *) echo "Unknown option: $1 (use --fetch | --clean)"; exit 1 ;;
esac
