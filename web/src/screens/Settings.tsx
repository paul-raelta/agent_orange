/* Agent Orange — Settings (settings, §5.7). Usage/budget, provider-agnostic
   routing, notifications, schedule defaults. */
import { useEffect, useState } from 'react'
import { Btn, Panel } from '../components/primitives'
import { Loading } from '../components/Loading'
import {
  useNotificationPrefs,
  useProviders,
  usePutRouting,
  useRouting,
  useSaveNotificationPrefs,
  useUsage,
} from '../hooks'
import { useShell } from '../layout/shellContext'
import type { RunFeedback } from '../layout/shellContext'
import type { NotificationPrefs } from '../types'

const MODELS = ['Claude Haiku 4', 'Claude Sonnet 4', 'Claude Opus 4']

export function Settings() {
  const { data: usage } = useUsage()
  const { data: providers } = useProviders()
  const { data: routing } = useRouting()
  const putRouting = usePutRouting()
  const { data: prefs } = useNotificationPrefs()
  const savePrefs = useSaveNotificationPrefs()
  const { runFeedback, setRunFeedback } = useShell()

  // Local edit state for the notifications form — committed on Save.
  const [draft, setDraft] = useState<NotificationPrefs | null>(null)
  useEffect(() => {
    if (prefs && !draft) setDraft(prefs)
  }, [prefs, draft])

  if (!usage || !providers || !routing || !prefs || !draft) return <Loading title="SETTINGS" />

  const pct = Math.round((usage.monthCost / usage.budget) * 100)

  const setRoutingModel = (task: string, model: string) => {
    const next = routing.map((r) => (r.task === task ? { ...r, model } : r))
    putRouting.mutate(next)
  }

  const update = <K extends keyof NotificationPrefs>(key: K, val: NotificationPrefs[K]) =>
    setDraft({ ...draft, [key]: val })

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">SETTINGS</h1>
          <p className="screen-sub">
            Model &amp; provider routing, notifications, schedules, budgets. The agent layer is
            provider-agnostic — swap models per task.
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
            <div className="um-row" key={m.model + m.task}>
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
        right={
          <span className="hint">
            cheaper models for cheap work; strong models where it counts
          </span>
        }
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
                  <button
                    key={m}
                    className={r.model === m ? 'active' : ''}
                    onClick={() => setRoutingModel(r.task, m)}
                  >
                    {m.replace('Claude ', '')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="NOTIFICATIONS">
        <div className="notif-grid">
          <label>
            <span className="lbl">EMAIL</span>
            <input
              className="inp"
              type="email"
              value={draft.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </label>
          <label>
            <span className="lbl">PHONE (E.164)</span>
            <input
              className="inp"
              type="tel"
              placeholder="+353…"
              value={draft.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </label>
        </div>
        <div className="notif-toggles">
          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={draft.emailEnabled}
              onChange={(e) => update('emailEnabled', e.target.checked)}
            />
            Email channel enabled
          </label>
          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={draft.smsEnabled}
              onChange={(e) => update('smsEnabled', e.target.checked)}
            />
            SMS channel enabled (Twilio)
          </label>
          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={draft.onValidated}
              onChange={(e) => update('onValidated', e.target.checked)}
            />
            New results validated
          </label>
          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={draft.onReview}
              onChange={(e) => update('onReview', e.target.checked)}
            />
            Item routed to review queue
          </label>
          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={draft.onWatchingStarted}
              onChange={(e) => update('onWatchingStarted', e.target.checked)}
            />
            Watching window started
          </label>
          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={draft.onBudget80}
              onChange={(e) => update('onBudget80', e.target.checked)}
            />
            Monthly budget hits 80%
          </label>
        </div>
        <div className="notif-save">
          <Btn
            kind="primary"
            sm
            onClick={() => savePrefs.mutate(draft)}
            disabled={savePrefs.isPending}
          >
            {savePrefs.isPending ? 'SAVING…' : 'SAVE NOTIFICATIONS'}
          </Btn>
          {savePrefs.isSuccess && (
            <span style={{ color: 'var(--green)', fontSize: 11 }}>✓ Saved</span>
          )}
        </div>
      </Panel>

      <Panel
        title="RUN-ALL FEEDBACK"
        right={<span className="hint">how the UI tells you the pipeline was kicked</span>}
      >
        <div className="route-row">
          <div className="route-task">
            <b>Visible response on RUN ALL AGENTS</b>
            <span>
              The API returns instantly (the pipeline runs in the background), so without
              extra UI the click can look like it did nothing.
            </span>
          </div>
          <div className="seg seg-model">
            {([
              { value: 'toast', label: 'TOAST' },
              { value: 'button', label: 'HELD BUTTON' },
              { value: 'both', label: 'BOTH' },
            ] as { value: RunFeedback; label: string }[]).map((opt) => (
              <button
                key={opt.value}
                className={runFeedback === opt.value ? 'active' : ''}
                onClick={() => setRunFeedback(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
