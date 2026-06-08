/* Agent Orange — Review Queue (review, §5.4). Human-in-the-loop resolution of
   findings the agent couldn't auto-validate. Resolve is optimistic (§7). */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Conf, Panel, ProvenanceItem } from '../components/primitives'
import { Loading } from '../components/Loading'
import { useResolveReview, useReviewQueue } from '../hooks'

export function Review() {
  const { data: items } = useReviewQueue()
  const navigate = useNavigate()
  const resolveMutation = useResolveReview()
  const [resolved, setResolved] = useState<Record<string, string>>({})

  if (!items) return <Loading title="REVIEW QUEUE" />

  function resolve(id: string, choice: string) {
    setResolved((r) => ({ ...r, [id]: choice })) // optimistic
    resolveMutation.mutate({ id, choice })
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

      <div className="rv-list">
        {items.map((it) => {
          const done = resolved[it.id]
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
      </div>
    </div>
  )
}
