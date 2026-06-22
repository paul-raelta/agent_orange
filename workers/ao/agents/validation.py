"""Validation stage — Opus, deterministic, structured tool output.

Cross-references the metric locations from extraction. If two distinct
locations agree (within tolerance), confidence high. If they disagree, the
finding is routed to the review queue — NEVER auto-resolved. The
SanDisk-style GAAP-vs-non-GAAP case is the canonical demo of this.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ao.agents import demo_fixtures, prompts
from ao.agents.extraction import ExtractedMetric
from ao.agents.registry import model_for
from ao.agents.runlog import run_log
from ao.api.serializers import serialize_validation_thresholds
from ao.integrations import anthropic_client
from ao.logging import get_logger

log = get_logger(__name__)


@dataclass
class MetricVerdict:
    key: str
    conf: str  # high|med|low
    reason: str = ""
    accept_value: str = ""
    alternative_values: list[dict] = field(default_factory=list)


@dataclass
class ValidationOutput:
    passed: bool
    rule: str
    detail: str
    corroborations: int
    conflict: bool
    per_metric: list[MetricVerdict]


def _default_rule() -> str:
    return "Cross-reference EPS in ≥2 locations"


async def validate_metrics(
    session, user_id: str, *,
    company_id: str, ticker: str,
    extracted: list[ExtractedMetric],
    demo_replay: bool = False,
    demo_save: bool = False,
) -> ValidationOutput | None:
    async with run_log(session, user_id, ticker, stage="validation",
                       company_id=company_id) as rec:
        if demo_replay:
            payload = demo_fixtures.load(ticker) or {}
            replay = demo_fixtures.to_validation_output(payload.get("validation"))
            if replay is None:
                rec.set(level="info",
                        message="demo_mode: no validation fixture; skipped.")
                return None
            await demo_fixtures.throttle("validation")
            rec.set(
                level="ok" if replay.passed else "warn",
                model="demo-fixture", cost_usd=0.0,
                input_tokens=0, output_tokens=0,
                message=(
                    f"Replayed validation {'PASSED' if replay.passed else 'FAILED'}"
                    f" — {len(replay.per_metric)} metrics."
                ),
            )
            return replay

        if not anthropic_client.is_configured():
            rec.set(level="warn",
                    message="ANTHROPIC_API_KEY not set — validation skipped.")
            return None

        if not extracted:
            rec.set(level="warn", message="No extracted metrics to validate.")
            return None

        model = await model_for(session, user_id, "validation")
        thresholds = await serialize_validation_thresholds(session, user_id)
        system_prompt = prompts.validation_system(
            eps_abs=thresholds.epsAbs,
            margin_pct=thresholds.marginPct,
            revenue_pct=thresholds.revenuePct,
        )
        payload = [
            {
                "key": e.key, "value": e.display_value, "raw": e.raw_value,
                "page": e.page, "source_label": e.source_label,
                "quote": e.quote, "verified": e.verified,
            }
            for e in extracted
        ]

        try:
            result: dict[str, Any] = await anthropic_client.complete(
                model=model,
                system=system_prompt,
                messages=[{"role": "user", "content": str(payload)}],
                tools=[prompts.VALIDATION_TOOL],
                tool_choice={"type": "tool", "name": "record_validation"},
                max_tokens=2048,
            )
        except Exception as exc:  # noqa: BLE001
            rec.set(level="error", model=model,
                    message=f"Validation LLM call failed: {exc.__class__.__name__}: {exc}")
            return None

        rec.set(
            model=model,
            prompt_version=prompts.PROMPT_VERSION_VALIDATION,
            input_tokens=result["input_tokens"],
            output_tokens=result["output_tokens"],
            cost_usd=result["cost_usd"],
        )

        for block in result["raw"].content:
            if getattr(block, "type", None) == "tool_use":
                args = block.input
                per_metric = [
                    MetricVerdict(
                        key=m["key"], conf=m.get("conf", "med"),
                        reason=m.get("reason", ""),
                        accept_value=m.get("accept_value", ""),
                        alternative_values=m.get("alternative_values", []),
                    )
                    for m in args.get("per_metric", [])
                ]
                out = ValidationOutput(
                    passed=bool(args.get("passed", False)),
                    rule=args.get("rule", _default_rule()),
                    detail=args.get("detail", ""),
                    corroborations=int(args.get("corroborations", 0)),
                    conflict=bool(args.get("conflict", False)),
                    per_metric=per_metric,
                )
                rec.set(
                    level="ok" if out.passed else "warn",
                    message=f"Validation {'PASSED' if out.passed else 'FAILED'} — {len(per_metric)} metrics judged.",
                )
                if demo_save:
                    demo_fixtures.save(ticker, "validation", out)
                return out

        rec.set(level="error", message="Validation tool was not called.")
        return None
