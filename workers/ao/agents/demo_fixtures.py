"""Demo-mode fixture store — on-disk cache of the four LLM stages.

When demo mode is on, the pipeline replays a saved fixture instead of calling
Anthropic. When demo mode is off, each successful Anthropic-backed stage saves
its output here best-effort, so the NEXT demo-mode run for that ticker can
replay it.

Layout: one JSON file per ticker, all four stages bundled.

    workers/ao/fixtures/
        NVDA/fixture.json
        SNDK/fixture.json
        MU/fixture.json
        AAPL/fixture.json   ← created by a real run

NVDA / SNDK / MU ship in the repo (see scripts/export_seed_fixtures.py). The
rest are gitignored — they're local artefacts of whatever you ran.
"""
from __future__ import annotations

import json
import os
import tempfile
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Literal

from ao.logging import get_logger

log = get_logger(__name__)

Stage = Literal["filing", "extraction", "validation", "narrative", "confidence"]

FIXTURE_DIR = Path(__file__).resolve().parent.parent / "fixtures"


# ---------------------------------------------------------------------------
# Lookup helpers
# ---------------------------------------------------------------------------


def _ticker_path(ticker: str) -> Path:
    return FIXTURE_DIR / ticker.upper() / "fixture.json"


def has_fixture(ticker: str) -> bool:
    """True if a fixture file exists for this ticker on disk."""
    return _ticker_path(ticker).is_file()


def list_tickers() -> list[str]:
    """All tickers that currently have a fixture on disk."""
    if not FIXTURE_DIR.is_dir():
        return []
    out: list[str] = []
    for child in FIXTURE_DIR.iterdir():
        if child.is_dir() and (child / "fixture.json").is_file():
            out.append(child.name.upper())
    return sorted(out)


def load(ticker: str) -> dict[str, Any] | None:
    """Read the full fixture file for a ticker. Returns None cleanly on
    missing or malformed files (logs a structured warning, never raises)."""
    path = _ticker_path(ticker)
    if not path.is_file():
        return None
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        log.warning(
            "demo_fixtures.load_failed",
            ticker=ticker, path=str(path), error=str(exc),
        )
        return None


def save(
    ticker: str,
    stage: Stage,
    payload: Any,
    *,
    filing: dict | None = None,
) -> bool:
    """Read-modify-write the per-ticker fixture file.

    Best-effort: catches and logs all OSError; never raises into the caller.
    Atomic via tempfile + os.replace so a crash mid-write cannot corrupt an
    existing fixture.

    `filing` (if supplied) updates the top-level "filing" block — typically
    passed by the extraction stage on the first save of a run.
    """
    path = _ticker_path(ticker)
    try:
        existing: dict[str, Any] = load(ticker) or {}
        existing[stage] = _normalize(payload)
        if filing is not None:
            existing["filing"] = filing
        path.parent.mkdir(parents=True, exist_ok=True)
        # Atomic write: dump into a sibling tempfile, then replace.
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8",
            dir=str(path.parent), prefix=".fixture-", suffix=".tmp",
            delete=False,
        ) as tmp:
            json.dump(existing, tmp, indent=2, sort_keys=False)
            tmp_path = tmp.name
        os.replace(tmp_path, path)
        return True
    except OSError as exc:
        log.warning(
            "demo_fixtures.save_failed",
            ticker=ticker, stage=stage, path=str(path), error=str(exc),
        )
        return False


def _normalize(payload: Any) -> Any:
    """Coerce dataclass / model instances into plain JSON-serialisable shapes."""
    if payload is None:
        return None
    if is_dataclass(payload) and not isinstance(payload, type):
        return _normalize(asdict(payload))
    if isinstance(payload, dict):
        return {k: _normalize(v) for k, v in payload.items()}
    if isinstance(payload, list):
        return [_normalize(v) for v in payload]
    if isinstance(payload, tuple):
        return [_normalize(v) for v in payload]
    return payload


# ---------------------------------------------------------------------------
# Typed-object adapters — rehydrate stage outputs from JSON dicts
# ---------------------------------------------------------------------------


def to_extracted_metrics(rows: list[dict] | None) -> list:
    """Hydrate extraction fixture rows into ExtractedMetric dataclasses."""
    from ao.agents.extraction import ExtractedMetric  # local import to dodge cycles

    if not rows:
        return []
    out: list[ExtractedMetric] = []
    for r in rows:
        out.append(ExtractedMetric(
            key=r["key"],
            display_value=r.get("display_value", ""),
            raw_value=float(r.get("raw_value", 0.0)),
            page=int(r.get("page", 0)),
            quote=r.get("quote", "") or "",
            source_label=r.get("source_label", "") or "",
            verified=bool(r.get("verified", False)),
        ))
    return out


def to_validation_output(d: dict | None):
    """Hydrate a ValidationOutput from its fixture dict (or None)."""
    from ao.agents.validation import MetricVerdict, ValidationOutput

    if not d:
        return None
    per_metric = [
        MetricVerdict(
            key=row.get("key", ""),
            conf=row.get("conf", "med"),
            reason=row.get("reason", "") or "",
            accept_value=row.get("accept_value", "") or "",
            alternative_values=row.get("alternative_values", []) or [],
        )
        for row in d.get("per_metric", []) or []
    ]
    return ValidationOutput(
        passed=bool(d.get("passed", False)),
        rule=d.get("rule", "") or "",
        detail=d.get("detail", "") or "",
        corroborations=int(d.get("corroborations", 0) or 0),
        conflict=bool(d.get("conflict", False)),
        per_metric=per_metric,
    )


def to_narrative(s: str | None) -> str | None:
    if not s:
        return None
    return s.strip() or None


def to_confidence_output(d: dict | None):
    from ao.agents.confidence import ConfidenceFactor, ConfidenceOutput, band_for

    if not d:
        return None
    pct = max(0, min(100, int(d.get("overall_pct", 0) or 0)))
    factors = [
        ConfidenceFactor(
            name=f.get("name", "") or "",
            weight=float(f.get("weight", 0.0) or 0.0),
            impact=f.get("impact", "neutral") or "neutral",
            signal=f.get("signal", "") or "",
            detail=f.get("detail", "") or "",
        )
        for f in d.get("factors", []) or []
    ]
    return ConfidenceOutput(
        overall_pct=pct,
        band=band_for(pct),
        summary=d.get("summary", "") or "",
        factors=factors,
    )


def extracted_metrics_to_payload(extracted: list) -> list[dict]:
    """Inverse of to_extracted_metrics — for saving."""
    return [
        {
            "key": e.key,
            "display_value": e.display_value,
            "raw_value": e.raw_value,
            "page": e.page,
            "quote": e.quote,
            "source_label": e.source_label,
            "verified": e.verified,
        }
        for e in extracted
    ]
