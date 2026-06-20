# Music Study App — M2.1: Instruments + Vocabulary View + YouTube Segment Playback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give MIDI playback distinct instrument voices (from `meta.instrument`, overridable), render the captured vocabulary, and make YouTube play the selected segment (fixing the `playVideo is not a function` readiness bug).

**Architecture:** Two pure helpers TDD'd (`instrumentVoiceKey`, `groupVocabByCategory`); the Tone voice factory + `setInstrument`, the reworked readiness-gated `createYouTubeController`, and the `music.html` wiring are browser glue (`node --check` + manual).

**Tech Stack:** Vanilla ES modules; Tone.js (vendored); YouTube IFrame API; Jest + jsdom + Babel for the pure helpers. No new deps/assets.

**Spec:** `docs/superpowers/specs/2026-06-20-music-study-app-m2.1-instruments-vocab-youtube-design.md`.

**Test runner:** `npx jest public/<file>.test.js`.

**Grounded current code (`public/music-player.js`):**
- `createMusicPlayer`: `const synth = new T.PolySynth(T.Synth).toDestination();` (line 56); the `Part` callback calls `synth.triggerAttackRelease(...)`; the returned object exposes `synth, setSchedule, setLoop, play, pause, stop`.
- `createYouTubeController(container, { YT } = {})`: `load(videoId)` does `cueVideoById` if a player exists else `new Y.Player(container, { videoId, events: {} })`; `play/pause/seekTo/getDuration` call the player methods directly (the bug: methods don't exist until `onReady`).

**Test economy (standing instruction):** TDD only the two pure helpers; glue is browser-verified.

---

## Task 1: Pure `instrumentVoiceKey` (`music-player.js`)

**Files:** Modify `public/music-player.js`, `public/music-player.test.js`.

- [ ] **Step 1: Write the failing test** — APPEND to `public/music-player.test.js` (add `instrumentVoiceKey` to the existing import from `./music-player.js`):

```js
describe('instrumentVoiceKey', () => {
  test('maps instrument names to a voice category', () => {
    expect(instrumentVoiceKey('Piano')).toBe('piano');
    expect(instrumentVoiceKey('Harpsichord')).toBe('piano');
    expect(instrumentVoiceKey('Acoustic Guitar')).toBe('guitar');
    expect(instrumentVoiceKey('Violin')).toBe('strings');
    expect(instrumentVoiceKey('Cello')).toBe('strings');
    expect(instrumentVoiceKey('Pipe Organ')).toBe('organ');
  });
  test('unknown / empty / null → synth', () => {
    expect(instrumentVoiceKey('Trumpet')).toBe('synth');
    expect(instrumentVoiceKey('')).toBe('synth');
    expect(instrumentVoiceKey(null)).toBe('synth');
    expect(instrumentVoiceKey(undefined)).toBe('synth');
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx jest public/music-player.test.js -t instrumentVoiceKey`.

- [ ] **Step 3: Implement** — add to `public/music-player.js` (after `parseYouTubeId`):

```js
// Pure: map a (free-text) instrument name to a playback voice category.
export function instrumentVoiceKey(name) {
  const s = String(name || '').toLowerCase();
  if (/piano|keyboard|harpsichord|clav/.test(s)) return 'piano';
  if (/guitar|pluck|lute|harp|mandolin|banjo/.test(s)) return 'guitar';
  if (/violin|viola|cello|bass|string|fiddle/.test(s)) return 'strings';
  if (/organ|accordion|harmonium/.test(s)) return 'organ';
  return 'synth';
}
```

- [ ] **Step 4: Run, verify PASS** — `npx jest public/music-player.test.js` → all pass (2 new + existing 7).

- [ ] **Step 5: Commit**

```bash
git add public/music-player.js public/music-player.test.js
git commit -m "feat(music): instrumentVoiceKey — map instrument name to a voice category"
```

---

## Task 2: Voice factory + `setInstrument` in `createMusicPlayer` (glue)

**Files:** Modify `public/music-player.js`. No unit test (Tone glue).

- [ ] **Step 1: Replace the fixed synth with a category voice factory**

FIND:
```
  const synth = new T.PolySynth(T.Synth).toDestination();
  let part = null;
  let schedule = [];
```
REPLACE:
```
  // Distinct timbres per category using standard Tone voices (no samples). Guitar uses
  // the monophonic PluckSynth — fine for the melodic primary voice we schedule.
  function makeVoice(category) {
    switch (category) {
      case 'guitar':  return new T.PluckSynth().toDestination();
      case 'strings': return new T.PolySynth(T.AMSynth).toDestination();
      case 'organ':   return new T.PolySynth(T.FMSynth).toDestination();
      case 'piano':
      case 'synth':
      default:        return new T.PolySynth(T.Synth).toDestination();
    }
  }
  let synth = makeVoice('synth');
  let part = null;
  let schedule = [];
```

- [ ] **Step 2: Expose `setInstrument` and drop the stale `synth` property**

FIND:
```
  return {
    synth,
    setSchedule(s) { schedule = s || []; buildPart(); },
    setLoop(on) { if (part) part.loop = !!on; },
```
REPLACE:
```
  return {
    setSchedule(s) { schedule = s || []; buildPart(); },
    setLoop(on) { if (part) part.loop = !!on; },
    setInstrument(category) {
      const next = makeVoice(category);
      if (synth && synth.dispose) synth.dispose();
      synth = next;   // the Part callback closes over `synth`, so the new voice is used immediately
    },
```

(The `Part` callback references the `synth` variable, now reassignable — no Part rebuild needed.)

- [ ] **Step 3: Syntax-check + pure tests still pass**

Run: `node --check public/music-player.js && npx jest public/music-player.test.js`
Expected: exit 0; all `buildSchedule`/`parseYouTubeId`/`instrumentVoiceKey` tests still pass.

- [ ] **Step 4: Commit**

```bash
git add public/music-player.js
git commit -m "feat(music): per-instrument Tone voices + setInstrument on the player"
```

---

## Task 3: Rework `createYouTubeController` for readiness + segment start (glue)

**Files:** Modify `public/music-player.js`. No unit test (YT IFrame glue).

- [ ] **Step 1: Replace the controller**

FIND:
```
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
REPLACE:
```
export function createYouTubeController(container, { YT, onReady } = {}) {
  const Y = YT || (typeof globalThis !== 'undefined' ? globalThis.YT : undefined);
  let player = null;
  let ready = false;
  const pending = [];
  const run = (fn) => { if (ready && player) fn(); else pending.push(fn); };
  const flush = () => { while (pending.length) { try { pending.shift()(); } catch (_) {} } };
  return {
    // First call constructs the player (methods exist only after onReady, so play/seek are
    // queued until then); later calls swap the video via loadVideoById (loads + plays).
    load(videoId, startSeconds) {
      if (!Y || !Y.Player) throw new Error('YouTube IFrame API not loaded');
      const start = Math.floor(startSeconds || 0);
      if (player && typeof player.loadVideoById === 'function') {
        player.loadVideoById({ videoId, startSeconds: start });
        return;
      }
      ready = false;
      player = new Y.Player(container, {
        videoId,
        playerVars: { start },
        events: { onReady: () => { ready = true; if (onReady) { try { onReady(); } catch (_) {} } flush(); } },
      });
    },
    play() { run(() => player.playVideo()); },
    pause() { run(() => player.pauseVideo()); },
    seekTo(seconds) { run(() => player.seekTo(seconds, true)); },
    getDuration() { return (ready && player && player.getDuration) ? player.getDuration() : 0; },
    isReady() { return ready; },
    get raw() { return player; },
  };
}
```

- [ ] **Step 2: Syntax-check + pure tests still pass**

Run: `node --check public/music-player.js && npx jest public/music-player.test.js`
Expected: exit 0; all pure tests pass.

- [ ] **Step 3: Commit**

```bash
git add public/music-player.js
git commit -m "fix(music): YouTube controller — defer play/seek until onReady; support segment start"
```

---

## Task 4: Pure `groupVocabByCategory` (`music-vocab.js`)

**Files:** Modify `public/music-vocab.js`, `public/music-vocab.test.js`.

- [ ] **Step 1: Write the failing test** — APPEND to `public/music-vocab.test.js` (add `groupVocabByCategory` to the existing import from `./music-vocab.js`):

```js
describe('groupVocabByCategory', () => {
  test('groups by category, sorts categories, preserves entry order', () => {
    const vocab = [
      { id: 'a', category: 'licks' }, { id: 'b', category: 'cadences' },
      { id: 'c', category: 'licks' }, { id: 'd' },  // no category → uncategorized
    ];
    const groups = groupVocabByCategory(vocab);
    expect(groups.map(g => g.category)).toEqual(['cadences', 'licks', 'uncategorized']);
    expect(groups.find(g => g.category === 'licks').entries.map(e => e.id)).toEqual(['a', 'c']);
    expect(groups.find(g => g.category === 'uncategorized').entries.map(e => e.id)).toEqual(['d']);
  });
  test('empty / missing input → []', () => {
    expect(groupVocabByCategory([])).toEqual([]);
    expect(groupVocabByCategory(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx jest public/music-vocab.test.js -t groupVocabByCategory`.

- [ ] **Step 3: Implement** — add to `public/music-vocab.js` (after `upsertVocab`):

```js
// Pure: group vocab entries by category (sorted), preserving each group's entry order.
export function groupVocabByCategory(vocab) {
  const byCat = new Map();
  for (const e of (vocab || [])) {
    const cat = e.category || 'uncategorized';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(e);
  }
  return Array.from(byCat.keys()).sort().map(category => ({ category, entries: byCat.get(category) }));
}
```

- [ ] **Step 4: Run, verify PASS** — `npx jest public/music-vocab.test.js` → all pass (2 new + existing 7).

- [ ] **Step 5: Commit**

```bash
git add public/music-vocab.js public/music-vocab.test.js
git commit -m "feat(music): groupVocabByCategory for the vocabulary view"
```

---

## Task 5: Instrument selector in `music.html` (glue)

**Files:** Modify `public/music.html`. Verify with `node --check`, id-check, full suite.

Read `public/music.html` first to confirm snippets.

- [ ] **Step 1: Add the instrument `<select>` to the transport row**

FIND:
```
    <label>Tempo <input id="tempoInput" type="number" min="20" max="300" style="width:4em"></label>
    <span id="transportMsg"></span>
```
REPLACE:
```
    <label>Tempo <input id="tempoInput" type="number" min="20" max="300" style="width:4em"></label>
    <label>Instrument
      <select id="instrSel">
        <option value="piano">Piano</option>
        <option value="guitar">Guitar</option>
        <option value="strings">Strings</option>
        <option value="organ">Organ</option>
        <option value="synth">Synth</option>
      </select>
    </label>
    <span id="transportMsg"></span>
```

- [ ] **Step 2: Import `instrumentVoiceKey`**

FIND:
```
  import { buildSchedule, createMusicPlayer, createYouTubeController, parseYouTubeId } from './music-player.js';
```
REPLACE:
```
  import { buildSchedule, createMusicPlayer, createYouTubeController, parseYouTubeId, instrumentVoiceKey } from './music-player.js';
```

- [ ] **Step 3: Apply the selected instrument on each MIDI play, and live on change**

FIND:
```
    const p = ensurePlayer();
    p.setSchedule(schedule);
    p.setLoop(document.getElementById('loopChk').checked);
    p.play();
```
REPLACE:
```
    const p = ensurePlayer();
    p.setInstrument(document.getElementById('instrSel').value);
    p.setSchedule(schedule);
    p.setLoop(document.getElementById('loopChk').checked);
    p.play();
```

Then FIND the play/pause/stop handler block start:
```
  document.getElementById('playBtn').onclick = () =>
    (document.getElementById('srcSel').value === 'youtube' ? playYouTube() : playMidi());
```
REPLACE:
```
  document.getElementById('instrSel').onchange = () => { if (player) player.setInstrument(document.getElementById('instrSel').value); };
  document.getElementById('playBtn').onclick = () =>
    (document.getElementById('srcSel').value === 'youtube' ? playYouTube() : playMidi());
```

- [ ] **Step 4: Auto-detect the instrument when a preview opens**

FIND:
```
    currentDetail = detail;
    currentPreviewId = id;
    document.getElementById('ytUrl').value = (detail.meta && detail.meta.youtube) || '';
```
REPLACE:
```
    currentDetail = detail;
    currentPreviewId = id;
    document.getElementById('instrSel').value = instrumentVoiceKey(detail.meta && detail.meta.instrument);
    if (player) player.setInstrument(document.getElementById('instrSel').value);
    document.getElementById('ytUrl').value = (detail.meta && detail.meta.youtube) || '';
```

- [ ] **Step 5: Verify**

```bash
F="$(node -e "const os=require('os'),p=require('path');console.log(p.join(os.tmpdir(),'mm5.mjs'))")"
node -e "const fs=require('fs');const h=fs.readFileSync('public/music.html','utf8');const m=h.match(/<script type=\"module\">([\s\S]*?)<\/script>/);fs.writeFileSync(process.argv[1],m[1]);" "$F"
node --check "$F" && echo "SYNTAX OK" && rm -f "$F"
grep -q 'id="instrSel"' public/music.html && echo "instrSel OK" || echo "instrSel MISSING"
npx jest public/ 2>&1 | tail -4
```
Expected: `SYNTAX OK`; `instrSel OK`; only the pre-existing `music_search.test.js` failure.

- [ ] **Step 6: Commit**

```bash
git add public/music.html
git commit -m "feat(music): instrument selector — auto-detect + override playback voice (M2.1)"
```

---

## Task 6: Vocabulary view in `music.html` (glue)

**Files:** Modify `public/music.html`.

- [ ] **Step 1: Add the Vocabulary section under the results**

FIND:
```
    <div id="results"></div>
  </div>
<div id="musicPreview" style="display:none;border-top:1px solid #ddd;padding-top:1rem">
```
REPLACE:
```
    <div id="results"></div>
    <details id="vocabSection" style="margin-top:1rem">
      <summary style="cursor:pointer;font-weight:600">Vocabulary</summary>
      <div id="vocabList"></div>
    </details>
  </div>
<div id="musicPreview" style="display:none;border-top:1px solid #ddd;padding-top:1rem">
```

- [ ] **Step 2: Import `groupVocabByCategory`**

FIND:
```
  import { buildSnapshot, buildVocabEntry, upsertVocab, loadVocab, saveVocabAndPush } from './music-vocab.js';
```
REPLACE:
```
  import { buildSnapshot, buildVocabEntry, upsertVocab, loadVocab, saveVocabAndPush, groupVocabByCategory } from './music-vocab.js';
```

- [ ] **Step 3: Add `renderVocab` + `openVocabEntry` (place right after `openResult`)**

FIND:
```
  async function openResult(result) {
    await openPreview(result.pieceId);
    if (!currentDetail) return;   // note-text or failed render: detail pane shows its own message
    const mr = resolveMatchMeasures(currentDetail, result.match);
    if (mr) {
      document.getElementById('segFrom').value = mr[0];
      document.getElementById('segTo').value = mr[1];
      if (renderer) renderer.showSegment(mr);
    }
  }
```
REPLACE:
```
  async function openResult(result) {
    await openPreview(result.pieceId);
    if (!currentDetail) return;   // note-text or failed render: detail pane shows its own message
    const mr = resolveMatchMeasures(currentDetail, result.match);
    if (mr) {
      document.getElementById('segFrom').value = mr[0];
      document.getElementById('segTo').value = mr[1];
      if (renderer) renderer.showSegment(mr);
    }
  }
  async function openVocabEntry(pieceId, from, to) {
    await openPreview(pieceId);
    if (!currentDetail) return;
    document.getElementById('segFrom').value = from;
    document.getElementById('segTo').value = to;
    if (renderer) renderer.showSegment([from, to]);
  }
  function renderVocab() {
    const box = document.getElementById('vocabList');
    const groups = groupVocabByCategory(vocab);
    if (!groups.length) { box.innerHTML = '<em>No vocabulary yet.</em>'; return; }
    box.innerHTML = '';
    groups.forEach(g => {
      const h = document.createElement('div');
      h.innerHTML = `<strong>${g.category}</strong>`;
      box.appendChild(h);
      g.entries.forEach(e => {
        const title = (index.find(x => x.id === e.pieceId) || {}).title || e.pieceId;
        const mark = (e.startSeconds != null || e.youtube) ? ' ▶' : '';
        const row = document.createElement('div');
        row.className = 'resultRow';
        row.innerHTML = `${title} <small>m${e.measureStart}–${e.measureEnd}${mark}</small>`;
        row.onclick = () => openVocabEntry(e.pieceId, e.measureStart, e.measureEnd);
        box.appendChild(row);
      });
    });
  }
```

- [ ] **Step 4: Refresh the view after a capture and on load**

FIND:
```
    vocab = upsertVocab(vocab, entry);
    document.getElementById('mediaMsg').textContent = 'Saving vocab…';
    const res = await saveVocabAndPush({ system, vocab, committer: makeCommitter(`vocab ${entry.id}`) });
    document.getElementById('mediaMsg').textContent = res.pushed
      ? `Added "${entry.id}" (${vocab.length} total)`
      : `Saved locally; push failed: ${res.pushError}`;
  };
```
REPLACE:
```
    vocab = upsertVocab(vocab, entry);
    renderVocab();
    document.getElementById('mediaMsg').textContent = 'Saving vocab…';
    const res = await saveVocabAndPush({ system, vocab, committer: makeCommitter(`vocab ${entry.id}`) });
    document.getElementById('mediaMsg').textContent = res.pushed
      ? `Added "${entry.id}" (${vocab.length} total)`
      : `Saved locally; push failed: ${res.pushError}`;
  };
```

Then FIND the bootstrap IIFE:
```
    try { vocab = await loadVocab(system); } catch (_) { vocab = []; }
    render(); updateRetryBtn();
  })();
```
REPLACE:
```
    try { vocab = await loadVocab(system); } catch (_) { vocab = []; }
    render(); updateRetryBtn(); renderVocab();
  })();
```

- [ ] **Step 5: Verify**

```bash
F="$(node -e "const os=require('os'),p=require('path');console.log(p.join(os.tmpdir(),'mm6.mjs'))")"
node -e "const fs=require('fs');const h=fs.readFileSync('public/music.html','utf8');const m=h.match(/<script type=\"module\">([\s\S]*?)<\/script>/);fs.writeFileSync(process.argv[1],m[1]);" "$F"
node --check "$F" && echo "SYNTAX OK" && rm -f "$F"
for id in vocabSection vocabList; do grep -q "id=\"$id\"" public/music.html && echo "$id OK" || echo "$id MISSING"; done
node -e "const h=require('fs').readFileSync('public/music.html','utf8');const o=(h.match(/<div/g)||[]).length,c=(h.match(/<\/div>/g)||[]).length;console.log('div',o,c,o===c?'BALANCED':'IMBALANCED')"
npx jest public/ 2>&1 | tail -4
```
Expected: `SYNTAX OK`; both ids OK; `BALANCED`; only the pre-existing failure.

- [ ] **Step 6: Commit**

```bash
git add public/music.html
git commit -m "feat(music): vocabulary view — grouped list + click-to-open segment (M2.1)"
```

---

## Task 7: YouTube segment playback in `music.html` (glue)

**Files:** Modify `public/music.html`.

- [ ] **Step 1: Rework `playYouTube` to seek to the segment start**

FIND:
```
  function playYouTube() {
    const url = currentDetail && currentDetail.meta && currentDetail.meta.youtube;
    const id = parseYouTubeId(url);
    if (!id) { document.getElementById('transportMsg').textContent = 'No linked YouTube video.'; return; }
    document.getElementById('ytPlayer').style.display = '';
    if (!yt) yt = createYouTubeController('ytPlayer');
    try { yt.load(id); yt.play(); document.getElementById('transportMsg').textContent = 'Playing YouTube'; }
    catch (e) { document.getElementById('transportMsg').textContent = 'YouTube error: ' + e.message; }
  }
```
REPLACE:
```
  function playYouTube() {
    const url = currentDetail && currentDetail.meta && currentDetail.meta.youtube;
    const id = parseYouTubeId(url);
    if (!id) { document.getElementById('transportMsg').textContent = 'No linked YouTube video.'; return; }
    document.getElementById('ytPlayer').style.display = '';
    const range = segmentRange();
    const from = range.fromMeasure || 1, to = range.toMeasure || from;
    const edited = parseFloat(document.getElementById('guessSec').value);
    const startFor = () => {
      if (Number.isFinite(edited)) return edited;
      const g = guessSegmentStart(currentDetail, [from, to], yt.getDuration());
      document.getElementById('guessSec').value = g.toFixed(1);
      return g;
    };
    try {
      if (!yt) {
        yt = createYouTubeController('ytPlayer', { onReady: () => { const s = startFor(); yt.seekTo(s); yt.play(); } });
        yt.load(id, Number.isFinite(edited) ? edited : 0);
      } else {
        yt.load(id, Number.isFinite(edited) ? edited : 0);
        const s = startFor(); yt.seekTo(s); yt.play();
      }
      document.getElementById('transportMsg').textContent = 'Playing YouTube';
    } catch (e) { document.getElementById('transportMsg').textContent = 'YouTube error: ' + e.message; }
  }
```

- [ ] **Step 2: Verify**

```bash
F="$(node -e "const os=require('os'),p=require('path');console.log(p.join(os.tmpdir(),'mm7.mjs'))")"
node -e "const fs=require('fs');const h=fs.readFileSync('public/music.html','utf8');const m=h.match(/<script type=\"module\">([\s\S]*?)<\/script>/);fs.writeFileSync(process.argv[1],m[1]);" "$F"
node --check "$F" && echo "SYNTAX OK" && rm -f "$F"
npx jest public/ 2>&1 | tail -4
```
Expected: `SYNTAX OK`; only the pre-existing failure.

- [ ] **Step 3: Commit**

```bash
git add public/music.html
git commit -m "feat(music): YouTube plays the selected segment (seek to start) (M2.1)"
```

- [ ] **Step 4: Manual browser verification (human step)**

1. **Instruments:** Preview a MusicXML piece → the Instrument selector reflects the piece's instrument; Play (MIDI) → hear that voice; change the selector (Guitar/Strings/Organ) → Play again sounds different.
2. **Vocabulary:** capture a segment (Add to vocab) → it appears in the **Vocabulary** section under its category; clicking it opens that piece's segment in the detail pane. Reload → the list repopulates from `vocab.json`.
3. **YouTube segment:** link a YouTube URL, switch source to YouTube, set/guess a segment start, Play → the video loads and **starts at the segment** with no `playVideo is not a function` error; Pause/Stop work.

---

## Notes for the implementer

- **Voice classes are standard Tone:** `Synth`, `AMSynth`, `FMSynth`, `PluckSynth`, `PolySynth` all exist in the vendored Tone v15. `PluckSynth` is monophonic — intended (the scheduled primary voice is melodic). All expose `triggerAttackRelease(note, dur, time)` and `dispose()`.
- **`setInstrument` needs no Part rebuild:** the `Part` callback closes over the `synth` *variable*, so reassigning it swaps the voice for subsequent notes.
- **YT readiness:** `play`/`pause`/`seekTo` queue until `onReady`; `getDuration()` is 0 until ready — that's why the auto-guess path computes inside `onReady` (or on an already-ready reused player). The edited `#guessSec` path needs no duration and is exact.
- **Don't disturb** the offline-cache / search / media / capture wiring; every task only ADDS or swaps the specified blocks.
