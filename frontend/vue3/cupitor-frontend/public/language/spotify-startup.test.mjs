import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import test from 'node:test';
import {createSpotifyStudyPlayer} from './spotify-player.js';

const require = createRequire(import.meta.url);
const {JSDOM} = require(process.env.CUPITOR_JSDOM || 'jsdom');
const uri = 'spotify:episode:1ITvLBQG5IMWcE4BD0V49f';
const url = 'https://open.spotify.com/episode/1ITvLBQG5IMWcE4BD0V49f';
const item = (start = 30, end = 41) => ({manual: true, mediaUrl: url,
  captionUrl: url, captionStarts: [start], captionEnds: [end]});

// Model the recording's important behavior: seeking the idle embed updates its
// displayed position, but its first Play starts the loaded entity's startAt.
// A fresh Play can restart it; Resume preserves a seek after activation.
function fixture() {
  const dom = new JSDOM('<!doctype html><body><div id="mediaContainer"></div><div id="practiceMode"><button class="practice-play">▶</button></div></body>', {runScripts: 'outside-only'});
  const {window: win} = dom, events = [], listeners = new Map(), calls = [];
  let position = 0, startAt = 0, paused = true, activated = false, clock = 0;
  const emit = (name, data = {}) => listeners.get(name)?.({data});
  function report() {
    const data = {position: position * 1000, duration: 2642000,
      isPaused: paused, isBuffering: false, playingURI: uri};
    events.push(() => emit('playback_update', data));
  }
  function start(restart) {
    if (restart || !activated) position = startAt;
    activated = true; paused = false; report();
  }
  const controller = {
    addListener(name, callback) {listeners.set(name, callback);},
    loadEntity(entity, video, start = 0) {
      calls.push(['load', entity, start]); startAt = start;
      position = 0; paused = true; activated = false;
      events.push(() => emit('ready'));
    },
    seek(time) {calls.push(['seek', time]); position = time; report();},
    pause() {calls.push(['pause']); if (!paused) {paused = true; report();}},
    play() {calls.push(['play']); start(true);},
    resume() {calls.push(['resume']); start(false);},
  };
  const api = {createController(mount, options, callback) {
    mount.replaceWith(win.document.createElement('iframe'));
    if (options.uri) controller.loadEntity(options.uri, false);
    callback(controller);
  }};
  const player = createSpotifyStudyPlayer({win, loadApi: () => Promise.resolve(api),
    isForeground: () => true, now: () => clock});
  async function flush() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
    for (let i = 0; events.length && i < 50; i++) events.shift()();
    assert.equal(events.length, 0, 'play/seek/pause must settle instead of repeating');
  }
  return {player, calls, flush, get position() {return position;}, get paused() {return paused;},
    embedPlay() {clock += 1000; start(false);},
    restartOutsideClip() {clock += 1000; position = 0; paused = false; activated = true; report();},
    progress(time) {assert.equal(paused, false); position = time; report();},
    close() {player.stop(); win.close();},
  };
}

test('the first embedded Play starts the Practice clip at 0:30 and keeps playing', async () => {
  const f = fixture();
  try {
    f.player.cue(item()); await f.flush();
    assert.equal(f.position, 30); assert.equal(f.paused, true);
    f.embedPlay(); await f.flush();
    assert.equal(f.position, 30); assert.equal(f.paused, false);
    f.progress(41); await f.flush();
    assert.equal(f.paused, true); assert.equal(f.player.media.ended, true);
  } finally {f.close();}
});

test('autoplay resumes the saved seek for another clip in the same episode', async () => {
  const f = fixture();
  try {
    const first = f.player.playCard(item(30, 31)); await f.flush();
    assert.equal(f.position, 30); assert.equal(f.paused, false);
    f.progress(31); await f.flush(); assert.equal(await first, true);
    const next = f.player.playCard(item(90, 92)); await f.flush();
    assert.equal(f.position, 90); assert.equal(f.paused, false);
    f.progress(92); await f.flush(); assert.equal(await next, true);
  } finally {f.close();}
});

test('a manual embedded Play outside the cue resumes after correcting the timestamp', async () => {
  const f = fixture();
  try {
    f.player.cue(item()); await f.flush();
    f.restartOutsideClip(); await f.flush();
    assert.equal(f.position, 30); assert.equal(f.paused, false);
    f.progress(30.5); await f.flush(); assert.equal(f.paused, false);
    f.progress(41); await f.flush(); assert.equal(f.paused, true);
  } finally {f.close();}
});
