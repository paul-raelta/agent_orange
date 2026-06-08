/* Agent Orange — Settings (settings, §5.7). Usage/budget, provider-agnostic
   routing, schedule & validation defaults. */
import { Panel } from '../components/primitives'
import { Loading } from '../components/Loading'
import { useProviders, useRouting, useUsage } from '../hooks'

const MODELS = ['Claude Haiku 4', 'Claude Sonnet 4', 'Claude Opus 4']

export function Settings() {
  const { data: usage } = useUsage()
  const { data: providers } = useProviders()
  const { data: routing } = useRouting()

  if (!usage || !providers || !routing) return <Loading title="SETTINGS" />

  const pct = Math.round((usage.monthCost / usage.budget) * 100)

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">SETTINGS</h1>
          <p className="screen-sub">
            Model &amp; provider routing, schedules, budgets. The agent layer is provider-agnostic —
            swap models per task.
          </p>
        </div>
      </div>

      <Panel title="USAGE — this month">
        <div className="usage">
          <div className="usage-big">
            <span className="ub-val">${usage.monthCost.toFixed(2)}</span>
            <span className="ub-lab">of ${usage.budget} budget</span>
          </div>
          <div className="usage-bar">
            <span style={{ width: pct + '%' }} />
          </div>
          <div className="usage-stats">
            <span>{usage.monthTokens}M tokens</span>
            <span>{usage.runs} runs</span>
            <span>{pct}% of budget</span>
          </div>
        </div>
        <div className="usage-models">
          {usage.byModel.map((m) => (
            <div className="um-row" key={m.model}>
              <span className="um-name">{m.model}</span>
              <span className="um-task">{m.task}</span>
              <div className="um-bar">
                <span style={{ width: m.share + '%' }} />
              </div>
              <span className="um-cost">${m.cost.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="PROVIDERS">
        <div className="prov-grid">
          {providers.map((p) => (
            <div className={'prov-card ' + p.status} key={p.id}>
              <div className="pc-hd">
                <span className="pc-name">{p.name}</span>
                <span className={'pc-status ' + p.status}>
                  {p.status === 'active' ? '● ACTIVE' : 'PLANNED'}
                </span>
              </div>
              <div className="pc-auth">{p.auth}</div>
              <div className="pc-models">
                {p.models.map((m) => (
                  <span key={m} className="pc-model">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="MODEL ROUTING — per task"
        right={<span className="hint">cheaper models for cheap work; strong models where it counts</span>}
      >
        <div className="route">
          {routing.map((r) => (
            <div className="route-row" key={r.task}>
              <div className="route-task">
                <b>{r.task}</b>
                <span>{r.desc}</span>
              </div>
              <div className="seg seg-model">
                {MODELS.map((m) => (
                  <button key={m} className={r.model === m ? 'active' : ''}>
                    {m.replace('Claude ', '')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="SCHEDULE & VALIDATION DEFAULTS">
        <div className="kv">
          <div>
            <span className="lbl">POLL FREQUENCY</span>
            <span>Daily 06:00 + every 4h inside a predicted window</span>
          </div>
          <div>
            <span className="lbl">RUN MODE</span>
            <span>Offline / unsupervised — queue conflicts for review</span>
          </div>
          <div>
            <span className="lbl">DEFAULT VALIDATION</span>
            <span>Cross-reference EPS in ≥2 locations</span>
          </div>
          <div>
            <span className="lbl">NOTIFY ON</span>
            <span>New results · validation conflict · budget 80%</span>
          </div>
        </div>
      </Panel>
    </div>
  )
}
