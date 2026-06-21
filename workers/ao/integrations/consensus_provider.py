"""Street-consensus estimates provider (stub).

Feature 1 (flags.consensus). The real implementation would call a Street-
estimates endpoint (Finnhub `/stock/eps-estimate`, `/stock/revenue-estimate`)
and attach the result to each Metric. Until that exists this provider returns
a deterministic stub estimate — enough to drive the surprise chips, beat/miss
banner and CONS/SURP columns end-to-end against real data the user already
has on disk.

Key contract: this module is ONLY imported / called from the serializer when
flags.consensus is True for the user. With the flag off the backend does no
work for this feature.
"""
from __future__ import annotations

from ao.api import schemas as s


# Demo-ticker overrides — match the figures in design/features/* so the LABS
# walkthrough lands on familiar numbers (NVDA Q1 FY26 from the prototype).
_OVERRIDES: dict[tuple[str, str], tuple[float, str, int]] = {
    # (ticker, metric_key) → (estimate, label, source_count)
    ("NVDA", "Revenue"): (43.30e9, "$43.30B", 28),
    ("NVDA", "EPS · diluted"): (2.29, "$2.29", 31),
    ("NVDA", "Net income"): (17.9e9, "$17.9B", 22),
    ("NVDA", "Gross margin"): (78.0, "78.0%", 14),
    ("NVDA", "EPS · basic"): (2.30, "$2.30", 18),
    ("SNDK", "Revenue"): (1.95e9, "$1.95B", 12),
    ("SNDK", "EPS · diluted"): (0.78, "$0.78", 9),
    ("MU", "Revenue"): (7.8e9, "$7.80B", 21),
    ("MU", "EPS · diluted"): (1.10, "$1.10", 18),
}

# Fallback: estimate sits ~1.8% below the actual so most metrics read as a
# modest BEAT. Engineering-time hack — replace with a real provider call.
_DEFAULT_SHADE = 0.982
_DEFAULT_SOURCE_COUNT = 12


def _fmt_label(raw: float, key: str) -> str:
    """Human-friendly label that mirrors how the metric is already shown."""
    k = key.lower()
    if "margin" in k or "%" in k:
        return f"{raw:.1f}%"
    if "eps" in k:
        return f"${raw:.2f}"
    # Revenue / net income — show in B / M to match the watchlist card.
    if abs(raw) >= 1e9:
        return f"${raw / 1e9:.2f}B"
    if abs(raw) >= 1e6:
        return f"${raw / 1e6:.2f}M"
    return f"${raw:.2f}"


def consensus_for(ticker: str, metric_key: str, actual_raw: float) -> s.MetricConsensus | None:
    """Return an estimate payload for one metric, or None if we can't price it.

    Caller MUST already have gated on `flags.consensus` — this module does no
    flag check of its own."""
    if actual_raw is None or actual_raw == 0:
        return None
    key = (ticker.upper(), metric_key)
    if key in _OVERRIDES:
        est, label, sources = _OVERRIDES[key]
    else:
        est = actual_raw * _DEFAULT_SHADE
        label = _fmt_label(est, metric_key)
        sources = _DEFAULT_SOURCE_COUNT
    surprise_pct = (actual_raw - est) / abs(est) * 100.0 if est else 0.0
    return s.MetricConsensus(
        estimate=est,
        estimateLabel=label,
        surprisePct=round(surprise_pct, 2),
        sourceCount=sources,
    )
