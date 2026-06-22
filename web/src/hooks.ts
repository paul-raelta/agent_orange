/* Agent Orange — React Query hooks. This is the data layer the components read
   from. Server state lives in the query cache; nothing else global is needed. */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type {
  AddDataSourceRequest,
  CreateSourceSuggestionRequest,
  FeatureFlags,
  NotificationPrefs,
  PatchDataSourceRequest,
  RoutingRule,
  UniverseCompany,
  ValidationThresholds,
} from './types'
import { DEFAULT_FLAGS, DEFAULT_THRESHOLDS } from './types'

export const keys = {
  companies: ['companies'] as const,
  archivedCompanies: ['companies', 'archived'] as const,
  universe: ['universe'] as const,
  company: (ticker: string) => ['companies', ticker] as const,
  companySources: (ticker: string) => ['companies', ticker, 'sources'] as const,
  guidance: (ticker: string) => ['companies', ticker, 'guidance'] as const,
  reviewQueue: ['review-queue'] as const,
  activity: (ticker?: string) => ['activity', ticker ?? 'all'] as const,
  usage: ['usage'] as const,
  providers: ['providers'] as const,
  routing: ['routing'] as const,
  portfolioTotals: ['portfolio', 'totals'] as const,
  news: (ticker: string) => ['news', ticker] as const,
  insider: (ticker: string) => ['insider', ticker] as const,
  notificationPrefs: ['settings', 'notifications'] as const,
  featureFlags: ['settings', 'flags'] as const,
  validationThresholds: ['settings', 'thresholds'] as const,
  dataSources: ['data-sources'] as const,
  sourceSuggestions: ['source-suggestions'] as const,
}

/* --- LABS feature flags --------------------------------------------------- */

const FLAGS_LS_KEY = 'ao-feature-flags'

function readFlagsCache(): FeatureFlags {
  try {
    const raw = localStorage.getItem(FLAGS_LS_KEY)
    if (!raw) return DEFAULT_FLAGS
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_FLAGS, ...parsed }
  } catch {
    return DEFAULT_FLAGS
  }
}

function writeFlagsCache(flags: FeatureFlags) {
  try {
    localStorage.setItem(FLAGS_LS_KEY, JSON.stringify(flags))
  } catch {
    /* localStorage might be unavailable (private mode); flags still work
       per-session, they just don't survive reload. */
  }
}

/* Synchronous, cache-first read of the feature flags. The localStorage cache
   is consulted on first paint so gating never flashes; the React-Query mutation
   below writes through to the backend AND refreshes the cache. */
export function useFeatureFlags() {
  const qc = useQueryClient()
  const initial = readFlagsCache()
  const query = useQuery({
    queryKey: keys.featureFlags,
    queryFn: api.getFeatureFlags,
    initialData: initial,
    // Mark initial-from-cache as already stale so React Query still refetches
    // on mount — otherwise an empty / drifted cache locks the UI to the
    // DEFAULT_FLAGS fallback for the full staleTime window.
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
  })
  const [localFlags, setLocalFlags] = useState<FeatureFlags>(initial)
  useEffect(() => {
    if (query.data) {
      writeFlagsCache(query.data)
      setLocalFlags(query.data)
    }
  }, [query.data])

  const mutation = useMutation({
    mutationFn: (next: FeatureFlags) => api.putFeatureFlags(next),
    onMutate: async (next) => {
      // Optimistic: write through immediately so the UI re-gates without lag.
      writeFlagsCache(next)
      setLocalFlags(next)
      qc.setQueryData(keys.featureFlags, next)
    },
    onSuccess: (saved) => {
      writeFlagsCache(saved)
      setLocalFlags(saved)
      qc.setQueryData(keys.featureFlags, saved)
    },
  })

  return {
    flags: query.data ?? localFlags,
    setFlag: (key: keyof FeatureFlags, value: boolean) =>
      mutation.mutate({ ...(query.data ?? localFlags), [key]: value }),
    saving: mutation.isPending,
  }
}

/* --- Validation thresholds ------------------------------------------------ */

export function useValidationThresholds() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: keys.validationThresholds,
    queryFn: api.getValidationThresholds,
    initialData: DEFAULT_THRESHOLDS,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
  })
  const mutation = useMutation({
    mutationFn: (next: ValidationThresholds) =>
      api.putValidationThresholds(next),
    onSuccess: (saved) => qc.setQueryData(keys.validationThresholds, saved),
  })
  return {
    thresholds: query.data ?? DEFAULT_THRESHOLDS,
    saveThresholds: mutation.mutate,
    saving: mutation.isPending,
  }
}

export const useGuidance = (ticker: string, enabled: boolean) =>
  useQuery({
    queryKey: keys.guidance(ticker),
    queryFn: () => api.getGuidance(ticker),
    enabled,
  })

export const useCompanies = () =>
  useQuery({
    queryKey: keys.companies,
    queryFn: api.getCompanies,
    // While any company has an active pipelineRun, poll every 3s so the
    // REFRESHING ETA countdown ticks visibly. Otherwise we rely on SSE
    // invalidation (see useSse) — no background polling.
    refetchInterval: (q) =>
      (q.state.data ?? []).some((c) => c.pipelineRun) ? 3000 : false,
  })

export const useArchivedCompanies = () =>
  useQuery({ queryKey: keys.archivedCompanies, queryFn: api.getArchivedCompanies })

export const useCompany = (ticker: string) =>
  useQuery({
    queryKey: keys.company(ticker),
    queryFn: () => api.getCompany(ticker),
    // 404 / archived ticker — surface the empty state immediately, don't keep
    // spinning through retries.
    retry: false,
  })

function invalidateCompanyLists(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: keys.companies })
  qc.invalidateQueries({ queryKey: keys.archivedCompanies })
  qc.invalidateQueries({ queryKey: keys.portfolioTotals })
}

export const useArchiveCompany = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ticker: string) => api.archiveCompany(ticker),
    onSuccess: (_d, ticker) => {
      invalidateCompanyLists(qc)
      qc.invalidateQueries({ queryKey: keys.company(ticker) })
    },
  })
}

export const useRestoreCompany = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ticker: string) => api.restoreCompany(ticker),
    onSuccess: (_d, ticker) => {
      invalidateCompanyLists(qc)
      qc.invalidateQueries({ queryKey: keys.company(ticker) })
    },
  })
}

export const useDeleteCompany = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ticker: string) => api.deleteCompany(ticker),
    onSuccess: (_d, ticker) => {
      invalidateCompanyLists(qc)
      qc.removeQueries({ queryKey: keys.company(ticker) })
    },
  })
}

export const usePatchCompany = (ticker: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { irUrl?: string | null }) => api.patchCompany(ticker, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.company(ticker) })
      qc.invalidateQueries({ queryKey: keys.companies })
    },
  })
}

export const useCompanySources = (ticker: string) =>
  useQuery({
    queryKey: keys.companySources(ticker),
    queryFn: () => api.getCompanySources(ticker),
  })

export const usePatchCompanySource = (ticker: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patchCompanySource(ticker, id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.companySources(ticker) }),
  })
}

export const useResetCompanySource = (ticker: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.resetCompanySource(ticker, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.companySources(ticker) }),
  })
}

export const useReviewQueue = () =>
  useQuery({ queryKey: keys.reviewQueue, queryFn: api.getReviewQueue })

export const useActivity = (ticker?: string) =>
  useQuery({ queryKey: keys.activity(ticker), queryFn: () => api.getActivity(ticker) })

export const useUsage = () => useQuery({ queryKey: keys.usage, queryFn: api.getUsage })

export const useProviders = () =>
  useQuery({ queryKey: keys.providers, queryFn: api.getProviders })

export const useRouting = () =>
  useQuery({ queryKey: keys.routing, queryFn: api.getRouting })

export const usePortfolioTotals = () =>
  useQuery({ queryKey: keys.portfolioTotals, queryFn: api.getPortfolioTotals })

export const useNews = (ticker: string) =>
  useQuery({ queryKey: keys.news(ticker), queryFn: () => api.getNews(ticker) })

export const useInsider = (ticker: string) =>
  useQuery({ queryKey: keys.insider(ticker), queryFn: () => api.getInsider(ticker) })

export const useNotificationPrefs = () =>
  useQuery({ queryKey: keys.notificationPrefs, queryFn: api.getNotificationPrefs })

export const useResolveReview = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (
      args: { id: string; choice: string; note?: string; pinnedValue?: string },
    ) => {
      if (args.note !== undefined || args.pinnedValue !== undefined) {
        return api.resolveReviewRich(args.id, {
          choice: args.choice,
          note: args.note,
          pinnedValue: args.pinnedValue,
        })
      }
      return api.resolveReview(args.id, args.choice)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.reviewQueue })
    },
  })
}

export const useSetPosition = (ticker: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { shares: number; costBasis: number }) =>
      api.setPosition(ticker, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.company(ticker) })
      qc.invalidateQueries({ queryKey: keys.companies })
      qc.invalidateQueries({ queryKey: keys.portfolioTotals })
    },
  })
}

export const useSaveNotificationPrefs = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NotificationPrefs) => api.putNotificationPrefs(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notificationPrefs }),
  })
}

export const usePutRouting = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RoutingRule[]) => api.putRouting(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.routing }),
  })
}

export const useRunAll = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.runAll,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.companies })
      qc.invalidateQueries({ queryKey: keys.activity() })
    },
  })
}

export const useDiscover = () =>
  useMutation({ mutationFn: (ticker: string) => api.discover(ticker) })

/* Persistent S&P 500 universe cache.
   Add Companies pulls 163 rows + their CDN-hosted logos; on a cold visit the
   163 image fetches are the long pole. We persist the JSON payload to
   localStorage so subsequent visits render the grid instantly (survives both
   browser reload AND server restart since the cache lives in the browser),
   while React Query refreshes from /universe in the background. Bumped the
   storage key on the schema change that added `logoUrl`. */
const UNIVERSE_LS_KEY = 'ao-universe-cache-v1'
type CachedUniverse = { savedAt: number; data: UniverseCompany[] }

function readUniverseCache(): CachedUniverse | null {
  try {
    const raw = localStorage.getItem(UNIVERSE_LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.data) || typeof parsed.savedAt !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeUniverseCache(data: UniverseCompany[]) {
  try {
    localStorage.setItem(
      UNIVERSE_LS_KEY,
      JSON.stringify({ savedAt: Date.now(), data }),
    )
  } catch {
    /* localStorage disabled or full — fall back to in-memory only */
  }
}

export const useUniverse = () => {
  const cached = readUniverseCache()
  return useQuery({
    queryKey: keys.universe,
    queryFn: async () => {
      const data = await api.getUniverse()
      writeUniverseCache(data)
      return data
    },
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.savedAt,
    staleTime: 5 * 60_000,
  })
}

export const useAddCompanies = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.addCompanies,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.companies })
      qc.invalidateQueries({ queryKey: keys.portfolioTotals })
      qc.invalidateQueries({ queryKey: keys.universe })
    },
  })
}

/* --- Data sources (financial-data feeds) --------------------------------- */

export const useDataSources = () =>
  useQuery({ queryKey: keys.dataSources, queryFn: api.getDataSources })

export const useAddDataSource = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AddDataSourceRequest) => api.addDataSource(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.dataSources }),
  })
}

export const usePatchDataSource = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PatchDataSourceRequest }) =>
      api.patchDataSource(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.dataSources }),
  })
}

export const useDeleteDataSource = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteDataSource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.dataSources }),
  })
}

export const useTestDataSource = () =>
  useMutation({ mutationFn: (id: string) => api.testDataSource(id) })

export const useSourceSuggestions = () =>
  useQuery({ queryKey: keys.sourceSuggestions, queryFn: api.getSourceSuggestions })

export const useSuggestSource = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSourceSuggestionRequest) =>
      api.createSourceSuggestion(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.sourceSuggestions }),
  })
}

export const useWipe = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.wipe,
    onSuccess: () => {
      // Universe payload is mirrored to localStorage so the Add Companies
      // grid renders instantly on cold visits; drop it so the post-wipe
      // mount doesn't seed `initialData` with stale `tracked: true` flags.
      try { localStorage.removeItem(UNIVERSE_LS_KEY) } catch { /* ignore */ }
      // After wipe every read changes — drop the whole cache.
      qc.invalidateQueries()
    },
  })
}
