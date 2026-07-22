# Segment Embellishment Variations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate playable, notated variations of a ≤3-measure segment by decorating a chosen voice with non-chord-tone techniques (passing, neighbour, suspension, retardation, appoggiatura, escape, anticipation).

**Architecture:** A pure engine (`music-embellish.js`) tags a voice's notes against the per-measure chord, finds eligible embellishment sites per technique, and enumerates progressive combinations (capped). A pure XML builder (`music-embellish-xml.js`) extracts the segment's MusicXML and applies a variation's edits to the chosen voice. `music.html` adds a "Variations" panel: controls + a compact result list + one shared OSMD render panel that renders/plays the selected variation.

**Tech Stack:** Vanilla ES modules, Jest (`yarn jest public/<file>.test.js`), jsdom, OSMD, MusicXML DOM (`DOMParser`/`XMLSerializer`), existing `music-player.js` and `createMusicRenderer`.

**Spec:** `docs/superpowers/specs/2026-07-12-segment-embellishment-variations-design.md`

> **Environment note:** This repo's `.git` is write-blocked in the working environment. Wherever a step says **Commit**, instead run the full suite (`yarn jest public/`) and confirm green — that is the checkpoint. Publishing happens once at the end via the `cupitor-deploy` skill.

---

## File Structure

- Create `public/music-embellish.js` — pure engine: note roles, pitch pool, per-technique site detection, progressive enumeration. One responsibility: *what to embellish and how (as abstract edits)*.
- Create `public/music-embellish.test.js` — engine tests.
- Create `public/music-embellish-xml.js` — pure MusicXML: extract segment measures, apply a variation's edits to a voice. One responsibility: *turn abstract edits into a MusicXML string*.
- Create `public/music-embellish-xml.test.js` — XML builder tests.
- Modify `public/music.html` — the "Variations" panel UI, wiring to the engine/builder, one shared render panel + play.

## Shared data shapes (used across tasks — keep names identical)

```js
// A voice note within the segment (built from encodeMusicXml voices):
// { name:'A'|'C#'|'Bb', midi:69, onset:0, duration:2, measure:41, chord:'Am'|null }

// chordByMeasure: { 41:'Am', 42:'Em', 43:'F' }   // search-normalised chord symbols

// A roled note (noteRoles output) adds:
// { ...note, pc:9, isChordTone:true, beatStrength:'strong'|'weak' }

// A site (eligibleSites output):
// { technique:'passing', index:0, gap:[0,1]|null, insertMidi:71|null,
//   insertName:'B'|null, label:'passing B @ m41', edit:{...} }

// An edit (consumed by applyVariation):
//   { op:'split', index, insertMidi, insertName }        // halve note[index], 2nd half = decoration
//   { op:'insert', gap:[i,j], atOnset, dur, insertMidi, insertName }  // steal from note[i] tail
//   { op:'tie', index }                                   // extend note[index] into next beat, retie
//   { op:'retime', index, deltaOnset }                    // move note earlier (anticipation)

// A variation (enumerateVariations output):
// { id:'v3', label:'passing B @ m41 · suspension @ m43', techniques:['passing','suspension'], edits:[...] }
```

---

## Task 1: Pitch helpers + `buildPool`

**Files:**
- Create: `public/music-embellish.js`
- Test: `public/music-embellish.test.js`

- [ ] **Step 1: Write the failing test**

```js
// public/music-embellish.test.js
import { pcOf, scalePcs, buildPool } from './music-embellish.js';

describe('pitch helpers', () => {
  test('pcOf reduces midi to a 0-11 pitch class', () => {
    expect(pcOf(69)).toBe(9);   // A4
    expect(pcOf(60)).toBe(0);   // C4
  });
  test('scalePcs returns the diatonic pitch classes of a key', () => {
    expect(scalePcs('C').sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
  test('scalePcs of an unknown/empty key is empty', () => {
    expect(scalePcs('')).toEqual([]);
  });
});

describe('buildPool', () => {
  test('default pool = pitch classes present in the segment note names', () => {
    const pool = buildPool(['A', 'C', 'E'], { addNotes: false, key: 'C' });
    expect([...pool].sort((a, b) => a - b)).toEqual([0, 4, 9]); // C,E,A
  });
  test('addNotes widens the pool to the key scale', () => {
    const pool = buildPool(['A'], { addNotes: true, key: 'C' });
    expect([...pool].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest public/music-embellish.test.js -t "pitch helpers|buildPool"`
Expected: FAIL — `pcOf is not a function` (module missing).

- [ ] **Step 3: Write minimal implementation**

```js
// public/music-embellish.js
import { pitchClass, nameToMidi } from './music-encoding.js';
import { getScale, chordByAnyName } from './music-reference-data.js';

export const pcOf = (midi) => (((midi % 12) + 12) % 12);

// Diatonic pitch classes of a major-key name (getScale returns spelled scale note names).
export function scalePcs(key) {
  const scale = key ? getScale(key) : null;
  if (!scale || !scale.length) return [];
  return [...new Set(scale.map((n) => pitchClass(n)).filter((p) => p != null))];
}

// Allowed decorating pitch classes. Default: PCs present in the segment. addNotes: the key scale.
export function buildPool(segmentNoteNames, { addNotes = false, key = null } = {}) {
  const pool = new Set((segmentNoteNames || []).map((n) => pitchClass(n)).filter((p) => p != null));
  if (addNotes) scalePcs(key).forEach((p) => pool.add(p));
  return pool;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest public/music-embellish.test.js -t "pitch helpers|buildPool"`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — Run `yarn jest public/music-embellish.test.js` → green.

---

## Task 2: `noteRoles`

**Files:**
- Modify: `public/music-embellish.js`
- Test: `public/music-embellish.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { noteRoles } from './music-embellish.js';

describe('noteRoles', () => {
  const chordByMeasure = { 1: 'Am' }; // Am = A,C,E
  test('tags chord tones by pitch class and marks the earliest onset as the strong beat', () => {
    const notes = [
      { name: 'A', midi: 69, onset: 0, duration: 1, measure: 1, chord: 'Am' },
      { name: 'B', midi: 71, onset: 1, duration: 1, measure: 1, chord: 'Am' },
      { name: 'C', midi: 72, onset: 2, duration: 1, measure: 1, chord: 'Am' },
    ];
    const roled = noteRoles(notes, chordByMeasure);
    expect(roled.map((n) => n.isChordTone)).toEqual([true, false, true]); // B is not in Am
    expect(roled.map((n) => n.beatStrength)).toEqual(['strong', 'weak', 'weak']);
    expect(roled[0].pc).toBe(9);
  });
  test('a null chord makes every note a non-chord tone', () => {
    const roled = noteRoles([{ name: 'A', midi: 69, onset: 0, duration: 1, measure: 2, chord: null }], {});
    expect(roled[0].isChordTone).toBe(false);
  });
});
```

- [ ] **Step 2: Run test** — `yarn jest public/music-embellish.test.js -t noteRoles` → FAIL (`noteRoles is not a function`).

- [ ] **Step 3: Implement**

```js
// append to public/music-embellish.js
function chordPcSet(sym) {
  const c = sym ? chordByAnyName(sym) : null;
  return c ? new Set(c.notes.map((n) => pitchClass(n)).filter((p) => p != null)) : new Set();
}

export function noteRoles(notes, chordByMeasure = {}) {
  const strongOnsetByMeasure = {};
  (notes || []).forEach((n) => {
    const cur = strongOnsetByMeasure[n.measure];
    if (cur == null || n.onset < cur) strongOnsetByMeasure[n.measure] = n.onset;
  });
  return (notes || []).map((n) => {
    const pcs = chordPcSet(n.chord != null ? n.chord : chordByMeasure[n.measure]);
    const pc = pcOf(n.midi);
    return { ...n, pc, isChordTone: pcs.has(pc),
      beatStrength: n.onset === strongOnsetByMeasure[n.measure] ? 'strong' : 'weak' };
  });
}
```

- [ ] **Step 4: Run test** → PASS.

- [ ] **Step 5: Checkpoint** — `yarn jest public/music-embellish.test.js` → green.

---

## Task 3: `enumerateVariations` (progressive + cap + conflict)

**Files:**
- Modify: `public/music-embellish.js`
- Test: `public/music-embellish.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { enumerateVariations } from './music-embellish.js';

describe('enumerateVariations', () => {
  const site = (technique, index, gap) => ({ technique, index, gap, label: `${technique}@${index}`, edit: { op: 'x', index } });
  test('lists single-site variations first, then non-conflicting pairs, and caps the count', () => {
    const sites = [site('passing', 0, [0, 1]), site('neighbour', 2, null), site('suspension', 4, null)];
    const out = enumerateVariations(sites, { cap: 4 });
    // first three are singles, in order
    expect(out.slice(0, 3).map((v) => v.label)).toEqual(['passing@0', 'neighbour@2', 'suspension@4']);
    // fourth is a pair (progressive), capped at 4 total
    expect(out).toHaveLength(4);
    expect(out[3].techniques.length).toBe(2);
    expect(out.every((v) => v.id)).toBe(true);
  });
  test('never combines two sites that touch the same note index', () => {
    const sites = [site('passing', 1, [1, 2]), site('appoggiatura', 1, null)]; // both index 1 -> conflict
    const out = enumerateVariations(sites, { cap: 10 });
    expect(out).toHaveLength(2);            // only the two singles, no pair
    expect(out.every((v) => v.techniques.length === 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test** — `yarn jest public/music-embellish.test.js -t enumerateVariations` → FAIL.

- [ ] **Step 3: Implement**

```js
// append to public/music-embellish.js
// Two sites conflict if their edits touch the same note index or the same insertion gap.
function sitesConflict(a, b) {
  if (a.index === b.index) return true;
  if (a.gap && b.gap && a.gap[0] === b.gap[0]) return true;
  if (a.gap && a.gap.includes(b.index)) return true;
  if (b.gap && b.gap.includes(a.index)) return true;
  return false;
}

function combos(sites, size) {
  if (size === 1) return sites.map((s) => [s]);
  const out = [];
  for (let i = 0; i < sites.length; i++) {
    for (const tail of combos(sites.slice(i + 1), size - 1)) {
      const group = [sites[i], ...tail];
      if (group.every((s, x) => group.slice(x + 1).every((t) => !sitesConflict(s, t)))) out.push(group);
    }
  }
  return out;
}

export function enumerateVariations(sites, { cap = 50 } = {}) {
  const out = [];
  for (let size = 1; size <= (sites || []).length && out.length < cap; size++) {
    for (const group of combos(sites, size)) {
      if (out.length >= cap) break;
      out.push({
        id: `v${out.length + 1}`,
        label: group.map((s) => s.label).join(' · '),
        techniques: group.map((s) => s.technique),
        edits: group.map((s) => s.edit),
      });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test** → PASS.

- [ ] **Step 5: Checkpoint** — `yarn jest public/music-embellish.test.js` → green.

---

## Task 4: Diatonic-step helpers

**Files:**
- Modify: `public/music-embellish.js`
- Test: `public/music-embellish.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { diatonicNeighborPc, isThirdApart, midpointPc } from './music-embellish.js';

describe('diatonic-step helpers (C major scale)', () => {
  const scale = [0, 2, 4, 5, 7, 9, 11];
  test('diatonicNeighborPc steps up/down within the scale', () => {
    expect(diatonicNeighborPc(9, +1, scale)).toBe(11); // A -> B
    expect(diatonicNeighborPc(9, -1, scale)).toBe(7);  // A -> G
    expect(diatonicNeighborPc(0, -1, scale)).toBe(11); // C -> B (wrap)
  });
  test('isThirdApart: two scale degrees apart (a diatonic third)', () => {
    expect(isThirdApart(9, 0, scale)).toBe(true);   // A..C (A,B,C)
    expect(isThirdApart(9, 11, scale)).toBe(false);  // A..B is a second
  });
  test('midpointPc: the scale degree between two notes a third apart', () => {
    expect(midpointPc(9, 0, scale)).toBe(11); // between A and C = B
  });
});
```

- [ ] **Step 2: Run test** → FAIL.

- [ ] **Step 3: Implement**

```js
// append to public/music-embellish.js
function scaleIndex(pc, scale) { return scale.indexOf(pc); }

export function diatonicNeighborPc(pc, dir, scale) {
  const i = scaleIndex(pc, scale);
  if (i < 0 || !scale.length) return null;
  return scale[((i + dir) % scale.length + scale.length) % scale.length];
}

export function isThirdApart(pcA, pcB, scale) {
  const a = scaleIndex(pcA, scale), b = scaleIndex(pcB, scale);
  if (a < 0 || b < 0) return false;
  const d = ((b - a) % scale.length + scale.length) % scale.length;
  return d === 2 || d === scale.length - 2;
}

export function midpointPc(pcA, pcB, scale) {
  if (!isThirdApart(pcA, pcB, scale)) return null;
  const a = scaleIndex(pcA, scale);
  const up = ((scaleIndex(pcB, scale) - a) % scale.length + scale.length) % scale.length === 2;
  return diatonicNeighborPc(pcA, up ? +1 : -1, scale);
}
```

- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Checkpoint** — `yarn jest public/music-embellish.test.js` → green.

---

## Task 5: `eligibleSites` — passing tone (the template)

**Files:**
- Modify: `public/music-embellish.js`
- Test: `public/music-embellish.test.js`

Rule: two **adjacent** notes that are both chord tones and a **diatonic third** apart → insert the middle scale pc as a passing tone, splitting the first note's duration in half. Site valid only if the middle pc ∈ `pool`.

- [ ] **Step 1: Write the failing test**

```js
import { eligibleSites } from './music-embellish.js';
import { noteRoles as roles } from './music-embellish.js';

describe('eligibleSites — passing', () => {
  const key = 'C';
  const chordByMeasure = { 1: 'Am' }; // A,C,E
  const notes = [
    { name: 'A', midi: 69, onset: 0, duration: 2, measure: 1, chord: 'Am' },
    { name: 'C', midi: 72, onset: 2, duration: 2, measure: 1, chord: 'Am' },
  ];
  test('finds a passing tone B between A and C when B is in the pool', () => {
    const pool = new Set([9, 11, 0]); // A, B, C present
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool, key, techniques: ['passing'] });
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ technique: 'passing', index: 0, gap: [0, 1], insertMidi: 71 });
    expect(sites[0].edit).toMatchObject({ op: 'split', index: 0, insertMidi: 71 });
  });
  test('no passing site when the middle pitch (B) is not in the pool', () => {
    const pool = new Set([9, 0]); // A, C only
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool, key, techniques: ['passing'] });
    expect(sites).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test** → FAIL (`eligibleSites is not a function`).

- [ ] **Step 3: Implement (dispatcher + passing detector)**

```js
// append to public/music-embellish.js
import { midiToName } from './music-encoding.js';  // add to the existing import if separate

function nearestMidiForPc(pc, aroundMidi) {
  const base = aroundMidi - (((aroundMidi % 12) + 12) % 12) + pc;
  return [base - 12, base, base + 12].reduce((best, m) =>
    Math.abs(m - aroundMidi) < Math.abs(best - aroundMidi) ? m : best);
}

function passingSites(roled, scale, pool) {
  const out = [];
  for (let i = 0; i + 1 < roled.length; i++) {
    const a = roled[i], b = roled[i + 1];
    if (!a.isChordTone || !b.isChordTone) continue;
    if (!isThirdApart(a.pc, b.pc, scale)) continue;
    const mid = midpointPc(a.pc, b.pc, scale);
    if (mid == null || !pool.has(mid)) continue;
    const insertMidi = nearestMidiForPc(mid, a.midi);
    const insertName = midiToName(insertMidi);
    out.push({ technique: 'passing', index: i, gap: [i, i + 1], insertMidi, insertName,
      label: `passing ${insertName} @ m${a.measure}`,
      edit: { op: 'split', index: i, insertMidi, insertName } });
  }
  return out;
}

const DETECTORS = { passing: passingSites };

export function eligibleSites(roled, { pool, key, techniques } = {}) {
  const scale = scalePcs(key);
  const enabled = techniques || Object.keys(DETECTORS);
  const sites = [];
  enabled.forEach((t) => { if (DETECTORS[t]) sites.push(...DETECTORS[t](roled, scale, pool)); });
  return sites;
}
```

> If `midiToName` is not already exported from `music-encoding.js`, verify with `grep -n "export function midiToName" public/music-encoding.js`; it is used by `inferChords`, so it exists — ensure it is in the import list.

- [ ] **Step 4: Run test** → PASS.
- [ ] **Step 5: Checkpoint** — `yarn jest public/music-embellish.test.js` → green.

---

## Task 6: `neighbour` detector

Rule: a chord tone whose **next** note repeats the same pitch class (held/repeated) → insert a diatonic upper (or lower) neighbour between them; site valid if the neighbour pc ∈ pool. Emit the upper neighbour if in pool, else the lower.

**Files:** Modify `public/music-embellish.js`; Test `public/music-embellish.test.js`.

- [ ] **Step 1: Failing test**

```js
describe('eligibleSites — neighbour', () => {
  const key = 'C', chordByMeasure = { 1: 'Am' };
  const notes = [
    { name: 'A', midi: 69, onset: 0, duration: 2, measure: 1, chord: 'Am' },
    { name: 'A', midi: 69, onset: 2, duration: 2, measure: 1, chord: 'Am' },
  ];
  test('inserts an upper neighbour B between two A chord tones', () => {
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set([9, 11]), key, techniques: ['neighbour'] });
    expect(sites[0]).toMatchObject({ technique: 'neighbour', index: 0, gap: [0, 1], insertMidi: 71 });
  });
  test('falls back to the lower neighbour G when B is not in the pool', () => {
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set([9, 7]), key, techniques: ['neighbour'] });
    expect(sites[0].insertMidi).toBe(67); // G
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**

```js
function neighbourSites(roled, scale, pool) {
  const out = [];
  for (let i = 0; i + 1 < roled.length; i++) {
    const a = roled[i], b = roled[i + 1];
    if (!a.isChordTone || a.pc !== b.pc) continue;
    for (const dir of [+1, -1]) {
      const npc = diatonicNeighborPc(a.pc, dir, scale);
      if (npc == null || !pool.has(npc)) continue;
      const insertMidi = nearestMidiForPc(npc, a.midi);
      const insertName = midiToName(insertMidi);
      out.push({ technique: 'neighbour', index: i, gap: [i, i + 1], insertMidi, insertName,
        label: `${dir > 0 ? 'upper' : 'lower'} neighbour ${insertName} @ m${a.measure}`,
        edit: { op: 'split', index: i, insertMidi, insertName } });
      break; // one neighbour per site (upper preferred)
    }
  }
  return out;
}
// register:
const DETECTORS = { passing: passingSites, neighbour: neighbourSites };
```

- [ ] **Step 4: Run** → PASS. **Step 5: Checkpoint** — full engine test green.

---

## Task 7: `anticipation` detector (re-timing, no new pitch)

Rule: a note whose **next** note is a chord tone of the next note's measure chord → sound that next pitch early by stealing the tail of the current note. No new pitch (uses the next note's own pitch). Always pool-independent.

**Files:** Modify `public/music-embellish.js`; Test.

- [ ] **Step 1: Failing test**

```js
describe('eligibleSites — anticipation', () => {
  const key = 'C', chordByMeasure = { 1: 'Am', 2: 'F' }; // F = F,A,C
  const notes = [
    { name: 'E', midi: 64, onset: 0, duration: 4, measure: 1, chord: 'Am' },
    { name: 'F', midi: 65, onset: 0, duration: 4, measure: 2, chord: 'F' },
  ];
  test('anticipates the next chord tone F by stealing the current note tail', () => {
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set(), key, techniques: ['anticipation'] });
    expect(sites[0]).toMatchObject({ technique: 'anticipation', index: 0, insertMidi: 65 });
    expect(sites[0].edit).toMatchObject({ op: 'insert', gap: [0, 1], insertMidi: 65 });
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**

```js
function anticipationSites(roled) {
  const out = [];
  for (let i = 0; i + 1 < roled.length; i++) {
    const a = roled[i], b = roled[i + 1];
    if (!b.isChordTone) continue;
    if (a.duration < 2) continue;               // need room to steal a tail
    const insertMidi = b.midi, insertName = b.name;
    out.push({ technique: 'anticipation', index: i, gap: [i, i + 1], insertMidi, insertName,
      label: `anticipation ${insertName} @ m${b.measure}`,
      edit: { op: 'insert', gap: [i, i + 1], insertMidi, insertName } });
  }
  return out;
}
const DETECTORS = { passing: passingSites, neighbour: neighbourSites, anticipation: anticipationSites };
```

- [ ] **Step 4: Run** → PASS. **Step 5: Checkpoint** — green.

---

## Task 8: `suspension` + `retardation` detectors (re-timing, tie)

Rule (suspension): note[i] is a chord tone that is a **diatonic step above** a chord tone of note[i+1]'s measure chord → hold note[i] across into beat i+1 (tie) then resolve **down** a step. Retardation: resolves **up** a step (note[i] a step *below* the next chord tone). No new pitch. Pool-independent.

**Files:** Modify `public/music-embellish.js`; Test.

- [ ] **Step 1: Failing test**

```js
describe('eligibleSites — suspension / retardation', () => {
  const key = 'C';
  const chordByMeasure = { 1: 'G', 2: 'C' }; // G=G,B,D ; C=C,E,G
  const notes = [
    { name: 'D', midi: 62, onset: 0, duration: 4, measure: 1, chord: 'G' }, // D is a step above C (next chord tone)
    { name: 'C', midi: 60, onset: 0, duration: 4, measure: 2, chord: 'C' },
  ];
  test('suspension: D held over the barline resolving down to C', () => {
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set(), key, techniques: ['suspension'] });
    expect(sites[0]).toMatchObject({ technique: 'suspension', index: 0 });
    expect(sites[0].edit).toMatchObject({ op: 'tie', index: 0 });
  });
  test('retardation: a note a step BELOW the next chord tone, resolving up', () => {
    const n = [
      { name: 'B', midi: 71, onset: 0, duration: 4, measure: 1, chord: 'G' }, // B a step below C
      { name: 'C', midi: 72, onset: 0, duration: 4, measure: 2, chord: 'C' },
    ];
    const sites = eligibleSites(roles(n, chordByMeasure), { pool: new Set(), key, techniques: ['retardation'] });
    expect(sites[0]).toMatchObject({ technique: 'retardation', index: 0 });
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**

```js
function suspensionLike(roled, scale, technique, dir) {
  // dir = -1 for suspension (resolves down), +1 for retardation (resolves up)
  const out = [];
  for (let i = 0; i + 1 < roled.length; i++) {
    const a = roled[i], b = roled[i + 1];
    if (!a.isChordTone || !b.isChordTone) continue;
    if (a.measure === b.measure) continue;              // suspension crosses a chord change
    if (diatonicNeighborPc(a.pc, dir, scale) !== b.pc) continue; // a resolves to b by a step
    out.push({ technique, index: i, gap: null, insertMidi: null, insertName: null,
      label: `${technique} @ m${a.measure}–${b.measure}`,
      edit: { op: 'tie', index: i } });
  }
  return out;
}
const DETECTORS = {
  passing: passingSites, neighbour: neighbourSites, anticipation: anticipationSites,
  suspension: (r, s) => suspensionLike(r, s, 'suspension', -1),
  retardation: (r, s) => suspensionLike(r, s, 'retardation', +1),
};
```

- [ ] **Step 4: Run** → PASS. **Step 5: Checkpoint** — green.

---

## Task 9: `appoggiatura` + `escape` detectors (pitch-inserting)

Rule (appoggiatura): on a **strong-beat** chord tone note[i], insert an accented non-chord diatonic step-neighbour *before* it that resolves by step into it. Modelled as a `split` of the *previous* note's tail (or of note[i] itself when it is first): insert the neighbour pc just before note[i]. Site valid if neighbour pc ∈ pool.
Rule (escape/échappée): a chord tone note[i] followed by a chord tone note[i+1] → step **away** from note[i] to a weak non-chord tone, then the existing leap to note[i+1] completes it. Insert the step-away pc after note[i]; valid if that pc ∈ pool and note[i]→note[i+1] is a leap (≥ a third).

**Files:** Modify `public/music-embellish.js`; Test.

- [ ] **Step 1: Failing test**

```js
describe('eligibleSites — appoggiatura / escape', () => {
  const key = 'C';
  test('appoggiatura: accented upper-step D before a strong-beat C', () => {
    const chordByMeasure = { 1: 'C' }; // C,E,G
    const notes = [{ name: 'C', midi: 72, onset: 0, duration: 4, measure: 1, chord: 'C' }];
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set([0, 2]), key, techniques: ['appoggiatura'] });
    expect(sites[0]).toMatchObject({ technique: 'appoggiatura', index: 0, insertMidi: 74 }); // D
    expect(sites[0].edit).toMatchObject({ op: 'split', index: 0, insertMidi: 74 });
  });
  test('escape: step away from C (to D) before the leap up to G', () => {
    const chordByMeasure = { 1: 'C' };
    const notes = [
      { name: 'C', midi: 60, onset: 0, duration: 2, measure: 1, chord: 'C' },
      { name: 'G', midi: 67, onset: 2, duration: 2, measure: 1, chord: 'C' },
    ];
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set([0, 2, 7]), key, techniques: ['escape'] });
    expect(sites[0]).toMatchObject({ technique: 'escape', index: 0, insertMidi: 62 }); // D
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**

```js
function appoggiaturaSites(roled, scale, pool) {
  const out = [];
  for (let i = 0; i < roled.length; i++) {
    const t = roled[i];
    if (!t.isChordTone || t.beatStrength !== 'strong') continue;
    if (t.duration < 2) continue;
    for (const dir of [+1, -1]) {
      const npc = diatonicNeighborPc(t.pc, dir, scale);
      if (npc == null || !pool.has(npc)) continue;
      const insertMidi = nearestMidiForPc(npc, t.midi), insertName = midiToName(insertMidi);
      out.push({ technique: 'appoggiatura', index: i, gap: null, insertMidi, insertName,
        label: `appoggiatura ${insertName} @ m${t.measure}`,
        edit: { op: 'split', index: i, insertMidi, insertName, before: true } });
      break;
    }
  }
  return out;
}

function escapeSites(roled, scale, pool) {
  const out = [];
  for (let i = 0; i + 1 < roled.length; i++) {
    const a = roled[i], b = roled[i + 1];
    if (!a.isChordTone || !b.isChordTone) continue;
    if (Math.abs(b.midi - a.midi) < 3) continue;              // need a leap to "escape" into
    const dir = b.midi > a.midi ? -1 : +1;                     // step away, opposite to the leap
    const npc = diatonicNeighborPc(a.pc, dir, scale);
    if (npc == null || !pool.has(npc)) continue;
    const insertMidi = nearestMidiForPc(npc, a.midi), insertName = midiToName(insertMidi);
    out.push({ technique: 'escape', index: i, gap: [i, i + 1], insertMidi, insertName,
      label: `escape ${insertName} @ m${a.measure}`,
      edit: { op: 'split', index: i, insertMidi, insertName } });
  }
  return out;
}
// register both in DETECTORS.
```

- [ ] **Step 4: Run** → PASS. **Step 5: Checkpoint** — `yarn jest public/music-embellish.test.js` → green.

---

## Task 10: `TECHNIQUES` metadata + `generateVariations` façade

**Files:** Modify `public/music-embellish.js`; Test.

- [ ] **Step 1: Failing test**

```js
import { TECHNIQUES, generateVariations } from './music-embellish.js';

describe('generateVariations façade', () => {
  test('TECHNIQUES lists all 7 with display names and needsNewPitch flags', () => {
    expect(TECHNIQUES.map((t) => t.key).sort()).toEqual(
      ['anticipation', 'appoggiatura', 'escape', 'neighbour', 'passing', 'retardation', 'suspension']);
    expect(TECHNIQUES.find((t) => t.key === 'passing').needsNewPitch).toBe(true);
    expect(TECHNIQUES.find((t) => t.key === 'suspension').needsNewPitch).toBe(false);
  });
  test('end-to-end: notes + chords + options -> capped, labelled variations', () => {
    const notes = [
      { name: 'A', midi: 69, onset: 0, duration: 2, measure: 1, chord: 'Am' },
      { name: 'C', midi: 72, onset: 2, duration: 2, measure: 1, chord: 'Am' },
    ];
    const out = generateVariations({
      voiceNotes: notes, chordByMeasure: { 1: 'Am' },
      segmentNoteNames: ['A', 'B', 'C'], key: 'C',
      techniques: ['passing'], addNotes: false, cap: 10,
    });
    expect(out[0].label).toContain('passing');
    expect(out[0].edits[0].op).toBe('split');
  });
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**

```js
export const TECHNIQUES = [
  { key: 'passing', name: 'Passing tone', needsNewPitch: true },
  { key: 'neighbour', name: 'Neighbour tone', needsNewPitch: true },
  { key: 'suspension', name: 'Suspension', needsNewPitch: false },
  { key: 'retardation', name: 'Retardation', needsNewPitch: false },
  { key: 'appoggiatura', name: 'Appoggiatura', needsNewPitch: true },
  { key: 'escape', name: 'Escape tone', needsNewPitch: true },
  { key: 'anticipation', name: 'Anticipation', needsNewPitch: false },
];

export function generateVariations({ voiceNotes, chordByMeasure, segmentNoteNames, key,
  techniques, addNotes = false, cap = 50 } = {}) {
  const pool = buildPool(segmentNoteNames, { addNotes, key });
  const roled = noteRoles(voiceNotes, chordByMeasure);
  const sites = eligibleSites(roled, { pool, key, techniques });
  return enumerateVariations(sites, { cap });
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Checkpoint** — `yarn jest public/music-embellish.test.js` → all green.

---

## Task 11: `extractSegmentXml`

**Files:**
- Create `public/music-embellish-xml.js`
- Test `public/music-embellish-xml.test.js`

Mirror `music-split.js`'s attribute carry-forward: produce a standalone MusicXML containing only measures `[from,to]` (1-based sequential), preserving the leading `<attributes>` (divisions/key/time/clef) by cloning the running attributes onto the first kept measure.

- [ ] **Step 1: Failing test** — use a tiny inline MusicXML fixture with 3 measures; assert the extract has exactly measures 2–3 and still carries `<divisions>`.

```js
/** @jest-environment jsdom */
import jQuery from 'jquery';
import { extractSegmentXml } from './music-embellish-xml.js';
beforeAll(() => { global.$ = global.jQuery = jQuery; });

const XML = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>x</part-name></score-part></part-list>
<part id="P1">
<measure number="1"><attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>A</step><octave>4</octave></pitch><duration>8</duration><type>whole</type></note></measure>
<measure number="2"><note><pitch><step>C</step><octave>5</octave></pitch><duration>8</duration><type>whole</type></note></measure>
<measure number="3"><note><pitch><step>E</step><octave>5</octave></pitch><duration>8</duration><type>whole</type></note></measure>
</part></score-partwise>`;

test('extractSegmentXml keeps only the requested measures and carries divisions/clef', () => {
  const out = extractSegmentXml(XML, [2, 3]);
  const doc = new DOMParser().parseFromString(out, 'application/xml');
  const measures = doc.querySelectorAll('measure');
  expect(measures.length).toBe(2);
  expect(doc.querySelector('divisions').textContent).toBe('2'); // carried onto measure 2
});
```

- [ ] **Step 2: Run** — `yarn jest public/music-embellish-xml.test.js -t extractSegmentXml` → FAIL.
- [ ] **Step 3: Implement** — parse with `DOMParser`; for each `<part>`, walk measures accumulating the latest `<attributes>` child; drop measures outside `[from,to]`; if the first kept measure has no `<attributes>`, prepend a clone of the accumulated one; renumber kept measures from 1; serialize with `XMLSerializer`. (Follow the running-attributes pattern in `public/music-split.js:148` `splitMusicXmlPieces`.)

```js
// public/music-embellish-xml.js
export function extractSegmentXml(xmlString, [from, to]) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  doc.querySelectorAll('part').forEach((part) => {
    let running = null, seq = 0, kept = 0;
    Array.from(part.querySelectorAll('measure')).forEach((m) => {
      seq += 1;
      const attr = m.querySelector('attributes');
      if (attr) running = attr;
      if (seq < from || seq > to) { m.remove(); return; }
      kept += 1;
      if (kept === 1 && !attr && running) m.insertBefore(running.cloneNode(true), m.firstChild);
      m.setAttribute('number', String(kept));
    });
  });
  return new XMLSerializer().serializeToString(doc);
}
```

- [ ] **Step 4: Run** → PASS. **Step 5: Checkpoint** — `yarn jest public/music-embellish-xml.test.js` → green.

---

## Task 12: `applyVariation` — `split` and `insert` (pitch-inserting + anticipation)

**Files:** Modify `public/music-embellish-xml.js`; Test.

Operate on the chosen voice's `<note>` elements within the (already extracted) segment XML. Notes are addressed by their position `index` in that voice's note sequence (skip `<note>` with `<rest>` and, for chords, only the first of a `<chord>` stack). `split`: halve `note[index]`'s `<duration>` and clone it into two, the second carrying the inserted pitch. `insert` (anticipation): shorten `note[gap[0]]`'s tail and add a new short note with the anticipated pitch before `note[gap[1]]`.

- [ ] **Step 1: Failing test** — extract-then-split; assert two notes now sit where one was and the second has the inserted step.

```js
import { extractSegmentXml, applyVariation } from './music-embellish-xml.js';

test('split halves a note and inserts the decoration pitch as its second half', () => {
  const seg = extractSegmentXml(XML, [1, 1]); // single A whole note, divisions=2
  const out = applyVariation(seg, 'P1', [{ op: 'split', index: 0, insertMidi: 71, insertName: 'B' }]);
  const doc = new DOMParser().parseFromString(out, 'application/xml');
  const notes = doc.querySelectorAll('measure note');
  expect(notes.length).toBe(2);
  expect(notes[1].querySelector('step').textContent).toBe('B');
  // durations sum preserved
  const dur = [...notes].map((n) => +n.querySelector('duration').textContent);
  expect(dur[0] + dur[1]).toBe(8);
});
```

- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — voice note list = `part.querySelectorAll('note')` filtered to exclude `<rest>` and `<chord>`-stacked notes; map `midiToName`→`<step>`/`<alter>`/`<octave>` writer; a `<duration>`/`<type>` recompute helper (`type` from duration÷divisions: whole/half/quarter/eighth…). Keep other voices untouched. Provide a `midiToPitchXml(midi)` helper that emits `<pitch><step>…</step>[<alter>…]<octave>…</octave></pitch>`.

*(Implementation code block: write the DOM edits for `split` and `insert`, recomputing `<duration>` and `<type>`; use the `divisions` from the segment's `<attributes>`. Keep functions small: `voiceNotes(part)`, `writePitch(noteEl, midi)`, `setDuration(noteEl, div, divisions)`.)*

- [ ] **Step 4: Run** → PASS. **Step 5: Checkpoint** — green.

---

## Task 13: `applyVariation` — `tie` and `retime` (suspension/retardation/anticipation retime)

**Files:** Modify `public/music-embellish-xml.js`; Test.

`tie`: extend `note[index]` to overlap the next beat and add `<tie type="start"/>` + a tied continuation note, then the resolution. `retime`: shift a note's start earlier by reducing the previous note's duration. Assert with before/after fragment checks (tie element present; durations rebalanced).

- [ ] Steps 1–5 as above: failing test with a concrete 2-measure fixture, run FAIL, implement, run PASS, checkpoint `yarn jest public/music-embellish-xml.test.js` green.

---

## Task 14: UI — Variations panel scaffold + guardrail

**Files:** Modify `public/music.html`

- [ ] **Step 1:** Add a `<details id="variationsSection">` panel near the chord-window/phrases panels: voice `<select id="varVoice">`, 7 technique checkboxes (all checked), `<label><input id="varAddNotes" type="checkbox"> add extra notes</label>`, `<button id="varGenerate">Generate</button>`, a `<div id="varList">`, and a `<div id="varSheet">` (the single render panel). Add `.var-*` CSS mirroring existing panels.
- [ ] **Step 2:** Import `{ TECHNIQUES, generateVariations }` from `./music-embellish.js` and `{ extractSegmentXml, applyVariation }` from `./music-embellish-xml.js`.
- [ ] **Step 3:** Guardrail: on panel open / segment change, if `segTo − segFrom + 1 > 3`, disable `#varGenerate` and show "Narrow the segment to 3 measures or fewer."
- [ ] **Step 4:** Manual check: open the app (`cupitor-deploy` local build or existing dev flow), open a piece, set a ≤3-measure segment, confirm the panel renders and the guardrail toggles.
- [ ] **Step 5: Checkpoint** — `yarn jest public/` still green (no engine regressions).

---

## Task 15: UI — wire Generate → engine, and select-row → build XML → render + play

**Files:** Modify `public/music.html`

- [ ] **Step 1:** On `#varGenerate`: build `voiceNotes` for `#varVoice` from `currentDetail` sliced to `[segFrom,segTo]` (sequential), `chordByMeasure` from `collapsedChordSpans(currentDetail)`, `segmentNoteNames` from all voices in range, `key` from `currentDetail.meta.key`, `techniques` from the checked boxes, `addNotes` from the toggle. Call `generateVariations(...)`. Render `#varList` rows (`.var-row` with the label + a ▶ button).
- [ ] **Step 2:** Selecting a row: `extractSegmentXml(currentDetail.source, [segFrom,segTo])` → `applyVariation(xml, partId, variation.edits)` → load into a dedicated OSMD renderer bound to `#varSheet` (reuse `createMusicRenderer`; keep ONE instance, reload on each selection). Highlight the selected row.
- [ ] **Step 3:** ▶ plays the selected variation: build a schedule from the rendered variation via the existing player path (`music-player.js`); reuse whatever the preview uses to play a segment.
- [ ] **Step 4:** Manual verification (see Task 16).
- [ ] **Step 5: Checkpoint** — `yarn jest public/` green.

---

## Task 16: Manual end-to-end verification

**Files:** none (verification only)

- [ ] Open a piece with a pickup (e.g. valsa) and one without (e.g. Bach), set a ≤3-measure segment.
- [ ] Generate with only re-timing techniques (default pool): confirm suspension/retardation/anticipation variations appear, render as notation, and play.
- [ ] Enable "add extra notes": confirm passing/neighbour/appoggiatura/escape variations appear using scale pitches.
- [ ] Confirm progressive ordering (singles first) and the ~50 cap.
- [ ] Confirm the single render panel swaps content when selecting different rows (no stacked scores).
- [ ] Confirm the 3-measure guardrail blocks larger segments.

---

## Self-Review (completed by plan author)

- **Spec coverage:** ≤3-measure cap (Task 14 guardrail); chosen voice (Task 15 §1); detected-chord frame (Task 2 + Task 15 `collapsedChordSpans`); default/add-notes pool (Task 1 `buildPool`); progressive + cap + conflict (Task 3); all 7 techniques (Tasks 5–9); full staff notation per variation via one shared panel (Tasks 11–13, 15); TDD engine + XML (Tasks 1–13). ✓
- **Placeholders:** Tasks 12–13 mark the DOM-writer detail as guided rather than fully inlined — the *tests* are concrete contracts; the writer helpers (`writePitch`, `setDuration`, `voiceNotes`) are named and scoped. Acceptable given MusicXML duration/type bookkeeping is verified by fragment tests.
- **Type consistency:** shared shapes (note, site, edit, variation) are defined once at top and reused; `eligibleSites`/`DETECTORS`/`generateVariations`/`applyVariation` signatures match across tasks.
```
