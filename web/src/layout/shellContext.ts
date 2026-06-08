/* Context the AppShell layout route passes to its child screens via <Outlet>.
   Holds the "run all agents" job state, last-sync, and the user-pickable
   feedback style — which lives at shell level so Settings can both read and
   update it without prop drilling. */
import { useOutletContext } from 'react-router-dom'

export type RunFeedback = 'toast' | 'button' | 'both'

export type ShellContext = {
  running: boolean
  lastSync: string
  runAll: () => void
  runFeedback: RunFeedback
  setRunFeedback: (v: RunFeedback) => void
}

export const useShell = () => useOutletContext<ShellContext>()
