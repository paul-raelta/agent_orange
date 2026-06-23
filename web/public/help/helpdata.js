/* Agent Orange — Help page content. Each section is data-driven: an annotated
   figure (screenshot + numbered pins) with a matching callout list and a short
   "how to use it". Pin x/y are percentages of the image box. Rendered by Help.html. */
window.HELP_SECTIONS = [

/* ───────────────────────── 1 · WATCHLIST ───────────────────────── */
{
  id: 'watchlist', num: '01', title: 'Watchlist', tagline: 'Your home base',
  intro: `The Watchlist is the first thing you see — an at-a-glance board of every company you track.
    Each company has its own <b>agent</b>, and its card summarises the latest reported results, live price,
    and where things stand: <span class="t-green">validated</span>, <span class="t-blue">needs review</span>,
    or <span class="t-amber">watching</span> for an upcoming filing.`,
  img: 'img/watchlist.jpg', frame: 'WATCHLIST',
  pins: [
    { n: 1, x: 8,  y: 13.5 },
    { n: 2, x: 30, y: 12 },
    { n: 3, x: 92, y: 11 },
    { n: 4, x: 21, y: 18.5 },
    { n: 5, x: 39, y: 18.5 },
    { n: 6, x: 33, y: 25 },
    { n: 7, x: 30, y: 38 },
    { n: 8, x: 30, y: 45 },
    { n: 9, x: 8,  y: 94 },
  ],
  callouts: [
    { n: 1, title: 'Sidebar navigation', text: 'Jump between the in-app views — Watchlist, Timeline, Review, Companies, Activity, Settings — plus <b>Help</b> and <b>Roadmap</b> (future features under discussion) at the bottom. The <b>Review</b> item shows a live blue badge when findings need your decision.' },
    { n: 2, title: 'Status summary', text: 'One line telling you how many agents are running, watching, awaiting review, and validated.' },
    { n: 3, title: 'Run all agents', text: 'Kicks off every agent at once and opens the Document Examiner (see §9). Use it to force a fresh check.' },
    { n: 4, title: 'Company card', text: 'One per tracked company. The coloured bar on its left edge encodes status at a glance.' },
    { n: 5, title: 'Status chip', text: 'validated (green) · needs review (blue) · watching (amber, pulsing) · error (red).' },
    { n: 6, title: 'Price & EPS sparkline', text: 'Live price, day change (▲/▼), and a small sparkline of the EPS trend across recent quarters.' },
    { n: 7, title: 'Metric grid', text: 'The headline figures — revenue, net income, EPS — each with its year-over-year delta and a confidence badge.' },
    { n: 8, title: 'Card footer', text: 'Changes with status: a review call-to-action, the next predicted filing window, or “✓ corroborated · validated”.' },
    { n: 9, title: 'Usage meter', text: 'The active model and your month-to-date spend against budget, always visible.' },
  ],
  howto: [
    'Scan the status chips to see what needs attention.',
    'Click any card to open that company’s deep-dive.',
    'Press <b>Run all agents</b> to check every company for new filings now.',
    'Hover any number, chip or column header — the app explains what each one means inline (native browser tooltips).',
  ],
},

/* ───────────────────── 2 · COMPANY DEEP-DIVE ───────────────────── */
{
  id: 'company', num: '02', title: 'Company deep-dive', tagline: 'Everything about one company',
  intro: `Clicking a card opens the deep-dive: the full reporting history, where the agent looks for results,
    and — most importantly — how each figure was <b>validated</b>. Two tabs do the heavy lifting:
    <b>Results</b> (the numbers across recent periods) and <b>Validation</b> (whether each one checks out).`,
  img: 'img/company.jpg', frame: 'COMPANY · RESULTS',
  pins: [
    { n: 1, x: 21, y: 9 },
    { n: 2, x: 25, y: 12.5 },
    { n: 3, x: 32, y: 19 },
    { n: 4, x: 29, y: 23.5 },
    { n: 5, x: 45, y: 30 },
    { n: 6, x: 45, y: 34 },
    { n: 7, x: 45, y: 62 },
    { n: 8, x: 37, y: 66.5 },
  ],
  callouts: [
    { n: 1, title: 'Back link', text: 'Returns you to wherever you came from (Watchlist, Timeline, Review…).' },
    { n: 2, title: 'Company header', text: 'Ticker, sector, reporting cadence, live price, and the current status chip.' },
    { n: 3, title: 'Sources', text: 'Where this agent looks: the company IR site (marked <b>primary</b>) and SEC EDGAR with its CIK. The mode (auto / guided / advanced) is shown at the right.' },
    { n: 4, title: 'Tabs', text: 'Results · Validation · Agent runs — plus News, Insider, and (when Labs is on) Guidance in the live app.' },
    { n: 5, title: 'Latest period', text: 'The most recent quarter is highlighted with a faint orange tint so it stands out from history.' },
    { n: 6, title: 'Results table', text: 'Revenue, net income, EPS (basic & diluted), and margin across the last five periods.' },
    { n: 7, title: 'Confidence row', text: 'A confidence badge per period. Click the latest one to open the Provenance drawer (§3).' },
    { n: 8, title: 'Inline hint', text: 'The app tells you the confidence badge is clickable — that’s your gateway to the sources.' },
  ],
  howto: [
    'Read across a row to see a metric’s trend over five periods.',
    'Switch to the <b>Validation</b> tab to see whether each figure was corroborated.',
    'Click a confidence badge to trace any number back to its source.',
    'Scroll down to <b>Data sources · per-company</b> to override the global source toggles for this ticker, or paste an <b>IR URL</b> the agent should use as primary.',
    'Use <b>ARCHIVE</b> in the header to take a company off the watchlist without losing its data — restore from <b>Companies</b> later, or permanently delete from there.',
  ],
  note: `Archived companies stop being polled by the schedulers (prices, news, insider, filings) but their history is preserved
    until you permanently delete them from <b>Companies → Archived</b>. NVDA is the demo anchor and can be archived but never
    hard-deleted.`,
},

/* ───────────────── 3 · VALIDATION & PROVENANCE ───────────────── */
{
  id: 'validation', num: '03', title: 'Validation & provenance', tagline: 'Why you can trust the numbers',
  intro: `This is the heart of Agent Orange. The agent never just reports a number — it <b>cross-references</b>
    each figure in more than one place. Agreement raises confidence; a conflict drops it and routes the finding
    to Review. The <b>Validation</b> tab summarises the verdict; the <b>Provenance drawer</b> shows the literal evidence.`,
  img: 'img/validation.jpg', frame: 'COMPANY · VALIDATION',
  pins: [
    { n: 1, x: 26, y: 30 },
    { n: 2, x: 24, y: 38.5 },
    { n: 3, x: 25, y: 43 },
    { n: 4, x: 47, y: 49.5 },
    { n: 5, x: 64, y: 49.5 },
    { n: 6, x: 88, y: 49.5 },
  ],
  callouts: [
    { n: 1, title: 'Pass / fail card', text: 'Green <b>PASSED</b> (or amber needs-review) for the latest period, with the validation rule applied.' },
    { n: 2, title: 'The rule', text: 'e.g. “cross-reference EPS in ≥ 2 locations”. Configurable per company in Settings.' },
    { n: 3, title: 'Corroboration count', text: 'How many independent places agreed on the figure — more sources, more trust.' },
    { n: 4, title: 'Metric value', text: 'Each tracked metric with its value and year-over-year change.' },
    { n: 5, title: 'Confidence bar', text: 'high (green) · med (amber) · low (red), shown as a 3-bar glyph.' },
    { n: 6, title: 'Sources link', text: '“N sources ›” — click any row to open the Provenance drawer for that figure.' },
  ],
  howto: [
    'Check the pass/fail card first for the period’s overall verdict.',
    'Scan the confidence bars to spot any weak (amber/red) figures.',
    'Click a metric row to see exactly where each number came from.',
  ],
  // second figure: the provenance drawer
  extra: {
    img: 'img/provenance.jpg', frame: 'PROVENANCE DRAWER', caption: 'The Provenance drawer — opened from any confidence badge or metric row.',
    pins: [
      { n: 1, x: 68, y: 3.5 },
      { n: 2, x: 66, y: 11 },
      { n: 3, x: 80, y: 16 },
      { n: 4, x: 82, y: 24.5 },
      { n: 5, x: 96, y: 22.5 },
      { n: 6, x: 82, y: 51 },
    ],
    callouts: [
      { n: 1, title: 'Which figure', text: 'The drawer header names the exact metric you’re inspecting. Click ✕ or press Esc to close.' },
      { n: 2, title: 'Value · confidence · YoY', text: 'The number itself, its confidence level, and the year-over-year change.' },
      { n: 3, title: 'How it works', text: 'A one-line reminder: every figure links to the exact place it was read; agreeing sources raise confidence.' },
      { n: 4, title: 'Source block', text: 'One per source — document title, <span class="t-amber">page number</span>, <span class="t-blue">URL</span>, and the exact quoted snippet.' },
      { n: 5, title: 'Page reference', text: 'The precise page the figure was found on, so you can verify it yourself.' },
      { n: 6, title: 'Cross-source agreement', text: 'Here EPS $2.39 appears in the income statement, a footnote, and the press release — three agreeing sources = HIGH confidence.' },
    ],
    howto: [
      'Open it from any confidence badge or “N sources ›” row.',
      'Read each snippet to see the figure in its original context.',
      'Follow a URL to the source document if you want to double-check.',
    ],
  },
},

/* ───────────────────────── 4 · TIMELINE ───────────────────────── */
{
  id: 'timeline', num: '04', title: 'Filing timeline', tagline: 'When results are expected',
  intro: `Earnings don’t arrive on a fixed date — a quarter ending in June might be reported any time from
    late July to late September. The Timeline plots each company’s <b>predicted filing window</b> from its
    historical cadence, and shows when an agent has started actively <b>watching</b>.`,
  img: 'img/timeline.jpg', frame: 'TIMELINE',
  pins: [
    { n: 1, x: 63, y: 19.5 },
    { n: 2, x: 59, y: 20 },
    { n: 3, x: 21, y: 23 },
    { n: 4, x: 40, y: 23.5 },
    { n: 5, x: 67, y: 23.5 },
    { n: 6, x: 72, y: 31 },
    { n: 7, x: 24, y: 36.5 },
  ],
  callouts: [
    { n: 1, title: 'Month track', text: 'A calendar runs left-to-right across the top so you can read timing at a glance.' },
    { n: 2, title: '“NOW” marker', text: 'A dashed line marks today, so you can see what’s behind and ahead.' },
    { n: 3, title: 'Company lane', text: 'One row per company — glyph + ticker on the left, its events on the track.' },
    { n: 4, title: 'Reported marker', text: 'A green dot = a result already reported and recorded, with its period and date.' },
    { n: 5, title: 'Predicted window', text: 'An orange bar = the range the next filing is expected in, derived from past cadence.' },
    { n: 6, title: 'Watching now', text: 'An amber (pulsing) bar = an agent is actively polling for this filing right now.' },
    { n: 7, title: 'Legend', text: 'Reminds you what each colour means.' },
  ],
  howto: [
    'Scan for amber bars — those agents are watching for an imminent filing.',
    'Use the predicted windows to anticipate when to expect numbers.',
    'Click a lane to jump straight to that company.',
  ],
},

/* ───────────────────────── 5 · REVIEW ───────────────────────── */
{
  id: 'review', num: '05', title: 'Review queue', tagline: 'You make the call',
  intro: `When the agent can’t confidently validate a figure — two sources disagree, or a number appears in only
    one place — it doesn’t guess. It routes the finding here for a <b>human decision</b>. The classic case:
    a press-release headline EPS that differs from the figure in the official 8-K schedule.`,
  img: 'img/review.jpg', frame: 'REVIEW QUEUE',
  pins: [
    { n: 1, x: 22, y: 18 },
    { n: 2, x: 42, y: 18.5 },
    { n: 3, x: 33, y: 21.5 },
    { n: 4, x: 24, y: 27 },
    { n: 5, x: 62, y: 27 },
    { n: 6, x: 35, y: 42 },
    { n: 7, x: 24, y: 48 },
  ],
  callouts: [
    { n: 1, title: 'Company & period', text: 'Which company and reporting period the disputed figure belongs to.' },
    { n: 2, title: 'Confidence flag', text: 'The (low/med) confidence that triggered the review.' },
    { n: 3, title: 'Reason', text: 'A plain-language explanation — e.g. “EPS conflict across sources”.' },
    { n: 4, title: 'Candidate value A', text: 'One possible value with its source and a note on how it was derived (e.g. GAAP headline).' },
    { n: 5, title: 'Candidate value B', text: 'The competing value with its own source — the chosen one highlights green.' },
    { n: 6, title: 'Provenance snippet', text: 'The exact quoted text behind the conflict, so you can judge for yourself.' },
    { n: 7, title: 'Decision buttons', text: 'Pick the correct value or reject the finding. Your choice is recorded and the card clears.' },
  ],
  howto: [
    'Read the reason and compare the candidate values.',
    'Check the provenance snippet to understand the discrepancy.',
    'Click “USE …” to record the right figure, or “REJECT” to discard it.',
  ],
},

/* ───────────────── 6 · COMPANIES & ADD FLOW ───────────────── */
{
  id: 'companies', num: '06', title: 'Adding companies', tagline: 'Build your watchlist',
  intro: `The <b>Companies</b> view lists everything you track and lets you add more. “Add companies” opens a
    browse-and-batch flow over the <b>S&P 500</b>: pick as many as you like, then the agents discover each
    one’s filing sources in a single batch before you start watching.`,
  img: 'img/addcompanies.jpg', frame: 'ADD COMPANIES',
  pins: [
    { n: 1, x: 33, y: 21 },
    { n: 2, x: 78, y: 21 },
    { n: 3, x: 92, y: 21 },
    { n: 4, x: 30, y: 27.5 },
    { n: 5, x: 9,  y: 43 },
    { n: 6, x: 90, y: 43 },
    { n: 7, x: 12, y: 51.5 },
    { n: 8, x: 55, y: 53.5 },
    { n: 9, x: 20, y: 51.5 },
  ],
  callouts: [
    { n: 1, title: 'Search', text: 'Filter the 500 companies instantly by ticker or name.' },
    { n: 2, title: 'Sort', text: 'Order by market cap, A–Z, or soonest upcoming earnings.' },
    { n: 3, title: 'Grid / Table toggle', text: 'Switch between roomy cards and a dense, sortable table — same selection either way.' },
    { n: 4, title: 'Sector filters', text: 'Narrow to a GICS sector (Information Technology, Health Care, …) with one click.' },
    { n: 5, title: 'Sector group', text: 'Companies are grouped by sector, each with a count and a collapse control.' },
    { n: 6, title: 'Select all', text: 'Add an entire sector’s companies at once.' },
    { n: 7, title: 'Company card', text: 'Monogram, ticker, name, live price, market cap, and next-earnings date.' },
    { n: 8, title: 'Selection checkbox', text: 'Click a card to select it; a running tray (not shown) tracks your picks and the ADD button.' },
    { n: 9, title: 'Already tracking', text: 'Companies already on your watchlist are marked and can’t be added twice. Archived rows count too — restore from the ARCHIVED panel rather than re-adding.' },
  ],
  howto: [
    'Search or filter to find companies, then click to select them.',
    'Use “Select all” to grab a whole sector at once.',
    'Press <b>Add</b> — the agents discover each company’s sources, then you confirm to start watching.',
    'Toggle <b>ARCHIVED (N)</b> in the Companies header to see archived rows — RESTORE brings them back, PERMANENTLY DELETE wipes their history (double-confirm).',
    'With <b>Demo mode</b> on, rows with cached extractions show a <b>DEMO READY</b> chip — adding one and running pipelines costs $0.',
  ],
  note: `The demo anchor ticker (NVDA) is always present after a wipe. You can archive it but the PERMANENTLY DELETE
    button is hidden — the app always boots with at least one ticker to demo against.`,
},

/* ───────────────────────── 7 · ACTIVITY ───────────────────────── */
{
  id: 'activity', num: '07', title: 'Activity log', tagline: 'Show the work',
  intro: `Everything the agents do is logged here — transparent and auditable. Every poll, fetch, extraction,
    and validation appears as a line, with the tokens and cost it consumed. It’s how you confirm real work is
    happening behind the scenes.`,
  img: 'img/activity.jpg', frame: 'ACTIVITY LOG',
  pins: [
    { n: 1, x: 21, y: 16.5 },
    { n: 2, x: 24, y: 22.5 },
    { n: 3, x: 31, y: 22.5 },
    { n: 4, x: 52, y: 22.5 },
    { n: 5, x: 94, y: 22.5 },
  ],
  callouts: [
    { n: 1, title: 'Filter bar', text: 'Show all activity, or narrow to a single company’s agent.' },
    { n: 2, title: 'Timestamp', text: 'When each action happened, newest first.' },
    { n: 3, title: 'Agent', text: 'Which company’s agent did it — colour-coded by status level.' },
    { n: 4, title: 'Message', text: 'A plain-language description: filing detected, parsed, validated, conflict routed, etc.' },
    { n: 5, title: 'Tokens · cost', text: 'The compute each step used, so spend is always traceable.' },
  ],
  howto: [
    'Filter to one ticker to follow a single company’s agent.',
    'Read top-down to reconstruct exactly what happened and when.',
    'Use the cost column to see where compute is being spent.',
  ],
},

/* ───────────────────────── 8 · SETTINGS ───────────────────────── */
{
  id: 'settings', num: '08', title: 'Settings', tagline: 'Budgets, models & schedules',
  intro: `Settings is where you control cost and behaviour. Agent Orange is <b>provider-agnostic</b> — the model
    used for each task is configuration, not something baked in — so you can route cheap models to cheap work
    and reserve the strongest models for extraction and validation.`,
  img: 'img/settings.jpg', frame: 'SETTINGS',
  pins: [
    { n: 1, x: 27, y: 26 },
    { n: 2, x: 75, y: 30 },
    { n: 3, x: 50, y: 38.5 },
    { n: 4, x: 32, y: 55 },
    { n: 5, x: 70, y: 55 },
    { n: 6, x: 25, y: 78 },
    { n: 7, x: 90, y: 79 },
  ],
  callouts: [
    { n: 1, title: 'Usage this month', text: 'Spend versus budget, with tokens and run counts — your cost dashboard.' },
    { n: 2, title: 'Budget bar', text: 'A visual gauge so you never blow past your monthly cap unnoticed.' },
    { n: 3, title: 'Per-model breakdown', text: 'How much each model cost and which tasks it handled.' },
    { n: 4, title: 'Providers', text: 'Anthropic Claude (active) plus planned OpenAI & Google Gemini — the provider-agnostic seam.' },
    { n: 5, title: 'Planned providers', text: 'Add an API key to enable others later; the UI never hardcodes one vendor.' },
    { n: 6, title: 'Model routing', text: 'Assign a model per task: discovery, monitoring, extraction, validation.' },
    { n: 7, title: 'Segmented control', text: 'Pick Haiku / Sonnet / Opus per task — cheap for polling, strong where accuracy matters.' },
  ],
  howto: [
    'Set your monthly budget and watch the usage bar.',
    'Route inexpensive models to discovery & monitoring.',
    'Reserve the strongest model for extraction & validation.',
    'Toggle <b>Demo mode</b> to replay cached extractions ($0 / run) — pipelines skip Anthropic and re-use fixtures saved on the last real run.',
    'Toggle data sources on/off, add a custom HTTPS feed (SSRF-guarded), or suggest one — under <b>Data sources</b>.',
    'Tune <b>Validation thresholds</b> (EPS, margin %, revenue %) — figures outside the band route to Review.',
  ],
  note: `The live app stacks more panels below: <b>Demo mode</b> (zero-cost replay), <b>Notifications</b>
    (email + SMS per-event opt-in), <b>Data sources</b> (built-ins + user-added feeds, with test/toggle/suggest),
    <b>Validation thresholds</b>, <b>Run-all feedback</b>, the <b>Labs feature flags</b> covered in §10, and a
    <b>First-time experience reset</b> that wipes every tracked company + their fetched data (NVDA remains as the
    demo anchor).`,
},

/* ──────────────── 9 · DOCUMENT EXAMINER (diagram) ──────────────── */
{
  id: 'examiner', num: '09', title: 'The Document Examiner', tagline: 'Watch the agents read', type: 'diagram',
  intro: `Pressing <b>Run all agents</b> opens the centrepiece: a full-screen sequence where the <b>document is
    the hero</b>. Rather than an abstract progress bar, you watch the agent actually read the filing — opening
    the paper, zooming to each figure, circling it, and pulling it into an evidence panel with its provenance.
    The hero ticker (NVDA by default) plays the full chapter; every other watchlisted ticker shows up on the
    <b>background tasks</b> rail beneath the brand line, with its real Finnhub quote / news / insider refresh
    ticking from <b>refreshing…</b> to <b>✓ done</b> while the document chapter plays out.`,
  pipeline: [
    { k: 'DISCOVER', d: 'Find the filing on SEC EDGAR + the IR site.' },
    { k: 'FETCH', d: 'Open it as real “paper” — 10-Q cover, income statement, press release.' },
    { k: 'EXAMINE', d: 'A lens zooms to each section; figures are circled on the page.' },
    { k: 'EXTRACT', d: 'Captured values fly into an Extracted Data panel with confidence.' },
    { k: 'VALIDATE', d: 'Agreement raises confidence; conflicts are flagged for review.' },
  ],
  anatomy: [
    { title: 'The document', text: 'An authentic-looking filing fills the screen; the agent’s reading happens directly on it — boxes, circles, underlines.' },
    { title: 'Extracted Data panel', text: 'Each figure the agent captures lands here with its source and confidence, building up as it reads.' },
    { title: 'Telemetry rail', text: 'Live counters — pages read, tables parsed, figures captured, sources cross-referenced, model spend — plus elapsed time and the pipeline stage.' },
    { title: 'Per-company progress', text: 'A rail shows which company is being examined and how many remain; it ends with an “Examination complete” summary.' },
    { title: 'Background tasks rail', text: 'Below the brand line — one pill per non-hero ticker (e.g. AAPL · quote · news · insider). Flips from <b>refreshing</b> to <b>✓ done</b> while the document examiner plays the lead chapter.' },
    { title: 'Minimise & keep working', text: 'Press ▾ to dock the run as a small live widget (bottom-right) and keep using the app; ⤢ expands back to the full view. The run continues in the background.' },
  ],
  howto: [
    'Press <b>Run all agents</b> on the Watchlist to start it.',
    'Watch each figure get circled and captured, or minimise and carry on.',
    'When it finishes, the Watchlist reflects the freshly synced results.',
  ],
},

/* ──────────────── 10 · LABS FEATURES + FLAGS ──────────────── */
{
  id: 'labs', num: '10', title: 'Labs features', tagline: 'Optional power tools',
  intro: `Three newer capabilities can be switched on (or off) individually from <b>Settings → Labs</b>. Each is
    fully self-contained — turning one off simply removes its surfaces, nothing else changes. The screenshot below
    shows all three live, with the flag panel on the right.`,
  img: 'img/features.jpg', frame: 'LABS FEATURES',
  pins: [
    { n: 1, x: 29, y: 17 },
    { n: 2, x: 41, y: 24.5 },
    { n: 3, x: 58, y: 42 },
    { n: 4, x: 17, y: 56.5 },
    { n: 5, x: 52, y: 31.5 },
    { n: 6, x: 85, y: 14 },
    { n: 7, x: 96, y: 14 },
  ],
  callouts: [
    { n: 1, title: 'Consensus — surprise chip', text: '<b>Consensus vs Actual.</b> Each metric shows the beat/miss versus the Wall Street estimate (e.g. “+4.4% vs est”).' },
    { n: 2, title: 'Beat/miss banner', text: 'On the deep-dive, a one-line verdict: did the company beat, miss, or meet expectations overall?' },
    { n: 3, title: '“vs est” column', text: 'The Results table gains Consensus and Surprise columns when this feature is on.' },
    { n: 4, title: 'Conflict workspace', text: '<b>Conflict-Resolution.</b> A side-by-side diff of disputed figures with a one-click decision rail — a richer Review experience.' },
    { n: 5, title: 'Guidance tab', text: '<b>Guidance Tracking.</b> A new tab showing forward outlook vs prior guidance (raised / cut / maintained), with provenance.' },
    { n: 6, title: 'Feature flag', text: 'Each capability has its own toggle. Off = its surfaces vanish; the rest of the app is untouched.' },
    { n: 7, title: 'Independent control', text: 'Flip any one without affecting the others — no restart, no migration.' },
  ],
  howto: [
    'Open <b>Settings → Labs</b> to see the three toggles.',
    'Turn on Consensus to see beat/miss everywhere prices appear.',
    'Turn on Conflict & Guidance for richer review and forward-looking data.',
  ],
},

/* ──────────────── 11 · PERSONALIZATION (TWEAKS) ──────────────── */
{
  id: 'tweaks', num: '11', title: 'Personalization', tagline: 'Make it yours',
  intro: `The <b>Tweaks</b> panel lets you adjust the look and feel without leaving the app. Everything applies
    live and is remembered — accent colour, surface darkness, typeface, density, and whether cards show sparklines.`,
  img: 'img/tweaks.jpg', frame: 'TWEAKS PANEL',
  pins: [
    { n: 1, x: 80, y: 56 },
    { n: 2, x: 88, y: 66.5 },
    { n: 3, x: 88, y: 74.5 },
    { n: 4, x: 88, y: 81 },
    { n: 5, x: 88, y: 91.5 },
    { n: 6, x: 97, y: 95.5 },
  ],
  callouts: [
    { n: 1, title: 'Accent colour', text: 'Four curated accents; the whole UI re-tints live.' },
    { n: 2, title: 'Surface', text: 'Carbon, Slate, or Black backgrounds for the darkness you prefer.' },
    { n: 3, title: 'Mono type', text: 'Switch the primary monospace face (Plex / JetBrains / Space).' },
    { n: 4, title: 'Density', text: 'Cozy or Compact spacing for more breathing room or more data per screen.' },
    { n: 5, title: 'Card sparklines', text: 'Toggle the little EPS trend charts on watchlist cards.' },
    { n: 6, title: 'Persisted', text: 'Your choices are saved and restored next time you open the app.' },
  ],
  howto: [
    'Open Tweaks from the toolbar.',
    'Adjust accent, surface, type, or density — changes apply instantly.',
    'Close it; your preferences are remembered.',
  ],
},

/* ──────────────── 12 · MOBILE / RESPONSIVE ──────────────── */
{
  id: 'mobile', num: '12', title: 'On mobile', tagline: 'The full app, smaller',
  intro: `Agent Orange is fully responsive. Below a narrow width the sidebar folds into a bottom tab bar and the
    card grid stacks to a single column — every feature stays available, just reflowed for a phone.`,
  img: 'img/mobile.jpg', frame: 'MOBILE · WATCHLIST', contain: true,
  pins: [
    { n: 1, x: 50, y: 24 },
    { n: 2, x: 50, y: 38 },
    { n: 3, x: 41, y: 94 },
    { n: 4, x: 50, y: 88 },
  ],
  callouts: [
    { n: 1, title: 'Run all agents', text: 'The primary action stays front-and-centre at the top.' },
    { n: 2, title: 'Stacked cards', text: 'The same company cards, one per row, with full metrics and status.' },
    { n: 3, title: 'Bottom tab bar', text: 'The sidebar becomes thumb-friendly bottom tabs — all seven views.' },
    { n: 4, title: 'Review badge', text: 'The live review count follows you onto the tab bar.' },
  ],
  howto: [
    'Tap the bottom tabs to move between views.',
    'Scroll the stacked cards; tap one for its deep-dive.',
    'Everything from desktop is here — provenance drawer, review, settings.',
  ],
},

]
