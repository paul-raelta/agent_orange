/* Agent Orange — route table (§4). The prototype's route ids map 1:1, plus the
   company/:ticker deep-dive. The AppShell is the layout route. */
import { Route, Routes } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { useLiveUpdates } from './live'
import { Activity } from './screens/Activity'
import { Companies } from './screens/Companies'
import { Company } from './screens/Company'
import { Review } from './screens/Review'
import { Settings } from './screens/Settings'
import { Timeline } from './screens/Timeline'
import { Watchlist } from './screens/Watchlist'

export default function App() {
  // One SSE subscription for the whole app, mounted once.
  useLiveUpdates()
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Watchlist />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="review" element={<Review />} />
        <Route path="companies" element={<Companies />} />
        <Route path="activity" element={<Activity />} />
        <Route path="settings" element={<Settings />} />
        <Route path="company/:ticker" element={<Company />} />
        <Route path="*" element={<Watchlist />} />
      </Route>
    </Routes>
  )
}
