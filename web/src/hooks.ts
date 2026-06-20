/* Agent Orange — React Query hooks. This is the data layer the components read
   from. Server state lives in the query cache; nothing else global is needed. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type {
  AddDataSourceRequest,
  CreateSourceSuggestionRequest,
  NotificationPrefs,
  PatchDataSourceRequest,
  RoutingRule,
} from './types'

export const keys = {
  companies: ['companies'] as const,
  archivedCompanies: ['companies', 'archived'] as const,
  company: (ticker: string) => ['companies', ticker] as const,
  companySources: (ticker: string) => ['companies', ticker, 'sources'] as const,
  reviewQueue: ['review-queue'] as const,
  activity: (ticker?: string) => ['activity', ticker ?? 'all'] as const,
  usage: ['usage'] as const,
  providers: ['providers'] as const,
  routing: ['routing'] as const,
  portfolioTotals: ['portfolio', 'totals'] as const,
  news: (ticker: string) => ['news', ticker] as const,
  insider: (ticker: string) => ['insider', ticker] as const,
  notificationPrefs: ['settings', 'notifications'] as const,
  dataSources: ['data-sources'] as const,
  sourceSuggestions: ['source-suggestions'] as const,
}

export const useCompanies = () =>
  useQuery({ queryKey: keys.companies, queryFn: api.getCompanies })

export const useArchivedCompanies = () =>
  useQuery({ queryKey: keys.archivedCompanies, queryFn: api.getArchivedCompanies })

export const useCompany = (ticker: string) =>
  useQuery({ queryKey: keys.company(ticker), queryFn: () => api.getCompany(ticker) })

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
    mutationFn: ({ id, choice }: { id: string; choice: string }) =>
      api.resolveReview(id, choice),
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

export const useDiscover = () => useMutation({ mutationFn: api.discover })

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
      // After wipe every read changes — drop the whole cache.
      qc.invalidateQueries()
    },
  })
}
