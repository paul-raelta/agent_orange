/* Agent Orange — theme provider (§11). Holds the current Tweaks, applies them to
   :root whenever they change, and persists them. Exposes a setter via context so
   the in-app Tweaks panel (an optional theme switcher) can drive it. */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { applyTweaks, loadTweaks, saveTweaks, type Tweaks } from './tweaks'

type Ctx = {
  tweaks: Tweaks
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void
}

const ThemeContext = createContext<Ctx | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tweaks, setTweaks] = useState<Tweaks>(() => loadTweaks())

  useEffect(() => {
    applyTweaks(tweaks)
    saveTweaks(tweaks)
  }, [tweaks])

  const value = useMemo<Ctx>(
    () => ({
      tweaks,
      setTweak: (key, val) => setTweaks((prev) => ({ ...prev, [key]: val })),
    }),
    [tweaks],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
