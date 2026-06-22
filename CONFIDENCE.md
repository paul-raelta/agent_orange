# Overall Financial Confidence % (as-built)

> **For future changes.** This documents the company-level LLM confidence score
> that replaced the per-metric high/med/low badge as the headline indicator. It
> is **not** flag-gated (unlike the LABS features in `FEATURES.md`) — it's a core
> part of the pipeline. Read this before touching the scoring, its inputs, the
> recompute cadence, or the gauge UI.

## What it is

A single **0–100 percentage** per company, colour-coded red→amber→green, with a
written factor-by-factor breakdown. It measures **how trustworthy/coherent the
data we hold is** — not whether the stock is a buy. It blends four signals:

1. **Inter-document agreement** — the existing per-metric validation (high/med/low
   conf tally, `validation_passed`, conflict flag) on the latest filing.
2. **Cross-source consistency** — EPS continuity across the last ~5 periods (sign
   reversals, low-conf periods) + count of distinct provenance sources.
3. **Insider activity & news** — insider BUY/SELL balance + net value (~90d) and
   recent headlines (the LLM judges sentiment from the headline text).
4. **Price-trend alignment** — recent share-price slope + 30/90-day % change, and
   whether the earnings direction agrees with the price direction.

The per-metric high/med/low badges still exist and feed factor 1; they remain
visible in the Company validation tab and provenance drawer as supporting detail.

## Key design rules (don't break these)

- **The LLM never does math.** All stats are computed deterministically in
  `confidence.py` and passed to the model as a JSON dict; the model only weighs
  and explains. If you add a signal, compute it in code and add it to the inputs.
- **Band is derived from pct in code**, always — `confidence.band_for()`
  (`≥70 high`, `≥40 medium`, `<40 low`). The LLM's proposed `band` is ignored so
  the colour (lerp on pct) and the label can never disagree. The frontend mirror
  is `confColor()` in `primitives.tsx` with the same thresholds implied by colour.
- **Thin price coverage must down-weight factor 4**, not crash it. `data_points`
  and `coverage_days` are passed to the LLM for exactly this; every stat helper
  tolerates empty/sparse data and returns `None`/0 rather than throwing.
- **Idempotency / cost.** One Opus call per company per recompute. The daily job
  skips any company assessed within the last 20h (`_hours_since` in `jobs.py`) so
  a same-day filing-triggered recompute doesn't double-bill.

## Data flow

```
inputs assembled in code (confidence._assemble_inputs)
  → Opus via record_confidence tool (forced)
  → parse + band_for(pct)
  → ConfidenceAssessment row (is_latest=True, prior demoted)
  → serialize_company → Company.confidence wire field
  → ConfidenceGauge (headline) + ConfidenceBreakdown (drawer)
```

## Where things live

| Concern | File |
| --- | --- |
| Stage (stat assembly, LLM call, persist) | `workers/ao/agents/confidence.py` |
| Prompt + tool schema + version | `workers/ao/agents/prompts.py` (`CONFIDENCE_SYSTEM`, `CONFIDENCE_TOOL`, `PROMPT_VERSION_CONFIDENCE`) |
| Model routing | `workers/ao/agents/registry.py` (`confidence` → reuses Validation's model) |
| Storage | `workers/ao/db/models.py` (`ConfidenceAssessment`; breakdown in `factors_json`, audit stats in `inputs_json`) |
| Pipeline call (after narrative) | `workers/ao/agents/pipeline.py` |
| Daily recompute + price backfill | `workers/ao/scheduler/jobs.py` (`recompute_confidence`, `backfill_prices`, `_hours_since`) + `scheduler.py` (00:10 / 00:15) |
| Historical price fetch | `workers/ao/integrations/finnhub_client.py` (`stock_candles`) |
| Wire type | `workers/ao/api/schemas.py` (`Confidence`, `ConfidenceFactor`) + `serializers.py` |
| Frontend type | `web/src/types.ts` (`Confidence`) |
| Gauge + breakdown + colour | `web/src/components/primitives.tsx` (`ConfidenceGauge`, `ConfidenceBreakdown`, `confColor`) |
| Placement | `web/src/screens/Company.tsx` (header gauge + drawer), `web/src/screens/Watchlist.tsx` (compact card gauge) |
| Styles | `web/src/styles/app.css` (`.confg*`, `.cfb*`) |

## How to extend

- **Add a scoring factor:** compute its stats in a new `_xxx_stats()` helper in
  `confidence.py`, add them to `_assemble_inputs`, then name the factor and tell
  the model how to weigh it in `CONFIDENCE_SYSTEM`. Bump `PROMPT_VERSION_CONFIDENCE`
  (it's persisted on every `agent_runs` row for A/B + rollback).
- **Change band thresholds / colours:** edit `band_for()` (backend) **and**
  `confColor()` + the band cutoffs in `primitives.tsx` together — they must agree.
- **Make the model independently tunable:** add a `default_model_confidence`
  setting and a `"Confidence"` routing-rule row; currently `confidence` reuses
  Validation's model via `TASK_NAMES`/the fallback dict in `registry.py`.
- **Change cadence:** scheduler triggers in `scheduler.py`; the 20h skip window is
  in `recompute_confidence`. The pipeline always recomputes on a new filing.

## Caveats

- **Finnhub `/stock/candle` is premium.** On the free tier it usually returns
  `403`/`no_data`; `stock_candles` then returns `[]` and the trend falls back to
  the price snapshots `refresh_prices` accumulates (sparse until they build up).
  The score still computes — factor 4 is just down-weighted.
- **`Metric.yoy` is `None` from the pipeline**, so the earnings direction is
  derived from the EPS·diluted series across periods, not from a stored YoY.
- Recompute reads price/news that change daily but filing data that changes
  quarterly — that's why the daily job exists; don't assume the score only moves
  on earnings.

## Verify a change

```bash
cd web && npm run build                 # tsc + vite (types.ts ↔ schemas.py lockstep)
cd workers && .venv/bin/python -m ruff check ao/agents/confidence.py
# live: GET /companies/{ticker} → confidence:{pct,band,summary,factors[],computedAt}
# UI: Company header gauge + breakdown drawer; Watchlist card compact gauge;
#     validation tab still shows per-metric HIGH/MED/LOW.
```
