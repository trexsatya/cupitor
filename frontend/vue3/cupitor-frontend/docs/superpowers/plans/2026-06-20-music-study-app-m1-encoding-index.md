# Music Study App — Milestone 1 (Encoding + Index) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn any score (MusicXML or note-text) into a normalized multi-channel searchable document, assemble a two-tier per-system index, and push it to GitHub via an in-app incremental "Rebuild & Push".

**Architecture:** Pure encoders (`music-encoding.js`) produce one schema from either source. `music-index.js` builds Tier-1 entries (metadata + packed search fields + pointer) and Tier-2 detail docs (full channels + inline source), resolves the per-system data root (`db/music/<system>`, mirroring language.html's `db/language/<lang>`), and pushes changed files in one commit via `window.GitHubUtils.commitMultipleFiles`. A small Manager view in `music.html` triggers it.

**Tech Stack:** Vanilla ES modules, jQuery (for MusicXML DOM parsing, via the existing `musicxml.js`), Jest + jsdom (`npx jest`), existing `github-utils.js` for GitHub writes.

---

## Spec deviations (read before starting)

1. **Chord inference uses a NEW pure matcher, not `guessChords`.** The spec said "inferred via `guessChords`", but `music-analysis.js`'s `guessChordsForMeasure` reads OSMD **pixel geometry** (`n.left`, `n.line`) — it requires the score rendered in a browser and can't run hermetically. M1 instead implements a pure **per-measure** chord matcher (`inferChords`, Task 5) on `allChords` from `music-reference-data.js`. `chordSymbol` = explicit `<harmony>` if present, else the inferred per-measure chord, else `null`. Sub-measure (per-beat) resolution is a documented later refinement.
2. **Do NOT import `music-analysis.js`.** It has import-time side effects (`$('#toggleFretboardBtn').click()` and a top-level `console.log`) and browser/OSMD coupling. The duration channel comes directly from `MusicXml().toArray()` (`note.type`/`dot`), not from `getRhythmCounting`.
3. **Rests are dropped in M1.** All channels are index-aligned to the *sounded-note* sequence (melodic n-gram search ignores rests). Rest-aware rhythm is a later enhancement.
4. **IndexedDB lazy detail cache moved to M2** (the read/search milestone). M1's read side is only `loadIndex` (to list pieces in the Manager).

## File structure

- **Create `public/music-encoding.js`** — pure functions: `pitchClass`, `nameToMidi`, `intervalsOf`, `toSargam`, `packContour`, `unpackContour`, `encodeNoteText`, `encodeMusicXml`, `inferChords`, `primaryVoice`. No I/O. (`encodeMusicXml` uses `MusicXml` from `musicxml.js`, which needs a global `$`.)
- **Create `public/music-index.js`** — `getSystemFromUrl`, `getMusicResourceUrl`, `fnv1a`, `buildIndexEntry`, `splitTiers`, `mergeIndex`, `rebuildAndPush`, `loadIndex`.
- **Create `public/music-encoding.test.js`** and **`public/music-index.test.js`** — Jest specs (self-contained inline fixtures).
- **Create `public/music-index.integration.test.js`** — opt-in tests against the user's real local `.xml` files (skipped if absent).
- **Modify `public/music.html`** — add a Manager view (list pieces, Add new, Rebuild & Push).

### Shared schema (use these exact shapes in every task)

```js
// EncodedDoc
{
  meta: { id, title, system, format, sourceUrl, youtube, key, time, tempo, instrument },
  voices: [ Voice ]
}
// Voice — every array is index-aligned to `pitch` (sounded notes only)
{
  pitch:        [Number],          // MIDI
  interval:     [Number],          // length = pitch.length - 1
  sargam:       [String|null],
  duration:     [String|null],     // note.type, e.g. "quarter"
  chordSymbol:  [String|null],     // <harmony> if present, else inferred per-measure (Task 5)
  lyric:        [String|null],
  measureIndex: [Number]
}
// IndexEntry (Tier-1)
{
  id, title, system, format, sourceUrl, youtube, key, time, tempo, instrument,
  voiceCount, noteCount, channels:[String],
  search: { contour:String, pitchClasses:String, sargam:String, chords:String },
  detailPath, contentHash, updatedAt
}
// Detail (Tier-2) — `source` holds the inline MusicXML (or raw note-text)
{ meta, voices, format, source }
```

---

### Task 1: Pure pitch helpers (`nameToMidi`, `intervalsOf`, `toSargam`)

**Files:**
- Create: `public/music-encoding.js`
- Test: `public/music-encoding.test.js`

- [ ] **Step 1: Write the failing test**

```js
// public/music-encoding.test.js
import { nameToMidi, intervalsOf, toSargam } from './music-encoding.js';

describe('pitch helpers', () => {
  test('nameToMidi: C4 = 60, A4 = 69, C#5 = 73', () => {
    expect(nameToMidi('C', 4)).toBe(60);
    expect(nameToMidi('A', 4)).toBe(69);
    expect(nameToMidi('C#', 5)).toBe(73);
    expect(nameToMidi('Db', 5)).toBe(73); // enharmonic
  });

  test('intervalsOf: deltas between consecutive MIDI numbers', () => {
    expect(intervalsOf([60, 67, 66, 65])).toEqual([7, -1, -1]);
    expect(intervalsOf([60])).toEqual([]);
    expect(intervalsOf([])).toEqual([]);
  });

  test('toSargam: degree in key by pitch-class, null for chromatic', () => {
    // Key of C major: C->Sa, D->Re, E->Ga, F->Ma, G->Pa, A->Dha, B->Ni
    expect(toSargam('C', 'C')).toBe('Sa');
    expect(toSargam('G', 'C')).toBe('Pa');
    expect(toSargam('Gb', 'C')).toBe(null);   // chromatic in C major
    // Minor key uses its own scale; A minor: A->Sa
    expect(toSargam('A', 'Am')).toBe('Sa');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/music-encoding.test.js -t "pitch helpers"`
Expected: FAIL — "Cannot find module './music-encoding.js'" / functions undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// public/music-encoding.js
import { getScale } from './music-reference-data.js';

const BASE_PC = {
  "C":0,"C#":1,"Db":1,"D":2,"D#":3,"Eb":3,"E":4,"E#":5,"Fb":4,
  "F":5,"F#":6,"Gb":6,"G":7,"G#":8,"Ab":8,"A":9,"A#":10,"Bb":10,
  "B":11,"B#":0,"Cb":11
};

const SARGAM = ["Sa","Re","Ga","Ma","Pa","Dha","Ni"];

export function pitchClass(name) {
  return BASE_PC[name];
}

export function nameToMidi(name, octave) {
  const pc = BASE_PC[name];
  if (pc === undefined || octave === undefined || octave === '' || Number.isNaN(octave)) return null;
  return 12 * (parseInt(octave, 10) + 1) + pc;
}

export function intervalsOf(pitches) {
  const out = [];
  for (let i = 1; i < pitches.length; i++) out.push(pitches[i] - pitches[i - 1]);
  return out;
}

export function toSargam(name, keyName) {
  const pc = BASE_PC[name];
  if (pc === undefined) return null;
  const scale = getScale(keyName);            // e.g. ["C","D","E","F","G","A","B"]
  const idx = scale.findIndex(n => BASE_PC[n] === pc);
  return idx === -1 ? null : SARGAM[idx];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/music-encoding.test.js -t "pitch helpers"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add public/music-encoding.js public/music-encoding.test.js
git commit -m "feat(music): pure pitch helpers (nameToMidi, intervalsOf, toSargam)"
```

---

### Task 2: Contour packer / unpacker (round-trip)

**Files:**
- Modify: `public/music-encoding.js`
- Test: `public/music-encoding.test.js`

- [ ] **Step 1: Write the failing test**

```js
// add to public/music-encoding.test.js
import { packContour, unpackContour } from './music-encoding.js';

describe('contour packing', () => {
  test('round-trips intervals through a compact string', () => {
    const intervals = [7, -1, -1, 0, 12, -12];
    const packed = packContour(intervals);
    expect(typeof packed).toBe('string');
    expect(unpackContour(packed)).toEqual(intervals);
  });

  test('empty intervals -> empty string -> empty array', () => {
    expect(packContour([])).toBe('');
    expect(unpackContour('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/music-encoding.test.js -t "contour packing"`
Expected: FAIL — `packContour`/`unpackContour` undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// add to public/music-encoding.js
// Comma-separated signed integers. Compact, lossless, trivially decodable.
// (A byte-packing scheme is a later optimization; correctness first.)
export function packContour(intervals) {
  return intervals.join(',');
}

export function unpackContour(str) {
  if (!str) return [];
  return str.split(',').map(s => parseInt(s, 10));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/music-encoding.test.js -t "contour packing"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add public/music-encoding.js public/music-encoding.test.js
git commit -m "feat(music): contour pack/unpack round-trip"
```

---

### Task 3: `encodeNoteText` (partial-channel doc)

**Files:**
- Modify: `public/music-encoding.js`
- Test: `public/music-encoding.test.js`

- [ ] **Step 1: Write the failing test**

```js
// add to public/music-encoding.test.js
import { encodeNoteText } from './music-encoding.js';

describe('encodeNoteText', () => {
  const txt = 'G4# D5# D5 C5#\nB4 C5# B4 A4# G4#';

  test('builds one voice with pitch/interval/sargam; rhythm+lyric+chord null', () => {
    const doc = encodeNoteText(txt, { id: 'jethalal_bgm', title: 'Jethalal BGM', system: 'western', key: 'G#m' });
    expect(doc.meta.format).toBe('note-text');
    expect(doc.meta.id).toBe('jethalal_bgm');
    expect(doc.voices).toHaveLength(1);
    const v = doc.voices[0];
    // 9 sounded notes across both lines
    expect(v.pitch).toEqual([68, 75, 74, 73, 71, 73, 71, 70, 68]);
    expect(v.interval).toEqual([7, -1, -1, -2, 2, -2, -1, -2]);
    expect(v.duration.every(d => d === null)).toBe(true);
    expect(v.lyric.every(l => l === null)).toBe(true);
    expect(v.chordSymbol.every(c => c === null)).toBe(true);
    expect(v.sargam).toHaveLength(v.pitch.length);
    expect(v.measureIndex).toHaveLength(v.pitch.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/music-encoding.test.js -t "encodeNoteText"`
Expected: FAIL — `encodeNoteText` undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// add to public/music-encoding.js
import { extractPitchesFromText } from './music_search.js';

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function midiToName(midi) { return NOTE_NAMES[((midi % 12) + 12) % 12]; }

export function encodeNoteText(txt, meta = {}) {
  const lines = extractPitchesFromText(txt, { defaultOctave: 4 }); // array of MIDI[] per note line, or string for non-note lines
  const pitch = [], measureIndex = [];
  let measure = 0;
  for (const line of lines) {
    if (Array.isArray(line) && line.length) {
      measure += 1; // treat each note line as a "measure" for context
      for (const m of line) { pitch.push(m); measureIndex.push(measure); }
    }
  }
  const key = meta.key || 'C';
  const voice = {
    pitch,
    interval: intervalsOf(pitch),
    sargam: pitch.map(m => toSargam(midiToName(m), key)),
    duration: pitch.map(() => null),
    chordSymbol: pitch.map(() => null),
    lyric: pitch.map(() => null),
    measureIndex
  };
  return {
    meta: {
      id: meta.id || null, title: meta.title || meta.id || null,
      system: meta.system || 'western', format: 'note-text',
      sourceUrl: meta.sourceUrl || null, youtube: meta.youtube || null,
      key, time: null, tempo: null, instrument: meta.instrument || null
    },
    voices: [voice]
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/music-encoding.test.js -t "encodeNoteText"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/music-encoding.js public/music-encoding.test.js
git commit -m "feat(music): encodeNoteText partial-channel encoder"
```

---

### Task 4: `encodeMusicXml` (full-channel doc, inline fixture)

**Files:**
- Modify: `public/music-encoding.js`
- Test: `public/music-encoding.test.js`

- [ ] **Step 1: Write the failing test**

```js
// add to public/music-encoding.test.js
import jQuery from 'jquery';
import { encodeMusicXml } from './music-encoding.js';

// musicxml.js relies on a global `$`; provide it for jsdom.
beforeAll(() => { global.$ = global.jQuery = jQuery; });

// Minimal but valid MusicXML: key=E (4 sharps), 4/4, two measures,
// notes E4 G#4 | B4, plus a <harmony> in measure 1 and a lyric on E4.
const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>4</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef></attributes>
      <harmony><root><root-step>E</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type>
        <lyric number="1"><syllabic>single</syllabic><text>la</text></lyric></note>
      <note><pitch><step>G</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;

describe('encodeMusicXml', () => {
  test('populates all channels with correct measureIndex', () => {
    const doc = encodeMusicXml(SAMPLE_XML, { id: 'sample', title: 'Sample', system: 'western' });
    expect(doc.meta.format).toBe('musicxml');
    expect(doc.meta.key).toBe('E');                 // <fifths>4</fifths> -> E major
    expect(doc.meta.time).toBe('4/4');
    expect(doc.voices).toHaveLength(1);
    const v = doc.voices[0];
    expect(v.pitch).toEqual([64, 68, 71]);          // E4, G#4, B4
    expect(v.interval).toEqual([4, 3]);
    expect(v.duration).toEqual(['half', 'half', 'whole']);
    expect(v.measureIndex).toEqual([1, 1, 2]);
    expect(v.lyric[0]).toBe('la');
    expect(v.sargam[0]).toBe('Sa');                 // E is tonic of E major
    expect(v.chordSymbol[0]).toBe('E');             // from <harmony> in measure 1
    expect(v.chordSymbol[2]).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/music-encoding.test.js -t "encodeMusicXml"`
Expected: FAIL — `encodeMusicXml` undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// add to public/music-encoding.js
import { MusicXml } from './musicxml.js';

// Map a key signature (count of sharps, positive) / flats (negative) to a major key name.
const FIFTHS_TO_KEY = { '-7':'Cb','-6':'Gb','-5':'Db','-4':'Ab','-3':'Eb','-2':'Bb','-1':'F',
  '0':'C','1':'G','2':'D','3':'A','4':'E','5':'B','6':'F#','7':'C#' };

export function encodeMusicXml(xmlString, meta = {}) {
  const mx = new MusicXml().loadXml(xmlString);
  const measures = mx.toArray();                  // [[{name,octave,type,dot,voice,tie}, ...], ...]

  const $xml = mx.xml;
  const fifths = $xml.find('fifths').first().text();
  const key = FIFTHS_TO_KEY[String(parseInt(fifths || '0', 10))] || 'C';
  const beats = $xml.find('time > beats').first().text();
  const beatType = $xml.find('time > beat-type').first().text();
  const time = (beats && beatType) ? `${beats}/${beatType}` : null;
  const instrument = $xml.find('instrument-name').first().text() ||
                     $xml.find('part-name').first().text() || null;

  // Harmony per measure (M1: explicit <harmony> only). Index by measure number.
  const harmonyByMeasure = {};
  $xml.find('measure').each(function () {
    const num = parseInt($(this).attr('number'), 10);
    const h = $(this).find('harmony root root-step').first().text();
    if (h) {
      const kind = $(this).find('harmony kind').first().text();
      harmonyByMeasure[num] = h + (kind === 'minor' ? 'm' : '');
    }
  });
  // Lyrics per note, in document order (aligned to sounded notes below).
  const lyricByNoteOrder = [];
  $xml.find('part > measure > note').each(function () {
    const hasPitch = $(this).find('pitch').length > 0;
    if (hasPitch) lyricByNoteOrder.push($(this).find('lyric text').first().text() || null);
  });

  // Build per-voice streams over sounded notes (rests dropped).
  const voicesMap = {};
  let soundedOrder = 0;
  measures.forEach((notes, mIdx) => {
    const measureNumber = mIdx + 1;
    notes.forEach(n => {
      if (!n.name || n.name.trim() === '' || Number.isNaN(n.octave)) return; // rest
      const midi = nameToMidi(n.name.replace(/[#b]/g, m => m), n.octave);
      // n.name already includes # / b from toArray(); nameToMidi handles that via BASE_PC
      const realMidi = nameToMidi(n.name, n.octave);
      if (realMidi === null) return;
      const vKey = n.voice || '1';
      const v = (voicesMap[vKey] = voicesMap[vKey] || { pitch:[], duration:[], lyric:[], chordSymbol:[], measureIndex:[] });
      v.pitch.push(realMidi);
      v.duration.push(n.type || null);
      v.lyric.push(lyricByNoteOrder[soundedOrder] || null);
      v.chordSymbol.push(harmonyByMeasure[measureNumber] || null);
      v.measureIndex.push(measureNumber);
      soundedOrder += 1;
    });
  });

  const noteNameAt = (midi) => ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][((midi%12)+12)%12];
  const voices = Object.keys(voicesMap).map(k => {
    const v = voicesMap[k];
    return {
      pitch: v.pitch,
      interval: intervalsOf(v.pitch),
      sargam: v.pitch.map(m => toSargam(noteNameAt(m), key)),
      duration: v.duration,
      chordSymbol: v.chordSymbol,
      lyric: v.lyric,
      measureIndex: v.measureIndex
    };
  });

  return {
    meta: {
      id: meta.id || null, title: meta.title || meta.id || null,
      system: meta.system || 'western', format: 'musicxml',
      sourceUrl: meta.sourceUrl || null, youtube: meta.youtube || null,
      key, time, tempo: null, instrument
    },
    voices: voices.length ? voices : [{ pitch:[],interval:[],sargam:[],duration:[],chordSymbol:[],lyric:[],measureIndex:[] }]
  };
}
```

> Note: the `n.name.replace(...)` line above is redundant; the operative call is `nameToMidi(n.name, n.octave)`. Keep only `realMidi` — delete the first `midi` line when implementing. (Left here only to make the intent explicit.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/music-encoding.test.js -t "encodeMusicXml"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/music-encoding.js public/music-encoding.test.js
git commit -m "feat(music): encodeMusicXml full-channel encoder (harmony-only chords)"
```

---

### Task 5: Pure per-measure chord inference (`inferChords`)

**Files:**
- Modify: `public/music-encoding.js`
- Test: `public/music-encoding.test.js`

- [ ] **Step 1: Write the failing test**

```js
// add to public/music-encoding.test.js
import { inferChords } from './music-encoding.js';

describe('inferChords (pure, per-measure)', () => {
  test('fills null chordSymbol with the best per-measure triad', () => {
    // For note-text, each line is one measure.
    const doc = encodeNoteText('C4 E4 G4\nA4 C5 E5', { id: 't', key: 'C' });
    const out = inferChords(doc);
    expect(out.voices[0].chordSymbol).toEqual(['C', 'C', 'C', 'Am', 'Am', 'Am']);
  });

  test('returns null for a measure with no clear triad', () => {
    const doc = encodeNoteText('C4 D4', { id: 't', key: 'C' });
    expect(inferChords(doc).voices[0].chordSymbol).toEqual([null, null]);
  });

  test('does not overwrite an existing (harmony) chordSymbol', () => {
    const doc = encodeNoteText('C4 E4 G4', { id: 't', key: 'C' });
    doc.voices[0].chordSymbol[0] = 'Csus4';           // pretend a <harmony> tag set this
    const out = inferChords(doc);
    expect(out.voices[0].chordSymbol[0]).toBe('Csus4'); // preserved
    expect(out.voices[0].chordSymbol[1]).toBe('C');     // null slots filled with the measure chord
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/music-encoding.test.js -t "inferChords"`
Expected: FAIL — `inferChords` undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// add to public/music-encoding.js
import { allChords, normaliseChordName } from './music-reference-data.js';

// Build chord candidates (pitch-class sets) once. Triads and larger only.
const CHORD_CANDIDATES = (() => {
  const seen = new Set(), out = [];
  Object.keys(allChords).forEach(key => {
    const c = allChords[key];
    const rootPc = pitchClass(c.root);
    if (rootPc === undefined) return;
    const tonePcs = new Set(c.notes.map(pitchClass).filter(pc => pc !== undefined));
    if (tonePcs.size < 3) return;
    const symbol = normaliseChordName(key);
    const sig = rootPc + ':' + [...tonePcs].sort((a, b) => a - b).join(',') + ':' + symbol;
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push({ symbol, rootPc, tonePcs });
  });
  return out;
})();

function matchChord(pcSet) {
  let best = null, bestScore = -Infinity;
  for (const c of CHORD_CANDIDATES) {
    if (!pcSet.has(c.rootPc)) continue;
    let present = 0; c.tonePcs.forEach(t => { if (pcSet.has(t)) present++; });
    if (present < 3) continue;
    let extra = 0; pcSet.forEach(p => { if (!c.tonePcs.has(p)) extra++; });
    const score = present * 2 - extra - (c.tonePcs.size - present);
    const better = score > bestScore || (score === bestScore && best &&
      (c.tonePcs.size < best.tonePcs.size ||
       (c.tonePcs.size === best.tonePcs.size && c.symbol.localeCompare(best.symbol) < 0)));
    if (better) { best = c; bestScore = score; }
  }
  return best ? best.symbol : null;
}

// Fills only null chordSymbol slots with the inferred chord for that note's measure.
export function inferChords(doc) {
  const pcByMeasure = {};
  doc.voices.forEach(v => v.pitch.forEach((m, i) => {
    const meas = v.measureIndex[i];
    (pcByMeasure[meas] = pcByMeasure[meas] || new Set()).add(((m % 12) + 12) % 12);
  }));
  const chordByMeasure = {};
  Object.keys(pcByMeasure).forEach(meas => { chordByMeasure[meas] = matchChord(pcByMeasure[meas]); });
  doc.voices.forEach(v => v.pitch.forEach((m, i) => {
    if (v.chordSymbol[i] == null) v.chordSymbol[i] = chordByMeasure[v.measureIndex[i]] || null;
  }));
  return doc;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/music-encoding.test.js -t "inferChords"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add public/music-encoding.js public/music-encoding.test.js
git commit -m "feat(music): pure per-measure chord inference (inferChords)"
```

---

### Task 6: `primaryVoice`, `fnv1a`, `buildIndexEntry`, `splitTiers`

**Files:**
- Modify: `public/music-encoding.js` (add `primaryVoice`)
- Create: `public/music-index.js`
- Test: `public/music-index.test.js`

- [ ] **Step 1: Write the failing test**

```js
// public/music-index.test.js
import { encodeNoteText, primaryVoice } from './music-encoding.js';
import { fnv1a, buildIndexEntry, splitTiers } from './music-index.js';

const txt = 'G4# D5# D5 C5#\nB4 C5# B4 A4# G4#';

describe('index assembly', () => {
  test('fnv1a is stable and changes with input', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'));
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
    expect(typeof fnv1a('abc')).toBe('string');
  });

  test('primaryVoice returns the voice with the most notes', () => {
    const doc = encodeNoteText(txt, { id: 'jethalal_bgm', key: 'G#m' });
    expect(primaryVoice(doc).pitch.length).toBe(9);
  });

  test('buildIndexEntry: metadata + packed search fields + pointer + hash', () => {
    const doc = encodeNoteText(txt, { id: 'jethalal_bgm', title: 'Jethalal BGM', system: 'western', key: 'G#m' });
    const entry = buildIndexEntry(doc, txt);
    expect(entry.id).toBe('jethalal_bgm');
    expect(entry.system).toBe('western');
    expect(entry.format).toBe('note-text');
    expect(entry.noteCount).toBe(9);
    expect(entry.voiceCount).toBe(1);
    expect(entry.channels).toEqual(['pitch', 'interval', 'sargam']);
    expect(entry.search.contour).toBe('7,-1,-1,-2,2,-2,-1,-2');
    expect(entry.detailPath).toBe('details/jethalal_bgm.json');
    expect(entry.contentHash).toBe(fnv1a(txt));
  });

  test('splitTiers: detail carries voices + inline source', () => {
    const doc = encodeNoteText(txt, { id: 'jethalal_bgm', key: 'G#m' });
    const { entry, detail } = splitTiers(doc, txt);
    expect(entry.id).toBe('jethalal_bgm');
    expect(detail.format).toBe('note-text');
    expect(detail.source).toBe(txt);
    expect(detail.voices[0].pitch.length).toBe(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/music-index.test.js`
Expected: FAIL — `music-index.js` not found; `primaryVoice` undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// add to public/music-encoding.js
export function primaryVoice(doc) {
  if (!doc.voices || !doc.voices.length) return { pitch:[],interval:[],sargam:[],duration:[],chordSymbol:[],lyric:[],measureIndex:[] };
  return doc.voices.reduce((best, v) => (v.pitch.length > best.pitch.length ? v : best), doc.voices[0]);
}
```

```js
// public/music-index.js
import { primaryVoice, packContour } from './music-encoding.js';

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

function channelsOf(doc) {
  const v = primaryVoice(doc);
  const present = ['pitch', 'interval', 'sargam'];
  if (v.duration.some(d => d !== null)) present.push('duration');
  if (v.chordSymbol.some(c => c !== null)) present.push('chordSymbol');
  if (v.lyric.some(l => l !== null)) present.push('lyric');
  return present;
}

const PC_NAMES = ["C","Cs","D","Ds","E","F","Fs","G","Gs","A","As","B"];

export function buildIndexEntry(doc, source) {
  const v = primaryVoice(doc);
  const noteCount = doc.voices.reduce((n, vv) => n + vv.pitch.length, 0);
  const chords = [];
  doc.voices.forEach(vv => vv.chordSymbol.forEach(c => { if (c && chords[chords.length - 1] !== c) chords.push(c); }));
  return {
    id: doc.meta.id,
    title: doc.meta.title,
    system: doc.meta.system,
    format: doc.meta.format,
    sourceUrl: doc.meta.sourceUrl,
    youtube: doc.meta.youtube,
    key: doc.meta.key,
    time: doc.meta.time,
    tempo: doc.meta.tempo,
    instrument: doc.meta.instrument,
    voiceCount: doc.voices.length,
    noteCount,
    channels: channelsOf(doc),
    search: {
      contour: packContour(v.interval),
      pitchClasses: v.pitch.map(m => PC_NAMES[((m % 12) + 12) % 12]).join(' '),
      sargam: v.sargam.filter(Boolean).join(' '),
      chords: chords.join(' ')
    },
    detailPath: `details/${doc.meta.id}.json`,
    contentHash: fnv1a(source),
    updatedAt: null   // stamped by the caller (Date is unavailable in some contexts)
  };
}

export function splitTiers(doc, source) {
  const entry = buildIndexEntry(doc, source);
  const detail = { meta: doc.meta, voices: doc.voices, format: doc.meta.format, source };
  return { entry, detail };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/music-index.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add public/music-encoding.js public/music-index.js public/music-index.test.js
git commit -m "feat(music): index entry + tier split + fnv1a content hash"
```

---

### Task 7: `getSystemFromUrl` + `getMusicResourceUrl` (mirror language.html)

**Files:**
- Modify: `public/music-index.js`
- Test: `public/music-index.test.js`

- [ ] **Step 1: Write the failing test**

```js
// add to public/music-index.test.js
import { getSystemFromUrl, getMusicResourceUrl } from './music-index.js';

describe('system routing (mirrors ?lang=)', () => {
  test('defaults to western when ?system is absent', () => {
    expect(getSystemFromUrl('https://x/music.html').name).toBe('western');
  });
  test('reads ?system=sargam', () => {
    expect(getSystemFromUrl('https://x/music.html?system=sargam').name).toBe('sargam');
  });
  test('resource url points at db/music/<system> on gh-pages', () => {
    expect(getMusicResourceUrl('western'))
      .toBe('https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/music/western');
    expect(getMusicResourceUrl('sargam'))
      .toBe('https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/music/sargam');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/music-index.test.js -t "system routing"`
Expected: FAIL — functions undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// add to public/music-index.js
export function getSystemFromUrl(href) {
  const url = new URL(href || (typeof window !== 'undefined' ? window.location.href : 'https://x/'));
  let value = new URLSearchParams(url.search).get('system');
  if (value !== 'sargam') value = 'western';   // default western, mirrors lang default 'swedish'
  return { name: value };
}

export function getMusicResourceUrl(system) {
  const name = system || getSystemFromUrl().name;
  return `https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/music/${name}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/music-index.test.js -t "system routing"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add public/music-index.js public/music-index.test.js
git commit -m "feat(music): ?system routing + per-system resource url (mirrors ?lang)"
```

---

### Task 8: `mergeIndex` + `rebuildAndPush` (injected committer, no network)

**Files:**
- Modify: `public/music-index.js`
- Test: `public/music-index.test.js`

- [ ] **Step 1: Write the failing test**

```js
// add to public/music-index.test.js
import { mergeIndex, rebuildAndPush } from './music-index.js';

describe('rebuild & push (payload assembly)', () => {
  test('mergeIndex replaces entry by id, keeps others', () => {
    const existing = [{ id: 'a', noteCount: 1 }, { id: 'b', noteCount: 2 }];
    const merged = mergeIndex(existing, [{ id: 'b', noteCount: 99 }, { id: 'c', noteCount: 3 }]);
    expect(merged.find(e => e.id === 'b').noteCount).toBe(99);
    expect(merged.find(e => e.id === 'a').noteCount).toBe(1);
    expect(merged.find(e => e.id === 'c').noteCount).toBe(3);
  });

  test('rebuildAndPush builds index.json + one detail file per changed piece', async () => {
    const calls = [];
    const fakeCommitter = async (files) => { calls.push(files); return { ok: true }; };
    const pieces = [{ id: 'jethalal_bgm', title: 'Jethalal BGM', format: 'note-text',
                      source: 'G4# A4# B4', key: 'G#m' }];
    const result = await rebuildAndPush({
      system: 'western', pieces, currentIndex: [], committer: fakeCommitter, updatedAt: '2026-06-20'
    });
    expect(result.changed).toEqual(['jethalal_bgm']);
    const files = calls[0];
    const paths = files.map(f => f.path);
    expect(paths).toContain('db/music/western/index.json');
    expect(paths).toContain('db/music/western/details/jethalal_bgm.json');
    const idxFile = files.find(f => f.path === 'db/music/western/index.json');
    const idx = JSON.parse(await idxFile.getContent(null));
    expect(idx[0].id).toBe('jethalal_bgm');
    expect(idx[0].updatedAt).toBe('2026-06-20');
  });

  test('rebuildAndPush skips pieces whose contentHash is unchanged', async () => {
    const fakeCommitter = async () => ({ ok: true });
    const src = 'G4# A4# B4';
    const first = await rebuildAndPush({ system: 'western',
      pieces: [{ id: 'x', format: 'note-text', source: src, key: 'C' }],
      currentIndex: [], committer: fakeCommitter });
    const existing = first.index;            // index after first build
    const second = await rebuildAndPush({ system: 'western',
      pieces: [{ id: 'x', format: 'note-text', source: src, key: 'C' }],
      currentIndex: existing, committer: fakeCommitter });
    expect(second.changed).toEqual([]);      // unchanged -> skipped
  });

  test('runs chord inference — entry gains chordSymbol channel + search.chords', async () => {
    const fakeCommitter = async () => ({ ok: true });
    const res = await rebuildAndPush({ system: 'western',
      pieces: [{ id: 'triad', format: 'note-text', source: 'C4 E4 G4', key: 'C' }],
      currentIndex: [], committer: fakeCommitter });
    const entry = res.index.find(e => e.id === 'triad');
    expect(entry.channels).toContain('chordSymbol');
    expect(entry.search.chords).toBe('C');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/music-index.test.js -t "rebuild & push"`
Expected: FAIL — `mergeIndex`/`rebuildAndPush` undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// add to public/music-index.js
import { encodeNoteText, encodeMusicXml, inferChords } from './music-encoding.js';

export function mergeIndex(existing, entries) {
  const byId = new Map(existing.map(e => [e.id, e]));
  entries.forEach(e => byId.set(e.id, e));
  return Array.from(byId.values());
}

function encodePiece(piece) {
  const meta = { id: piece.id, title: piece.title, system: piece.system, key: piece.key,
                 sourceUrl: piece.sourceUrl, youtube: piece.youtube, instrument: piece.instrument };
  const doc = piece.format === 'musicxml'
    ? encodeMusicXml(piece.source, meta)
    : encodeNoteText(piece.source, meta);
  return inferChords(doc);   // fill chordSymbol (harmony tags already win — inferChords only fills nulls)
}

// committer: async (files:[{path, getContent(current)}]) => any   (wraps GitHubUtils.commitMultipleFiles)
export async function rebuildAndPush({ system, pieces, currentIndex = [], committer, force = false, updatedAt = null }) {
  const currentById = new Map(currentIndex.map(e => [e.id, e]));
  const changedEntries = [];
  const changedDetails = [];   // {id, detail}
  const changed = [];

  for (const piece of pieces) {
    const doc = encodePiece(piece);
    doc.meta.system = system;
    const { entry, detail } = splitTiers(doc, piece.source);
    entry.updatedAt = updatedAt;
    const prev = currentById.get(entry.id);
    if (!force && prev && prev.contentHash === entry.contentHash) continue; // unchanged
    changedEntries.push(entry);
    changedDetails.push({ id: entry.id, detail });
    changed.push(entry.id);
  }

  const index = mergeIndex(currentIndex, changedEntries);
  if (changed.length === 0) return { changed, index, pushed: false };

  const files = [
    { path: `db/music/${system}/index.json`, getContent: () => JSON.stringify(index, null, 2) },
    ...changedDetails.map(d => ({
      path: `db/music/${system}/details/${d.id}.json`,
      getContent: () => JSON.stringify(d.detail)
    }))
  ];
  await committer(files);
  return { changed, index, pushed: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/music-index.test.js -t "rebuild & push"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add public/music-index.js public/music-index.test.js
git commit -m "feat(music): rebuildAndPush payload assembly + incremental skip"
```

---

### Task 9: Integration tests against the real local scores (opt-in)

**Files:**
- Create: `public/music-index.integration.test.js`

- [ ] **Step 1: Write the test (guarded — skips if files absent)**

```js
// public/music-index.integration.test.js
import fs from 'fs';
import jQuery from 'jquery';
import { encodeMusicXml, inferChords } from './music-encoding.js';
import { buildIndexEntry } from './music-index.js';

beforeAll(() => { global.$ = global.jQuery = jQuery; });

const SCORES = '/Users/satyendra.kumar/Documents/MuseScore3/Scores';
const CHOPIN = `${SCORES}/Chopin_Nocturne_Op.9_No.2_for_Solo_Guitar.xml`;
const SOR = `${SCORES}/24_Etudes_Op.35_-_Fernando_Sor_1778_-_1839.xml`;
const have = (p) => { try { return fs.existsSync(p); } catch (_) { return false; } };

(have(CHOPIN) ? describe : describe.skip)('real file: Chopin Nocturne', () => {
  test('encodes; key from 4 sharps; channels present', () => {
    const xml = fs.readFileSync(CHOPIN, 'utf8');
    const doc = inferChords(encodeMusicXml(xml, { id: 'Chopin_Nocturne_Op.9_No.2_for_Solo_Guitar', system: 'western' }));
    expect(doc.meta.key).toBe('E');
    const entry = buildIndexEntry(doc, xml);
    expect(entry.noteCount).toBeGreaterThan(100);
    expect(entry.channels).toContain('duration');
    expect(entry.channels).toContain('chordSymbol');   // inference produced chords
    expect(entry.search.chords.length).toBeGreaterThan(0);
    expect(entry.search.contour.length).toBeGreaterThan(0);
  });
});

(have(SOR) ? describe : describe.skip)('real file: Sor 24 Études (stress)', () => {
  test('encodes 932-measure / ~4MB file without error', () => {
    const xml = fs.readFileSync(SOR, 'utf8');
    const doc = encodeMusicXml(xml, { id: '24_Etudes_Op.35_-_Fernando_Sor', system: 'western' });
    const entry = buildIndexEntry(doc, xml);
    expect(entry.noteCount).toBeGreaterThan(500);
  }, 30000); // generous timeout for the large parse
});
```

- [ ] **Step 2: Run the integration tests**

Run: `npx jest public/music-index.integration.test.js`
Expected: PASS if the files exist at the paths above; otherwise the suites report as **skipped** (not failed).

- [ ] **Step 3: Commit**

```bash
git add public/music-index.integration.test.js
git commit -m "test(music): opt-in integration tests on real Chopin/Sor scores"
```

---

### Task 10: Manager view in `music.html` (list + Add new + Rebuild & Push)

**Files:**
- Modify: `public/music.html`

This task is **browser-verified** (GitHub writes can't run in the hermetic test). It wires the tested modules to a minimal UI and the real committer.

- [ ] **Step 1: Add the Manager markup + script to `music.html`**

Replace the existing `<body>`…prototype search block in [public/music.html](../../../public/music.html) with a Manager section (keep the existing `<style>`):

```html
<body>
<h1>Music Library — Manager (<span id="systemLabel"></span>)</h1>
<div class="controls">
  <button id="addXmlBtn">Add MusicXML…</button>
  <input type="file" id="xmlFile" accept=".xml,.musicxml,application/xml,text/xml" style="display:none" multiple>
  <button id="addTextBtn">Add note-text…</button>
  <button id="rebuildBtn">Rebuild &amp; Push selected/new</button>
  <span id="status"></span>
</div>
<textarea id="textInput" placeholder="Paste note-text, first line = title" style="display:none;width:100%;height:6em"></textarea>
<div id="pieceList"></div>

<script type="module">
  import { getSystemFromUrl, getMusicResourceUrl, loadIndex, rebuildAndPush } from './music-index.js';

  const system = getSystemFromUrl().name;
  document.getElementById('systemLabel').textContent = system;

  // jQuery is already global in music.html (loaded via <script>); musicxml.js needs it.
  let index = [];
  const pending = [];  // newly added pieces not yet pushed: {id,title,format,source,key}

  function idFromName(name) {
    return name.replace(/\.(xml|musicxml|txt)$/i, '').trim().replace(/\s+/g, '_').replace(/[\/\\:*?"<>|]/g, '');
  }
  function setStatus(s) { document.getElementById('status').textContent = s; }

  function render() {
    const rows = [];
    index.forEach(e => rows.push(
      `<label style="display:block"><input type="checkbox" class="sel" data-id="${e.id}"> ${e.title || e.id} <small>(${e.noteCount} notes, ${e.channels.join('/')})</small></label>`));
    pending.forEach(p => rows.push(
      `<label style="display:block;color:#a06000"><input type="checkbox" class="sel" data-id="${p.id}" checked disabled> ${p.title} <small>(new — will be pushed)</small></label>`));
    document.getElementById('pieceList').innerHTML = rows.join('') || '<em>No pieces yet.</em>';
  }

  document.getElementById('addXmlBtn').onclick = () => document.getElementById('xmlFile').click();
  document.getElementById('xmlFile').onchange = async (ev) => {
    for (const file of ev.target.files) {
      const source = await file.text();
      const id = idFromName(file.name);
      pending.push({ id, title: id, format: 'musicxml', source });
    }
    render();
  };
  document.getElementById('addTextBtn').onclick = () => {
    const ta = document.getElementById('textInput'); ta.style.display = 'block'; ta.focus();
  };
  document.getElementById('textInput').onchange = (ev) => {
    const text = ev.target.value.trim(); if (!text) return;
    const title = text.split('\n')[0].slice(0, 60);
    pending.push({ id: idFromName(title), title, format: 'note-text', source: text, key: 'C' });
    ev.target.value = ''; ev.target.style.display = 'none'; render();
  };

  document.getElementById('rebuildBtn').onclick = async () => {
    const selectedIds = new Set(Array.from(document.querySelectorAll('.sel:checked')).map(c => c.dataset.id));
    const reselected = index
      .filter(e => selectedIds.has(e.id))
      .map(e => ({ id: e.id, title: e.title, format: e.format, source: null, key: e.key }));
    // For already-indexed pieces we need their source; fetch the detail file on demand.
    for (const r of reselected) {
      const detail = await fetch(`${getMusicResourceUrl(system)}/details/${r.id}.json`).then(x => x.json());
      r.source = detail.source; r.format = detail.format;
    }
    const pieces = [...pending, ...reselected];
    if (!pieces.length) { setStatus('Nothing selected.'); return; }
    setStatus('Pushing…');
    const committer = (files) => window.GitHubUtils.commitMultipleFiles({
      owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages',
      commitMessage: `music(${system}): rebuild ${pieces.map(p => p.id).join(', ')}`,
      files
    });
    try {
      const res = await rebuildAndPush({ system, pieces, currentIndex: index, committer, force: selectedIds.size > 0,
        updatedAt: new Date().toISOString().slice(0, 10) });
      index = res.index; pending.length = 0; render();
      setStatus(res.pushed ? `Pushed: ${res.changed.join(', ')}` : 'No changes.');
    } catch (e) { setStatus('Push failed: ' + e.message); }
  };

  (async () => { try { index = await loadIndex(system); } catch (_) { index = []; } render(); })();
</script>
</body>
```

- [ ] **Step 2: Add `loadIndex` to `music-index.js`**

```js
// add to public/music-index.js
export async function loadIndex(system) {
  const res = await fetch(`${getMusicResourceUrl(system)}/index.json`);
  if (!res.ok) return [];
  return res.json();
}
```

- [ ] **Step 3: Ensure `music.html` loads jQuery + github-utils before the module**

Confirm the `<head>` of [public/music.html](../../../public/music.html) includes (add any that are missing, before the module script):

```html
<script src="/vendor/jquery.js"></script>
<script src="/github-utils.js"></script>
```

- [ ] **Step 4: Manual verification in the browser**

Run: `npm run serve` then open `http://localhost:3000/music.html?system=western`
Verify:
- The page lists current pieces from `db/music/western/index.json` (empty list is fine on first run).
- "Add MusicXML…" → pick the Chopin file → it appears as a pending "new" row.
- Set a GitHub token first if needed (the existing app exposes `GitHubUtils.setGHToken` — reuse however language.html does).
- "Rebuild & Push" → status shows `Pushed: Chopin_…`; confirm the commit appears on `trexsatya/trexsatya.github.io` `gh-pages` under `db/music/western/`.

- [ ] **Step 5: Commit**

```bash
git add public/music.html public/music-index.js
git commit -m "feat(music): Manager view — add pieces + incremental Rebuild & Push"
```

---

## Self-Review

**Spec coverage:**
- §6 multi-channel schema → Tasks 3, 4 (all channels; `chordSymbol` = `<harmony>` in Task 4, else inferred in Task 5).
- §6 chord inference (pure, per-measure) → Task 5 (`inferChords`), wired into the push pipeline in Task 8.
- §7 two encoders, one schema → Tasks 3 (note-text), 4 (musicxml).
- §8 two-tier index, search fields in Tier-1, inline source → Task 6 (`buildIndexEntry`/`splitTiers`).
- §5 storage layout + `?system` routing mirroring `?lang` → Task 7.
- §9 incremental Rebuild & Push (selected/new, single commit) → Tasks 8 (logic) + 10 (UI + real committer via `commitMultipleFiles`).
- §10 id derived from name, spaces→`_` → Task 10 `idFromName`.
- §11 testing: hermetic fixtures (Tasks 1–8) + real-file integration (Task 9).
- Deferred per design: n-gram index, multi-movement split, IndexedDB cache (→M2), and sub-measure (per-beat) chord resolution. All explicitly out of scope.

**Placeholder scan:** none — every code step is complete. (Task 4 Step 3 has a flagged redundant line with an explicit instruction to delete it; not a placeholder.)

**Type consistency:** `EncodedDoc`/`Voice`/`IndexEntry`/`Detail` shapes are defined once in "Shared schema" and used identically across Tasks 3–10. Function names are consistent: `pitchClass`, `inferChords`, `primaryVoice`, `packContour`/`unpackContour`, `buildIndexEntry`, `splitTiers`, `mergeIndex`, `rebuildAndPush`, `loadIndex`, `getSystemFromUrl`, `getMusicResourceUrl`. `inferChords(doc)` returns the same `doc` (mutated, chordSymbol nulls filled) and is applied by `encodePiece` (Task 8) and the integration test (Task 9). The committer contract (`async (files:[{path,getContent}]) => any`) is identical in Task 8 (fake) and Task 10 (real `commitMultipleFiles` wrapper).
