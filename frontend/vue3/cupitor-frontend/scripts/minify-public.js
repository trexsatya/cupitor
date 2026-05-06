#!/usr/bin/env node
/**
 * Minifies all .js files inside dist/ in place.
 * Run after `vue-cli-service build` to compress the static assets that
 * vue-cli copies verbatim from public/ (vue-cli already minifies its own
 * webpack bundle, but it does not touch public/*.js).
 *
 * Skips:
 *   - files already minified (*.min.js)
 *   - non-.js files
 */
const fs = require('fs')
const path = require('path')
const { minify } = require('terser')

const DIST = path.resolve(__dirname, '..', 'dist')

let totalBefore = 0
let totalAfter = 0
let processed = 0
let skipped = 0

async function processFile(file) {
  const rel = path.relative(DIST, file)
  if (!file.endsWith('.js')) return
  if (file.endsWith('.min.js')) { skipped++; return }

  const code = fs.readFileSync(file, 'utf8')
  if (!code.trim()) return

  // Try module mode first (handles ESM `export`/`import`); fall back to
  // script mode if a vendor file rejects module-only constructs.
  let result
  try {
    result = await minify(code, {
      module: true,
      compress: { passes: 2 },
      mangle: true,
      format: { comments: /^!|@preserve|@license|@cc_on/i },
    })
  } catch (e) {
    try {
      result = await minify(code, {
        module: false,
        compress: { passes: 2 },
        mangle: true,
        format: { comments: /^!|@preserve|@license|@cc_on/i },
      })
    } catch (e2) {
      console.warn(`skip ${rel}: ${e2.message}`)
      skipped++
      return
    }
  }

  if (!result || typeof result.code !== 'string') {
    console.warn(`skip ${rel}: terser produced no output`)
    skipped++
    return
  }

  fs.writeFileSync(file, result.code, 'utf8')
  const before = Buffer.byteLength(code, 'utf8')
  const after = Buffer.byteLength(result.code, 'utf8')
  totalBefore += before
  totalAfter += after
  processed++
  const pct = before ? ((1 - after / before) * 100).toFixed(1) : '0.0'
  console.log(`min  ${rel.padEnd(45)} ${before.toString().padStart(8)} -> ${after.toString().padStart(8)}  (-${pct}%)`)
}

async function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) await walk(full)
    else await processFile(full)
  }
}

(async () => {
  if (!fs.existsSync(DIST)) {
    console.error(`No dist/ directory at ${DIST}. Run \`vue-cli-service build\` first.`)
    process.exit(1)
  }
  const start = Date.now()
  await walk(DIST)
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const pct = totalBefore ? ((1 - totalAfter / totalBefore) * 100).toFixed(1) : '0.0'
  console.log('---')
  console.log(`minified ${processed} file(s), skipped ${skipped} (${elapsed}s)`)
  console.log(`total ${totalBefore} -> ${totalAfter} bytes  (-${pct}%)`)
})().catch(err => {
  console.error(err)
  process.exit(1)
})
