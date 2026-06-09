/* Agent Orange — mobile showcase. A single hero phone running the REAL app at
   phone width, so the app's own container-query reflow (bottom tab bar, single
   column) is what shows. The director animates scrolling and a tap that opens a
   company screen — "same intelligence, on the go." */
(function () {
  const W = 372, H = 760; // phone screen — under the 700px mobile breakpoint

  function phone(appHtml) {
    const sized = appHtml.replace(
      '<div class="app-shell">',
      `<div class="app-shell" style="width:${W}px;height:${H}px">`
    );
    return `<div class="mphone">
      <div class="mphone-screen">
        <div class="ios-status mphone-status"><span>9:41</span><span class="ios-ico">● ▮▮ ▰</span></div>
        <div class="mphone-app">${sized}</div>
      </div>
      <span class="mphone-notch"></span>
    </div>`;
  }

  function mobileShowcase(p) {
    p = p || {};
    let inner;
    if (p.view === "company") inner = window.SCREENS.company({ ticker: "NVDA", tab: p.tab || "validation" });
    else inner = window.SCREENS.watchlist({});
    return `<div class="mstage">${phone(inner)}</div>`;
  }

  window.SCREENS = window.SCREENS || {};
  window.SCREENS.mobile = mobileShowcase;
})();
