/* Context the AppShell layout route passes to its child screens via <Outlet>.
   Holds the "run all agents" job state + last-sync, which live at shell level so
   they persist across navigation (like the prototype's App-level state). */
import { useOutletContext } from 'react-router-dom'

export type ShellContext = {
  running: boolean
  lastSync: string
  runAll: () => void
}

export const useShell = () => useOutletContext<ShellContext>()
