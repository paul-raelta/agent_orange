#!/usr/bin/env bash
# =============================================================================
# Agent Orange — Help / User Guide handoff
# Fetches the help page + assets into the repo, then launches Claude Code to
# wire it into the app.
#
# USAGE (from the repo root, e.g.  ~/.../agent_orange):
#   bash help-handoff.sh            fetch + launch Claude Code
#   bash help-handoff.sh --fetch    fetch only
#   bash help-handoff.sh --clean    remove transfer scaffolding
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
HELP.md	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/design_handoff_agent_orange/HELP.md?t=eb450710179d0685e17898785b39bf9641139ff076dff7c4b13c2ed2ac0ef728.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040377.fp&direct=1
design/help/Help.html	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/Help.html?t=506bd444fd7cee9034307911aa0483f79c514e5b160168dec559a0fdb6d8ee2c.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040338.fp&direct=1
design/help/helpdata.js	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/helpdata.js?t=abc9f5529e6631e124750aa92e2b164d757b5302e239ee757f0fe1dbf58278c8.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040339.fp&direct=1
design/help/img/watchlist.jpg	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/img/watchlist.jpg?t=caa787c006ae35ad3fe619723266bc8af0f3b5fd53305617b62bf6bc570dd50e.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040339.fp&direct=1
design/help/img/company.jpg	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/img/company.jpg?t=aefa16da5ea6de9f9be7313d62525bb3e81e9e5191fe37e9aa125994d0a114f7.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040340.fp&direct=1
design/help/img/validation.jpg	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/img/validation.jpg?t=0e63e75f9a94f51e1abfe7f1b33d5f237177663c421fe860b2cab4aaa931ee43.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040340.fp&direct=1
design/help/img/timeline.jpg	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/img/timeline.jpg?t=bedabd312993eeb7ac91c35a8b1ea6e0e424842e1a0b951df52fdd32c2fc9132.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040341.fp&direct=1
design/help/img/review.jpg	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/img/review.jpg?t=bec5061f3889771db2129c072a8eb1e9a5015ad9a22822fade03ff2150f2a70a.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040341.fp&direct=1
design/help/img/activity.jpg	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/img/activity.jpg?t=60e0433dbe7aa42e5edf338ddc21e7781a6d3e10e82abd2d24e9d2996d228f87.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040341.fp&direct=1
design/help/img/settings.jpg	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/img/settings.jpg?t=ce87f99c4ce95a3659d22257966e9222a48c33920ab860bd57364a2d3106de36.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040347.fp&direct=1
design/help/img/mobile.jpg	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/img/mobile.jpg?t=d60f5d3384e650ac01cf69e9bccb9282e71268cc27458cac32aacc2ec29e1743.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040348.fp&direct=1
design/help/img/provenance.jpg	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/img/provenance.jpg?t=cce493dc40ff56c629ffa1d0586308b541d41ea62f952026b58b3f26f5a3f82a.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040348.fp&direct=1
design/help/img/addcompanies.jpg	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/img/addcompanies.jpg?t=abc6dae2a881d9820bbad3e6c31e009e10f774028cbbb6f18f17d8ae4a4b2aba.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040349.fp&direct=1
design/help/img/features.jpg	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/img/features.jpg?t=2ca25db98838789b299a34407baea8bbacdb56509e34df7ace9a095a00b2dc88.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040349.fp&direct=1
design/help/img/tweaks.jpg	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/help/img/tweaks.jpg?t=19e9a0b4335382a8d50529f54a797d20337d4130f2ea6924baacddb64078ddce.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1782040349.fp&direct=1
EOF

read -r -d '' CC_PROMPT <<'EOF' || true
Read HELP.md at the repo root and ship the Agent Orange help page.

The guide is a self-contained, data-driven page now in design/help/ (Help.html shell +
helpdata.js content + img/*.jpg annotated screenshots; numbered pins → callouts, sticky
TOC, scroll-spy — all vanilla, no build step).

Integrate it (Option A, recommended): copy design/help/ → web/public/help/ so Vite serves
it at /help/Help.html, then add a "Help" item to the sidebar nav (and the mobile tab bar)
linking to it, using the existing nav styling (a ? or book glyph). Keep the Labs section
gated by the same feature flags as FEATURES.md if those have shipped.

Verify: the page opens, images load under the chosen host path, TOC scroll-spy and
pin/callout hover-linking work, and a Help link exists in desktop + mobile nav. web/
builds clean. Commit.
EOF

fetch_all() {
  echo "→ Fetching help page + assets…"
  mkdir -p design/help/img "$PROMPT_DIR"
  while IFS=$'\t' read -r dest url; do
    [[ -z "${dest:-}" ]] && continue
    mkdir -p "$(dirname "$dest")"
    echo "  • $dest"
    curl -fsSL "$url" -o "$dest"
  done <<< "$MANIFEST"
  printf '%s\n' "$CC_PROMPT" > "$PROMPT_DIR/HELP_PROMPT.md"
  echo "✓ Files in place. Brief: HELP.md  |  Page: design/help/Help.html"
}

launch_cc() {
  if command -v claude >/dev/null 2>&1; then
    echo "→ Launching Claude Code…"
    claude "$(cat "$PROMPT_DIR/HELP_PROMPT.md")"
  else
    echo "ℹ Claude Code CLI ('claude') not found. Start it and paste:"
    echo "----------------------------------------------------------------------"
    cat "$PROMPT_DIR/HELP_PROMPT.md"
    echo "----------------------------------------------------------------------"
  fi
}

clean() {
  echo "→ Removing transfer scaffolding (keeps HELP.md + design/help/)…"
  rm -rf "$PROMPT_DIR"
  rm -f help-handoff.sh
  echo "✓ Cleaned."
}

case "${1:-}" in
  --clean) clean ;;
  --fetch) fetch_all ;;
  "")      fetch_all; launch_cc ;;
  *) echo "Unknown option: $1 (use --fetch | --clean)"; exit 1 ;;
esac
