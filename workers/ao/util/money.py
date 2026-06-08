"""Display formatting for money + percentages. Centralized so the agent never
has to invent format strings — extraction emits raw numbers, formatters here
produce the strings the UI shows."""
from __future__ import annotations


def fmt_money(raw_millions: float, precision: int = 2) -> str:
    """Pretty $B / $M from a number expressed in millions.

    raw_millions is the canonical unit for revenue / net income (matches
    the prototype's `raw` field). EPS / margins use their own formatters.
    """
    n = float(raw_millions)
    if abs(n) >= 1_000:
        return f"${n / 1_000:.{precision}f}B"
    if abs(n) >= 1:
        return f"${n:.0f}M"
    return f"${n * 1_000:.0f}k"


def fmt_eps(raw: float) -> str:
    return f"${raw:.2f}"


def fmt_pct(raw: float) -> str:
    return f"{raw:.1f}%"
