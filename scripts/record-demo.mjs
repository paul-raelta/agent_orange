/* Agent Orange — demo video recorder (HIGH QUALITY).
 *
 * Records the interactive demo (docs/interactive.html) to a clean, sharp video
 * for the mobile player. Run on your own machine via Claude Code / Node.
 *
 * One-time setup:
 *   npm i -D playwright
 *   npx playwright install chromium
 *   # ffmpeg is required for the .mp4 (iOS needs H.264):  macOS: brew install ffmpeg
 *
 * Run (from the repo root):
 *   node scripts/record-demo.mjs
 *
 * Output: docs/demo.webm  +  docs/demo.mp4  (high quality).
 * Quality knobs: full 1920x1080 capture, 2x device scale (crisp text), CRF 17.
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const interactive = path.join(root, "docs", "interactive.html");
const tmpDir = path.join(root, ".video-tmp");
const outWebm = path.join(root, "docs", "demo.webm");
const outMp4 = path.join(root, "docs", "demo.mp4");

const W = 1920, H = 1080;     // full HD capture
const SCALE = 2;              // render at 2x for crisp text, downscaled into the frame
const DURATION_MS = 116000;   // demo is ~1:53; a little tail for the outro hold

if (!existsSync(interactive)) {
  console.error("Cannot find " + interactive + " — run from the repo root.");
  process.exit(1);
}
rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: SCALE,
  recordVideo: { dir: tmpDir, size: { width: W, height: H } },
});
const page = await context.newPage();

await page.goto(pathToFileURL(interactive).href);
await page.waitForTimeout(900);

// clean capture: hide the on-page controls / timestamp / fullscreen button
await page.addStyleTag({ content: "#controls,#tstamp,#fsbtn,#rothint{display:none!important}" });

// start at 0, and make the demo fill the full frame (no reserved controls gap)
await page.evaluate(() => {
  try { localStorage.removeItem("ao-demo-t"); } catch (e) {}
  var f = document.getElementById("frame");
  if (f) { f.style.transition = "none"; f.style.transform = "translate(-50%,-50%) scale(1)"; }
  window.__demo && window.__demo.seek(0);
  window.__demo && window.__demo.play();
});

console.log("Recording ~" + Math.round(DURATION_MS / 1000) + "s at " + W + "x" + H + " @" + SCALE + "x …");
await page.waitForTimeout(DURATION_MS);

await context.close();   // finalizes the .webm
await browser.close();

const rec = readdirSync(tmpDir).find((f) => f.endsWith(".webm"));
if (!rec) { console.error("No video produced."); process.exit(1); }
renameSync(path.join(tmpDir, rec), outWebm);
rmSync(tmpDir, { recursive: true, force: true });
console.log("✓ Wrote " + outWebm);

// high-quality H.264 mp4 (required for iOS)
const ff = spawnSync("ffmpeg", [
  "-y", "-i", outWebm,
  "-c:v", "libx264", "-preset", "slow", "-crf", "17",
  "-pix_fmt", "yuv420p", "-vf", "scale=" + W + ":" + H + ":flags=lanczos",
  "-movflags", "+faststart", outMp4,
], { stdio: "inherit" });

if (ff.status === 0) {
  console.log("✓ Wrote " + outMp4 + "  (mobile player uses this)");
} else {
  console.log("\nffmpeg not found — wrote .webm only. iPhone/iPad need the .mp4. Convert with:");
  console.log("  ffmpeg -i docs/demo.webm -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart docs/demo.mp4");
}
