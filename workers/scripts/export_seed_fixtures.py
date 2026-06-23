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
NVDA_PR_LABEL = "Press release — Q1 FY27 results"
NVDA_PR_QUOTE = (
    "Record first-quarter revenue of $81.6 billion, up 85% from a year ago. "
    "GAAP earnings per diluted share of $2.39, up 214% from a year ago."
)
SNDK_IS_LABEL = "10-Q · Condensed Consolidated Statements of Operations"
SNDK_IS_QUOTE = (
    "Revenue, net $ 5,950 · Net income (loss) $ 3,615 · "
    "Net income per common share — Basic $ 24.43 · Diluted $ 23.03"
)
SNDK_EPS_LABEL = "10-Q · Note 5 — Net Income (Loss) Per Common Share"
SNDK_EPS_QUOTE = (
    "Basic $ 24.43 Diluted $ 23.03 — Weighted average shares outstanding: "
    "Basic 148, Diluted 157."
)
# Demo-only synthetic divergence: the real SNDK 10-Q on disk has no non-GAAP
# figure. We inject a "press release adjusted EPS" row to keep the GAAP-vs-
# non-GAAP conflict demo alive in fixture-mode replay. UI surfaces a "demo
# synthetic" notice next to the conflict so it's not mistaken for real.
SNDK_ADJ_LABEL = "Press release · adjusted diluted EPS (demo synthetic)"
SNDK_ADJ_QUOTE = (
    "Reconciliation of GAAP to non-GAAP results — adjusted diluted EPS "
    "$24.15 (excludes stock-based compensation and integration charges). "
    "[Synthetic value injected for demo purposes only — not present in the "
    "underlying 10-Q.]"
)


# ---------------------------------------------------------------------------
# NVDA — Q1 FY26 (clean, passed, corroborated 3×)
# ---------------------------------------------------------------------------
NVDA = {
    "filing": {
        "form_type": "10-Q",
        "period": "Q1 FY27",
        "period_end": "2026-04-26",
        "reported_on": "2026-05-27",
        "accession": "0001045810-26-000052",
        "source_url": "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000052/0001045810-26-000052-index.htm",
    },
    "extraction": [
        {"key": "Revenue", "display_value": "$81.6B", "raw_value": 81615,
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
        {"key": "Gross margin", "display_value": "74.9%", "raw_value": 74.9,
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
            {"key": "Revenue", "conf": "high", "accept_value": "$81.6B"},
            {"key": "Net income", "conf": "high", "accept_value": "$58.32B"},
            {"key": "EPS · diluted", "conf": "high", "accept_value": "$2.39"},
            {"key": "EPS · basic", "conf": "high", "accept_value": "$2.40"},
            {"key": "Gross margin", "conf": "med", "accept_value": "74.9%"},
        ],
    },
    "narrative": (
        "Q1 FY27 revenue of $81.6B is 85% higher than Q1 FY26 ($44.1B); "
        "diluted EPS of $2.39 is 214% above last year's $0.76. Gross margin "
        "74.9% held essentially flat sequentially (75.0% in Q4 FY26)."
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
# SNDK — Fiscal Q3 '26. Real cached 10-Q shows only GAAP EPS ($23.03 diluted)
# and validates cleanly. To preserve the GAAP-vs-non-GAAP REVIEW demo we
# inject ONE synthetic "press release adjusted" row that diverges by $1.12.
# Validation flips to conflict=True, demo_synthetic=True drives a UI banner.
# ---------------------------------------------------------------------------
SNDK = {
    "filing": {
        "form_type": "10-Q",
        "period": "Fiscal Q3 '26",
        "period_end": "2026-04-03",
        "reported_on": "2026-05-08",
        "accession": "0001628280-26-029401",
        "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0002023554",
    },
    "extraction": [
        {"key": "Revenue", "display_value": "$5.95B", "raw_value": 5950,
         "page": 5, "quote": SNDK_IS_QUOTE, "source_label": SNDK_IS_LABEL,
         "verified": True},
        {"key": "Net income", "display_value": "$3.62B", "raw_value": 3615,
         "page": 5, "quote": SNDK_IS_QUOTE, "source_label": SNDK_IS_LABEL,
         "verified": True},
        {"key": "EPS · diluted", "display_value": "$23.03", "raw_value": 23.03,
         "page": 5, "quote": SNDK_IS_QUOTE, "source_label": SNDK_IS_LABEL,
         "verified": True},
        {"key": "EPS · diluted", "display_value": "$23.03", "raw_value": 23.03,
         "page": 13, "quote": SNDK_EPS_QUOTE, "source_label": SNDK_EPS_LABEL,
         "verified": True},
        {"key": "EPS · diluted", "display_value": "$24.15", "raw_value": 24.15,
         "page": 1, "quote": SNDK_ADJ_QUOTE, "source_label": SNDK_ADJ_LABEL,
         "verified": True},
        {"key": "EPS · basic", "display_value": "$24.43", "raw_value": 24.43,
         "page": 5, "quote": SNDK_IS_QUOTE, "source_label": SNDK_IS_LABEL,
         "verified": True},
        {"key": "Gross margin", "display_value": "78.4%", "raw_value": 78.4,
         "page": 28, "quote": "Gross profit 4,662 78.4 382 22.5",
         "source_label": "10-Q · MD&A · Results of Operations",
         "verified": True},
    ],
    "validation": {
        "passed": False,
        "rule": "Cross-reference EPS in ≥2 locations",
        "detail": (
            "Income statement (p.5) and Note 5 (p.13) both report diluted EPS "
            "$23.03 (GAAP). The press-release reconciliation reports adjusted "
            "diluted EPS $24.15 — a $1.12 GAAP/non-GAAP gap. Routed to REVIEW."
        ),
        "corroborations": 2,
        "conflict": True,
        "demo_synthetic": True,
        "per_metric": [
            {"key": "Revenue", "conf": "high", "accept_value": "$5.95B"},
            {"key": "Net income", "conf": "high", "accept_value": "$3.62B"},
            {
                "key": "EPS · diluted",
                "conf": "low",
                "accept_value": "$23.03",
                "reason": (
                    "GAAP/non-GAAP gap — GAAP $23.03 (10-Q schedules) vs "
                    "adjusted $24.15 (press release). "
                    "[demo synthetic — see Validation tab for context]"
                ),
                "alternative_values": [
                    {"value": "$23.03", "source": "10-Q · income statement (p.5) + Note 5 (p.13)", "page": 5},
                    {"value": "$24.15", "source": SNDK_ADJ_LABEL, "page": 1},
                ],
            },
            {"key": "EPS · basic", "conf": "high", "accept_value": "$24.43"},
            {"key": "Gross margin", "conf": "med", "accept_value": "78.4%"},
        ],
    },
    "narrative": (
        "Fiscal Q3 '26 GAAP diluted EPS $23.03 vs adjusted $24.15 — $1.12 gap "
        "routed for human review. Revenue $5.95B (3.5× YoY) and gross margin "
        "78.4% (up from 22.5%) both validate cleanly across the underlying "
        "schedules."
    ),
    "confidence": {
        "overall_pct": 35,
        "band": "low",
        "summary": (
            "Diluted EPS conflict between GAAP schedules and the adjusted "
            "press-release figure. The other metrics corroborate cleanly."
        ),
        "factors": [
            {"name": "Inter-document agreement", "weight": 0.40,
             "impact": "negative",
             "signal": "EPS conflict: $23.03 (10-Q) vs $24.15 (press release adjusted).",
             "detail": "Routed to review queue — no auto-resolution."},
            {"name": "Cross-period consistency", "weight": 0.20,
             "impact": "neutral",
             "signal": "Revenue and basic EPS trend stable; only diluted shows divergence.",
             "detail": "Disagreement is isolated to the diluted-EPS row."},
            {"name": "Insider and news", "weight": 0.20,
             "impact": "neutral",
             "signal": "No significant insider activity; spin-off coverage continues.",
             "detail": "Balanced buy/sell across last 90 days."},
            {"name": "Price-trend alignment", "weight": 0.20,
             "impact": "negative",
             "signal": "Price slope negative — market discounted the gap.",
             "detail": "Uncertainty around GAAP/non-GAAP framing weighs on the stock."},
        ],
    },
}


# ---------------------------------------------------------------------------
# MU — Q2 FY26 (clean, passed, corroborated 2×)
# ---------------------------------------------------------------------------
MU = {
    "filing": {
        "form_type": "10-Q",
        "period": "Q2 FY26",
        "period_end": "2026-02-26",
        "reported_on": "2026-03-19",
        "accession": "0000723125-26-000006",
        "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000723125",
    },
    "extraction": [
        {"key": "Revenue", "display_value": "$23.86B", "raw_value": 23860,
         "page": 5, "quote": "Revenue $ 23,860 $ 8,053 $ 37,503 $ 16,762",
         "source_label": "10-Q · Consolidated Statements of Operations",
         "verified": True},
        {"key": "Net income", "display_value": "$13.79B", "raw_value": 13785,
         "page": 5, "quote": "Net income $ 13,785 $ 1,583 $ 19,025 $ 3,453",
         "source_label": "10-Q · Consolidated Statements of Operations",
         "verified": True},
        {"key": "EPS · diluted", "display_value": "$12.07", "raw_value": 12.07,
         "page": 5, "quote": "Diluted 12.07 1.41 16.68 3.08",
         "source_label": "10-Q · Consolidated Statements of Operations",
         "verified": True},
        {"key": "EPS · diluted", "display_value": "$12.07", "raw_value": 12.07,
         "page": 24, "quote": "Diluted 12.07 1.41 16.68 3.08",
         "source_label": "10-Q · Note 4 — Earnings Per Share",
         "verified": True},
        {"key": "EPS · basic", "display_value": "$12.25", "raw_value": 12.25,
         "page": 5, "quote": "Basic $ 12.25 $ 1.42 $ 16.91 $ 3.10",
         "source_label": "10-Q · Consolidated Statements of Operations",
         "verified": True},
        {"key": "Gross margin", "display_value": "74.4%", "raw_value": 74.4,
         "page": 28, "quote": "Gross margin 17,755 ... Revenue $ 23,860",
         "source_label": "10-Q · MD&A · Results of Operations",
         "verified": True},
    ],
    "validation": {
        "passed": True,
        "rule": "Cross-reference EPS in ≥2 locations",
        "detail": "Diluted EPS $12.07 agrees between income statement (p.5) and Note 4 (p.24).",
        "corroborations": 2,
        "conflict": False,
        "per_metric": [
            {"key": "Revenue", "conf": "high", "accept_value": "$23.86B"},
            {"key": "Net income", "conf": "high", "accept_value": "$13.79B"},
            {"key": "EPS · diluted", "conf": "high", "accept_value": "$12.07"},
            {"key": "EPS · basic", "conf": "high", "accept_value": "$12.25"},
            {"key": "Gross margin", "conf": "med", "accept_value": "74.4%"},
        ],
    },
    "narrative": (
        "Q2 FY26 revenue of $23.86B is 196% higher than the prior-year quarter "
        "($8.05B); diluted EPS $12.07 vs $1.41 a year ago on the HBM/DRAM "
        "supply squeeze. Gross margin 74.4%, up from 36.8% a year prior."
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
             "signal": "EPS $12.07 confirmed in both p.5 and Note 4.",
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
# (end MU)


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
