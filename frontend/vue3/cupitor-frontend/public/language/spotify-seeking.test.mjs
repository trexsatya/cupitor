import assert from 'node:assert/strict';
import test from 'node:test';
import {createSpotifyStudyPlayer} from './spotify-player.js';

const uri = 'spotify:episode:1ITvLBQG5IMWcE4BD0V49f';
const url = uri;
const item = (start = 30, end = 41) => ({manual: true, mediaUrl: url,
  captionUrl: url, captionStarts: [start], captionEnds: [end]});

// These tests exercise transport events, not rendering. A small DOM stub keeps
// the seek/buffering model independent of browser timing and external packages.
function studyWindow() {
  const nodes = [];
  const createElement = tag => {
    const node = {tagName: tag.toUpperCase(), children: [], style: {}, attributes: {},
      append(...children) {this.children.push(...children);},
      setAttribute(name, value) {this.attributes[name] = value;},
      replaceWith() {}, querySelector() {return null;}, focus() {}};
    nodes.push(node); return node;
  };
  const body = createElement('body'), head = createElement('head');
  const classes = new Set();
  body.classList = {add: value => classes.add(value), remove: value => classes.delete(value),
    contains: value => classes.has(value)};
  const container = createElement('div'); container.id = 'mediaContainer';
  const play = createElement('button'), progress = createElement('div');
  const document = {body, head, hidden: false, createElement,
    getElementById: id => nodes.find(node => node.id === id) || null,
    querySelector: selector => selector === '#practiceMode .practice-play' ? play
      : selector === '#recPlayingBanner .rec-pb-bar' ? progress
      : nodes.find(node => '.' + node.className === selector) || null};
  return {document};
}

function fixture() {
  const win = studyWindow(), calls = [], listeners = new Map(), jobs = new Map();
  let clock = 0, sequence = 0, ownerPaused = false, foreground = true;
  let nextPause = null, nextSeek = null;
  win.setInterval = (fn, delay) => {const id = ++sequence; jobs.set(id, {fn, delay, at: clock + delay}); return id;};
  win.clearInterval = id => jobs.delete(id);
  const controller = {
    addListener(name, callback) {listeners.set(name, callback);},
    loadEntity(...args) {calls.push(['load', ...args]);},
    seek(time) {calls.push(['seek', time]); const callback = nextSeek; nextSeek = null; callback?.();},
    pause() {calls.push(['pause']); const callback = nextPause; nextPause = null; callback?.();},
    resume() {calls.push(['resume']);},
  };
  const api = {createController(mount, options, callback) {callback(controller);}};
  const player = createSpotifyStudyPlayer({win, loadApi: () => Promise.resolve(api),
    now: () => clock, isForeground: () => foreground});
  const options = {isPaused: () => ownerPaused, onExternalPause: value => {ownerPaused = value;}};
  const emit = (name, data = {}) => listeners.get(name)?.({data});
  const state = (position, isPaused = true, isBuffering = false) => emit('playback_update', {
    playingURI: uri, position: position * 1000, duration: 2642000, isPaused, isBuffering});
  const flush = async () => {for (let i = 0; i < 10; i++) await Promise.resolve();};
  const advance = ms => {
    const end = clock + ms;
    while (true) {
      const entry = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      clock = entry[1].at; entry[1].fn();
      if (jobs.has(entry[0])) entry[1].at += entry[1].delay;
    }
    clock = end;
  };
  return {player, calls, options, state, flush, advance, ready: () => emit('ready'),
    count: name => calls.filter(call => call[0] === name).length,
    get ownerPaused() {return ownerPaused;},
    onPause(callback) {nextPause = callback;}, onSeek(callback) {nextSeek = callback;},
    foreground(value) {foreground = value;},
    close() {player.stop();}};
}

test('buffering pauses preserve Play and recover without another tap', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(), f.options); await f.flush(); f.ready();
    f.state(30); f.state(30.1, false); f.advance(1000);
    f.state(30.4, true, true);
    assert.equal(f.ownerPaused, false, 'buffering must not pause the queue owner');
    const resumes = f.count('resume');
    f.state(30.4, true, false); f.advance(1000);
    assert.ok(f.count('resume') > resumes, 'resume automatically after buffering');
    f.state(30.6, false); f.state(41, false); assert.equal(await done, true);
  } finally {f.close();}
});

test('a synchronous pause acknowledgement during a corrective seek cannot cancel Play', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(), f.options); await f.flush(); f.ready();
    f.state(30); f.state(30.2, false); f.advance(1000);
    f.onPause(() => f.state(29, true));
    f.state(29, false);
    assert.equal(f.ownerPaused, false);
    const resumes = f.count('resume'); f.state(30);
    assert.ok(f.count('resume') > resumes);
    f.state(30.3, false); f.state(41, false); assert.equal(await done, true);
  } finally {f.close();}
});

test('finishing one item cannot set Pause on the next item', async () => {
  const f = fixture();
  try {
    const first = f.player.playCard(item(), f.options); await f.flush(); f.ready();
    f.state(30); f.state(30.2, false); f.advance(1000);
    f.onPause(() => f.state(41, true));
    f.state(41, false); assert.equal(await first, true);
    assert.equal(f.ownerPaused, false, 'the end-boundary pause belongs to the finished clip');
    const resumes = f.count('resume');
    const second = f.player.playCard(item(50, 52), f.options); await f.flush();
    f.state(50, true, true); f.state(50, true, false); f.advance(1000);
    assert.ok(f.count('resume') > resumes, 'the next item must start automatically');
    f.state(50.2, false); f.state(52, false); assert.equal(await second, true);
  } finally {f.close();}
});

test('a delayed pause acknowledgement before playing progress is retried automatically', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(), f.options); await f.flush(); f.ready();
    f.state(30); f.state(30, false); f.advance(1000);
    const resumes = f.count('resume'); f.state(30, true); f.advance(1000);
    assert.equal(f.ownerPaused, false);
    assert.ok(f.count('resume') > resumes);
    f.state(30.3, false); f.state(41, false); assert.equal(await done, true);
  } finally {f.close();}
});

test('a playing seek acknowledgement can already have advanced inside the clip', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(30.52, 41), f.options); await f.flush(); f.ready();
    const seeks = f.count('seek'); f.state(31.1, false); f.advance(1000);
    assert.equal(f.player.media.currentTime, 31.1);
    assert.equal(f.count('seek'), seeks, 'do not rewind a valid delayed seek acknowledgement');
    f.state(41, false); assert.equal(await done, true);
  } finally {f.close();}
});

test('seeking through the media facade preserves Play and confirms the requested target', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(), f.options); await f.flush(); f.ready();
    f.state(30); f.state(31, false); f.advance(1000);
    f.onSeek(() => f.state(35, true));
    const resumes = f.count('resume'); f.player.media.currentTime = 35;
    assert.equal(f.ownerPaused, false);
    assert.ok(f.count('resume') > resumes);
    assert.equal(f.player.media.currentTime, 35);
    f.state(35.2, false); f.state(41, false); assert.equal(await done, true);
  } finally {f.close();}
});

test('an explicit Pause during seeking is preserved through acknowledgement and retries', async () => {
  const f = fixture();
  try {
    const card = item(), session = f.player.cue(card);
    await f.flush(); f.ready(); f.player.togglePractice(card);
    session.media.pause(); const resumes = f.count('resume'); f.state(30); f.advance(5000);
    assert.equal(f.count('resume'), resumes);
    assert.equal(session.media.ended, false);
  } finally {f.close();}
});

test('a stable Pause from the embedded player still pauses the playlist', async () => {
  const f = fixture();
  try {
    f.player.playCard(item(), f.options); await f.flush(); f.ready();
    f.state(30); f.state(30.2, false); f.advance(1000);
    f.state(31, false); f.advance(1000); f.state(31, true);
    assert.equal(f.ownerPaused, true);
    const resumes = f.count('resume'); f.advance(5000);
    assert.equal(f.count('resume'), resumes);
  } finally {f.close();}
});

test('the first embedded Play while its initial seek is pending is remembered', async () => {
  const f = fixture();
  try {
    const session = f.player.cue(item()); await f.flush(); f.ready();
    f.state(0, false); f.advance(1000); f.state(30, true);
    assert.ok(f.count('resume') > 0);
    f.state(30.2, false); f.state(41, false); assert.equal(await session.done, true);
  } finally {f.close();}
});

test('a late pause from the finished item cannot pause a playing next item', async () => {
  const f = fixture();
  try {
    const first = f.player.playCard(item(30, 31), f.options); await f.flush(); f.ready();
    f.state(30); f.state(30.2, false); f.state(31, false); assert.equal(await first, true);
    const second = f.player.playCard(item(50, 52), f.options); await f.flush();
    f.state(50); f.state(50.2, false); f.advance(1000); f.state(31, true);
    assert.equal(f.ownerPaused, false);
    const resumes = f.count('resume'); f.state(50);
    assert.ok(f.count('resume') > resumes);
    f.state(50.3, false); f.state(52, false); assert.equal(await second, true);
  } finally {f.close();}
});

test('a repeated ready notification cannot seek a playing clip back to its start', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(), f.options); await f.flush(); f.ready();
    f.state(30); f.state(31, false); f.advance(1000);
    const seeks = f.count('seek'); f.ready();
    assert.equal(f.count('seek'), seeks);
    assert.equal(f.player.media.currentTime, 31);
    f.state(41, false); assert.equal(await done, true);
  } finally {f.close();}
});

test('backgrounding pauses recovery and returning resumes the same clip', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(), f.options); await f.flush(); f.ready();
    f.state(30); f.state(30.2, false);
    f.foreground(false); f.advance(1000); f.state(30.2);
    const resumes = f.count('resume'); f.advance(5000);
    assert.equal(f.count('resume'), resumes);
    f.foreground(true); f.advance(1000); assert.ok(f.count('resume') > resumes);
    f.state(30.4, false); f.state(41, false); assert.equal(await done, true);
  } finally {f.close();}
});

test('separated passages in one card preserve Play through their boundary pauses', async () => {
  const f = fixture();
  try {
    const card = {...item(), captionStarts: [30, 50], captionEnds: [31, 52]};
    const done = f.player.playCard(card, f.options); await f.flush(); f.ready();
    f.state(30); f.state(30.2, false); f.advance(1000);
    f.onPause(() => f.state(31, true)); f.state(31, false);
    assert.equal(f.ownerPaused, false); assert.equal(f.player.media.ended, false);
    const resumes = f.count('resume'); f.state(50);
    assert.ok(f.count('resume') > resumes);
    f.state(50.2, false); f.state(52, false); assert.equal(await done, true);
  } finally {f.close();}
});


test('a fractional cue accepts the whole-second seek and plays through its lead-in', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(46.48, 48.6), f.options); await f.flush(); f.ready(); f.state(0, false);
    assert.deepEqual(f.calls.filter(call => call[0] === 'seek').at(-1), ['seek', 46]);
    const seeks = f.count('seek'), resumes = f.count('resume');
    f.state(46);
    assert.ok(f.count('resume') > resumes, 'the rounded seek must be acknowledged');
    f.state(46.1, false); f.state(46.2, false); f.state(46.49, false);
    assert.equal(f.count('seek'), seeks, 'lead-in must not trigger another corrective seek');
    assert.equal(f.ownerPaused, false);
    f.state(48.59, false); assert.equal(f.player.media.ended, false);
    f.state(48.6, false); assert.equal(await done, true);
  } finally {f.close();}
});

test('a cue near the next whole second accepts the floor without losing its first words', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(148.92, 155.42), f.options); await f.flush(); f.ready(); f.state(0, false);
    assert.deepEqual(f.calls.filter(call => call[0] === 'seek').at(-1), ['seek', 148]);
    const resumes = f.count('resume'); f.state(148);
    assert.ok(f.count('resume') > resumes);
    const seeks = f.count('seek'); f.state(148.1, false); f.state(148.8, false);
    assert.equal(f.count('seek'), seeks);
    f.state(149, false); f.state(155.41, false);
    assert.equal(f.player.media.ended, false);
    f.state(155.42, false); assert.equal(await done, true);
  } finally {f.close();}
});

test('a subsecond cue is not skipped by rounding its start up', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(46.92, 47.08), f.options); await f.flush(); f.ready(); f.state(0, false);
    assert.deepEqual(f.calls.filter(call => call[0] === 'seek').at(-1), ['seek', 46]);
    f.state(46); f.state(46.2, false); f.state(46.95, false);
    assert.equal(f.player.media.ended, false);
    f.state(47.08, false); assert.equal(await done, true);
  } finally {f.close();}
});

test('fractional passages and the next card advance using whole-second seeks without taps', async () => {
  const f = fixture();
  try {
    const card = {...item(), captionStarts: [30, 46.48], captionEnds: [31, 48.6]};
    const first = f.player.playCard(card, f.options); await f.flush(); f.ready();
    f.state(30); f.state(30.2, false);
    f.onPause(() => f.state(31)); f.state(31, false);
    assert.deepEqual(f.calls.filter(call => call[0] === 'seek').at(-1), ['seek', 46]);
    f.state(46); f.state(46.2, false); f.state(48.6, false);
    assert.equal(await first, true); assert.equal(f.ownerPaused, false);
    const next = f.player.playCard(item(148.92, 155.42), f.options); await f.flush();
    assert.deepEqual(f.calls.filter(call => call[0] === 'seek').at(-1), ['seek', 148]);
    const resumes = f.count('resume'); f.state(148);
    assert.ok(f.count('resume') > resumes);
    f.state(148.2, false); f.state(155.42, false);
    assert.equal(await next, true);
  } finally {f.close();}
});

test('an explicit Pause during a fractional seek prevents automatic resume', async () => {
  const f = fixture();
  try {
    const session = f.player.cue(item(46.48, 48.6)); await f.flush(); f.ready();
    session.media.play(); session.media.pause(); const resumes = f.count('resume');
    f.state(46); f.advance(5000);
    assert.equal(f.count('resume'), resumes);
    assert.equal(f.player.media.ended, false);
  } finally {f.close();}
});

test('a stable embedded Pause in the fractional cue lead-in is still user intent', async () => {
  const f = fixture();
  try {
    f.player.playCard(item(46.92, 48.6), f.options); await f.flush(); f.ready();
    f.state(46); f.state(46.1, false); f.advance(1000);
    f.state(46.3, false); f.advance(1000); f.state(46.3, true);
    assert.equal(f.ownerPaused, true);
    const resumes = f.count('resume'); f.advance(5000);
    assert.equal(f.count('resume'), resumes);
  } finally {f.close();}
});

test('whole-second seek acceptance still rejects a stale clock from the preceding passage', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(148.92, 155.42), f.options); await f.flush(); f.ready(); f.state(0, false);
    const resumes = f.count('resume'); f.state(48.6);
    assert.equal(f.count('resume'), resumes);
    assert.equal(Number.isNaN(f.player.media.currentTime), true);
    f.state(148); f.state(148.1, false); f.state(155.42, false);
    assert.equal(await done, true);
  } finally {f.close();}
});

test('playback diagnostics retain commands and observations without card text or source URLs', async () => {
  const f = fixture();
  try {
    const card = {...item(46.48, 48.6), id: 'capture-1', target: 'private text', source: 'private source'};
    f.player.playCard(card, f.options); await f.flush(); f.ready(); f.state(0, false);
    f.state(46); f.state(46.1, false); f.advance(1000); f.state(47.2, false);
    const snapshot = f.player.getPlaybackLog();
    assert.ok(snapshot.events.some(event => event.event === 'command:seek' &&
      event.requestedSeconds === 46.48 && event.seconds === 46));
    assert.ok(snapshot.events.some(event => event.event === 'playback' && event.position === 46000));
    const text = JSON.stringify(snapshot);
    assert.equal(text.includes('private text'), false);
    assert.equal(text.includes('private source'), false);
    assert.equal(text.includes('https://'), false);
    const length = snapshot.events.length;
    snapshot.events.pop();
    assert.equal(f.player.getPlaybackLog().events.length, length, 'export is a detached snapshot');
  } finally {f.close();}
});

test('playback diagnostics are bounded during a long session', async () => {
  const f = fixture();
  try {
    f.player.playCard(item(0, 10000), f.options); await f.flush(); f.ready();
    f.state(0); f.state(0.1, false);
    for (let i = 1; i <= 2100; i++) {f.advance(1000); f.state(i, false);}
    const snapshot = f.player.getPlaybackLog();
    assert.equal(snapshot.events.length, 2000);
    assert.ok(snapshot.droppedEvents > 0);
    assert.ok(snapshot.events.at(-1).elapsedMs >= 2100000);
  } finally {f.close();}
});


test('the first episode activates with startAt before any Pause or Seek command', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(46.48, 48.6), f.options); await f.flush();
    assert.deepEqual(f.calls, [['load', uri, false, 46.48]]);
    f.ready();
    assert.equal(f.count('seek'), 0);
    assert.equal(f.count('pause'), 0);
    assert.equal(f.count('resume'), 1);
    f.state(0, true); f.advance(1000); f.state(0, true);
    assert.equal(f.count('seek'), 0, 'an idle clock is not evidence of a bad seek');
    f.state(46.48, false); f.state(46.8, false); f.state(48.6, false);
    assert.equal(await done, true);
  } finally {f.close();}
});

test('Practice waits for initial Play without seeking an unactivated iframe', async () => {
  const f = fixture();
  try {
    const session = f.player.cue(item(46.48, 48.6)); await f.flush(); f.ready();
    assert.equal(f.count('seek'), 0);
    assert.equal(f.count('resume'), 0);
    f.state(0, true); f.advance(1000);
    assert.equal(f.count('seek'), 0);
    f.player.togglePractice(session.item);
    assert.equal(f.count('resume'), 1);
    f.state(46.48, false); f.state(48.6, false);
    assert.equal(await session.done, true);
  } finally {f.close();}
});


test('an idle seek is resumed without waiting for a position event that Spotify may withhold', async () => {
  const f = fixture();
  try {
    const first = f.player.playCard(item(30, 31), f.options); await f.flush(); f.ready();
    f.state(30); f.state(30.2, false); f.state(31, false); assert.equal(await first, true);
    const resumes = f.count('resume');
    const next = f.player.playCard(item(148.92, 155.42), f.options); await f.flush();
    assert.ok(f.count('resume') > resumes, 'Resume must follow Seek before an idle acknowledgement arrives');
    assert.deepEqual(f.calls.slice(-2), [['seek', 148], ['resume']]);
    assert.equal(f.ownerPaused, false);
    const seeks = f.count('seek'); f.advance(1600);
    assert.ok(f.count('seek') > seeks, 'missing acknowledgements are retried without relying on more events');
    f.state(148.6, false); f.state(155.42, false);
    assert.equal(await next, true);
  } finally {f.close();}
});

test('Practice keeps an idle seek paused until the listener presses Play', async () => {
  const f = fixture();
  try {
    const first = f.player.playCard(item(30, 31)); await f.flush(); f.ready();
    f.state(30); f.state(30.2, false); f.state(31, false); await first;
    const resumes = f.count('resume'), card = item(148.92, 155.42);
    const session = f.player.cue(card); await f.flush();
    assert.equal(f.count('resume'), resumes);
    f.advance(5000); assert.equal(f.count('resume'), resumes);
    f.player.togglePractice(card);
    assert.ok(f.count('resume') > resumes);
    f.state(148.5, false); f.state(155.42, false);
    assert.equal(await session.done, true);
  } finally {f.close();}
});

test('an explicit Pause cancels idle-seek resume retries', async () => {
  const f = fixture();
  try {
    const first = f.player.playCard(item(30, 31)); await f.flush(); f.ready();
    f.state(30); f.state(30.2, false); f.state(31, false); await first;
    f.player.playCard(item(148.92, 155.42), f.options); await f.flush();
    f.options.onExternalPause(true); f.player.media.pause();
    const resumes = f.count('resume'); f.advance(5000);
    assert.equal(f.count('resume'), resumes);
    assert.equal(f.player.media.ended, false);
  } finally {f.close();}
});


test('the fractional end is enforced between Spotify progress reports', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(30, 31.6), f.options); await f.flush(); f.ready();
    f.state(30); f.state(30.1, false);
    f.advance(1400); assert.equal(f.player.media.ended, false);
    f.advance(200); assert.equal(f.player.media.ended, true);
    assert.equal(await done, true);
    assert.ok(f.player.getPlaybackLog().events.some(event =>
      event.event === 'clip-end' && event.estimated));
  } finally {f.close();}
});

test('buffering suspends prediction of a nearby clip end', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(item(30, 31.6), f.options); await f.flush(); f.ready();
    f.state(30); f.state(30.1, false); f.advance(500);
    f.state(30.6, true, true); f.advance(3000);
    assert.equal(f.player.media.ended, false);
    f.state(30.6, false, false); f.advance(1100);
    assert.equal(await done, true);
  } finally {f.close();}
});
