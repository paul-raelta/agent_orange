# Handoff: Help Assistant — grounded in-app help agent

> **For Claude Code.** Ship an in-app **Help Assistant**: a chat agent that answers questions about using
> Agent Orange. It is **grounded** — the entire help knowledge base is injected into the system prompt every
> turn, so it answers only from verified facts and never invents features. A working prototype is provided
> (`design/help/agent/`); build the production version: a `/help/ask` backend + the chat UI in `web/`.

## What's provided (in `design/help/agent/`)
- `knowledge.js` — **the corpus.** `window.AO_KB` (structured: product, glossary, screens, tasks, faqs,
  troubleshooting, guardrails, starters) + `window.AO_KB_TEXT` (the serialized block sent to the model).
  **This is the single source of truth** — port it to the backend (e.g. `workers/ao/help/knowledge.py` or a
  JSON asset) verbatim.
- `helpagent.jsx` — the prototype chat UI + prompt assembly (`buildPrompt`) + a light markdown formatter.
- `Help Assistant.html` — the floating launcher + panel, styled to the design system. Visual ground truth.

## Backend — `POST /help/ask`
Request: `{ question: string, screen?: string, history?: {role:'user'|'assistant', text:string}[] }`
Response: streamed assistant text (SSE or chunked), or `{ answer: string }` non-streamed.

Build the prompt exactly like the prototype's `buildPrompt` (see `helpagent.jsx`):
1. **Persona** — "the Agent Orange Help Assistant, a friendly concise in-app guide."
2. **Rules** — the `guardrails` array from the KB, verbatim (scope to site usage; **never give investment
   advice**; never invent features; don't assert live figures — point to the Provenance drawer; name exact
   screens/controls).
3. **Style** — warm, brief (2–4 sentences); numbered steps for "how do I"; `**bold**` for screen names.
4. **Context** — `The user is currently on the "<screen>" screen.`
5. **The full corpus** — `AO_KB_TEXT` between `=== KNOWLEDGE ===` fences.
6. **History** (last ~8 turns) + the new question.

**Model:** route via the existing provider-agnostic **model routing** — add a `help` task pinned to a cheap,
fast model (Haiku/Sonnet). Help Q&A does not need Opus. Keep an output cap (~400–600 tokens).
**Stream** the reply for a human feel. The whole corpus is small (~3–4k tokens) so it fits in context every
call — **no vector DB / retrieval needed** yet; add retrieval only if the KB outgrows the window.

## Frontend — the chat panel in `web/`
Port `Help Assistant.html` + `helpagent.jsx` to a React component mounted app-wide (so it's reachable on every
screen), calling `POST /help/ask` instead of `window.claude.complete`:
- A floating launcher (bottom-right) that opens the panel; persists open/closed.
- **Auto-fill `screen`** from the current route (replace the prototype's manual selector with the real route).
- Pass recent `history`; render streamed tokens; keep the typing indicator, starter chips (`AO_KB.starters`),
  the markdown formatter, and the "not investment advice" footer.
- Use the design tokens already in the app (the prototype's CSS is token-based; map class styles into your
  CSS strategy).

## Keep it grounded & improving
- The backend prompt must use the **same** corpus the help page uses — keep `knowledge.js` (or its port) the
  one source so the assistant and the `/help` guide never drift.
- **Log unanswered / low-confidence questions** (and 👍/👎 if you add feedback) — that list is the backlog of
  what to add to the corpus.

## Guardrails to verify (acceptance)
- [ ] "Should I buy X?" → declines warmly, redirects to how data is sourced/validated (no advice).
- [ ] Off-topic question → politely scoped back to the app.
- [ ] A made-up feature ("where's the dark-pool scanner?") → says it's not sure / not a feature, suggests where to look.
- [ ] "How do I add a company?" → correct numbered steps naming **Companies → ADD COMPANIES**.
- [ ] Answer adapts to the passed `screen`.
- [ ] Launcher reachable on every screen; streaming works; `web/` builds clean. Commit.
