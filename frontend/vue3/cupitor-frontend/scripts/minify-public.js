#!/usr/bin/env node
/**
 * Minifies in place the user-authored .js files inside dist/.
 * Run after `vue-cli-service build` to compress files that vue-cli copies
 * verbatim from public/ (vue-cli already minifies its own webpack bundle).
 *
 * Scope (only the user's own JS):
 *   - skip dist/vendor/ (third-party libraries — many already minified)
 *   - skip dist/js/    (vue-cli's webpack output — already minified)
 *   - skip *.min.js
 *   - skip non-.js files
 */
const fs = require('fs')
const path = require('path')

// Prefer terser 5 (installed under the npm alias `terser5` to avoid
// fighting with webpack's pinned terser 4). Fall back to whatever
// `terser` resolves to (typically the hoisted 4.8.1 from
// terser-webpack-plugin) if the alias isn't installed.
let minify, terserVersion
try {
  ({ minify } = require('terser5'))
  terserVersion = require('terser5/package.json').version
} catch (_) {
  ({ minify } = require('terser'))
  terserVersion = require('terser/package.json').version
}

const DIST = path.resolve(__dirname, '..', 'dist')

// Top-level dist/ subdirectories that should NOT be touched. Paths are
// matched at the start of the dist-relative path so a stray `vendor/` deeper
// in the tree (unlikely) wouldn't be skipped.
const SKIP_DIRS = ['vendor', 'js']

let totalBefore = 0
let totalAfter = 0
let processed = 0
let skipped = 0

// Terser 4 has a synchronous API and reports errors via result.error (no
// throw); Terser 5 returns a Promise and throws. Bridge both: await the
// returned value (await on a plain object resolves to the object; await on
// a Promise resolves normally) and treat result.error as a thrown error.
async function callMinify(code, opts) {
  let result
  try {
    result = await minify(code, opts)
  } catch (e) {
    return { error: e }
  }
  if (result && result.error) return { error: result.error }
  return result
}

async function processFile(file) {
  const rel = path.relative(DIST, file)
  if (!file.endsWith('.js')) return
  if (file.endsWith('.min.js')) { skipped++; return }
  // Scope to user-authored JS — anything inside skipped top-level dirs is
  // out (vue-cli's own webpack bundle and third-party vendor libs).
  const top = rel.split(path.sep)[0]
  if (SKIP_DIRS.includes(top)) { skipped++; return }

  const code = fs.readFileSync(file, 'utf8')
  if (!code.trim()) return

  // `output` is the terser 4 option name and is still accepted by terser 5
  // (which also exposes `format` as an alias). Using `output` works on both.
  const baseOpts = {
    compress: { passes: 2 },
    mangle: true,
    output: { comments: /^!|@preserve|@license|@cc_on/i },
  }

  // Try module mode first (handles ESM `export`/`import`); fall back to
  // script mode if a vendor file rejects module-only constructs.
  let result = await callMinify(code, { ...baseOpts, module: true })
  if (result.error) {
    result = await callMinify(code, { ...baseOpts, module: false })
  }
  if (result.error) {
    console.warn(`skip ${rel}: ${result.error.message || result.error}`)
    skipped++
    return
  }

  if (!result || typeof result.code !== 'string') {
    console.warn(`skip ${rel}: terser produced no output`)
    skipped++
    return
  }

  const before = Buffer.byteLength(code, 'utf8')
  const after = Buffer.byteLength(result.code, 'utf8')

  // Sanity check: never overwrite a non-trivial source with a near-empty
  // output. Some terser-4 edge cases yield "" on success (no thrown error,
  // no result.error, but everything mangled to nothing). Treat any case
  // where the output is < 5% of the input as a failure and keep the original.
  if (before > 200 && after < Math.max(20, before * 0.05)) {
    console.warn(`skip ${rel}: suspicious shrink ${before} -> ${after} bytes — keeping original`)
    skipped++
    return
  }

  fs.writeFileSync(file, result.code, 'utf8')
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
    if (ent.isDirectory()) {
      // Don't even descend into the skip dirs — saves a lot of stat calls
      // when dist/vendor/ contains thousands of files.
      if (dir === DIST && SKIP_DIRS.includes(ent.name)) continue
      await walk(full)
    } else {
      await processFile(full)
    }
  }
}

(async () => {
  if (!fs.existsSync(DIST)) {
    console.error(`No dist/ directory at ${DIST}. Run \`vue-cli-service build\` first.`)
    process.exit(1)
  }
  console.log(`using terser ${terserVersion}`)
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
