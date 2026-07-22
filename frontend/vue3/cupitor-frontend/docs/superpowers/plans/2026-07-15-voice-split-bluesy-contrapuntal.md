# Voice-Split, Bluesy & Contrapuntal Variations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-voice bass/melody split, a Bluesy variation style, and a Contrapuntal (independent counter-line) style to the segment-Variations panel.

**Architecture:** A shared `writeVoice` MusicXML primitive lays a full voice (with backups + gap-filling rests) onto a segment. The split re-partitions one voice's notes into melody(1)/bass(2) via that primitive; Bluesy widens the decorating pool with blue notes and adds a grace-slide site + a shuffle transform; Contrapuntal generates a counter-line and writes it as a new colored voice. The existing extract→apply→render→fretboard pipeline is reused unchanged.

**Tech Stack:** Vanilla ES modules, Jest + jsdom, DOMParser/XMLSerializer, OSMD (render only), Tone.js (playback).

**Checkpoint note:** `.git` is write-blocked in this environment. Every "Checkpoint" step means: run `yarn jest public/` and confirm all suites are green (this replaces `git commit`).

---

## File Structure

- `public/music-embellish-xml.js` — **modify**: add `writeVoice`, add `grace` + `shuffle` ops to `applyVariation`.
- `public/music-voice-split.js` — **create**: `classifyBassMelody`, `splitSingleVoice` (Feature A).
- `public/music-embellish.js` — **modify**: `BLUE_PCS`, `blueGraceSlide` detector, `shuffleSites`, `style` param on `generateVariations` (Feature B).
- `public/music-counterpoint.js` — **create**: `generateCounterLines` (Feature C).
- `public/music-embellish-ui.js` — **modify**: `voicePickerEntries`, `variationFretSteps` two-voice support, `counterLineToNotesByMeasure`.
- `public/music.html` — **modify**: Style selector, shuffle/register controls, `varGenerate` dispatch, voice-picker population, contrapuntal fretboard capture.
- Test files: `music-embellish-xml.test.js`, `music-voice-split.test.js` (new), `music-embellish.test.js`, `music-counterpoint.test.js` (new), `music-embellish-ui.test.js`, `music-embellish-integration.test.js`.

---

## Phase 0 — Shared builder primitives

### Task 1: `writeVoice` — lay a full voice onto a segment

**Files:**
- Modify: `public/music-embellish-xml.js`
- Test: `public/music-embellish-xml.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { writeVoice } from './music-embellish-xml.js';

describe('writeVoice', () => {
  const SEG = `<?xml version="1.0"?><score-partwise><part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
    </measure>
  </part></score-partwise>`;

  test('appends a second voice after a <backup> that rewinds the whole measure', () => {
    const doc = new DOMParser().parseFromString(SEG, 'application/xml');
    // measure total = 4 + 2 = 6 divisions; add a bass G3 (midi 55) for the first 3 divisions,
    // then a rest for the remaining 3.
    writeVoice(doc, { voiceId: '2', color: '#C62828',
      notesByMeasure: { 1: { divs: 6, notes: [{ onsetDivs: 0, durDivs: 3, midi: 55 }] } } });
    const m = doc.querySelector('measure');
    // one backup of 6
    const backup = m.querySelector('backup > duration');
    expect(backup && backup.textContent).toBe('6');
    // voice-2 notes: a colored G plus a trailing rest, summing to 6
    const v2 = Array.from(m.querySelectorAll('note')).filter((n) => {
      const v = n.querySelector('voice'); return v && v.textContent === '2';
    });
    const durs = v2.map((n) => parseInt(n.querySelector('duration').textContent, 10));
    expect(durs.reduce((a, b) => a + b, 0)).toBe(6);
    const pitched = v2.find((n) => n.querySelector('pitch'));
    expect(pitched.getAttribute('color')).toBe('#C62828');
    expect(v2.some((n) => n.querySelector('rest'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-embellish-xml.test.js -t writeVoice`
Expected: FAIL — `writeVoice is not a function`.

- [ ] **Step 3: Write minimal implementation** (append near the other builder helpers, before `coloredNoteMarks`)

```js
// Lay a COMPLETE voice onto each measure of a segment doc: a <backup> that rewinds the measure's
// existing content, then the voice's notes in onset order with <rest>s filling every gap so the
// voice spans the full measure. `notesByMeasure[measureNumber] = { divs, notes: [...] }` where each
// note is { onsetDivs, durDivs, midi, name? } or { onsetDivs, durDivs, rest:true }. `divs` is the
// measure's total divisions. When `color` is set every pitched note carries it (→ coloredNoteMarks).
// Shared by the single-voice split and the contrapuntal counter-line.
export function writeVoice(doc, { voiceId, staff = null, notesByMeasure = {}, color = null }) {
  const divEl = doc.querySelector('divisions');
  const dpq = (divEl && parseInt(divEl.textContent, 10)) || 1;
  doc.querySelectorAll('measure').forEach((m) => {
    const num = parseInt(m.getAttribute('number'), 10);
    const spec = notesByMeasure[num];
    if (!spec) return;
    const total = spec.divs;
    // Rewind to the measure start for the new voice.
    if (total > 0) {
      const backup = doc.createElement('backup');
      const bd = doc.createElement('duration'); bd.textContent = String(total);
      backup.appendChild(bd);
      m.appendChild(backup);
    }
    // Onset-ordered notes with rests filling gaps (and the trailing gap up to `total`).
    const items = [...(spec.notes || [])].sort((a, b) => a.onsetDivs - b.onsetDivs);
    let cursor = 0;
    const emit = (durDivs, note) => {
      if (durDivs <= 0) return;
      const el = note || makeRest(doc);
      setDuration(el, durDivs, dpq);
      const v = doc.createElement('voice'); v.textContent = String(voiceId);
      el.appendChild(v);
      if (staff != null) { const s = doc.createElement('staff'); s.textContent = String(staff); el.appendChild(s); }
      m.appendChild(el);
    };
    items.forEach((it) => {
      if (it.onsetDivs > cursor) emit(it.onsetDivs - cursor, null);   // gap rest
      if (it.rest) { emit(it.durDivs, null); }
      else {
        const note = doc.createElement('note');
        const dur = doc.createElement('duration'); dur.textContent = String(it.durDivs); note.appendChild(dur);
        writePitch(note, it.midi, it.name);
        if (color) note.setAttribute('color', color);
        emit(it.durDivs, note);
      }
      cursor = Math.max(cursor, it.onsetDivs + it.durDivs);
    });
    if (cursor < total) emit(total - cursor, null);   // trailing rest
  });
  return doc;
}

// A bare <note><rest/></note> (duration set by the caller via setDuration).
function makeRest(doc) {
  const note = doc.createElement('note');
  note.appendChild(doc.createElement('rest'));
  return note;
}
```

Note: `emit` appends `<duration>` via `setDuration`, but `makeRest`/the pitched note must already have a `<duration>` child for `setDuration` to update — adjust `setDuration` call: for rests, create the `<duration>` first. Simplest: in `emit`, ensure a `<duration>` exists before calling `setDuration`:

```js
    const emit = (durDivs, note) => {
      if (durDivs <= 0) return;
      const el = note || makeRest(doc);
      if (!el.querySelector('duration')) {
        const d = doc.createElement('duration'); d.textContent = '0'; el.appendChild(d);
      }
      setDuration(el, durDivs, dpq);
      ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest public/music-embellish-xml.test.js -t writeVoice`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — `yarn jest public/` all green.

---

### Task 2: `grace` op in `applyVariation` (bluesy grace-slide)

**Files:**
- Modify: `public/music-embellish-xml.js` (add `applyGrace`, register in `APPLIERS`, handle in `editPosition`)
- Test: `public/music-embellish-xml.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { applyVariation, coloredNoteMarks } from './music-embellish-xml.js';

test('grace op inserts a colored, duration-less grace note before the target', () => {
  const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
    <attributes><divisions>2</divisions></attributes>
    <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice></note>
  </measure></part></score-partwise>`;
  // grace a semitone below C5 (midi 72 → 71 = B4).
  const out = applyVariation(seg, '1', [{ op: 'grace', index: 0, insertMidi: 71, insertName: 'B' }]);
  const doc = new DOMParser().parseFromString(out, 'application/xml');
  const notes = Array.from(doc.querySelectorAll('note'));
  expect(notes[0].querySelector('grace')).not.toBeNull();          // grace comes first
  expect(notes[0].querySelector('duration')).toBeNull();           // grace notes carry no duration
  expect(notes[0].getAttribute('color')).toBe('#C62828');
  expect(coloredNoteMarks(out).some((m) => m.midi === 71)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-embellish-xml.test.js -t "grace op"`
Expected: FAIL — grace note not created (op unknown).

- [ ] **Step 3: Write minimal implementation**

Add applier + register it:

```js
// Grace-slide: a slashed grace note (no <duration>) inserted before notes[index], slurred into it.
// Used by the bluesy grace-slide site. Colored so it highlights/rings as added material.
function applyGrace(doc, voiceId, edit) {
  const notes = voiceNotes(doc, voiceId);
  const target = notes[edit.index];
  if (!target) return;
  const g = doc.createElement('note');
  const grace = doc.createElement('grace'); grace.setAttribute('slash', 'yes');
  g.appendChild(grace);
  writePitch(g, edit.insertMidi, edit.insertName);   // grace has no <duration>, so pitch is inserted at front
  g.setAttribute('color', ADDED_NOTE_COLOR);
  const v = doc.createElement('voice'); v.textContent = String(voiceId); g.appendChild(v);
  target.parentNode.insertBefore(g, target);
}
```

Register in `APPLIERS`:

```js
const APPLIERS = {
  split: applySplit,
  insert: applyInsert,
  tie: applyTie,
  retime: applyRetime,
  grace: applyGrace,
};
```

And in `editPosition`, `grace` addresses by index (already the default `return edit.index;`), so no change needed.

Note: `writePitch` inserts `<pitch>` before the `<duration>` if present, else before `firstChild`. For a grace note there is no `<duration>`, so `<pitch>` lands after `<grace>` only if `<grace>` is `firstChild` — verify order: `writePitch` does `insertBefore(pitch, noteEl.firstChild)` when no duration, which would put pitch BEFORE `<grace>`. Fix ordering by appending pitch AFTER grace explicitly in `applyGrace` instead of relying on writePitch position: build pitch manually or move grace to front after writePitch:

```js
  writePitch(g, edit.insertMidi, edit.insertName);
  g.insertBefore(grace, g.firstChild);   // ensure <grace> is first, before <pitch>
```
(Remove the earlier `g.appendChild(grace)` and append grace via the reorder above.)

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest public/music-embellish-xml.test.js -t "grace op"`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — `yarn jest public/` all green.

---

### Task 3: `shuffle` op in `applyVariation`

**Files:**
- Modify: `public/music-embellish-xml.js` (add `applyShuffle`, register)
- Test: `public/music-embellish-xml.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('shuffle op re-times an eighth pair to long-short (2:1) preserving the beat total', () => {
  // divisions=6 (quarter=6, eighth=3). Two eighths on beat 1 → 4 + 2.
  const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
    <attributes><divisions>6</divisions></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>3</duration><voice>1</voice></note>
    <note><pitch><step>D</step><octave>4</octave></pitch><duration>3</duration><voice>1</voice></note>
  </measure></part></score-partwise>`;
  const out = applyVariation(seg, '1', [{ op: 'shuffle', index: 0 }]);
  const doc = new DOMParser().parseFromString(out, 'application/xml');
  const durs = Array.from(doc.querySelectorAll('note duration')).map((d) => parseInt(d.textContent, 10));
  expect(durs).toEqual([4, 2]);   // long, short; sums to the original 6
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-embellish-xml.test.js -t "shuffle op"`
Expected: FAIL — durations unchanged `[3,3]`.

- [ ] **Step 3: Write minimal implementation**

```js
// Shuffle: swing the eighth pair at [index, index+1] to long-short (2:1), keeping their combined
// duration. Skips if the pair can't split 2:1 into whole divisions >= 1 (leaves the DOM unchanged).
function applyShuffle(doc, voiceId, edit) {
  const notes = voiceNotes(doc, voiceId);
  const a = notes[edit.index]; const b = notes[edit.index + 1];
  if (!a || !b) return;
  const da = parseInt(a.querySelector('duration').textContent, 10);
  const db = parseInt(b.querySelector('duration').textContent, 10);
  const total = da + db;
  const long = Math.round((total * 2) / 3);
  const short = total - long;
  if (short < 1 || long < 1 || long <= short) return;   // can't swing (e.g. total < 3)
  const divEl = doc.querySelector('divisions');
  const dpq = (divEl && parseInt(divEl.textContent, 10)) || 1;
  setDuration(a, long, dpq);
  setDuration(b, short, dpq);
}
```

Register `shuffle: applyShuffle` in `APPLIERS`. `editPosition` default (`edit.index`) is correct.

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS.

- [ ] **Step 5: Checkpoint** — `yarn jest public/` all green.

---

## Phase 1 — Feature A: single-voice bass/melody split

### Task 4: `classifyBassMelody` (pure classifier)

**Files:**
- Create: `public/music-voice-split.js`
- Test: `public/music-voice-split.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { classifyBassMelody } from './music-voice-split.js';

describe('classifyBassMelody', () => {
  // notes: { midi, onsetDivs, durDivs, beat }  (beat already computed by the caller)
  test('lowest note per beat is bass; the rest are melody', () => {
    const notes = [
      { midi: 48, onsetDivs: 0, durDivs: 2, beat: 0 },   // C3  (lowest of beat 0 → bass)
      { midi: 64, onsetDivs: 0, durDivs: 2, beat: 0 },   // E4  (→ melody)
      { midi: 67, onsetDivs: 2, durDivs: 2, beat: 1 },   // G4  (only note of beat 1 → melody)
    ];
    const { melody, bass } = classifyBassMelody(notes);
    expect(bass.map((n) => n.midi)).toEqual([48]);
    expect(melody.map((n) => n.midi)).toEqual([64, 67]);
  });

  test('a single-note beat goes to melody, bass stays empty for it', () => {
    const notes = [{ midi: 60, onsetDivs: 0, durDivs: 4, beat: 0 }];
    const { melody, bass } = classifyBassMelody(notes);
    expect(melody).toHaveLength(1);
    expect(bass).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-voice-split.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// public/music-voice-split.js
//
// Split a single polyphonic voice into a melody line and a bass line by a pitch heuristic, so the
// Variations panel can embellish the melody over an untouched bass (and so contrapuntal has a
// melody to write against). Pure classifier + a MusicXML realizer built on writeVoice.

import { writeVoice } from './music-embellish-xml.js';

// Pitch extremes per beat: in each beat the single lowest-MIDI note → bass, every other note →
// melody. A one-note beat → melody only (bass rests). `notes` carry a pre-computed `beat`.
export function classifyBassMelody(notes) {
  const byBeat = new Map();
  (notes || []).forEach((n) => {
    const arr = byBeat.get(n.beat) || []; arr.push(n); byBeat.set(n.beat, arr);
  });
  const melody = []; const bass = [];
  for (const arr of byBeat.values()) {
    if (arr.length === 1) { melody.push(arr[0]); continue; }
    let lowest = arr[0];
    arr.forEach((n) => { if (n.midi < lowest.midi) lowest = n; });
    arr.forEach((n) => { (n === lowest ? bass : melody).push(n); });
  }
  melody.sort((a, b) => a.onsetDivs - b.onsetDivs);
  bass.sort((a, b) => a.onsetDivs - b.onsetDivs);
  return { melody, bass };
}
```

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS.

- [ ] **Step 5: Checkpoint** — `yarn jest public/` all green.

---

### Task 5: `splitSingleVoice` (MusicXML realizer)

**Files:**
- Modify: `public/music-voice-split.js`
- Test: `public/music-voice-split.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { splitSingleVoice } from './music-voice-split.js';

test('rewrites a single-voice segment into voice1=melody, voice2=bass', () => {
  // divisions=2. m1: chord stack C3+E4 on beat 0 (C3 via <chord/>), then G4 on beat 1.
  const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
    <attributes><divisions>2</divisions></attributes>
    <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
    <note><chord/><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>1</voice></note>
    <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
  </measure></part></score-partwise>`;
  const out = splitSingleVoice(seg);
  const doc = new DOMParser().parseFromString(out, 'application/xml');
  const voiceOf = (v) => Array.from(doc.querySelectorAll('note'))
    .filter((n) => (n.querySelector('voice') || {}).textContent === v && n.querySelector('pitch'));
  const midi = (n) => {
    const p = n.querySelector('pitch');
    const S = { C:0,D:2,E:4,F:5,G:7,A:9,B:11 };
    const step = p.querySelector('step').textContent;
    const oct = parseInt(p.querySelector('octave').textContent, 10);
    const alt = p.querySelector('alter') ? parseInt(p.querySelector('alter').textContent, 10) : 0;
    return 12 * (oct + 1) + S[step] + alt;
  };
  // bass (voice 2) = C3 (lowest of beat 0). melody (voice 1) = E4, G4.
  expect(voiceOf('2').map(midi)).toEqual([48]);
  expect(voiceOf('1').map(midi).sort((a,b)=>a-b)).toEqual([64, 67]);
  // a <backup> separates the two voices
  expect(doc.querySelector('backup')).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-voice-split.test.js -t "rewrites a single-voice"`
Expected: FAIL — `splitSingleVoice is not a function`.

- [ ] **Step 3: Write minimal implementation** (append to `music-voice-split.js`)

```js
const STEP_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midiOfPitchEl(p) {
  const step = p.querySelector('step').textContent.trim();
  const oct = parseInt(p.querySelector('octave').textContent, 10);
  const alt = p.querySelector('alter') ? parseInt(p.querySelector('alter').textContent, 10) : 0;
  return 12 * (oct + 1) + (STEP_PC[step] ?? 0) + alt;
}
function nameOfPitchEl(p) {
  const step = p.querySelector('step').textContent.trim();
  const alt = p.querySelector('alter') ? parseInt(p.querySelector('alter').textContent, 10) : 0;
  const acc = alt === 2 ? '##' : alt === 1 ? '#' : alt === -1 ? 'b' : alt === -2 ? 'bb' : '';
  return step + acc;
}

// True when the segment has at most one distinct <voice>.
export function isSingleVoice(xml) {
  const doc = typeof xml === 'string' ? new DOMParser().parseFromString(xml, 'application/xml') : xml;
  const ids = new Set(Array.from(doc.querySelectorAll('note voice')).map((v) => v.textContent.trim()));
  return ids.size <= 1;
}

// Re-partition a single-voice segment into voice "1" = melody, voice "2" = bass (pitch extremes per
// beat). Rebuilds each measure's note content via writeVoice; durations preserved, engraving
// simplified. Returns a new MusicXML string. No-op-ish for multi-voice input (returns it unchanged).
export function splitSingleVoice(xml) {
  const doc = typeof xml === 'string' ? new DOMParser().parseFromString(xml, 'application/xml') : xml;
  if (!isSingleVoice(doc)) return typeof xml === 'string' ? xml : new XMLSerializer().serializeToString(doc);
  const divEl = doc.querySelector('divisions');
  const dpq = (divEl && parseInt(divEl.textContent, 10)) || 1;

  const melodyByMeasure = {}; const bassByMeasure = {};
  doc.querySelectorAll('measure').forEach((m) => {
    const num = parseInt(m.getAttribute('number'), 10);
    let onset = 0; let total = 0;
    const notes = [];
    Array.from(m.querySelectorAll('note')).forEach((n) => {
      const isChord = !!n.querySelector('chord');
      const dur = parseInt((n.querySelector('duration') || {}).textContent, 10) || 0;
      const p = n.querySelector('pitch');
      const at = isChord ? onset - lastAdvance(notes, onset) : onset; // chord shares prev onset
      if (p) notes.push({ midi: midiOfPitchEl(p), name: nameOfPitchEl(p), onsetDivs: isChord ? prevOnset(notes) : onset, durDivs: dur, beat: Math.floor((isChord ? prevOnset(notes) : onset) / dpq) });
      if (!isChord) { onset += dur; total += dur; }
    });
    const { melody, bass } = classifyBassMelody(notes);
    melodyByMeasure[num] = { divs: total, notes: melody.map(toSpec) };
    bassByMeasure[num] = { divs: total, notes: bass.map(toSpec) };
    // Empty the measure's performance content (keep <attributes>).
    Array.from(m.querySelectorAll('note, backup, forward')).forEach((e) => e.remove());
  });

  writeVoice(doc, { voiceId: '1', notesByMeasure: melodyByMeasure });
  writeVoice(doc, { voiceId: '2', notesByMeasure: bassByMeasure });
  return new XMLSerializer().serializeToString(doc);
}

function toSpec(n) { return { onsetDivs: n.onsetDivs, durDivs: n.durDivs, midi: n.midi, name: n.name }; }
function prevOnset(notes) { return notes.length ? notes[notes.length - 1].onsetDivs : 0; }
function lastAdvance() { return 0; } // (chord notes reuse prevOnset; helper kept for clarity)
```

Note: the chord-onset handling above is fiddly; simplify by tracking onset explicitly — a `<chord/>` note shares the **immediately preceding** non-chord note's onset. Replace the per-note loop with:

```js
    let onset = 0; let total = 0; let lastOnset = 0;
    const notes = [];
    Array.from(m.querySelectorAll('note')).forEach((n) => {
      const isChord = !!n.querySelector('chord');
      const dur = parseInt((n.querySelector('duration') || {}).textContent, 10) || 0;
      const p = n.querySelector('pitch');
      const noteOnset = isChord ? lastOnset : onset;
      if (p) notes.push({ midi: midiOfPitchEl(p), name: nameOfPitchEl(p),
        onsetDivs: noteOnset, durDivs: dur, beat: Math.floor(noteOnset / dpq) });
      if (!isChord) { lastOnset = onset; onset += dur; total += dur; }
    });
```

(Drop `prevOnset`/`lastAdvance` — they were scaffolding.)

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS.

- [ ] **Step 5: Checkpoint** — `yarn jest public/` all green.

---

### Task 6: voice-picker entries + `music.html` wiring for the split

**Files:**
- Modify: `public/music-embellish-ui.js` (add `voicePickerEntries`)
- Modify: `public/music.html` (populate the picker; when a synthetic melody/bass entry is chosen, run the pipeline on `splitSingleVoice(source)` with voiceId '1' or '2')
- Test: `public/music-embellish-ui.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { voicePickerEntries } from './music-embellish-ui.js';

describe('voicePickerEntries', () => {
  test('single-voice source yields Melody + Bass synthetic entries', () => {
    const src = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
    </measure></part></score-partwise>`;
    const entries = voicePickerEntries(src, ['1']);
    expect(entries.map((e) => e.label)).toEqual(['Melody (auto-split)', 'Bass (auto-split)']);
    expect(entries.map((e) => e.split)).toEqual([true, true]);
    expect(entries.map((e) => e.voiceId)).toEqual(['1', '2']);
  });

  test('multi-voice source yields one entry per real voice (no split)', () => {
    const src = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      <note><pitch><step>E</step><octave>3</octave></pitch><duration>2</duration><voice>2</voice></note>
    </measure></part></score-partwise>`;
    const entries = voicePickerEntries(src, ['1', '2']);
    expect(entries.every((e) => e.split === false)).toBe(true);
    expect(entries.map((e) => e.voiceId)).toEqual(['1', '2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-embellish-ui.test.js -t voicePickerEntries`
Expected: FAIL — not a function.

- [ ] **Step 3: Write minimal implementation** (in `music-embellish-ui.js`; import `isSingleVoice`)

```js
import { isSingleVoice } from './music-voice-split.js';

// The voice-picker entries for the current source. Multi-voice → one entry per real voice. Single
// voice → two synthetic entries backed by splitSingleVoice: Melody (voice 1) + Bass (voice 2).
export function voicePickerEntries(sourceXml, orderedVoiceIds) {
  if (isSingleVoice(sourceXml)) {
    return [
      { label: 'Melody (auto-split)', voiceId: '1', split: true },
      { label: 'Bass (auto-split)', voiceId: '2', split: true },
    ];
  }
  return (orderedVoiceIds || []).map((id, i) => ({ label: `Voice ${i + 1}`, voiceId: id, split: false }));
}
```

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS.

- [ ] **Step 5: Wire `music.html`** (no unit test — thin glue)

In the voice-picker population (currently fills `#varVoice` from `currentDetail.voices`), replace with `voicePickerEntries(currentDetail.source, varVoiceIds)` and store the entries. In `varGenerate` and `renderSelectedVariation`, when the chosen entry has `split: true`, use `splitSingleVoice(currentDetail.source)` as the working source for `extractSegmentXml`, and the entry's `voiceId` ('1' or '2') as the edit target. Keep a module-level `varSplitSource` cache so `extractSegmentXml`/`applyVariation`/`variationFretSteps` all read the same split XML.

```js
// pseudocode inside varGenerate:
const entry = varEntries[parseInt(varVoice.value, 10)];
const workingSource = entry.split ? splitSingleVoice(currentDetail.source) : currentDetail.source;
varWorkingSource = workingSource;          // freeze for renderSelectedVariation/fretboard
const voiceId = entry.voiceId;
// ...build voiceNotes for that voiceId over [from,to] from workingSource, then generateVariations
```

- [ ] **Step 6: Checkpoint** — `yarn jest public/` all green; manual note: single-voice piece now shows Melody/Bass in the picker.

---

## Phase 2 — Feature B: Bluesy

### Task 7: `BLUE_PCS` (blue-note pitch classes)

**Files:**
- Modify: `public/music-embellish.js`
- Test: `public/music-embellish.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { BLUE_PCS } from './music-embellish.js';

test('BLUE_PCS returns b3, b5, b7 pitch classes relative to the key tonic', () => {
  // C major: tonic pc 0 → Eb(3), Gb(6), Bb(10).
  expect(new Set(BLUE_PCS('C'))).toEqual(new Set([3, 6, 10]));
  // A minor: tonic pc 9 → C(0), Eb(3), G(7).
  expect(new Set(BLUE_PCS('Am'))).toEqual(new Set([0, 3, 7]));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-embellish.test.js -t BLUE_PCS`
Expected: FAIL — not a function.

- [ ] **Step 3: Write minimal implementation** (in `music-embellish.js`; reuse `getScale`, `pitchClass`)

```js
// Blue-note pitch classes for a key: ♭3, ♭5/♯4, ♭7 above the tonic. Tonic pc from the scale's root
// (falls back to 0 for an unknown key so a bluesy pool still has something to add).
export function BLUE_PCS(key) {
  let tonic = 0;
  try { const scale = key ? getScale(key) : null; if (scale && scale.length) tonic = pitchClass(scale[0]) ?? 0; }
  catch (e) { tonic = 0; }
  return [3, 6, 10].map((iv) => (tonic + iv) % 12);
}
```

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS.

- [ ] **Step 5: Checkpoint** — `yarn jest public/` all green.

---

### Task 8: `blueGraceSlide` detector

**Files:**
- Modify: `public/music-embellish.js` (add detector, add to `DETECTORS`, add `bluesyGrace` to `TECHNIQUES` metadata used only in bluesy style)
- Test: `public/music-embellish.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { blueGraceSlideSites } from './music-embellish.js';

test('blueGraceSlide adds a grace a semitone below each strong-beat chord tone', () => {
  // Two notes; first is a strong-beat chord tone (C, pc 0, midi 60) in a C chord.
  const roled = [
    { midi: 60, pc: 0, isChordTone: true, beatStrength: 'strong', measure: 1, onset: 0, duration: 1 },
    { midi: 64, pc: 4, isChordTone: true, beatStrength: 'weak', measure: 1, onset: 1, duration: 1 },
  ];
  const sites = blueGraceSlideSites(roled);
  expect(sites).toHaveLength(1);
  expect(sites[0]).toMatchObject({ technique: 'bluesyGrace', op: 'grace', index: 0, insertMidi: 59 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-embellish.test.js -t blueGraceSlide`
Expected: FAIL — not a function.

- [ ] **Step 3: Write minimal implementation**

```js
// Bluesy grace-slide: a grace note a semitone BELOW each strong-beat chord tone, slurred into it.
// Emits a `grace` edit. Register-exact (midi-1); the builder colors it as added.
export function blueGraceSlideSites(roled) {
  const sites = [];
  (roled || []).forEach((t, i) => {
    if (!t.isChordTone || t.beatStrength !== 'strong') return;
    sites.push({ technique: 'bluesyGrace', op: 'grace', index: i,
      insertMidi: t.midi - 1, insertName: midiToName(t.midi - 1),
      label: `blue grace → ${midiToName(t.midi)} @ m${t.measure}` });
  });
  return sites;
}
```

Add `bluesyGrace` to `DETECTORS` map: `bluesyGrace: (roled) => blueGraceSlideSites(roled)`. (It ignores scale/pool.)

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS.

- [ ] **Step 5: Checkpoint** — `yarn jest public/` all green.

---

### Task 9: `style` param on `generateVariations` (bluesy pool + shuffle)

**Files:**
- Modify: `public/music-embellish.js`
- Test: `public/music-embellish.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { generateVariations } from './music-embellish.js';

test('bluesy style widens the pool with blue notes and enables blue grace sites', () => {
  const voiceNotes = [
    { midi: 60, onset: 0, duration: 1, measure: 1, chord: 'C' },   // strong-beat C chord tone
    { midi: 64, onset: 1, duration: 1, measure: 1, chord: 'C' },
    { midi: 67, onset: 2, duration: 1, measure: 1, chord: 'C' },
  ];
  const chordByMeasure = { 1: 'C' };
  const vars = generateVariations({ voiceNotes, chordByMeasure, segmentNoteNames: ['C', 'E', 'G'],
    key: 'C', style: 'bluesy', techniques: ['bluesyGrace'], cap: 20 });
  // At least one variation carries a blue grace edit.
  const hasGrace = vars.some((v) => v.edits.some((e) => e.op === 'grace'));
  expect(hasGrace).toBe(true);
});

test('shuffle=true adds a shuffle edit for eighth pairs', () => {
  const voiceNotes = [
    { midi: 60, onset: 0, duration: 0.5, measure: 1, chord: 'C' },
    { midi: 62, onset: 0.5, duration: 0.5, measure: 1, chord: 'C' },
  ];
  const vars = generateVariations({ voiceNotes, chordByMeasure: { 1: 'C' }, segmentNoteNames: ['C', 'D'],
    key: 'C', style: 'bluesy', techniques: [], shuffle: true, cap: 20 });
  expect(vars.some((v) => v.edits.some((e) => e.op === 'shuffle'))).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-embellish.test.js -t "bluesy style"`
Expected: FAIL — `style`/`shuffle` ignored; no grace/shuffle edits.

- [ ] **Step 3: Write minimal implementation** — extend `generateVariations`:

```js
export function generateVariations({ voiceNotes, chordByMeasure, segmentNoteNames, key,
  techniques, addNotes = false, cap = 50, style = 'classical', shuffle = false } = {}) {
  const pool = buildPool(segmentNoteNames, { addNotes, key });
  if (style === 'bluesy') BLUE_PCS(key).forEach((p) => pool.add(p));
  const roled = noteRoles(voiceNotes, chordByMeasure);
  const enabled = (techniques || []).slice();
  if (style === 'bluesy' && !enabled.includes('bluesyGrace')) enabled.push('bluesyGrace');
  const sites = eligibleSites(roled, { pool, key, techniques: enabled });
  if (style === 'bluesy' && shuffle) sites.push(...shuffleSites(roled));
  return enumerateVariations(sites, { cap });
}

// One shuffle edit per adjacent eighth-note pair that sits within a single beat (both durations ~0.5
// of a quarter). Kept as its own site so it combines with the other bluesy edits under the cap.
export function shuffleSites(roled) {
  const sites = [];
  for (let i = 0; i + 1 < (roled || []).length; i++) {
    const a = roled[i]; const b = roled[i + 1];
    if (a.duration === 0.5 && b.duration === 0.5 && a.measure === b.measure) {
      sites.push({ technique: 'shuffle', op: 'shuffle', index: i, label: `shuffle @ m${a.measure}` });
    }
  }
  return sites;
}
```

Note: confirm `enumerateVariations` conflict rule treats same-index edits as conflicting so a `grace` and a `split` on the same note don't co-occur — `grace` uses `index`, matching the existing index-based conflict key. Verify by reading `enumerateVariations`; if its conflict key only looks at `split`/`insert` gaps, extend it to include `grace`/`shuffle` `index` in the conflict set.

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS.

- [ ] **Step 5: Checkpoint** — `yarn jest public/` all green.

---

## Phase 3 — Feature C: Contrapuntal

### Task 10: `generateCounterLines` (pure generator)

**Files:**
- Create: `public/music-counterpoint.js`
- Test: `public/music-counterpoint.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { generateCounterLines } from './music-counterpoint.js';

describe('generateCounterLines', () => {
  // melody per beat: { midi, measure, beat, onsetDivs, durDivs }
  const melody = [
    { midi: 67, measure: 1, beat: 0, onsetDivs: 0, durDivs: 2 },   // G4 over C
    { midi: 65, measure: 1, beat: 1, onsetDivs: 2, durDivs: 2 },   // F4 over C
    { midi: 64, measure: 1, beat: 2, onsetDivs: 4, durDivs: 2 },   // E4 over C
  ];
  const chordByMeasure = { 1: 'C' };

  test('each counter-note is a chord tone below the melody', () => {
    const lines = generateCounterLines({ melody, chordByMeasure, key: 'C', register: 'below' });
    expect(lines.length).toBeGreaterThan(0);
    lines.forEach((line) => {
      expect(line.notes).toHaveLength(3);                       // one per melody beat
      line.notes.forEach((cn, i) => {
        expect(cn.midi).toBeLessThan(melody[i].midi);           // below the melody
        expect([0, 4, 7]).toContain(((cn.midi % 12) + 12) % 12); // C-chord tone (C/E/G)
      });
    });
  });

  test('prefers contrary/oblique motion (no all-parallel line when avoidable)', () => {
    const lines = generateCounterLines({ melody, chordByMeasure, key: 'C', register: 'below' });
    // At least one line makes a contrary move somewhere (melody down → counter up or same).
    const anyContrary = lines.some((line) => line.notes.some((cn, i) =>
      i > 0 && Math.sign(melody[i].midi - melody[i - 1].midi) !== Math.sign(cn.midi - line.notes[i - 1].midi)
      && (cn.midi - line.notes[i - 1].midi) !== 0));
    expect(anyContrary).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-counterpoint.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// public/music-counterpoint.js
//
// Generate independent counter-lines (one chord tone per melody beat) that move against the melody
// — preferring contrary/oblique motion and consonant vertical intervals. Pure: returns note lists;
// the caller realizes them as a new colored voice via writeVoice.

import { chordByAnyName } from './music-reference-data.js';
import { pitchClass } from './music-encoding.js';

const CONSONANT = new Set([0, 3, 4, 7, 8, 9, 12]);   // uni/3rd/4th-ish/5th/6th/oct (mod-12 interval)
const octavesDown = (pc, ceilMidi) => {              // highest midi <= ceilMidi with this pc
  let m = pc; while (m + 12 <= ceilMidi) m += 12; return m;
};

function chordPcs(sym) {
  const c = sym ? chordByAnyName(sym) : null;
  return c ? c.notes.map((n) => pitchClass(n)).filter((p) => p != null) : [];
}

export function generateCounterLines({ melody, chordByMeasure, key, register = 'below', cap = 6 } = {}) {
  if (!melody || !melody.length) return [];
  // Candidate chord-tone midis under (or over) each melody note.
  const candByBeat = melody.map((mn) => {
    const pcs = chordPcs(chordByMeasure[mn.measure]);
    const cands = [];
    pcs.forEach((pc) => {
      let m = register === 'above' ? octavesUp(pc, mn.midi + 1) : octavesDown(pc, mn.midi - 1);
      // two register options per pc
      [m, register === 'above' ? m + 12 : m - 12].forEach((cm) => {
        if (cm > 0 && cm !== mn.midi) cands.push(cm);
      });
    });
    return [...new Set(cands)];
  });
  // Greedy beam over start tones: score = consonance + motion (contrary/oblique preferred).
  const starts = candByBeat[0].slice(0, 4);
  const lines = [];
  starts.forEach((s0) => {
    const notes = [{ midi: s0, ...melody[0] }];
    for (let i = 1; i < melody.length; i++) {
      const prev = notes[i - 1].midi;
      const melDir = Math.sign(melody[i].midi - melody[i - 1].midi);
      let best = null; let bestScore = -Infinity;
      candByBeat[i].forEach((cm) => {
        const interval = ((melody[i].midi - cm) % 12 + 12) % 12;
        const consonant = CONSONANT.has(interval) ? 2 : 0;
        const ctDir = Math.sign(cm - prev);
        const motion = (ctDir === 0 || ctDir !== melDir) ? 1 : 0;   // oblique/contrary preferred
        const near = -Math.abs(cm - prev) / 12;                     // small leaps
        const score = consonant + motion + near;
        if (score > bestScore) { bestScore = score; best = cm; }
      });
      notes.push({ midi: best != null ? best : prev, ...melody[i] });
    }
    lines.push({ label: `counter-line from ${s0}`, notes });
  });
  // Dedupe identical lines; cap.
  const seen = new Set(); const out = [];
  for (const l of lines) {
    const key2 = l.notes.map((n) => n.midi).join(',');
    if (seen.has(key2)) continue; seen.add(key2); out.push(l);
    if (out.length >= cap) break;
  }
  return out;
}

function octavesUp(pc, floorMidi) { let m = pc; while (m < floorMidi) m += 12; return m; }
```

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS.

- [ ] **Step 5: Checkpoint** — `yarn jest public/` all green.

---

### Task 11: `counterLineToNotesByMeasure` + realize as a colored voice

**Files:**
- Modify: `public/music-embellish-ui.js` (add `counterLineToNotesByMeasure`)
- Test: `public/music-embellish-ui.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { counterLineToNotesByMeasure } from './music-embellish-ui.js';
import { writeVoice, ADDED_NOTE_COLOR } from './music-embellish-xml.js';

test('counter-line realizes as a colored voice via writeVoice', () => {
  const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
    <attributes><divisions>2</divisions></attributes>
    <note><pitch><step>G</step><octave>4</octave></pitch><duration>6</duration><voice>1</voice></note>
  </measure></part></score-partwise>`;
  const line = { notes: [{ midi: 48, measure: 1, onsetDivs: 0, durDivs: 6 }] };  // C3 whole beat-span
  const nbm = counterLineToNotesByMeasure(line, seg);
  expect(nbm[1].divs).toBe(6);
  const doc = new DOMParser().parseFromString(seg, 'application/xml');
  writeVoice(doc, { voiceId: '2', notesByMeasure: nbm, color: ADDED_NOTE_COLOR });
  const v2pitched = Array.from(doc.querySelectorAll('note'))
    .find((n) => (n.querySelector('voice') || {}).textContent === '2' && n.querySelector('pitch'));
  expect(v2pitched.getAttribute('color')).toBe(ADDED_NOTE_COLOR);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-embellish-ui.test.js -t "counter-line realizes"`
Expected: FAIL — not a function.

- [ ] **Step 3: Write minimal implementation**

```js
// Shape a counter-line (from generateCounterLines) into writeVoice's notesByMeasure form, reading
// each measure's total divisions from the segment's primary voice so the new voice spans it fully.
export function counterLineToNotesByMeasure(line, segmentXml) {
  const doc = new DOMParser().parseFromString(segmentXml, 'application/xml');
  const divsByMeasure = {};
  doc.querySelectorAll('measure').forEach((m) => {
    const num = parseInt(m.getAttribute('number'), 10);
    let total = 0;
    Array.from(m.querySelectorAll('note')).forEach((n) => {
      if (n.querySelector('chord')) return;
      total += parseInt((n.querySelector('duration') || {}).textContent, 10) || 0;
    });
    divsByMeasure[num] = total;
  });
  const nbm = {};
  (line.notes || []).forEach((cn) => {
    const arr = (nbm[cn.measure] = nbm[cn.measure] || { divs: divsByMeasure[cn.measure] || 0, notes: [] });
    arr.notes.push({ onsetDivs: cn.onsetDivs, durDivs: cn.durDivs, midi: cn.midi });
  });
  return nbm;
}
```

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS.

- [ ] **Step 5: Checkpoint** — `yarn jest public/` all green.

---

### Task 12: `variationFretSteps` two-voice support (contrapuntal capture)

**Files:**
- Modify: `public/music-embellish-ui.js` (accept a string OR array of voice ids)
- Test: `public/music-embellish-ui.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('variationFretSteps groups TWO voices per beat when given an array of ids', () => {
  const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
    <attributes><divisions>2</divisions></attributes>
    <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
    <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
    <backup><duration>4</duration></backup>
    <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>2</voice></note>
    <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>2</voice></note>
  </measure></part></score-partwise>`;
  const steps = variationFretSteps(seg, ['1', '2']);
  // beat 0: G4 (voice1) + C3 (voice2); beat 1: E4 + C3
  expect(steps[0].notes.map((n) => n.name).sort()).toEqual(['C', 'G']);
  expect(steps[1].notes.map((n) => n.name).sort()).toEqual(['C', 'E']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-embellish-ui.test.js -t "TWO voices"`
Expected: FAIL — only voice '1' (string path) or a thrown error on the array.

- [ ] **Step 3: Write minimal implementation** — generalize `variationFretSteps` to accept `voiceId` as a string or an array; when an array, include notes whose `<voice>` is in the set, and compute each voice's onset independently (per-voice clock), then group all into beats.

```js
export function variationFretSteps(varXml, voiceId) {
  const doc = typeof varXml === 'string' ? new DOMParser().parseFromString(varXml, 'application/xml') : varXml;
  const ids = Array.isArray(voiceId) ? voiceId.map(String) : [String(voiceId)];
  const divEl = doc.querySelector('divisions');
  const divisions = (divEl && parseInt(divEl.textContent, 10)) || 1;
  const beats = new Map();   // "measure:beat" → { measure, beat, notes: [] }
  doc.querySelectorAll('measure').forEach((mEl) => {
    const measure = parseInt(mEl.getAttribute('number'), 10);
    ids.forEach((id) => {
      let onset = 0;
      Array.from(mEl.querySelectorAll('note')).forEach((n) => {
        const v = n.querySelector('voice');
        if (!v || v.textContent.trim() !== id) return;
        const isChord = !!n.querySelector('chord');
        const dur = parseInt((n.querySelector('duration') || {}).textContent, 10) || 0;
        const pitch = n.querySelector('pitch');
        if (!isChord && pitch) {
          const beat = Math.floor(onset / divisions);
          const k = `${measure}:${beat}`;
          const grp = beats.get(k) || { measure, beat, notes: [] };
          const step = pitch.querySelector('step').textContent.trim();
          const octave = parseInt(pitch.querySelector('octave').textContent, 10);
          const alterEl = pitch.querySelector('alter');
          const alter = alterEl ? parseInt(alterEl.textContent, 10) : 0;
          const acc = alter === 2 ? '##' : alter === 1 ? '#' : alter === -1 ? 'b' : alter === -2 ? 'bb' : '';
          grp.notes.push({ name: step + acc, octave });
          beats.set(k, grp);
        }
        if (!isChord) onset += dur;
      });
    });
  });
  return [...beats.values()]
    .sort((a, b) => (a.measure - b.measure) || (a.beat - b.beat))
    .filter((s) => s.notes.length)
    .map((s) => ({ name: `m${s.measure} b${s.beat + 1}`, notes: s.notes }));
}
```

Verify the existing single-id tests still pass (string path preserved).

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS (new + existing single-voice tests).

- [ ] **Step 5: Checkpoint** — `yarn jest public/` all green.

---

## Phase 4 — UI wiring + integration + verification

### Task 13: `music.html` — Style selector + dispatch + contrapuntal render/fretboard

**Files:**
- Modify: `public/music.html`
- (No unit test — thin glue; covered by the integration task next.)

- [ ] **Step 1: Add the Style selector + shuffle/register controls** to `#variationsSection` (near the technique checkboxes):

```html
<label>Style
  <select id="varStyle">
    <option value="classical">Classical</option>
    <option value="bluesy">Bluesy</option>
    <option value="contrapuntal">Contrapuntal</option>
  </select>
</label>
<label id="varShuffleWrap" style="display:none"><input type="checkbox" id="varShuffle"> Shuffle</label>
<label id="varRegisterWrap" style="display:none">Counter
  <select id="varRegister"><option value="below">below</option><option value="above">above</option></select>
</label>
```

- [ ] **Step 2: Toggle control visibility on style change**

```js
document.getElementById('varStyle').addEventListener('change', (e) => {
  const style = e.target.value;
  document.getElementById('varTechs').style.display = style === 'contrapuntal' ? 'none' : '';
  document.getElementById('varShuffleWrap').style.display = style === 'bluesy' ? '' : 'none';
  document.getElementById('varRegisterWrap').style.display = style === 'contrapuntal' ? '' : 'none';
});
```

- [ ] **Step 3: Dispatch in `varGenerate`** — read `varStyle`; for classical/bluesy call `generateVariations({ ..., style, shuffle: varShuffle.checked })` on the (possibly split) working source; for contrapuntal call `generateCounterLines(...)` and store `{ isContrapuntal: true, line }` variations.

```js
const style = document.getElementById('varStyle').value;
const entry = varEntries[parseInt(document.getElementById('varVoice').value, 10)];
const workingSource = entry.split ? splitSingleVoice(currentDetail.source) : currentDetail.source;
varWorkingSource = workingSource;
if (style === 'contrapuntal') {
  const melody = buildBeatNotes(workingSource, entry.voiceId, from, to);  // {midi,measure,beat,onsetDivs,durDivs}
  const lines = generateCounterLines({ melody, chordByMeasure, key: currentDetail.meta.key,
    register: document.getElementById('varRegister').value });
  variations = lines.map((line, i) => ({ label: line.label || `Counter ${i + 1}`, isContrapuntal: true, line }));
  varGenVoiceIds = [entry.voiceId, '2'];   // fret capture shows both
} else {
  const voiceNotes = buildVoiceNotes(voiceForEntry(workingSource, entry.voiceId), from, to, chordByMeasure);
  variations = generateVariations({ voiceNotes, chordByMeasure, segmentNoteNames, key: currentDetail.meta.key,
    style, techniques: checkedTechniqueKeys(), addNotes: varAddNotes.checked,
    shuffle: document.getElementById('varShuffle').checked, cap: 50 });
  varGenVoiceIds = [entry.voiceId];
}
```

- [ ] **Step 4: `renderSelectedVariation`** — for contrapuntal, build the XML by `writeVoice`-ing the counter-line onto the extracted segment; else use `applyVariation` as today. Both then `highlightExtraNotes(coloredNoteMarks(varXml))`.

```js
const seg = extractSegmentXml(varWorkingSource, varGenRange);
let varXml;
if (v.isContrapuntal) {
  const doc = new DOMParser().parseFromString(seg, 'application/xml');
  writeVoice(doc, { voiceId: '2', notesByMeasure: counterLineToNotesByMeasure(v.line, seg), color: ADDED_NOTE_COLOR });
  varXml = new XMLSerializer().serializeToString(doc);
} else {
  varXml = applyVariation(seg, varGenVoiceIds[0], v.edits);
}
```

- [ ] **Step 5: Fretboard capture** — `buildVariationSteps` passes `varGenVoiceIds` (array) to `variationFretSteps`, so contrapuntal shows both voices per beat.

```js
function buildVariationSteps() {
  if (!currentVarXml) return [];
  return variationFretSteps(currentVarXml, varGenVoiceIds.length > 1 ? varGenVoiceIds : varGenVoiceIds[0]);
}
```

- [ ] **Step 6: Imports** — add `splitSingleVoice`, `voicePickerEntries`, `counterLineToNotesByMeasure`, `generateCounterLines`, `writeVoice` to the module imports; add a `buildBeatNotes(sourceXml, voiceId, from, to)` helper in `music-embellish-ui.js` (exported) that returns per-beat melody notes `{midi,measure,beat,onsetDivs,durDivs}` for the chosen voice over `[from,to]` (mirror `variationFretSteps`'s onset/beat logic, one entry per note, midi via STEP_PC).

- [ ] **Step 7: Checkpoint** — `yarn jest public/` all green.

---

### Task 14: `buildBeatNotes` (exported helper for contrapuntal melody input)

**Files:**
- Modify: `public/music-embellish-ui.js`
- Test: `public/music-embellish-ui.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { buildBeatNotes } from './music-embellish-ui.js';

test('buildBeatNotes returns per-note beat entries for a voice over a measure range', () => {
  const src = `<?xml version="1.0"?><score-partwise><part id="P1">
    <measure number="1"><attributes><divisions>2</divisions></attributes>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
    </measure></part></score-partwise>`;
  const out = buildBeatNotes(src, '1', 1, 1);
  expect(out).toEqual([
    { midi: 67, measure: 1, beat: 0, onsetDivs: 0, durDivs: 2 },
    { midi: 65, measure: 1, beat: 1, onsetDivs: 2, durDivs: 2 },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-embellish-ui.test.js -t buildBeatNotes`
Expected: FAIL — not a function.

- [ ] **Step 3: Write minimal implementation**

```js
const STEP_PC_UI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// Per-note beat entries { midi, measure, beat, onsetDivs, durDivs } for one voice over [from,to]
// (inclusive, by <measure number>). Skips <rest>/<chord/>. Used as contrapuntal melody input.
export function buildBeatNotes(sourceXml, voiceId, from, to) {
  const doc = new DOMParser().parseFromString(sourceXml, 'application/xml');
  const divEl = doc.querySelector('divisions');
  const divisions = (divEl && parseInt(divEl.textContent, 10)) || 1;
  const out = [];
  doc.querySelectorAll('measure').forEach((mEl) => {
    const measure = parseInt(mEl.getAttribute('number'), 10);
    if (measure < from || measure > to) return;
    let onset = 0;
    Array.from(mEl.querySelectorAll('note')).forEach((n) => {
      const v = n.querySelector('voice');
      if (v && v.textContent.trim() !== String(voiceId)) return;
      const isChord = !!n.querySelector('chord');
      const dur = parseInt((n.querySelector('duration') || {}).textContent, 10) || 0;
      const p = n.querySelector('pitch');
      if (!isChord && p) {
        const step = p.querySelector('step').textContent.trim();
        const oct = parseInt(p.querySelector('octave').textContent, 10);
        const alt = p.querySelector('alter') ? parseInt(p.querySelector('alter').textContent, 10) : 0;
        out.push({ midi: 12 * (oct + 1) + (STEP_PC_UI[step] ?? 0) + alt, measure,
          beat: Math.floor(onset / divisions), onsetDivs: onset, durDivs: dur });
      }
      if (!isChord) onset += dur;
    });
  });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS.

- [ ] **Step 5: Checkpoint** — `yarn jest public/` all green.

---

### Task 15: Integration sanity on real valsa

**Files:**
- Modify: `public/music-embellish-integration.test.js`

- [ ] **Step 1: Write the test** (guarded by the `$TMPDIR/valsa.json` fixture, like the existing ones)

```js
import { splitSingleVoice, isSingleVoice } from './music-voice-split.js';
import { generateCounterLines } from './music-counterpoint.js';
import { buildBeatNotes, counterLineToNotesByMeasure, variationFretSteps } from './music-embellish-ui.js';
import { writeVoice, extractSegmentXml, coloredNoteMarks, ADDED_NOTE_COLOR } from './music-embellish-xml.js';

maybe('voice-split + contrapuntal on a real single-voice-ish segment', () => {
  const seg = extractSegmentXml(detail.source, [1, 3]);
  if (isSingleVoice(seg)) {
    const split = splitSingleVoice(seg);
    expect(isSingleVoice(split)).toBe(false);                 // now two voices
    expect(() => new DOMParser().parseFromString(split, 'application/xml')).not.toThrow();
  }
  const melody = buildBeatNotes(detail.source, orderedVoiceIds(detail.source)[0], 1, 3);
  const chordByMeasure = buildChordByMeasure(collapsedChordSpans(detail));
  const lines = generateCounterLines({ melody, chordByMeasure, key: detail.meta.key, register: 'below' });
  expect(lines.length).toBeGreaterThan(0);
  const doc = new DOMParser().parseFromString(extractSegmentXml(detail.source, [1, 3]), 'application/xml');
  writeVoice(doc, { voiceId: '99', notesByMeasure: counterLineToNotesByMeasure(lines[0], extractSegmentXml(detail.source, [1, 3])), color: ADDED_NOTE_COLOR });
  const xml = new XMLSerializer().serializeToString(doc);
  expect(coloredNoteMarks(xml).length).toBeGreaterThan(0);    // counter-line marked as added
  const steps = variationFretSteps(xml, [orderedVoiceIds(detail.source)[0], '99']);
  steps.forEach((s) => expect(s.notes.length).toBeLessThanOrEqual(6));
});
```

- [ ] **Step 2: Run** — `yarn jest public/music-embellish-integration.test.js` — Expected: PASS (or skipped if no fixture).

- [ ] **Step 3: Checkpoint** — `yarn jest public/` all green.

---

### Task 16: Final verification

- [ ] **Step 1:** `yarn jest public/` — all suites green.
- [ ] **Step 2:** Manual smoke (report to user for their pre-deploy test): single-voice piece shows Melody/Bass; Bluesy produces grace/blue variations (red added notes); Shuffle swings; Contrapuntal shows a red counter-line on the sheet and both voices per beat on the fretboard.
- [ ] **Step 3:** Hand back to the user for their live test before deploy (per the agreed phasing).

---

## Self-Review

- **Spec coverage:** writeVoice (Task 1) ✓; grace/shuffle ops (Tasks 2–3) ✓; split classifier + realizer + UI (Tasks 4–6) ✓; BLUE_PCS + grace-slide + style/shuffle (Tasks 7–9) ✓; counterpoint generator + realize + two-voice fretboard (Tasks 10–12) ✓; UI style selector + dispatch (Tasks 13–14) ✓; integration (Task 15) ✓.
- **Type consistency:** `notesByMeasure[num] = { divs, notes:[{onsetDivs,durDivs,midi,name?|rest}] }` used identically by writeVoice, splitSingleVoice, counterLineToNotesByMeasure. `variationFretSteps(xml, voiceId|voiceId[])` — string path preserved for existing callers. Counter-line note shape `{midi,measure,beat,onsetDivs,durDivs}` produced by `buildBeatNotes`/`generateCounterLines` and consumed by `counterLineToNotesByMeasure`.
- **Open verification during execution:** confirm `enumerateVariations`'s conflict key covers `grace`/`shuffle` `index` (Task 9 note); confirm `setDuration` tolerates being called on a freshly-created rest that lacks `<type>` (Task 1 note handles the missing `<duration>`).
