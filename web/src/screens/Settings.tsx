/* Agent Orange — Settings (settings, §5.7). Usage/budget, provider-agnostic
   routing, notifications, schedule defaults. */
import { useEffect, useState } from 'react'
import { Btn, Panel } from '../components/primitives'
import { Loading } from '../components/Loading'
import { CountUp } from '../motion/motion'
import {
  useAddDataSource,
  useDataSources,
  useDeleteDataSource,
  useFeatureFlags,
  useNotificationPrefs,
  usePatchDataSource,
  useProviders,
  usePutRouting,
  useRouting,
  useSaveNotificationPrefs,
  useSuggestSource,
  useTestDataSource,
  useUsage,
  useWipe,
} from '../hooks'
import { useShell } from '../layout/shellContext'
import type { RunFeedback } from '../layout/shellContext'
import type {
  DataSource,
  DataSourceKind,
  NotificationPrefs,
  TestDataSourceResult,
} from '../types'

const MODELS = ['Claude Haiku 4', 'Claude Sonnet 4', 'Claude Opus 4']

const DATA_SOURCE_KINDS: DataSourceKind[] = ['filings', 'quote', 'news', 'insider', 'ir']

export function Settings() {
  const { data: usage } = useUsage()
  const { data: providers } = useProviders()
  const { data: routing } = useRouting()
  const putRouting = usePutRouting()
  const { data: prefs } = useNotificationPrefs()
  const savePrefs = useSaveNotificationPrefs()
  const { runFeedback, setRunFeedback } = useShell()
  const wipe = useWipe()
  const [confirmWipe, setConfirmWipe] = useState(false)

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
            <span className="ub-val">
              <CountUp value={usage.monthCost} prefix="$" decimals={2} />
            </span>
            <span className="ub-lab">of ${usage.budget} budget</span>
          </div>
          <div className="usage-bar">
            <span style={{ width: pct + '%' }} />
          </div>
          <div className="usage-stats">
            <span><CountUp value={usage.monthTokens} decimals={0} suffix="M tokens" /></span>
            <span><CountUp value={usage.runs} decimals={0} suffix=" runs" /></span>
            <span><CountUp value={pct} decimals={0} suffix="% of budget" /></span>
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

      <FeatureFlagsPanel />

      <DataSourcesPanel />

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

      <Panel
        title="FIRST-TIME EXPERIENCE"
        right={<span className="hint">destructive — wipes tracked companies + all fetched data</span>}
      >
        <p
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 12,
            color: 'var(--text-2)',
            lineHeight: 1.55,
            marginBottom: 12,
          }}
        >
          Clear every tracked company along with every filing, result,
          metric, agent run, price snapshot, news item, insider transaction
          and usage row — keeping your model routing, data-source registry,
          and notification settings. After wipe, no companies are tracked;
          add tickers from scratch, then click <b>RUN ALL AGENTS</b> on the
          Watchlist to populate live data: real EDGAR filings, real Finnhub
          prices/news/insider, real Opus extraction + validation + narrative,
          and real email + SMS notifications.
        </p>
        {!confirmWipe ? (
          <Btn kind="danger" sm onClick={() => setConfirmWipe(true)}>
            RESET TO FIRST-TIME STATE
          </Btn>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 12,
                color: 'var(--red)',
              }}
            >
              This is destructive. Confirm:
            </span>
            <Btn
              kind="danger"
              sm
              onClick={() =>
                wipe.mutate(undefined, {
                  onSuccess: () => setConfirmWipe(false),
                })
              }
              disabled={wipe.isPending}
            >
              {wipe.isPending ? 'WIPING…' : 'YES, WIPE EVERYTHING'}
            </Btn>
            <Btn kind="ghost" sm onClick={() => setConfirmWipe(false)}>
              Cancel
            </Btn>
            {wipe.isSuccess && (
              <span style={{ color: 'var(--green)', fontSize: 11 }}>
                ✓ Wiped — go to Watchlist and click RUN ALL AGENTS
              </span>
            )}
          </div>
        )}
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

/* ----------------------------------------------------------------------- */
/* LABS · FEATURE FLAGS — one toggle per compartmentalized earnings feature. */
/* Each row gates a single feature's surfaces; turning a row off must leave  */
/* every other screen rendering exactly as it did before the feature shipped.*/
/* ----------------------------------------------------------------------- */

type FlagDef = {
  key: 'consensus' | 'conflict' | 'guidance'
  name: string
  desc: string
  surfaces: string
}

const FLAG_DEFS: FlagDef[] = [
  {
    key: 'consensus',
    name: 'Consensus vs Actual',
    desc: 'Surprise chips, beat/miss banner, and a "vs estimate" column.',
    surfaces: 'Watchlist card · Deep-dive header + Results table',
  },
  {
    key: 'conflict',
    name: 'Conflict-Resolution Workspace',
    desc: 'Side-by-side source diff with a decision rail for disputed figures.',
    surfaces: 'Review queue item',
  },
  {
    key: 'guidance',
    name: 'Guidance Tracking',
    desc: 'Forward outlook vs prior guidance, with provenance.',
    surfaces: 'Deep-dive · GUIDANCE tab',
  },
]

function FeatureFlagsPanel() {
  const { flags, setFlag, saving } = useFeatureFlags()
  return (
    <Panel
      title="LABS · FEATURE FLAGS"
      right={
        <span className="hint">
          each flag is a render gate over optional data — turn it off and the
          surface disappears, nothing else changes
        </span>
      }
    >
      <div className="ff-list">
        {FLAG_DEFS.map((f) => (
          <div className="ff-row" key={f.key}>
            <div className="ff-info">
              <div className="ff-name">{f.name}</div>
              <div className="ff-desc">{f.desc}</div>
              <div className="ff-surf">▸ {f.surfaces}</div>
            </div>
            <button
              type="button"
              className={'sw' + (flags[f.key] ? ' on' : '')}
              onClick={() => setFlag(f.key, !flags[f.key])}
              aria-label={`Toggle ${f.name}`}
              aria-pressed={flags[f.key]}
              disabled={saving}
            />
          </div>
        ))}
      </div>
      <p className="ff-note">
        Each feature renders only when its flag is on, over optional data.
        Off = the surface disappears; nothing else is touched. No restart, no
        migration. Backend skips disabled features — no estimate fetches, no
        guidance extraction, no workspace payload.
      </p>
    </Panel>
  )
}

/* ----------------------------------------------------------------------- */
/* DATA SOURCES — the financial-data feeds the agents fetch from.          */
/* Sibling of the LLM PROVIDERS panel above; lists built-ins + user-added, */
/* lets you toggle, add a custom HTTPS URL, or suggest one we should add.  */
/* ----------------------------------------------------------------------- */

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const delta = Date.now() - t
  if (delta < 60_000) return 'just now'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`
  return `${Math.floor(delta / 86_400_000)}d ago`
}

function DataSourcesPanel() {
  const { data: sources } = useDataSources()
  const patch = usePatchDataSource()
  const del = useDeleteDataSource()
  const test = useTestDataSource()
  const add = useAddDataSource()
  const suggest = useSuggestSource()

  const [adding, setAdding] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [draftKind, setDraftKind] = useState<DataSourceKind>('news')
  const [addPreview, setAddPreview] = useState<TestDataSourceResult | null>(null)

  const [suggesting, setSuggesting] = useState(false)
  const [sUrl, setSUrl] = useState('')
  const [sNote, setSNote] = useState('')
  const [suggestSaved, setSuggestSaved] = useState(false)

  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, TestDataSourceResult>>({})

  if (!sources) return null

  const resetAdd = () => {
    setAdding(false)
    setDraftName('')
    setDraftUrl('')
    setDraftKind('news')
    setAddPreview(null)
  }
  const resetSuggest = () => {
    setSuggesting(false)
    setSUrl('')
    setSNote('')
    setSuggestSaved(false)
  }

  const runTest = async (id: string) => {
    setTestingId(id)
    try {
      const result = await test.mutateAsync(id)
      setTestResult((prev) => ({ ...prev, [id]: result }))
    } finally {
      setTestingId(null)
    }
  }

  return (
    <Panel
      title="DATA SOURCES"
      right={<span className="hint">where the agents fetch financial data from</span>}
    >
      <div className="ds-list">
        {sources.map((src: DataSource) => {
          const dotClass =
            !src.enabled ? '' :
            src.status === 'error' ? 'error' :
            src.status === 'planned' ? 'planned' : 'active'
          const last = src.lastError
            ? `error · ${src.lastError.slice(0, 60)}`
            : `last ok ${relativeTime(src.lastOkAt)}`
          return (
            <div key={src.id} className={'ds-row' + (src.enabled ? '' : ' disabled')}>
              <span className={'ds-dot ' + dotClass} />
              <div className="ds-id">
                <b>{src.name}</b>
                <span>
                  {src.authLabel}
                  {src.origin === 'user' && src.baseUrl ? ` · ${src.baseUrl}` : ''}
                </span>
              </div>
              <span className="ds-kind">{src.kind}</span>
              <span className="ds-meta">{last}</span>
              <div className="ds-actions">
                <button
                  className={'ds-toggle' + (src.enabled ? ' on' : '')}
                  onClick={() =>
                    patch.mutate({ id: src.id, body: { enabled: !src.enabled } })
                  }
                  disabled={patch.isPending}
                >
                  {src.enabled ? '● ENABLED' : '○ DISABLED'}
                </button>
                {src.origin === 'user' && (
                  <>
                    <button
                      className="ds-tinybtn"
                      onClick={() => runTest(src.id)}
                      disabled={testingId === src.id}
                    >
                      {testingId === src.id ? '…' : 'TEST'}
                    </button>
                    <button
                      className="ds-tinybtn danger"
                      onClick={() => del.mutate(src.id)}
                      disabled={del.isPending}
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
              {testResult[src.id] && (
                <div
                  className={'ds-preview' + (testResult[src.id].ok ? '' : ' error')}
                  style={{ gridColumn: '1 / -1' }}
                >
                  {testResult[src.id].ok
                    ? `HTTP ${testResult[src.id].status} · ${
                        testResult[src.id].contentType || 'no content-type'
                      }\n\n${testResult[src.id].preview}`
                    : `Failed: ${testResult[src.id].error}`}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!adding ? (
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn kind="primary" sm icon="+" onClick={() => setAdding(true)}>
            ADD CUSTOM SOURCE
          </Btn>
          <Btn kind="ghost" sm onClick={() => setSuggesting(true)}>
            SUGGEST A SOURCE
          </Btn>
        </div>
      ) : (
        <div className="ds-add">
          <span className="ds-add-hd">ADD CUSTOM HTTPS SOURCE</span>
          <div className="ds-add-grid">
            <input
              className="inp"
              placeholder="Display name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <input
              className="inp"
              placeholder="https://…"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
            />
            <select
              className="inp"
              value={draftKind}
              onChange={(e) => setDraftKind(e.target.value as DataSourceKind)}
            >
              {DATA_SOURCE_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, fontFamily: 'var(--sans)' }}>
            Only <code>https://</code> URLs. We block private / loopback IPs and cap responses
            at 5 MB. The fetcher is generic — it surfaces the response so an agent can read it,
            but doesn't parse it into structured data yet.
          </p>
          {addPreview && (
            <div className={'ds-preview' + (addPreview.ok ? '' : ' error')}>
              {addPreview.ok
                ? `HTTP ${addPreview.status} · ${addPreview.contentType || 'no content-type'}\n\n${addPreview.preview}`
                : `Failed: ${addPreview.error}`}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn
              kind="primary"
              sm
              onClick={async () => {
                const created = await add.mutateAsync({
                  name: draftName || 'Custom source',
                  url: draftUrl,
                  kind: draftKind,
                })
                resetAdd()
                // Auto-test once after add so the user sees green/red immediately.
                runTest(created.id)
              }}
              disabled={!draftUrl.startsWith('https://') || !draftName.trim() || add.isPending}
            >
              {add.isPending ? 'SAVING…' : 'SAVE SOURCE'}
            </Btn>
            <Btn kind="ghost" sm onClick={resetAdd}>Cancel</Btn>
          </div>
        </div>
      )}

      {suggesting && (
        <div className="ds-suggest">
          <span className="ds-suggest-hd">SUGGEST A SOURCE WE DON'T SUPPORT YET</span>
          <div className="ds-suggest-row">
            <input
              className="inp"
              placeholder="https://example.com/feed"
              value={sUrl}
              onChange={(e) => setSUrl(e.target.value)}
            />
            <input
              className="inp"
              placeholder="one-line why (optional)"
              value={sNote}
              onChange={(e) => setSNote(e.target.value)}
            />
            <Btn
              kind="primary"
              sm
              onClick={async () => {
                await suggest.mutateAsync({ url: sUrl, note: sNote })
                setSuggestSaved(true)
                setSUrl('')
                setSNote('')
              }}
              disabled={!sUrl.trim() || suggest.isPending}
            >
              {suggest.isPending ? '…' : 'SUBMIT'}
            </Btn>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--sans)' }}>
              Goes into the backlog table — nothing has to work, this is a wishlist signal.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {suggestSaved && (
                <span style={{ color: 'var(--green)', fontSize: 11 }}>✓ Submitted</span>
              )}
              <Btn kind="ghost" sm onClick={resetSuggest}>Done</Btn>
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}
