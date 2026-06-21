/* Agent Orange — shared UI primitives, ported from the prototype's
   components.jsx. Pure presentational components; no data fetching here. */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Conf as ConfLevel, Provenance } from '../types'
import { STATUS, type Status } from './status'
import { usePriceFlash } from '../motion/motion'

/* Status chip for an agent / company */
export function StatusChip({ status, pulse }: { status: Status; pulse?: boolean }) {
  const s = STATUS[status] || STATUS.watching
  return (
    <span className={'chip ' + s.cls}>
      <span
        className={'chip-dot' + (pulse && status === 'watching' ? ' pulse' : '')}
        style={{ background: s.dot }}
      />
      {s.label}
    </span>
  )
}

/* Confidence badge: high / med / low (3-bar glyph + label) */
export function Conf({ level, onClick }: { level: ConfLevel; onClick?: () => void }) {
  const map: Record<ConfLevel, [string, string]> = {
    high: ['HIGH', 'cf-high'],
    med: ['MED', 'cf-med'],
    low: ['LOW', 'cf-low'],
  }
  const [lab, cls] = map[level] || map.med
  return (
    <button
      className={'conf ' + cls + (onClick ? ' conf-btn' : '')}
      onClick={onClick}
      title="Confidence — click for sources"
    >
      <span className="conf-bars">
        <i className="on" />
        <i className={level !== 'low' ? 'on' : ''} />
        <i className={level === 'high' ? 'on' : ''} />
      </span>
      {lab}
    </button>
  )
}

/* Delta value with up/down coloring (§9) */
export function Delta({
  value,
  suffix = '%',
  arrow = true,
}: {
  value: number | null | undefined
  suffix?: string
  arrow?: boolean
}) {
  if (value === null || value === undefined) return <span className="delta delta-na">—</span>
  const up = value >= 0
  return (
    <span className={'delta ' + (up ? 'delta-up' : 'delta-down')}>
      {arrow ? (up ? '▲' : '▼') : up ? '+' : ''}
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  )
}

/* Tiny inline sparkline (SVG) */
export function Spark({
  data,
  w = 96,
  h = 28,
  color = 'var(--accent)',
}: {
  data: number[]
  w?: number
  h?: number
  color?: string
}) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data),
    max = Math.max(...data)
  const span = max - min || 1
  const step = w / (data.length - 1)
  const pts = data.map((v, i): [number, number] => [i * step, h - ((v - min) / span) * (h - 4) - 2])
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} />
    </svg>
  )
}

/* Section panel */
export function Panel({
  title,
  right,
  children,
  pad = true,
  className = '',
}: {
  title?: ReactNode
  right?: ReactNode
  children: ReactNode
  pad?: boolean
  className?: string
}) {
  return (
    <section className={'panel ' + className}>
      {(title || right) && (
        <header className="panel-hd">
          <span className="panel-title">{title}</span>
          <span className="panel-right">{right}</span>
        </header>
      )}
      <div className={pad ? 'panel-bd' : 'panel-bd nopad'}>{children}</div>
    </section>
  )
}

export function Btn({
  children,
  kind = 'ghost',
  sm,
  onClick,
  icon,
  disabled,
}: {
  children: ReactNode
  kind?: 'ghost' | 'primary' | 'review' | 'danger'
  sm?: boolean
  onClick?: () => void
  icon?: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      className={'btn btn-' + kind + (sm ? ' btn-sm' : '')}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  )
}

export function Price({ price, change }: { price: number; change: number }) {
  const up = change >= 0
  const flash = usePriceFlash(price)
  return (
    <span className="price">
      <span className={'price-val ' + flash}>{price.toFixed(2)}</span>
      <span className={'price-chg ' + (up ? 'delta-up' : 'delta-down')}>
        {up ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
      </span>
    </span>
  )
}

/* Right-side slide-over drawer (§7: Esc / scrim to close, 0.24s slide) */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  return (
    <div className={'drawer-root' + (open ? ' open' : '')}>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer">
        <header className="drawer-hd">
          <span className="panel-title">{title}</span>
          <button className="x-btn" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="drawer-bd drawer-stagger">{children}</div>
      </aside>
    </div>
  )
}

/* Provenance snippet block — source title, page, URL, exact quote */
export function ProvenanceItem({ p }: { p: Provenance }) {
  return (
    <div className="prov">
      <div className="prov-hd">
        <span className="prov-src">{p.source}</span>
        <span className="prov-page">p.{p.page}</span>
      </div>
      <a className="prov-url" href="#" onClick={(e) => e.preventDefault()}>
        {p.url}
      </a>
      <blockquote className="prov-quote">{p.quote}</blockquote>
    </div>
  )
}

/* Ticker glyph (monogram tile) */
export function Glyph({ ticker, status }: { ticker: string; status: Status }) {
  const s = STATUS[status] || STATUS.watching
  return (
    <span className="glyph" style={{ ['--g' as string]: s.dot }}>
      {ticker.slice(0, 2)}
    </span>
  )
}
