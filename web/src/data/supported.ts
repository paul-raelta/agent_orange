// Tickers with known-working extraction, validation, and confidence outcomes.
// Watchlist cards for tickers OUTSIDE this set show a "not yet supported"
// notice in place of the metrics grid; the Add Companies page pins this set
// in a top-of-page "Recommended" section.
export const SUPPORTED_TICKERS = new Set<string>([
  'NVDA',
  'SNDK',
  'MU',
  'COST',
  'DIS',
  'SNOW',
]);

export function isSupported(ticker: string): boolean {
  return SUPPORTED_TICKERS.has(ticker.toUpperCase());
}
