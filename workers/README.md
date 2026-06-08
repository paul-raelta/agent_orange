# workers/ — Agentic backend (stub)

Not implemented yet. This package will host the per-company agents that produce
the data the `web/` UI consumes. It must serve the data contract defined in
[`../design/HANDOFF.md`](../design/HANDOFF.md) §6 so the UI's data layer
(`web/src/api.ts`) can point at it with zero component change.

## Intended shape (HANDOFF §12)

- **Per-company agent** with stages mirroring the routing table:
  - *discovery* — find the IR URL + SEC EDGAR CIK.
  - *monitoring poll* — cheap recurring check for a new 8-K / 10-Q / press release.
  - *extraction* — parse the filing/PDF for the metric set.
  - *validation* — cross-reference each figure in ≥2 places; on agreement → high
    confidence + auto-record; on conflict/single-source → push a `ReviewItem`.
- **Scheduling** — poll on a cadence that intensifies inside the predicted filing
  window (daily baseline + every-4h within `nextWindow`). Cloud Scheduler → Cloud Run.
- **Sources** — SEC EDGAR as the structured backbone; IR site / press release for
  corroboration and bespoke cases.
- **Provider routing** — model per stage is config (`routing`), not hardcoded.
  Start all-Claude (Opus for extraction/validation, Sonnet/Haiku for
  discovery/monitoring); keep GPT/Gemini behind the same interface. API key in
  Secret Manager.
- **Storage** — Firestore (or Cloud SQL) for companies, recorded results +
  provenance, review items, activity, usage.

## REST surface to implement (HANDOFF §6)

```
GET  /companies
GET  /companies/:ticker
GET  /review-queue
POST /review-queue/:id/resolve   { choice }
GET  /activity?ticker=
GET  /usage
GET  /providers
GET  /routing
POST /companies                  { ticker, mode, ... }
POST /run                        (trigger all agents)
```
