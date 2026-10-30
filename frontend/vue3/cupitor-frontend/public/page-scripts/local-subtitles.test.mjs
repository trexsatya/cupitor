import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {JSDOM} = require(process.env.CUPITOR_JSDOM || 'jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const lines = [
  {start: 10, end: 12, text: 'Första meningen'},
  {start: 20, end: 24, text: 'Andra meningen'},
];
const track = 'https://open.spotify.com/track/first123';
const other = 'https://open.spotify.com/episode/next456';

function boot({spotify = true, bridge = true, cache, video = false, translate = false, prefs, home = false, early = false} = {}) {
  const html = spotify && home ? '' : spotify ? `<footer data-testid="now-playing-bar"><div data-testid="now-playing-widget">
    <a href="${track}">A track</a></div>
    <button data-testid="control-button-playpause" aria-label="Pause"></button>
    <span data-testid="playback-position">0:00</span><span data-testid="playback-duration">2:00</span>
    <input data-testid="playback-progressbar" type="range" min="0" max="120000" value="0"></footer>`
    : '<div id="movie_player"><video></video></div>';
  const dom = new JSDOM(`<html><head><title>A track</title></head><body>${html}</body></html>`, {
    url: spotify ? 'https://open.spotify.com/collection/tracks' : 'https://www.youtube.com/watch?v=abcdefghijk',
    runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const {window} = dom, doc = window.document;
  window.console = {log() {}, warn() {}, error() {}};
  const intervals = new Map(); let timer = 0;
  window.setInterval = fn => { intervals.set(++timer, fn); return timer; };
  window.clearInterval = id => intervals.delete(id);
  window.setTimeout = () => ++timer;
  const requests = [], captures = [], translations = [];
  if (bridge) window.LocalSubtitles = {postMessage: message => requests.push(JSON.parse(message))};
  window.CaptionCollector = {postMessage: message => captures.push(JSON.parse(message))};
  window.TranslateRequest = {postMessage: message => translations.push(JSON.parse(message))};
  if (translate) window.localStorage.setItem('cupSubPrefs', JSON.stringify({translationEnabled: true}));
  if (prefs) window.localStorage.setItem('cupSubPrefs', JSON.stringify(prefs));
  if (cache) window.sessionStorage.setItem('cupitorLocalSubtitles', cache);
  if (video && spotify) doc.body.appendChild(doc.createElement('audio'));
  const native = doc.querySelector('audio, video');
  let plays = 0;
  if (native) {
    native.play = () => { plays++; return Promise.resolve(); };
    native.pause = () => {};
  }
  const setTime = seconds => {
    if (!spotify) { native.currentTime = seconds; native.dispatchEvent(new window.Event('timeupdate')); return; }
    doc.querySelector('[data-testid="playback-position"]').textContent = Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
    doc.querySelector('input').value = seconds * 1000;
  };
  let seeks = 0, toggles = 0;
  if (spotify && !home) {
    doc.querySelector('input').addEventListener('input', e => { seeks++; setTime(Number(e.target.value) / 1000); });
    doc.querySelector('button').onclick = e => {
      toggles++;
      e.currentTarget.setAttribute('aria-label', e.currentTarget.getAttribute('aria-label') === 'Pause' ? 'Play' : 'Pause');
    };
  }
  const body = doc.body;
  if (early) body.remove();
  for (const name of ['20-caption-sidebar.js', '25-spotify-player.js', '30-caption-sites.js', '70-caption-capture.js']) {
    window.eval(fs.readFileSync((name === '20-caption-sidebar.js' ? path.join(here, '../language/caption-sidebar.js') : path.join(here, 'src', name)), 'utf8'));
  }
  if (early) {
    doc.documentElement.appendChild(body);
    doc.dispatchEvent(new window.Event('DOMContentLoaded'));
  }
  const tick = () => { for (const fn of intervals.values()) fn(); };
  tick();
  const click = act => doc.querySelector(`[data-act="${act}"]`).click();
  return {
    window, doc, native, requests, captures, translations, setTime, tick, click,
    rows: () => [...doc.querySelectorAll('.cup-sub-cue')],
    open() { click('open-srt'); return requests.at(-1)?.requestId; },
    result(payload = {}) { return window.__cupLocalSubtitlesResult({requestId: requests.at(-1)?.requestId, lang: 'sv', lines, ...payload}); },
    changeTrack(url) { doc.querySelector('[data-testid="now-playing-widget"] a').href = url; },
    get seeks() { return seeks; }, get plays() { return plays; }, get toggles() { return toggles; },
    close: () => window.close(),
  };
}

test('Spotify home exposes an SRT launcher before a track has rendered', () => {
  const p = boot({home: true});
  try {
    const toggle = p.doc.getElementById('cup-spotify-srt-toggle');
    assert.ok(toggle, 'SRT control is discoverable on Spotify home');
    toggle.click();
    assert.ok(p.doc.body.classList.contains('cup-sub-split'));
    assert.equal(p.doc.querySelector('[data-act="open-srt"]').disabled, true);
    assert.match(p.doc.querySelector('[data-r="notice"]').textContent, /track or episode/i);
    toggle.click(); p.tick();
    assert.equal(p.doc.body.classList.contains('cup-sub-split'), false);
  } finally { p.close(); }
});

test('an old app shows the reason local files are unavailable rather than hiding all guidance', () => {
  const p = boot({bridge: false, home: true});
  try {
    p.doc.getElementById('cup-spotify-srt-toggle').click();
    assert.match(p.doc.querySelector('[data-r="notice"]').textContent, /update.*Cupitor/i);
  } finally { p.close(); }
});

test('Open SRT becomes available when the Spotify player renders after opening the panel', () => {
  const p = boot({home: true});
  try {
    p.doc.getElementById('cup-spotify-srt-toggle').click();
    assert.equal(p.doc.querySelector('[data-act="open-srt"]').disabled, true);
    p.doc.body.insertAdjacentHTML('beforeend', `<footer data-testid="now-playing-bar"><div data-testid="now-playing-widget"><a href="${track}">Track</a></div><span data-testid="playback-position">0:00</span><span data-testid="playback-duration">2:00</span><input data-testid="playback-progressbar" type="range" min="0" max="120000" value="0"></footer>`);
    p.tick();
    assert.equal(p.doc.querySelector('[data-act="open-srt"]').disabled, false);
    assert.equal(p.doc.querySelector('[data-r="notice"]').hidden, true);
    p.open(); p.tick();
    assert.equal(p.doc.querySelector('[data-act="open-srt"]').disabled, true, 'discovery cannot enable a busy picker');
    assert.equal(p.result(), true);
  } finally { p.close(); }
});

test('Spotify injection before the body exists waits for DOM readiness and installs once', () => {
  const p = boot({early: true});
  try {
    assert.equal(p.doc.querySelectorAll('#cup-spotify-srt-toggle').length, 1);
    p.open(); assert.equal(p.result(), true);
    assert.equal(p.rows().length, 2);
    p.doc.dispatchEvent(new p.window.Event('DOMContentLoaded')); p.tick();
    assert.equal(p.doc.querySelectorAll('.cup-sub-sidebar').length, 1);
    assert.equal(p.rows().length, 2);
  } finally { p.close(); }
});

test('closing Spotify split view stays closed on the next discovery tick', () => {
  const p = boot();
  try {
    p.click('split'); p.tick();
    assert.equal(p.doc.body.classList.contains('cup-sub-split'), false);
    p.doc.getElementById('cup-spotify-srt-toggle').click();
    assert.equal(p.doc.body.classList.contains('cup-sub-split'), true);
  } finally { p.close(); }
});

test('Open SRT invokes the native picker once; absent bridges hide the button', () => {
  const p = boot(), old = boot({bridge: false});
  try {
    assert.ok(p.doc.querySelector('.cup-sub-sidebar'), 'Spotify panel exists without a video element');
    p.open(); p.open();
    assert.equal(p.requests.length, 1);
    assert.equal(p.requests[0].op, 'open');
    assert.equal(p.requests[0].lang, 'sv');
    assert.equal(p.doc.querySelector('[data-act="open-srt"]').disabled, true);
    assert.equal(old.doc.querySelector('[data-act="open-srt"]').style.display, 'none');
    assert.equal(p.doc.querySelector('[data-act="download"]').style.display, 'none');
    p.result({cancelled: true});
    assert.equal(p.doc.querySelector('[data-act="open-srt"]').disabled, false);
  } finally { p.close(); old.close(); }
});

test('local tracks load without playing or seeking and follow Spotify time, seek and cue controls', () => {
  const p = boot();
  try {
    p.open(); assert.equal(p.result({lines: [lines[1], lines[0], lines[0]]}), true);
    assert.deepEqual(p.rows().map(row => Number(row.dataset.start)), [10, 20]);
    assert.equal(p.seeks, 0); assert.equal(p.toggles, 0);
    p.setTime(11); p.tick();
    assert.ok(p.rows()[0].classList.contains('cup-active'));
    p.rows()[1].querySelector('.cup-sub-time').click();
    assert.equal(p.doc.querySelector('input').value, '20000');
    p.click('prev'); assert.equal(p.doc.querySelector('input').value, '10000');
    p.click('next'); assert.equal(p.doc.querySelector('input').value, '20000');
    p.setTime(30); p.tick();
    assert.equal(p.rows().some(row => row.classList.contains('cup-active')), false);
  } finally { p.close(); }
});

test('Spotify browsing keeps the playing track; next track clears before the new clock is used', () => {
  const p = boot();
  try {
    p.open(); p.result();
    p.window.history.pushState({}, '', '/search/something'); p.tick();
    assert.equal(p.rows().length, 2);
    p.open(); p.changeTrack(other); p.setTime(0); p.tick();
    assert.equal(p.rows().length, 0);
    assert.equal(p.result(), false, 'file chosen for previous track is rejected');
    p.open(); assert.equal(p.result(), true);
    p.changeTrack(track); p.tick();
    assert.equal(p.rows().length, 2, 'returning restores the previous track');
  } finally { p.close(); }
});

test('cancellation, bad files and mismatched request ids preserve the existing transcript', () => {
  const p = boot();
  try {
    p.open(); p.result();
    p.open(); assert.equal(p.result({requestId: 'unrelated'}), false);
    assert.equal(p.doc.querySelector('[data-act="open-srt"]').disabled, true);
    assert.equal(p.result({cancelled: true}), true);
    assert.equal(p.rows().length, 2);
    p.open(); assert.equal(p.result({lines: [{start: 2, end: 1, text: 'bad'}]}), false);
    assert.equal(p.rows().length, 2);
  } finally { p.close(); }
});

test('local transcripts restore after reload and clear removes them from the tab cache', () => {
  const p = boot(); let restored;
  try {
    p.open(); p.result();
    restored = boot({cache: p.window.sessionStorage.getItem('cupitorLocalSubtitles')});
    assert.equal(restored.rows().length, 2);
    restored.click('clear'); restored.tick();
    assert.equal(restored.rows().length, 0);
    assert.deepEqual(JSON.parse(restored.window.sessionStorage.getItem('cupitorLocalSubtitles')), []);
  } finally { p.close(); restored?.close(); }
});

test('local YouTube SRT uses the native video clock and cannot mix with harvested tracks', () => {
  const p = boot({spotify: false});
  try {
    p.open(); assert.equal(p.result(), true);
    p.setTime(11);
    assert.ok(p.rows()[0].classList.contains('cup-active'));
    p.rows()[1].querySelector('.cup-sub-time').click();
    assert.equal(p.native.currentTime, 20);
    assert.equal(p.plays, 1);
    p.window.__cupImportYouTubeSubtitles({videoId: 'abcdefghijk', lang: 'sv', lines: [lines[0]]});
    assert.equal(p.rows().length, 1);
    assert.deepEqual(JSON.parse(p.window.sessionStorage.getItem('cupitorLocalSubtitles')), []);
  } finally { p.close(); }
});

test('Spotify translation and selected lines retain the track URL while browsing elsewhere', () => {
  const p = boot({translate: true});
  try {
    p.open(); p.result({lang: 'de'});
    assert.equal(p.translations.at(-1).source, 'de');
    p.click('pick'); p.rows()[0].click(); p.click('send');
    assert.equal(p.captures[0].url, track);
    assert.equal(p.captures[0].lang, 'de');
    assert.equal(p.captures[0].timeParam, 't');
    assert.equal(p.captures[0].timeLink, false, 'music tracks have no supported timestamp link');
    assert.deepEqual(p.captures[0].lines, [lines[0]]);
  } finally { p.close(); }
});

test('captured Spotify episode cues carry timestamp metadata while browsing another track', () => {
  const p = boot();
  const episode = 'https://open.spotify.com/episode/317TI86OHwkAxLtwi1VnXN';
  const cues = [
    {start: 12.52, end: 14.16, text: 'En podcastmening'},
    {start: 20.8, end: 24.1, text: 'En annan mening'},
  ];
  try {
    p.changeTrack(episode + '?t=400&si=shared'); p.tick();
    p.open(); assert.equal(p.result({lines: cues}), true);
    p.window.history.pushState({}, '', '/track/browsed456'); p.tick();
    p.click('pick'); p.rows()[1].click(); p.rows()[0].click(); p.click('send');
    assert.equal(p.captures.length, 1);
    const capture = p.captures[0];
    assert.equal(capture.url, episode, 'the playing episode has a stable identity');
    assert.equal(capture.timeParam, 't');
    assert.equal(capture.timeLink, true);
    assert.deepEqual(capture.lines, cues, 'fractional cue times survive selection and sending');
  } finally { p.close(); }
});

test('browsing a Spotify episode does not enable timestamp links for a playing music track', () => {
  const p = boot();
  try {
    p.open(); p.result();
    p.window.history.pushState({}, '', '/episode/317TI86OHwkAxLtwi1VnXN'); p.tick();
    p.click('pick'); p.rows()[0].click(); p.click('send');
    assert.equal(p.captures[0].url, track);
    assert.equal(p.captures[0].timeLink, false);
    assert.deepEqual(p.captures[0].lines, [lines[0]]);
  } finally { p.close(); }
});

test('Spotify adapter controls pause and resume and follows an ARIA progress bar without a text clock', async () => {
  const p = boot();
  try {
    const player = p.window.__cupShared.createSpotifyPlayer();
    assert.equal(player.paused, false);
    player.pause(); assert.equal(player.paused, true);
    await player.play(); assert.equal(player.paused, false);
    assert.equal(p.toggles, 2);
    p.doc.querySelector('[data-testid="playback-position"]').remove();
    p.doc.querySelector('input').outerHTML = '<div data-testid="playback-progressbar" role="slider" aria-valuemin="0" aria-valuemax="120000" aria-valuenow="30000"></div>';
    const bar = p.doc.querySelector('[role="slider"]');
    bar.getBoundingClientRect = () => ({left: 10, top: 5, width: 200, height: 10});
    let seekX;
    bar.addEventListener('mousedown', e => { seekX = e.clientX; });
    assert.equal(player.currentTime, 30);
    player.currentTime = 60;
    assert.equal(seekX, 110);
  } finally { p.close(); }
});

test('Spotify nested timeline slider seeks inside its wrapper and retains fractional cue times', () => {
  const p = boot();
  try {
    const input = p.doc.querySelector('input');
    const wrapper = p.doc.createElement('div');
    wrapper.dataset.testid = 'playback-progressbar';
    input.replaceWith(wrapper); wrapper.appendChild(input);
    input.removeAttribute('data-testid');
    input.step = '1';
    p.open(); p.result({lines: [
      {start: 12.52, end: 14.16, text: 'First timed line'},
      {start: 14.42, end: 17.96, text: 'Second timed line'},
    ]});
    p.setTime(12.6); p.tick();
    assert.ok(p.rows()[0].classList.contains('cup-active'), 'fractional slider time wins over rounded 0:12 text');
    p.rows()[1].querySelector('.cup-sub-time').click();
    assert.equal(Number(input.value), 14420);
    assert.equal(p.seeks, 1);
  } finally { p.close(); }
});

test('Spotify fractional timeline positions are available when the duration label is loading', () => {
  const p = boot();
  try {
    const input = p.doc.querySelector('input');
    p.doc.querySelector('[data-testid="playback-duration"]').textContent = '-:--';
    input.setAttribute('aria-valuetext', '0:12 of 2:00');
    const player = p.window.__cupShared.createSpotifyPlayer();
    p.setTime(12.6);
    assert.equal(player.currentTime, 12.6);
    assert.equal(player.duration, 120);
  } finally { p.close(); }
});

test('local subtitle text is never interpreted as HTML', () => {
  const p = boot();
  try {
    p.open(); p.result({lines: [{start: 0, end: 2, text: '<img src=x onerror="window.injected=true">'}]});
    assert.equal(p.doc.querySelector('.cup-sub-list img'), null);
    assert.equal(p.window.injected, undefined);
  } finally { p.close(); }
});

test('Spotify replay delivers every pause/play and advances to the following chunk', () => {
  const p = boot({prefs: {strategy: 3, linesPerChunk: 1}});
  try {
    let now = 10000; p.window.Date.now = () => now;
    p.open(); p.result(); p.setTime(10); p.tick();
    assert.equal(p.toggles, 2, 'pause and resume around the first replay');
    assert.equal(p.seeks, 1);
    now += 600; p.setTime(13); p.tick();
    now += 600; p.setTime(20); p.tick();
    assert.equal(p.toggles, 4, 'second replay is not mistaken for a user pause');
    assert.equal(p.seeks, 2);
  } finally { p.close(); }
});

test('a new Spotify track paused by the user is not started when an old replay is cleared', () => {
  const p = boot({prefs: {strategy: 3, linesPerChunk: 1, translationEnabled: true}});
  try {
    p.open(); p.result(); p.setTime(10); p.tick();
    assert.equal(p.toggles, 1, 'waiting for translation paused the old track');
    p.changeTrack(other); p.setTime(0); p.tick();
    assert.equal(p.toggles, 1, 'clearing the old replay leaves the new track alone');
    assert.equal(p.seeks, 0);
    assert.equal(p.rows().length, 0);
  } finally { p.close(); }
});
