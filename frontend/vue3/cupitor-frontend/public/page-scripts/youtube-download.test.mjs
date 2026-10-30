import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {JSDOM} = require(process.env.CUPITOR_JSDOM || 'jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const source = name => fs.readFileSync((name === '20-caption-sidebar.js' ? path.join(here, '../language/caption-sidebar.js') : path.join(here, 'src', name)), 'utf8');
const id = 'abcdefghijk';
const otherId = 'lmnopqrstuv';
const url = video => `https://www.youtube.com/watch?v=${video}`;
const lines = [
  {start: 10, end: 12, text: 'Första meningen'},
  {start: 20, end: 24, text: 'Andra meningen'},
];

function boot({bridge = true, translate = false, storage, address = url(id), requireTrustedHTML = false} = {}) {
  const dom = new JSDOM('<html><head><title>A video</title></head><body><div id="movie_player"><video></video><div class="ytp-caption-window-container"><span class="ytp-caption-segment"></span></div></div></body></html>', {
    url: address, runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const {window} = dom;
  const innerHTML = Object.getOwnPropertyDescriptor(window.Element.prototype, 'innerHTML');
  // Model YouTube's require-trusted-types-for 'script' CSP. Browser coverage
  // also enforces it through a real response header.
  if (requireTrustedHTML) {
    Object.defineProperty(window.Element.prototype, 'innerHTML', {
      ...innerHTML, set() { throw new TypeError('This document requires TrustedHTML assignment'); },
    });
  }
  window.console = {log() {}, warn() {}, error() {}, info() {}};
  const intervals = new Map();
  let timer = 0;
  window.setInterval = fn => { intervals.set(++timer, fn); return timer; };
  window.clearInterval = id => intervals.delete(id);
  window.setTimeout = () => ++timer;
  const requests = [], captures = [], translations = [];
  if (bridge) window.YouTubeSubtitles = {postMessage: message => requests.push(JSON.parse(message))};
  window.CaptionCollector = {postMessage: message => captures.push(JSON.parse(message))};
  window.TranslateRequest = {postMessage: message => translations.push(JSON.parse(message))};
  if (translate) window.localStorage.setItem('cupSubPrefs', JSON.stringify({translationEnabled: true}));
  if (storage) window.sessionStorage.setItem('cupitorDownloadedYouTubeSubtitles', storage);
  const video = window.document.querySelector('video');
  let plays = 0;
  video.play = () => { plays++; return Promise.resolve(); };
  video.pause = () => {};
  window.eval(source('20-caption-sidebar.js'));
  window.eval(source('30-caption-sites.js'));
  window.eval(source('70-caption-capture.js'));
  const tick = () => { for (const fn of intervals.values()) fn(); };
  tick();
  const result = {
    window, video, requests, captures, translations, tick,
    import: (track = {}) => window.__cupImportYouTubeSubtitles({videoId: id, lang: 'sv', lines, ...track}),
    rows: () => [...window.document.querySelectorAll('.cup-sub-cue')],
    click: act => window.document.querySelector(`[data-act="${act}"]`).click(),
    navigate: video => window.history.pushState({}, '', url(video)),
    get plays() { return plays; },
    close: () => {
      Object.defineProperty(window.Element.prototype, 'innerHTML', innerHTML);
      window.close();
    },
  };
  return result;
}

test('YouTube download button invokes the native flow; older app versions hide it', () => {
  const p = boot();
  const old = boot({bridge: false});
  try {
    assert.notEqual(p.window.document.querySelector('[data-act="download"]').style.display, 'none');
    p.click('download');
    assert.deepEqual(p.requests, [{op: 'download'}]);
    assert.equal(old.window.document.querySelector('[data-act="download"]').style.display, 'none');
  } finally { p.close(); old.close(); }
});

test('SRT opens, imports, translates, captures and clears without HTML injection sinks', () => {
  const p = boot({address: 'https://m.youtube.com/watch?v=' + id, requireTrustedHTML: true});
  try {
    const button = p.window.document.getElementById('cup-youtube-srt-toggle');
    p.click('split');
    button.click();
    assert.equal(p.window.document.body.classList.contains('cup-sub-split'), true);
    p.click('download');
    assert.deepEqual(p.requests, [{op: 'download'}]);
    assert.equal(p.import(), true);
    assert.equal(p.rows().length, 2);
    p.click('translate');
    assert.ok(p.translations.length >= 2);
    p.window.__cupTranslated(p.translations[0].id, '<b>First</b>');
    assert.equal(p.window.document.querySelector('.cup-sub-tr').textContent, '<b>First</b>');
    assert.equal(p.window.document.querySelector('.cup-sub-tr b'), null);
    p.click('settings');
    p.window.document.querySelector('[data-f="source"]').value = 'de';
    p.window.document.querySelector('.cup-sub-modal [data-act="save"]').click();
    p.click('pick'); p.rows()[0].click(); p.click('send');
    assert.equal(p.captures.length, 1);
    p.click('clear');
    assert.equal(p.rows().length, 0);
  } finally { p.close(); }
});

test('mobile YouTube has a visible SRT capture launcher; closing stays closed until reopened', () => {
  const p = boot({address: 'https://m.youtube.com/watch?v=' + id});
  try {
    const button = p.window.document.getElementById('cup-youtube-srt-toggle');
    assert.equal(button.hidden, false);
    assert.match(button.textContent, /SRT.*Capture/);
    p.click('split');
    p.tick(); p.tick();
    assert.equal(p.window.document.body.classList.contains('cup-sub-split'), false);
    button.click();
    assert.equal(p.window.document.body.classList.contains('cup-sub-split'), true);
    assert.equal(p.window.__cupOpenSubtitlePanel(), true, 'native CC can reopen the same panel');
    p.click('download');
    assert.deepEqual(p.requests, [{op:'download'}]);
    p.window.history.pushState({}, '', '/');
    p.tick();
    assert.equal(button.hidden, true);
    assert.equal(p.window.__cupOpenSubtitlePanel(), false);
  } finally { p.close(); }
});

test('capture entry is available before the mobile video element renders', () => {
  const p = boot({address: 'https://m.youtube.com/watch?v=' + id});
  try {
    p.video.remove();
    p.tick();
    assert.equal(p.window.__cupOpenSubtitlePanel(), true);
    assert.equal(p.window.document.getElementById('cup-youtube-srt-toggle').hidden, false);
    p.click('download');
    assert.deepEqual(p.requests, [{op:'download'}]);
  } finally { p.close(); }
});

test('a full downloaded track replaces harvested lines once, sorted and deduplicated', () => {
  const p = boot();
  try {
    assert.equal(p.import({lines: [lines[1], lines[0], lines[0]]}), true);
    assert.equal(p.rows().length, 2);
    assert.deepEqual(p.rows().map(row => Number(row.dataset.start)), [10, 20]);
    assert.equal(p.video.currentTime, 0, 'import does not seek');
    assert.equal(p.plays, 0, 'import does not start playback');
    p.tick(); p.tick();
    assert.equal(p.rows().length, 2);
  } finally { p.close(); }
});

test('downloaded rows seek and follow the native YouTube video clock', () => {
  const p = boot();
  try {
    p.import();
    p.rows()[1].querySelector('.cup-sub-time').click();
    assert.equal(p.video.currentTime, 20);
    p.video.currentTime = 11;
    p.video.dispatchEvent(new p.window.Event('timeupdate'));
    assert.equal(p.rows()[0].classList.contains('cup-active'), true);
    p.click('next');
    assert.equal(p.video.currentTime, 20);
    p.click('prev');
    assert.equal(p.video.currentTime, 10);
  } finally { p.close(); }
});

test('track language is used for translation and selected timed lines use the existing capture bridge', () => {
  const p = boot({translate: true});
  try {
    p.import({lang: 'de'});
    assert.ok(p.translations.length >= 2);
    assert.equal(p.translations.at(-1).source, 'de');
    p.click('pick');
    p.rows()[1].click();
    p.click('send');
    assert.equal(p.captures.length, 1);
    assert.equal(p.captures[0].lang, 'de');
    assert.equal(p.captures[0].timeParam, 't');
    assert.deepEqual(p.captures[0].lines.map(({start, end, text}) => ({start, end, text})), [lines[1]]);
  } finally { p.close(); }
});

test('native YouTube painted captions do not duplicate a downloaded transcript', () => {
  const p = boot();
  try {
    p.import();
    p.window.document.querySelector('.ytp-caption-segment').textContent = 'A live duplicate';
    p.video.currentTime = 11;
    p.tick();
    assert.equal(p.rows().length, 2);
    assert.equal(p.rows().some(row => row.textContent.includes('live duplicate')), false);
  } finally { p.close(); }
});

test('late downloads for a previous video and invalid tracks do not overwrite the current transcript', () => {
  const p = boot();
  try {
    p.import();
    assert.equal(p.import({lines: [{start: -1, end: 2, text: 'bad'}]}), false);
    assert.equal(p.rows().length, 2);
    p.navigate(otherId); p.tick();
    assert.equal(p.rows().length, 0);
    assert.equal(p.import(), false);
    assert.equal(p.rows().length, 0);
    assert.equal(p.import({videoId: otherId}), true);
    assert.equal(p.rows().length, 2);
  } finally { p.close(); }
});

test('cached tracks are restored per video within the tab session and clear removes the saved track', () => {
  const p = boot();
  let restored;
  try {
    p.import();
    const storage = p.window.sessionStorage.getItem('cupitorDownloadedYouTubeSubtitles');
    restored = boot({storage});
    assert.equal(restored.rows().length, 2);
    p.navigate(otherId); p.tick();
    assert.equal(p.rows().length, 0);
    p.navigate(id); p.tick();
    assert.equal(p.rows().length, 2);
    p.click('clear');
    assert.equal(p.rows().length, 0);
    assert.equal(JSON.parse(p.window.sessionStorage.getItem('cupitorDownloadedYouTubeSubtitles')).length, 0);
  } finally { p.close(); restored?.close(); }
});

test('downloaded cues are rendered as text, not executable HTML', () => {
  const p = boot();
  try {
    p.import({lines: [{start: 0, end: 2, text: '<img src=x onerror="window.injected=true">'}]});
    assert.equal(p.window.document.querySelector('.cup-sub-list img'), null);
    assert.equal(p.window.injected, undefined);
  } finally { p.close(); }
});
