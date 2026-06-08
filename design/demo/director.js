/* Agent Orange — demo director.
   A deterministic, scrub-safe timeline: every visual is a pure function of time
   t, so the scrubber can jump anywhere. Camera + cursor follow on-screen
   elements via live getBoundingClientRect (Screen-Studio-style damped focus). */
(function () {
  const frame = document.getElementById("frame");
  const camera = document.getElementById("camera");
  const appmount = document.getElementById("appmount");
  const cursor = document.getElementById("cursor");
  const ring = document.getElementById("clickRing");
  const capEl = document.getElementById("caption");
  const titleEl = document.getElementById("title");
  const tstamp = document.getElementById("tstamp");
  const scrub = document.getElementById("scrub");
  const playBtn = document.getElementById("playpause");
  const timeEl = document.getElementById("time");
  const chapters = document.getElementById("chapters");

  // ---------- helpers ----------
  const lerp = (a, b, f) => a + (b - a) * f;
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  let lastZoom = 1.04;
  // Vertical centering target for the camera. Below frame-center (540) so the app
  // sits a touch higher, reserving a clear band at the bottom for captions.
  const CY = 466;

  function appPoint(target) {
    if (Array.isArray(target)) return { x: target[0], y: target[1] };
    if (target === "full") return { x: 720, y: 450 };
    const el = appmount.querySelector(target);
    if (!el) return { x: 720, y: 450 };
    const r = el.getBoundingClientRect();
    const c = camera.getBoundingClientRect();
    // Derive the TRUE on-screen scale from the camera's rendered size (1440×900
    // content). This folds in BOTH the camera zoom AND the outer #frame scale, so
    // app-local coords are correct on any viewport size (translate-centered frame).
    const sx = c.width / 1440 || 1, sy = c.height / 900 || 1;
    return { x: (r.left + r.width / 2 - c.left) / sx, y: (r.top + r.height / 2 - c.top) / sy };
  }

  function sampleTrack(kfs, lt) {
    if (lt <= kfs[0].t) return { a: kfs[0], b: kfs[0], f: 0 };
    if (lt >= kfs[kfs.length - 1].t) { const k = kfs[kfs.length - 1]; return { a: k, b: k, f: 0 }; }
    for (let i = 0; i < kfs.length - 1; i++) {
      if (lt >= kfs[i].t && lt <= kfs[i + 1].t) {
        const f = (lt - kfs[i].t) / (kfs[i + 1].t - kfs[i].t || 1);
        return { a: kfs[i], b: kfs[i + 1], f: easeInOut(f) };
      }
    }
    return { a: kfs[0], b: kfs[0], f: 0 };
  }

  // ---------- timeline ----------
  const EPS = '[data-metric="EPS · diluted"]';
  const SCENES = [
    // 0 — INTRO
    {
      start: 0, screen: "watchlist", params: {},
      title: { mode: "intro", html: `<div class="t-wrap"><div class="t-kicker">A day with</div><div class="t-mark"></div><div class="t-word">AGENT&nbsp;<b>ORANGE</b></div><div class="t-tag">Autonomous earnings intelligence — your investing desk, on autopilot.</div></div>` },
      cam: [{ t: 0, focus: "full", zoom: 1.06 }, { t: 5, focus: "full", zoom: 1.03 }],
      cursor: [{ t: 0, at: [760, 470] }],
      captions: [],
    },
    // 1 — OVERVIEW
    {
      start: 5, screen: "watchlist", params: {},
      cam: [{ t: 0, focus: [720, 430], zoom: 1.05 }, { t: 8, focus: [720, 460], zoom: 1.07 }],
      cursor: [{ t: 0, at: [740, 250] }, { t: 2.4, at: '[data-card="NVDA"]' }, { t: 5, at: '[data-card="SNDK"]' }, { t: 7.6, at: '[data-card="MU"]' }],
      captions: [{ t: 0, kicker: "09:12 · Tuesday", line: "Three companies I follow. <b>Three different states.</b>" }],
    },
    // 2 — STATUS CALLOUT
    {
      start: 13, screen: "watchlist", params: {},
      cam: [{ t: 0, focus: '[data-card="NVDA"]', zoom: 1.22 }, { t: 2.2, focus: '[data-card="NVDA"]', zoom: 1.24 }, { t: 2.6, focus: '[data-card="SNDK"]', zoom: 1.24 }, { t: 4.6, focus: '[data-card="SNDK"]', zoom: 1.24 }, { t: 5, focus: '[data-card="MU"]', zoom: 1.24 }, { t: 7, focus: '[data-card="MU"]', zoom: 1.24 }],
      cursor: [{ t: 0, at: '[data-card="NVDA"]' }, { t: 2.6, at: '[data-card="SNDK"]' }, { t: 5, at: '[data-card="MU"]' }],
      captions: [
        { t: 0, kicker: "NVDA", line: "NVIDIA just reported — <b>already validated.</b>" },
        { t: 2.6, kicker: "SNDK", line: "SanDisk found something that <b>needs my call.</b>" },
        { t: 5, kicker: "MU", line: "Micron — no date yet. <b>Still watching.</b>" },
      ],
    },
    // 3 — PORTFOLIO
    {
      start: 20, screen: "watchlist", params: {},
      cam: [{ t: 0, focus: ".pf-strip", zoom: 1.0 }, { t: 1.2, focus: ".pf-strip", zoom: 1.6 }, { t: 5, focus: ".pf-strip", zoom: 1.58 }],
      cursor: [{ t: 0, at: [300, 360] }, { t: 1.5, at: ".pf-strip" }],
      captions: [{ t: 0, kicker: "Portfolio", line: "My whole book, <b>live-priced</b> — up 29% unrealized." }],
    },
    // 4 — RUN ALL AGENTS
    {
      start: 25, screen: "watchlist", params: (lt) => ({ running: lt >= 2.4 }),
      cam: [{ t: 0, focus: "[data-run]", zoom: 1.2 }, { t: 1.6, focus: "[data-run]", zoom: 1.42 }, { t: 6.5, focus: "[data-run]", zoom: 1.4 }],
      cursor: [{ t: 0, at: [720, 250] }, { t: 1.8, at: "[data-run]" }, { t: 6.5, at: "[data-run]" }],
      clicks: [{ t: 2.2, at: "[data-run]" }],
      captions: [
        { t: 0, kicker: "One click", line: "Then I set them loose — <b>offline, unsupervised.</b>" },
        { t: 3, kicker: "Running", line: "Each agent goes and finds its company's latest filing." },
      ],
    },
    // 5 — NOTIFICATIONS (laptop email + phone SMS)
    {
      start: 31, screen: "notify",
      params: (lt) => ({ nEmail: lt > 4 ? 3 : lt > 2.4 ? 2 : lt > 1 ? 1 : 0, nSms: lt > 8.4 ? 2 : lt > 6.8 ? 1 : 0 }),
      cam: [{ t: 0, focus: "full", zoom: 1.02 }, { t: 1.4, focus: ".mailwin", zoom: 1.16 }, { t: 5.4, focus: ".mailwin", zoom: 1.16 }, { t: 6.6, focus: ".phone", zoom: 1.34 }, { t: 11, focus: ".phone", zoom: 1.3 }],
      cursor: [{ t: 0, at: [720, 470] }, { t: 1.8, at: ".mail-row.unread" }, { t: 4.5, at: ".mail-list" }, { t: 6.8, at: ".phone" }],
      captions: [
        { t: 0, kicker: "Notifications", line: "I don't sit and watch — <b>it reaches me.</b>" },
        { t: 6.6, kicker: "Email + SMS", line: "A mail and a text the moment results land — or need me." },
      ],
    },
    // 6 — NVDA NARRATIVE
    {
      start: 42, screen: "company", params: { ticker: "NVDA", tab: "results" },
      cam: [{ t: 0, focus: "full", zoom: 1.05 }, { t: 1.6, focus: ".ai-narrative", zoom: 1.3 }, { t: 6, focus: ".ai-narrative", zoom: 1.3 }],
      cursor: [{ t: 0, at: [300, 300] }, { t: 1.8, at: ".ai-narrative" }],
      captions: [{ t: 0, kicker: "NVDA · Q1 FY26", line: "NVIDIA's 10-Q landed. The agent <b>summarizes what matters.</b>" }],
    },
    // 7 — VALIDATION
    {
      start: 48, screen: "company", params: (lt) => ({ ticker: "NVDA", tab: lt >= 1.2 ? "validation" : "results" }),
      cam: [{ t: 0, focus: ".tabs", zoom: 1.2 }, { t: 1.2, focus: ".tabs", zoom: 1.2 }, { t: 2.2, focus: ".val-card", zoom: 1.16 }, { t: 7, focus: ".val-card", zoom: 1.14 }],
      cursor: [{ t: 0, at: [300, 360] }, { t: 0.9, at: '[data-tab="validation"]' }, { t: 1.5, at: '[data-tab="validation"]' }, { t: 3, at: EPS }, { t: 6.5, at: EPS }],
      clicks: [{ t: 1.0, at: '[data-tab="validation"]' }],
      captions: [{ t: 0, kicker: "Validation", line: "Every number is <b>cross-checked across the filing</b> — and this one passed." }],
    },
    // 8 — PROVENANCE DRAWER
    {
      start: 55, screen: "company", params: (lt) => ({ ticker: "NVDA", tab: "validation", drawerKey: lt >= 1 ? "EPS · diluted" : null }),
      cam: [{ t: 0, focus: EPS, zoom: 1.24 }, { t: 1, focus: EPS, zoom: 1.24 }, { t: 2, focus: ".drawer", zoom: 1.12 }, { t: 10, focus: ".drawer", zoom: 1.1 }],
      cursor: [{ t: 0, at: EPS }, { t: 1.2, at: EPS }, { t: 2.4, at: ".drawer .prov-quote" }, { t: 9, at: ".drawer .prov-quote" }],
      clicks: [{ t: 0.85, at: EPS }],
      captions: [{ t: 0, kicker: "Provenance", line: "EPS <b>$2.39</b> — traced to three independent sources, down to the page." }],
    },
    // 9 — REVIEW QUEUE
    {
      start: 64, screen: "review", params: (lt) => ({ resolved: lt >= 7 ? "$0.82" : null }),
      cam: [{ t: 0, focus: "full", zoom: 1.06 }, { t: 1.4, focus: ".rv-candidates", zoom: 1.32 }, { t: 6, focus: ".rv-candidates", zoom: 1.3 }, { t: 7.4, focus: ".rv-card", zoom: 1.12 }, { t: 11, focus: ".rv-card", zoom: 1.1 }],
      cursor: [{ t: 0, at: [400, 300] }, { t: 2, at: ".rv-cand:nth-child(1)" }, { t: 4, at: ".rv-cand:nth-child(2)" }, { t: 6, at: '[data-use="$0.82"]' }, { t: 7, at: '[data-use="$0.82"]' }],
      clicks: [{ t: 6.6, at: '[data-use="$0.82"]' }],
      captions: [
        { t: 0, kicker: "Review queue", line: "SanDisk disagrees with itself: headline <b>$0.82</b> vs schedule <b>$0.79</b>." },
        { t: 7.4, kicker: "Human-in-the-loop", line: "So I make the call. <b>Agents never guess.</b>" },
      ],
    },
    // 10 — TIMELINE
    {
      start: 74, screen: "timeline", params: {},
      cam: [{ t: 0, focus: "full", zoom: 1.05 }, { t: 1.6, focus: '[data-card="MU"] .tl-bar', zoom: 1.5 }, { t: 6, focus: '[data-card="MU"] .tl-bar', zoom: 1.46 }],
      cursor: [{ t: 0, at: [500, 250] }, { t: 2, at: '[data-card="MU"] .tl-bar' }],
      captions: [{ t: 0, kicker: "Filing timeline", line: "Results drop on <b>no fixed date</b> — agents know when to start watching." }],
    },
    // 11 — SETTINGS
    {
      start: 81, screen: "settings", params: {},
      cam: [{ t: 0, focus: ".usage", zoom: 1.2 }, { t: 2.2, focus: ".usage", zoom: 1.24 }, { t: 3, focus: ".route", zoom: 1.12 }, { t: 7, focus: ".route", zoom: 1.12 }],
      cursor: [{ t: 0, at: ".usage" }, { t: 3, at: ".route" }, { t: 6, at: ".route" }],
      captions: [
        { t: 0, kicker: "Cost & routing", line: "Just <b>$18.60</b> this month — and provider-agnostic." },
        { t: 3.4, kicker: "Model routing", line: "<b>Opus</b> where it counts; cheaper models for the routine polls." },
      ],
    },
    // 12 — OUTRO
    {
      start: 88, screen: "watchlist", params: {},
      title: { mode: "outro", html: `<div class="t-wrap"><div class="t-mark"></div><div class="t-word">AGENT&nbsp;<b>ORANGE</b></div><div class="t-tag">Fetches. Validates. Flags what needs you.<br>Your earnings desk, on autopilot.</div></div>` },
      cam: [{ t: 0, focus: "full", zoom: 1.05 }, { t: 6, focus: "full", zoom: 1.02 }],
      cursor: [{ t: 0, at: [760, 470] }],
      captions: [],
    },
  ];
  const DUR = 94;
  SCENES.forEach((s, i) => { s.end = i < SCENES.length - 1 ? SCENES[i + 1].start : DUR; });

  // ---------- render state ----------
  let curSig = null, curScene = null, lastCapKey = "", lastTitleKey = "";

  function ensureScreen(scene, lt) {
    const params = typeof scene.params === "function" ? scene.params(lt) : scene.params;
    const sig = scene.screen + "|" + JSON.stringify(params);
    if (sig !== curSig) { appmount.innerHTML = window.SCREENS[scene.screen](params); curSig = sig; }
  }

  function applyTitle(scene, lt) {
    if (!scene.title) { titleEl.style.opacity = 0; return; }
    const key = scene.start + scene.title.mode;
    if (key !== lastTitleKey) { titleEl.innerHTML = scene.title.html; lastTitleKey = key; }
    const dur = scene.end - scene.start;
    let op;
    if (scene.title.mode === "intro") {
      op = lt < 0.5 ? lt / 0.5 : lt > dur - 0.9 ? Math.max(0, (dur - lt) / 0.9) : 1;
    } else {
      op = lt < 0.8 ? lt / 0.8 : 1;
    }
    titleEl.style.opacity = op;
  }

  function applyCaption(scene, lt) {
    const caps = scene.captions || [];
    let active = null;
    for (const c of caps) if (lt >= c.t) active = c;
    const key = active ? scene.start + "_" + active.t : "";
    if (key !== lastCapKey) {
      lastCapKey = key;
      if (active) {
        capEl.innerHTML = `<div class="cap-inner"><span class="cap-kicker">${active.kicker}</span><div class="cap-line">${active.line}</div></div>`;
        capEl.classList.remove("show"); void capEl.offsetWidth; capEl.classList.add("show");
      } else capEl.classList.remove("show");
    }
  }

  function applyClicks(scene, lt) {
    const clicks = scene.clicks || [];
    let shown = false;
    for (const c of clicks) {
      const d = lt - c.t;
      if (d >= 0 && d <= 0.5) {
        const p = d / 0.5;
        const pt = appPoint(c.at);
        const z = lastZoom;
        ring.style.transform = `translate(${pt.x}px,${pt.y}px) scale(${(1 + p * 2.2) / z})`;
        ring.style.opacity = (1 - p) * 0.9;
        shown = true;
      }
    }
    if (!shown) ring.style.opacity = 0;
  }

  function render(t) {
    // active scene
    let scene = SCENES[0];
    for (const s of SCENES) if (t >= s.start) scene = s;
    const lt = t - scene.start;

    ensureScreen(scene, lt);

    // camera
    const cs = sampleTrack(scene.cam, lt);
    const fa = appPoint(cs.a.focus), fb = appPoint(cs.b.focus);
    const focus = { x: lerp(fa.x, fb.x, cs.f), y: lerp(fa.y, fb.y, cs.f) };
    const zoom = lerp(cs.a.zoom, cs.b.zoom, cs.f);
    const tx = 960 - focus.x * zoom, ty = CY - focus.y * zoom;
    camera.style.transform = `translate(${tx}px,${ty}px) scale(${zoom})`;
    lastZoom = zoom;

    // cursor
    const us = sampleTrack(scene.cursor, lt);
    const ca = appPoint(us.a.at), cb = appPoint(us.b.at);
    const cp = { x: lerp(ca.x, cb.x, us.f), y: lerp(ca.y, cb.y, us.f) };
    cursor.style.transform = `translate(${cp.x}px,${cp.y}px) scale(${1 / zoom})`;
    cursor.style.opacity = scene.title && scene.title.mode === "intro" && lt < 0.6 ? 0 : 1;

    applyClicks(scene, lt);
    applyCaption(scene, lt);
    applyTitle(scene, lt);

    // timestamp + chapters
    const mm = Math.floor(t / 60), ssec = Math.floor(t % 60);
    tstamp.textContent = `${mm}:${String(ssec).padStart(2, "0")} / 1:26`;
    frame.dataset.screenLabel = `${mm}:${String(ssec).padStart(2, "0")}`;
    if (scene !== curScene) {
      curScene = scene;
      [...chapters.children].forEach((ch) => ch.classList.toggle("active", +ch.dataset.start === scene.start));
    }
  }

  // ---------- playback ----------
  let t = 0, playing = false, last = performance.now();
  function fmtTime(v) { const m = Math.floor(v / 60), s = Math.floor(v % 60); return m + ":" + String(s).padStart(2, "0"); }
  try { const saved = +localStorage.getItem("ao-demo-t"); if (saved > 0 && saved < DUR) t = saved; } catch {}
  scrub.max = DUR; scrub.step = 0.01;

  function setPlay(p) { playing = p; playBtn.textContent = p ? "❚❚" : "▶"; }
  function loop(now) {
    const dt = (now - last) / 1000; last = now;
    if (playing) { t += dt; if (t >= DUR) { t = DUR; setPlay(false); } }
    render(t);
    scrub.value = t;
    timeEl.textContent = fmtTime(t) + " / " + fmtTime(DUR);
    tstamp.textContent = fmtTime(t) + " / " + fmtTime(DUR);
    try { localStorage.setItem("ao-demo-t", t.toFixed(2)); } catch {}
    requestAnimationFrame(loop);
  }

  playBtn.addEventListener("click", () => { if (t >= DUR) t = 0; setPlay(!playing); });
  scrub.addEventListener("input", () => { t = +scrub.value; render(t); });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); if (t >= DUR) t = 0; setPlay(!playing); }
    else if (e.code === "ArrowRight") { t = Math.min(DUR, t + 5); render(t); }
    else if (e.code === "ArrowLeft") { t = Math.max(0, t - 5); render(t); }
  });

  // chapters
  const CHAPS = [["Watchlist", 5], ["Run agents", 25], ["Notify", 31], ["Results", 42], ["Provenance", 55], ["Review", 64], ["Timeline", 74], ["Settings", 81]];
  chapters.innerHTML = CHAPS.map(([n, s]) => `<button class="chapter" data-start="${s}">${n}</button>`).join("");
  [...chapters.children].forEach((ch) => ch.addEventListener("click", () => { t = +ch.dataset.start; render(t); }));

  // ---------- fit scaling ----------
  function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    frame.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener("resize", fit);
  fit();

  // deterministic hook (testing / external control)
  window.__demo = { seek(v) { t = Math.max(0, Math.min(DUR, v)); render(t); scrub.value = t; timeEl.textContent = fmtTime(t) + " / " + fmtTime(DUR); }, pause() { setPlay(false); }, play() { setPlay(true); }, get t() { return t; } };

  // boot
  render(t);
  timeEl.textContent = fmtTime(t) + " / " + fmtTime(DUR);
  setPlay(true);
  requestAnimationFrame(loop);
})();
