#!/usr/bin/env node
/*
 * Patch Playwright's ESM loader hook for Node 23+.
 *
 * In Node 23 the `context.conditions` arg in the module-resolve hook is no
 * longer always an Array, and Playwright 1.61's bundled loader calls
 * `.includes(...)` on it directly — which throws
 *   `TypeError: context.conditions?.includes is not a function`
 * and crashes test discovery before any spec runs.
 *
 * Wrap the access so the array-only call site tolerates any iterable. Idempotent
 * — re-running on already-patched files is a no-op.
 */
const fs = require('fs')
const path = require('path')

const FILES = [
  'node_modules/playwright/lib/transform/esmLoader.js',
  'node_modules/playwright/lib/common/index.js',
]
const FROM =
  'specifier = context.conditions?.includes("import") ? import_url.default.pathToFileURL(resolved).toString() : resolved;'
const TO =
  'specifier = (context.conditions ? Array.from(context.conditions) : []).includes("import") ? import_url.default.pathToFileURL(resolved).toString() : resolved;'

let patched = 0
for (const rel of FILES) {
  const p = path.resolve(__dirname, '..', rel)
  if (!fs.existsSync(p)) continue
  const src = fs.readFileSync(p, 'utf8')
  if (src.includes(TO)) continue // already patched
  if (!src.includes(FROM)) continue
  fs.writeFileSync(p, src.split(FROM).join(TO))
  patched++
  console.log('patched ' + rel)
}
if (patched === 0) console.log('playwright esm-loader patch: nothing to do')
