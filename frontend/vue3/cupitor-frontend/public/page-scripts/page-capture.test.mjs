// How db/js/src/60-page-capture.js reads a page's text.
//
// The contract: a picked sentence reaches the app the way it was read. A line
// break the layout draws survives as '\n'; a newline that only exists in the
// HTML source does not become one; two blocks written with nothing between
// them do not glue their words together; and text the reader cannot see is not
// part of the sentence.
//
// The module is written to be injected into a page, so this boots it inside a
// jsdom window and drives the reader it publishes as __cupPageCaptureRead.
//
// jsdom is taken from a checkout beside this repo, or from $CUPITOR_JSDOM:
//
//   node db/js/page-capture.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'src', '60-page-capture.js');

function loadJsdom() {
  const candidates = [
    process.env.CUPITOR_JSDOM,
    'jsdom',
    path.resolve(HERE, '../../../cupitor/frontend/vue3/cupitor-frontend/node_modules/jsdom'),
  ].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch (_) { /* try the next */ }
  }
  console.error('jsdom not found. Point CUPITOR_JSDOM at a jsdom package directory.');
  process.exit(2);
}
const { JSDOM } = loadJsdom();
const SOURCE = fs.readFileSync(SRC, 'utf8');
const FRAME_SOURCE = fs.readFileSync(path.join(HERE, 'frame-boot.js'), 'utf8');

// Boot the module against one page and hand back its reader.
function boot(bodyHtml) {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${bodyHtml}</body></html>`, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'https://example.test/page',
  });
  const { window } = dom;
  // The module talks to the host through these; nothing here exercises them.
  window.CaptionCollector = { postMessage() {} };
  window.SnippetLogChannel = { postMessage() {} };
  // Published by 50-frame-reach.js in the real bundle. It hands each document
  // to a callback so the module can watch it; this page has only its own, and
  // these tests drive the reader directly rather than through a selection.
  window.cupInFrames = (fn) => { try { fn(window.document, window); } catch (_) {} };
  // The module logs as it installs; the test's own output is the report.
  window.console = { log() {}, warn() {}, error() {}, info() {} };
  window.eval(SOURCE);
  const api = window.__cupPageCaptureRead;
  if (!api) throw new Error('the module did not publish its reader');
  return { window, document: window.document, ...api };
}

// The same, for the agent that runs inside a cross-origin reader frame. It
// installs only when it is NOT the top window, so the page it reads is an
// iframe's document.
function bootFrame(bodyHtml) {
  const dom = new JSDOM(
    '<!DOCTYPE html><html><body><iframe></iframe></body></html>',
    { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/page' },
  );
  const frame = dom.window.document.querySelector('iframe');
  const win = frame.contentWindow;
  if (!win || win.top === win) throw new Error('no frame window to boot in');
  // Filled in here rather than through srcdoc, which loads asynchronously.
  win.document.body.innerHTML = bodyHtml;
  win.console = { log() {}, warn() {}, error() {}, info() {} };
  win.eval(FRAME_SOURCE);
  const api = win.__cupFrameBootRead;
  if (!api) throw new Error('the frame agent did not publish its reader');
  return { window: win, document: win.document, ...api };
}

const results = [];
function check(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, err: e }); }
}
function eq(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what || 'value'}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

check('the module boots and publishes its reader', () => {
  const { readBlock } = boot('<p>Hej.</p>');
  eq(typeof readBlock, 'function', 'readBlock');
});

check('two paragraphs written with nothing between them read as two lines', () => {
  // Google Docs writes exactly this: no whitespace at all between the blocks.
  const page = boot('<div id="b"><p>Han gick hem,</p><p>sa hon.</p></div>');
  eq(page.readBlock(page.document.getElementById('b')).text, 'Han gick hem,\nsa hon.');
});

check('a newline that is only in the source is a space', () => {
  const page = boot('<p id="b">Han gick\n   hem.</p>');
  eq(page.readBlock(page.document.getElementById('b')).text, 'Han gick hem.');
});

check('a <br> is a line break with or without whitespace around it', () => {
  const spaced = boot('<p id="b">Rose red <br>\n Violet blue.</p>');
  eq(spaced.readBlock(spaced.document.getElementById('b')).text, 'Rose red\nViolet blue.');
  const tight = boot('<p id="b">Rose red<br>Violet blue.</p>');
  eq(tight.readBlock(tight.document.getElementById('b')).text, 'Rose red\nViolet blue.');
});

check('words inside inline elements are not pulled apart', () => {
  const page = boot('<p id="b">Han gick <em>hem</em>. Ja.</p>');
  eq(page.readBlock(page.document.getElementById('b')).text, 'Han gick hem. Ja.');
});

check('text the reader cannot see is left out', () => {
  const page = boot(
    '<div id="b"><p>Han gick hem.</p>' +
    '<p style="display:none">DOLD</p>' +
    '<script>var x = 1;</script>' +
    '<p>Ja.</p></div>');
  eq(page.readBlock(page.document.getElementById('b')).text, 'Han gick hem.\nJa.');
});

check('cells of one row read apart, not glued', () => {
  const page = boot('<table id="b"><tr><td>Han gick</td><td>hem.</td></tr></table>');
  eq(page.readBlock(page.document.getElementById('b')).text, 'Han gick hem.');
});

check('items of a flex row read apart; a flex column reads as lines', () => {
  const row = boot('<div id="b" style="display:flex"><div>Han gick</div><div>hem.</div></div>');
  eq(row.readBlock(row.document.getElementById('b')).text, 'Han gick hem.');
  const col = boot('<div id="b" style="display:flex;flex-direction:column">' +
    '<div>Han gick hem,</div><div>sa hon.</div></div>');
  eq(col.readBlock(col.document.getElementById('b')).text, 'Han gick hem,\nsa hon.');
});

// The caret has to be MEASURED. Where the walk never reaches it, saying "the
// end" would hand back the block's last sentence as if it had been measured.
check('a caret the walk cannot reach is reported as unmeasured', () => {
  const page = boot('<div id="b"><p>The cat is black.</p>' +
    '<p id="h" style="display:none">The cat ran.</p><p>The cat sat.</p></div>');
  const hidden = page.document.getElementById('h').firstChild;
  const read = page.readBlock(page.document.getElementById('b'), hidden, 4);
  eq(read.text, 'The cat is black.\nThe cat sat.');
  eq(read.at, -1, 'offset');
});

check('a caret outside the block is unmeasured too', () => {
  const page = boot('<div id="b"><p>Han gick hem.</p></div><p id="o">Annat.</p>');
  const outside = page.document.getElementById('o').firstChild;
  eq(page.readBlock(page.document.getElementById('b'), outside, 2).at, -1, 'offset');
});

// visibility is inherited, but a descendant can turn it back on.
check('a visible word under a hidden ancestor is still read', () => {
  const page = boot('<p id="b">Han <span style="visibility:hidden">DOLD ' +
    '<span style="visibility:visible">syns</span></span> hem.</p>');
  eq(page.readBlock(page.document.getElementById('b')).text, 'Han syns hem.');
});

check('pre-line draws its newlines but still collapses runs of spaces', () => {
  const page = boot('<div id="b" style="white-space:pre-line">alpha   \n   beta</div>');
  eq(page.readBlock(page.document.getElementById('b')).text, 'alpha\nbeta');
});

check('a preformatted newline is kept', () => {
  const page = boot('<pre id="b">alpha\nbeta</pre>');
  eq(page.readBlock(page.document.getElementById('b')).text, 'alpha\nbeta');
});

check('the caret offset is measured in the text that comes back', () => {
  const page = boot('<div id="b"><p>Han gick hem.</p><p>Sa hon.</p></div>');
  const block = page.document.getElementById('b');
  const second = block.children[1].firstChild;   // "Sa hon."
  const read = page.readBlock(block, second, 3);
  eq(read.text, 'Han gick hem.\nSa hon.');
  // "Han gick hem.\nSa " is 17 characters.
  eq(read.at, 17, 'offset');
  eq(read.text.slice(read.at), 'hon.', 'what the caret sits before');
});

check('an offset inside a run of collapsed whitespace still lands', () => {
  const page = boot('<p id="b">Han     gick hem.</p>');
  const block = page.document.getElementById('b');
  const read = page.readBlock(block, block.firstChild, 8);   // inside the spaces
  eq(read.text, 'Han gick hem.');
  eq(read.text.slice(read.at), 'gick hem.', 'what the caret sits before');
});

check('normLines keeps a selection\'s breaks and drops its empty rows', () => {
  const { normLines } = boot('<p>x</p>');
  eq(normLines('  Han gick hem,  \n\n   \n  sa hon.  '), 'Han gick hem,\nsa hon.');
  eq(normLines('Han gick\r\nhem.'), 'Han gick\nhem.');
  eq(normLines('   '), '');
});

check('flat compares two readings by their words', () => {
  const { flat } = boot('<p>x</p>');
  eq(flat('Han gick hem,\nsa hon.'), 'Han gick hem, sa hon.');
  eq(flat('Han gick hem,\nsa hon.'), flat('Han gick hem, sa hon.'));
});

// The frame agent cannot import from the bundle, so it carries its own copy of
// these rules. A sentence must not depend on whether it was picked in the page
// or inside the reader frame, so both readers answer the same fixtures.
check('the frame agent reads a page exactly as the top frame does', () => {
  const fixtures = [
    ['<div id="b"><p>Han gick hem,</p><p>sa hon.</p></div>', 'abutting paragraphs'],
    ['<p id="b">Han gick\n   hem.</p>', 'a source newline'],
    ['<p id="b">Rose red<br>Violet blue.</p>', 'a tight <br>'],
    ['<p id="b">Han gick <em>hem</em>. Ja.</p>', 'an inline element'],
    ['<table id="b"><tr><td>Han gick</td><td>hem.</td></tr></table>', 'cells of a row'],
    ['<div id="b" style="display:flex"><div>Han gick</div><div>hem.</div></div>', 'a flex row'],
    ['<pre id="b">alpha\nbeta</pre>', 'preformatted text'],
    ['<div id="b"><p>Ett.</p><p style="display:none">DOLD</p><p>Tva.</p></div>', 'hidden text'],
  ];
  for (const [html, what] of fixtures) {
    const top = boot(html);
    const framed = bootFrame(html);
    eq(
      framed.readBlock(framed.document.getElementById('b')).text,
      top.readBlock(top.document.getElementById('b')).text,
      `the two readers disagree about ${what}`,
    );
  }
});

check('the two readers agree about a selection\'s shape', () => {
  const top = boot('<p>x</p>');
  const framed = bootFrame('<p>x</p>');
  for (const input of ['  Han gick hem,  \n\n  sa hon.  ', 'Han gick\r\nhem.', '   ']) {
    eq(framed.normLines(input), top.normLines(input), 'normLines');
    eq(framed.flat(input), top.flat(input), 'flat');
  }
});

let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`  ok   ${r.name}`);
  else { failed++; console.log(`  FAIL ${r.name}\n    ${String((r.err && r.err.message) || r.err).replace(/\n/g, '\n    ')}`); }
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
