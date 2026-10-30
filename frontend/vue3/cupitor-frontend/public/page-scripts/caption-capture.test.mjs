// Caption capture (src/70-caption-capture.js) against an SVT watch page.
//
// The DOM mirror is the caption path that reads the cue a player paints on
// screen, for players whose subtitles never reach a text track or a WEBVTT
// download. Its contract: one painted cue is one row, whatever else on the page does to
// that cue's markup afterwards. The app's word wrapper (assets/js/utils.js in
// the Cupitor app) turns every word on the page into a tappable
// <span class="clickable-word"> — the player's subtitle overlay included — a
// moment after the player paints it. That is the same cue, not a new one, and
// the sidebar must not grow a second row for it.
//
// jsdom is taken from a checkout beside this repo, or from $CUPITOR_JSDOM:
//
// The list belongs to one video. A player that moves on to the next episode
// without a page load (SVT's autoplay) starts a new timeline, and lines from
// the episode before must not sit among the new one's. The address changing
// only in its start offset or its #fragment is the same video.
//
//   node db/js/caption-capture.test.mjs
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
const CAPTURE = src('70-caption-capture.js');

const SVT = 'https://www.svtplay.se/video/abc123/en-serie';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// An SVT watch page with the player's subtitle overlay, as SVT marks it up.
// The overlay markup per player, as each one paints it.
const PLAYERS = {
  svt: `<div data-rt="video-player-fullscreen"><video></video>
      <div data-rt="subtitles-container"><div class="vtt-cue-teletext"></div></div></div>`,
  youtube: `<div id="movie_player" class="html5-video-player"><video></video>
      <div class="ytp-caption-window-container"><span class="ytp-caption-segment"></span></div></div>`,
};
const CUE = { svt: '.vtt-cue-teletext', youtube: '.ytp-caption-segment' };

function boot({ translate = false, url = SVT, player = 'svt' } = {}) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head><title>En serie</title></head><body>
    ${PLAYERS[player]}</body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true, url });
  const { window } = dom;
  window.console = { log() {}, warn() {}, error() {}, info() {} };
  // The app's translation channel: requests are kept so a test can answer
  // them whenever it likes, as the app does, through __cupTranslated.
  const trRequests = [];
  if (translate) {
    window.localStorage.setItem('cupSubPrefs', JSON.stringify({ translationEnabled: true }));
    window.TranslateRequest = { postMessage: (m) => trRequests.push(JSON.parse(m)) };
  }
  window.eval(SIDEBAR);
  window.eval(SITES);
  window.eval(CAPTURE);
  const doc = window.document;
  const cueEl = doc.querySelector(CUE[player]);
  return {
    window,
    trRequests,
    // What SVT's player does when it moves on: a new address, no page load.
    navigate(url) { window.history.pushState({}, '', url); },
    // The playhead, which jsdom's <video> does not move by itself.
    setTime(t) {
      Object.defineProperty(doc.querySelector('video'), 'currentTime', { value: t, writable: true, configurable: true });
    },
    clickClear() { doc.querySelector('[data-act="clear"]').click(); },
    // What SVT does: one <span> per line (or bare text for a plain cue).
    paint(lines, { bare = false } = {}) {
      cueEl.innerHTML = bare ? lines.join(' ') : lines.map(l => `<span>${l}</span>`).join('');
    },
    // What the app's word wrapper does to whatever text is on the page.
    wrapWords() {
      const walker = doc.createTreeWalker(cueEl, window.NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const n of nodes) {
        const frag = doc.createDocumentFragment();
        for (const part of n.nodeValue.split(/(\p{L}+)/u)) {
          if (!part) continue;
          if (/^\p{L}+$/u.test(part)) {
            const s = doc.createElement('span');
            s.className = 'clickable-word';
            s.dataset.word = part;
            s.textContent = part;
            frag.appendChild(s);
          } else frag.appendChild(doc.createTextNode(part));
        }
        n.parentNode.replaceChild(frag, n);
      }
    },
    rows() {
      return [...doc.querySelectorAll('.cup-sub-cue .cup-sub-text')]
        .map(el => el.firstChild ? [...el.childNodes].filter(c => !(c.classList && c.classList.contains('cup-sub-tr'))).map(c => c.textContent).join('') : '')
        .map(t => t.trim());
    },
    close() { window.close(); },
  };
}

const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, err: e }); }
}
function eq(actual, expected, what) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what || 'value'}\n    expected: ${e}\n    actual:   ${a}`);
}

// The mirror polls every 300 ms and the sidebar is built on a 1 s tick, so
// each step waits long enough for both.
const TICK = 450;

await check('a two-line cue stays one row after its words are wrapped', async () => {
  const p = boot();
  try {
    p.paint(['Så klart hon har.', 'Kul att man är bjuden, som vanligt.']);
    await sleep(TICK);
    p.wrapWords();
    await sleep(1200);
    eq(p.rows(), ['Så klart hon har.\nKul att man är bjuden, som vanligt.'], 'rows');
  } finally { p.close(); }
});

await check('a one-line cue stays one row after its words are wrapped', async () => {
  const p = boot();
  try {
    p.paint(['Det måste ha blivit nåt missförstånd.']);
    await sleep(TICK);
    p.wrapWords();
    await sleep(1200);
    eq(p.rows(), ['Det måste ha blivit nåt missförstånd.'], 'rows');
  } finally { p.close(); }
});

await check('a bare-text cue stays one row after its words are wrapped', async () => {
  const p = boot();
  try {
    p.paint(['Vilken middag?'], { bare: true });
    await sleep(TICK);
    p.wrapWords();
    await sleep(1200);
    eq(p.rows(), ['Vilken middag?'], 'rows');
  } finally { p.close(); }
});

await check('a cue first seen already wrapped reads as its lines', async () => {
  const p = boot();
  try {
    p.paint(['Ina har styrt upp nåt.', 'Okej.']);
    p.wrapWords();
    await sleep(1200);
    eq(p.rows(), ['Ina har styrt upp nåt.\nOkej.'], 'rows');
  } finally { p.close(); }
});

await check('two different cues in a row are two rows', async () => {
  const p = boot();
  try {
    p.paint(['Vilken middag?']);
    await sleep(TICK);
    p.wrapWords();
    await sleep(TICK);
    p.paint(['Du har väl inte glömt att pappa fyller 60?']);
    await sleep(TICK);
    p.wrapWords();
    await sleep(1200);
    eq(p.rows(), ['Vilken middag?', 'Du har väl inte glömt att pappa fyller 60?'], 'rows');
  } finally { p.close(); }
});

await check('the next episode starts an empty list', async () => {
  const p = boot();
  try {
    p.paint(['Vilken middag?']);
    await sleep(1200);
    eq(p.rows(), ['Vilken middag?'], 'episode 1');
    p.navigate('https://www.svtplay.se/video/def456/en-serie/2-nasta');
    await sleep(1200);
    eq(p.rows(), [], 'right after the switch');
    p.paint(['Men, du... Det blev ju jättedumt sist.']);
    await sleep(1200);
    eq(p.rows(), ['Men, du... Det blev ju jättedumt sist.'], 'episode 2');
  } finally { p.close(); }
});

await check('the start offset moving in the address keeps the list', async () => {
  const p = boot();
  try {
    p.paint(['Vilken middag?']);
    await sleep(1200);
    p.navigate(SVT + '?position=128');
    await sleep(1200);
    p.navigate(SVT + '?position=140');
    await sleep(1200);
    eq(p.rows(), ['Vilken middag?'], 'rows');
  } finally { p.close(); }
});

await check('a #fragment change keeps the list', async () => {
  const p = boot();
  try {
    p.paint(['Vilken middag?']);
    await sleep(1200);
    p.navigate(SVT + '#kapitel-2');
    await sleep(1200);
    eq(p.rows(), ['Vilken middag?'], 'rows');
  } finally { p.close(); }
});

await check('other query parameters changing keep the list', async () => {
  const p = boot();
  try {
    p.paint(['Vilken middag?']);
    await sleep(1200);
    p.navigate(SVT + '?start=auto&utm=x');
    await sleep(1200);
    eq(p.rows(), ['Vilken middag?'], 'rows');
  } finally { p.close(); }
});

await check('the next episode keeps a first line that reads like the last one', async () => {
  const p = boot();
  try {
    p.paint(['Okej.']);
    await sleep(1200);
    p.navigate('https://www.svtplay.se/video/def456/en-serie/2-nasta');
    p.paint([]);
    await sleep(1200);
    p.paint(['Okej.']);
    await sleep(1200);
    eq(p.rows(), ['Okej.'], 'the new episode\'s line');
  } finally { p.close(); }
});

// A player's subtitle track, as the page sees it: jsdom has none, so the
// <video> gets a stand-in with the parts the capture reads.
function fakeTrack(p) {
  const cues = [];
  const track = { kind: 'captions', language: 'sv', mode: 'showing', cues, addEventListener() {} };
  const list = [track];
  Object.defineProperty(p.window.document.querySelector('video'), 'textTracks', { value: list });
  return {
    add(start, end, text) { cues.push({ startTime: start, endTime: end, text }); },
    replaceAll() { cues.length = 0; },
  };
}

await check('the episode before does not come back from a track still attached', async () => {
  const p = boot();
  try {
    const track = fakeTrack(p);
    track.add(1696.28, 1700.08, 'Textning: Iyuno för SVT');
    await sleep(1200);
    eq(p.rows(), ['Textning: Iyuno för SVT'], 'episode 1');
    // SVT changes the address first and swaps the track a moment later.
    p.navigate('https://www.svtplay.se/video/def456/en-serie/2-nasta');
    await sleep(2200);
    eq(p.rows(), [], 'after the switch, old track still attached');
    // The player reuses the same track for the new episode.
    track.replaceAll();
    track.add(7.2, 9.0, 'Men, du... Det blev ju jättedumt sist.');
    await sleep(1200);
    eq(p.rows(), ['Men, du... Det blev ju jättedumt sist.'], 'episode 2');
  } finally { p.close(); }
});

await check('a track swapped in the same moment as the address keeps the new lines', async () => {
  const p = boot();
  try {
    const track = fakeTrack(p);
    track.add(1696.28, 1700.08, 'Textning: Iyuno för SVT');
    await sleep(1200);
    p.navigate('https://www.svtplay.se/video/def456/en-serie/2-nasta');
    track.replaceAll();
    track.add(7.2, 9.0, 'Men, du... Det blev ju jättedumt sist.');
    await sleep(2200);
    eq(p.rows(), ['Men, du... Det blev ju jättedumt sist.'], 'episode 2');
  } finally { p.close(); }
});

await check('a cue that blinks off and on again mid-line stays one row', async () => {
  const p = boot();
  try {
    p.setTime(100);
    p.paint(['Jag har jättemycket att göra här just nu, men ring Ina.']);
    await sleep(TICK);
    p.paint([]);
    await sleep(TICK);
    p.setTime(104.5);
    p.paint(['Jag har jättemycket att göra här just nu, men ring Ina.']);
    await sleep(1200);
    eq(p.rows(), ['Jag har jättemycket att göra här just nu, men ring Ina.'], 'rows');
  } finally { p.close(); }
});

const YT = 'https://www.youtube.com/watch?v=aaaaaaaaaaa';

await check('YouTube: another video starts an empty list', async () => {
  const p = boot({ url: YT, player: 'youtube' });
  try {
    p.paint(['Hej och välkommen.'], { bare: true });
    await sleep(1200);
    eq(p.rows(), ['Hej och välkommen.'], 'first video');
    p.navigate('https://www.youtube.com/watch?v=bbbbbbbbbbb');
    await sleep(1200);
    eq(p.rows(), [], 'after the switch');
  } finally { p.close(); }
});

await check('YouTube: the same video with t, list or pp added keeps the list', async () => {
  const p = boot({ url: YT, player: 'youtube' });
  try {
    p.paint(['Hej och välkommen.'], { bare: true });
    await sleep(1200);
    p.navigate(YT + '&t=30s');
    await sleep(1200);
    p.navigate(YT + '&list=PL1&index=2&pp=xyz');
    await sleep(1200);
    eq(p.rows(), ['Hej och välkommen.'], 'rows');
  } finally { p.close(); }
});

// A translation is answered later, by the app, and lands on the row the
// request was made for. A row from the episode before must not hand its
// answer to whatever row took its place.
async function lateTranslation(startOver) {
  const p = boot({ translate: true });
  try {
    p.paint(['Vilken middag?']);
    await sleep(1200);
    eq(p.trRequests.length, 1, 'one request for the first line');
    const stale = p.trRequests[0].id;
    await startOver(p);
    p.paint(['Ja, det var dumt.']);
    await sleep(1200);
    p.window.__cupTranslated(stale, 'What dinner?');
    const tr = p.window.document.querySelector('.cup-sub-cue .cup-sub-tr');
    eq(p.rows(), ['Ja, det var dumt.'], 'rows');
    // Its own request may still be pending ("…"); what it must never show is
    // the answer meant for the line before.
    if (tr && tr.textContent.includes('What dinner?')) {
      throw new Error('the new line shows the earlier line\'s translation: ' + JSON.stringify(tr.textContent));
    }
  } finally { p.close(); }
}

await check('a late translation from the episode before lands nowhere', () =>
  lateTranslation(async (p) => {
    p.navigate('https://www.svtplay.se/video/def456/en-serie/2-nasta');
    await sleep(1200);
  }));

await check('a late translation after the clear button lands nowhere', () =>
  lateTranslation(async (p) => { p.clickClear(); }));

let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`  ok   ${r.name}`);
  else { failed++; console.log(`  FAIL ${r.name}\n    ${String((r.err && r.err.message) || r.err).replace(/\n/g, '\n    ')}`); }
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
