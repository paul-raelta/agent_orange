#!/usr/bin/env bash
# =============================================================================
# Agent Orange — Motion / UX polish handoff
# Fetches the motion layer into the repo, then launches Claude Code to wire it in.
#
# USAGE (from the repo root, e.g. ~/.../agent_orange):
#   bash motion-handoff.sh            fetch + launch Claude Code
#   bash motion-handoff.sh --fetch    fetch only (don't launch)
#   bash motion-handoff.sh --clean    remove transfer scaffolding (keeps source)
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
MOTION.md	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/design_handoff_agent_orange/MOTION.md?t=854d29bf886a5d439760b3183b74639a0a8eef92dd121460667db99066bd8cdd.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1781989027.fp&direct=1
web/src/styles/motion.css	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/motion/dist/motion.css?t=752f2adce94968450e1f7cb6d32fc530bb2426a23da91fe9ead3e119d270f3b2.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1781989028.fp&direct=1
web/src/motion/motion.tsx	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/motion/dist/motion.tsx?t=f1dcf9c4d06d68eb27f2cabd3fb67fe4d1fbd8d4ceb0712560c0a1eda8367555.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1781989028.fp&direct=1
design/motion/Motion Lab.html	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/motion/Motion%20Lab.html?t=4410f2ffb9cf92155226da3ad9bf2267fbd31acbb7f2622ae2f4c6d53b6ccb02.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1781989029.fp&direct=1
design/motion/motionlab.jsx	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/motion/motionlab.jsx?t=9b278a7cc1322c5b56f42641f9d3580685b75f1347c2c1fcd3a1c65976e364b4.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1781989029.fp&direct=1
EOF

read -r -d '' CC_PROMPT <<'EOF' || true
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
EOF

fetch_all() {
  echo "→ Fetching motion layer…"
  mkdir -p web/src/styles web/src/motion design/motion "$PROMPT_DIR"
  while IFS=$'\t' read -r dest url; do
    [[ -z "${dest:-}" ]] && continue
    mkdir -p "$(dirname "$dest")"
    echo "  • $dest"
    curl -fsSL "$url" -o "$dest"
  done <<< "$MANIFEST"
  printf '%s\n' "$CC_PROMPT" > "$PROMPT_DIR/MOTION_PROMPT.md"
  echo "✓ Files in place. Brief: MOTION.md  |  Prompt: $PROMPT_DIR/MOTION_PROMPT.md"
}

launch_cc() {
  if command -v claude >/dev/null 2>&1; then
    echo "→ Launching Claude Code…"
    claude "$(cat "$PROMPT_DIR/MOTION_PROMPT.md")"
  else
    echo "ℹ Claude Code CLI ('claude') not found. Start it and paste:"
    echo "----------------------------------------------------------------------"
    cat "$PROMPT_DIR/MOTION_PROMPT.md"
    echo "----------------------------------------------------------------------"
  fi
}

clean() {
  echo "→ Removing transfer scaffolding (keeps motion.css/motion.tsx + MOTION.md)…"
  rm -rf "$PROMPT_DIR"
  rm -f motion-handoff.sh
  echo "✓ Cleaned. Kept the real source + the prototype under design/motion/."
}

case "${1:-}" in
  --clean) clean ;;
  --fetch) fetch_all ;;
  "")      fetch_all; launch_cc ;;
  *) echo "Unknown option: $1 (use --fetch | --clean)"; exit 1 ;;
esac
