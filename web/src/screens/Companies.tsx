/* Agent Orange — Companies config (companies, §5.5). Configure tracked companies
   + add new ones via the multi-select Add Companies flow (browse S&P 500 →
   discover sources → start watching all). */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Glyph, Panel, StatusChip } from '../components/primitives'
import { Loading } from '../components/Loading'
import { Reveal } from '../motion/motion'
import { AddCompanies } from './AddCompanies'
import {
  useArchivedCompanies,
  useCompanies,
  useDeleteCompany,
  useRestoreCompany,
} from '../hooks'

export function Companies() {
  const { data: companies } = useCompanies()
  const { data: archived } = useArchivedCompanies()
  const restore = useRestoreCompany()
  const del = useDeleteCompany()
  const navigate = useNavigate()

  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  function handleRestore(t: string) {
    restore.mutate(t)
  }
  function handleDelete(t: string) {
    // Double-confirm: archive + delete is two clicks of an already-archived row.
    if (!window.confirm(`Permanently delete ${t}? This wipes every filing, result, metric, price, news and insider row for this ticker. Cannot be undone.`)) return
    if (!window.confirm(`Last chance — really delete ${t} and all related data?`)) return
    del.mutate(t)
  }

  if (!companies) return <Loading title="COMPANIES" />

  if (adding) return <AddCompanies onClose={() => setAdding(false)} />

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">COMPANIES</h1>
          <p className="screen-sub">
            Configure which companies the agents track, where to look, and how strict validation is.
          </p>
        </div>
        <div className="screen-actions">
          {(archived?.length ?? 0) > 0 && (
            <Btn kind="ghost" sm onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'HIDE ARCHIVED' : `ARCHIVED (${archived?.length ?? 0})`}
            </Btn>
          )}
          <Btn kind="primary" sm icon="+" onClick={() => setAdding(true)}>
            ADD COMPANIES
          </Btn>
        </div>
      </div>

      <Reveal className="cfg-list">
        {companies.map((c) => (
          <div className="cfg-row" key={c.ticker} onClick={() => navigate('/company/' + c.ticker)}>
            <Glyph ticker={c.ticker} status={c.status} />
            <div className="cfg-id">
              <b>{c.ticker}</b>
              <span>{c.name}</span>
            </div>
            <div className="cfg-src">
              {c.sources.map((s) => (
                <span key={s.label} className="src-pill sm">
                  <b>{s.kind}</b> {s.label}
                </span>
              ))}
            </div>
            <span className="cfg-cad">{c.cadence}</span>
            <span className="cfg-mode">mode: {c.sourceMode}</span>
            <StatusChip status={c.status} />
          </div>
        ))}
      </Reveal>

      {showArchived && (archived?.length ?? 0) > 0 && (
        <Panel title="ARCHIVED">
          <div className="cfg-list">
            {archived!.map((c) => (
              <div className="cfg-row archived" key={c.ticker}>
                <Glyph ticker={c.ticker} status={c.status} />
                <div className="cfg-id">
                  <b>{c.ticker}</b>
                  <span>{c.name}</span>
                </div>
                <span className="cfg-mode">archived {c.archivedAt?.slice(0, 10) ?? ''}</span>
                <div className="cfg-actions">
                  <Btn kind="ghost" sm onClick={() => handleRestore(c.ticker)} disabled={restore.isPending}>
                    RESTORE
                  </Btn>
                  {c.ticker !== 'NVDA' && (
                    <Btn kind="danger" sm onClick={() => handleDelete(c.ticker)} disabled={del.isPending}>
                      {del.isPending ? 'DELETING…' : 'PERMANENTLY DELETE'}
                    </Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
