"""One-shot bootstrap: write demo-mode fixture JSONs for NVDA / SNDK / MU.

Run from the `workers/` directory:
    python -m scripts.export_seed_fixtures

Produces:
    workers/ao/fixtures/NVDA/fixture.json
    workers/ao/fixtures/SNDK/fixture.json
    workers/ao/fixtures/MU/fixture.json

The data is lifted from the latest-quarter rows of `_seed_nvda / _seed_sndk /
_seed_mu` in `ao/db/seed.py`. Re-run any time those seed helpers change so the
in-repo demo baseline stays in sync.
"""
from __future__ import annotations

from ao.agents import demo_fixtures

# ---------------------------------------------------------------------------
# Provenance snippets — verbatim from ao.db.seed
# ---------------------------------------------------------------------------
NVDA_NIPS_LABEL = "10-Q · Note 3 — Net Income Per Share"
NVDA_NIPS_QUOTE = (
    "Net income per share: Basic (1) $2.40  $0.77 · Diluted (2) $2.39  $0.76. "
    "(1) Net income divided by basic weighted average shares. "
    "(2) Net income divided by diluted weighted average shares."
)
NVDA_IS_LABEL = "10-Q · Condensed Consolidated Statements of Income"
NVDA_IS_QUOTE = (
    "Net income $58,321 · Net income per share — Diluted $2.39 · "
    "Diluted weighted average shares 24,391"
)
NVDA_PR_LABEL = "Press release — Q1 FY26 results"
NVDA_PR_QUOTE = (
    "Record first-quarter revenue of $93.2 billion, up 69% from a year ago. "
    "GAAP earnings per diluted share of $2.39, up 214% from a year ago."
)
SNDK_PR_LABEL = "Press release — fiscal Q4 results"
SNDK_PR_QUOTE = "Revenue of $1.95 billion. GAAP net income of $0.82 per diluted share."
SNDK_TABLE_LABEL = "8-K Exhibit 99.1 — financial schedules"
SNDK_TABLE_QUOTE = (
    "Diluted net income per share $0.79 — figure differs from press-release "
    "headline ($0.82) by $0.03; reconciliation references non-GAAP adjustments."
)


# ---------------------------------------------------------------------------
# NVDA — Q1 FY26 (clean, passed, corroborated 3×)
# ---------------------------------------------------------------------------
NVDA = {
    "filing": {
        "form_type": "10-Q",
        "period": "Q1 FY26",
        "period_end": "2026-04-26",
        "reported_on": "2026-05-27",
        "accession": "0001045810-26-000052",
        "source_url": "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000052/0001045810-26-000052-index.htm",
    },
    "extraction": [
        {"key": "Revenue", "display_value": "$93.2B", "raw_value": 93200,
         "page": 1, "quote": NVDA_PR_QUOTE, "source_label": NVDA_PR_LABEL,
         "verified": True},
        {"key": "Net income", "display_value": "$58.32B", "raw_value": 58321,
         "page": 5, "quote": NVDA_IS_QUOTE, "source_label": NVDA_IS_LABEL,
         "verified": True},
        {"key": "EPS · diluted", "display_value": "$2.39", "raw_value": 2.39,
         "page": 9, "quote": NVDA_NIPS_QUOTE, "source_label": NVDA_NIPS_LABEL,
         "verified": True},
        {"key": "EPS · diluted", "display_value": "$2.39", "raw_value": 2.39,
         "page": 5, "quote": NVDA_IS_QUOTE, "source_label": NVDA_IS_LABEL,
         "verified": True},
        {"key": "EPS · diluted", "display_value": "$2.39", "raw_value": 2.39,
         "page": 1, "quote": NVDA_PR_QUOTE, "source_label": NVDA_PR_LABEL,
         "verified": True},
        {"key": "EPS · basic", "display_value": "$2.40", "raw_value": 2.40,
         "page": 9, "quote": NVDA_NIPS_QUOTE, "source_label": NVDA_NIPS_LABEL,
         "verified": True},
        {"key": "Gross margin", "display_value": "75.1%", "raw_value": 75.1,
         "page": 1, "quote": NVDA_PR_QUOTE, "source_label": NVDA_PR_LABEL,
         "verified": True},
    ],
    "validation": {
        "passed": True,
        "rule": "Cross-reference EPS in ≥2 locations",
        "detail": (
            "“Net income per share” found on p.5 (income statement), p.9 (Note 3) "
            "and in the press release. Diluted EPS $2.39 agrees across all three."
        ),
        "corroborations": 3,
        "conflict": False,
        "per_metric": [
            {"key": "Revenue", "conf": "high", "accept_value": "$93.2B"},
            {"key": "Net income", "conf": "high", "accept_value": "$58.32B"},
            {"key": "EPS · diluted", "conf": "high", "accept_value": "$2.39"},
            {"key": "EPS · basic", "conf": "high", "accept_value": "$2.40"},
            {"key": "Gross margin", "conf": "med", "accept_value": "75.1%"},
        ],
    },
    "narrative": (
        "Q1 FY26 revenue of $93.2B is 69% higher than Q1 FY25 ($26.0B); "
        "diluted EPS of $2.39 is 3.9× last quarter's $0.81 and 3.9× prior-year "
        "Q1 ($0.61). Gross margin 75.1% held flat sequentially."
    ),
    "confidence": {
        "overall_pct": 87,
        "band": "high",
        "summary": (
            "Three corroborating sources for diluted EPS, clean validation, "
            "earnings direction agrees with the price trend."
        ),
        "factors": [
            {"name": "Inter-document agreement", "weight": 0.35,
             "impact": "positive",
             "signal": "EPS $2.39 confirmed across income statement, Note 3, and press release.",
             "detail": "Three sources, no conflicts, all marked verified."},
            {"name": "Cross-period consistency", "weight": 0.25,
             "impact": "positive",
             "signal": "EPS series trending upward; no sign reversals across last 5 quarters.",
             "detail": "Revenue and EPS both climb monotonically through FY25 → Q1 FY26."},
            {"name": "Insider and news", "weight": 0.20,
             "impact": "neutral",
             "signal": "Recent insider activity balanced; news headlines focused on AI demand.",
             "detail": "No outsized insider sells in the trailing 90 days."},
            {"name": "Price-trend alignment", "weight": 0.20,
             "impact": "positive",
             "signal": "Positive price slope aligns with the earnings beat.",
             "detail": "Both 30d and 90d price changes positive; direction matches EPS growth."},
        ],
    },
}


# ---------------------------------------------------------------------------
# SNDK — Fiscal Q4 '26 (GAAP vs non-GAAP conflict — routed to REVIEW)
# ---------------------------------------------------------------------------
SNDK = {
    "filing": {
        "form_type": "8-K",
        "period": "Fiscal Q4 '26",
        "period_end": "2026-06-27",
        "reported_on": "2026-07-30",
        "accession": "0002023554-26-000019",
        "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0002023554",
    },
    "extraction": [
        {"key": "Revenue", "display_value": "$1.95B", "raw_value": 1950,
         "page": 1, "quote": SNDK_PR_QUOTE, "source_label": SNDK_PR_LABEL,
         "verified": True},
        {"key": "Net income", "display_value": "$118M", "raw_value": 118,
         "page": 11, "quote": SNDK_TABLE_QUOTE, "source_label": SNDK_TABLE_LABEL,
         "verified": True},
        {"key": "EPS · diluted", "display_value": "$0.82", "raw_value": 0.82,
         "page": 1, "quote": SNDK_PR_QUOTE, "source_label": SNDK_PR_LABEL,
         "verified": True},
        {"key": "EPS · diluted", "display_value": "$0.79", "raw_value": 0.79,
         "page": 11, "quote": SNDK_TABLE_QUOTE, "source_label": SNDK_TABLE_LABEL,
         "verified": True},
    ],
    "validation": {
        "passed": False,
        "rule": "Cross-reference EPS in ≥2 locations",
        "detail": (
            "Press release headline reports diluted EPS $0.82, but the 8-K "
            "financial schedule (p.11) shows $0.79. Difference attributed to "
            "non-GAAP adjustments — needs human decision on which figure to record."
        ),
        "corroborations": 2,
        "conflict": True,
        "per_metric": [
            {"key": "Revenue", "conf": "high", "accept_value": "$1.95B"},
            {"key": "Net income", "conf": "med", "accept_value": "$118M"},
            {
                "key": "EPS · diluted",
                "conf": "low",
                "accept_value": "$0.82",
                "reason": "GAAP/non-GAAP gap — press release $0.82 vs 8-K schedule $0.79.",
                "alternative_values": [
                    {"value": "$0.82", "source": "Press release headline", "page": 1},
                    {"value": "$0.79", "source": "8-K Exhibit 99.1 (p.11)", "page": 11},
                ],
            },
        ],
    },
    "narrative": "",
    "confidence": {
        "overall_pct": 35,
        "band": "low",
        "summary": (
            "Diluted EPS disagrees across sources by $0.03; press release "
            "headline figure conflicts with the 8-K schedule."
        ),
        "factors": [
            {"name": "Inter-document agreement", "weight": 0.40,
             "impact": "negative",
             "signal": "EPS conflict: $0.82 (press) vs $0.79 (schedule).",
             "detail": "Routed to review queue — no auto-resolution."},
            {"name": "Cross-period consistency", "weight": 0.20,
             "impact": "neutral",
             "signal": "Revenue trend stable; net income broadly in line.",
             "detail": "Only the EPS line shows divergence."},
            {"name": "Insider and news", "weight": 0.20,
             "impact": "neutral",
             "signal": "No significant insider activity; spin-off coverage continues.",
             "detail": "Balanced buy/sell across last 90 days."},
            {"name": "Price-trend alignment", "weight": 0.20,
             "impact": "negative",
             "signal": "Price slope negative — market discounted the EPS figure.",
             "detail": "Drift reflects uncertainty around the GAAP/non-GAAP gap."},
        ],
    },
}


# ---------------------------------------------------------------------------
# MU — Q3 FY26 (clean, passed, corroborated 2×)
# ---------------------------------------------------------------------------
MU = {
    "filing": {
        "form_type": "10-Q",
        "period": "Q3 FY26",
        "period_end": "2026-05-28",
        "reported_on": "2026-06-25",
        "accession": "0000723125-26-000041",
        "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000723125",
    },
    "extraction": [
        {"key": "Revenue", "display_value": "$9.80B", "raw_value": 9800,
         "page": 1, "quote": "Q3 fiscal 2026 revenue of $9.80 billion.",
         "source_label": "Press release — Q3 FY26 results",
         "verified": True},
        {"key": "Net income", "display_value": "$2.10B", "raw_value": 2100,
         "page": 6, "quote": "Net income $2,100",
         "source_label": "10-Q · Condensed Consolidated Statements of Operations",
         "verified": True},
        {"key": "EPS · diluted", "display_value": "$1.85", "raw_value": 1.85,
         "page": 6, "quote": "Diluted earnings per share $1.85",
         "source_label": "10-Q · Condensed Consolidated Statements of Operations",
         "verified": True},
        {"key": "EPS · diluted", "display_value": "$1.85", "raw_value": 1.85,
         "page": 12, "quote": "Net income per diluted share $1.85",
         "source_label": "10-Q · Note 4 — Earnings Per Share",
         "verified": True},
    ],
    "validation": {
        "passed": True,
        "rule": "Cross-reference EPS in ≥2 locations",
        "detail": "Diluted EPS $1.85 agrees between income statement (p.6) and Note 4 (p.12).",
        "corroborations": 2,
        "conflict": False,
        "per_metric": [
            {"key": "Revenue", "conf": "high", "accept_value": "$9.80B"},
            {"key": "Net income", "conf": "high", "accept_value": "$2.10B"},
            {"key": "EPS · diluted", "conf": "high", "accept_value": "$1.85"},
        ],
    },
    "narrative": (
        "Q3 FY26 revenue of $9.80B is 31% higher than the prior-year quarter; "
        "diluted EPS of $1.85 nearly doubles last year's level on stronger "
        "DRAM and HBM demand. Gross margin expanded ~140bps sequentially."
    ),
    "confidence": {
        "overall_pct": 80,
        "band": "high",
        "summary": (
            "Diluted EPS corroborated across the income statement and Note 4; "
            "clean validation and stable trend."
        ),
        "factors": [
            {"name": "Inter-document agreement", "weight": 0.35,
             "impact": "positive",
             "signal": "EPS $1.85 confirmed in both p.6 and Note 4.",
             "detail": "Two-source corroboration, no conflicts."},
            {"name": "Cross-period consistency", "weight": 0.25,
             "impact": "positive",
             "signal": "Revenue and EPS climbing for four consecutive quarters.",
             "detail": "No low-confidence metrics in the trailing series."},
            {"name": "Insider and news", "weight": 0.20,
             "impact": "neutral",
             "signal": "Balanced insider activity; news coverage tracks HBM demand.",
             "detail": "No outsized insider sells in the trailing 90 days."},
            {"name": "Price-trend alignment", "weight": 0.20,
             "impact": "positive",
             "signal": "Positive 30d/90d price trend aligns with the earnings direction.",
             "detail": "Slope and earnings direction both positive."},
        ],
    },
}


def main() -> None:
    payloads = {"NVDA": NVDA, "SNDK": SNDK, "MU": MU}
    for ticker, payload in payloads.items():
        # First save attaches the filing block; subsequent saves only set
        # their own stage. Matches the order the live pipeline will use.
        demo_fixtures.save(
            ticker, "extraction", payload["extraction"],
            filing=payload["filing"],
        )
        demo_fixtures.save(ticker, "validation", payload["validation"])
        demo_fixtures.save(ticker, "narrative", payload["narrative"])
        demo_fixtures.save(ticker, "confidence", payload["confidence"])
        path = demo_fixtures.FIXTURE_DIR / ticker / "fixture.json"
        print(f"  → wrote {path}")


if __name__ == "__main__":
    main()
