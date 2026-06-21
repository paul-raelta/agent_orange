/* Map a current pathname to the human screen label the Help Assistant should
   pass as `screen` so the model knows where the user is. Kept tiny on purpose
   — adding a route here is a one-line edit. */
export function screenLabelForPath(pathname: string): string {
  const p = pathname.toLowerCase()
  if (p === '/' || p === '') return 'Watchlist'
  if (p.startsWith('/timeline')) return 'Timeline'
  if (p.startsWith('/review')) return 'Review queue'
  if (p.startsWith('/companies')) return 'Companies'
  if (p.startsWith('/activity')) return 'Activity log'
  if (p.startsWith('/settings')) return 'Settings'
  if (p.startsWith('/company/')) return 'Company deep-dive'
  if (p.startsWith('/help')) return 'Help'
  return 'Watchlist'
}
