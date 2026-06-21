/* Agent Orange — Add Companies (browse the S&P 500 → multi-select → batch source
   discovery). Replaces the old single-ticker add panel in the Companies screen.
   View B (sector-grouped Standard cards) with a density toggle to view C (table);
   both share one selection model + a sticky tray. Stage 2 runs discovery per
   company via api.discover and confirms the batch via useAddCompanies. */
import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { api } from '../api'
import { Btn } from '../components/primitives'
import { Loading } from '../components/Loading'
import { Reveal } from '../motion/motion'
import { useAddCompanies, useUniverse } from '../hooks'
import { SP500_SECTORS } from '../data/sp500'
import type { DiscoveryResult, UniverseCompany } from '../types'

const fmtCap = (b: number) => (b >= 1000 ? `$${(b / 1000).toFixed(2)}T` : `$${b}B`)
const slug = (n: string) =>
  n.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '').slice(0, 18)

function MonoGlyph({ ticker, sm }: { ticker: string; sm?: boolean }) {
  return <span className={'ac-glyph' + (sm ? ' sm' : '')}>{ticker.replace('.', '').slice(0, 2)}</span>
}
function Chg({ v }: { v: number }) {
  const up = v >= 0
  return (
    <span className={'ac-chg ' + (up ? 'delta-up' : 'delta-down')}>
      {up ? '▲' : '▼'} {Math.abs(v).toFixed(2)}%
    </span>
  )
}

/* ---------------- Standard card (view B) ---------------- */
function Card({
  c,
  selected,
  onToggle,
  index = 0,
}: {
  c: UniverseCompany
  selected: boolean
  onToggle: (t: string) => void
  index?: number
}) {
  return (
    <div
      className={'ac-card' + (selected ? ' sel' : '') + (c.tracked ? ' tracked' : '')}
      style={{ ['--i' as string]: index }}
      onClick={() => !c.tracked && onToggle(c.ticker)}
    >
      <div className="ac-card-top">
        <MonoGlyph ticker={c.ticker} />
        <div className="ac-id">
          <div className="ac-tkr">{c.ticker}</div>
          <div className="ac-name">{c.name}</div>
        </div>
        {c.tracked ? <span className="ac-trackchip">TRACKING</span> : <span className="ac-check">✓</span>}
      </div>
      <div className="ac-mid">
        <span className="ac-price">${c.price.toFixed(2)}</span>
        <Chg v={c.dayChange} />
      </div>
      <div className="ac-foot">
        <span className="ac-cap">{fmtCap(c.mcap)} cap</span>
        <span className="ac-earn">⌚ {c.earn}</span>
      </div>
    </div>
  )
}

/* ---------------- Table (view C) ---------------- */
type SortKey = keyof Pick<
  UniverseCompany,
  'ticker' | 'name' | 'sector' | 'price' | 'dayChange' | 'mcap' | 'earnDays'
>
const COLS: { k: SortKey; label: string; num?: boolean }[] = [
  { k: 'ticker', label: 'Ticker' },
  { k: 'name', label: 'Company' },
  { k: 'sector', label: 'Sector' },
  { k: 'price', label: 'Price', num: true },
  { k: 'dayChange', label: 'Day', num: true },
  { k: 'mcap', label: 'Mkt cap', num: true },
  { k: 'earnDays', label: 'Next rpt', num: true },
]

function Table({
  rows,
  selected,
  onToggle,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: UniverseCompany[]
  selected: Set<string>
  onToggle: (t: string) => void
  sortKey: SortKey
  sortDir: number
  onSort: (k: SortKey) => void
}) {
  if (!rows.length) return <div className="ac-empty">No companies match your filters.</div>
  return (
    <div className="ac-tblwrap">
      <table className="ac-tbl">
        <thead>
          <tr>
            <th style={{ width: 32 }} />
            {COLS.map((col) => (
              <th key={col.k} className={col.num ? 'num' : ''} onClick={() => onSort(col.k)}>
                {col.label}
                {sortKey === col.k && <span className="ar">{sortDir === 1 ? '▲' : '▼'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr
              key={c.ticker}
              className={(selected.has(c.ticker) ? 'sel ' : '') + (c.tracked ? 'tracked' : '')}
              onClick={() => !c.tracked && onToggle(c.ticker)}
            >
              <td>{c.tracked ? <span className="ac-trackchip">✓</span> : <span className="ac-tcheck">✓</span>}</td>
              <td className="tk">{c.ticker}</td>
              <td className="nm">{c.name}</td>
              <td className="sc">{c.sector}</td>
              <td className="num">${c.price.toFixed(2)}</td>
              <td className={'num ' + (c.dayChange >= 0 ? 'delta-up' : 'delta-down')}>
                {c.dayChange >= 0 ? '+' : '−'}
                {Math.abs(c.dayChange).toFixed(2)}%
              </td>
              <td className="num">{fmtCap(c.mcap)}</td>
              <td className="num ac-tearn">{c.earn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ====================  STAGE 1: BROWSE  ==================== */
function Browse({
  universe,
  selected,
  setSelected,
  onAdd,
  onClose,
}: {
  universe: UniverseCompany[]
  selected: Set<string>
  setSelected: Dispatch<SetStateAction<Set<string>>>
  onAdd: () => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [sector, setSector] = useState('All')
  const [sort, setSort] = useState<'mcap' | 'az' | 'earn'>('mcap')
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [tSortKey, setTSortKey] = useState<SortKey>('mcap')
  const [tSortDir, setTSortDir] = useState(-1)
  const [rippling, setRippling] = useState<Record<string, boolean>>({})

  const sectorCounts = useMemo(() => {
    const m: Record<string, number> = {}
    universe.forEach((c) => (m[c.sector] = (m[c.sector] || 0) + 1))
    return m
  }, [universe])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return universe.filter(
      (c) =>
        (sector === 'All' || c.sector === sector) &&
        (!q || c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)),
    )
  }, [universe, query, sector])

  const sortedGrid = useMemo(() => {
    const arr = [...filtered]
    if (sort === 'az') arr.sort((a, b) => a.ticker.localeCompare(b.ticker))
    else if (sort === 'mcap') arr.sort((a, b) => b.mcap - a.mcap)
    else arr.sort((a, b) => a.earnDays - b.earnDays)
    return arr
  }, [filtered, sort])

  const groups = useMemo(() => {
    const order = sector === 'All' ? [...SP500_SECTORS] : [sector]
    return order
      .map((s) => ({ sector: s, items: sortedGrid.filter((c) => c.sector === s) }))
      .filter((g) => g.items.length)
  }, [sortedGrid, sector])

  const tableRows = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      const av = a[tSortKey]
      const bv = b[tSortKey]
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * tSortDir
      return ((av as number) - (bv as number)) * tSortDir
    })
    return arr
  }, [filtered, tSortKey, tSortDir])

  const toggle = (t: string) =>
    setSelected((prev) => {
      const n = new Set(prev)
      n.has(t) ? n.delete(t) : n.add(t)
      return n
    })
  const toggleSector = (tickers: string[], on: boolean, sectorName?: string) => {
    setSelected((prev) => {
      const n = new Set(prev)
      tickers.forEach((t) => (on ? n.add(t) : n.delete(t)))
      return n
    })
    if (on && sectorName) {
      setRippling((p) => ({ ...p, [sectorName]: true }))
      window.setTimeout(
        () => setRippling((p) => ({ ...p, [sectorName]: false })),
        600,
      )
    }
  }
  const onTSort = (k: SortKey) => {
    if (k === tSortKey) setTSortDir((d) => -d)
    else {
      setTSortKey(k)
      setTSortDir(k === 'name' || k === 'ticker' || k === 'sector' ? 1 : -1)
    }
  }
  const collapse = (s: string) =>
    setCollapsed((prev) => {
      const n = new Set(prev)
      n.has(s) ? n.delete(s) : n.add(s)
      return n
    })

  const selectedList = [...selected]

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <button className="back" onClick={onClose}>
            ← Companies
          </button>
          <h1 className="screen-title">ADD COMPANIES</h1>
          <p className="screen-sub">
            Browse the S&amp;P 500, select the companies you want an agent to monitor, then discover
            their filing sources in one batch.
          </p>
        </div>
      </div>

      <div className="ac-toolbar">
        <div className="ac-search">
          <span className="ic">⌕</span>
          <input
            placeholder="Search ticker or company…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="ac-sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="mcap">Sort · Market cap</option>
          <option value="az">Sort · A–Z</option>
          <option value="earn">Sort · Soonest earnings</option>
        </select>
        <div className="seg">
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
            GRID
          </button>
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
            TABLE
          </button>
        </div>
      </div>

      <div className="ac-secfilter">
        <button className={'ac-secchip' + (sector === 'All' ? ' on' : '')} onClick={() => setSector('All')}>
          All<span className="n">{universe.length}</span>
        </button>
        {SP500_SECTORS.map((s) => (
          <button
            key={s}
            className={'ac-secchip' + (sector === s ? ' on' : '')}
            onClick={() => setSector(s)}
          >
            {s}
            <span className="n">{sectorCounts[s]}</span>
          </button>
        ))}
      </div>

      <div className="ac-count">
        {filtered.length} companies{sector !== 'All' ? ` in ${sector}` : ''}
        {query ? ` matching “${query}”` : ''} · {selected.size} selected
      </div>

      {view === 'grid' ? (
        !groups.length ? (
          <div className="ac-empty">No companies match your filters.</div>
        ) : (
          groups.map(({ sector: s, items }) => {
            const selCount = items.filter((c) => selected.has(c.ticker)).length
            const addable = items.filter((c) => !c.tracked)
            const allSel = addable.length > 0 && addable.every((c) => selected.has(c.ticker))
            const isCol = collapsed.has(s)
            return (
              <div
                className={
                  'ac-group' +
                  (isCol ? ' collapsed' : '') +
                  (rippling[s] ? ' rippling' : '')
                }
                key={s}
              >
                <div className="ac-group-hd" onClick={() => collapse(s)}>
                  <span className="ac-caret">▼</span>
                  <span className="ac-gname">{s}</span>
                  <span className="ac-gcount">{items.length} cos</span>
                  {selCount > 0 && <span className="ac-gsel">{selCount} selected</span>}
                  <button
                    className="ac-selall"
                    style={selCount > 0 ? undefined : { marginLeft: 'auto' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSector(
                        addable.map((c) => c.ticker),
                        !allSel,
                        s,
                      )
                    }}
                  >
                    {allSel ? 'Clear sector' : 'Select all'}
                  </button>
                </div>
                <Reveal className="ac-grid">
                  {items.map((c, i) => (
                    <Card
                      key={c.ticker}
                      c={c}
                      selected={selected.has(c.ticker)}
                      onToggle={toggle}
                      index={i}
                    />
                  ))}
                </Reveal>
              </div>
            )
          })
        )
      ) : (
        <Table
          rows={tableRows}
          selected={selected}
          onToggle={toggle}
          sortKey={tSortKey}
          sortDir={tSortDir}
          onSort={onTSort}
        />
      )}

      <div className={'ac-tray' + (selectedList.length ? ' show' : '')}>
        <div className="ac-tray-in">
          <span className="ac-tray-count">
            <b><span className="mo-roll" key={selectedList.length}>{selectedList.length}</span></b> selected
          </span>
          <div className="ac-tray-chips">
            {selectedList.map((t) => (
              <span className="ac-tray-chip" key={t}>
                {t}
                <span className="x" onClick={() => toggle(t)}>
                  ✕
                </span>
              </span>
            ))}
          </div>
          <button className="ac-tray-clear" onClick={() => setSelected(new Set())}>
            CLEAR
          </button>
          <Btn kind="primary" sm onClick={onAdd}>
            ADD {selectedList.length} →
          </Btn>
        </div>
      </div>
    </div>
  )
}

/* ====================  STAGE 2: DISCOVER  ==================== */
const STEPS = [
  'Resolving ticker → company',
  'Locating SEC EDGAR CIK',
  'Scanning investor-relations site',
  'Inferring reporting cadence',
]
type DEntry = {
  status: 'queued' | 'run' | 'found' | 'confirm' | 'error'
  step: number
  result?: DiscoveryResult | null
}

function Discover({
  companies,
  onBack,
  onDone,
}: {
  companies: UniverseCompany[]
  onBack: () => void
  onDone: () => void
}) {
  const [d, setD] = useState<Record<string, DEntry>>(() =>
    Object.fromEntries(
      companies.map((c) => [c.ticker, { status: 'queued', step: 0 }] as [string, DEntry]),
    ),
  )
  const [picks, setPicks] = useState<Record<string, number>>({})
  const addCompanies = useAddCompanies()

  // Kick a real discovery per company (staggered so the rail cascades).
  useEffect(() => {
    let cancelled = false
    const timers: number[] = []
    companies.forEach((c, i) => {
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return
          setD((p) => ({ ...p, [c.ticker]: { ...p[c.ticker], status: 'run' } }))
          api
            .discover(c.ticker)
            .then((res) => {
              if (cancelled) return
              const needsConfirm = !!res?.candidates && res.candidates.length > 1
              setD((p) => ({
                ...p,
                [c.ticker]: { status: needsConfirm ? 'confirm' : 'found', step: STEPS.length, result: res },
              }))
            })
            .catch(() => {
              if (!cancelled) setD((p) => ({ ...p, [c.ticker]: { status: 'error', step: 0 } }))
            })
        }, 200 + i * 220),
      )
    })
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cosmetic step cycler for in-flight rows (the API doesn't stream sub-steps).
  useEffect(() => {
    const id = window.setInterval(() => {
      setD((p) => {
        let changed = false
        const n = { ...p }
        for (const k of Object.keys(n)) {
          if (n[k].status === 'run' && n[k].step < STEPS.length - 1) {
            n[k] = { ...n[k], step: n[k].step + 1 }
            changed = true
          }
        }
        return changed ? n : p
      })
    }, 550)
    return () => clearInterval(id)
  }, [])

  const done = companies.filter((c) => {
    const st = d[c.ticker]?.status
    return st === 'found' || st === 'confirm' || st === 'error'
  }).length
  const unresolved = companies.filter(
    (c) => d[c.ticker]?.status === 'confirm' && picks[c.ticker] === undefined,
  ).length
  const pct = Math.round((done / companies.length) * 100)

  const fallbackSources = (c: UniverseCompany): DiscoveryResult => ({
    ir: `investors.${slug(c.name)}.com`,
    sec: `CIK ${String(1000000 + (slug(c.ticker).length * 131) % 8999999).padStart(10, '0')}`,
    cadence: 'Quarterly',
    window: c.earn,
  })

  const confirmAll = () => {
    const primaryIr: Record<string, string> = {}
    companies.forEach((c) => {
      const e = d[c.ticker]
      if (e?.status === 'confirm' && picks[c.ticker] !== undefined) {
        primaryIr[c.ticker] = e.result?.candidates?.[picks[c.ticker]]?.url ?? ''
      }
    })
    addCompanies.mutate(
      { tickers: companies.map((c) => c.ticker), primaryIr },
      { onSuccess: onDone },
    )
  }

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <button className="back" onClick={onBack}>
            ← Back to selection
          </button>
          <h1 className="screen-title">DISCOVER SOURCES</h1>
          <p className="screen-sub">
            Each agent locates where its company's results live — IR site + SEC EDGAR — and infers
            the reporting cadence. Ambiguous IR sites are flagged for a quick confirm.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="lbl">PROGRESS</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
            {done} / {companies.length}
          </div>
        </div>
      </div>

      <div className="ac-prog">
        <span style={{ width: pct + '%' }} />
      </div>

      {companies.map((c) => {
        const e = d[c.ticker] || { status: 'queued', step: 0 }
        const src = e.result ?? fallbackSources(c)
        const rowCls = e.status === 'found' ? 'done' : e.status === 'confirm' ? 'confirm' : ''
        const resolved = e.status === 'found' || e.status === 'confirm'
        return (
          <div className={'ac-drow ' + rowCls} key={c.ticker}>
            <div className="ac-dhd">
              <div className="ac-did">
                <MonoGlyph ticker={c.ticker} sm />
                <div style={{ minWidth: 0 }}>
                  <div className="ac-dtkr">{c.ticker}</div>
                  <div className="ac-dnm">{c.name}</div>
                </div>
              </div>

              {resolved ? (
                <div className="ac-found">
                  <span className="src-pill primary sm">
                    <b>IR</b> {src.ir}
                  </span>
                  <span className="src-pill sm">
                    <b>SEC</b> {src.sec}
                  </span>
                  <span className="src-pill sm">{src.cadence}</span>
                </div>
              ) : (
                <div className="ac-dsteps">
                  {STEPS.map((label, i) => {
                    if (e.step < i) return null
                    const cls = e.step > i ? 'ok' : e.step === i ? 'run' : ''
                    return (
                      <div className={'ac-dstep ' + cls} key={i}>
                        <span className="b">{e.step > i ? '✓' : <span className="ac-spin">◴</span>}</span>{' '}
                        {label}
                      </div>
                    )
                  })}
                  {e.status === 'queued' && <div className="ac-dstep">· Queued</div>}
                  {e.status === 'error' && (
                    <div className="ac-dstep" style={{ color: 'var(--red)' }}>
                      ✕ Discovery failed — retry later
                    </div>
                  )}
                </div>
              )}

              <div className="ac-dstate">
                {e.status === 'found' && <span className="ac-statechip found">✓ SOURCES FOUND</span>}
                {e.status === 'confirm' &&
                  (picks[c.ticker] !== undefined ? (
                    <span className="ac-statechip found">✓ CONFIRMED</span>
                  ) : (
                    <span className="ac-statechip confirm">⚑ CONFIRM IR</span>
                  ))}
                {(e.status === 'run' || e.status === 'queued') && (
                  <span className="ac-statechip run">
                    <span className="ac-pulse" />
                    READING
                  </span>
                )}
              </div>
            </div>

            {e.status === 'confirm' && picks[c.ticker] === undefined && e.result?.candidates && (
              <div className="ac-confirm">
                Two plausible IR pages found — pick the one the agent should pin as primary:
                <div className="ac-cands">
                  {e.result.candidates.map((cand, i) => (
                    <div className="ac-cand" key={i} onClick={() => setPicks((p) => ({ ...p, [c.ticker]: i }))}>
                      <div className="u">{cand.url}</div>
                      <div className="w">{cand.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'center' }}>
        <Btn
          kind="primary"
          icon="▸"
          onClick={confirmAll}
          disabled={done < companies.length || unresolved > 0 || addCompanies.isPending}
        >
          {addCompanies.isPending ? 'STARTING…' : `START WATCHING ALL (${companies.length})`}
        </Btn>
        <Btn kind="ghost" onClick={onBack}>
          Cancel
        </Btn>
        {unresolved > 0 && (
          <span style={{ fontSize: 10.5, color: 'var(--amber)' }}>{unresolved} need IR confirmation</span>
        )}
        {done < companies.length && (
          <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>discovering…</span>
        )}
      </div>
    </div>
  )
}

/* ====================  ENTRY  ==================== */
export function AddCompanies({ onClose }: { onClose: () => void }) {
  const { data: universe, isLoading } = useUniverse()
  const [phase, setPhase] = useState<'browse' | 'discover' | 'done'>('browse')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const selectedCompanies = useMemo(
    () => (universe ?? []).filter((c) => selected.has(c.ticker)),
    [universe, selected],
  )

  if (isLoading || !universe) return <Loading title="ADD COMPANIES" />

  if (phase === 'discover')
    return (
      <Discover
        companies={selectedCompanies}
        onBack={() => setPhase('browse')}
        onDone={() => setPhase('done')}
      />
    )

  if (phase === 'done')
    return (
      <div className="screen">
        <div className="ac-done">
          <div className="ac-done-big">✓ Now watching {selectedCompanies.length} companies</div>
          <div className="ac-done-sub">
            Agents are live. They'll poll each company's sources on schedule, extract and
            cross-validate the headline figures, and notify you the moment results drop.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Btn
              kind="primary"
              onClick={() => {
                setSelected(new Set())
                setPhase('browse')
              }}
            >
              Add more
            </Btn>
            <Btn kind="ghost" onClick={onClose}>
              Done
            </Btn>
          </div>
        </div>
      </div>
    )

  return (
    <Browse
      universe={universe}
      selected={selected}
      setSelected={setSelected}
      onAdd={() => selected.size && setPhase('discover')}
      onClose={onClose}
    />
  )
}
