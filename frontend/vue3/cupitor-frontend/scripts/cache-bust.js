#!/usr/bin/env node
/**
 * Cache-bust user-authored ES module imports so a deploy takes effect immediately instead of
 * waiting out the browser's module cache (the app serves unbundled modules with STABLE names, and
 * GitHub Pages caches them for max-age=600 — plus browsers hold a module across a session — so a
 * fresh deploy can keep serving the old code).
 *
 * Appends `?v=<hash>` to every RELATIVE .js module specifier (static `import`/`export … from`,
 * side-effect `import`, and dynamic `import()`), in dist's user JS files AND the HTML entry points'
 * inline module scripts. `<hash>` is a content hash of all rewritten files, so it changes ONLY when
 * the code changes — unchanged deploys reuse the same URLs and the browser cache stays warm.
 *
 * Untouched: absolute specifiers (e.g. `/vendor/…`), vue-cli's webpack output (dist/js/, already
 * content-hashed), vendor libraries, index.html (webpack-managed), and *.test.js.
 *
 * Runs AFTER scripts/minify-public.js in the build chain.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIST = path.resolve(__dirname, '..', 'dist');
const SKIP_DIRS = new Set(['vendor', 'js']);

// Append `?v=<version>` to relative .js module specifiers. Anchored to a `from`/`import` keyword
// (not preceded by `.`, so `Array.from('./x.js')`-style calls are left alone) and limited to ./ or
// ../ paths ending in .js with no existing query, so string literals are never rewritten.
// Exported for unit testing.
function bustImports(code, version) {
  return code.replace(
    /(?<!\.)\b(from|import)(\s*\(?\s*)(['"])(\.\.?\/[^'"?]+\.js)\3/g,
    (_m, kw, gap, q, spec) => `${kw}${gap}${q}${spec}?v=${version}${q}`,
  );
}

// A dist-relative path is a target if it's user-authored JS or an HTML entry point (not index.html),
// and not inside a skipped top-level dir or a .test.js / .min.js.
function isTarget(rel) {
  const top = rel.split(path.sep)[0];
  if (SKIP_DIRS.has(top)) return false;
  if (rel === 'index.html') return false;
  if (rel.endsWith('.min.js') || rel.endsWith('.test.js')) return false;
  return rel.endsWith('.js') || rel.endsWith('.html');
}

function collectTargets(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (dir === DIST && SKIP_DIRS.has(ent.name)) continue;
      collectTargets(path.join(dir, ent.name), out);
    } else {
      const rel = path.relative(DIST, path.join(dir, ent.name));
      if (isTarget(rel)) out.push(rel);
    }
  }
  return out;
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error(`No dist/ directory at ${DIST}. Run \`vue-cli-service build\` first.`);
    process.exit(1);
  }
  const targets = collectTargets(DIST).sort();
  // Version = content hash over all targets (pre-rewrite), so it changes only when code changes.
  const h = crypto.createHash('sha1');
  const contents = new Map();
  for (const rel of targets) {
    const code = fs.readFileSync(path.join(DIST, rel), 'utf8');
    contents.set(rel, code);
    h.update(rel); h.update('\0'); h.update(code); h.update('\0');
  }
  const version = h.digest('hex').slice(0, 10);

  let rewritten = 0; let touchedSpecifiers = 0;
  for (const rel of targets) {
    const code = contents.get(rel);
    let count = 0;
    const out = code.replace(
      /(?<!\.)\b(from|import)(\s*\(?\s*)(['"])(\.\.?\/[^'"?]+\.js)\3/g,
      (_m, kw, gap, q, spec) => { count++; return `${kw}${gap}${q}${spec}?v=${version}${q}`; },
    );
    if (count > 0) {
      fs.writeFileSync(path.join(DIST, rel), out, 'utf8');
      rewritten++; touchedSpecifiers += count;
    }
  }
  console.log(`cache-bust v=${version}: rewrote ${touchedSpecifiers} import(s) across ${rewritten} file(s)`);
}

module.exports = { bustImports };

if (require.main === module) main();
