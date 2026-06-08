/* Agent Orange — in-app Tweaks panel (§11). An optional theme switcher that maps
   1:1 to the prototype's Tweaks knobs: accent, surface, mono type, density,
   sparklines. Built from the app's own design system so it stays on-brand. */
import { useState } from 'react'
import { useTheme } from './ThemeProvider'
import { ACCENTS, type Tweaks } from './tweaks'

function Radio<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TweaksPanel() {
  const { tweaks, setTweak } = useTheme()
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button className="tweaks-fab" title="Tweaks — theme" onClick={() => setOpen(true)}>
        ⚙
      </button>
    )
  }

  return (
    <aside
      className="panel"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        width: 260,
        zIndex: 2147483646,
        marginBottom: 0,
        boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      }}
    >
      <header className="panel-hd">
        <span className="panel-title">TWEAKS</span>
        <button className="x-btn" onClick={() => setOpen(false)}>
          ✕
        </button>
      </header>
      <div className="panel-bd" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span className="lbl">Accent</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {ACCENTS.map((c) => (
              <button
                key={c}
                onClick={() => setTweak('accent', c)}
                title={c}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: c,
                  border:
                    tweaks.accent === c
                      ? '2px solid var(--text)'
                      : '1px solid var(--line)',
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span className="lbl">Surface</span>
          <Radio<Tweaks['bg']>
            value={tweaks.bg}
            onChange={(v) => setTweak('bg', v)}
            options={[
              { value: 'carbon', label: 'CARBON' },
              { value: 'slate', label: 'SLATE' },
              { value: 'black', label: 'BLACK' },
            ]}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span className="lbl">Mono type</span>
          <Radio<Tweaks['font']>
            value={tweaks.font}
            onChange={(v) => setTweak('font', v)}
            options={[
              { value: 'plex', label: 'PLEX' },
              { value: 'jetbrains', label: 'JETBRAINS' },
              { value: 'space', label: 'SPACE' },
            ]}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span className="lbl">Density</span>
          <Radio<Tweaks['density']>
            value={tweaks.density}
            onChange={(v) => setTweak('density', v)}
            options={[
              { value: 'cozy', label: 'COZY' },
              { value: 'compact', label: 'COMPACT' },
            ]}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span className="lbl">Card sparklines</span>
          <button
            className={'tag' + (tweaks.sparklines ? ' on' : '')}
            onClick={() => setTweak('sparklines', !tweaks.sparklines)}
          >
            {tweaks.sparklines ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </aside>
  )
}
