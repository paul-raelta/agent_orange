"""Thin wrapper around the Anthropic SDK.

Every call funnels through `complete()` so token/cost accounting and the
agent_runs log row happen in one place. Per-call `model=` overrides the
default from routing_rules.

If ANTHROPIC_API_KEY is missing, `complete()` raises a clear error before
hitting the network — agents that depend on it should guard with `is_configured()`.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from anthropic import AsyncAnthropic

from ao.config import cost_for, get_settings
from ao.logging import get_logger

log = get_logger(__name__)

_client: AsyncAnthropic | None = None


def is_configured() -> bool:
    return bool(get_settings().anthropic_api_key)


def get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        key = get_settings().anthropic_api_key
        if not key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY not set — drop one into workers/.env to enable LLM calls."
            )
        _client = AsyncAnthropic(api_key=key)
    return _client


async def complete(
    *,
    model: str,
    messages: list[dict],
    system: str | None = None,
    tools: list[dict] | None = None,
    max_tokens: int = 1024,
    temperature: float = 0.0,
    tool_choice: dict | None = None,
) -> dict[str, Any]:
    """Send a Messages API request; return a structured response dict.

    Output: { "raw": <SDK response>, "input_tokens": int, "output_tokens": int,
              "cost_usd": float, "model": str, "latency_ms": int }.
    Caller is responsible for persisting the agent_runs row if it wants the
    structured trail; this function just does the accounting math.
    """
    client = get_client()
    started = datetime.now(timezone.utc)

    kwargs: dict[str, Any] = {
        "model": model, "messages": messages,
        "max_tokens": max_tokens, "temperature": temperature,
    }
    if system is not None:
        kwargs["system"] = system
    if tools:
        kwargs["tools"] = tools
    if tool_choice:
        kwargs["tool_choice"] = tool_choice

    resp = await client.messages.create(**kwargs)

    finished = datetime.now(timezone.utc)
    latency_ms = int((finished - started).total_seconds() * 1000)
    in_tok = resp.usage.input_tokens
    out_tok = resp.usage.output_tokens
    cost = cost_for(model, in_tok, out_tok)

    log.info(
        "anthropic.call",
        model=model, input_tokens=in_tok, output_tokens=out_tok,
        cost_usd=round(cost, 4), latency_ms=latency_ms,
    )

    return {
        "raw": resp,
        "input_tokens": in_tok,
        "output_tokens": out_tok,
        "cost_usd": cost,
        "model": model,
        "latency_ms": latency_ms,
    }
