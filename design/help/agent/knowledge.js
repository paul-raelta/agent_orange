/* Agent Orange — Help Agent knowledge base (the grounding corpus).
   The ENTIRE corpus is injected into the system prompt on every question, so the
   agent answers only from verified site knowledge and never invents features.
   Structured for maintainability; AO_KB_TEXT is the serialized form sent to the LLM.
   Keep entries factual, task-oriented, and in Agent Orange's own vocabulary. */
window.AO_KB = {

  product: {
    name: 'Agent Orange',
    oneLiner: 'Autonomous earnings intelligence — an AI agent watches each company you track, reads its earnings filings the moment they drop, extracts the figures that move trades, and validates every number against a second source before showing it to you.',
    who: 'Built for investors who trade around earnings and need trustworthy numbers fast, with receipts.',
    loop: [
      'LOCATE — each company gets its own agent that knows where its results live: the company investor-relations (IR) site, with SEC EDGAR as the structured backbone.',
      'MONITOR — earnings dates are unpredictable, so the agent polls on a cadence that intensifies inside the predicted filing window.',
      'EXTRACT — it pulls the figures that drive trades: revenue, net income, EPS (basic & diluted), gross margin, and guidance.',
      'VALIDATE — it cross-references each figure in two or more places; agreement earns a confidence level, a conflict is flagged.',
      'SURFACE — every number is shown with full provenance (source, page, exact quote); anything it can\u2019t confidently validate is routed to you in the Review queue.',
    ],
    principle: 'Trust through provenance: the agent never just asserts a number — every figure links back to the exact place it was read, and confidence is earned by corroboration. When sources disagree, a human decides; the agent never guesses.',
  },

  glossary: [
    ['Agent', 'The per-company worker that locates, monitors, extracts, validates, and reports that company\u2019s results. One agent per tracked company.'],
    ['Watchlist', 'Your home screen — a board of every company you track, each as a card with its latest results and status.'],
    ['Status', 'A company\u2019s current state: VALIDATED (green) = latest results checked out; NEEDS REVIEW (blue) = a figure needs your decision; WATCHING (amber, pulsing) = no new filing yet, agent is polling; ERROR (red) = something went wrong fetching.'],
    ['Confidence', 'How sure the agent is about a figure: HIGH (green) = corroborated in multiple sources; MED (amber) = limited corroboration; LOW (red) = single source or conflicting. Shown as a 3-bar badge.'],
    ['Provenance', 'The evidence trail behind a number: the source document, the page, and the exact quoted snippet it was read from. Opened via the Provenance drawer.'],
    ['Corroboration', 'Finding the same figure in more than one place (e.g. the income statement and a footnote and the press release). More corroboration = higher confidence.'],
    ['Validation', 'The check that cross-references each figure against the rule (default: "cross-reference EPS in \u22652 locations"). Pass = recorded; fail/conflict = routed to Review.'],
    ['Cadence', 'How often a company reports — Quarterly or Semi-annual. Used to predict the next filing window.'],
    ['Filing window', 'The predicted date range the next results will appear in, derived from the company\u2019s historical reporting cadence. Shown on the Timeline as an orange bar.'],
    ['SEC EDGAR', 'The U.S. SEC\u2019s public filings database. Agent Orange uses it as the structured, reliable backbone for each company (8-K, 10-Q, 10-K).'],
    ['CIK', 'Central Index Key — the unique per-company ID on SEC EDGAR that the agent pins so it always finds the right filings.'],
    ['IR site', 'A company\u2019s Investor Relations website, where it posts press releases and results. Often the fastest source; marked as the PRIMARY source for many companies.'],
    ['Source mode', 'How sources were set for a company: AUTO (agent discovered them), GUIDED, or ADVANCED (you pinned specifics).'],
    ['Position / Portfolio', 'Your holding in a company — shares + cost basis. Drives the live P&L (value and unrealized gain/loss) shown on the card and deep-dive.'],
    ['Narrative', 'An AI "what\u2019s worth knowing" summary on the deep-dive, written once results validate.'],
    ['Document Examiner', 'The full-screen sequence that plays when you Run all agents — you watch each agent actually read the filing, circle figures, and capture them with provenance.'],
    ['Consensus / Beat-miss', 'A Labs feature: compares each reported figure to the Wall Street estimate, showing the surprise (beat / miss / in line).'],
    ['Guidance', 'A Labs feature: the company\u2019s forward outlook (e.g. next-quarter revenue range), tracked vs prior guidance (raised / cut / maintained).'],
    ['Conflict workspace', 'A Labs feature: a side-by-side diff of a disputed figure\u2019s two sources, with a one-click decision rail — a richer way to clear Review items.'],
    ['Model routing', 'Settings control assigning a model (Haiku / Sonnet / Opus) to each task (discovery, monitoring, extraction, validation) — cheap models for cheap work, strong models where accuracy counts.'],
    ['Provider-agnostic', 'The agent layer isn\u2019t locked to one AI vendor. Anthropic Claude is active; OpenAI and Google are planned behind the same interface.'],
    ['Tokens / cost / budget', 'Each agent action consumes model tokens that cost money; Settings shows month-to-date spend against a budget you set.'],
  ],

  screens: [
    { name: 'Watchlist', route: 'the home screen', purpose: 'At-a-glance status of every company you track.',
      parts: ['Status summary line (how many watching / need review / validated)', 'RUN ALL AGENTS button (top right)', 'A portfolio P&L strip if you hold positions', 'A company card per company: status bar + chip, live price + EPS sparkline, latest period, a 3-metric grid with YoY and confidence, and a status-specific footer'],
      actions: ['Click a card to open its deep-dive', 'Press RUN ALL AGENTS to check everything now', 'Read the left color bar / status chip to triage'] },
    { name: 'Company deep-dive', route: 'opens when you click a card', purpose: 'Everything about one company: history, sources, and how each figure was validated.',
      parts: ['Header: ticker, sector, cadence, price, status', 'SOURCES row: IR site (primary) + SEC EDGAR CIK, and the source mode', 'AI narrative card ("what\u2019s worth knowing")', 'Editable position (shares + cost basis \u2192 live P&L)', 'Tabs: RESULTS, VALIDATION, NEWS, INSIDER, AGENT RUNS', 'RESULTS: last-5-periods table, latest column highlighted', 'VALIDATION: pass/fail card + per-metric confidence rows'],
      actions: ['Switch tabs to see results vs validation vs news', 'Click a confidence badge or metric row to open the Provenance drawer', 'Edit shares/cost basis to track your position'] },
    { name: 'Provenance drawer', route: 'slides in from the right when you click a confidence badge or metric row', purpose: 'Show exactly where a number came from.',
      parts: ['The figure + its confidence + YoY at the top', 'One block per source: document title, page number, URL, and the exact quoted snippet', 'Multiple agreeing sources = higher confidence'],
      actions: ['Read each snippet to see the number in context', 'Follow a URL to the original document', 'Press Esc or \u2715 to close'] },
    { name: 'Timeline', route: 'Timeline in the sidebar', purpose: 'See when results are expected for each company.',
      parts: ['A month track across the top with a "NOW" marker', 'One lane per company', 'Green dots = already reported & recorded', 'Orange bars = predicted filing window', 'Amber pulsing bars = an agent watching right now'],
      actions: ['Look for amber bars — those filings are imminent', 'Use predicted windows to anticipate results', 'Click a lane to jump to that company'] },
    { name: 'Review queue', route: 'Review in the sidebar (shows a badge count)', purpose: 'Decide on figures the agent could not confidently validate.',
      parts: ['One card per finding: company, period, the disputed metric, and the reason', 'Candidate values side by side, each with its source and a note', 'The exact provenance snippet behind the conflict', 'Decision buttons: USE <value> or REJECT'],
      actions: ['Read the reason and compare candidate values', 'Check the snippet to understand the discrepancy', 'Click USE to record the right value, or REJECT to discard'] },
    { name: 'Companies', route: 'Companies in the sidebar', purpose: 'Manage tracked companies and add new ones.',
      parts: ['A list of configured companies (sources, cadence, mode, status)', 'An ADD COMPANIES button opening the S&P 500 browse flow'],
      actions: ['Click ADD COMPANIES to browse and add', 'Click a row to open that company'] },
    { name: 'Add companies (browse flow)', route: 'from Companies \u2192 ADD COMPANIES', purpose: 'Add many companies at once from the S&P 500.',
      parts: ['Search (ticker or name) + sort (market cap / A\u2013Z / soonest earnings)', 'A Grid \u21c4 Table density toggle', 'Sector filters and sector groups, each with "Select all"', 'Company cards with price, market cap, next-earnings date', 'A selection tray with the ADD button'],
      actions: ['Search or filter, then click cards to select', 'Use Select all for a whole sector', 'Press ADD \u2014 agents discover each company\u2019s sources, then you confirm to start watching'] },
    { name: 'Activity log', route: 'Activity in the sidebar', purpose: 'A transparent, auditable feed of everything the agents did.',
      parts: ['A filter bar (all, or per company)', 'Rows: timestamp, agent, plain-language message, and tokens \u00b7 cost'],
      actions: ['Filter to one company to follow its agent', 'Read top-down to reconstruct what happened', 'Use the cost column to see where compute went'] },
    { name: 'Settings', route: 'Settings in the sidebar', purpose: 'Control cost, models, schedules, notifications, and optional features.',
      parts: ['USAGE: month-to-date spend vs budget, tokens, runs, per-model breakdown', 'PROVIDERS: Anthropic Claude (active); OpenAI & Google (planned)', 'MODEL ROUTING: pick Haiku / Sonnet / Opus per task (discovery, monitoring, extraction, validation)', 'NOTIFICATIONS: email + SMS, with per-trigger toggles', 'RUN-ALL FEEDBACK: how the app confirms a kicked run (toast / held button / both)', 'FIRST-TIME EXPERIENCE: reset to first-time state', 'LABS: feature flags for Consensus, Conflict workspace, and Guidance', 'SCHEDULE & VALIDATION DEFAULTS: poll cadence, run mode, default validation rule'],
      actions: ['Set a monthly budget and watch the usage bar', 'Route cheap models to discovery/monitoring, strong models to extraction/validation', 'Set up email/SMS alerts', 'Toggle Labs features on or off'] },
    { name: 'Document Examiner (Run all agents)', route: 'opens full-screen when you press RUN ALL AGENTS', purpose: 'Watch the agents actually read the filings.',
      parts: ['The filing fills the screen as real "paper"', 'A lens zooms to each section; figures are circled on the page', 'An Extracted Data panel fills with captured figures + confidence', 'A telemetry rail: pages read, tables parsed, figures captured, sources cross-referenced, model spend', 'A per-company progress rail'],
      actions: ['Press RUN ALL AGENTS to start it', 'Press \u25be to minimize and keep using the app while it runs in the background', 'Press \u2922 to expand back; it ends with a summary and syncs the Watchlist'] },
    { name: 'Tweaks (personalization)', route: 'the Tweaks panel', purpose: 'Adjust the look and feel; changes apply live and are remembered.',
      parts: ['Accent color (4 curated)', 'Surface: Carbon / Slate / Black', 'Mono typeface: Plex / JetBrains / Space', 'Density: Cozy / Compact', 'Card sparklines toggle'],
      actions: ['Open Tweaks, adjust, and your choices persist'] },
  ],

  tasks: [
    ['Add a company to my watchlist', 'Go to Companies \u2192 ADD COMPANIES. Search or filter the S&P 500, click the companies you want (or use "Select all" for a sector), then press ADD. The agents discover each company\u2019s IR + SEC sources; confirm to start watching.'],
    ['Run the agents now', 'On the Watchlist, press RUN ALL AGENTS. The Document Examiner opens and reads each company\u2019s latest filing. You can press \u25be to minimize it and keep working while it runs.'],
    ['Resolve a review item', 'Open Review (the sidebar item with the badge). For each finding, read the reason, compare the two candidate values and their sources, check the provenance snippet, then click USE <value> to record the correct one — or REJECT to discard it.'],
    ['Trace a number back to its source', 'Open the company\u2019s deep-dive, then either click a confidence badge in the RESULTS table or a metric row in the VALIDATION tab. The Provenance drawer slides in showing each source\u2019s document, page, URL, and the exact quote.'],
    ['Understand a watchlist card', 'The left bar and chip = status. The price row = live price + day change + EPS sparkline. The 3-metric grid = revenue / net income / EPS with YoY and a confidence badge. The footer changes by status (review CTA, next window, or "validated").'],
    ['Read the Timeline', 'Each row is a company. Green dots are results already reported. Orange bars are predicted filing windows. Amber pulsing bars mean an agent is watching for an imminent filing.'],
    ['Edit my position / see P&L', 'On a company\u2019s deep-dive, enter your SHARES and COST BASIS per share and save. The card and deep-dive then show your position value and unrealized gain/loss; the Watchlist shows a portfolio total.'],
    ['Set or change my budget', 'Go to Settings \u2192 USAGE. You\u2019ll see month-to-date spend against your budget; adjust the budget there. The usage meter on every screen reflects it.'],
    ['Change which AI model is used', 'Go to Settings \u2192 MODEL ROUTING. For each task (Source discovery, Monitoring poll, Extraction, Validation) pick Haiku, Sonnet, or Opus. Use cheaper models for polling/discovery and stronger models for extraction/validation.'],
    ['Set up notifications', 'Go to Settings \u2192 NOTIFICATIONS. Enter your email and/or phone, enable the channels, and toggle the triggers (on validated, on review, on watching started, on budget 80%).'],
    ['Personalize the look', 'Open the Tweaks panel and adjust accent color, surface darkness, monospace typeface, density, and whether cards show sparklines. Changes apply instantly and are remembered.'],
    ['Turn on the advanced (Labs) features', 'Go to Settings \u2192 LABS and toggle Consensus vs Actual, Conflict-Resolution Workspace, and/or Guidance Tracking. Each is independent — turning one off simply removes its parts; nothing else changes.'],
    ['Start over / reset', 'Go to Settings \u2192 FIRST-TIME EXPERIENCE and choose RESET TO FIRST-TIME STATE (two-step confirm). It clears fetched data but keeps your companies, positions, sources, routing, and notification settings; then RUN ALL AGENTS repopulates it.'],
  ],

  faqs: [
    ['Why is a company "watching"?', 'It means the agent hasn\u2019t found a new filing yet — it\u2019s polling on schedule for the next results, and polling intensifies as the predicted filing window approaches. Nothing is wrong; there\u2019s just nothing new to report.'],
    ['Why does a number "need review"?', 'Because the agent couldn\u2019t confidently validate it — either two sources disagree (e.g. a press-release headline EPS differs from the 8-K schedule) or a figure appeared in only one place. Rather than guess, it routes the decision to you in the Review queue.'],
    ['What does the confidence badge mean?', 'How well-corroborated a figure is: HIGH = found and agreeing in multiple sources; MED = limited corroboration; LOW = single source or conflicting. Click it to see the exact sources in the Provenance drawer.'],
    ['How does validation actually work?', 'For each figure the agent cross-references it against a rule — by default, "find EPS in at least two locations". If the sources agree, confidence rises and the number is recorded; if they conflict or only one source has it, it goes to Review.'],
    ['Where do the numbers come from?', 'From the company\u2019s official filings: SEC EDGAR (8-K / 10-Q / 10-K) as the structured backbone, plus the company\u2019s IR site / press release. Every figure links back to the exact source, page, and quote in the Provenance drawer.'],
    ['I pressed Run all agents and nothing seemed to happen.', 'The run kicks off immediately and the Document Examiner should open; if it was minimized, look for the small live progress widget (bottom-right). You can also set how runs are confirmed in Settings \u2192 RUN-ALL FEEDBACK (toast / held button / both).'],
    ['How much does this cost?', 'Each agent action uses AI model tokens that cost money. Settings \u2192 USAGE shows your month-to-date spend against a budget you set, broken down by model. You control cost via MODEL ROUTING — cheap models for polling, strong ones only for extraction/validation.'],
    ['Are the prices and numbers live?', 'Prices are live. Results appear as soon as the agent detects and validates a new filing — which is why monitoring runs on a cadence rather than once. The Timeline shows when the next filing is expected.'],
    ['Which AI does it use? Can I change it?', 'Anthropic\u2019s Claude is active today; the system is provider-agnostic (OpenAI and Google are planned behind the same interface). You assign models per task in Settings \u2192 MODEL ROUTING.'],
    ['How are filing dates predicted?', 'From each company\u2019s historical reporting cadence. A quarter ending in June might be reported anytime from late July to late September, so the Timeline shows a predicted window and the agent watches across it.'],
    ['What\u2019s the difference between the IR and SEC sources?', 'The IR (Investor Relations) site is the company\u2019s own press release — often fastest. SEC EDGAR is the official, structured filing — reliable for cross-checking. The agent uses both and corroborates figures across them.'],
    ['Can I use this on my phone?', 'Yes — the app is fully responsive. On a narrow screen the sidebar becomes a bottom tab bar and cards stack to one column; every feature is still available.'],
    ['What are the Labs features?', 'Three optional capabilities you toggle in Settings \u2192 LABS: Consensus vs Actual (beat/miss vs Wall Street estimates), the Conflict-Resolution Workspace (a richer side-by-side review of disputed figures), and Guidance Tracking (forward outlook vs prior guidance).'],
    ['Can you tell me whether to buy or sell a stock?', 'No — Agent Orange is a research and monitoring tool, not investment advice. I can explain how it found and validated a company\u2019s numbers, and where to see the evidence, but trading decisions are yours.'],
  ],

  troubleshooting: [
    ['A company shows no results yet', 'It probably hasn\u2019t reported since you added it, so its agent is "watching". Check the Timeline for the predicted window, or press RUN ALL AGENTS to force a check.'],
    ['The Review badge won\u2019t clear', 'There are still findings awaiting your decision. Open Review and resolve each (USE a value or REJECT) — the badge counts down as you go.'],
    ['Spend is higher than expected', 'Check Settings \u2192 USAGE for the per-model breakdown. If extraction/validation is heavy, that\u2019s expected (those use stronger models); you can rebalance in MODEL ROUTING or lower polling frequency in schedule defaults.'],
    ['A figure looks wrong', 'Open its Provenance drawer (click the confidence badge) to see the exact source and quote. If sources disagree, it should be in Review for you to pick the correct value.'],
    ['I added companies but see nothing on the Watchlist', 'After adding, the agents discover sources and begin watching; results appear once a filing is found and validated. Run all agents to kick an immediate check.'],
  ],

  guardrails: [
    'Only answer questions about understanding and using Agent Orange (its screens, features, and concepts). If asked about something else, politely say it\u2019s outside what you can help with and steer back to the app.',
    'Never give investment, trading, or financial advice (no buy/sell/hold opinions, price targets, or predictions). If asked, decline warmly and offer to explain how the tool validates and sources data instead.',
    'Never invent features, buttons, or behavior that aren\u2019t in this knowledge base. If something isn\u2019t covered, say you\u2019re not sure and suggest where in the app they might look or to contact support.',
    'Don\u2019t state specific live figures as fact — point the user to the relevant screen or the Provenance drawer to see the current, sourced numbers.',
    'When useful, name the exact screen or control (e.g. "Settings \u2192 Model routing") so the user can act, and keep answers short and friendly.',
  ],

  starters: [
    'How do I add a company?',
    'What does "needs review" mean?',
    'How is a number validated?',
    'Where do the numbers come from?',
    'How do I control costs?',
    'What are the Labs features?',
  ],
};

/* Serialize the KB into a compact, readable block for the system prompt. */
window.AO_KB_TEXT = (function (kb) {
  const L = [];
  L.push('# AGENT ORANGE — PRODUCT');
  L.push(kb.product.oneLiner);
  L.push('Audience: ' + kb.product.who);
  L.push('The per-company agent loop: ' + kb.product.loop.join(' '));
  L.push('Core principle: ' + kb.product.principle);

  L.push('\n# GLOSSARY');
  kb.glossary.forEach(([t, d]) => L.push(`- ${t}: ${d}`));

  L.push('\n# SCREENS & FEATURES');
  kb.screens.forEach((s) => {
    L.push(`## ${s.name} (${s.route}) — ${s.purpose}`);
    L.push('  Parts: ' + s.parts.join('; '));
    L.push('  You can: ' + s.actions.join('; '));
  });

  L.push('\n# HOW-TO (task recipes)');
  kb.tasks.forEach(([q, a]) => L.push(`- ${q}: ${a}`));

  L.push('\n# FAQ');
  kb.faqs.forEach(([q, a]) => L.push(`Q: ${q}\nA: ${a}`));

  L.push('\n# TROUBLESHOOTING');
  kb.troubleshooting.forEach(([q, a]) => L.push(`- ${q}: ${a}`));

  return L.join('\n');
})(window.AO_KB);
