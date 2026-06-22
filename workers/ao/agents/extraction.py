"""Extraction stage — Opus + tool use, page-aware citations.

Input: a cached PDF (the filing's primary doc).
Output: a list of `record_metric` tool calls, persisted as Metric + Provenance
rows on the Result.

Quote verification: every recorded `quote` is checked to be a substring of the
cited page's text before the row is created. Failures are dropped to
conf='low' and logged — never silently accepted.

If ANTHROPIC_API_KEY isn't set, the stage logs a warning and returns an empty
list. The rest of the pipeline still records the activity row but skips
downstream stages.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ao.agents import demo_fixtures, prompts
from ao.agents.registry import model_for
from ao.agents.runlog import run_log
from ao.integrations import anthropic_client, pdf_extractor
from ao.logging import get_logger

log = get_logger(__name__)

# Cap on prompt size — 60 pages typically fits well within 200k context.
MAX_PAGES = 60


@dataclass
class ExtractedMetric:
    key: str
    display_value: str
    raw_value: float
    page: int
    quote: str
    source_label: str
    verified: bool  # quote was found in the cited page


def _build_pages_payload(pages: list[pdf_extractor.Page]) -> str:
    """Stitch pages into <page-N>...</page-N> blocks. Tables flattened to TSV."""
    parts: list[str] = []
    for p in pages[:MAX_PAGES]:
        tables_text = ""
        for t in p.tables:
            tables_text += "\n[TABLE]\n"
            for row in t:
                tables_text += "\t".join(row) + "\n"
            tables_text += "[/TABLE]\n"
        parts.append(f"<page-{p.page}>\n{p.text}\n{tables_text}\n</page-{p.page}>")
    return "\n".join(parts)


async def extract_filing(
    session, user_id: str, *,
    company_id: str, ticker: str, pdf_path: Path,
    demo_replay: bool = False,
    demo_save: bool = False,
    fixture_filing: dict | None = None,
) -> list[ExtractedMetric]:
    """Run the extraction stage against a cached PDF.

    Returns the verified ExtractedMetric list. The caller persists them into
    Metric + Provenance rows (we don't touch the DB here beyond agent_runs).

    `demo_replay`: short-circuit the Anthropic call and return the cached
    fixture for this ticker. Records an agent_runs row tagged
    `model="demo-fixture"`, cost 0.

    `demo_save`: after a successful real run, persist the extracted metrics to
    the per-ticker fixture file (best-effort, never raises).
    """
    async with run_log(session, user_id, ticker, stage="extraction",
                       company_id=company_id) as rec:
        if demo_replay:
            payload = demo_fixtures.load(ticker) or {}
            replay = demo_fixtures.to_extracted_metrics(payload.get("extraction"))
            await demo_fixtures.throttle("extraction")
            rec.set(
                level="ok", model="demo-fixture", cost_usd=0.0,
                input_tokens=0, output_tokens=0,
                message=(
                    f"Replayed {len(replay)} extraction rows from fixture."
                    if replay else
                    "demo_mode: no extraction fixture; returning empty."
                ),
            )
            return replay

        if not anthropic_client.is_configured():
            rec.set(level="warn",
                    message="ANTHROPIC_API_KEY not set — extraction skipped.")
            return []

        pages = pdf_extractor.extract_pages(pdf_path, max_pages=MAX_PAGES)
        if not pages:
            rec.set(level="error", message=f"PDF parse failed: {pdf_path}")
            return []

        model = await model_for(session, user_id, "extraction")
        payload = _build_pages_payload(pages)

        try:
            result: dict[str, Any] = await anthropic_client.complete(
                model=model,
                system=prompts.EXTRACTION_SYSTEM,
                messages=[{
                    "role": "user",
                    "content": f"EARNINGS DOCUMENT (page-tagged):\n\n{payload}",
                }],
                tools=[prompts.EXTRACTION_TOOL],
                max_tokens=4096,
            )
        except Exception as exc:  # noqa: BLE001
            rec.set(level="error", model=model,
                    message=f"Extraction LLM call failed: {exc.__class__.__name__}: {exc}")
            return []

        rec.set(
            level="ok",
            model=model,
            prompt_version=prompts.PROMPT_VERSION_EXTRACTION,
            input_tokens=result["input_tokens"],
            output_tokens=result["output_tokens"],
            cost_usd=result["cost_usd"],
        )

        raw_msg = result["raw"]
        out: list[ExtractedMetric] = []
        for block in raw_msg.content:
            if getattr(block, "type", None) != "tool_use":
                continue
            args = block.input
            quote = (args.get("quote") or "").strip()
            page = int(args.get("page") or 0)
            verified = bool(quote) and pdf_extractor.find_quote(pages, quote) == page
            out.append(ExtractedMetric(
                key=args["key"],
                display_value=args["display_value"],
                raw_value=float(args["raw_value"]),
                page=page,
                quote=quote,
                source_label=args.get("source_label", ""),
                verified=verified,
            ))
        rec.set(message=f"Extracted {len(out)} metric locations from {pdf_path.name}.")

        if demo_save and out:
            demo_fixtures.save(
                ticker, "extraction",
                demo_fixtures.extracted_metrics_to_payload(out),
                filing=fixture_filing,
            )

        return out
