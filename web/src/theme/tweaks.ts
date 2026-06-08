/* Agent Orange — theming knobs (§11). The whole design is token-driven, so a
   "tweak" is just a small set of CSS-variable overrides / root classes. The
   provider persists the chosen tweaks and applies them to :root. */

export type Tweaks = {
  accent: string
  bg: 'carbon' | 'slate' | 'black'
  font: 'plex' | 'jetbrains' | 'space'
  density: 'cozy' | 'compact'
  sparklines: boolean
}

export const TWEAK_DEFAULTS: Tweaks = {
  accent: '#e8723a',
  bg: 'carbon',
  font: 'plex',
  density: 'cozy',
  sparklines: true,
}

export const ACCENTS = ['#e8723a', '#46b1c9', '#d7a13b', '#9a86f0']

export const BG_PRESETS: Record<Tweaks['bg'], Record<string, string>> = {
  carbon: { '--bg': '#07090c', '--panel': '#0d1117', '--panel-2': '#11161d', '--raised': '#161d27', '--line': '#222b37', '--line-soft': '#1a212b' },
  slate: { '--bg': '#0b0f15', '--panel': '#121822', '--panel-2': '#18202c', '--raised': '#1f2836', '--line': '#2b3645', '--line-soft': '#202836' },
  black: { '--bg': '#000000', '--panel': '#0a0a0c', '--panel-2': '#101013', '--raised': '#16161a', '--line': '#232327', '--line-soft': '#1a1a1e' },
}

export const FONT_PRESETS: Record<Tweaks['font'], string> = {
  plex: "'IBM Plex Mono',ui-monospace,monospace",
  jetbrains: "'JetBrains Mono',ui-monospace,monospace",
  space: "'Space Mono',ui-monospace,monospace",
}

export function applyTweaks(t: Tweaks) {
  const root = document.documentElement
  // accent + derived tints (color-mix keeps soft/line in lockstep)
  root.style.setProperty('--accent', t.accent)
  root.style.setProperty('--accent-soft', `color-mix(in srgb, ${t.accent} 14%, transparent)`)
  root.style.setProperty('--accent-line', `color-mix(in srgb, ${t.accent} 42%, transparent)`)
  // background tone
  const bg = BG_PRESETS[t.bg] || BG_PRESETS.carbon
  Object.entries(bg).forEach(([k, v]) => root.style.setProperty(k, v))
  // mono font
  root.style.setProperty('--mono', FONT_PRESETS[t.font] || FONT_PRESETS.plex)
  // density + sparklines as classes
  root.classList.toggle('compact', t.density === 'compact')
  root.classList.toggle('no-spark', !t.sparklines)
}

const STORAGE_KEY = 'ao-tweaks'

export function loadTweaks(): Tweaks {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...TWEAK_DEFAULTS, ...(JSON.parse(raw) as Partial<Tweaks>) }
  } catch {
    /* ignore */
  }
  return TWEAK_DEFAULTS
}

export function saveTweaks(t: Tweaks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
  } catch {
    /* ignore */
  }
}
