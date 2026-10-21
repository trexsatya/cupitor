import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import {spotifyEpisode, spotifyClipSegments} from './spotify-clips.js';
import {captionLinesFrom, appendCaptionBlock, retainCaptionEnds} from './caption-capture.js';
import {parseMediaUrl} from './recordings-merge.js';
import {createSpotifyStudyPlayer, loadSpotifyEmbedApi} from './spotify-player.js';
import {splitGeometry} from './study-divider.js';
import {buildPlayingBannerVM} from './renderer/playing-ui-vm.js';

const require = createRequire(import.meta.url);
const {JSDOM} = require(process.env.CUPITOR_JSDOM || 'jsdom');
const id = '317TI86OHwkAxLtwi1VnXN', otherId = '7makk4oTQel546B0PZlDM5';
const url = 'https://open.spotify.com/episode/' + id;
function card(starts = [12.52], ends = [14.16], episode = url) {
  return {manual: true, id: 'mc-test', source: starts.map((_, i) => 'Line ' + i).join('\n'),
    mediaUrl: episode, captionUrl: episode, captionStarts: starts, captionEnds: ends, captionRows: starts.map(() => 1), captionField: 'source'};
}

test('only Spotify podcast episodes are recognized as seekable media', () => {
  for (const value of [url, url + '?t=12&si=shared', 'spotify:episode:' + id, 'https://open.spotify.com/intl-sv/episode/' + id]) {
    assert.equal(spotifyEpisode(value).id, id);
  }
  for (const value of ['https://evil.test/episode/' + id, 'https://open.spotify.com.evil.test/episode/' + id,
    'https://open.spotify.com/track/' + id, 'javascript:alert(1)', 'https://open.spotify.com/episode/invalid']) {
    assert.equal(spotifyEpisode(value), null);
  }
  assert.equal(parseMediaUrl(url).kind, 'spotify');
  assert.equal(parseMediaUrl('https://youtu.be/abcdefghijk').kind, 'youtube');
});

test('capturing and merging cues preserves both boundaries through a JSON round trip', () => {
  const lines = captionLinesFrom({lines: [{start: 12.52, end: 14.16, text: 'First'}, {start: 14.42, end: 17.96, text: 'Second'}]});
  assert.equal(lines[0].end, 14.16);
  const first = {...card(), source: 'First'};
  const merged = appendCaptionBlock(first, {url, timeParam: 't'}, lines.slice(1), 'source');
  const saved = JSON.parse(JSON.stringify(merged));
  assert.deepEqual(saved.captionBlocks.map(block => block.ends), [[14.16], [17.96]]);
  assert.deepEqual(spotifyClipSegments(saved).map(({start, end}) => ({start, end})), [{start: 12.52, end: 17.96}]);
});

test('separate passages skip unselected gaps and invalid or absent end times stay manual', () => {
  assert.deepEqual(spotifyClipSegments(card([0, 12.52], [2.38, 14.16])).map(({start, end}) => [start, end]), [[0, 2.38], [12.52, 14.16]]);
  for (const ends of [undefined, [], [null], [12.52], [NaN], [Infinity], [-1]]) {
    assert.deepEqual(spotifyClipSegments({...card(), captionEnds: ends}), []);
  }
  assert.deepEqual(spotifyClipSegments({...card(), mediaUrl: 'https://open.spotify.com/track/' + id}), []);
  assert.deepEqual(spotifyClipSegments({...card(), captionUrl: 'https://open.spotify.com/episode/' + otherId}), []);
});

test('resending a previously captured cue upgrades its end time without changing text or identity', () => {
  const old = card(); delete old.captionEnds;
  const updated = retainCaptionEnds(old, {url, timeParam: 't'}, [{start: 12.52, end: 14.16, text: 'Line 0'}]);
  assert.notEqual(updated, old); assert.equal(old.captionEnds, undefined);
  assert.equal(updated.source, old.source); assert.equal(updated.id, old.id);
  assert.deepEqual(updated.captionEnds, [14.16]); assert.equal(spotifyClipSegments(updated).length, 1);
  assert.equal(retainCaptionEnds(updated, {url, timeParam: 't'}, [{start: 12.52, end: 14.16, text: 'Line 0'}]), updated);
  assert.equal(retainCaptionEnds(old, {url, timeParam: 't'}, [{start: 12.52, end: 14.16, text: 'Different words'}]), old);
});

test('the shared divider reserves enough room for the full Spotify embed', () => {
  assert.ok(splitGeometry({height: 800, width: 390, mediaMin: 190, transport: 60}).media >= 190);
  assert.ok(splitGeometry({height: 800, width: 390, mediaMin: 190, ratio: 0}).media >= 190);
});

test('the playing card identifies Spotify and shows the captured passage times', () => {
  const vm = buildPlayingBannerVM(card([12.52, 30], [14.16, 32]), 0, 2, 5);
  assert.match(vm.headText, /^▶ /);
  assert.match(vm.metaText, /Spotify · 00:00:12 – 00:00:32 · 2 passages/);
});

function fixture() {
  const dom = new JSDOM('<!doctype html><html><head></head><body class="rec-playing"><div id="mediaContainer"></div><div id="recPlayingBanner"><div class="rec-pb-bar"></div></div><div id="practiceMode"><button class="practice-play">▶</button></div></body></html>', {runScripts: 'outside-only'});
  const {window: win} = dom;
  let clock = 0, seq = 0, foreground = true;
  const jobs = new Map(), calls = [], listeners = new Map(), notices = [];
  const add = (fn, delay, interval = false) => {const key = ++seq; jobs.set(key, {fn, delay, interval, due: clock + delay}); return key;};
  win.setTimeout = (fn, delay) => add(fn, delay);
  win.setInterval = (fn, delay) => add(fn, delay, true);
  win.clearTimeout = win.clearInterval = key => jobs.delete(key);
  const advance = ms => {
    const target = clock + ms;
    while (true) {
      const next = [...jobs].filter(([, job]) => job.due <= target).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      clock = next[1].due;
      if (!next[1].interval) jobs.delete(next[0]);
      next[1].fn();
      if (next[1].interval && jobs.has(next[0])) next[1].due += next[1].delay;
    }
    clock = target;
  };
  const controller = {
    addListener(name, fn) {if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn);},
    loadEntity(...args) {calls.push(['load', ...args]);},
    seek(time) {calls.push(['seek', time]);}, play() {calls.push(['play']);},
    resume() {calls.push(['resume']);}, pause() {calls.push(['pause']);},
  };
  const api = {createController(mount, options, callback) {
    calls.push(['create', options]); mount.replaceWith(win.document.createElement('iframe')); callback(controller);
  }};
  const player = createSpotifyStudyPlayer({win, loadApi: () => Promise.resolve(api), now: () => clock,
    isForeground: () => foreground, onStatus: value => notices.push(value)});
  const flush = async () => {for (let i = 0; i < 6; i++) await Promise.resolve();};
  const emit = (name, state = {}) => {for (const fn of listeners.get(name) || []) fn({data: state});};
  const state = (position, isPaused = true, episodeId = id) => emit('playback_update', {
    playingURI: 'spotify:episode:' + episodeId, position: position * 1000, duration: 3307760, isPaused, isBuffering: false,
  });
  return {win, player, calls, notices, advance, flush, emit, state, foreground(value) {foreground = value;}, close() {player.stop(); win.close();}};
}

test('playlist activates the saved fractional start, stops at the end and resolves once', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(card()); await f.flush(); f.emit('ready');
    assert.equal(f.calls.filter(call => call[0] === 'play').length, 1, 'Play activates the saved startAt');
    assert.equal(f.calls.some(call => call[0] === 'seek'), false);
    f.state(0); assert.equal(f.calls.filter(call => call[0] === 'play').length, 1, 'idle updates must not restart Play');
    f.state(12.52); assert.equal(f.calls.filter(call => call[0] === 'resume').length, 1);
    f.state(12.6, false); f.state(14.15, false);
    assert.equal(f.player.media.ended, false);
    f.state(14.16, false); assert.equal(await done, true);
    assert.equal(f.player.media.ended, true); assert.equal(f.calls.at(-1)[0], 'pause');
  } finally {f.close();}
});

test('multiple captured passages seek over gaps before a card completes', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(card([0, 12.52], [2.38, 14.16])); await f.flush(); f.emit('ready');
    f.state(0); f.state(0.1, false); f.state(2.38, false);
    assert.deepEqual(f.calls.filter(call => call[0] === 'seek').at(-1), ['seek', 12]);
    assert.equal(f.player.media.ended, false);
    f.state(2.5, false); assert.equal(f.player.media.ended, false, 'late updates from the preceding passage cannot finish the next one');
    f.state(12.52); f.state(12.6, false); f.state(14.16, false);
    assert.equal(await done, true);
  } finally {f.close();}
});

test('Practice cues and background/foreground transitions do not autoplay a new card', async () => {
  const f = fixture();
  try {
    f.player.cue(card()); await f.flush(); f.emit('ready'); f.state(12.52);
    f.foreground(false); f.advance(1000); f.foreground(true); f.advance(1000);
    assert.equal(f.calls.filter(call => call[0] === 'play').length, 0);
    assert.equal(f.player.media.ended, false);
  } finally {f.close();}
});

test('Practice play/pause toggles and replay keep using the captured bounds', async () => {
  const f = fixture(), item = card();
  try {
    f.player.cue(item); await f.flush(); f.emit('ready'); f.state(12.52);
    f.player.togglePractice(item); assert.equal(f.calls.at(-1)[0], 'resume');
    f.state(12.6, false); f.player.togglePractice(item); assert.equal(f.calls.at(-1)[0], 'pause');
    f.player.togglePractice(item); f.state(14.16, false); assert.equal(f.player.media.ended, true);
    f.player.togglePractice(item); await f.flush();
    assert.deepEqual(f.calls.filter(call => call[0] === 'seek').at(-1), ['seek', 12]);
  } finally {f.close();}
});

test('autoplay blocking waits for the listener rather than advancing on wall-clock time', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(card()); let finished = false; done.then(() => {finished = true;});
    await f.flush(); f.emit('ready'); f.state(12.52); f.advance(10000); await f.flush();
    assert.equal(finished, false); assert.equal(f.player.media.ended, false);
    assert.match(f.win.document.querySelector('.spotify-clip-status').textContent, /Tap Play/);
    f.state(12.6, false); f.state(14.16, false); assert.equal(await done, true);
  } finally {f.close();}
});

test('navigation cancels stale loads and old media controls cannot affect the next card', async () => {
  const f = fixture(); let selected = true;
  try {
    const oldDone = f.player.playCard(card(), {isCurrent: () => selected});
    await f.flush(); f.emit('ready'); const oldMedia = f.player.media;
    selected = false;
    const nextDone = f.player.playCard(card([30], [32], 'https://open.spotify.com/episode/' + otherId));
    await f.flush(); assert.equal(await oldDone, false); f.emit('ready');
    f.state(12.52, false); assert.equal(f.player.media.ended, false);
    const count = f.calls.length; oldMedia.pause(); await oldMedia.play(); assert.equal(f.calls.length, count);
    f.state(30, true, otherId); f.state(30.1, false, otherId); f.state(32, false, otherId);
    assert.equal(await nextDone, true);
  } finally {f.close();}
});

test('unreachable timestamps fail after the playback timeout and expose the error', async () => {
  const f = fixture();
  try {
    const done = f.player.playCard(card()); await f.flush(); f.emit('ready'); f.state(0); f.advance(20100);
    await assert.rejects(done, /timestamp/); assert.match(f.notices.at(-1), /timestamp/);
  } finally {f.close();}
});

test('Spotify pause/resume controls update the playlist without consuming paused time', async () => {
  const f = fixture(); let paused = false;
  try {
    const done = f.player.playCard(card(), {isPaused: () => paused, onExternalPause: value => {paused = value;}});
    await f.flush(); f.emit('ready'); f.state(12.52); f.state(12.6, false); f.advance(400);
    f.state(13, true); assert.equal(paused, true);
    const plays = f.calls.filter(call => call[0] === 'play').length;
    f.advance(30000); assert.equal(f.player.media.ended, false);
    assert.equal(f.calls.filter(call => call[0] === 'play').length, plays);
    f.state(13, false); assert.equal(paused, false);
    f.state(14.16, false); assert.equal(await done, true);
  } finally {f.close();}
});

test('the Spotify SDK loader handles one request, a ready callback, and load errors', async () => {
  const f = fixture();
  try {
    const first = loadSpotifyEmbedApi(f.win), same = loadSpotifyEmbedApi(f.win);
    assert.equal(first, same); assert.equal(f.win.document.querySelectorAll('script').length, 1);
    const api = {createController() {}}; f.win.onSpotifyIframeApiReady(api); assert.equal(await first, api);
    assert.equal(await loadSpotifyEmbedApi(f.win), api);
  } finally {f.close();}
  const failed = fixture();
  try {
    const pending = loadSpotifyEmbedApi(failed.win);
    failed.win.document.querySelector('script').onerror();
    await assert.rejects(pending, /could not load/);
  } finally {failed.close();}
});

// Exercise the real playlist loop as well as the provider. The app's UI and
// speech helpers are injected so this test needs no network or saved profile.
function appPlaylist(f, events, overrides = {}) {
  const runtimeRequire = createRequire(require.resolve(process.env.CUPITOR_JSDOM || 'jsdom'));
  const {parse} = runtimeRequire('@babel/parser');
  const $ = runtimeRequire('jquery')(f.win);
  const source = fs.readFileSync(new URL('./language.js', import.meta.url), 'utf8');
  const ast = parse(source, {sourceType: 'module'});
  const code = ['_cardHasPlayableMedia', 'playRecording'].map(name => {
    const node = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
    assert.ok(node, 'the real playlist handler must be present');
    return source.slice(node.start, node.end);
  }).join('\n');
  const noop = () => {};
  const scope = {window: f.win, document: f.win.document, $: $, spotifyPlayer: f.player,
    spotifyClips: spotifyClipSegments, _isManualItem: item => !!item?.manual, _parseMediaUrl: parseMediaUrl,
    _cardHasAudio: () => false, _isAudioMediaUrl: () => false, _cardHasVideoLink: () => false, _cardClipsInOrder: () => [], _recPlayReversed: () => false,
    _interItemGapSeconds: () => 0, _effectiveSrcTgtGapSeconds: () => 0, _sleepRespectingPause: () => Promise.resolve(),
    setInterval: () => 1, clearInterval: noop, setTimeout: f.win.setTimeout,
    _saveQueueOrder: noop, _interruptRecordingPlayback: noop, hideMediaRelatedContainer: noop, _refreshRecPlayModeBtns: noop, _postMediaState: noop, _setOpenView: noop, _syncBackgroundMusic: noop, _setLastPlayed: noop,
    _renderPlayingManualText: noop, _stopGapCountdown: noop, _restoreRecordingReplaySpeed: noop, _clearOpenView: noop, _stopBackgroundMusic: noop, _startGapCountdown: noop, _setRecPlayPhase: noop, _saveLastPlayedMap: noop, _loadLastPlayedMap: () => ({}),
    openPlayingQueueDialog: noop, stopPlayingRecording: noop, togglePlayingRecordingPause: noop, navigateRecordingPlayback: noop, toggleRecPlayShuffle: noop, cycleRecPlayLoopMode: noop, _searchCurrentRecPlayWord: noop, minimizePlayingRecording: noop, restorePlayingRecording: noop,
    _showManualAudioPlayer: () => {f.win._recPlayManualAudio = null;},
    _applyRecPlayPause: paused => {f.win._recPlayPaused = paused;},
    _renderPlayingBanner: (item, index) => events.push(['item', index, item]),
    _recPlayToast: value => events.push(['skip', value]), _cpBuildToast: value => events.push(['notice', value]),
    alert: value => {throw new Error(value);},
    ...overrides,
  };
  return Function(...Object.keys(scope), 'let _recPlayCardReversed = null;\n' + code + '\nreturn playRecording;')(...Object.values(scope));
}

test('the actual Play All loop waits for each Spotify clip end before advancing', async () => {
  const f = fixture(), events = [];
  try {
    const play = appPlaylist(f, events), first = card(), second = card([20.8], [24.1]);
    const done = play({queue: [first, second], shuffle: false, loop: 'off'});
    await f.flush(); f.emit('ready'); f.state(12.52); f.state(12.6, false);
    assert.deepEqual(events.filter(event => event[0] === 'item').map(event => event[1]), [0]);
    f.state(14.16, false); await f.flush(); await f.flush();
    assert.deepEqual(events.filter(event => event[0] === 'item').map(event => event[1]), [0, 1]);
    assert.deepEqual(f.calls.filter(call => call[0] === 'seek').at(-1), ['seek', 20]);
    f.state(20.8); f.state(21, false); f.state(24.1, false);
    await done;
    assert.equal(f.win._playingRecording, false);
    assert.equal(events.some(event => event[0] === 'skip'), false);
  } finally {f.close();}
});

test('the actual Play All loop skips an unavailable Spotify item and continues', async () => {
  const f = fixture(), events = [];
  try {
    const play = appPlaylist(f, events);
    const done = play({queue: [card(), card([30], [32])], shuffle: false, loop: 'off'});
    await f.flush(); f.emit('ready'); f.emit('error', {message: 'Episode unavailable'});
    await f.flush(); await f.flush();
    assert.ok(events.some(event => event[0] === 'skip' && /unavailable/.test(event[1])));
    assert.deepEqual(events.filter(event => event[0] === 'item').map(event => event[1]), [0, 1]);
    f.state(30); f.state(30.1, false); f.state(32, false); await done;
    assert.equal(f.win._playingRecording, false);
  } finally {f.close();}
});

test('Next cancels the current Spotify card before its remaining recorded audio', async () => {
  const f = fixture(), events = [], recordings = [];
  try {
    const first = card(), second = card([30], [32]);
    const play = appPlaylist(f, events, {
      _cardClipsInOrder: item => item === first ? [{url: 'recorded-source.webm'}] : [],
      _playManualAudioAndWait: async url => {recordings.push(url);},
    });
    const done = play({queue: [first, second], shuffle: false, loop: 'off'});
    await f.flush(); f.emit('ready'); f.state(12.52); f.state(12.6, false);
    f.win._recNavRequest = 'next'; f.advance(100);
    await f.flush(); await f.flush();
    assert.deepEqual(recordings, []);
    assert.deepEqual(events.filter(event => event[0] === 'item').map(event => event[1]), [0, 1]);
    f.state(30); f.state(30.1, false); f.state(32, false); await done;
  } finally {f.close();}
});


test('the supplied playlist advances through every retained passage using whole-second acknowledgements', {timeout: 5000}, async () => {
  const f = fixture(), events = [];
  try {
    const rows = JSON.parse(fs.readFileSync(new URL(
      '../../tests/browser/fixtures/spotify-captured-playlist.json',
      import.meta.url), 'utf8'));
    const cards = rows.filter(row => row?.[2] && spotifyClipSegments(row[2]).length).map(row => row[2]);
    assert.ok(cards.length > 1);
    const original = JSON.stringify(cards);
    const done = appPlaylist(f, events)({queue: cards, shuffle: false, loop: 'off'});
    let previousEpisode = null, passages = 0;
    for (let index = 0; index < cards.length; index++) {
      await f.flush(); await f.flush();
      assert.equal(f.win._recPlayCurrentItem, cards[index]);
      const ranges = spotifyClipSegments(cards[index]);
      if (ranges[0].id !== previousEpisode) {
        f.emit('ready'); previousEpisode = ranges[0].id;
      }
      for (const range of ranges) {
        f.state(Math.floor(range.start), true, range.id);
        f.state(range.start + (range.end - range.start) / 2, false, range.id);
        f.state(range.end - 0.001, false, range.id);
        assert.equal(f.player.media.ended, false, 'a fractional end must not be rounded down');
        f.state(range.end, false, range.id);
        assert.equal(f.win._recPlayPaused, false, 'an internal boundary pause cannot pause the playlist');
        passages++;
      }
    }
    await done;
    assert.equal(passages, cards.reduce((count, card) => count + spotifyClipSegments(card).length, 0));
    assert.equal(events.filter(event => event[0] === 'item').length, cards.length);
    assert.equal(events.some(event => event[0] === 'skip'), false);
    assert.equal(JSON.stringify(cards), original, 'playing must preserve the captured cue data');
  } finally {f.close();}
});
