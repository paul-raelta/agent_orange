"""Narrative summary — Opus, 2–3 sentences, hard token cap."""
from __future__ import annotations

from ao.agents import prompts
from ao.agents.registry import model_for
from ao.agents.runlog import run_log
from ao.integrations import anthropic_client
from ao.logging import get_logger

log = get_logger(__name__)

MAX_TOKENS = 200  # ~150 + some headroom for the 2-3 sentence cap.


async def write_narrative(
    session, user_id: str, *,
    company_id: str, ticker: str,
    current: dict[str, str],
    prior_q: dict[str, str] | None = None,
    prior_y: dict[str, str] | None = None,
) -> str | None:
    """Produce a 2-3 sentence "what's worth knowing" summary.

    current / prior_q / prior_y are display-value dicts keyed by metric name.
    """
    async with run_log(session, user_id, ticker, stage="narrative",
                       company_id=company_id) as rec:
        if not anthropic_client.is_configured():
            rec.set(level="warn",
                    message="ANTHROPIC_API_KEY not set — narrative skipped.")
            return None

        model = await model_for(session, user_id, "narrative")
        ctx = {"current": current}
        if prior_q:
            ctx["prior_quarter"] = prior_q
        if prior_y:
            ctx["prior_year"] = prior_y

        try:
            result = await anthropic_client.complete(
                model=model,
                system=prompts.NARRATIVE_SYSTEM,
                messages=[{"role": "user", "content": f"Quarter context: {ctx}"}],
                max_tokens=MAX_TOKENS,
                temperature=0.0,
            )
        except Exception as exc:  # noqa: BLE001
            rec.set(level="error", model=model,
                    message=f"Narrative LLM call failed: {exc.__class__.__name__}: {exc}")
            return None

        text = ""
        for block in result["raw"].content:
            if getattr(block, "type", None) == "text":
                text = block.text.strip()
                break

        rec.set(
            level="ok",
            message=f"Narrative written ({len(text)} chars).",
            model=model,
            prompt_version=prompts.PROMPT_VERSION_NARRATIVE,
            input_tokens=result["input_tokens"],
            output_tokens=result["output_tokens"],
            cost_usd=result["cost_usd"],
        )
        return text or None
