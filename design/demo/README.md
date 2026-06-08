# Agent Orange — Demo Video

A self-running ~86s product walkthrough of the Agent Orange UI (autoplay, captions,
simulated cursor, camera-follow, scrubber + chapters). Built from the live `web/` source,
so the screens are pixel-faithful to the deployed app.

Once GitHub Pages is enabled (see below) the live demo is at
**<https://paul-raelta.github.io/agent_orange/>**.

## What's in the bundle

```
docs/
  index.html                      single self-contained file (CSS + JS + fonts inlined). PUBLISH THIS.
design/demo/                      editable multi-file source (edit these, then re-bundle)
  Agent Orange Demo.html          entry — markup + thumbnail template
  Agent Orange Demo (shareable).html   the bundled single file (== docs/index.html)
  data.js                         demo dataset (NVDA validated / SNDK review / MU watching)
  screens.js                      faithful screen builders (Watchlist, Company, Review, …)
  director.js                     timeline engine: scenes, camera, cursor, captions, scrubber
  demo.css                        frame, camera, cursor, captions, controls
  app.css, tokens.css             COPIES of web/src/styles/* — keep in sync if the app restyles
  README.md                       this file
```

## Publish a permanent public link (GitHub Pages)

`docs/index.html` is self-contained, so any static host works. With this repo:

1. The folder is already on `main`, so `docs/index.html` exists.
2. GitHub → repo **Settings → Pages**.
3. **Source:** Deploy from a branch → **Branch:** `main` → **Folder:** `/docs` → Save.
4. After ~1 min it's live at **<https://paul-raelta.github.io/agent_orange/>**.

> ⚠️ **Private repo note:** GitHub Pages on a *private* repo requires a paid GitHub plan
> (Pro/Team). On the free plan, either make the repo public, or host `docs/index.html` on
> **Netlify** (drag-and-drop the file) / **Firebase Hosting** (`firebase deploy`) /
> **Cloudflare Pages** — all give a permanent public URL and don't care about repo visibility.

### Firebase Hosting (fits the planned GCP setup)

```bash
# from a folder containing index.html (e.g. copy docs/index.html in)
firebase init hosting      # public dir = the folder with index.html
firebase deploy            # → https://<project>.web.app
```

## Editing the demo later

Don't edit the bundled file directly. Edit the sources in `design/demo/`, then re-bundle
into one file. The narrative is authored in `director.js` → the `SCENES` array (each
scene = screen + camera keyframes + cursor waypoints + captions). Timings are in seconds;
total `DUR = 86`.

To re-bundle, open `design/demo/Agent Orange Demo.html` in the design tool that produced
it and run the "Save as standalone HTML" / bundling step, or any HTML inliner, then
replace `docs/index.html` with the result.

## Keeping it faithful to the app

`app.css` / `tokens.css` here are **copies** of `web/src/styles/*`. If the real app's
styling changes materially, copy those two files over again and re-bundle so the demo
stays accurate.
