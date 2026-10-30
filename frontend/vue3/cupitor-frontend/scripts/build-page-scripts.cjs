#!/usr/bin/env node
// Build the one-request WebView injection from Cupitor-owned sources.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../public');
const runtime = path.join(root, 'page-scripts');
// Package only the two existing native-app endpoints after minification.
// The app keeps fetching trexsatya.github.io/gh-pages/db/js/*.
if (process.argv[2] === '--package') {
  const dist = path.resolve(process.argv[3] || path.join(root, '../dist'));
  const files = ['snippet.js', 'frame-boot.js'].map(name => {
    const code = fs.readFileSync(path.join(dist, 'page-scripts', name), 'utf8');
    new vm.Script(code, {filename:name});
    return {name, code};
  });
  const target = path.join(dist, 'db/js');
  fs.mkdirSync(target, {recursive:true});
  for (const {name, code} of files) fs.writeFileSync(path.join(target, name), code);
  console.log('Packaged native page scripts at db/js/');
  process.exit(0);
}
const sources = fs.readdirSync(path.join(runtime, 'src')).filter(f => f.endsWith('.js'))
  .concat('20-caption-sidebar.js').sort();
const output = '// GENERATED FILE — DO NOT EDIT.\n// Built by scripts/build-page-scripts.cjs; sidebar source: public/language/caption-sidebar.js.\n\n' +
  sources.map(name => {
    const file = name === '20-caption-sidebar.js' ? path.join(root, 'language/caption-sidebar.js') : path.join(runtime, 'src', name);
    const code = fs.readFileSync(file, 'utf8');
    new vm.Script(code, {filename:file});
    return code;
  }).join('');
new vm.Script(output);
const destination = path.join(runtime, 'snippet.js');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(destination, 'utf8') !== output) throw new Error('Stale page bundle: run node scripts/build-page-scripts.cjs');
} else fs.writeFileSync(destination, output);
console.log('Page bundle matches ' + sources.length + ' Cupitor sources');
