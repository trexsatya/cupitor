#!/usr/bin/env node
// Overlay the built app without mirroring away user data. Only files recorded
// by an earlier deployment may be removed; unknown site content stays put.
const fs = require('node:fs');
const path = require('node:path');
const STATE = '.cupitor-deployed-files.json';
// These generated entry points are the only build-owned paths inside db/.
const RUNTIME_FILES = ['db/js/snippet.js', 'db/js/frame-boot.js'];
const runtimeParents = new Set(['db', 'db/js']);
const protectedPath = file => !RUNTIME_FILES.includes(file) &&
  (['db', '.git', '.github', 'cname'].includes(file.split('/')[0].toLowerCase()) || file === STATE);
const safePath = file => typeof file === 'string' && file.length > 0 && !file.includes('\\') &&
  !path.posix.isAbsolute(file) && path.posix.normalize(file) === file && !file.split('/').some(p => p === '.' || p === '..');

function regularPath(root, file, createParents = false) {
  const parts = file.split('/');
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) {
      if (createParents) fs.mkdirSync(current);
      else return;
    }
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Unsafe deployment directory: ${file}`);
  }
  const dest = path.join(root, ...parts);
  let stat;
  try { stat = fs.lstatSync(dest); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Unsafe deployment file: ${file}`);
}

function stageSite(dist, destination, revision = '') {
  dist = fs.realpathSync(dist); destination = fs.realpathSync(destination);
  if (dist === destination || dist.startsWith(destination + path.sep) || destination.startsWith(dist + path.sep)) {
    throw new Error('Build and publishing directories must be separate');
  }
  for (const required of ['index.html', 'language.html', 'language/language.js', ...RUNTIME_FILES]) {
    if (!fs.statSync(path.join(dist, required)).isFile()) throw new Error(`Incomplete frontend build: ${required}`);
  }
  const files = [];
  function walk(directory, prefix = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const rel = prefix + entry.name;
      if (!safePath(rel)) throw new Error(`Invalid build path: ${rel}`);
      if ((protectedPath(rel) && !runtimeParents.has(rel)) || rel === 'page-scripts' || /\.test\.[cm]?js$/.test(rel)) continue;
      if (entry.isSymbolicLink()) throw new Error(`Build contains a symbolic link: ${rel}`);
      if (entry.isDirectory()) walk(path.join(directory, entry.name), rel + '/');
      else if (entry.isFile()) files.push(rel);
    }
  }
  walk(dist);
  if (!files.includes('.nojekyll')) files.push('.nojekyll');
  files.sort();
  regularPath(destination, STATE);
  const statePath = path.join(destination, STATE);
  const previous = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { version: 1, files: [] };
  if (previous.version !== 1 || !Array.isArray(previous.files) || previous.files.some(file => !safePath(file))) {
    throw new Error('Invalid previous deployment manifest');
  }
  const current = new Set(files);
  const stale = previous.files.filter(file => !protectedPath(file) && !current.has(file));
  // Validate destinations before changing anything in this disposable checkout.
  for (const file of [...files, ...stale]) regularPath(destination, file);
  for (const file of files) {
    regularPath(destination, file, true);
    if (file === '.nojekyll') fs.writeFileSync(path.join(destination, file), '');
    else fs.copyFileSync(path.join(dist, file), path.join(destination, file));
  }
  for (const file of stale) {
    const dest = path.join(destination, file);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
  }
  fs.writeFileSync(statePath, JSON.stringify({ version: 1, sourceRevision: revision, files }, null, 2) + '\n');
  return { copied: files.length, removed: stale.length };
}

if (require.main === module) {
  const [dist, destination, revision = ''] = process.argv.slice(2);
  if (!dist || !destination) throw new Error('Usage: node deploy-site.cjs DIST PUBLISHING_CHECKOUT [SOURCE_SHA]');
  console.log(JSON.stringify(stageSite(dist, destination, revision)));
}
module.exports = { stageSite, STATE, RUNTIME_FILES };
