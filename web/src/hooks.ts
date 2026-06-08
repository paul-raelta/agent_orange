/* Agent Orange — React Query hooks. This is the data layer the components read
   from; it replaces the prototype's window.AO_DATA global (§6, §8). Server state
   lives in the query cache; nothing else global is needed. */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from './api'

export const keys = {
  companies: ['companies'] as const,
  company: (ticker: string) => ['companies', ticker] as const,
  reviewQueue: ['review-queue'] as const,
  activity: (ticker?: string) => ['activity', ticker ?? 'all'] as const,
  usage: ['usage'] as const,
  providers: ['providers'] as const,
  routing: ['routing'] as const,
}

export const useCompanies = () =>
  useQuery({ queryKey: keys.companies, queryFn: api.getCompanies })

export const useCompany = (ticker: string) =>
  useQuery({ queryKey: keys.company(ticker), queryFn: () => api.getCompany(ticker) })

export const useReviewQueue = () =>
  useQuery({ queryKey: keys.reviewQueue, queryFn: api.getReviewQueue })

export const useActivity = (ticker?: string) =>
  useQuery({ queryKey: keys.activity(ticker), queryFn: () => api.getActivity(ticker) })

export const useUsage = () => useQuery({ queryKey: keys.usage, queryFn: api.getUsage })

export const useProviders = () =>
  useQuery({ queryKey: keys.providers, queryFn: api.getProviders })

export const useRouting = () =>
  useQuery({ queryKey: keys.routing, queryFn: api.getRouting })

export const useResolveReview = () =>
  useMutation({
    mutationFn: ({ id, choice }: { id: string; choice: string }) =>
      api.resolveReview(id, choice),
  })

export const useRunAll = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.runAll,
    onSuccess: () => {
      // The real backend would update statuses; refetch the affected queries.
      qc.invalidateQueries({ queryKey: keys.companies })
      qc.invalidateQueries({ queryKey: keys.activity() })
    },
  })
}

export const useDiscover = () => useMutation({ mutationFn: api.discover })
