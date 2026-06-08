/* Agent Orange — notifications scene: a macOS Mail inbox (laptop) + an iPhone
   showing incoming SMS, both carrying the alerts Agent Orange sends. These are
   "real world" device chrome (light theme, system type) — deliberately NOT the
   terminal app UI — to read as the user's own laptop + phone. */
(function () {
  // Agent Orange alert emails (newest first). `agent:true` = from Agent Orange.
  const EMAILS = [
    { agent: true, kind: "ok", from: "Agent Orange", time: "9:13 AM",
      subj: "NVDA · Q1 FY26 validated", snip: "Diluted EPS $2.39 (+214% YoY) · revenue $93.2B. Corroborated across 3 sources — recorded automatically." },
    { agent: true, kind: "review", from: "Agent Orange", time: "9:12 AM",
      subj: "SanDisk · Q4 needs your review", snip: "EPS conflict — press release $0.82 vs 8-K schedule $0.79. A human decision is needed before it's recorded." },
    { agent: true, kind: "watch", from: "Agent Orange", time: "6:00 AM",
      subj: "Micron · watching window opened", snip: "Q4 FY26 expected Sep 22 – Oct 06. Polling intensified to every 4 hours inside the window." },
    { agent: false, from: "Morningstar", time: "8:41 AM",
      subj: "Your watchlist daily digest", snip: "Markets open higher; semis lead. 3 holdings on your list moved >2%…" },
    { agent: false, from: "SEC EDGAR", time: "Yesterday",
      subj: "Filing alert: subscription confirmed", snip: "You are subscribed to real-time filing alerts for 3 CIKs." },
  ];

  const SMS = [
    { time: "9:13 AM", text: "NVDA Q1 FY26 ✓ validated. Diluted EPS $2.39 (+214% YoY). All figures corroborated." },
    { time: "9:12 AM", text: "⚑ SanDisk Q4 needs your review — EPS $0.82 vs $0.79. Open Agent Orange to decide." },
  ];

  function diamond(cls) { return `<span class="ao-ava ${cls || ""}"><i class="ao-dia"></i></span>`; }

  function notify(p) {
    p = p || {};
    const nE = p.nEmail == null ? EMAILS.length : p.nEmail; // agent emails revealed
    const nS = p.nSms == null ? SMS.length : p.nSms;

    // email rows: agent emails reveal progressively; static (read) ones always present
    const agentEmails = EMAILS.filter((e) => e.agent);
    const otherEmails = EMAILS.filter((e) => !e.agent);
    const shownAgent = agentEmails.slice(0, nE);
    const rows = [...shownAgent, ...otherEmails].map((e, i) => {
      const dotCls = e.agent ? "dot-" + e.kind : "";
      const enter = e.agent && i === nE - 1 ? " just-in" : "";
      return `<div class="mail-row${e.agent ? " unread" : ""}${enter}">
        <span class="mail-dot ${dotCls}"></span>
        ${e.agent ? diamond("sm") : `<span class="mail-ava-x">${e.from.slice(0, 1)}</span>`}
        <div class="mail-main">
          <div class="mail-top"><span class="mail-from">${e.from}</span><span class="mail-time">${e.time}</span></div>
          <div class="mail-subj">${e.subj}</div>
          <div class="mail-snip">${e.snip}</div>
        </div>
      </div>`;
    }).join("");

    const bubbles = SMS.slice(0, nS).map((m, i) =>
      `<div class="sms-row${i === nS - 1 ? " just-in" : ""}"><div class="sms-bubble">${m.text}</div><div class="sms-time">${m.time}</div></div>`
    ).join("");

    return `<div class="desk">
      <!-- macOS Mail window -->
      <section class="mailwin">
        <header class="mac-bar">
          <span class="lights"><i class="l-r"></i><i class="l-y"></i><i class="l-g"></i></span>
          <span class="mac-title">Inbox — Mail</span>
          <span class="mac-spacer"></span>
        </header>
        <div class="mail-toolbar"><span class="mt-box">Inbox</span><span class="mt-count">${shownAgent.length} new</span><span class="mt-search">Search</span></div>
        <div class="mail-list">${rows}</div>
      </section>

      <!-- iPhone with Messages -->
      <div class="phone">
        <div class="phone-screen">
          <div class="ios-status"><span>9:13</span><span class="ios-ico">● ▮▮ ▰</span></div>
          <div class="sms-head">${diamond("")}<div class="sms-head-name">Agent Orange</div><div class="sms-head-sub">alerts · texts</div></div>
          <div class="sms-list">${bubbles}</div>
          <div class="sms-input"><span>Text Message</span></div>
        </div>
        <span class="phone-notch"></span>
      </div>
    </div>`;
  }

  window.SCREENS = window.SCREENS || {};
  window.SCREENS.notify = notify;
})();
