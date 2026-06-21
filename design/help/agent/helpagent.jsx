/* Agent Orange — Help Assistant. A grounded chat agent: the ENTIRE knowledge
   base (knowledge.js) is injected into the prompt every turn, so answers come
   only from verified site facts. Calls window.claude.complete (Haiku). */
const { useState, useRef, useEffect } = React;
const KB = window.AO_KB;
const KB_TEXT = window.AO_KB_TEXT;

const SCREENS = ['Watchlist', 'Company deep-dive', 'Timeline', 'Review queue', 'Companies', 'Activity', 'Settings'];

/* Assemble the grounded prompt: persona + guardrails + full corpus + context + history. */
function buildPrompt(history, question, screen) {
  const rules = KB.guardrails.map((g, i) => `${i + 1}. ${g}`).join('\n');
  const convo = history.slice(-8).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
  return [
    `You are the ${KB.product.name} Help Assistant — a friendly, concise in-app guide that helps people use the site.`,
    '',
    'RULES (follow strictly):',
    rules,
    '',
    'STYLE: Warm and human, but brief — usually 2–4 sentences. For "how do I…" questions, give a short numbered list of steps. Name the exact screen or control (e.g. "Settings → Model routing"). Plain text only; you may use **bold** for screen/control names. No headings. If the answer is not in the KNOWLEDGE, say you’re not certain and suggest where in the app to look or to contact support.',
    '',
    `CONTEXT: The user is currently on the "${screen}" screen.`,
    '',
    '=== KNOWLEDGE (your only source of truth) ===',
    KB_TEXT,
    '=== END KNOWLEDGE ===',
    '',
    convo ? 'CONVERSATION SO FAR:\n' + convo : '',
    `User: ${question}`,
    'Assistant:',
  ].join('\n');
}

/* Light formatter: **bold**, line breaks, and - / 1. list items. */
function format(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  let html = '';
  let inList = false;
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  for (let line of lines) {
    const li = line.match(/^\s*(?:[-•]|\d+[.)])\s+(.*)/);
    if (li) {
      if (!inList) { html += '<ol class="ha-ol">'; inList = true; }
      html += `<li>${inline(li[1])}</li>`;
    } else {
      if (inList) { html += '</ol>'; inList = false; }
      html += `<p>${inline(line)}</p>`;
    }
  }
  if (inList) html += '</ol>';
  return html;
}

function Bubble({ m }) {
  if (m.role === 'user') return <div className="ha-msg user"><div className="ha-b">{m.text}</div></div>;
  return (
    <div className="ha-msg bot">
      <div className="ha-ava">◑</div>
      <div className="ha-b" dangerouslySetInnerHTML={{ __html: m.typing ? '<span class="ha-dots"><i></i><i></i><i></i></span>' : format(m.text) }} />
    </div>
  );
}

function HelpAgent() {
  const [open, setOpen] = useState(true);
  const [screen, setScreen] = useState('Watchlist');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: 'bot', text: `Hi! I’m the Agent Orange help assistant. Ask me anything about using the site — adding companies, what a status means, how numbers get validated, controlling cost, and more.` },
  ]);
  const scrollRef = useRef(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, open]);

  async function ask(q) {
    if (!q.trim() || busy) return;
    setInput('');
    const history = msgs.filter((m) => !m.typing);
    const next = [...history, { role: 'user', text: q }, { role: 'bot', typing: true }];
    setMsgs(next);
    setBusy(true);
    try {
      const prompt = buildPrompt(history, q, screen);
      const reply = await window.claude.complete(prompt);
      setMsgs([...history, { role: 'user', text: q }, { role: 'bot', text: (reply || '').trim() || 'Sorry — I didn’t catch that. Could you rephrase?' }]);
    } catch (e) {
      setMsgs([...history, { role: 'user', text: q }, { role: 'bot', text: 'I’m having trouble reaching the assistant right now. Please try again in a moment — or check the help guide.' }]);
    } finally {
      setBusy(false);
    }
  }

  const showStarters = msgs.filter((m) => m.role === 'user').length === 0;

  return (
    <>
      {!open && (
        <button className="ha-launch" onClick={() => setOpen(true)} aria-label="Open help assistant">
          <span className="ha-launch-i">◑</span> Need help?
        </button>
      )}
      {open && (
        <div className="ha-panel" role="dialog" aria-label="Help assistant">
          <div className="ha-hd">
            <div className="ha-hd-l">
              <span className="ha-mark">◑</span>
              <div>
                <div className="ha-title">HELP ASSISTANT</div>
                <div className="ha-sub">Ask about using Agent Orange</div>
              </div>
            </div>
            <button className="ha-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>

          <div className="ha-ctx">
            <span className="ha-ctx-l">You’re on</span>
            <select value={screen} onChange={(e) => setScreen(e.target.value)}>
              {SCREENS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="ha-ctx-h">answers adapt to your screen</span>
          </div>

          <div className="ha-body" ref={scrollRef}>
            {msgs.map((m, i) => <Bubble key={i} m={m} />)}
            {showStarters && (
              <div className="ha-starters">
                {KB.starters.map((s) => (
                  <button key={s} className="ha-chip" onClick={() => ask(s)}>{s}</button>
                ))}
              </div>
            )}
          </div>

          <form className="ha-input" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={busy ? 'Thinking…' : 'Ask a question…'}
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send">↑</button>
          </form>
          <div className="ha-foot">Grounded in the Agent Orange help guide · not investment advice</div>
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('agent-root')).render(<HelpAgent />);
