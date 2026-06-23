"""Street-consensus estimates provider (stub).

Feature 1 (flags.consensus). The real implementation would call a Street-
estimates endpoint (Finnhub `/stock/eps-estimate`, `/stock/revenue-estimate`)
and attach the result to each Metric. Until that exists this provider returns
a deterministic stub estimate for the demo tickers — enough to drive the
surprise chips, beat/miss banner and CONS/SURP columns end-to-end against
real data the user already has on disk.

Key contract: this module is ONLY imported / called from the serializer when
flags.consensus is True for the user. With the flag off the backend does no
work for this feature.

Units: dollar-valued metrics (Revenue, Net income) carry `raw_value` in
**millions of USD** — same scale used by the extractor — so estimates in this
table MUST also be in millions. EPS values are raw dollars; Gross margin is
the percentage as a number (e.g. 74.9 means 74.9%).
"""
from __future__ import annotations

from ao.api import schemas as s


# Demo-ticker overrides — keyed (ticker, metric_key) → (estimate, label, source_count).
# Values match the units used by the extractor: millions for $-keyed metrics,
# raw dollars for EPS, percentage-as-number for margins.
#
# Estimates are calibrated to read as MODEST beats (~+1% to +5%) against the
# actuals stored in the cached 10-Q filings on disk. When the cached filings
# change, re-run `python -m scripts.export_seed_fixtures` AND update these
# overrides — the two must move together.
_OVERRIDES: dict[tuple[str, str], tuple[float, str, int]] = {
    # NVDA Q1 FY27 — actuals: Revenue $81.6B / Net income $58.32B /
    # EPS diluted $2.39 / EPS basic $2.40 / Gross margin 74.9%.
    ("NVDA", "Revenue"): (79_400.0, "$79.40B", 28),
    ("NVDA", "Net income"): (56_500.0, "$56.50B", 22),
    ("NVDA", "EPS · diluted"): (2.32, "$2.32", 31),
    ("NVDA", "EPS · basic"): (2.33, "$2.33", 18),
    ("NVDA", "Gross margin"): (74.0, "74.0%", 14),
    # MU Q2 FY26 — actuals: Revenue $23.86B / Net income $13.79B /
    # EPS diluted $12.07 / EPS basic $12.25 / Gross margin 74.4%.
    ("MU", "Revenue"): (23_000.0, "$23.00B", 21),
    ("MU", "Net income"): (13_300.0, "$13.30B", 16),
    ("MU", "EPS · diluted"): (11.60, "$11.60", 18),
    ("MU", "EPS · basic"): (11.80, "$11.80", 12),
    ("MU", "Gross margin"): (73.5, "73.5%", 10),
    # SNDK Fiscal Q3 '26 — actuals: Revenue $5.95B / Net income $3.62B /
    # EPS diluted $23.03 / EPS basic $24.43 / Gross margin 78.4%.
    ("SNDK", "Revenue"): (5_780.0, "$5.78B", 12),
    ("SNDK", "Net income"): (3_500.0, "$3.50B", 9),
    ("SNDK", "EPS · diluted"): (22.40, "$22.40", 9),
    ("SNDK", "EPS · basic"): (23.70, "$23.70", 8),
    ("SNDK", "Gross margin"): (77.0, "77.0%", 7),
    # DIS Q2 FY26 — actuals: Revenue $25.17B / Net income $2.47B /
    # EPS diluted $1.27 / EPS basic $1.27.
    ("DIS", "Revenue"): (24_650.0, "$24.65B", 24),
    ("DIS", "Net income"): (2_390.0, "$2.39B", 19),
    ("DIS", "EPS · diluted"): (1.24, "$1.24", 26),
    ("DIS", "EPS · basic"): (1.24, "$1.24", 15),
    # SNOW Q1 FY27 — actuals: Revenue $1.39B / Net income -$295.57M (loss) /
    # EPS diluted -$0.86 / EPS basic -$0.86 / Gross margin 66.6%.
    # For loss metrics a "beat" = a smaller loss → estimate is MORE negative
    # than the actual; surprise_pct formula (actual - est)/|est| then yields a
    # positive value, which is what the UI surface as a beat.
    ("SNOW", "Revenue"): (1_360.0, "$1.36B", 30),
    ("SNOW", "Net income"): (-305.0, "-$305M", 18),
    ("SNOW", "EPS · diluted"): (-0.89, "-$0.89", 32),
    ("SNOW", "EPS · basic"): (-0.89, "-$0.89", 14),
    ("SNOW", "Gross margin"): (65.5, "65.5%", 11),
}


def _fmt_label(raw: float, key: str) -> str:
    """Human-friendly label that mirrors how the metric is already shown.

    For dollar-valued metrics (Revenue, Net income) `raw` is in **millions**,
    matching the extractor's units. EPS values are raw dollars; gross margin
    is a percentage as a number.
    """
    k = key.lower()
    if "margin" in k or "%" in k:
        return f"{raw:.1f}%"
    if "eps" in k:
        return f"${raw:.2f}"
    # Revenue / net income — raw is in millions.
    if abs(raw) >= 1_000.0:
        return f"${raw / 1_000.0:.2f}B"
    return f"${raw:.0f}M"


def consensus_for(ticker: str, metric_key: str, actual_raw: float) -> s.MetricConsensus | None:
    """Return an estimate payload for one metric, or None if we don't have one.

    Caller MUST already have gated on `flags.consensus` — this module does no
    flag check of its own. Returns None when no street estimate is available
    for the (ticker, metric) pair; the UI hides the CONS / SURP cells in
    that case rather than synthesising a fake number.
    """
    if actual_raw is None or actual_raw == 0:
        return None
    key = (ticker.upper(), metric_key)
    if key not in _OVERRIDES:
        return None
    est, label, sources = _OVERRIDES[key]
    if est == 0:
        return None
    surprise_pct = (actual_raw - est) / abs(est) * 100.0
    return s.MetricConsensus(
        estimate=est,
        estimateLabel=label,
        surprisePct=round(surprise_pct, 2),
        sourceCount=sources,
    )
