"""In-app Help Assistant — `POST /help/ask`.

A grounded chat endpoint. The entire help corpus (workers/ao/help/knowledge.py)
is injected into the system prompt on every call, so the LLM answers only from
verified facts and never invents features. Streams plain-text deltas as SSE so
the UI can render the reply token by token.

Model: pinned to the cheap fast model via the "help" stage (Haiku-class).
Output cap: ~500 tokens — Q&A answers are short.
History: last ~8 turns from the client.

If the Anthropic key isn't configured, the endpoint returns a friendly fallback
so the chat UI still renders something useful (and the launcher works end-to-end
without an API key during dev).
"""
from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ao.agents.registry import model_for
from ao.api.deps import current_user_id, get_db
from ao.config import cost_for, get_settings
from ao.help.prompt import HistoryTurn, build_messages, build_system
from ao.integrations import anthropic_client
from ao.logging import get_logger

log = get_logger(__name__)

router = APIRouter(tags=["help"])

# Stop the LLM from monologuing — Q&A answers are usually 2–4 sentences.
HELP_MAX_TOKENS = 500


class HelpHistoryTurn(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    text: str


class HelpAskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    screen: str | None = Field(default=None, max_length=80)
    history: list[HelpHistoryTurn] | None = None


def _sse(event: str, data: dict | str) -> str:
    """Serialize a single SSE frame. Data is JSON-encoded so the client can
    parse it uniformly whether it's a delta string or a status object."""
    payload = data if isinstance(data, str) else json.dumps(data)
    return f"event: {event}\ndata: {payload}\n\n"


_NO_KEY_FALLBACK = (
    "I can't reach the assistant right now (Anthropic API key isn't configured). "
    "In the meantime, the **Help** page in the sidebar has annotated screenshots of "
    "every screen and feature — start there."
)


async def _stream_anthropic(
    *, model: str, system: str, messages: list[dict],
) -> AsyncIterator[str]:
    """Generator yielding SSE frames as the model produces text.

    Final frame is a `done` event carrying token/cost telemetry — not used by
    the UI today but cheap to surface for future logging."""
    if not anthropic_client.is_configured():
        # Fall back to a friendly canned reply so the panel is still usable
        # in dev without a key.
        yield _sse("delta", {"text": _NO_KEY_FALLBACK})
        yield _sse("done", {"model": "fallback", "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0})
        return

    client = anthropic_client.get_client()
    input_tokens = 0
    output_tokens = 0

    kwargs = {
        "model": model,
        "max_tokens": HELP_MAX_TOKENS,
        "system": system,
        "messages": messages,
    }
    # Older models still want a temperature; opus-4.7 / sonnet-4.6 reject it.
    if not (model.startswith("claude-opus-4-7") or model.startswith("claude-sonnet-4-6")):
        kwargs["temperature"] = 0.3  # a touch of warmth for chat tone

    try:
        async with client.messages.stream(**kwargs) as stream:
            async for text_delta in stream.text_stream:
                if not text_delta:
                    continue
                yield _sse("delta", {"text": text_delta})
            # Final message carries usage; pull it once the stream completes.
            final = await stream.get_final_message()
            input_tokens = final.usage.input_tokens
            output_tokens = final.usage.output_tokens
    except Exception as exc:  # noqa: BLE001
        log.error("help.stream_failed", error=str(exc))
        yield _sse("error", {"message": "Sorry — I had trouble answering that. Please try again in a moment."})
        return

    cost = cost_for(model, input_tokens, output_tokens)
    log.info(
        "help.call",
        model=model, input_tokens=input_tokens, output_tokens=output_tokens,
        cost_usd=round(cost, 4),
    )
    yield _sse("done", {
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cost_usd": cost,
    })


@router.post("/help/ask")
async def help_ask(
    body: HelpAskRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(current_user_id),
):
    """Stream a grounded answer to a user's question about the app."""
    settings = get_settings()
    # Routing rules table doesn't get seeded with a Help row by default; the
    # registry falls back to settings.default_model_help.
    try:
        model = await model_for(db, user_id, "help")
    except Exception as exc:  # noqa: BLE001
        log.warning("help.model_lookup_failed", error=str(exc))
        model = settings.default_model_help

    system = build_system(body.screen)
    history: list[HistoryTurn] | None = None
    if body.history:
        history = [{"role": t.role, "text": t.text} for t in body.history]
    messages = build_messages(history, body.question)

    async def _gen() -> AsyncIterator[str]:
        async for frame in _stream_anthropic(model=model, system=system, messages=messages):
            yield frame
            # Cooperative yield so multiple clients streaming in parallel
            # don't starve each other on tiny deltas.
            await asyncio.sleep(0)

    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
