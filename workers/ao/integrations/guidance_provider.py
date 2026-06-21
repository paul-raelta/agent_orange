"""Forward-guidance extraction provider (stub).

Feature 3 (flags.guidance). The real implementation would run an LLM extraction
pass over the latest earnings call transcript / press release and persist
structured guidance rows. Until that lands this module returns deterministic
stub guidance for a small set of demo tickers so the UI is exercisable
end-to-end. Returns `[]` for any other ticker — the GUIDANCE tab renders the
empty state, which is correct behavior pending the extractor.

Only called from the dedicated `GET /companies/{ticker}/guidance` endpoint,
which itself is gated on `flags.guidance` at the route layer.
"""
from __future__ import annotations

from ao.api import schemas as s


_STUB: dict[str, list[s.GuidanceItem]] = {
    "NVDA": [
        s.GuidanceItem(
            metric="Revenue", period="Q3 FY26",
            low="$16.0B", high="$16.4B", prior="$15.2–15.6B",
            direction="raised",
            provenance=s.GuidanceProvenance(
                url="https://investor.nvidia.com",
                page="Earnings call · p.3",
                snippet="We expect Q3 revenue of $16.0 billion to $16.4 billion, "
                        "plus or minus 2 percent.",
            ),
        ),
        s.GuidanceItem(
            metric="Gross margin", period="Q3 FY26",
            low="78.0%", high="79.0%", prior="77.5–78.5%",
            direction="raised",
            provenance=s.GuidanceProvenance(
                url="https://investor.nvidia.com",
                page="Earnings call · p.3",
                snippet="GAAP and non-GAAP gross margins are expected to be "
                        "78.0% and 79.0%, respectively, plus or minus 50 basis points.",
            ),
        ),
        s.GuidanceItem(
            metric="Opex", period="Q3 FY26",
            low="$4.0B", high="$4.1B", prior="$4.0–4.1B",
            direction="maintained",
            provenance=s.GuidanceProvenance(
                url="https://investor.nvidia.com",
                page="Earnings call · p.4",
                snippet="GAAP and non-GAAP operating expenses are expected to be "
                        "approximately $4.0 billion and $4.1 billion, respectively.",
            ),
        ),
    ],
    "SNDK": [
        s.GuidanceItem(
            metric="Revenue", period="Q1 FY27",
            low="$1.95B", high="$2.05B", prior="$1.85–1.95B",
            direction="raised",
            provenance=s.GuidanceProvenance(
                url="https://investor.sandisk.com",
                page="Press release · p.2",
                snippet="We expect Q1 revenue to be in the range of $1.95 to $2.05 billion.",
            ),
        ),
    ],
    "MU": [
        s.GuidanceItem(
            metric="Revenue", period="Q4 FY26",
            low="$8.10B", high="$8.40B", prior="$7.80–8.10B",
            direction="raised",
            provenance=s.GuidanceProvenance(
                url="https://investors.micron.com",
                page="Press release · p.2",
                snippet="We expect Q4 revenue of $8.1 billion, plus or minus $300 million.",
            ),
        ),
    ],
}


def guidance_for(ticker: str) -> list[s.GuidanceItem]:
    return list(_STUB.get(ticker.upper(), []))
