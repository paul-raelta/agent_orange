/* Agent Orange — live update stream (§7 / §8).
   Opens an EventSource on /api/v1/events. The backend publishes:
     - company.updated   → invalidate companies + that ticker's deep-dive
     - review.added      → invalidate review queue
     - run.progress      → invalidate activity
   Heartbeats are silent. Reconnects on error.
   Mounted once in App.tsx; idempotent across re-mounts via React Query. */
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { keys } from './hooks'

const SSE_URL =
  ((import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000/api/v1') +
  '/events'

export function useLiveUpdates() {
  const qc = useQueryClient()
  useEffect(() => {
    let source: EventSource | null = null
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      source = new EventSource(SSE_URL)
      source.addEventListener('company.updated', (e) => {
        try {
          const { ticker } = JSON.parse((e as MessageEvent).data)
          qc.invalidateQueries({ queryKey: keys.companies })
          qc.invalidateQueries({ queryKey: keys.portfolioTotals })
          if (ticker) qc.invalidateQueries({ queryKey: keys.company(ticker) })
        } catch {
          /* ignore malformed event */
        }
      })
      source.addEventListener('review.added', () => {
        qc.invalidateQueries({ queryKey: keys.reviewQueue })
      })
      source.addEventListener('run.progress', () => {
        qc.invalidateQueries({ queryKey: keys.activity() })
      })
      source.onerror = () => {
        source?.close()
        if (!cancelled) setTimeout(connect, 3000)
      }
    }
    connect()
    return () => {
      cancelled = true
      source?.close()
    }
  }, [qc])
}
