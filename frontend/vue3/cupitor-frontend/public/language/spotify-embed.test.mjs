import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import test from 'node:test';
import {createSpotifyStudyPlayer} from './spotify-player.js';

const require = createRequire(import.meta.url);
const {JSDOM} = require(process.env.CUPITOR_JSDOM || 'jsdom');
const id = '317TI86OHwkAxLtwi1VnXN', otherId = '7makk4oTQel546B0PZlDM5';
const item = (start = 12.52, end = 14.16, episode = id) => ({manual: true,
  mediaUrl: 'https://open.spotify.com/episode/' + episode,
  captionUrl: 'https://open.spotify.com/episode/' + episode,
  captionStarts: [start], captionEnds: [end]});

function fixture({nativeBridge = false} = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="mediaContainer"></div><div id="practiceMode"><button class="practice-play">▶</button></div></body></html>', {runScripts: 'outside-only'});
  const {window: win} = dom, calls = [], packets = [], listeners = new Map();
  let iframe;
  win.PlaylistBridge = {postMessage: value => packets.push(['playlist', value])};
  if (nativeBridge) win.SpotifyClipBridge = {postMessage: value => packets.push(['native', value])};
  const controller = {
    addListener(name, callback) {listeners.set(name, callback);},
    seek(time) {calls.push(['seek', time]);},
    play() {calls.push(['play']);}, pause() {calls.push(['pause']);},
    loadEntity(uri, video, start) {calls.push(['load', uri, video, start]);},
  };
  const api = {createController(mount, options, callback) {
    calls.push(['create', options]);
    iframe = win.document.createElement('iframe');
    mount.replaceWith(iframe); callback(controller);
  }};
  const player = createSpotifyStudyPlayer({win, isForeground: () => true});
  const flush = async () => {for (let i = 0; i < 8; i++) await Promise.resolve();};
  const emit = (name, data = {}) => listeners.get(name)?.({data});
  const state = (position, isPaused = true, episode = id) => emit('playback_update', {
    playingURI: 'spotify:episode:' + episode, position: position * 1000,
    duration: 3307760, isPaused, isBuffering: false,
  });
  return {win, player, calls, packets, flush, emit, state,
    readyApi() {win.onSpotifyIframeApiReady(api);},
    get iframe() {return iframe;},
    close() {player.stop(); win.close();},
  };
}

for (const nativeBridge of [false, true]) {
  test(`Cupitor uses the iframe SDK with ${nativeBridge ? 'both native bridges' : 'its existing playlist bridge'}`, async () => {
    const f = fixture({nativeBridge});
    try {
      const done = f.player.playCard(item());
      assert.equal(f.win.document.querySelector('script').src, 'https://open.spotify.com/embed/iframe-api/v1');
      f.readyApi(); await f.flush(); f.emit('ready');
      assert.equal(f.win.document.querySelectorAll('iframe').length, 1);
      assert.deepEqual(f.calls.find(call => call[0] === 'load'), ['load', 'spotify:episode:' + id, false, 12.52]);
      assert.deepEqual(f.calls.at(-1), ['seek', 12.52]);
      f.state(0); assert.equal(f.calls.some(call => call[0] === 'play'), false);
      f.state(12.52); assert.deepEqual(f.calls.at(-1), ['play']);
      f.state(12.6, false); f.state(14.16, false);
      assert.equal(await done, true); assert.deepEqual(f.calls.at(-1), ['pause']);
      assert.deepEqual(f.packets, []);
    } finally {f.close();}
  });
}

test('changing episodes reuses the same embedded player and loads the next saved start', async () => {
  const f = fixture();
  try {
    const first = f.player.playCard(item()); f.readyApi(); await f.flush(); f.emit('ready');
    f.state(12.52); f.state(12.6, false); f.state(14.16, false); await first;
    const iframe = f.iframe;
    const second = f.player.playCard(item(30, 32, otherId)); await f.flush();
    assert.equal(f.iframe, iframe); assert.equal(f.calls.filter(call => call[0] === 'create').length, 1);
    assert.deepEqual(f.calls.at(-1), ['load', 'spotify:episode:' + otherId, false, 30]);
    f.emit('ready'); f.state(30, true, otherId); f.state(30.1, false, otherId); f.state(32, false, otherId);
    assert.equal(await second, true);
  } finally {f.close();}
});

test('Show Spotify focuses the embedded Practice player without starting playback or opening a page', async () => {
  const f = fixture(); let opened = false;
  f.win.open = () => {opened = true;};
  try {
    const card = item(); f.player.cue(card); f.readyApi(); await f.flush(); f.emit('ready'); f.state(12.52);
    f.player.show();
    assert.equal(f.win.document.activeElement, f.iframe);
    assert.equal(f.calls.some(call => call[0] === 'play'), false); assert.equal(opened, false);
    f.player.togglePractice(card); assert.deepEqual(f.calls.at(-1), ['play']);
    f.state(12.6, false); f.state(14.16, false); assert.equal(f.player.media.ended, true);
    f.player.togglePractice(card); await f.flush(); assert.deepEqual(f.calls.at(-1), ['seek', 12.52]);
  } finally {f.close();}
});

test('Stop pauses the iframe without a pause-event feedback loop and rejects late playback', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item()); f.readyApi(); await f.flush(); f.emit('ready'); f.state(12.52);
    f.player.stop(); assert.equal(await done, false);
    const paused = f.calls.filter(call => call[0] === 'pause').length;
    f.state(12.52); assert.equal(f.calls.filter(call => call[0] === 'pause').length, paused);
    f.state(12.6, false); assert.equal(f.calls.filter(call => call[0] === 'pause').length, paused + 1);
    assert.equal(f.win.document.body.classList.contains('study-spotify'), false);
  } finally {f.close();}
});

test('leaving while the SDK loads prevents the canceled clip from starting', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item()); f.player.stop();
    f.readyApi(); await f.flush(); f.emit('ready'); f.state(12.52);
    assert.equal(await done, false); assert.equal(f.calls.some(call => call[0] === 'play'), false);
    assert.equal(f.win.document.body.classList.contains('study-spotify'), false);
  } finally {f.close();}
});
