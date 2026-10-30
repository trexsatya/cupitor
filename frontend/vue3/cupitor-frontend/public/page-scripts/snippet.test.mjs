// Node test harness for the SVT subtitle strategy state machine.
//
// Mirrors the logic in snippet.js for strategies 3/4/5 (chunk-and-replay
// with optional speed schedule + inter-pass gap) plus the dedup machinery,
// then drives a series of scenarios against a mocked video element + a
// fake clock for setTimeout. Every test pins a specific expectation; the
// harness reports PASS / FAIL with the offending assertion's diff.
//
// Run with:  node db/js/snippet.test.mjs
//
// When this file's logic diverges from snippet.js — keep snippet.js as the
// source of truth and update the harness; or vice versa for bug fixes.

import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mock video element + a controllable clock.
// ---------------------------------------------------------------------------
function mkVideo() {
  const v = {
    currentTime: 0,
    playbackRate: 1,
    paused: true,
    _listeners: {},
    _events: [],
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
    fire(t) {
      this._events.push(t);
      (this._listeners[t] || []).forEach(fn => fn({ type: t }));
    },
    play() {
      const wasPaused = this.paused;
      this.paused = false;
      if (wasPaused) this.fire('play');
      return Promise.resolve();
    },
    pause() {
      const wasPlaying = !this.paused;
      this.paused = true;
      if (wasPlaying) this.fire('pause');
    },
    seek(t) { this.currentTime = t; this.fire('timeupdate'); },
    advance(dt) {
      if (this.paused) return;
      this.currentTime += dt * (this.playbackRate || 1);
      this.fire('timeupdate');
    },
  };
  return v;
}

// Fake clock: queued setTimeout callbacks that we advance manually.
function mkClock() {
  let now = 0;
  const queue = [];
  let nextId = 1;
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = nextId++;
      queue.push({ id, due: now + ms, fn });
      queue.sort((a, b) => a.due - b.due);
      return id;
    },
    clearTimeout(id) {
      const i = queue.findIndex(x => x.id === id);
      if (i >= 0) queue.splice(i, 1);
    },
    tick(ms) {
      const target = now + ms;
      while (queue.length && queue[0].due <= target) {
        const item = queue.shift();
        now = item.due;
        item.fn();
      }
      now = target;
    },
  };
}

// ---------------------------------------------------------------------------
// State + state-machine logic mirrored from snippet.js. (Verbatim wiring;
// dom/sidebar functions are stubbed out as no-ops since we test the core.)
// ---------------------------------------------------------------------------
function mkState(overrides = {}) {
  return Object.assign({
    cues: [],
    activeIdx: -1,
    splitActive: true,

    translationEnabled: true,
    translationSource: 'sv',
    translationTarget: 'en',
    nextTrId: 1,
    pendingTr: Object.create(null),

    strategy: 1,
    linesPerChunk: 5,
    chunkStartIdx: null,
    chunkStart: null,
    chunkEnd: null,
    chunkReplaying: false,
    chunkFloor: 0,

    repeatCount: 1,
    replaySchedule: '1-0.7',
    currentPass: 0,
    replayGap: 1,
    gapTimer: null,
    passToken: 0,

    userOverrode: false,
    expectedPauses: 0,
    expectedPlays: 0,
    lastSeekAt: -1e9,
  }, overrides);
}

function normalizeText(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

function parseSchedule(str) {
  const arr = (str || '1').split('-').map(s => {
    const n = parseFloat(s);
    return (isFinite(n) && n >= 0.25 && n <= 4) ? n : 1;
  });
  return arr.length ? arr : [1];
}

function speedForPass(state, passIdx) {
  if (state.strategy === 3) return 1;
  const sched = parseSchedule(state.replaySchedule);
  return sched[Math.min(passIdx, sched.length - 1)];
}
function maxPasses(state) {
  return state.strategy === 3 ? 1 : Math.max(0, state.repeatCount);
}

// Must mirror findDup in snippet.js — see comments there for the rationale
// behind prefix-only containment and the 8-char floor.
function findDup(state, cue) {
  const norm = normalizeText(cue.text);
  if (!norm) return { dup: true };
  const WINDOW = 3;
  for (let i = state.cues.length - 1; i >= 0; i--) {
    const c = state.cues[i];
    if (c.start < cue.start - 30) break;
    if (Math.abs(c.start - cue.start) > WINDOW) continue;
    const ct = normalizeText(c.text);
    if (ct === norm) return { dup: true, idx: i };
    const shorter = ct.length < norm.length ? ct : norm;
    const longer  = ct.length < norm.length ? norm : ct;
    if (shorter.length >= 8 && longer.startsWith(shorter)) {
      if (norm.length > ct.length) {
        state.cues[i] = Object.assign({}, c, { text: cue.text, translation: '', trPending: false });
      }
      return { dup: true, idx: i };
    }
  }
  return { dup: false };
}

function ourPause(state, video) {
  if (video.paused) return;
  state.expectedPauses = (state.expectedPauses || 0) + 1;
  video.pause();
}

function ourPlay(state, video) {
  if (state.userOverrode) return;
  if (!video.paused) return;
  state.expectedPlays = (state.expectedPlays || 0) + 1;
  video.play();
}

function attachVideo(state, video, clock) {
  video.addEventListener('pause', () => {
    if ((state.expectedPauses || 0) > 0) { state.expectedPauses--; return; }
    state.userOverrode = true;
  });
  video.addEventListener('play', () => {
    if ((state.expectedPlays || 0) > 0) { state.expectedPlays--; return; }
    state.userOverrode = false;
  });
  video.addEventListener('timeupdate', () => syncHighlight(state, video, clock));
}

function resetChunk(state, clock) {
  state.chunkReplaying = false;
  state.chunkStartIdx = null;
  state.chunkStart = null;
  state.chunkEnd = null;
  state.currentPass = 0;
  state.passToken++;
  if (state.gapTimer != null) {
    clock.clearTimeout(state.gapTimer);
    state.gapTimer = null;
  }
}

function startReplayPass(state, video, clock, passIdx) {
  state.currentPass = passIdx;
  const rate = speedForPass(state, passIdx);
  state.lastSeekAt = clock.now();
  video.currentTime = state.chunkStart;
  video.playbackRate = rate;
  ourPlay(state, video);
}

function startReplayPassWithGap(state, video, clock, passIdx) {
  const gapSec = (state.strategy === 5) ? Math.max(0, state.replayGap || 0) : 0;
  if (gapSec <= 0) { startReplayPass(state, video, clock, passIdx); return; }
  ourPause(state, video, clock);
  if (state.gapTimer != null) clock.clearTimeout(state.gapTimer);
  const token = ++state.passToken;
  state.gapTimer = clock.setTimeout(() => {
    state.gapTimer = null;
    if (token !== state.passToken) return;
    if (!state.chunkReplaying || state.chunkStart == null) return;
    startReplayPass(state, video, clock, passIdx);
  }, gapSec * 1000);
}

function checkChunkAndReplay(state, video, clock) {
  if (state.strategy !== 3 && state.strategy !== 4 && state.strategy !== 5) return;
  if (!state.chunkReplaying || state.chunkStart == null) return;
  if (state.translationEnabled) {
    for (let i = 0; i < state.cues.length; i++) {
      const c = state.cues[i];
      if (c.start < state.chunkStart - 0.01) continue;
      if (c.start > state.chunkEnd + 0.01) break;
      if (c.trPending) return;
    }
  }
  startReplayPassWithGap(state, video, clock, 1);
}

function replayTick(state, video, clock) {
  if (state.strategy !== 3 && state.strategy !== 4 && state.strategy !== 5) return;
  if (!state.chunkReplaying) return;
  if (state.currentPass < 1) return;
  if (state.chunkEnd == null || state.chunkStart == null) return;
  if (state.gapTimer != null) return;
  const expectedRate = speedForPass(state, state.currentPass);
  if (Math.abs((video.playbackRate || 1) - expectedRate) > 0.01) {
    video.playbackRate = expectedRate;
  }
  if (clock.now() - state.lastSeekAt < 500) return;
  const t = video.currentTime;
  if (t < state.chunkStart - 5 || t > state.chunkEnd + 5) {
    video.playbackRate = 1;
    state.chunkFloor = 0;
    resetChunk(state, clock);
    return;
  }
  if (t < state.chunkEnd) return;
  const next = state.currentPass + 1;
  if (next > maxPasses(state)) {
    video.playbackRate = 1;
    state.chunkFloor = state.chunkEnd;
    resetChunk(state, clock);
    return;
  }
  state.currentPass = next;
  startReplayPassWithGap(state, video, clock, next);
}

// Playhead-driven chunk trigger. Called when the active cue changes.
function onPlayheadCue(state, video, clock, idx) {
  if (idx < 0) return;
  const cue = state.cues[idx];
  if (!cue) return;
  if (state.strategy === 2) {
    if (!state.translationEnabled) return;
    if (!cue.translation) ourPause(state, video);
    return;
  }
  if (state.strategy !== 3 && state.strategy !== 4 && state.strategy !== 5) return;
  if (state.chunkReplaying) return;
  if (cue.start < state.chunkFloor - 0.01) return;
  if (state.chunkStartIdx == null ||
      idx < state.chunkStartIdx ||
      !state.cues[state.chunkStartIdx] ||
      state.cues[state.chunkStartIdx].start < state.chunkFloor - 0.01) {
    state.chunkStartIdx = idx;
  }
  const watched = idx - state.chunkStartIdx + 1;
  if (watched >= state.linesPerChunk) {
    state.chunkStart = state.cues[state.chunkStartIdx].start;
    state.chunkEnd = cue.end || cue.start + 3;
    state.chunkReplaying = true;
    state.currentPass = 0;
    ourPause(state, video);
    checkChunkAndReplay(state, video, clock);
  }
}

function syncHighlight(state, video, clock) {
  replayTick(state, video, clock);
  const t = video.currentTime;
  let lo = 0, hi = state.cues.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = state.cues[mid];
    if (t < c.start) hi = mid - 1;
    else if (t > c.end) lo = mid + 1;
    else { idx = mid; break; }
  }
  if (idx === state.activeIdx) return;
  onPlayheadCue(state, video, clock, idx);
  state.activeIdx = idx;
}

function addCue(state, video, clock, cue) {
  if (!normalizeText(cue.text)) return false;
  if (findDup(state, cue).dup) return false;
  let i = state.cues.length;
  while (i > 0 && state.cues[i - 1].start > cue.start) i--;
  state.cues.splice(i, 0, cue);
  if (state.translationEnabled) {
    const id = state.nextTrId++;
    state.pendingTr[id] = i;
    cue.trPending = true;
    // Caller resolves via resolveTranslation(id, result).
  }
  if (state.chunkStartIdx != null && i <= state.chunkStartIdx) state.chunkStartIdx++;
  // Chunk progression is NOT driven from here (playback-driven instead).
  return true;
}

function resolveTranslation(state, video, clock, id, result) {
  const idx = state.pendingTr[id];
  delete state.pendingTr[id];
  if (idx == null) return;
  const cue = state.cues[idx];
  if (!cue) return;
  cue.trPending = false;
  cue.translation = result;
  if (state.strategy === 2) {
    let blocking = false;
    const t = video.currentTime;
    for (let i = 0; i < state.cues.length; i++) {
      const c = state.cues[i];
      if (c.start > t + 0.5) break;
      if (c.trPending) { blocking = true; break; }
    }
    if (!blocking) ourPlay(state, video);
  } else if (state.strategy >= 3 && state.strategy <= 5) {
    checkChunkAndReplay(state, video, clock);
  }
}

// Test helper: harvest a batch of cues (out of playback order is fine).
function harvest(state, video, clock, cues) {
  const ids = [];
  for (const c of cues) { ids.push(state.nextTrId); addCue(state, video, clock, c); }
  return ids;
}
// Test helper: move the playhead into a cue and fire a timeupdate tick.
function playInto(video, cue) { video.seek(cue.start + 0.1); }

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
const results = { pass: 0, fail: 0, failures: [] };
function test(name, fn) {
  try {
    fn();
    results.pass++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    results.fail++;
    results.failures.push({ name, err: e });
    console.log(`FAIL  ${name}\n  ${(e.message || '').split('\n')[0]}`);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test('Strategy 3 — chunk fires only as the playhead crosses N cues', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 3, linesPerChunk: 3 });
  attachVideo(s, v, clock);
  v.play();

  const A = { start: 10, end: 13, text: 'A' };
  const B = { start: 14, end: 17, text: 'B' };
  const C = { start: 18, end: 21, text: 'C' };
  // Harvest all three up-front (as a streaming track would, ahead of play).
  const ids = harvest(s, v, clock, [A, B, C]);
  for (const id of ids) resolveTranslation(s, v, clock, id, 'tr');

  // Merely harvesting must NOT trigger a chunk.
  assert.equal(s.chunkReplaying, false, 'no chunk from harvest alone');

  // Walk the playhead through the cues.
  playInto(v, A); assert.equal(s.chunkReplaying, false, 'after 1 watched cue');
  playInto(v, B); assert.equal(s.chunkReplaying, false, 'after 2 watched cues');
  playInto(v, C); // 3rd watched cue → chunk full

  assert.equal(s.chunkReplaying, true, 'chunk fires on 3rd watched cue');
  assert.equal(v.currentTime, 10, 'seeked back to chunkStart=10');
  assert.equal(v.playbackRate, 1, 'strategy 3 replays at 1x');
  assert.equal(s.currentPass, 1, 'on the single replay pass');
  assert.equal(v.paused, false);

  // Finish the single pass: past chunkEnd=21 after the seek grace.
  clock.tick(600); v.seek(22);
  assert.equal(s.chunkReplaying, false, 'reset after one pass');
  assert.equal(s.chunkFloor, 21, 'floor set to chunkEnd so we move on');
});

test('Strategy 3 — pauses for untranslated cues, replays once translations land', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 3, linesPerChunk: 2 });
  attachVideo(s, v, clock);
  v.play();
  const A = { start: 0, end: 3, text: 'A' };
  const B = { start: 4, end: 7, text: 'B' };
  const ids = harvest(s, v, clock, [A, B]);
  playInto(v, A); playInto(v, B); // chunk full, but translations pending
  assert.equal(s.chunkReplaying, true);
  assert.equal(v.paused, true, 'paused waiting for translations');
  assert.equal(s.currentPass, 0, 'no pass started yet');
  for (const id of ids) resolveTranslation(s, v, clock, id, 'tr');
  assert.equal(v.currentTime, 0, 'replay seeks back to chunkStart');
  assert.equal(v.paused, false);
  assert.equal(s.currentPass, 1);
});

test('Strategy 4 — single repeat applies schedule[1]', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 4, linesPerChunk: 2, repeatCount: 1, replaySchedule: '1-0.7' });
  attachVideo(s, v, clock);
  v.play();

  const one = { start: 0, end: 3, text: 'one' };
  const two = { start: 3, end: 6, text: 'two' };
  const ids = harvest(s, v, clock, [one, two]);
  for (const id of ids) resolveTranslation(s, v, clock, id, 'tr');
  playInto(v, one); playInto(v, two); // 2 cues watched → chunk full

  assert.equal(s.currentPass, 1, 'should be on pass 1 after replay starts');
  assert.equal(v.playbackRate, 0.7, 'rate should be schedule[1] = 0.7');
  assert.equal(v.currentTime, 0, 'seek-back to chunkStart');
  assert.equal(v.paused, false);

  // Drive past chunkEnd (=6) to finish pass 1, after the 500 ms seek grace.
  clock.tick(600); v.seek(7);
  assert.equal(s.chunkReplaying, false, 'replay should end after single repeat');
  assert.equal(v.playbackRate, 1, 'rate restored to 1 after all passes');
  assert.equal(s.chunkFloor, 6, 'floor advanced to chunkEnd');
});

test('Strategy 4 — two repeats apply schedule per pass', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 4, linesPerChunk: 2, repeatCount: 2, replaySchedule: '1-0.5-0.8' });
  attachVideo(s, v, clock);
  v.play();

  const a = { start: 0, end: 3, text: 'a' };
  const b = { start: 3, end: 6, text: 'b' };
  const ids = harvest(s, v, clock, [a, b]);
  for (const id of ids) resolveTranslation(s, v, clock, id, 'tr');
  playInto(v, a); playInto(v, b); // chunk full

  assert.equal(s.currentPass, 1);
  assert.equal(v.playbackRate, 0.5, 'pass 1 rate = schedule[1] = 0.5');
  clock.tick(600); v.seek(7);
  assert.equal(s.currentPass, 2, 'advance to pass 2');
  assert.equal(v.playbackRate, 0.8, 'pass 2 rate = schedule[2] = 0.8');
  assert.equal(v.currentTime, 0, 'each pass seeks back to chunkStart');
  clock.tick(600); v.seek(7);
  assert.equal(s.chunkReplaying, false);
  assert.equal(v.playbackRate, 1);
});

test('Strategy 4 — schedule last value extends', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 4, linesPerChunk: 1, repeatCount: 3, replaySchedule: '1-0.5' });
  attachVideo(s, v, clock);
  v.play();
  const x = { start: 0, end: 3, text: 'x' };
  const id = harvest(s, v, clock, [x])[0];
  resolveTranslation(s, v, clock, id, 'tr');
  playInto(v, x); // chunk full (1 cue)

  assert.equal(v.playbackRate, 0.5, 'pass 1');
  clock.tick(600); v.seek(4);
  assert.equal(v.playbackRate, 0.5, 'pass 2 uses last schedule value');
  clock.tick(600); v.seek(4);
  assert.equal(v.playbackRate, 0.5, 'pass 3 also uses last schedule value');
  clock.tick(600); v.seek(4);
  assert.equal(s.chunkReplaying, false, 'done after 3 repeats');
});

test('Strategy 5 — inserts gap between passes', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 5, linesPerChunk: 1, repeatCount: 2, replaySchedule: '1-0.7-0.5', replayGap: 2 });
  attachVideo(s, v, clock);
  v.play();
  const x = { start: 0, end: 3, text: 'x' };
  const id = harvest(s, v, clock, [x])[0];
  resolveTranslation(s, v, clock, id, 'tr');
  playInto(v, x); // chunk full

  // First pass should be GAP'd before starting.
  assert.equal(v.paused, true, 'paused during pre-pass gap');
  assert.notEqual(s.gapTimer, null, 'gap timer scheduled');
  assert.equal(s.currentPass, 0, 'still pass 0 during gap');

  clock.tick(2000);
  assert.equal(v.paused, false, 'pass 1 starts after gap');
  assert.equal(v.playbackRate, 0.7);
  assert.equal(s.currentPass, 1);

  clock.tick(600); v.seek(4);
  // Now should be gapping before pass 2.
  assert.equal(v.paused, true, 'paused between passes');
  clock.tick(2000);
  assert.equal(v.paused, false);
  assert.equal(v.playbackRate, 0.5);
  assert.equal(s.currentPass, 2);

  clock.tick(600); v.seek(4);
  assert.equal(s.chunkReplaying, false, 'done after configured repeats');
});

test('Dedup — exact same text within window is rejected', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 3, linesPerChunk: 5, translationEnabled: false });
  attachVideo(s, v, clock);
  addCue(s, v, clock, { start: 0, end: 3, text: 'Hello' });
  addCue(s, v, clock, { start: 2, end: 5, text: 'Hello' });
  assert.equal(s.cues.length, 1);
});

test('Dedup — containment upgrades existing to longer text and counts as one', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 3, linesPerChunk: 5, translationEnabled: false });
  attachVideo(s, v, clock);
  addCue(s, v, clock, { start: 0, end: 3, text: 'Vi måste ta honom' });
  addCue(s, v, clock, { start: 1, end: 4, text: 'Vi måste ta honom på bar gärning.' });
  assert.equal(s.cues.length, 1, 'still one logical cue');
  assert.equal(s.cues[0].text, 'Vi måste ta honom på bar gärning.', 'upgraded to longer text');
});

test('Dedup — far-apart same text is NOT deduped', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 3, linesPerChunk: 5, translationEnabled: false });
  attachVideo(s, v, clock);
  addCue(s, v, clock, { start: 0, end: 3, text: 'Hello' });
  addCue(s, v, clock, { start: 30, end: 33, text: 'Hello' });
  assert.equal(s.cues.length, 2, 'different time → genuinely different cue');
});

test('ourPause consumes its own pause event without marking userOverrode', () => {
  const v = mkVideo();
  const s = mkState();
  attachVideo(s, v, mkClock());
  v.play();
  ourPause(s, v);   // counter→1; pause event fires → counter→0
  assert.equal(s.userOverrode, false, 'ours, not user');
  assert.equal(s.expectedPauses, 0, 'counter drained');
});

test('User pause (no ourPause beforehand) marks userOverrode', () => {
  const v = mkVideo();
  const s = mkState();
  attachVideo(s, v, mkClock());
  v.play();
  v.pause();        // counter is 0 → handler treats as user
  assert.equal(s.userOverrode, true);
  ourPlay(s, v);    // refused
  assert.equal(v.paused, true, 'ourPlay must respect user override');
});

test('Counter does not desync under back-to-back ourPause/ourPlay', () => {
  const v = mkVideo();
  const s = mkState();
  attachVideo(s, v, mkClock());
  v.play();
  ourPause(s, v); ourPlay(s, v); ourPause(s, v); ourPlay(s, v);
  assert.equal(s.expectedPauses, 0);
  assert.equal(s.expectedPlays, 0);
  assert.equal(s.userOverrode, false);
});

test('ourPause on already-paused video does not bump the counter', () => {
  const v = mkVideo();   // starts paused
  const s = mkState();
  attachVideo(s, v, mkClock());
  ourPause(s, v);
  assert.equal(s.expectedPauses, 0, 'no event fires → no counter to drain');
  // A real user pause later must still be detected.
  v.play();
  v.pause();
  assert.equal(s.userOverrode, true);
});

test('Containment line-by-line emits collapse into one logical cue', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 4, linesPerChunk: 3, repeatCount: 1, replaySchedule: '1-0.7', translationEnabled: false });
  attachVideo(s, v, clock);
  v.play();
  // SVT pattern: short version then long version then short again.
  addCue(s, v, clock, { start: 0, end: 3, text: 'Vi måste ta honom' });
  addCue(s, v, clock, { start: 1, end: 4, text: 'Vi måste ta honom på bar gärning.' });
  addCue(s, v, clock, { start: 1.5, end: 4, text: 'Vi måste ta honom' });
  assert.equal(s.cues.length, 1, 'three emits of the same line stay one cue');
});

test('Strategy 4 — stale timeupdate during seek-back does NOT advance pass', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 4, linesPerChunk: 1, repeatCount: 2, replaySchedule: '1-0.5-0.8' });
  attachVideo(s, v, clock);
  v.play();
  const x = { start: 0, end: 3, text: 'x' };
  const id = harvest(s, v, clock, [x])[0];
  resolveTranslation(s, v, clock, id, 'tr');
  playInto(v, x); // chunk full → pass 1; lastSeekAt just set
  assert.equal(s.currentPass, 1);
  // Simulate one stray timeupdate within the seek grace period reporting a
  // currentTime just past chunkEnd (within the ±5 tolerance, so it doesn't
  // trip the user-seek-out-of-chunk escape).
  v.currentTime = 4;
  v.fire('timeupdate');
  assert.equal(s.currentPass, 1, 'pass must not advance within the seek grace period');
  // After 600 ms, advance is allowed.
  clock.tick(600);
  v.currentTime = 4;
  v.fire('timeupdate');
  assert.equal(s.currentPass, 2, 'pass advances after grace period elapses');
});

test('Strategy 4 — playbackRate is re-applied if SVT-side code clobbers it', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 4, linesPerChunk: 1, repeatCount: 1, replaySchedule: '1-0.5' });
  attachVideo(s, v, clock);
  v.play();
  const x = { start: 0, end: 3, text: 'x' };
  const id = harvest(s, v, clock, [x])[0];
  resolveTranslation(s, v, clock, id, 'tr');
  playInto(v, x); // chunk full → pass 1 at 0.5x
  assert.equal(v.playbackRate, 0.5);
  // SVT's own speed selector resets the video's rate mid-pass.
  v.playbackRate = 1;
  // Past the seek grace period.
  clock.tick(600);
  v.advance(0.1); // any timeupdate during the pass
  assert.equal(v.playbackRate, 0.5, 'expected rate should be restored');
});

test('Strategy 4 + Strategy 5 should NOT advance pass while in pre-pass gap', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 5, linesPerChunk: 1, repeatCount: 2, replaySchedule: '1-0.5-0.8', replayGap: 5 });
  attachVideo(s, v, clock);
  v.play();
  const x = { start: 0, end: 3, text: 'x' };
  const id = harvest(s, v, clock, [x])[0];
  resolveTranslation(s, v, clock, id, 'tr');
  playInto(v, x); // chunk full → enters pre-pass gap

  // Mid-gap, simulate a stray timeupdate (e.g. seek event noise).
  v.fire('timeupdate');
  assert.equal(s.currentPass, 0, 'pass should NOT advance during gap');
  clock.tick(5000);
  assert.equal(s.currentPass, 1);
});

test('Buffered cues ahead of the playhead do NOT trigger replay (the jump bug)', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 3, linesPerChunk: 1, translationEnabled: false });
  attachVideo(s, v, clock);
  v.play();
  // Streaming track dumps many future cues into the list while the playhead
  // sits at the first one. This is exactly the log scenario: harvest far
  // ahead of playback. None of these may fire a chunk on arrival.
  harvest(s, v, clock, [
    { start: 391, end: 395, text: 'a' },
    { start: 396, end: 400, text: 'b' },
    { start: 413, end: 418, text: 'c' },
    { start: 418, end: 421, text: 'd' },
  ]);
  assert.equal(s.chunkReplaying, false, 'harvest of buffered cues must not start a chunk');
  assert.equal(s.chunkStartIdx, null, 'no chunk anchored from arrival');

  // Only when the playhead actually enters the first cue does a chunk begin.
  v.seek(392);
  assert.equal(s.chunkReplaying, true, 'chunk fires from playback, once');
  assert.equal(v.currentTime, 391, 'replay from the cue the playhead reached');
});

test('Chunks advance through the video one region at a time (no infinite loop)', () => {
  const v = mkVideo(); const clock = mkClock();
  const s = mkState({ strategy: 4, linesPerChunk: 2, repeatCount: 1, replaySchedule: '1-1', translationEnabled: false });
  attachVideo(s, v, clock);
  v.play();
  const cues = [
    { start: 0,  end: 3,  text: 'a' },
    { start: 3,  end: 6,  text: 'b' },
    { start: 6,  end: 9,  text: 'c' },
    { start: 9,  end: 12, text: 'd' },
  ];
  harvest(s, v, clock, cues);

  // Watch cues a,b → chunk [0,6] fires.
  playInto(v, cues[0]); playInto(v, cues[1]);
  assert.equal(s.chunkReplaying, true, 'first chunk');
  assert.equal(s.chunkStart, 0);
  // Finish the single replay pass.
  clock.tick(600); v.seek(7);
  assert.equal(s.chunkReplaying, false, 'first chunk done');
  assert.equal(s.chunkFloor, 6, 'floor at end of first chunk');

  // Re-entering the replayed region must NOT start a new chunk.
  playInto(v, cues[0]);
  assert.equal(s.chunkReplaying, false, 'replayed region is floored off');

  // Watching the NEXT two cues (c,d) starts the second chunk.
  playInto(v, cues[2]); playInto(v, cues[3]);
  assert.equal(s.chunkReplaying, true, 'second chunk');
  assert.equal(s.chunkStart, 6, 'anchored at first un-floored cue');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${results.pass} passed, ${results.fail} failed`);
if (results.fail) {
  for (const f of results.failures) {
    console.log(`\n--- ${f.name} ---`);
    console.log(f.err.stack || f.err.message);
  }
  process.exit(1);
}
