/* Agent Orange — Review Queue (review, §5.4). Human-in-the-loop resolution of
   findings the agent couldn't auto-validate. Resolve is optimistic (§7). */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Conf, Glyph, Panel, ProvenanceItem } from '../components/primitives'
import { Loading } from '../components/Loading'
import { Reveal } from '../motion/motion'
import { useCompanies, useFeatureFlags, useResolveReview, useReviewQueue } from '../hooks'
import type { ConflictSourceId, ReviewConflict, ReviewItem as ReviewItemT } from '../types'

export function Review() {
  const { data: items } = useReviewQueue()
  const { data: companies } = useCompanies()
  const navigate = useNavigate()
  const resolveMutation = useResolveReview()
  const { flags } = useFeatureFlags()
  const [resolved, setResolved] = useState<Record<string, string>>({})
  const logoByTicker: Record<string, string | null | undefined> = {}
  for (const c of companies ?? []) logoByTicker[c.ticker] = c.logoUrl

  if (!items) return <Loading title="REVIEW QUEUE" />

  function resolve(
    id: string,
    choice: string,
    extras?: { note?: string; pinnedValue?: string },
  ) {
    setResolved((r) => ({ ...r, [id]: choice })) // optimistic
    resolveMutation.mutate({ id, choice, ...(extras ?? {}) })
  }

  const pending = items.filter((i) => !resolved[i.id])

  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">REVIEW QUEUE</h1>
          <p className="screen-sub">
            {pending.length} finding{pending.length === 1 ? '' : 's'} need a human decision before
            they're recorded.
          </p>
        </div>
      </div>

      {items.length === 0 && (
        <Panel>
          <div className="empty">
            Nothing to review. Agents will queue items here when a number can't be auto-validated.
          </div>
        </Panel>
      )}

      <Reveal className="rv-list">
        {items.map((it) => {
          const done = resolved[it.id]
          // Conflict-workspace fork: flag on AND backend attached the rich
          // conflict block. Falls through to the simple row otherwise.
          if (flags.conflict && it.conflict && !done) {
            return (
              <ConflictWorkspaceItem
                key={it.id}
                item={it}
                conflict={it.conflict}
                logoUrl={logoByTicker[it.ticker]}
                onResolve={(choice, extras) => resolve(it.id, choice, extras)}
              />
            )
          }
          return (
            <article key={it.id} className={'rv-card' + (done ? ' resolved' : '')}>
              <div className="rv-hd">
                <span className="rv-ticker" onClick={() => navigate('/company/' + it.ticker)}>
                  {it.ticker}
                </span>
                <span className="rv-period">
                  {it.period} · ended {it.periodEnd}
                </span>
                <Conf level={it.conf} />
                <span className="rv-found">found {it.foundOn}</span>
              </div>
              <div className="rv-reason">
                <b>{it.field}</b> — {it.reason}
              </div>

              <div className="rv-candidates">
                {it.candidates.map((cd, i) => (
                  <label key={i} className={'rv-cand' + (done === cd.value ? ' chosen' : '')}>
                    <span className="rv-cand-val">{cd.value}</span>
                    <span className="rv-cand-src">{cd.source}</span>
                    <span className="rv-cand-weight">{cd.weight}</span>
                  </label>
                ))}
              </div>

              <ProvenanceItem p={it.snippet} />

              {done ? (
                <div className="rv-done">
                  ✓ Recorded <b>{done === 'reject' ? '— rejected' : done}</b> · removed from queue
                </div>
              ) : (
                <div className="rv-actions">
                  {it.candidates.map((cd, i) => (
                    <Btn
                      key={i}
                      kind={i === 0 ? 'primary' : 'ghost'}
                      sm
                      onClick={() => resolve(it.id, cd.value)}
                    >
                      USE {cd.value}
                    </Btn>
                  ))}
                  <Btn kind="danger" sm onClick={() => resolve(it.id, 'reject')}>
                    REJECT
                  </Btn>
                </div>
              )}
            </article>
          )
        })}
      </Reveal>
    </div>
  )
}

function ConflictWorkspaceItem({
  item,
  conflict,
  logoUrl,
  onResolve,
}: {
  item: ReviewItemT
  conflict: ReviewConflict
  logoUrl?: string | null
  onResolve: (
    choice: string,
    extras: { note?: string; pinnedValue?: string },
  ) => void
}) {
  const [choice, setChoice] = useState<ConflictSourceId | 'flag' | 'both-wrong' | null>(null)
  const [note, setNote] = useState('')
  const pickedSource = conflict.sources.find((src) => src.id === choice)
  const needsNote = choice === 'flag' || choice === 'both-wrong'
  const canResolve = choice !== null && (!needsNote || note.trim().length > 0)

  return (
    <div className="cw">
      <div className="cw-hd">
        <Glyph ticker={item.ticker} status="review" logoUrl={logoUrl} />
        <div className="cw-hd-id">
          <div className="cw-hd-tkr">
            {item.ticker} · {conflict.metric}
          </div>
          <div className="cw-hd-sub">
            {conflict.sources.length} sources disagree · {conflict.period}
          </div>
        </div>
        <span className="cw-flag">⚑ NEEDS DECISION</span>
      </div>
      <div className="cw-diff">
        {conflict.sources.map((src) => (
          <div
            key={src.id}
            className={'cw-col' + (choice === src.id ? ' pick' : '')}
            onClick={() => setChoice(src.id)}
          >
            <div className="cw-col-hd">
              <span className="cw-srcpill">
                <b>{src.kind}</b>
                {src.label}
              </span>
              <Conf level={src.confidence} />
            </div>
            <div className="cw-val">{src.value}</div>
            <div className="cw-snip">"{src.snippet}"</div>
            {src.url && (
              <a
                className="cw-link"
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {src.url} ↗
              </a>
            )}
            {src.note && <div className="cw-note">{src.note}</div>}
            <button
              type="button"
              className={'cw-pick' + (choice === src.id ? ' on' : '')}
              onClick={(e) => {
                e.stopPropagation()
                setChoice(src.id)
              }}
            >
              {choice === src.id ? '✓ ACCEPTED' : 'Accept ' + src.id}
            </button>
          </div>
        ))}
        {conflict.sources.length === 2 && <div className="cw-vs">VS</div>}
      </div>
      <div className="cw-rail">
        <div className="cw-rail-actions">
          <button
            type="button"
            className={'cw-act' + (choice === 'flag' ? ' on' : '')}
            onClick={() => setChoice('flag')}
          >
            ⚑ Flag for analyst
          </button>
          <button
            type="button"
            className={'cw-act' + (choice === 'both-wrong' ? ' on' : '')}
            onClick={() => setChoice('both-wrong')}
          >
            ✕ Both wrong
          </button>
        </div>
        <input
          type="text"
          className="cw-noteinput"
          placeholder={
            needsNote
              ? 'Decision note (required)…'
              : 'Decision note (optional)…'
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="cw-rail-bottom">
          <button
            type="button"
            className="cw-act prim"
            disabled={!canResolve}
            onClick={() =>
              onResolve(choice === null ? '' : choice, {
                note: note.trim() || undefined,
                pinnedValue: pickedSource?.value,
              })
            }
          >
            Resolve &amp; continue →
          </button>
        </div>
      </div>
    </div>
  )
}
