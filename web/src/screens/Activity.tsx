/* Agent Orange — Activity log (activity, §5.6). Filter bar + terminal-style log
   of everything the agents did. */
import { useState } from 'react'
import { Panel } from '../components/primitives'
import { LogList } from '../components/LogList'
import { Loading } from '../components/Loading'
import { useActivity, useCompanies, useUsage } from '../hooks'

export function Activity() {
  const [filter, setFilter] = useState('all')
  const { data: companies } = useCompanies()
  const { data: usage } = useUsage()
  const { data: rows } = useActivity(filter === 'all' ? undefined : filter)

  if (!companies || !usage) return <Loading title="ACTIVITY LOG" />

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">ACTIVITY LOG</h1>
          <p className="screen-sub">
            Everything the agents did — transparent and auditable. {usage.runs} runs this month.
          </p>
        </div>
      </div>
      <div className="filt">
        {['all', ...companies.map((c) => c.ticker)].map((f) => (
          <button
            key={f}
            className={'filt-btn' + (filter === f ? ' active' : '')}
            onClick={() => setFilter(f)}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>
      <Panel pad={false}>
        <LogList rows={rows ?? []} />
      </Panel>
    </div>
  )
}
