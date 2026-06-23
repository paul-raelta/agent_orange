/* Shared terminal-style log list — used by the company AGENT RUNS tab and the
   Activity screen (§5.2, §5.6). */
import type { ActivityRow } from '../types'

export function LogList({ rows }: { rows: ActivityRow[] }) {
  return (
    <ul className="log">
      {rows.map((r, i) => (
        <li key={i} className={'log-row lvl-' + r.level}>
          <span className="log-t" title="Timestamp of this agent run">{r.t}</span>
          <span
            className={'log-agent ag-' + r.agent}
            title={`Pipeline stage — ${r.agent}`}
          >
            {r.agent}
          </span>
          <span className="log-msg">{r.msg}</span>
          <span
            className="log-cost"
            title={`Tokens consumed · API cost in USD for this single agent call (${r.tokens.toLocaleString()} tokens)`}
          >
            {(r.tokens / 1000).toFixed(1)}k tok · ${r.cost.toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  )
}
