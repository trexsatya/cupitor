# Music Study App — M2 Plan 3: Playback (`music-player.js`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play a piece (or a matched measure-range segment) as MIDI via a vendored Tone.js, with play/pause/stop/loop and an OSMD cursor that follows, plus YouTube IFrame control for linked video.

**Architecture:** A pure, TDD'd schedule builder (`buildSchedule`) turns the encoded primary-voice notes + tempo into `[{midi, time, duration}]`. Thin browser wrappers (`createMusicPlayer` over Tone.js, `createYouTubeController` over the YT IFrame API) consume that schedule and drive audio + the existing OSMD cursor — browser-verified, not unit-tested. A minimal transport is wired into the existing Manager Preview panel so it's demonstrable now; the full Layout-C transport is Phase 6.

**Tech Stack:** Vanilla ES modules; vendored Tone.js v15 UMD (`public/vendor/tone.js`, global `Tone`); YouTube IFrame API; OSMD cursor from `music-render.js`; Jest + jsdom + Babel for the pure functions.

**Spec:** `docs/superpowers/specs/2026-06-20-music-study-app-m2-rendering-search-design.md` §6 (Phase 3 — Playback), §10 (cross-cutting: vendor Tone.js; tempo from `meta.tempo` else 90 BPM).

**Test runner:** `npx jest public/<file>.test.js`.

**Grounded facts (from the M1 encoder, verified):**
- A detail's `voices[i]` has index-aligned arrays. `pitch[]` = **MIDI numbers**. `duration[]` = the MusicXML `<type>` **string** (`"quarter"`, `"eighth"`, `"half"`, `"16th"`, …) or `null` for note-text pieces. `measureIndex[]` = **1-based** measure number. Rests are NOT encoded (only sounded notes), so cross-voice timing can't be reconstructed — **schedule the primary voice only** (multi-voice polyphony is deferred).
- `meta.tempo` = a BPM number or `null` (Phase 0 parses `<sound tempo>`).
- `primaryVoice({ voices })` (exported from `music-encoding.js`) returns the voice with the most notes (or an empty-voice shape). Reuse it.
- OSMD cursor API (per `guitar.js`): `cursor.reset()`, `cursor.show()`, `cursor.next()`, `cursor.hide()`. `createMusicRenderer` (Plan 2) exposes the OSMD instance as `renderer.osmd`, so the cursor is `renderer.osmd.cursor`.
- YT IFrame API (per `language.js`): `new YT.Player(el, {videoId, events})`, `playVideo()`, `pauseVideo()`, `seekTo(sec, true)`, `getDuration()`; player states 1=playing, 2=paused.

**Test economy (standing user instruction):** write only tests that pin real behavior. The two pure functions get focused tests; the Tone/YT/cursor wrappers are browser-verified (no unit tests) — faking Tone's audio graph would be brittle noise.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `public/vendor/tone.js` | Vendored Tone.js v15 UMD build (global `Tone`); offline playback on gh-pages. |
| Create | `public/music-player.js` | Pure `buildSchedule` + `NOTE_TYPE_BEATS` + `parseYouTubeId`; browser wrappers `createMusicPlayer` (Tone) and `createYouTubeController` (YT). |
| Create | `public/music-player.test.js` | Tests for `buildSchedule` and `parseYouTubeId` only. |
| Modify | `public/music.html` | Load `tone.js` + YT IFrame API; add a transport (MIDI/YouTube, play/pause/stop, loop, tempo) to the Preview panel; wire to the player + buildSchedule + renderer cursor. |

---

## Task 1: Vendor Tone.js

**Files:** Create `public/vendor/tone.js`.

- [ ] **Step 1: Download and extract the UMD build**

Run (from the repo root):
```bash
TMP=$(mktemp -d) && ( cd "$TMP" && npm pack tone@15.1.22 >/dev/null 2>&1 && tar -xzf tone-15.1.22.tgz ) && cp "$TMP/package/build/Tone.js" public/vendor/tone.js && rm -rf "$TMP" && echo "vendored: $(wc -c < public/vendor/tone.js) bytes"
```
Expected: prints `vendored: <~345500> bytes`, and `public/vendor/tone.js` now exists.

- [ ] **Step 2: Verify it's the UMD global build**

Run:
```bash
head -c 600 public/vendor/tone.js
grep -c "exports.*Tone\|global.*Tone\|factory" public/vendor/tone.js | head -1
```
Expected: the file header shows a UMD wrapper `(function (global, factory) { ... })` and references to `Tone`. (This is the bundle the `unpkg` field points to; loading it via `<script>` defines `window.Tone`.)

- [ ] **Step 3: Commit**

```bash
git add public/vendor/tone.js
git commit -m "chore(music): vendor Tone.js v15.1.22 UMD build for MIDI playback"
```

(No automated test — this is a vendored binary asset, verified in the browser in Task 6.)

---

## Task 2: Pure `buildSchedule` + `NOTE_TYPE_BEATS`

**Files:** Create `public/music-player.js`, create `public/music-player.test.js`.

- [ ] **Step 1: Write the failing test** — create `public/music-player.test.js`:

```js
// public/music-player.test.js
import { buildSchedule, NOTE_TYPE_BEATS, parseYouTubeId } from './music-player.js';

// Primary voice = the one with the most notes. midi=pitch, duration=<type> string|null, measureIndex 1-based.
function voice(pitch, duration, measureIndex) {
  return [{ pitch, interval: [], sargam: [], duration, chordSymbol: [], lyric: [], measureIndex }];
}

describe('buildSchedule', () => {
  test('maps note types to cumulative times + durations at the given tempo', () => {
    // 120 BPM → 0.5s per quarter beat. quarter(1b)=0.5s, eighth(0.5b)=0.25s, half(2b)=1.0s
    const v = voice([60, 62, 64], ['quarter', 'eighth', 'half'], [1, 1, 1]);
    const s = buildSchedule(v, { tempo: 120 });
    expect(s).toEqual([
      { midi: 60, time: 0,    duration: 0.5 },
      { midi: 62, time: 0.5,  duration: 0.25 },
      { midi: 64, time: 0.75, duration: 1.0 },
    ]);
  });

  test('null/unknown durations default to a quarter beat (note-text pieces)', () => {
    const v = voice([60, 62], [null, 'bogus'], [1, 1]);
    const s = buildSchedule(v, { tempo: 60 }); // 1s per quarter
    expect(s).toEqual([
      { midi: 60, time: 0, duration: 1 },
      { midi: 62, time: 1, duration: 1 },
    ]);
  });

  test('segment filter keeps only notes in [fromMeasure,toMeasure] and re-zeros the start to 0', () => {
    const v = voice([60, 62, 64, 65], ['quarter', 'quarter', 'quarter', 'quarter'], [1, 2, 2, 3]);
    const s = buildSchedule(v, { tempo: 60, fromMeasure: 2, toMeasure: 2 });
    expect(s).toEqual([
      { midi: 62, time: 0, duration: 1 },
      { midi: 64, time: 1, duration: 1 },
    ]);
  });

  test('null/zero tempo falls back to 90 BPM; empty voices → []', () => {
    const v = voice([60], ['quarter'], [1]);
    const s = buildSchedule(v, { tempo: null });
    expect(s[0].duration).toBeCloseTo(60 / 90, 5);
    expect(buildSchedule([], {})).toEqual([]);
    expect(buildSchedule(null, {})).toEqual([]);
  });

  test('picks the voice with the most notes', () => {
    const voices = [
      { pitch: [60], duration: ['quarter'], measureIndex: [1], interval: [], sargam: [], chordSymbol: [], lyric: [] },
      { pitch: [62, 64, 65], duration: ['quarter', 'quarter', 'quarter'], measureIndex: [1, 1, 1], interval: [], sargam: [], chordSymbol: [], lyric: [] },
    ];
    const s = buildSchedule(voices, { tempo: 60 });
    expect(s.map(e => e.midi)).toEqual([62, 64, 65]);
  });
});
```

- [ ] **Step 2: Run the test, verify it FAILS**

Run: `npx jest public/music-player.test.js -t buildSchedule`
Expected: FAIL — module/function not defined.

- [ ] **Step 3: Implement** — create `public/music-player.js` with the pure layer:

```js
// public/music-player.js
// Playback: a pure schedule builder over the encoded primary voice, plus thin
// browser wrappers over Tone.js (MIDI) and the YouTube IFrame API. Only the pure
// functions are unit-tested; the audio/video wrappers are browser-verified.
import { primaryVoice } from './music-encoding.js';

// Note <type> → beats, where a quarter note = 1 beat (matches quarter-note BPM tempo).
export const NOTE_TYPE_BEATS = {
  breve: 8, whole: 4, half: 2, quarter: 1, eighth: 0.5,
  '16th': 0.25, '32nd': 0.125, '64th': 0.0625, '128th': 0.03125,
};
const DEFAULT_BEATS = 1; // quarter, used when duration is null/unknown (e.g. note-text)

// Pure: turn the primary voice into [{ midi, time, duration }] (seconds), optionally
// restricted to a measure range and re-zeroed so the segment starts at t=0.
export function buildSchedule(voices, opts = {}) {
  const v = primaryVoice({ voices: voices || [] });
  const bpm = (opts.tempo && opts.tempo > 0) ? opts.tempo : 90;
  const spb = 60 / bpm;
  const from = (opts.fromMeasure == null) ? -Infinity : opts.fromMeasure;
  const to = (opts.toMeasure == null) ? Infinity : opts.toMeasure;
  const out = [];
  let t = 0;
  for (let i = 0; i < v.pitch.length; i++) {
    const beats = NOTE_TYPE_BEATS[v.duration[i]] ?? DEFAULT_BEATS;
    const dur = beats * spb;
    const m = v.measureIndex[i];
    if (m >= from && m <= to) out.push({ midi: v.pitch[i], time: t, duration: dur });
    t += dur;
  }
  if (out.length) {
    const t0 = out[0].time;
    for (const e of out) e.time = Number((e.time - t0).toFixed(6));
  }
  return out;
}
```

(`parseYouTubeId` and the browser wrappers are added in later tasks — keep this file importable now.)

- [ ] **Step 4: Run the test, verify it PASSES**

Run: `npx jest public/music-player.test.js -t buildSchedule`
Expected: PASS — 5 tests green. (Note: the `parseYouTubeId` import resolves to `undefined` until Task 3, but the `buildSchedule` tests don't call it, so they pass.)

- [ ] **Step 5: Commit**

```bash
git add public/music-player.js public/music-player.test.js
git commit -m "feat(music): pure buildSchedule (primary-voice MIDI schedule from note types + tempo)"
```

---

## Task 3: Pure `parseYouTubeId`

**Files:** Modify `public/music-player.js`, modify `public/music-player.test.js`.

- [ ] **Step 1: Write the failing test** — APPEND to `public/music-player.test.js`:

```js
describe('parseYouTubeId', () => {
  test('extracts the 11-char id from common URL shapes', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=xyz')).toBe('dQw4w9WgXcQ');
  });

  test('returns null for non-YouTube or id-less input', () => {
    expect(parseYouTubeId('https://example.com/video')).toBeNull();
    expect(parseYouTubeId('')).toBeNull();
    expect(parseYouTubeId(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test, verify it FAILS**

Run: `npx jest public/music-player.test.js -t parseYouTubeId`
Expected: FAIL — `parseYouTubeId` is not a function.

- [ ] **Step 3: Implement** — add to `public/music-player.js` (after `buildSchedule`):

```js
// Pure: extract a YouTube video id from watch / youtu.be / embed / music URLs. Null if none.
export function parseYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  let m = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  m = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  m = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return null;
}
```

- [ ] **Step 4: Run the test, verify it PASSES**

Run: `npx jest public/music-player.test.js`
Expected: PASS — all `buildSchedule` + `parseYouTubeId` tests green (7 total).

- [ ] **Step 5: Commit**

```bash
git add public/music-player.js public/music-player.test.js
git commit -m "feat(music): parseYouTubeId helper"
```

---

## Task 4: Browser wrapper `createMusicPlayer` (Tone.js)

**Files:** Modify `public/music-player.js`. No unit test (browser glue over Tone's audio graph; verified in Task 6).

- [ ] **Step 1: Implement** — add to `public/music-player.js`:

```js
// Browser glue: drive Tone.js from a buildSchedule() result and follow with the OSMD cursor.
// opts.Tone defaults to the global Tone (vendored UMD). opts.getCursor returns the OSMD
// cursor (or null) lazily so the player isn't coupled to a specific renderer instance.
export function createMusicPlayer({ Tone, getCursor } = {}) {
  const T = Tone || (typeof globalThis !== 'undefined' ? globalThis.Tone : undefined);
  if (!T) throw new Error('Tone.js is not available');
  const synth = new T.PolySynth(T.Synth).toDestination();
  let part = null;
  let schedule = [];

  function disposePart() { if (part) { part.stop(); part.dispose(); part = null; } }

  function buildPart() {
    disposePart();
    const cursor = getCursor && getCursor();
    if (cursor) { try { cursor.reset(); cursor.show(); } catch (_) {} }
    part = new T.Part((time, ev) => {
      synth.triggerAttackRelease(T.Frequency(ev.midi, 'midi').toNote(), ev.duration, time);
      if (cursor) T.Draw.schedule(() => { try { cursor.next(); } catch (_) {} }, time);
    }, schedule.map(e => [e.time, e]));
    const last = schedule[schedule.length - 1];
    part.loopEnd = last ? last.time + last.duration : 0;
    return part;
  }

  return {
    synth,
    setSchedule(s) { schedule = s || []; buildPart(); },
    setLoop(on) { if (part) part.loop = !!on; },
    async play() {
      await T.start();
      if (!part) buildPart();
      T.Transport.start();
      part.start(0);
    },
    pause() { T.Transport.pause(); },
    stop() {
      T.Transport.stop();
      if (part) part.stop();
      const c = getCursor && getCursor();
      if (c) { try { c.reset(); c.hide(); } catch (_) {} }
    },
  };
}
```

- [ ] **Step 2: Syntax-check the module**

Run: `node --check public/music-player.js`
Expected: exit 0, no output.

- [ ] **Step 3: Confirm the pure tests still pass**

Run: `npx jest public/music-player.test.js`
Expected: PASS — 7 tests (adding the wrapper must not affect them).

- [ ] **Step 4: Commit**

```bash
git add public/music-player.js
git commit -m "feat(music): createMusicPlayer — Tone.js transport + OSMD cursor follow"
```

---

## Task 5: Browser wrapper `createYouTubeController`

**Files:** Modify `public/music-player.js`. No unit test (browser glue over the YT IFrame API).

- [ ] **Step 1: Implement** — add to `public/music-player.js`:

```js
// Browser glue: control a linked YouTube video via the IFrame API. `container` is an
// element or element id. opts.YT defaults to the global YT (loaded via iframe_api).
export function createYouTubeController(container, { YT } = {}) {
  const Y = YT || (typeof globalThis !== 'undefined' ? globalThis.YT : undefined);
  let player = null;
  return {
    load(videoId) {
      if (!Y || !Y.Player) throw new Error('YouTube IFrame API not loaded');
      if (player && typeof player.cueVideoById === 'function') { player.cueVideoById(videoId); return; }
      player = new Y.Player(container, { videoId, events: {} });
    },
    play() { if (player) player.playVideo(); },
    pause() { if (player) player.pauseVideo(); },
    seekTo(seconds) { if (player) player.seekTo(seconds, true); },
    getDuration() { return player && player.getDuration ? player.getDuration() : 0; },
    get raw() { return player; },
  };
}
```

- [ ] **Step 2: Syntax-check the module**

Run: `node --check public/music-player.js`
Expected: exit 0.

- [ ] **Step 3: Confirm pure tests still pass**

Run: `npx jest public/music-player.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 4: Commit**

```bash
git add public/music-player.js
git commit -m "feat(music): createYouTubeController — YT IFrame play/pause/seek wrapper"
```

---

## Task 6: Wire a transport into the Manager Preview panel

**Files:** Modify `public/music.html`. No unit tests (DOM glue); verified by `node --check`, the full Jest suite staying green, and a manual browser pass.

Read `public/music.html` first to confirm the exact snippets below before editing.

- [ ] **Step 1: Load Tone.js and the YouTube IFrame API**

FIND:
```
    <script src="/github-utils.js"></script>
    <script src="/vendor/opensheetmusicdisplay.min.js"></script>
```
REPLACE:
```
    <script src="/github-utils.js"></script>
    <script src="/vendor/opensheetmusicdisplay.min.js"></script>
    <script src="/vendor/tone.js"></script>
    <script src="https://www.youtube.com/iframe_api"></script>
```

- [ ] **Step 2: Add transport controls + a YouTube container to the Preview panel**

FIND:
```
    <button id="previewCloseBtn">Close</button>
    <span id="previewMsg"></span>
  </div>
  <div id="osmdPreview"></div>
</div>
```
REPLACE:
```
    <button id="previewCloseBtn">Close</button>
    <span id="previewMsg"></span>
  </div>
  <div id="transport" style="margin:.5rem 0">
    <select id="srcSel"><option value="midi">MIDI</option><option value="youtube">YouTube</option></select>
    <button id="playBtn">▶ Play</button>
    <button id="pauseBtn">⏸ Pause</button>
    <button id="stopBtn">⏹ Stop</button>
    <label><input type="checkbox" id="loopChk"> Loop segment</label>
    <label>Tempo <input id="tempoInput" type="number" min="20" max="300" style="width:4em"></label>
    <span id="transportMsg"></span>
  </div>
  <div id="osmdPreview"></div>
  <div id="ytPlayer" style="display:none"></div>
</div>
```

- [ ] **Step 3: Import the player module**

FIND:
```
  import { createMusicRenderer } from './music-render.js';
  import { createMusicStore } from './music-local-store.js';
```
REPLACE:
```
  import { createMusicRenderer } from './music-render.js';
  import { createMusicStore } from './music-local-store.js';
  import { buildSchedule, createMusicPlayer, createYouTubeController, parseYouTubeId } from './music-player.js';
```

- [ ] **Step 4: Add player state + wiring after the renderer helpers**

FIND:
```
  let renderer = null;
  function ensureRenderer() {
    if (!renderer) renderer = createMusicRenderer(document.getElementById('osmdPreview'));
    return renderer;
  }
```
REPLACE:
```
  let renderer = null;
  function ensureRenderer() {
    if (!renderer) renderer = createMusicRenderer(document.getElementById('osmdPreview'));
    return renderer;
  }

  let player = null, yt = null, currentDetail = null;
  function ensurePlayer() {
    if (!player) player = createMusicPlayer({ getCursor: () => (renderer && renderer.osmd ? renderer.osmd.cursor : null) });
    return player;
  }
  function segmentRange() {
    const from = parseInt(document.getElementById('segFrom').value, 10);
    const to = parseInt(document.getElementById('segTo').value, 10);
    return (Number.isFinite(from) && Number.isFinite(to)) ? { fromMeasure: from, toMeasure: to } : {};
  }
  function currentTempo() {
    const t = parseInt(document.getElementById('tempoInput').value, 10);
    return Number.isFinite(t) && t > 0 ? t : 90;
  }
  function playMidi() {
    if (!currentDetail) return;
    const schedule = buildSchedule(currentDetail.voices, { tempo: currentTempo(), ...segmentRange() });
    if (!schedule.length) { document.getElementById('transportMsg').textContent = 'Nothing to play.'; return; }
    const p = ensurePlayer();
    p.setSchedule(schedule);
    p.setLoop(document.getElementById('loopChk').checked);
    p.play();
    document.getElementById('transportMsg').textContent = `Playing ${schedule.length} notes`;
  }
  function playYouTube() {
    const url = currentDetail && currentDetail.meta && currentDetail.meta.youtube;
    const id = parseYouTubeId(url);
    if (!id) { document.getElementById('transportMsg').textContent = 'No linked YouTube video.'; return; }
    document.getElementById('ytPlayer').style.display = '';
    if (!yt) yt = createYouTubeController('ytPlayer');
    try { yt.load(id); yt.play(); document.getElementById('transportMsg').textContent = 'Playing YouTube'; }
    catch (e) { document.getElementById('transportMsg').textContent = 'YouTube error: ' + e.message; }
  }
  document.getElementById('playBtn').onclick = () =>
    (document.getElementById('srcSel').value === 'youtube' ? playYouTube() : playMidi());
  document.getElementById('pauseBtn').onclick = () => {
    if (document.getElementById('srcSel').value === 'youtube') { if (yt) yt.pause(); }
    else if (player) player.pause();
  };
  document.getElementById('stopBtn').onclick = () => {
    if (player) player.stop();
    if (yt) yt.pause();
    document.getElementById('transportMsg').textContent = '';
  };
```

- [ ] **Step 5: Capture the detail + initialise tempo when a preview opens**

In `openPreview`, FIND:
```
    if (!res.ok) { document.getElementById('previewMsg').textContent = 'Cannot render (note-text piece).'; return; }
    renderer.applyResponsiveZoom(document.getElementById('osmdPreview').clientWidth || window.innerWidth);
    renderer.showFull();
    document.getElementById('previewMsg').textContent = `${res.totalMeasures} measures`;
```
REPLACE:
```
    if (!res.ok) { document.getElementById('previewMsg').textContent = 'Cannot render (note-text piece).'; return; }
    currentDetail = detail;
    document.getElementById('tempoInput').value = (detail.meta && detail.meta.tempo) || 90;
    if (player) player.stop();
    renderer.applyResponsiveZoom(document.getElementById('osmdPreview').clientWidth || window.innerWidth);
    renderer.showFull();
    document.getElementById('previewMsg').textContent = `${res.totalMeasures} measures`;
```

Note: note-text pieces return early (`!res.ok`) before `currentDetail` is set, so MIDI playback only applies to rendered MusicXML pieces — acceptable for this minimal transport (note-text MIDI playback can come with the Phase 6 detail view, which renders differently).

- [ ] **Step 6: Stop playback when the preview closes**

FIND:
```
  document.getElementById('previewCloseBtn').onclick = () => { document.getElementById('musicPreview').style.display = 'none'; };
```
REPLACE:
```
  document.getElementById('previewCloseBtn').onclick = () => {
    if (player) player.stop();
    document.getElementById('musicPreview').style.display = 'none';
  };
```

- [ ] **Step 7: Syntax-check the inline module**

Run:
```bash
F="$(node -e "const os=require('os'),p=require('path');console.log(p.join(os.tmpdir(),'music_mod_p3.mjs'))")"
node -e "const fs=require('fs');const h=fs.readFileSync('public/music.html','utf8');const m=h.match(/<script type=\"module\">([\s\S]*?)<\/script>/);fs.writeFileSync(process.argv[1],m[1]);" "$F"
node --check "$F" && echo "SYNTAX OK" && rm -f "$F"
```
Expected: `SYNTAX OK`. (Uses `os.tmpdir()` so it works under the sandbox's writable temp dir.)

- [ ] **Step 8: Run the full suite — no regressions**

Run: `npx jest public/ 2>&1 | tail -6`
Expected: same baseline — all pass except the single pre-existing `public/music_search.test.js` "9. Too large jump → should fail".

- [ ] **Step 9: Commit**

```bash
git add public/music.html
git commit -m "feat(music): minimal MIDI/YouTube transport in the Preview panel (M2 Phase 3)"
```

- [ ] **Step 10: Manual browser verification (human step)**

1. `npx vue-cli-service serve`, open `music.html?system=western`, Preview a MusicXML piece.
2. Tempo field shows the piece's tempo (or 90). Click **▶ Play** (MIDI) → audio plays and the OSMD cursor advances; **⏸ Pause** / **⏹ Stop** work; **Stop** resets the cursor.
3. Enter a segment (e.g. `3`–`6`), check **Loop segment**, **▶ Play** → only those measures play and loop.
4. Change Tempo and Play → tempo changes.
5. For a piece with a linked YouTube URL (`meta.youtube`), switch the source to **YouTube** → ▶ loads + plays the video; ⏸ pauses. (Without a linked video, status shows "No linked YouTube video.")

---

## Notes for the implementer

- **Primary voice only:** `buildSchedule` schedules the primary voice. Multi-voice polyphony is deliberately deferred (rests aren't encoded, so cross-voice timing can't be reconstructed) — do not attempt to schedule all voices.
- **No tests for the Tone/YT wrappers:** they're browser glue; faking Tone's audio graph is brittle and out of scope per the test-economy instruction. Only `buildSchedule` and `parseYouTubeId` are unit-tested.
- **Tempo changes rebuild the schedule:** the player plays absolute-second schedules, so changing tempo means calling `buildSchedule` again with the new tempo and `setSchedule` — which `playMidi()` already does on every Play. Do not add a `setTempo` to the player.
- **Don't break the offline-cache wiring** added in the previous plan (store, badges, retry, preview-from-local). The Task 5/6 edits only ADD transport state and controls.
