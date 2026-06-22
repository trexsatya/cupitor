# Note Suppression in Vocabulary Items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In a vocab item, let the user mark notes as *suppressed* (dimmed + silenced), with a global "Hear all" toggle and per-note temporary restore, all persisted per entry.

**Architecture:** A suppressed note is identified by `(measure, midi, beats)` — the same onset-beats scale the chord window already uses, so the renderer (selection + dimming) and the player (muting) agree without an index map. The renderer owns three sets — persisted `S`, transient per-note-restore `T`, transient global `hearAll` — and exposes the *effective muted* set `H ? [] : (S − T)`. The page passes that muted set into `buildScheduleFromMusicXml`, which flags muted schedule items so the player skips their synth trigger while keeping cursor timing. Pure cores are unit-tested; DOM/SVG/OSMD/Tone glue is `node --check` + manual browser verification (the project's established split).

**Tech Stack:** Vanilla ES modules in `public/`, OpenSheetMusicDisplay (vendored), Tone.js (vendored), Jest + jsdom. Spec: `docs/superpowers/specs/2026-06-22-note-suppression-design.md`.

**Conventions for this plan:**
- Run a single unit suite with: `npx jest public/<file>.test.js`
- `node --check public/<file>.js` for JS-syntax-only glue checks.
- `music.html` is HTML with one inline `<script type="module">`. To syntax-check it, extract the module to a temp file and check it:
  ```bash
  SP="/private/tmp/claude-502/-Users-satyendra-kumar-Documents-PersonalProjects-cupitor-frontend-vue3-cupitor-frontend/26bd5f02-f813-4aa8-aed8-d65ea0654625/scratchpad"
  node -e "const fs=require('fs');const h=fs.readFileSync('public/music.html','utf8');const m=h.match(/<script type=\"module\">([\s\S]*?)<\/script>/);fs.writeFileSync(process.env.SP+'/mod.mjs',m[1]);" 2>/dev/null
  node --check "$SP/mod.mjs" && echo OK
  ```
- Commit after each task. Commits are LOCAL on `music-study-app` (do not push). Per existing rules, only explicit Add/update/delete vocab actions push to GitHub.

---

## File Structure

- `public/music-vocab.js` — pure vocab-entry shape; add `suppressed` field. (+ `music-vocab.test.js`)
- `public/music-player.js` — pure `isSuppressed` helper + `mutedNotes` option in `buildScheduleFromMusicXml`; glue: `buildPart` skips muted triggers. (+ `music-player.test.js`)
- `public/music-render.js` — pure helpers (`suppressionKey`, `notesOfVoice`, `effectiveMuted`); suppression state + set-API; note-model `midi`/`voice` tagging; `applySuppressionDim`; notehead click; `suppressVoice`/`listVoices`. (+ `music-render.test.js`)
- `public/music.html` — Suppress edit-mode toggle, Hear-all toggle, voice chips, and wiring (open/save/close/playMidi).
- `public/music.css` — voice-chip + suppress-panel styles.

---

## Task 1: Vocab entry gains a `suppressed` field

**Files:**
- Modify: `public/music-vocab.js:25-39` (`buildVocabEntry`)
- Test: `public/music-vocab.test.js` (in the existing `describe('buildVocabEntry', …)`)

- [ ] **Step 1: Write the failing tests**

Add inside `describe('buildVocabEntry', …)` in `public/music-vocab.test.js`:

```js
test('stores a provided suppressed-notes list', () => {
  const entry = buildVocabEntry({
    pieceId: 'p', system: 'western', measureRange: [1, 1], createdAt: '2026-06-22',
    suppressed: [{ measure: 1, midi: 60, beats: 0 }, { measure: 1, midi: 64, beats: 1 }],
  });
  expect(entry.suppressed).toEqual([{ measure: 1, midi: 60, beats: 0 }, { measure: 1, midi: 64, beats: 1 }]);
});

test('defaults suppressed to an empty array', () => {
  const entry = buildVocabEntry({ pieceId: 'p', system: 'sargam', measureRange: [1, 1], createdAt: '2026-06-22' });
  expect(entry.suppressed).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest public/music-vocab.test.js -t suppressed`
Expected: FAIL — `entry.suppressed` is `undefined`.

- [ ] **Step 3: Implement**

In `public/music-vocab.js`, add the param to the destructured signature and the field to the returned object:

```js
export function buildVocabEntry({ pieceId, system, measureRange, measureOffset = 0, youtube = null,
                                  startSeconds = null, endSeconds = null, chords = [], note = '',
                                  snapshot = null, category = 'uncategorized', createdAt = null,
                                  suppressed = [] }) {
  const [measureStart, measureEnd] = measureRange;
  const id = `${pieceId}_${measureStart}_${measureEnd}`.replace(/\s+/g, '_');
  return {
    id, category, pieceId, system, measureStart, measureEnd,
    measureOffset,          // pickup/anacrusis shift: printed number = measureStart − measureOffset
    youtube, startSeconds, endSeconds,
    chords: chords || [],   // manually-picked best-match chord names (multi-select)
    note: note || '',       // free-text annotation for the segment
    snapshot: snapshot || { pitches: [], chords: [] },
    suppressed: suppressed || [],   // notes silenced for chord practice: [{measure, midi, beats}]
    createdAt,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest public/music-vocab.test.js`
Expected: PASS (all tests in the suite, including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add public/music-vocab.js public/music-vocab.test.js
git commit -m "music: add suppressed-notes field to vocab entry"
```

---

## Task 2: Player `isSuppressed` pure helper

**Files:**
- Modify: `public/music-player.js` (add an exported pure function; place it just above `buildScheduleFromMusicXml` at line 76)
- Test: `public/music-player.test.js`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block in `public/music-player.test.js` and add `isSuppressed` to the import on line 2:

```js
// at top: import { …, isSuppressed } from './music-player.js';

describe('isSuppressed', () => {
  const set = [{ measure: 2, midi: 60, beats: 4 }, { measure: 2, midi: 67, beats: 4 }];
  test('matches on (measure, midi, beats)', () => {
    expect(isSuppressed({ measure: 2, midi: 60, beats: 4 }, set)).toBe(true);
    expect(isSuppressed({ measure: 2, midi: 67, beats: 4 }, set)).toBe(true);
  });
  test('tolerates float drift on beats within EPS', () => {
    expect(isSuppressed({ measure: 2, midi: 60, beats: 4 + 1e-9 }, set)).toBe(true);
  });
  test('rejects a different pitch, measure, or distant onset', () => {
    expect(isSuppressed({ measure: 2, midi: 62, beats: 4 }, set)).toBe(false);
    expect(isSuppressed({ measure: 3, midi: 60, beats: 4 }, set)).toBe(false);
    expect(isSuppressed({ measure: 2, midi: 60, beats: 4.5 }, set)).toBe(false);
  });
  test('empty or missing set → false', () => {
    expect(isSuppressed({ measure: 2, midi: 60, beats: 4 }, [])).toBe(false);
    expect(isSuppressed({ measure: 2, midi: 60, beats: 4 }, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest public/music-player.test.js -t isSuppressed`
Expected: FAIL — `isSuppressed is not a function` (not exported).

- [ ] **Step 3: Implement**

In `public/music-player.js`, immediately above `export function buildScheduleFromMusicXml` (line 76), add:

```js
// Pure: is this note one of the suppressed ones? Match on (measure, midi) with a small epsilon
// on the onset beat (floats). `set` is [{measure, midi, beats}] in piece-start quarter beats —
// the same scale as a schedule/raw event's `beats`.
export function isSuppressed(event, set) {
  if (!event || !set || !set.length) return false;
  const EPS = 1e-6;
  for (const s of set) {
    if (s.measure === event.measure && s.midi === event.midi && Math.abs(s.beats - event.beats) < EPS) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest public/music-player.test.js -t isSuppressed`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add public/music-player.js public/music-player.test.js
git commit -m "music: add isSuppressed note-matching helper"
```

---

## Task 3: Mute suppressed notes in the schedule + player

**Files:**
- Modify: `public/music-player.js:76-165` (`buildScheduleFromMusicXml` map step) and `public/music-player.js:307-312` (`buildPart` Part callback)
- Test: `public/music-player.test.js`

Note: muted items get a `muted: true` flag; non-muted items are unchanged `{midi,time,duration}`, so existing schedule tests stay green.

- [ ] **Step 1: Write the failing test**

Add to `describe('buildScheduleFromMusicXml', …)` in `public/music-player.test.js` (reuse the file's `wrap`, `attrs`, `pn` helpers):

```js
test('mutedNotes flags matching schedule items (by measure, midi, beats) and leaves others alone', () => {
  // measure 1: C4@beat0, E4@beat1 (two quarters at tempo 120 → 0.5s each).
  const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${pn('E', 4, 1)}</measure>`);
  const s = buildScheduleFromMusicXml(xml, { tempo: 120, mutedNotes: [{ measure: 1, midi: 64, beats: 1 }] });
  expect(s).toEqual([
    { midi: 60, time: 0, duration: 0.5 },
    { midi: 64, time: 0.5, duration: 0.5, muted: true },
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-player.test.js -t "mutedNotes flags"`
Expected: FAIL — the second item lacks `muted: true`.

- [ ] **Step 3: Implement the schedule muting**

In `public/music-player.js`, replace the `out` construction inside `buildScheduleFromMusicXml` (currently lines 155-158) with:

```js
  const muted = (opts.mutedNotes && opts.mutedNotes.length) ? opts.mutedNotes : null;
  const out = events
    .filter((e) => e.measure >= from && e.measure <= to)
    .filter((e) => e.beats >= fromBeat - EPS && e.beats <= toBeat + EPS)
    .map((e) => {
      const item = { midi: e.midi, time: e.beats * spb, duration: e.durBeats * spb };
      if (muted && isSuppressed(e, muted)) item.muted = true;   // silenced note: keep its slot, skip the synth
      return item;
    });
```

(The re-zero loop just below — lines 160-163 — only rewrites `time`/`duration`, so `muted` survives untouched.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest public/music-player.test.js`
Expected: PASS — the new test passes AND every pre-existing `buildScheduleFromMusicXml` test still passes (non-muted items unchanged).

- [ ] **Step 5: Make `buildPart` skip muted notes (glue)**

In `public/music-player.js`, change the Part callback (lines 307-312) so a muted event is not triggered but still steps the cursor:

```js
    part = new T.Part((time, ev) => {
      if (!ev.muted) synth.triggerAttackRelease(T.Frequency(ev.midi, 'midi').toNote(), ev.duration, time);
      if (cursor && ev._step) T.Draw.schedule(() => {
        try { if (ev._first) homeCursor(cursor); else cursor.next(); } catch (_) {}
      }, time);
    }, events);
```

- [ ] **Step 6: Syntax check and commit**

Run: `node --check public/music-player.js && echo OK`
Expected: `OK`

```bash
git add public/music-player.js public/music-player.test.js
git commit -m "music: mute suppressed notes in schedule + playback (keep cursor)"
```

---

## Task 4: Renderer pure helpers (key, voice expansion, effective-muted)

**Files:**
- Modify: `public/music-render.js` (add three exported pure functions near the top-level pure exports, e.g. just below the existing `noteName`/`voiceColor` exports)
- Test: `public/music-render.test.js`

- [ ] **Step 1: Write the failing tests**

Add `suppressionKey, notesOfVoice, effectiveMuted` to the imports in `public/music-render.test.js`, and add:

```js
import { suppressionKey, notesOfVoice, effectiveMuted } from './music-render.js';

describe('suppression pure helpers', () => {
  test('suppressionKey formats measure:midi:beats with fixed precision', () => {
    expect(suppressionKey({ measure: 2, midi: 60, beats: 4 })).toBe('2:60:4.000000');
    expect(suppressionKey({ measure: 1, midi: 67, beats: 1.5 })).toBe('1:67:1.500000');
  });
  test('notesOfVoice keeps that voice and drops unpitched notes', () => {
    const notes = [
      { measure: 1, midi: 60, onsetBeats: 0, voice: 0 },
      { measure: 1, midi: 64, onsetBeats: 0, voice: 1 },
      { measure: 1, midi: null, onsetBeats: 1, voice: 0 },
    ];
    expect(notesOfVoice(notes, 0)).toEqual([{ measure: 1, midi: 60, beats: 0 }]);
  });
  test('effectiveMuted = suppressed − tempRestored, empty when hearAll', () => {
    const S = [{ measure: 1, midi: 60, beats: 0 }, { measure: 1, midi: 64, beats: 0 }];
    const T = new Set([suppressionKey({ measure: 1, midi: 64, beats: 0 })]);
    expect(effectiveMuted(S, T, false)).toEqual([{ measure: 1, midi: 60, beats: 0 }]);
    expect(effectiveMuted(S, T, true)).toEqual([]);
    // a tempRestored key that isn't in S has no effect
    const T2 = new Set([suppressionKey({ measure: 9, midi: 99, beats: 9 })]);
    expect(effectiveMuted(S, T2, false)).toEqual(S);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest public/music-render.test.js -t "suppression pure helpers"`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement**

In `public/music-render.js`, add these exported pure functions at module top level (alongside the other pure exports like `noteName`/`responsiveZoom`):

```js
// Pure: stable string key for a note identity, for suppression-set membership/dedupe.
export function suppressionKey({ measure, midi, beats }) {
  return `${measure}:${midi}:${Number(beats).toFixed(6)}`;
}

// Pure: the note identities {measure, midi, beats} of a given voice in a rendered-note list
// (excludes unpitched notes, which have midi == null).
export function notesOfVoice(notes, voiceId) {
  return (notes || [])
    .filter((n) => n.voice === voiceId && n.midi != null)
    .map((n) => ({ measure: n.measure, midi: n.midi, beats: n.onsetBeats }));
}

// Pure: notes currently silenced/dimmed = hearAll ? none : suppressed minus temp-restored.
// `tempRestored` is a Set of suppressionKey strings; keys not present in `suppressed` are ignored.
export function effectiveMuted(suppressed, tempRestored, hearAll) {
  if (hearAll) return [];
  const t = tempRestored || new Set();
  return (suppressed || []).filter((n) => !t.has(suppressionKey(n)));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest public/music-render.test.js -t "suppression pure helpers"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add public/music-render.js public/music-render.test.js
git commit -m "music: pure helpers for note-suppression identity + muted set"
```

---

## Task 5: Renderer suppression state + set API

**Files:**
- Modify: `public/music-render.js` — add state near `chordWindow` (line 166); add `onSuppressionChange` callback const near the other callbacks (line ~152); add API methods to the returned object (near `getMeasureOffset`/`setChordWindow`, ~line 832-834).
- Test: `public/music-render.test.js`

This task wires only the DOM-free set logic (testable via the fake OSMD). Dimming/clicks/voice come in Tasks 6-7.

- [ ] **Step 1: Write the failing test**

Add to `public/music-render.test.js` (the file already has a `fakeOsmd()` factory used by `createMusicRenderer` tests):

```js
describe('createMusicRenderer suppression set API', () => {
  test('round-trips the suppressed set and computes the effective muted set', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.setSuppressedNotes([{ measure: 1, midi: 60, beats: 0 }, { measure: 1, midi: 64, beats: 0 }]);
    expect(r.getSuppressedNotes()).toEqual([{ measure: 1, midi: 60, beats: 0 }, { measure: 1, midi: 64, beats: 0 }]);
    expect(r.getMutedNotes()).toEqual([{ measure: 1, midi: 60, beats: 0 }, { measure: 1, midi: 64, beats: 0 }]);
    r.setHearAll(true);
    expect(r.getMutedNotes()).toEqual([]);            // hear-all overrides
    expect(r.getSuppressedNotes()).toHaveLength(2);   // saved set intact
    r.setHearAll(false);
    expect(r.getMutedNotes()).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-render.test.js -t "suppression set API"`
Expected: FAIL — `r.setSuppressedNotes is not a function`.

- [ ] **Step 3: Add the callback const**

In `public/music-render.js`, next to the other callback consts (line ~152, where `onChordSelect`/`onWindowChange` are read), add:

```js
  const onSuppressionChange = opts.onSuppressionChange;   // fired after a user change to S, T, or hearAll
```

- [ ] **Step 4: Add state**

In `public/music-render.js`, just after the `chordWindow` declaration (line 166), add:

```js
  // Note suppression (vocab practice): S = persisted suppressed set, T = transient per-note
  // restore, hearAll = transient global restore. Effective muted = hearAll ? [] : (S − T).
  const suppressedNotes = new Map();   // suppressionKey → {measure, midi, beats}  (S)
  const tempRestored = new Set();      // suppressionKey strings, subset of S       (T)
  let hearAll = false;
  let suppressMode = false;            // true → notehead clicks edit S; false → toggle T (practice)
  // Internal: the current effective muted identities (shared by getMutedNotes + applySuppressionDim).
  function mutedList() { return effectiveMuted([...suppressedNotes.values()], tempRestored, hearAll); }
```

- [ ] **Step 5: Add the API methods**

In `public/music-render.js`, in the returned API object near `setChordWindow` (line ~834), add:

```js
    // ── Note suppression ─────────────────────────────────────────────────────────────────────
    // Set/replace the persisted suppressed set (e.g. from a vocab entry); resets transient state.
    // Does NOT fire onSuppressionChange — the caller restores player state explicitly.
    setSuppressedNotes(list) {
      suppressedNotes.clear(); tempRestored.clear(); hearAll = false;
      (list || []).forEach((n) => {
        if (n && n.midi != null) suppressedNotes.set(suppressionKey(n), { measure: n.measure, midi: n.midi, beats: n.beats });
      });
      redraw();
    },
    getSuppressedNotes() { return [...suppressedNotes.values()]; },     // S, for persistence
    getMutedNotes() { return mutedList(); },                            // effective muted, for the player
    setHearAll(on) { hearAll = !!on; redraw(); if (onSuppressionChange) { try { onSuppressionChange(); } catch (_) {} } },
    setSuppressMode(on) { suppressMode = !!on; redraw(); },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest public/music-render.test.js -t "suppression set API"`
Expected: PASS.

- [ ] **Step 7: Full suite + commit**

Run: `npx jest public/music-render.test.js`
Expected: PASS (all, including the existing render-wrap/onAfterRender tests — `setSuppressedNotes`/`setHearAll` call `redraw()`, which is safe on the fake OSMD).

```bash
git add public/music-render.js public/music-render.test.js
git commit -m "music: renderer suppression state + set API"
```

---

## Task 6: Tag rendered notes with `midi` and `voice`

**Files:**
- Modify: `public/music-render.js` — `applyVoiceColors` (lines 170-183), `renderedNotesByMeasure` (lines 243-282), `orderedRenderedNotes` (lines 593-607). Add a `voiceIndexByRef` map alongside the other state.

This is OSMD glue — not unit-testable (the fake has no `graphic.measureList`). Verify with `node --check` + browser.

- [ ] **Step 1: Add the voice-index map (state)**

In `public/music-render.js`, near the suppression state added in Task 5, add:

```js
  // OSMD Voice object → its global color index (the same index voiceColor() uses), rebuilt every
  // render by applyVoiceColors so rendered notes can be tagged with a stable voice id.
  const voiceIndexByRef = new Map();
```

- [ ] **Step 2: Populate it in `applyVoiceColors`**

In `public/music-render.js`, update `applyVoiceColors` (lines 170-183) to record each voice's index (do this even when colors are off, since the loop runs regardless):

```js
  function applyVoiceColors() {
    const instruments = osmd.Sheet && osmd.Sheet.Instruments;
    if (!instruments || !instruments.forEach) return;
    voiceIndexByRef.clear();
    let vi = 0;
    instruments.forEach((instr) => {
      (instr.Voices || []).forEach((voice) => {
        voiceIndexByRef.set(voice, vi);
        const color = colorVoices ? voiceColor(vi) : DEFAULT_NOTE_COLOR;
        (voice.VoiceEntries || []).forEach((ve) => {
          (ve.Notes || []).forEach((note) => { note.NoteheadColor = color; });
        });
        vi++;
      });
    });
  }
```

- [ ] **Step 3: Tag notes in `renderedNotesByMeasure`**

In `public/music-render.js`, inside the innermost `gnote` loop of `renderedNotesByMeasure` (around lines 259-275), compute `midi` and `voice` and add them to the pushed object:

```js
            (gve.notes || []).forEach((gnote) => {
              const vf = gnote.vfnote;
              const root = vf && vf[0] && vf[0].attrs && vf[0].attrs.el;
              if (!root || !root.querySelectorAll) return;
              const idx = gnote.vfnoteIndex || 0;
              const heads = root.querySelectorAll('.vf-notehead');
              const el = heads[idx] || heads[0];
              const name = vexKeyToPitchClass(vf[0].keys && vf[0].keys[idx]);
              if (!el || !name || el.isConnected === false) return;
              const b = el.getBBox ? el.getBBox() : { x: 0 };
              const sourceNote = gnote.sourceNote;
              const pitch = sourceNote && sourceNote.Pitch;
              const midi = (pitch && typeof pitch.getHalfTone === 'function') ? pitch.getHalfTone() + 12 : null;
              const voiceRef = sourceNote && sourceNote.ParentVoiceEntry && sourceNote.ParentVoiceEntry.ParentVoice;
              const voice = voiceIndexByRef.has(voiceRef) ? voiceIndexByRef.get(voiceRef) : 0;
              const arr = (byMeasure[num] = byMeasure[num] || []);
              arr.push({ name, left: b.x, el, measure: num, idx: arr.length, onsetBeats, midi, voice });
            });
```

- [ ] **Step 4: Pass them through `orderedRenderedNotes`**

In `public/music-render.js`, update the `out.push` in `orderedRenderedNotes` (lines 602-603) to carry `midi` and `voice`:

```js
        out.push({ name: n.name, el: n.el, measure: n.measure, idx: n.idx, order: out.length, band,
          onsetBeats: n.onsetBeats, midi: n.midi, voice: n.voice,
          left: box.left, right: box.right, top: box.top, bottom: box.bottom });
```

- [ ] **Step 5: Syntax check + ensure nothing regressed**

Run: `node --check public/music-render.js && npx jest public/music-render.test.js`
Expected: `node --check` clean; all existing + Task 4/5 render tests PASS (the chord-window/ordered-notes tests don't assert `midi`/`voice`, so they're unaffected).

- [ ] **Step 6: Commit**

```bash
git add public/music-render.js
git commit -m "music: tag rendered notes with midi + voice for suppression"
```

---

## Task 7: Dim muted notes, click-to-suppress, voice suppression

**Files:**
- Modify: `public/music-render.js` — add `applySuppressionDim`, call it in `postRender`; add a container click handler; add `suppressVoice`/`listVoices` to the API. Attach the click listener in `createMusicRenderer`.

OSMD/SVG glue — verify with `node --check` + browser.

- [ ] **Step 1: Add `applySuppressionDim`**

In `public/music-render.js`, add this function next to `applyDimConnectors`:

```js
  // Grey the noteheads that are currently muted (effective set). Runs in postRender, AFTER a fresh
  // osmd.render() has repainted voice colors — so notes no longer muted are already their normal
  // color and need no reset; we only paint the muted ones. No-op unless something is suppressed.
  function applySuppressionDim() {
    if (!container || !container.querySelectorAll || !suppressedNotes.size) return;
    const mutedKeys = new Set(mutedList().map(suppressionKey));
    if (!mutedKeys.size) return;   // hearAll on, or all temp-restored
    orderedRenderedNotes().forEach((n) => {
      if (n.midi == null || !n.el) return;
      const key = suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats });
      if (!mutedKeys.has(key)) return;
      [n.el, ...n.el.querySelectorAll('path, ellipse, circle, rect')].forEach((h) => {
        h.setAttribute('fill', DIM_CONNECTOR_COLOR); h.style.fill = DIM_CONNECTOR_COLOR;
        const st = h.getAttribute('stroke');
        if (st && st !== 'none') { h.setAttribute('stroke', DIM_CONNECTOR_COLOR); h.style.stroke = DIM_CONNECTOR_COLOR; }
      });
      // Practice affordance: a muted note is click-to-hear when not editing the set.
      if (!suppressMode && n.el.style) { n.el.style.cursor = 'pointer'; }
    });
  }
```

- [ ] **Step 2: Call it last in `postRender`**

In `public/music-render.js`, add `applySuppressionDim()` to `postRender`, after `applyChordWindow()` and before the `onAfterRender` call, so the grey wins over voice colors and chord highlights:

```js
  function postRender() {
    applyDimConnectors();
    applyNoteNames();
    applyMeasureHighlight();
    applyChordOverlay();
    applyChordWindow();
    applySuppressionDim();
    if (onAfterRender) { try { onAfterRender(); } catch (_) {} }
  }
```

- [ ] **Step 3: Add the notehead click handler**

In `public/music-render.js`, add this function (near `pointerToNote`), which acts only on real notehead clicks (so it never collides with chord-label clicks or window-handle drags):

```js
  // Click a notehead to toggle suppression. Edit-mode → add/remove from S. Practice-mode → toggle
  // temporary restore (T) on a note that is in S. Ignores clicks that aren't on a notehead.
  function onNoteheadClick(ev) {
    const head = ev.target && ev.target.closest && ev.target.closest('.vf-notehead');
    if (!head) return;
    const n = orderedRenderedNotes().find((o) => o.el === head || (o.el && o.el.contains && o.el.contains(head)));
    if (!n || n.midi == null) return;
    const id = { measure: n.measure, midi: n.midi, beats: n.onsetBeats };
    const key = suppressionKey(id);
    if (suppressMode) {
      if (suppressedNotes.has(key)) { suppressedNotes.delete(key); tempRestored.delete(key); }
      else suppressedNotes.set(key, id);
    } else {
      if (!suppressedNotes.has(key)) return;                 // practice: only S notes are clickable
      if (tempRestored.has(key)) tempRestored.delete(key);   // re-suppress
      else tempRestored.add(key);                            // temporarily restore
    }
    redraw();
    if (onSuppressionChange) { try { onSuppressionChange(); } catch (_) {} }
  }
```

- [ ] **Step 4: Attach the listener once**

In `public/music-render.js`, in `createMusicRenderer` after the `osmd.render` wrap is installed, add:

```js
  if (container && container.addEventListener) container.addEventListener('click', onNoteheadClick);
```

- [ ] **Step 5: Add `suppressVoice` and `listVoices` to the API**

In `public/music-render.js`, in the returned object next to the other suppression methods (Task 5), add:

```js
    // Bulk-suppress (on=true) or restore (on=false) every rendered note of a voice in the view.
    suppressVoice(voiceId, on) {
      notesOfVoice(orderedRenderedNotes(), voiceId).forEach((id) => {
        const key = suppressionKey(id);
        if (on) suppressedNotes.set(key, id);
        else { suppressedNotes.delete(key); tempRestored.delete(key); }
      });
      redraw();
      if (onSuppressionChange) { try { onSuppressionChange(); } catch (_) {} }
    },
    // Voices present in the view, for the chips: [{ id, color, allSuppressed }].
    listVoices() {
      const byVoice = new Map();
      orderedRenderedNotes().forEach((n) => {
        if (n.midi == null) return;
        if (!byVoice.has(n.voice)) byVoice.set(n.voice, []);
        byVoice.get(n.voice).push(n);
      });
      return [...byVoice.keys()].sort((a, b) => a - b).map((id) => {
        const notes = byVoice.get(id);
        const allSuppressed = notes.every((n) =>
          suppressedNotes.has(suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
        return { id, color: voiceColor(id), allSuppressed };
      });
    },
```

- [ ] **Step 6: Syntax check + run suite**

Run: `node --check public/music-render.js && npx jest public/music-render.test.js`
Expected: `node --check` clean; all render tests PASS (no new unit tests here — this is SVG/OSMD glue).

- [ ] **Step 7: Commit**

```bash
git add public/music-render.js
git commit -m "music: dim muted notes, click-to-suppress, voice suppression"
```

---

## Task 8: UI controls + wiring in music.html (+ CSS)

**Files:**
- Modify: `public/music.html` — controls markup (after the `#viewOptions` block, line 287), `ensureRenderer` (lines 417-419), `openVocabEntry` (lines 914-934), the vocab-save `buildVocabEntry` call (lines 699-710), `openPreview`/close clearing (lines 726-728 / 814-819), and `playMidi` (line 532). Add helper functions for the suppress panel.
- Modify: `public/music.css` — chip + panel styles.

DOM glue — verify with the extract-and-`node --check` recipe at the top + browser.

- [ ] **Step 1: Add the suppress panel markup**

In `public/music.html`, after the `#viewOptions` `</div>` (line 287 region), add:

```html
  <div id="suppressPanel" style="display:none; margin:.25rem 0; padding:.3rem .4rem; background:#fff8f0; border:1px solid #ffd9b0; border-radius:4px">
    <button class="btn toggle" data-for="suppressModeChk" title="Click notes to silence them"><span class="ic">🔇</span><span class="txt">Suppress notes</span></button>
    <button class="btn toggle" data-for="hearAllChk" title="Temporarily hear every suppressed note"><span class="ic">👂</span><span class="txt">Hear all</span></button>
    <span id="voiceChips"></span>
    <span id="suppressHint" style="font-size:.8em;color:#a0660a"></span>
    <input type="checkbox" id="suppressModeChk" hidden>
    <input type="checkbox" id="hearAllChk" hidden>
  </div>
```

- [ ] **Step 2: Pass `onSuppressionChange` when creating the renderer**

In `public/music.html`, update `ensureRenderer` (lines 417-419):

```js
  function ensureRenderer() {
    if (!renderer) renderer = createMusicRenderer(document.getElementById('osmdPreview'),
      { onChordSelect: syncVocabChords, onWindowChange: onChordWindowChange, onSuppressionChange: onSuppressionChange });
    return renderer;
  }
```

- [ ] **Step 3: Add the suppress-panel helpers + wiring**

In `public/music.html`, after the existing toggle wiring (near line 633, after `syncToggles()`), add:

```js
  // ── Note suppression UI (vocab items only) ─────────────────────────────────────────────────
  function renderVoiceChips() {
    const box = document.getElementById('voiceChips');
    box.innerHTML = '';
    if (!renderer || !renderer.listVoices) return;
    renderer.listVoices().forEach((v) => {
      const chip = document.createElement('button');
      chip.className = 'voiceChip' + (v.allSuppressed ? ' active' : '');
      chip.textContent = `V${v.id + 1}`;
      chip.style.borderColor = v.color;
      chip.style.color = v.allSuppressed ? '#fff' : v.color;
      chip.style.background = v.allSuppressed ? v.color : '#fff';
      chip.title = v.allSuppressed ? 'Restore this voice' : 'Silence this whole voice';
      chip.onclick = () => { renderer.suppressVoice(v.id, !v.allSuppressed); };
      box.appendChild(chip);
    });
  }
  function onSuppressionChange() {
    renderVoiceChips();
    const n = (renderer && renderer.getSuppressedNotes) ? renderer.getSuppressedNotes().length : 0;
    document.getElementById('suppressHint').textContent = n ? `${n} note${n === 1 ? '' : 's'} suppressed` : '';
  }
  document.getElementById('suppressModeChk').onchange = (e) => {
    if (renderer) renderer.setSuppressMode(e.target.checked);
    document.getElementById('voiceChips').style.display = e.target.checked ? '' : 'none';
    if (e.target.checked) renderVoiceChips();
  };
  document.getElementById('hearAllChk').onchange = (e) => { if (renderer) renderer.setHearAll(e.target.checked); };
```

- [ ] **Step 4: Restore suppression when opening a vocab entry**

In `public/music.html`, in `openVocabEntry`, after the `renderer.showSegment([from, to]); renderer.highlightMeasures([from, to]);` line (line 925), add:

```js
    if (renderer) renderer.setSuppressedNotes(entry.suppressed || []);
    document.getElementById('suppressModeChk').checked = false;
    document.getElementById('hearAllChk').checked = false;
    document.getElementById('voiceChips').style.display = 'none';
    document.getElementById('suppressPanel').style.display = '';
    syncToggles();           // reflect suppress-mode/hear-all buttons as off
    onSuppressionChange();   // refresh chips + hint
```

- [ ] **Step 5: Persist the suppressed set on save**

In `public/music.html`, add `suppressed` to the `buildVocabEntry({…})` call (lines 699-710), after the `snapshot:` line:

```js
      snapshot: buildSnapshot(currentDetail, [from, to]),
      suppressed: (renderer && renderer.getSuppressedNotes && renderer.getSuppressedNotes()) || [],
      category: document.getElementById('vocabCat').value.trim() || 'uncategorized',
```

- [ ] **Step 6: Clear suppression for plain previews + on close**

In `public/music.html`, in `openPreview` after the piece renders (after `renderer.showFull();`, line 756 region) add a reset so a plain preview carries no suppression UI:

```js
    if (renderer) renderer.setSuppressedNotes([]);
    document.getElementById('suppressPanel').style.display = 'none';
    document.getElementById('suppressModeChk').checked = false;
    document.getElementById('hearAllChk').checked = false;
    syncToggles();
```

Note: `openVocabEntry` calls `openPreview` first, then re-shows the panel and restores the set in Step 4 — so this reset runs before the restore and does not clobber it.

In the `#previewCloseBtn` handler (lines 814-819), also hide the panel:

```js
    document.getElementById('suppressPanel').style.display = 'none';
```

- [ ] **Step 7: Feed muted notes into playback**

In `public/music.html`, in `playMidi` (line 532), pass the effective muted set into the schedule build:

```js
    const muted = (renderer && renderer.getMutedNotes) ? renderer.getMutedNotes() : [];
    const schedule = currentDetail.format === 'musicxml'
      ? buildScheduleFromMusicXml(currentDetail.source, { tempo: currentTempo(), ...range, mutedNotes: muted })
      : buildSchedule(currentDetail, { tempo: currentTempo() });
```

(Confirm the existing lines 531-533 match this shape; adjust only the `buildScheduleFromMusicXml` call to add `mutedNotes: muted`, and add the `const muted` line just above it.)

- [ ] **Step 8: Add CSS**

In `public/music.css`, append:

```css
/* Voice chips for note suppression: a small pill per voice, lit when the whole voice is muted. */
.voiceChip {
  display: inline-block;
  margin: 0 .15em;
  padding: .05em .5em;
  font-size: .85em;
  border-radius: 10px;
  border: 1px solid #888;
  background: #fff;
  cursor: pointer;
}
#voiceChips { display: none; }   /* shown only while in suppress edit-mode */
```

- [ ] **Step 9: Syntax check**

Run the extract-and-check recipe from the top of this plan against `public/music.html`.
Expected: `OK`.

- [ ] **Step 10: Commit**

```bash
git add public/music.html public/music.css
git commit -m "music: suppress-notes UI — edit mode, voice chips, hear-all"
```

---

## Task 9: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole unit suite**

Run: `npx jest public/music-vocab.test.js public/music-player.test.js public/music-render.test.js`
Expected: all green (pre-existing unrelated failures noted in the spec are out of scope).

- [ ] **Step 2: Browser checklist (hard-reload to bust the module cache)**

Open a vocab item and verify:
- Toggle **🔇 Suppress notes** on → voice chips appear. Click a few noteheads → they dim immediately; the "N notes suppressed" hint updates.
- Click a **voice chip** → that whole voice dims and the chip lights; click again → restores.
- Toggle Suppress off, press **Play** → suppressed notes are silent; the cursor still moves through their beats.
- Press a dimmed note (practice mode, Suppress off) → it un-dims and, on the next Play, sounds; click again → re-suppressed.
- Toggle **👂 Hear all** → all dims clear and Play sounds every note; toggle off → suppression returns.
- **Add/update** the vocab item, reopen it → the suppressed set is restored exactly; Hear-all and per-note restores reset to clean.
- Open a **plain piece** (not a vocab item) → no suppress panel, nothing dimmed.

- [ ] **Step 3: Offer to finish the branch**

Per `superpowers:finishing-a-development-branch`, present merge/PR/keep/discard options for `music-study-app` (the branch remains unmerged by default — offer, don't assume).
