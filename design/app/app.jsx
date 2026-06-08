/* Agent Orange — app shell: sidebar nav, routing, desktop/mobile toggle, tweaks. */
const { useState: useStateApp, useEffect: useEffectApp } = React;

const NAV = [
  { id: "watchlist", label: "Watchlist", icon: "▦" },
  { id: "timeline", label: "Timeline", icon: "▭" },
  { id: "review", label: "Review", icon: "⚑" },
  { id: "companies", label: "Companies", icon: "≣" },
  { id: "activity", label: "Activity", icon: "≁" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

/* ---- Tweak defaults (host rewrites this block on disk when you tweak) ---- */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#e8723a",
  "bg": "carbon",
  "font": "plex",
  "density": "cozy",
  "sparklines": true
}/*EDITMODE-END*/;

const BG_PRESETS = {
  carbon: { "--bg": "#07090c", "--panel": "#0d1117", "--panel-2": "#11161d", "--raised": "#161d27", "--line": "#222b37", "--line-soft": "#1a212b" },
  slate:  { "--bg": "#0b0f15", "--panel": "#121822", "--panel-2": "#18202c", "--raised": "#1f2836", "--line": "#2b3645", "--line-soft": "#202836" },
  black:  { "--bg": "#000000", "--panel": "#0a0a0c", "--panel-2": "#101013", "--raised": "#16161a", "--line": "#232327", "--line-soft": "#1a1a1e" },
};
const FONT_PRESETS = {
  plex:      "'IBM Plex Mono',ui-monospace,monospace",
  jetbrains: "'JetBrains Mono',ui-monospace,monospace",
  space:     "'Space Mono',ui-monospace,monospace",
};

function applyTweaks(t) {
  const root = document.documentElement;
  // accent + derived tints (color-mix keeps soft/line in lockstep)
  root.style.setProperty("--accent", t.accent);
  root.style.setProperty("--accent-soft", `color-mix(in srgb, ${t.accent} 14%, transparent)`);
  root.style.setProperty("--accent-line", `color-mix(in srgb, ${t.accent} 42%, transparent)`);
  // background tone
  const bg = BG_PRESETS[t.bg] || BG_PRESETS.carbon;
  Object.entries(bg).forEach(([k, v]) => root.style.setProperty(k, v));
  // mono font
  root.style.setProperty("--mono", FONT_PRESETS[t.font] || FONT_PRESETS.plex);
  // density + sparklines as classes
  root.classList.toggle("compact", t.density === "compact");
  root.classList.toggle("no-spark", !t.sparklines);
}

function App() {
  const data = window.AO_DATA;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useStateApp("watchlist");
  const [openCo, setOpenCo] = useStateApp(null); // ticker for deep-dive
  const [device, setDevice] = useStateApp("desktop"); // desktop | mobile
  const [running, setRunning] = useStateApp(false);
  const [lastSync, setLastSync] = useStateApp("Jul 30 · 09:12");

  useEffectApp(() => { applyTweaks(t); }, [t.accent, t.bg, t.font, t.density, t.sparklines]);

  const reviewCount = data.reviewQueue.length;

  function go(r) { setOpenCo(null); setRoute(r); }
  function openCompany(t) { setOpenCo(t); setRoute("company"); }
  function runAll() {
    if (running) return;
    setRunning(true);
    setTimeout(() => { setRunning(false); setLastSync("just now"); }, 2600);
  }

  const company = openCo ? data.companies.find((c) => c.ticker === openCo) : null;

  let view;
  if (route === "company" && company) view = <Company c={company} onBack={() => go("watchlist")} onReview={() => go("review")} />;
  else if (route === "timeline") view = <Timeline data={data} onOpen={openCompany} />;
  else if (route === "review") view = <Review data={data} onOpen={openCompany} />;
  else if (route === "companies") view = <Companies data={data} onOpen={openCompany} />;
  else if (route === "activity") view = <Activity data={data} />;
  else if (route === "settings") view = <Settings data={data} />;
  else view = <Watchlist data={data} onOpen={openCompany} onReview={() => go("review")} onRunAll={runAll} lastSync={lastSync} running={running} />;

  const activeNav = route === "company" ? "watchlist" : route;

  return (
    <div className={"frame dev-" + device}>
      <div className="frame-bar">
        <span className="frame-brand">AGENT&nbsp;ORANGE</span>
        <span className="frame-toggle">
          <button className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}>DESKTOP</button>
          <button className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")}>MOBILE</button>
        </span>
      </div>

      <div className="app-shell">
        {/* sidebar / topbar */}
        <nav className="nav">
          <div className="nav-brand">
            <span className="brand-mark" />
            <span className="brand-text">AGENT<br /><b>ORANGE</b></span>
          </div>
          <ul className="nav-list">
            {NAV.map((n) => (
              <li key={n.id}>
                <button className={"nav-item" + (activeNav === n.id ? " active" : "")} onClick={() => go(n.id)}>
                  <span className="nav-icon">{n.icon}</span>
                  <span className="nav-label">{n.label}</span>
                  {n.id === "review" && reviewCount > 0 && <span className="nav-badge">{reviewCount}</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="nav-foot">
            <div className="nav-usage">
              <div className="nu-top"><span>OPUS&nbsp;4</span><span className="nu-dot" /></div>
              <div className="nu-bar"><span style={{ width: "37%" }} /></div>
              <div className="nu-lab">${data.usage.monthCost.toFixed(0)} / ${data.usage.budget} · {data.usage.monthTokens}M tok</div>
            </div>
          </div>
        </nav>

        <main className="content">{view}</main>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Appearance" />
        <TweakColor label="Accent" value={t.accent}
          options={["#e8723a", "#46b1c9", "#d7a13b", "#9a86f0"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakRadio label="Surface" value={t.bg}
          options={[{ value: "carbon", label: "Carbon" }, { value: "slate", label: "Slate" }, { value: "black", label: "Black" }]}
          onChange={(v) => setTweak("bg", v)} />
        <TweakRadio label="Mono type" value={t.font}
          options={[{ value: "plex", label: "Plex" }, { value: "jetbrains", label: "JetBrains" }, { value: "space", label: "Space" }]}
          onChange={(v) => setTweak("font", v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density}
          options={[{ value: "cozy", label: "Cozy" }, { value: "compact", label: "Compact" }]}
          onChange={(v) => setTweak("density", v)} />
        <TweakToggle label="Card sparklines" value={t.sparklines}
          onChange={(v) => setTweak("sparklines", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
