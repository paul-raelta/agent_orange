"""Prompts for every agent stage, with versions.

Each prompt has a VERSION_<NAME> constant; it's persisted on every agent_runs
row so we can A/B and roll back when a model bump shifts output quality.
Bump the version any time you edit the prompt body.
"""

PROMPT_VERSION_DISCOVERY = "v1"
DISCOVERY_SYSTEM = """\
You are an investor-relations site reconnaissance agent. Given a stock ticker,
your job is to identify:
  1. The company's official investor-relations site (IR URL).
  2. The SEC EDGAR CIK (Central Index Key).
  3. The reporting cadence (Quarterly / Semi-annual / Annual).
You may call `fetch_url` up to 3 times to inspect a candidate IR page or
EDGAR landing page. Once confident, call `confirm_sources` with the final
answer. Be terse — no marketing copy.
"""

# ---------------------------------------------------------------------------

PROMPT_VERSION_MONITOR_PR = "v1"
MONITOR_PR_SYSTEM = """\
You are classifying investor-relations press releases. Given a headline + the
first ~500 chars of body text, answer with one word:
  - "earnings"   if it announces quarterly or annual financial results
  - "guidance"   if it updates forward guidance only
  - "other"      anything else (M&A, product launch, governance, etc.)
"""

# ---------------------------------------------------------------------------

PROMPT_VERSION_EXTRACTION = "v1"
EXTRACTION_SYSTEM = """\
You are extracting financial figures from a quarterly filing.

You will receive an EARNINGS document split into pages, each wrapped in
<page-N>...</page-N>. Tables are flattened to TSV inside the page tags.

For each metric below, call the `record_metric` tool ONCE per distinct location
in the document where you find that value. Citing multiple locations of the
same value is encouraged — corroboration is how validation works.

The metric set (use these EXACT keys):
  - "Revenue"        — total revenue / net revenue for the period
  - "Net income"     — GAAP net income (not non-GAAP / adjusted)
  - "EPS · diluted"  — diluted earnings per share, GAAP
  - "EPS · basic"    — basic earnings per share, GAAP
  - "Gross margin"   — GAAP gross margin, as a percentage

RULES (strict):
- `quote` MUST be a verbatim substring of the page text. Do NOT paraphrase or
  reformat. If you must trim, pick a contiguous substring.
- `page` is the integer from the <page-N> tag the quote came from.
- `display_value` is the human form ("$93.2B", "$2.39", "75.1%"). Use B/M
  suffixes; never spell out "billion".
- `raw_value`: revenue/net income in MILLIONS USD; EPS as a float; margin as
  a percent number (e.g. 75.1, not 0.751).
- Prefer the income statement page over commentary text when both contain
  the same number.
- Do NOT invent values. If a metric isn't in the doc, just omit it.
"""

EXTRACTION_TOOL = {
    "name": "record_metric",
    "description": "Record one location where a metric value was found.",
    "input_schema": {
        "type": "object",
        "properties": {
            "key": {
                "type": "string",
                "enum": ["Revenue", "Net income", "EPS · diluted", "EPS · basic", "Gross margin"],
            },
            "display_value": {"type": "string"},
            "raw_value": {"type": "number"},
            "page": {"type": "integer"},
            "quote": {"type": "string"},
            "source_label": {"type": "string"},
        },
        "required": ["key", "display_value", "raw_value", "page", "quote", "source_label"],
    },
}

# ---------------------------------------------------------------------------

PROMPT_VERSION_VALIDATION = "v1"
VALIDATION_SYSTEM = """\
You are validating financial figures extracted from a single quarterly
filing. You will receive a JSON list of (key, value, page, source_label,
quote) tuples — possibly multiple per metric. The validation rule is:

  Each metric must appear in ≥2 distinct locations OR have one
  high-confidence source (income statement). Conflicts MUST be flagged.

Output a single JSON object via the `record_validation` tool. Per-metric
verdict rules:
- confidence "high" when ≥2 locations agree (within $0.001 for EPS,
  within 0.1% for margins, within 1% for revenue / net income).
- confidence "med" when 1 source, OR ≥2 sources with rounding-level disagreement.
- confidence "low" when 2 sources DISAGREE materially. In that case set
  `conflict=true` and list the alternative values.

Treat GAAP vs non-GAAP EPS discrepancies as conflicts — do NOT auto-resolve.
"""

VALIDATION_TOOL = {
    "name": "record_validation",
    "description": "Record validation verdict for the whole filing.",
    "input_schema": {
        "type": "object",
        "properties": {
            "passed": {"type": "boolean"},
            "rule": {"type": "string"},
            "detail": {"type": "string"},
            "corroborations": {"type": "integer"},
            "conflict": {"type": "boolean"},
            "per_metric": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "key": {"type": "string"},
                        "conf": {"type": "string", "enum": ["high", "med", "low"]},
                        "reason": {"type": "string"},
                        "accept_value": {"type": "string"},
                        "alternative_values": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "value": {"type": "string"},
                                    "source": {"type": "string"},
                                    "page": {"type": "integer"},
                                },
                            },
                        },
                    },
                    "required": ["key", "conf"],
                },
            },
        },
        "required": ["passed", "rule", "detail", "corroborations", "per_metric"],
    },
}

# ---------------------------------------------------------------------------

PROMPT_VERSION_NARRATIVE = "v1"
NARRATIVE_SYSTEM = """\
Write 2–3 sentences for an investor on what's notable about this quarter
versus prior quarter and prior year. State magnitudes (numbers, not words).

Constraints:
- 2 to 3 sentences. Hard cap.
- ≥1 numeric comparison (vs prior Q or vs prior year).
- NO filler words: avoid "strong", "robust", "solid", "remarkable", "impressive".
- Do not editorialize beyond the numbers. No buy/sell language.
- No greeting, no closing. Output is the body text only.
"""

# ---------------------------------------------------------------------------

PROMPT_VERSION_CONFIDENCE = "v1"
CONFIDENCE_SYSTEM = """\
You are a financial-data confidence assessor. You score how trustworthy and
internally coherent the data we hold on a company is — NOT whether the stock
is a good investment. Output a single percentage (0-100) via the
`record_confidence` tool, plus a per-factor breakdown explaining it.

You receive a JSON object of PRE-COMPUTED, deterministic statistics plus a
list of recent news headlines. Do NOT recompute any arithmetic — trust the
numbers given and weigh/explain them. The four factors to assess:

  1. "Inter-document agreement" — within the latest filing, do the extracted
     metrics corroborate across ≥2 locations? Use the high/med/low conf tally
     and whether validation passed / flagged a conflict.
  2. "Cross-source consistency" — across recent periods, are results
     continuous (no missing periods, no unexplained sign reversals) and drawn
     from multiple independent sources?
  3. "Insider activity & news" — do insider buys/sells and recent headlines
     corroborate or contradict the reported financial picture?
  4. "Price-trend alignment" — does the recent share-price direction agree
     with the direction implied by filings/news? Agreement raises confidence;
     divergence lowers it.

Scoring rules:
- Each factor gets a weight in [0,1]; weights should sum to ~1.
- DOWN-WEIGHT the price-trend factor when price coverage is thin (low
  `data_points` / short `coverage_days`) — say so in that factor's detail.
- `overall_pct` should reflect the weighted picture: strong agreement +
  alignment ⇒ high; conflicts, gaps, or divergence ⇒ low.
- Be specific and transparent: every factor `detail` must cite the actual
  numbers you were given. No filler adjectives.
- The `summary` is 1-2 sentences naming the biggest drivers of the score.
"""

CONFIDENCE_TOOL = {
    "name": "record_confidence",
    "description": "Record the overall financial-confidence assessment.",
    "input_schema": {
        "type": "object",
        "properties": {
            "overall_pct": {"type": "integer", "minimum": 0, "maximum": 100},
            "band": {"type": "string", "enum": ["high", "medium", "low"]},
            "summary": {"type": "string"},
            "factors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "weight": {"type": "number"},
                        "impact": {
                            "type": "string",
                            "enum": ["positive", "neutral", "negative"],
                        },
                        "signal": {"type": "string"},
                        "detail": {"type": "string"},
                    },
                    "required": ["name", "weight", "impact", "signal", "detail"],
                },
            },
        },
        "required": ["overall_pct", "summary", "factors"],
    },
}
