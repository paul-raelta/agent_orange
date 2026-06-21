Read HELP.md at the repo root and ship the Agent Orange help page.

The guide is a self-contained, data-driven page now in design/help/ (Help.html shell +
helpdata.js content + img/*.jpg annotated screenshots; numbered pins → callouts, sticky
TOC, scroll-spy — all vanilla, no build step).

Integrate it (Option A, recommended): copy design/help/ → web/public/help/ so Vite serves
it at /help/Help.html, then add a "Help" item to the sidebar nav (and the mobile tab bar)
linking to it, using the existing nav styling (a ? or book glyph). Keep the Labs section
gated by the same feature flags as FEATURES.md if those have shipped.

Verify: the page opens, images load under the chosen host path, TOC scroll-spy and
pin/callout hover-linking work, and a Help link exists in desktop + mobile nav. web/
builds clean. Commit.
