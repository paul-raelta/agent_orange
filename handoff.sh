#!/usr/bin/env bash
# =============================================================================
# Agent Orange — "Add Companies" feature handoff
# One script: fetch design files → apply additive frontend bits → launch
# Claude Code with the implementation brief → (optional) clean up scaffolding.
#
# USAGE (run from the repo root, e.g.  ~/.../agent_orange):
#   bash handoff.sh            fetch + apply + launch Claude Code
#   bash handoff.sh --fetch    fetch + apply only (don't launch Claude Code)
#   bash handoff.sh --clean    remove transfer scaffolding (keeps real source)
#   bash handoff.sh --clean-all  also remove the prototype + spec docs
#
# NOTE: the download URLs are security-scoped and expire ~1h after they were
# minted. If a fetch 404s, ask the designer to re-mint and regenerate this file.
# =============================================================================
set -euo pipefail

# ---- guard: must be run from the repo root -------------------------------
if [[ ! -d web/src || ! -d workers ]]; then
  echo "✗ Run this from the agent_orange repo root (expected ./web/src and ./workers)." >&2
  exit 1
fi

PROTO_DIR="design/addflow"
PROMPT_DIR=".handoff"
CSS_TARGET="web/src/styles/app.css"
CSS_MARKER="Add Companies — browse the S&P 500"

# ---- file manifest:  <dest path>  <url> ----------------------------------
# (dest is where the file lands in your repo)
read -r -d '' MANIFEST <<'EOF' || true
ADD_COMPANIES.md	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/design_handoff_agent_orange/ADD_COMPANIES.md?t=f8112cf7888eaa432103fe976eb0095eab4b55caa5d025eaaed15682458cba1e.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1781986390.fp&direct=1
web/src/screens/AddCompanies.tsx	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/screens/AddCompanies.tsx?t=a093d142a5b7d3b8ebf158d3b2dae0a4304d8a7065ea9c5a5ffb63f78f7ba827.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1781986390.fp&direct=1
web/src/data/sp500.ts	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/data/sp500.ts?t=911c96ec14d5c3b116deb75e99c0354c98fc79b5fd093aa2496e3011d1c50edf.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1781986390.fp&direct=1
design/addflow/feature-styles.css	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/addflow/feature-styles.css?t=1910211c153ec783a5267dafde8473fbcb99eff1a6a7111fcc60f0872951a42c.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1781986391.fp&direct=1
design/addflow/Add Companies.html	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/addflow/Add%20Companies.html?t=01e780970b25a85aa5104450efb25a7904ccd0e5c602ad16759077b80b9d95d0.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1781986391.fp&direct=1
design/addflow/addflow.jsx	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/addflow/addflow.jsx?t=90facb4ac287f7d9143c2e9856877487daf6a3097083da02548ec5961ce7b249.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1781986392.fp&direct=1
design/addflow/sp500.js	https://ef4c69e7-b919-4fc4-9158-11cd90a57e22.claudeusercontent.com/v1/design/projects/ef4c69e7-b919-4fc4-9158-11cd90a57e22/serve/addflow/sp500.js?t=b9d96bf8fd5886e3275132b1fdd919ee9f1d569b7b04ceefef040044db09ca99.1962431d-3dc6-459d-8696-8473204c87e4.8711a244-512c-48e6-aeb9-221532567c9c.1781986392.fp&direct=1
EOF

# ---- the instruction Claude Code is launched with ------------------------
read -r -d '' CC_PROMPT <<'EOF' || true
Read ADD_COMPANIES.md at the repo root and implement the "Add Companies" feature.

1. FRONTEND (web/src): apply the §2 additive changes to the EXISTING files
   (api.ts, hooks.ts, types.ts, screens/Companies.tsx). Do NOT overwrite them —
   they have diverged from the design reference (data-sources feature, custom API
   base). Merge the new methods/types/hooks in and preserve all existing code.
   The new files screens/AddCompanies.tsx and data/sp500.ts are already in place,
   and the ac-* styles are already appended to styles/app.css.

2. BACKEND (workers): build GET /universe and POST /companies/batch per the spec,
   wired to the existing Finnhub client + Firestore. Confirm the existing
   discovery endpoints (POST /companies, GET /discovery/:jobId) work; extend the
   discovery result with candidates[] if feasible.

3. Verify: web/ builds clean (tsc + vite), the Companies → Add Companies flow
   matches design/addflow/Add Companies.html (open it for ground truth), then
   run the §9 acceptance checklist. Do not commit until it builds and runs.
EOF

# ---- helpers -------------------------------------------------------------
fetch_all() {
  echo "→ Fetching design files…"
  mkdir -p web/src/data web/src/screens "$PROTO_DIR" "$PROMPT_DIR"
  while IFS=$'\t' read -r dest url; do
    [[ -z "${dest:-}" ]] && continue
    mkdir -p "$(dirname "$dest")"
    echo "  • $dest"
    curl -fsSL "$url" -o "$dest"
  done <<< "$MANIFEST"

  # append feature CSS once (idempotent)
  if grep -qF "$CSS_MARKER" "$CSS_TARGET" 2>/dev/null; then
    echo "  • CSS already present in $CSS_TARGET (skipping append)"
  else
    printf '\n' >> "$CSS_TARGET"
    cat "$PROTO_DIR/feature-styles.css" >> "$CSS_TARGET"
    echo "  • Appended feature CSS → $CSS_TARGET"
  fi
  printf '%s\n' "$CC_PROMPT" > "$PROMPT_DIR/PROMPT.md"
  echo "✓ Files in place. Brief: ADD_COMPANIES.md  |  Prompt: $PROMPT_DIR/PROMPT.md"
}

launch_cc() {
  if command -v claude >/dev/null 2>&1; then
    echo "→ Launching Claude Code…"
    claude "$(cat "$PROMPT_DIR/PROMPT.md")"
  else
    echo "ℹ Claude Code CLI ('claude') not found. Start it yourself and paste:"
    echo "----------------------------------------------------------------------"
    cat "$PROMPT_DIR/PROMPT.md"
    echo "----------------------------------------------------------------------"
  fi
}

clean() {
  echo "→ Removing transfer scaffolding (keeps real source + appended CSS)…"
  rm -f "$PROTO_DIR/feature-styles.css"      # consumed into app.css
  rm -rf "$PROMPT_DIR"
  rm -f handoff.sh
  echo "✓ Cleaned. Kept: web/src/screens/AddCompanies.tsx, web/src/data/sp500.ts,"
  echo "  the appended styles, ADD_COMPANIES.md, and design/addflow/ (prototype)."
}

clean_all() {
  clean
  echo "→ Removing prototype + spec docs too…"
  rm -rf "$PROTO_DIR"
  rm -f ADD_COMPANIES.md
  echo "✓ Full teardown of design scaffolding. (Real source files untouched.)"
}

# ---- dispatch ------------------------------------------------------------
case "${1:-}" in
  --clean)     clean ;;
  --clean-all) clean_all ;;
  --fetch)     fetch_all ;;
  "")          fetch_all; launch_cc ;;
  *) echo "Unknown option: $1  (use --fetch | --clean | --clean-all)"; exit 1 ;;
esac
