"""Prompt assembly for the in-app Help Assistant.

Mirrors `design/help/agent/helpagent.jsx::buildPrompt` exactly — same persona,
guardrails (verbatim), style guide, screen-context line, fenced corpus, and
last-~8 history turns. The assembled string is split into:
  - system: persona + rules + style + context + KNOWLEDGE block
  - messages: prior conversation + current question (Anthropic Messages API shape)
"""
from __future__ import annotations

from typing import Iterable, TypedDict

from ao.help.knowledge import AO_KB, AO_KB_TEXT


class HistoryTurn(TypedDict):
    role: str  # "user" | "assistant"
    text: str


HISTORY_LIMIT = 8


def build_system(screen: str | None) -> str:
    """The full grounding block. Equivalent to the JS buildPrompt up to and
    including the KNOWLEDGE fences."""
    rules = "\n".join(f"{i + 1}. {g}" for i, g in enumerate(AO_KB["guardrails"]))
    screen_label = screen if screen else "Watchlist"
    return "\n".join([
        f"You are the {AO_KB['product']['name']} Help Assistant — a friendly, "
        "concise in-app guide that helps people use the site.",
        "",
        "RULES (follow strictly):",
        rules,
        "",
        "STYLE: Warm and human, but brief — usually 2–4 sentences. "
        "For \"how do I…\" questions, give a short numbered list of steps. "
        "Name the exact screen or control (e.g. \"Settings → Model routing\"). "
        "Plain text only; you may use **bold** for screen/control names. No headings. "
        "If the answer is not in the KNOWLEDGE, say you're not certain and suggest "
        "where in the app to look or to contact support.",
        "",
        f"CONTEXT: The user is currently on the \"{screen_label}\" screen.",
        "",
        "=== KNOWLEDGE (your only source of truth) ===",
        AO_KB_TEXT,
        "=== END KNOWLEDGE ===",
    ])


def build_messages(history: Iterable[HistoryTurn] | None, question: str) -> list[dict]:
    """Convert prior history + the new question into Anthropic Messages format.

    Anthropic wants alternating user/assistant turns; the JS prototype just
    concatenated everything into one prompt — equivalent semantically. We use
    real turns so the model sees a proper conversation."""
    msgs: list[dict] = []
    if history:
        recent = list(history)[-HISTORY_LIMIT:]
        for turn in recent:
            role = "user" if turn.get("role") == "user" else "assistant"
            text = (turn.get("text") or "").strip()
            if not text:
                continue
            msgs.append({"role": role, "content": text})
    msgs.append({"role": "user", "content": question.strip()})
    return msgs
