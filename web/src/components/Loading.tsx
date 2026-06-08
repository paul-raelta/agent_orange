/* Minimal loading state for a screen while its query resolves. */
export function Loading({ title }: { title: string }) {
  return (
    <div className="screen">
      <div className="screen-hd">
        <div>
          <h1 className="screen-title">{title}</h1>
          <p className="screen-sub">Loading…</p>
        </div>
      </div>
    </div>
  )
}
