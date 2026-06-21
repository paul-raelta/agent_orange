/* Agent Orange — motion helpers (React). Drop at web/src/motion/motion.tsx.
   Pairs with styles/motion.css. All effects degrade gracefully and respect
   prefers-reduced-motion. See MOTION.md for where to apply each. */
import { useEffect, useRef, useState } from 'react'
import type { DependencyList, ElementType, ReactNode } from 'react'

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Entrance driver: returns `entering` (true for one paint, then false). Add the
   `is-entering` class while true so children start hidden, then transition in.
   Pass deps (e.g. [data]) to replay when the data changes. */
export function useEntrance(deps: DependencyList = []): boolean {
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    setEntering(true)
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setEntering(false)))
    const t = window.setTimeout(() => setEntering(false), 90) // fallback if rAF is throttled
    return () => {
      cancelAnimationFrame(r)
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return entering
}

/* Wrap any group/grid: <Reveal className="wl-grid">{cards}</Reveal>.
   Children fade+rise in, staggered (see .reveal in motion.css). The wrapper IS
   the grid — pass the grid's className so layout is unchanged. */
export function Reveal({
  as: Tag = 'div' as ElementType,
  className = '',
  children,
  ...rest
}: {
  as?: ElementType
  className?: string
  children: ReactNode
  [k: string]: unknown
}) {
  const entering = useEntrance()
  return (
    <Tag className={'reveal ' + className + (entering ? ' is-entering' : '')} {...rest}>
      {children}
    </Tag>
  )
}

/* Animated number: counts from 0 → value on mount (cubic ease-out). Use for the
   P&L totals, usage $, run counters. Honors reduced motion (shows final value). */
export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 800,
}: {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const [v, setV] = useState(prefersReduced() ? value : 0)
  useEffect(() => {
    if (prefersReduced()) {
      setV(value)
      return
    }
    let raf = 0
    let start = 0
    const tick = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setV(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <>
      {prefix}
      {v.toFixed(decimals)}
      {suffix}
    </>
  )
}

/* Price tick flash: returns 'tick-up' | 'tick-down' | '' for ~900ms whenever
   `value` changes. Apply the class to the price element. */
export function usePriceFlash(value: number): string {
  const prev = useRef(value)
  const [dir, setDir] = useState('')
  useEffect(() => {
    if (value === prev.current) return
    setDir(value > prev.current ? 'tick-up' : 'tick-down')
    prev.current = value
    const t = window.setTimeout(() => setDir(''), 900)
    return () => clearTimeout(t)
  }, [value])
  return dir
}

/* Skeleton card matching the .wl-card layout — render a grid of these while
   companies are loading instead of a spinner (no layout shift). */
export function SkeletonCard() {
  return (
    <div className="skel">
      <div style={{ display: 'flex', gap: 9, marginBottom: 12 }}>
        <div className="b" style={{ width: 34, height: 34, borderRadius: 7 }} />
        <div style={{ flex: 1 }}>
          <div className="b" style={{ width: '50%', height: 12, marginBottom: 6 }} />
          <div className="b" style={{ width: '72%', height: 8 }} />
        </div>
      </div>
      <div className="b" style={{ width: '42%', height: 14, marginBottom: 12 }} />
      <div className="b" style={{ width: '100%', height: 26, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="b" style={{ flex: 1, height: 34 }} />
        ))}
      </div>
    </div>
  )
}

/* Tab underline ink: drives a <span className="tab-ink"> under the active tab.
   Give each tab button a ref; pass the active button's ref. */
export function useTabInk(activeEl: HTMLElement | null) {
  const [style, setStyle] = useState<{ transform: string; width: number }>({ transform: 'translateX(0)', width: 0 })
  useEffect(() => {
    if (activeEl) setStyle({ transform: `translateX(${activeEl.offsetLeft}px)`, width: activeEl.offsetWidth })
  }, [activeEl])
  return style
}
