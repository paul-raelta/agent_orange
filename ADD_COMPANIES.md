# Handoff: "Add Companies" feature — finish the backend & ship it

> **For Claude Code.** The **frontend for the Add Companies feature is already built and working** against a bundled fallback. Your job is to implement **two backend endpoints** (plus one small extension to discovery), wire them to the data the app already uses (Finnhub + Firestore), and verify the feature end-to-end in the real `web/` app. When done, commit and push.
>
> This doc is self-sufficient. Read it top to bottom; every type and route name below already exists in the frontend and is waiting for the server side.

---

## 1. What the feature is
In **Companies → ADD COMPANIES**, the user browses the **S&P 500** as a grid of selectable cards (grouped by GICS sector, with a table density toggle), multi-selects companies into a sticky tray, clicks **ADD**, and the app runs **source discovery** for each selected company in a batch, then **START WATCHING ALL** commits them as tracked companies.

Two stages:
1. **Browse & select** — needs the universe list (`GET /universe`).
2. **Discover & commit** — runs discovery per company (existing endpoint), then persists the batch (`POST /companies/batch`).

---

## 2. Frontend integration — APPLY these changes in `web/src/`
> ⚠️ **Merge additively — do not overwrite.** The repo's `api.ts`, `hooks.ts`, `types.ts`,
> `screens/Companies.tsx`, and `styles/app.css` have evolved past the design reference (a
> data-sources feature, a different API-base default, etc.). Overwriting them would delete that
> work. Apply the small additions below into the **current** files. Two files are brand-new and
> drop in as-is. These changes were authored & verified in the prototype — the QA checklist (§9)
> points to it as visual ground truth.

**New files (drop in, no conflict):**
- `web/src/screens/AddCompanies.tsx` — the whole feature UI (browse grid/table, selection tray, discovery, confirm-IR, success). *(provided)*
- `web/src/data/sp500.ts` — 162-company fallback/seed universe (`UniverseCompany[]` + `SP500_SECTORS`). *(provided — `mkdir -p web/src/data` first)*

**`web/src/types.ts` — add:**
```ts
// 1) extend the EXISTING DiscoveryResult with an optional field:
candidates?: { url: string; note: string }[]
// 2) add a new type:
export type UniverseCompany = {
  ticker: string; name: string; sector: string
  price: number; dayChange: number; mcap: number   // mcap in $B
  earn: string; earnDays: number; tracked: boolean
}
```

**`web/src/api.ts` — add** (import `UniverseCompany` from `./types` and `SP500_UNIVERSE` from `./data/sp500`, then add these two methods to the `api` object — keep everything else):
```ts
async getUniverse(): Promise<UniverseCompany[]> {
  try { return await get<UniverseCompany[]>('/universe') }
  catch { return SP500_UNIVERSE }          // backend not up yet → bundled fallback
},
addCompanies: (body: { tickers: string[]; primaryIr?: Record<string, string> }) =>
  send<Company[]>('POST', '/companies/batch', body),
```

**`web/src/hooks.ts` — add** `universe: ['universe'] as const` to the `keys` object, then:
```ts
export const useUniverse = () =>
  useQuery({ queryKey: keys.universe, queryFn: api.getUniverse, staleTime: 5 * 60_000 })
export const useAddCompanies = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.addCompanies,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.companies })
      qc.invalidateQueries({ queryKey: keys.portfolioTotals })
    },
  })
}
```

**`web/src/screens/Companies.tsx` — surgical:** import `AddCompanies`, and in the `adding` branch render `<AddCompanies onClose={() => setAdding(false)} />` **instead of** the old single-ticker add panel. Keep the configured-companies list and any data-sources UI you've added. Label the button "ADD COMPANIES". (The design-reference version of this file is in the prototype if you want to diff.)

**`web/src/styles/app.css` — append** the contents of `feature-styles.css` *(provided)* to the end of the file. Purely additive `ac-*` classes; nothing existing is touched:
```bash
cat feature-styles.css >> web/src/styles/app.css
```

**The seam you implement against** (after the above is applied):
```ts
api.getUniverse()   // → GET /universe  (Part A)   ── falls back to bundled list until you build it
api.discover(t)     // = POST /companies {ticker,mode:'auto'} → poll GET /discovery/:jobId  (existing)
api.addCompanies()  // → POST /companies/batch  (Part B)
```
Once `/universe` and `/companies/batch` exist, the fallback simply stops being hit — no further frontend change.

---

## 3. Data contract (already in `types.ts`)
```ts
export type UniverseCompany = {
  ticker: string
  name: string
  sector: string          // one of the 11 GICS sectors (see SP500_SECTORS)
  price: number           // last price
  dayChange: number       // percent, e.g. -1.84
  mcap: number            // market cap in $B (billions)
  earn: string            // next-earnings display label, e.g. "Aug 06"
  earnDays: number        // days-from-now until next earnings (for sorting)
  tracked: boolean        // already on the user's watchlist
}

// discovery may return competing IR pages for a human to choose:
export type DiscoveryResult = {
  ir: string; sec: string; cadence: string; window: string
  candidates?: { url: string; note: string }[]   // optional; drives the "CONFIRM IR" step
}
```
`SP500_SECTORS` (order the UI groups by):
`Information Technology, Health Care, Financials, Consumer Discretionary, Communication Services, Industrials, Consumer Staples, Energy, Utilities, Real Estate, Materials`.

---

## 4. Endpoint A — `GET /universe`  *(new)*
Returns the selectable universe as `UniverseCompany[]`.

### Response
`200 OK` → array of `UniverseCompany` (see §3). Example element:
```json
{ "ticker":"AAPL","name":"Apple","sector":"Information Technology",
  "price":214.92,"dayChange":-0.61,"mcap":3290,"earn":"Aug 01","earnDays":42,"tracked":true }
```

### Recommended implementation — snapshot, don't fan out per request
Do **not** call Finnhub 500× on every page load (rate limits + latency). Instead keep a **Firestore `universe` snapshot** refreshed by a scheduled job, and have `GET /universe` just read + decorate it:

1. **Scheduled refresh job** (Cloud Scheduler → Cloud Run, e.g. hourly for quotes, daily for the rest):
   - **Constituents + sector + name:** Finnhub `GET /index/constituents?symbol=^GSPC` for the roster; sector/name from `GET /stock/profile2?symbol=…` (cache daily). (A committed static roster is an acceptable v1 if you'd rather not hit the index endpoint — `data/sp500.ts` is exactly that list.)
   - **Price + day change:** Finnhub `GET /quote?symbol=…` → `c` (price), `dp` (percent). (Refresh frequently.)
   - **Market cap ($B):** `profile2.marketCapitalization` is in **millions** → divide by 1000 for `mcap`.
   - **Next earnings:** Finnhub `GET /calendar/earnings?from=<today>&to=<+120d>&symbol=…` → nearest future date; format `earn` as `"Mon DD"` and compute `earnDays = date - today`.
   - Write each as a `UniverseCompany` (minus `tracked`) into Firestore `universe/{ticker}`.
2. **`GET /universe` handler** (cheap, no external calls):
   - Read all `universe/*`.
   - Compute `tracked` per row by checking the user's tracked `companies` collection (`tracked = ticker ∈ trackedTickers`).
   - Return the array.

```python
# workers/ao/api/routes_universe.py  (FastAPI, matches existing routes_*.py)
@router.get("/universe", response_model=list[UniverseCompany])
async def get_universe():
    snap = await firestore.collection("universe").get()          # pre-snapshotted
    tracked = {c.id for c in await firestore.collection("companies").get()}
    return [UniverseCompany(**d.to_dict(), tracked=d.id in tracked) for d in snap]
```
Register the router where the others are mounted.

### Notes
- Finnhub is **already integrated** in the app for prices/news/insider — reuse that client + API key (Secret Manager). No new provider.
- If you ship the static-roster v1, still attach **live** price/mcap/earnings from Finnhub so prices aren't frozen — that's the whole point of this endpoint.

---

## 5. Endpoint B — `POST /companies/batch`  *(new)*
Commits the selected companies as tracked. This is the **"START WATCHING ALL"** action — the only place tracked `Company` records get created in the new flow.

### Request
```json
{ "tickers": ["AAPL","MSFT","AMD"],
  "primaryIr": { "AMD": "https://ir.amd.com/quarterly-results" } }
```
- `tickers` — selected companies to start tracking.
- `primaryIr` — optional; only present for tickers where discovery surfaced multiple IR `candidates[]` and the user picked one (see §6). Pin it as that company's primary IR source.

### Behavior (per ticker, idempotent)
1. Skip if already tracked (don't duplicate).
2. Create a `Company` record (the `companies` collection / data contract shape from the main README §6):
   - `status: "watching"`, `sourceMode: "auto"`.
   - `sources`: the discovered IR + SEC EDGAR (CIK). If `primaryIr[ticker]` is set, mark that IR `primary:true`.
   - `cadence` + `nextWindow` from discovery; seed `price/dayChange/name/sector` from the universe snapshot.
   - empty `latest.metrics/history` until the first real run.
3. Schedule it into the **monitoring cadence** (the poll job that intensifies inside `nextWindow` — README §12).
4. Emit SSE **`company.updated`** for each (so the watchlist/Companies list refresh live).

### Response
`200 OK` → `Company[]` (the created records). The frontend's `useAddCompanies` invalidates `companies` + `portfolio/totals` on success; emitting `company.updated` also covers any open views.

```python
@router.post("/companies/batch", response_model=list[Company])
async def add_companies(body: BatchAddRequest):
    created = []
    for t in body.tickers:
        if await company_exists(t):            # idempotent
            continue
        disc   = await latest_discovery(t)     # reuse discovery result/sources
        comp   = build_company(t, disc, primary_ir=body.primaryIr.get(t))
        await save_company(comp)
        schedule_monitor(comp)                 # cadence + nextWindow
        await publish_event("company.updated", {"ticker": t})
        created.append(comp)
    return created
```

---

## 6. Discovery — reuse what exists, optionally extend
The flow calls `api.discover(ticker)` once per selected company. That maps to the **existing** pair:
- `POST /companies { ticker, mode:"auto" }` → `{ jobId }` (starts a discovery job — keep it **non-persistent**; it investigates, it does not create a tracked company).
- `GET /discovery/:jobId` → `DiscoveryStatus { phase, result }`.

**If that already works for the old single-ticker add, you're done here** — the batch just calls it N times.

**Optional (enables the Confirm-IR review step):** when discovery finds more than one plausible IR page, populate `result.candidates` (see §3). The UI then shows a "⚑ CONFIRM IR" card with the candidate URLs; the user's pick comes back to you in `POST /companies/batch`'s `primaryIr`. If you return no `candidates`, every company simply resolves to "✓ SOURCES FOUND" — also fine.

**Optional efficiency:** a real `POST /discovery/batch { tickers }` returning a job that fans out server-side would beat N parallel client calls for large selections. Not required.

---

## 7. SSE events (existing stream `GET /events`)
- `POST /companies/batch` → emit **`company.updated`** per created ticker (the app already listens and invalidates the right caches in `live.ts`).
- No new event types needed.

---

## 8. Config / wiring
- **Finnhub key:** reuse the existing secret (Secret Manager) — same client the price/news/insider features use.
- **Routes:** register `routes_universe` and the `companies/batch` route alongside the existing `routes_*.py`.
- **`VITE_API_BASE`:** unchanged — both endpoints live under the same `/api/v1` base the app already targets.
- **Scheduler:** add the universe-refresh job to the same Cloud Scheduler config that drives monitoring polls.

---

## 9. Acceptance criteria / QA checklist
- [ ] `GET /universe` returns ~500 `UniverseCompany` with **live** price/mcap/earnings and correct `tracked` flags; the browse screen shows them (and the bundled-fallback branch in `api.getUniverse` is no longer hit — verify in the network tab).
- [ ] Sector grouping, search, sort (market cap / A–Z / soonest earnings), and the GRID⇄TABLE toggle all work on real data.
- [ ] Selecting companies + **ADD** runs discovery per company; rows resolve to "SOURCES FOUND" (and "CONFIRM IR" if you populate `candidates`).
- [ ] **START WATCHING ALL** creates tracked companies (idempotent — re-running doesn't duplicate), they appear on the Watchlist/Companies list, and the success screen shows the count.
- [ ] Already-tracked companies render as disabled **TRACKING** and can't be re-added.
- [ ] `web/` **builds clean** (`tsc` + Vite) and the screen renders/behaves like the prototype.
- [ ] Commit + push.

**Visual ground truth:** the standalone prototype `addflow/Add Companies.html` (open it) shows the exact intended look and behavior of every stage.

---

## 10. Out of scope
- Front-end changes (done). Touch `web/` only if `tsc` flags something.
- Removing `data/sp500.ts` — keep it; it's the offline fallback and the seed for the static-roster v1.
- New providers — Finnhub is already wired; don't add another.
