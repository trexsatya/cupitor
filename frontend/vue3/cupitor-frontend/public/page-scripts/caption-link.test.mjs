// The address a captured block is sent under, and the parameter that lets the
// webapp point a card at one moment of it.
//
// The contract: `url` is the page, and it means the same thing however far
// into the video you happen to be — the webapp matches it to recognise lines
// it has already filed, so a de-dupe keyed on something that moves would
// recognise nothing. `timeParam` names what this player calls a start offset,
// and is '' only for a player that has none; `timeLink` says whether pointing
// at a moment is worth it on this page. The name goes out either way, because
// it is also what lets the webapp clean an address a card stored earlier. The
// link itself is built by the webapp, the only side that knows which lines
// reached the card.
//
// Which parameter carries the time is configuration, not code: it lives in
// src/30-caption-sites.js, which is fetched at runtime, so teaching Cupitor a
// new player is an edit to that file and no app release.
//
// jsdom is taken from a checkout beside this repo, or from $CUPITOR_JSDOM:
//
//   node db/js/caption-link.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));

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
const src = (f) => fs.readFileSync((f === '20-caption-sidebar.js' ? path.join(HERE, '../language/caption-sidebar.js') : path.join(HERE, 'src', f)), 'utf8');
const SIDEBAR = src('20-caption-sidebar.js');
const SITES = src('30-caption-sites.js');

// Both modules are plain IIFEs that publish on window.__cupShared and touch
// nothing else until they are called, so they boot against a bare page. `url`
// is what the page thinks it is, which is what the addresses are built from.
function boot(url, title = 'En serie | SVT Play') {
  const dom = new JSDOM(`<!DOCTYPE html><html><head><title>${title}</title></head><body></body></html>`, {
    runScripts: 'outside-only', pretendToBeVisual: true, url,
  });
  const { window } = dom;
  window.console = { log() {}, warn() {}, error() {}, info() {} };
  window.eval(SIDEBAR);
  window.eval(SITES);
  const shared = window.__cupShared;
  for (const fn of ['capturePayload', 'stripTimeParam', 'timeParamName',
                    'resolveCaptionSite']) {
    if (typeof shared?.[fn] !== 'function') throw new Error(`the bundle did not publish ${fn}`);
  }
  return { window, ...shared };
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

const SVT = 'https://www.svtplay.se/video/abc123/en-serie';
const cues = (...starts) => starts.map((s, i) => ({ start: s, end: s + 2, text: `line ${i}` }));

// ── identity ────────────────────────────────────────────────────────────

// The same table runs in the webapp's caption-capture.test.js, against the
// function that puts the parameter back. The two sides have to agree about
// what counts as the same key, or a link ends up carrying two offsets.
const STRIP_TABLE = [
  [`${SVT}?position=750`, SVT],
  [SVT, SVT],
  [`${SVT}?start=auto&position=750#kap`, `${SVT}?start=auto#kap`],
  [`${SVT}?position=750&start=auto`, `${SVT}?start=auto`],
  [`${SVT}?POSITION=750`, `${SVT}?POSITION=750`],   // a key is case-sensitive
  [`${SVT}?positioning=750`, `${SVT}?positioning=750`],
  [`${SVT}?start=auto`, `${SVT}?start=auto`],
  [`${SVT}?flag&position=1`, `${SVT}?flag`],
  ['https://s.test/v#/w', 'https://s.test/v#/w'],
];

check('the same addresses strip the same way on both sides', () => {
  const { stripTimeParam } = boot(SVT);
  for (const [from, to] of STRIP_TABLE) {
    eq(stripTimeParam(from, 'position'), to, `stripping ${from}`);
  }
});

// The page rewrites its own address as you watch, and a card's link lands you
// back on one. If identity moved with it, every line already filed would be
// filed again as a duplicate and nothing would ever read as "already
// captured".
check('the page keeps one identity however far into the video it is', () => {
  const { stripTimeParam } = boot(SVT);
  eq(stripTimeParam(`${SVT}?position=750`, 'position'), SVT);
  eq(stripTimeParam(SVT, 'position'), SVT);
  eq(stripTimeParam(`${SVT}?start=auto&position=750#kap`, 'position'),
     `${SVT}?start=auto#kap`);
});

check('stripping leaves a page with no such parameter alone', () => {
  const { stripTimeParam } = boot(SVT);
  eq(stripTimeParam(`${SVT}?start=auto`, 'position'), `${SVT}?start=auto`);
  eq(stripTimeParam(`${SVT}?start=auto`, ''), `${SVT}?start=auto`);
});

// ── the block that goes on the wire ─────────────────────────────────────

check('a send carries the page, the parameter and the lines', () => {
  const page = boot(SVT);
  const p = page.capturePayload(SVT, ' En serie ', 'sv', cues(128.4, 200), 'position');
  eq(p.url, SVT, 'identity');
  eq(p.timeParam, 'position', 'what this player calls a start offset');
  eq(p.timeLink, true, 'and a moment is worth pointing at here');
  eq(p.title, 'En serie');
  eq(p.lang, 'sv');
  eq(p.lines.length, 2);
});

// The name and the decision are separate facts. Carrying them on one field
// would leave the webapp unable to clean an address stored by an older card
// on exactly the pages where no link is wanted — and file its lines again.
check('the parameter is named even where no link is wanted', () => {
  const page = boot(SVT);
  const never = () => false;
  const p = page.capturePayload(`${SVT}?position=750`, '', '', cues(128), 'position', never);
  eq(p.url, SVT, 'identity');
  eq(p.timeParam, 'position', 'still named');
  eq(p.timeLink, false, 'but no link');
});

// A site entry that plainly says no means no; one that says something we
// cannot read is not a licence to link everywhere.
// One rule the whole way down: anything that is not a no is a yes. The host
// and the webapp read the answer the same way, so a value that reads as "link
// here" cannot become "don't" by crossing a layer.
check('a plain yes or no is read as one', () => {
  const page = boot(SVT);
  const ask = (on) => page.capturePayload(SVT, '', '', cues(9), 'position', on).timeLink;
  eq(ask(undefined), true, 'an entry that says nothing means everywhere');
  eq(ask(null), true, 'and so does an absent one');
  for (const yes of [true, 1, 'yes', {}, []]) {
    eq(ask(yes), true, `a timeLinkOn of ${JSON.stringify(yes)}`);
  }
  for (const no of [false, 0, '']) {
    eq(ask(no), false, `a timeLinkOn of ${JSON.stringify(no)}`);
  }
  eq(ask(() => true), true, 'a predicate that says yes');
  eq(ask(() => 0), false, 'a predicate that says no');
});

// youtu.be is the same video under a shorter name, and parseMediaUrl in the
// webapp already knows that — the two sides have to agree.
check('a short YouTube address is the same video', () => {
  const url = 'https://youtu.be/abcdefghijk?t=310';
  const page = boot(url);
  const site = page.resolveCaptionSite();
  eq(site && site.id, 'youtube', 'the site youtu.be resolves to');
  eq(page.capturePayload(url, '', '', cues(9), site.timeParam, site.timeLinkOn).url,
     'https://youtu.be/abcdefghijk', 'identity');
});

// An offset already on the page belongs to where the user was watching, not
// to the block being sent — identity must not move with it.
check('an offset already on the page is not part of its identity', () => {
  const page = boot(`${SVT}?position=750`);
  const p = page.capturePayload(`${SVT}?position=750`, '', '', cues(128), 'position');
  eq(p.url, SVT, 'identity');
  eq(p.timeParam, 'position');
});

// Sentences picked off a page ride a different sender, which composes these
// three published pieces rather than capturePayload. Sentences picked at
// 12:30 belong to the same page as sentences picked at the start.
check('the sentence sender cleans the same address the same way', () => {
  const page = boot(`${SVT}?position=750`);
  const site = page.resolveCaptionSite();
  const name = page.timeParamName(site && site.timeParam);
  eq(name, 'position');
  eq(page.stripTimeParam(`${SVT}?position=750`, name), SVT);
});

// ── the configuration surface ───────────────────────────────────────────

check('SVT names its parameter on an on-demand video', () => {
  const page = boot(SVT);
  const site = page.resolveCaptionSite();
  eq(site && site.id, 'svt', 'the site an svtplay.se page resolves to');
  eq(page.capturePayload(SVT, '', '', cues(128), site.timeParam, site.timeLinkOn)
       .timeParam, 'position');
});

check('a clip is an on-demand video too', () => {
  const url = 'https://www.svtplay.se/klipp/xyz/ett-klipp';
  const page = boot(url);
  const site = page.resolveCaptionSite();
  eq(page.capturePayload(url, '', '', cues(60), site.timeParam, site.timeLinkOn)
       .timeParam, 'position');
});

// A number on a live timeline means nothing to whoever opens the link later.
// The offset still comes out of the address: identity has to hold still here
// too, or two sends from one channel never recognise each other.
check('a live channel wants no link but still holds its identity still', () => {
  const url = 'https://www.svtplay.se/kanaler/svt1';
  const page = boot(`${url}?position=4212`);
  const site = page.resolveCaptionSite();
  const p = page.capturePayload(`${url}?position=4212`, '', '', cues(4212),
                                site.timeParam, site.timeLinkOn);
  eq(p.url, url, 'identity');
  eq(p.timeLink, false, 'no moment worth pointing at');
  eq(p.timeParam, 'position', 'named anyway, which is what cleaned the address');
});

// Only SVT Play's own videos and clips. svt.se has its own /video/ and
// /klipp/ paths, and its article player is not known to read this at all.
check('the pages SVT is willing to be linked into', () => {
  const wanted = {
    'https://www.svtplay.se/video/abc/en-serie': true,
    'https://www.svtplay.se/klipp/abc/ett-klipp': true,
    'https://www.svtplay.se/kanaler/svt1': false,
    'https://www.svt.se/video/abc/x': false,
    'https://www.svt.se/klipp/abc/x': false,
    'https://www.svt.se/nyheter/inrikes/klipp/abc': false,
    'https://www.svt.se/nyheter/inrikes/video/abc': false,
  };
  for (const [url, on] of Object.entries(wanted)) {
    const page = boot(url);
    const site = page.resolveCaptionSite();
    eq(site && site.id, 'svt', `the site ${url} resolves to`);
    const p = page.capturePayload(url, '', '', cues(128), site.timeParam, site.timeLinkOn);
    eq(p.timeLink, on, `a link on ${url}`);
    eq(p.timeParam, 'position', `the name on ${url}`);
  }
});

// Arriving through a timed link leaves `t` on the address. Naming it is what
// stops that becoming a second identity for a video already captured.
check('YouTube names its parameter so the offset leaves its identity', () => {
  const url = 'https://www.youtube.com/watch?v=abcdefghijk&t=310s';
  const page = boot(url);
  const site = page.resolveCaptionSite();
  eq(site && site.id, 'youtube');
  const p = page.capturePayload(url, '', '', cues(128), site.timeParam, site.timeLinkOn);
  eq(p.url, 'https://www.youtube.com/watch?v=abcdefghijk', 'identity');
  eq(p.timeParam, 't');
});

// Configuration is fetched at runtime, so a site entry that throws is a thing
// to survive. No link is the answer that cannot be wrong — and the identity
// is still cleaned, because that part never depended on the answer.
check('a predicate that throws costs the link, not the send or the identity', () => {
  const page = boot(`${SVT}?position=750`);
  const boom = () => { throw new Error('bad config'); };
  const p = page.capturePayload(`${SVT}?position=750`, 't', 'sv', cues(128),
                                'position', boom);
  eq(p.url, SVT, 'identity is still cleaned');
  eq(p.timeParam, 'position', 'and still named');
  eq(p.timeLink, false, 'only the link is refused');
  eq(p.lines.length, 1, 'the lines still go');
});

// An offset cannot be taken off an address without knowing what it is called,
// so an entry that names nothing usable leaves the address as it stands.
check('a name that is not a name leaves the address alone', () => {
  const page = boot(SVT);
  for (const odd of [null, 17, {}, () => 'position']) {
    const p = page.capturePayload(`${SVT}?position=9`, '', '', cues(128), odd);
    eq(p.timeParam, '', `a timeParam of ${String(odd)}`);
    eq(p.url, `${SVT}?position=9`, 'nothing to strip when nothing is named');
  }
});

check('a name is read past the spaces around it', () => {
  const page = boot(SVT);
  const p = page.capturePayload(`${SVT}?position=9`, '', '', cues(128), '  position  ');
  eq(p.timeParam, 'position');
  eq(p.url, SVT, 'identity');
});

// A player with no deep link is honest about it, which is what keeps a
// captured card from carrying a link that quietly starts at the top.
check('a player with no parameter sends the page unchanged', () => {
  const url = 'https://urplay.se/program/1?x=1';
  const page = boot(url);
  const site = page.resolveCaptionSite();
  eq(site && site.id, 'urplay');
  const p = page.capturePayload(url, '', '', cues(128), site.timeParam, site.timeLinkOn);
  eq(p.timeParam, '', 'urplay names no parameter');
  eq(p.url, url, 'so the page goes as it is');
});

let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`  ok   ${r.name}`);
  else { failed++; console.log(`  FAIL ${r.name}\n    ${String((r.err && r.err.message) || r.err).replace(/\n/g, '\n    ')}`); }
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
