Read ADD_COMPANIES.md at the repo root and implement the "Add Companies" feature.

1. FRONTEND (web/src): apply the §2 additive changes to the EXISTING files
   (api.ts, hooks.ts, types.ts, screens/Companies.tsx). Do NOT overwrite them —
   they have diverged from the design reference (data-sources feature, custom API
   base). Merge the new methods/types/hooks in and preserve all existing code.
   The new files screens/AddCompanies.tsx and data/sp500.ts are already in place,
   and the ac-* styles are already appended to styles/app.css.

2. BACKEND (workers): build GET /universe and POST /companies/batch per the spec,
   wired to the existing Finnhub client + Firestore. Confirm the existing
   discovery endpoints (POST /companies, GET /discovery/:jobId) work; extend the
   discovery result with candidates[] if feasible.

3. Verify: web/ builds clean (tsc + vite), the Companies → Add Companies flow
   matches design/addflow/Add Companies.html (open it for ground truth), then
   run the §9 acceptance checklist. Do not commit until it builds and runs.
