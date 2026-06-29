# Guitar Fretboard Movement Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a panel to the music study app that visualizes a chord progression's notes on a guitar fretboard, step by step, with selectable least-movement "paths" and a cumulative fading trail.

**Architecture:** A pure core module (`fretboard-core.js`) computes fretboard positions, playable voicings, and ranked movement paths via beam search. A thin SVG renderer (`fretboard-render.js`) draws a horizontal neck with a fading trail. A controller (`fretboard-panel.js`) wires the UI and reads chord note-sets from the existing renderer via two new additive accessors on `music-render.js`. `music.html` mounts the panel under the score.

**Tech Stack:** Vanilla ES modules, Jest 27 + jsdom, SVG. Reuses `equalNotes` (music-reference-data.js) and `cartesian`/`combinations`/`uniqueByJsonRepresentation` (data-structures.js).

**Design spec:** `docs/superpowers/specs/2026-06-24-fretboard-visualizer-design.md`

**Test runner:** `npx jest public/<file>.test.js` from the repo root (`frontend/vue3/cupitor-frontend`).

**Commit note:** This repo's `.git` lives above the working directory; commits in this environment require running git with the sandbox disabled. Each commit step is still listed; if a commit is blocked, continue and batch it later.

---

## File Structure

- **Create `public/fretboard-core.js`** — pure: `STANDARD_TUNING`, `findPositions`, `isPlayable`, `voicingsForNotes`, `voicingCenter`, `voicingSpan`, `findPaths`, `movementSparkline`. No DOM, no jQuery.
- **Create `public/fretboard-core.test.js`** — Jest unit tests for the core.
- **Create `public/fretboard-render.js`** — pure-ish: `renderFretboard(svgEl, { trail })`. Only writes into the passed SVG node.
- **Create `public/fretboard-render.test.js`** — jsdom structural tests for the renderer.
- **Create `public/fretboard-panel.js`** — controller + pure helpers `buildTrail`, `cycleIndex`. `init(renderer, dom)` wires the UI.
- **Create `public/fretboard-panel.test.js`** — Jest unit tests for the pure helpers.
- **Modify `public/music-render.js`** — add `getGuessedChordSequence` and `getWindowNoteSet` to the returned object; add tests in `public/music-render.test.js` (or the file where renderer accessors are tested).
- **Modify `public/music.html`** — add the panel DOM under the score and import/init `fretboard-panel.js`.

---

## Task 1: Fretboard core — positions and voicings

**Files:**
- Create: `public/fretboard-core.js`
- Test: `public/fretboard-core.test.js`

- [ ] **Step 1: Write the failing test**

Create `public/fretboard-core.test.js`:

```js
// public/fretboard-core.js — pure fretboard math, ported from guitar.js (no DOM)
import { findPositions, isPlayable, voicingsForNotes, voicingCenter, voicingSpan } from './fretboard-core.js';

describe('findPositions', () => {
  test('open high-E (string 1) and low-E (string 6) both found for E', () => {
    const pos = findPositions('E');
    expect(pos).toContainEqual({ string: 1, fret: 0, octave: '4' });
    expect(pos).toContainEqual({ string: 6, fret: 0, octave: '2' });
  });

  test('enharmonic: Bb resolves to the same frets as A#', () => {
    const bb = findPositions('Bb').map((p) => `${p.string}:${p.fret}`).sort();
    const as = findPositions('A#').map((p) => `${p.string}:${p.fret}`).sort();
    expect(bb).toEqual(as);
    expect(bb.length).toBeGreaterThan(0);
  });

  test('octave filter narrows to one register', () => {
    const all = findPositions('E');
    const oct4 = findPositions('E', '4');
    expect(oct4.every((p) => p.octave === '4')).toBe(true);
    expect(oct4.length).toBeLessThan(all.length);
  });
});

describe('isPlayable', () => {
  test('any open string makes a pair playable regardless of span', () => {
    expect(isPlayable({ string: 1, fret: 0 }, { string: 2, fret: 9 })).toBe(true);
  });
  test('fretted pair within 3 frets is playable; beyond is not', () => {
    expect(isPlayable({ string: 1, fret: 5 }, { string: 2, fret: 8 })).toBe(true);
    expect(isPlayable({ string: 1, fret: 5 }, { string: 2, fret: 9 })).toBe(false);
  });
});

describe('voicingsForNotes', () => {
  test('C major yields the open-C voicing (x32010) among results', () => {
    const voicings = voicingsForNotes(['C', 'E', 'G']);
    const openC = [
      { string: 5, fret: 3 }, // C
      { string: 4, fret: 2 }, // E
      { string: 3, fret: 0 }, // G
      { string: 2, fret: 1 }, // C
      { string: 1, fret: 0 }, // E
    ];
    const asKey = (v) => v.map((p) => `${p.string}:${p.fret}`).sort().join(',');
    const keys = voicings.map(asKey);
    expect(keys).toContain(asKey(openC));
  });

  test('every voicing uses each string at most once and covers all note-set members', () => {
    const voicings = voicingsForNotes(['C', 'E', 'G']);
    expect(voicings.length).toBeGreaterThan(0);
    voicings.forEach((v) => {
      const strings = v.map((p) => p.string);
      expect(new Set(strings).size).toBe(strings.length);
      expect(v.length).toBeGreaterThanOrEqual(3);
    });
  });

  test('every pair in a returned voicing is playable', () => {
    const voicings = voicingsForNotes(['C', 'E', 'G']);
    voicings.forEach((v) => {
      for (let i = 0; i < v.length; i++)
        for (let j = i + 1; j < v.length; j++)
          expect(isPlayable(v[i], v[j])).toBe(true);
    });
  });
});

describe('voicingCenter / voicingSpan', () => {
  test('center is the mean of fretted (non-open) frets; all-open is 0', () => {
    expect(voicingCenter([{ string: 1, fret: 0 }, { string: 2, fret: 0 }])).toBe(0);
    expect(voicingCenter([{ string: 1, fret: 2 }, { string: 2, fret: 4 }])).toBe(3);
  });
  test('span is max minus min fretted fret (0 when all open)', () => {
    expect(voicingSpan([{ string: 1, fret: 0 }, { string: 2, fret: 0 }])).toBe(0);
    expect(voicingSpan([{ string: 1, fret: 2 }, { string: 2, fret: 5 }])).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/fretboard-core.test.js`
Expected: FAIL — "Cannot find module './fretboard-core.js'".

- [ ] **Step 3: Write minimal implementation**

Create `public/fretboard-core.js`:

```js
// public/fretboard-core.js
// Pure guitar-fretboard math. Ported from public/guitar.js (defaultSet, findNoteOnFretboard,
// usefulChords, isPlayable) with all jQuery/DOM removed so it can be unit-tested in isolation.
import { equalNotes } from './music-reference-data.js';
import { cartesian, combinations, uniqueByJsonRepresentation } from './data-structures.js';

// Standard EADGBE tuning. Keys are 1-based string numbers, 1 = high-E … 6 = low-E.
// `notes[string][fret]` = note name; `octaves[string][fret]` = octave. Copied from guitar.js defaultSet.
export const STANDARD_TUNING = {
  notes: {
    6: ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E'],
    5: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A'],
    4: ['D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D'],
    3: ['G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G'],
    2: ['B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    1: ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E'],
  },
  octaves: {
    6: ['2', '2', '2', '2', '2', '2', '2', '2', '3', '3', '3', '3', '3'],
    5: ['2', '2', '2', '3', '3', '3', '3', '3', '3', '3', '3', '3', '3'],
    4: ['3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '4', '4', '4'],
    3: ['3', '3', '3', '3', '3', '4', '4', '4', '4', '4', '4', '4', '4'],
    2: ['3', '4', '4', '4', '4', '4', '4', '4', '4', '4', '4', '4', '4'],
    1: ['4', '4', '4', '4', '4', '4', '4', '4', '5', '5', '5', '5', '5'],
  },
};

const STRINGS = [1, 2, 3, 4, 5, 6];

// Every {string, fret, octave} where the pitch class `noteName` appears (frets 0..12).
// If `octave` is given, restrict to that register. Enharmonic via equalNotes.
export function findPositions(noteName, octave) {
  const out = [];
  STRINGS.forEach((string) => {
    const frets = STANDARD_TUNING.notes[string];
    for (let fret = 0; fret < frets.length; fret++) {
      const oct = STANDARD_TUNING.octaves[string][fret];
      if (equalNotes(frets[fret], noteName) && (octave == null || oct === '' + octave)) {
        out.push({ string, fret, octave: oct });
      }
    }
  });
  return out;
}

// A pair of positions is playable if either is an open string, or the fretted span is <= 3.
export function isPlayable(a, b) {
  if (a.fret === 0 || b.fret === 0) return true;
  return Math.abs(a.fret - b.fret) <= 3;
}

// All playable voicings for a set of pitch-class names. A voicing is one position per note,
// each string used at most once, every pair playable, all notes covered. De-duplicated.
export function voicingsForNotes(noteNames) {
  const perNote = noteNames.map((n) => findPositions(n)).filter((arr) => arr.length > 0);
  if (!perNote.length) return [];
  return cartesian(...perNote)
    .filter((combo) => combinations(combo, 2).every((pair) => isPlayable(pair[0], pair[1])))
    .filter((combo) => {
      const strings = combo.map((p) => p.string);
      return new Set(strings).size === strings.length;
    })
    .filter((combo) => combo.length >= noteNames.length)
    .map((combo) => combo.map((p) => ({ string: p.string, fret: p.fret })))
    .filter(uniqueByJsonRepresentation);
}

// Mean fret of the fretted (non-open) positions; 0 when all open. Used as the "hand position".
export function voicingCenter(voicing) {
  const fretted = voicing.filter((p) => p.fret > 0).map((p) => p.fret);
  if (!fretted.length) return 0;
  return fretted.reduce((a, b) => a + b, 0) / fretted.length;
}

// Span of the fretted positions (max - min fret); 0 when all open.
export function voicingSpan(voicing) {
  const fretted = voicing.filter((p) => p.fret > 0).map((p) => p.fret);
  if (!fretted.length) return 0;
  return Math.max(...fretted) - Math.min(...fretted);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/fretboard-core.test.js`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add public/fretboard-core.js public/fretboard-core.test.js
git commit -m "feat(fretboard): pure core — positions, voicings, geometry"
```

---

## Task 2: Fretboard core — path finding (beam search)

**Files:**
- Modify: `public/fretboard-core.js`
- Test: `public/fretboard-core.test.js`

- [ ] **Step 1: Write the failing test**

Append to `public/fretboard-core.test.js`:

```js
import { findPaths, movementSparkline } from './fretboard-core.js';

describe('findPaths', () => {
  // Toy: step 0 has one low voicing; step 1 offers a near (low) and a far (high) voicing.
  const low0 = [{ string: 6, fret: 1 }, { string: 5, fret: 2 }];
  const near1 = [{ string: 6, fret: 2 }, { string: 5, fret: 3 }];   // center ~2.5, close to low0 (~1.5)
  const far1 = [{ string: 6, fret: 9 }, { string: 5, fret: 10 }];   // center ~9.5, far

  test('ranks paths by ascending total movement', () => {
    const paths = findPaths([[low0], [near1, far1]]);
    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(paths[0].cost).toBeLessThanOrEqual(paths[paths.length - 1].cost);
    // cheapest path takes the near voicing at step 1
    expect(paths[0].voicings[1]).toEqual(near1);
  });

  test('caps the number of returned paths at maxPaths', () => {
    const step = [
      [{ string: 6, fret: 1 }], [{ string: 6, fret: 4 }],
      [{ string: 6, fret: 7 }], [{ string: 6, fret: 10 }],
    ].map((v) => [v]);
    const paths = findPaths(step, { maxPaths: 2 });
    expect(paths.length).toBeLessThanOrEqual(2);
  });

  test('a step with no voicings contributes a null frame and does not throw', () => {
    const paths = findPaths([[low0], [], [near1]]);
    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(paths[0].voicings.length).toBe(3);
    expect(paths[0].voicings[1]).toBeNull();
  });

  test('each path has a human label and per-step move deltas', () => {
    const paths = findPaths([[low0], [near1, far1]]);
    expect(typeof paths[0].label).toBe('string');
    expect(paths[0].label.length).toBeGreaterThan(0);
    expect(Array.isArray(paths[0].moves)).toBe(true);
  });
});

describe('movementSparkline', () => {
  test('maps deltas to block glyphs and tolerates an empty array', () => {
    expect(movementSparkline([])).toBe('');
    expect(movementSparkline([0, 5, 2]).length).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/fretboard-core.test.js -t findPaths`
Expected: FAIL — "findPaths is not a function" (not yet exported).

- [ ] **Step 3: Write minimal implementation**

Append to `public/fretboard-core.js`:

```js
const SPARK_GLYPHS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

// Render per-step movement deltas as a compact block sparkline (one glyph per move).
export function movementSparkline(moves) {
  return (moves || []).map((m) => SPARK_GLYPHS[Math.min(SPARK_GLYPHS.length - 1, Math.round(m))]).join('');
}

function pathLabel(region) {
  if (region <= 2) return 'open / low position';
  if (region <= 5) return `barre / around fret ${region}`;
  return `up the neck ~fret ${region}`;
}

// Beam search across steps. `stepVoicings[i]` is the list of voicings for step i (may be empty).
// A path picks one voicing per step minimizing summed |center change|. Returns up to `maxPaths`
// complete paths, distinct by rounded mean neck region, ranked by ascending total cost.
// An empty step contributes a `null` voicing (no playable shape) and 0 move cost.
export function findPaths(stepVoicings, { beamWidth = 12, maxPaths = 5 } = {}) {
  let beams = [{ voicings: [], cost: 0, lastCenter: null, moves: [] }];
  for (const voicings of stepVoicings) {
    const options = voicings.length ? voicings : [null];
    const next = [];
    for (const beam of beams) {
      for (const v of options) {
        const center = v ? voicingCenter(v) : beam.lastCenter;
        const move = (v && beam.lastCenter != null) ? Math.abs(center - beam.lastCenter) : 0;
        next.push({
          voicings: [...beam.voicings, v],
          cost: beam.cost + move,
          lastCenter: center,
          moves: [...beam.moves, move],
        });
      }
    }
    next.sort((a, b) => a.cost - b.cost);
    beams = next.slice(0, beamWidth);
  }
  const seen = new Set();
  const out = [];
  for (const beam of beams) {
    const centers = beam.voicings.filter(Boolean).map(voicingCenter);
    const region = centers.length ? Math.round(centers.reduce((a, b) => a + b, 0) / centers.length) : 0;
    if (seen.has(region)) continue;
    seen.add(region);
    out.push({ voicings: beam.voicings, cost: beam.cost, moves: beam.moves, label: pathLabel(region) });
    if (out.length >= maxPaths) break;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/fretboard-core.test.js`
Expected: PASS (Task 1 and Task 2 blocks all green).

- [ ] **Step 5: Commit**

```bash
git add public/fretboard-core.js public/fretboard-core.test.js
git commit -m "feat(fretboard): beam-search path finding + movement sparkline"
```

---

## Task 3: SVG fretboard renderer

**Files:**
- Create: `public/fretboard-render.js`
- Test: `public/fretboard-render.test.js`

- [ ] **Step 1: Write the failing test**

Create `public/fretboard-render.test.js`:

```js
/**
 * @jest-environment jsdom
 */
import { renderFretboard } from './fretboard-render.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg() {
  return document.createElementNS(SVG_NS, 'svg');
}

describe('renderFretboard', () => {
  test('draws six string lines', () => {
    const svg = makeSvg();
    renderFretboard(svg, { trail: [] });
    expect(svg.querySelectorAll('.fb-string').length).toBe(6);
  });

  test('draws one dot per position across the trail', () => {
    const svg = makeSvg();
    const trail = [
      { voicing: [{ string: 1, fret: 0 }, { string: 2, fret: 1 }], age: 0 },
      { voicing: [{ string: 6, fret: 3 }], age: 1 },
    ];
    renderFretboard(svg, { trail });
    expect(svg.querySelectorAll('.fb-dot').length).toBe(3);
  });

  test('older dots are more transparent than the current step', () => {
    const svg = makeSvg();
    const trail = [
      { voicing: [{ string: 1, fret: 0 }], age: 0 },
      { voicing: [{ string: 2, fret: 1 }], age: 3 },
    ];
    renderFretboard(svg, { trail });
    const dots = [...svg.querySelectorAll('.fb-dot')];
    const op = (d) => parseFloat(d.getAttribute('opacity'));
    const current = dots.find((d) => d.getAttribute('data-age') === '0');
    const old = dots.find((d) => d.getAttribute('data-age') === '3');
    expect(op(current)).toBeGreaterThan(op(old));
  });

  test('is idempotent — re-rendering does not accumulate elements', () => {
    const svg = makeSvg();
    const trail = [{ voicing: [{ string: 1, fret: 0 }], age: 0 }];
    renderFretboard(svg, { trail });
    renderFretboard(svg, { trail });
    expect(svg.querySelectorAll('.fb-dot').length).toBe(1);
    expect(svg.querySelectorAll('.fb-string').length).toBe(6);
  });

  test('a null voicing in the trail draws no dots and does not throw', () => {
    const svg = makeSvg();
    renderFretboard(svg, { trail: [{ voicing: null, age: 0 }] });
    expect(svg.querySelectorAll('.fb-dot').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/fretboard-render.test.js`
Expected: FAIL — "Cannot find module './fretboard-render.js'".

- [ ] **Step 3: Write minimal implementation**

Create `public/fretboard-render.js`:

```js
// public/fretboard-render.js
// Draws a horizontal guitar neck into a passed <svg>. Nut on the left, high-E string on top.
// Stateless and idempotent: clears the svg and redraws on every call. No globals.
const SVG_NS = 'http://www.w3.org/2000/svg';

const NUM_FRETS = 12;          // drawn fret columns (1..12); fret 0 = the open column left of the nut
const STRING_COUNT = 6;
const PAD_LEFT = 44;           // room for the open column + string labels
const PAD_TOP = 16;
const FRET_W = 38;             // px per fret
const STRING_GAP = 26;         // px between strings
const DOT_R = 9;
const MIN_OPACITY = 0.16;
const FADE_STEP = 0.28;        // opacity lost per step of age
const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E']; // top→bottom = string 1..6

function el(tag, attrs) {
  const n = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
  return n;
}

// y for a 1-based string number (1 = high-E at top).
function stringY(string) { return PAD_TOP + (string - 1) * STRING_GAP; }
// x-center for a fret: fret 0 sits in the open column left of the nut; fret N centers in its cell.
function fretX(fret) { return fret === 0 ? PAD_LEFT - 22 : PAD_LEFT + (fret - 0.5) * FRET_W; }

export function renderFretboard(svgEl, { trail = [] } = {}) {
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  const width = PAD_LEFT + NUM_FRETS * FRET_W + 12;
  const height = PAD_TOP + (STRING_COUNT - 1) * STRING_GAP + PAD_TOP;
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svgEl.setAttribute('width', width);
  svgEl.setAttribute('height', height);

  // Fretboard background.
  svgEl.appendChild(el('rect', { x: PAD_LEFT, y: PAD_TOP - 6, width: NUM_FRETS * FRET_W,
    height: (STRING_COUNT - 1) * STRING_GAP + 12, fill: '#f3ead7', stroke: '#cbb994' }));

  // Nut (thick) + fret lines.
  for (let f = 0; f <= NUM_FRETS; f++) {
    const x = PAD_LEFT + f * FRET_W;
    svgEl.appendChild(el('line', { x1: x, y1: PAD_TOP - 6, x2: x, y2: PAD_TOP - 6 + (STRING_COUNT - 1) * STRING_GAP + 12,
      stroke: f === 0 ? '#6b5836' : '#cbb994', 'stroke-width': f === 0 ? 4 : 1, class: 'fb-fret' }));
  }

  // Strings + labels.
  for (let s = 1; s <= STRING_COUNT; s++) {
    const y = stringY(s);
    svgEl.appendChild(el('line', { x1: PAD_LEFT, y1: y, x2: PAD_LEFT + NUM_FRETS * FRET_W, y2: y,
      stroke: '#b9a886', 'stroke-width': 1, class: 'fb-string' }));
    const label = el('text', { x: 6, y: y + 4, 'font-size': 11, 'font-family': 'monospace', fill: '#6b5836' });
    label.textContent = STRING_LABELS[s - 1];
    svgEl.appendChild(label);
  }

  // Fret-number axis.
  for (let f = 1; f <= NUM_FRETS; f++) {
    const t = el('text', { x: fretX(f), y: height - 2, 'font-size': 9, 'font-family': 'monospace',
      fill: '#999', 'text-anchor': 'middle' });
    t.textContent = '' + f;
    svgEl.appendChild(t);
  }

  // Dots, oldest first so the current step paints on top.
  [...trail].sort((a, b) => b.age - a.age).forEach((entry) => {
    if (!entry.voicing) return;
    const opacity = Math.max(MIN_OPACITY, 1 - entry.age * FADE_STEP);
    entry.voicing.forEach((p) => {
      const cx = fretX(p.fret);
      const cy = stringY(p.string);
      svgEl.appendChild(el('circle', { cx, cy, r: DOT_R, fill: '#1565c0', opacity,
        'data-age': entry.age, class: 'fb-dot' }));
      const num = el('text', { x: cx, y: cy + 3.5, 'font-size': 9, 'font-weight': 700,
        'font-family': 'monospace', fill: '#fff', 'text-anchor': 'middle', opacity, class: 'fb-dot-label' });
      num.textContent = '' + p.fret;
      svgEl.appendChild(num);
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/fretboard-render.test.js`
Expected: PASS (5 tests green).

- [ ] **Step 5: Commit**

```bash
git add public/fretboard-render.js public/fretboard-render.test.js
git commit -m "feat(fretboard): SVG neck renderer with fading trail"
```

---

## Task 4: Renderer accessors for note-set sources

**Files:**
- Modify: `public/music-render.js` (the object returned by `createMusicRenderer`, near line 1128 `return { … }`)
- Test: `public/music-render.test.js`

**Context:** `createMusicRenderer` (public/music-render.js:187) already computes per-measure chords via the internal `measureChordAreas(notes)` (returns `[{ x, top, chords:[{ name, notes, chordTones }], measure }]`) and groups notes per system via `notesBySystem()`. It tracks suppression with `mutedList()` (returns the currently-muted note objects) and `suppressionKey({measure, midi, beats})`. The chord window selection is available via `currentWindowSelection()` → `{ ordered, selected }` and `rangeFromSelected(selected)`. This task exposes two read-only getters that reuse those internals; no rendering behavior changes.

- [ ] **Step 1: Write the failing test**

First inspect the existing accessor tests to match their harness:

Run: `grep -n "createMusicRenderer" public/music-render.test.js | head`
(If `public/music-render.test.js` does not exist, create it with the import + jsdom pragma shown below.)

Add to `public/music-render.test.js`:

```js
/**
 * @jest-environment jsdom
 */
import { createMusicRenderer } from './music-render.js';

// Minimal MusicXML: 2 measures, key, a couple of notes. Reuse an existing fixture if the file
// already has one; otherwise this inline string is enough to drive the accessors.
const XML = `<?xml version="1.0"?><score-partwise version="3.1"><part-list>
<score-part id="P1"><part-name>P</part-name></score-part></part-list>
<part id="P1">
<measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key>
<time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
</measure></part></score-partwise>`;

describe('getGuessedChordSequence', () => {
  test('returns measures in order with note-name arrays', async () => {
    const container = document.createElement('div');
    const r = createMusicRenderer(container, {});
    await r.load(XML);
    const seq = r.getGuessedChordSequence();
    expect(Array.isArray(seq)).toBe(true);
    // shape contract: each entry has measure, name, and noteNames array
    seq.forEach((s) => {
      expect(typeof s.measure).toBe('number');
      expect(typeof s.name).toBe('string');
      expect(Array.isArray(s.noteNames)).toBe(true);
    });
  });
});

describe('getWindowNoteSet', () => {
  test('returns null when no chord window is active', async () => {
    const container = document.createElement('div');
    const r = createMusicRenderer(container, {});
    await r.load(XML);
    expect(r.getWindowNoteSet()).toBeNull();
  });
});
```

> Note: OSMD rendering in jsdom is limited. If `r.load`/layout cannot run under jsdom in this repo's harness (check how existing `music-render.test.js` tests, if any, construct the renderer), then instead test the two **pure extraction helpers** added in Step 3 (`pitchClassesOf`, `topChordPerMeasure`) directly, and verify the accessors by manual browser check. Pick whichever matches the existing test style; do not leave the behavior untested.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/music-render.test.js -t getGuessedChordSequence`
Expected: FAIL — `r.getGuessedChordSequence is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `public/music-render.js`, add two small pure helpers near the top-level pure exports (after `notesInWindow`, around line 159), so they are independently testable:

```js
// Distinct pitch-class names from a list of note objects that carry a `name` (e.g. "C#").
export function pitchClassesOf(notes) {
  const seen = new Set();
  const out = [];
  (notes || []).forEach((n) => {
    const nm = n && n.name;
    if (nm && !seen.has(nm)) { seen.add(nm); out.push(nm); }
  });
  return out;
}

// Given measureChordAreas output (ordered), take each measure's top (first) chord.
export function topChordPerMeasure(areas) {
  return (areas || [])
    .filter((a) => a.chords && a.chords.length)
    .map((a) => ({ measure: a.measure, chord: a.chords[0] }));
}
```

Then inside `createMusicRenderer`, just before the `return { … }` (public/music-render.js:1128), add:

```js
  // Read-only: the auto-guessed chords as an ordered step sequence. Concatenates per-system
  // measure chords in reading order; each step's noteNames are the chord's pitch classes with
  // suppressed notes excluded unless includeSuppressed. Reuses measureChordAreas + mutedList.
  function getGuessedChordSequence({ includeSuppressed = false } = {}) {
    const { groups } = notesBySystem();
    const mutedKeys = includeSuppressed ? new Set()
      : new Set(mutedList().map((n) => suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
    const steps = [];
    groups.forEach((notes) => {
      topChordPerMeasure(measureChordAreas(notes)).forEach(({ measure, chord }) => {
        const live = (chord.notes || []).filter((n) =>
          !mutedKeys.has(suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
        const noteNames = pitchClassesOf(live.length ? live : chord.notes);
        steps.push({ measure, name: chord.name, noteNames });
      });
    });
    steps.sort((a, b) => a.measure - b.measure);
    return steps;
  }

  // Read-only: the current chord-window selection as one note-set, or null when no window is active.
  function getWindowNoteSet({ includeSuppressed = false } = {}) {
    if (!chordWindow.active) return null;
    const { selected } = currentWindowSelection();
    if (!selected || !selected.length) return null;
    const mutedKeys = includeSuppressed ? new Set()
      : new Set(mutedList().map((n) => suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
    const live = selected.filter((n) =>
      !mutedKeys.has(suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
    const range = rangeFromSelected(selected);
    return {
      measureRange: range ? [range.fromMeasure, range.toMeasure] : null,
      noteNames: pitchClassesOf(live.length ? live : selected),
    };
  }
```

Add both to the returned object (public/music-render.js:1128 `return { … }`):

```js
    getGuessedChordSequence,
    getWindowNoteSet,
```

> Verify `rangeFromSelected` returns an object with `fromMeasure`/`toMeasure` (it is defined just above `fireWindowChange`, public/music-render.js ~949). If those property names differ, match them here.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/music-render.test.js`
Expected: PASS. (If the accessor tests cannot run under jsdom, the `pitchClassesOf` / `topChordPerMeasure` unit tests below must pass instead.)

Add these pure-helper tests regardless (they always run):

```js
import { pitchClassesOf, topChordPerMeasure } from './music-render.js';

describe('pitchClassesOf', () => {
  test('dedupes by name, preserves first-seen order', () => {
    expect(pitchClassesOf([{ name: 'C' }, { name: 'E' }, { name: 'C' }, { name: 'G' }]))
      .toEqual(['C', 'E', 'G']);
  });
  test('ignores entries without a name', () => {
    expect(pitchClassesOf([{ name: 'C' }, {}, { name: null }, { name: 'G' }])).toEqual(['C', 'G']);
  });
});

describe('topChordPerMeasure', () => {
  test('takes the first chord of each measure that has one', () => {
    const areas = [
      { measure: 1, chords: [{ name: 'C' }, { name: 'Am' }] },
      { measure: 2, chords: [] },
      { measure: 3, chords: [{ name: 'G' }] },
    ];
    expect(topChordPerMeasure(areas)).toEqual([
      { measure: 1, chord: { name: 'C' } },
      { measure: 3, chord: { name: 'G' } },
    ]);
  });
});
```

Run: `npx jest public/music-render.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/music-render.js public/music-render.test.js
git commit -m "feat(fretboard): renderer accessors for guessed-chord + window note-sets"
```

---

## Task 5: Panel controller + pure helpers

**Files:**
- Create: `public/fretboard-panel.js`
- Test: `public/fretboard-panel.test.js`

**Context:** The panel holds state and wires the DOM built in Task 6. Two pieces of logic are non-trivial and pure, so they are exported and unit-tested: `buildTrail` (which voicings + ages to draw at a given step, honoring per-step shape overrides) and `cycleIndex` (modulo stepper for Prev/Next and the shape cycler). The rest is event wiring tested by hand in the browser.

- [ ] **Step 1: Write the failing test**

Create `public/fretboard-panel.test.js`:

```js
import { buildTrail, cycleIndex } from './fretboard-panel.js';

describe('cycleIndex', () => {
  test('wraps forward and backward', () => {
    expect(cycleIndex(0, 4, +1)).toBe(1);
    expect(cycleIndex(3, 4, +1)).toBe(0);
    expect(cycleIndex(0, 4, -1)).toBe(3);
  });
  test('count of 0 stays at 0', () => {
    expect(cycleIndex(0, 0, +1)).toBe(0);
  });
});

describe('buildTrail', () => {
  const path = { voicings: [['v0'], ['v1'], ['v2']] };       // one fake voicing per step
  const stepVoicings = [[['v0'], ['v0b']], [['v1'], ['v1b']], [['v2']]];

  test('includes steps 0..stepIdx with ages counting back from current', () => {
    const trail = buildTrail(path, stepVoicings, 2, new Map());
    expect(trail).toEqual([
      { voicing: ['v0'], age: 2 },
      { voicing: ['v1'], age: 1 },
      { voicing: ['v2'], age: 0 },
    ]);
  });

  test('a per-step override swaps that step voicing from stepVoicings', () => {
    const overrides = new Map([[1, 1]]); // step 1 → voicing index 1 (v1b)
    const trail = buildTrail(path, stepVoicings, 2, overrides);
    expect(trail[1]).toEqual({ voicing: ['v1b'], age: 1 });
  });

  test('stepIdx 0 yields a single current-step entry', () => {
    expect(buildTrail(path, stepVoicings, 0, new Map())).toEqual([{ voicing: ['v0'], age: 0 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/fretboard-panel.test.js`
Expected: FAIL — "Cannot find module './fretboard-panel.js'".

- [ ] **Step 3: Write minimal implementation**

Create `public/fretboard-panel.js`:

```js
// public/fretboard-panel.js
// Controller for the fretboard visualizer panel. Pure helpers (buildTrail, cycleIndex) are exported
// for unit testing; init() wires the DOM and is exercised manually in the browser.
import { voicingsForNotes, findPaths, movementSparkline } from './fretboard-core.js';
import { renderFretboard } from './fretboard-render.js';

// Modulo stepper; tolerates count 0.
export function cycleIndex(idx, count, dir) {
  if (!count) return 0;
  return ((idx + dir) % count + count) % count;
}

// Build the trail [{voicing, age}] for steps 0..stepIdx of `path`. A per-step override
// (Map stepIdx→voicingIdx) swaps that step's voicing from `stepVoicings`. age = stepIdx - i.
export function buildTrail(path, stepVoicings, stepIdx, overrides) {
  const trail = [];
  for (let i = 0; i <= stepIdx; i++) {
    let voicing = path.voicings[i];
    if (overrides && overrides.has(i)) {
      const vs = stepVoicings[i] || [];
      const oi = overrides.get(i);
      if (vs[oi]) voicing = vs[oi];
    }
    trail.push({ voicing, age: stepIdx - i });
  }
  return trail;
}

// Wire the panel. `renderer` is a createMusicRenderer instance; `dom` holds the panel elements.
export function init(renderer, dom) {
  const state = {
    source: 'guessed',          // 'guessed' | 'window'
    includeSuppressed: false,
    steps: [],                  // [{ measure?, name, noteNames }]
    stepVoicings: [],           // voicingsForNotes per step
    paths: [],                  // findPaths output
    selectedPathIdx: 0,
    stepIdx: 0,
    overrides: new Map(),       // stepIdx → voicingIdx
    playing: false,
    timer: null,
    speedMs: 900,
  };

  function setMsg(text) { if (dom.msg) dom.msg.textContent = text || ''; }

  function stopPlay() {
    state.playing = false;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (dom.playBtn) dom.playBtn.textContent = '▶ Play';
  }

  function capture() {
    stopPlay();
    const opts = { includeSuppressed: state.includeSuppressed };
    let steps = [];
    if (state.source === 'guessed') {
      steps = renderer.getGuessedChordSequence(opts);
    } else {
      const ws = renderer.getWindowNoteSet(opts);
      if (ws && ws.noteNames.length) steps = [{ name: 'window', noteNames: ws.noteNames }];
    }
    if (!steps.length) { setMsg('No chords to capture — guess chords or select a window first.'); return; }
    setMsg('');
    state.steps = steps;
    state.stepVoicings = steps.map((s) => voicingsForNotes(s.noteNames));
    state.paths = findPaths(state.stepVoicings);
    state.selectedPathIdx = 0;
    state.stepIdx = 0;
    state.overrides = new Map();
    populatePaths();
    render();
  }

  function populatePaths() {
    if (!dom.pathSelect) return;
    dom.pathSelect.innerHTML = '';
    state.paths.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = '' + i;
      opt.textContent = `Path ${i + 1} — ${p.label}  ${movementSparkline(p.moves)}`;
      dom.pathSelect.appendChild(opt);
    });
    dom.pathSelect.value = '0';
  }

  function currentPath() { return state.paths[state.selectedPathIdx] || { voicings: [] }; }

  function render() {
    const path = currentPath();
    const trail = buildTrail(path, state.stepVoicings, state.stepIdx, state.overrides);
    renderFretboard(dom.svg, { trail });
    const step = state.steps[state.stepIdx];
    if (dom.stepLabel) dom.stepLabel.textContent =
      state.steps.length ? `${state.stepIdx + 1} / ${state.steps.length} — ${step ? step.name : ''}` : '—';
    const vs = state.stepVoicings[state.stepIdx] || [];
    const cur = state.overrides.has(state.stepIdx) ? state.overrides.get(state.stepIdx) : 0;
    if (dom.shapeLabel) dom.shapeLabel.textContent = vs.length ? `${cur + 1} / ${vs.length}` : '0 / 0';
  }

  function step(dir) {
    if (!state.steps.length) return;
    const n = state.steps.length;
    state.stepIdx = Math.max(0, Math.min(n - 1, state.stepIdx + dir));
    render();
  }

  function play() {
    if (state.playing) { stopPlay(); return; }
    if (!state.steps.length) return;
    state.playing = true;
    if (dom.playBtn) dom.playBtn.textContent = '⏸ Pause';
    state.timer = setInterval(() => {
      if (state.stepIdx >= state.steps.length - 1) { stopPlay(); return; }
      state.stepIdx += 1;
      render();
    }, state.speedMs);
  }

  function cycleShape(dir) {
    const vs = state.stepVoicings[state.stepIdx] || [];
    if (!vs.length) return;
    const cur = state.overrides.has(state.stepIdx) ? state.overrides.get(state.stepIdx) : 0;
    state.overrides.set(state.stepIdx, cycleIndex(cur, vs.length, dir));
    render();
  }

  // Wiring.
  if (dom.srcGuessed) dom.srcGuessed.addEventListener('click', () => { state.source = 'guessed'; reflectSource(); });
  if (dom.srcWindow) dom.srcWindow.addEventListener('click', () => { state.source = 'window'; reflectSource(); });
  if (dom.suppressChk) dom.suppressChk.addEventListener('change', (e) => { state.includeSuppressed = e.target.checked; });
  if (dom.captureBtn) dom.captureBtn.addEventListener('click', capture);
  if (dom.pathSelect) dom.pathSelect.addEventListener('change', (e) => {
    state.selectedPathIdx = parseInt(e.target.value, 10) || 0; state.overrides = new Map(); render();
  });
  if (dom.prevBtn) dom.prevBtn.addEventListener('click', () => { stopPlay(); step(-1); });
  if (dom.nextBtn) dom.nextBtn.addEventListener('click', () => { stopPlay(); step(+1); });
  if (dom.playBtn) dom.playBtn.addEventListener('click', play);
  if (dom.speed) dom.speed.addEventListener('input', (e) => { state.speedMs = 1600 - parseInt(e.target.value, 10); });
  if (dom.shapePrev) dom.shapePrev.addEventListener('click', () => cycleShape(-1));
  if (dom.shapeNext) dom.shapeNext.addEventListener('click', () => cycleShape(+1));
  if (dom.panel) dom.panel.addEventListener('toggle', () => { if (!dom.panel.open) stopPlay(); });

  function reflectSource() {
    if (dom.srcGuessed) dom.srcGuessed.classList.toggle('alt', state.source !== 'guessed');
    if (dom.srcWindow) dom.srcWindow.classList.toggle('alt', state.source !== 'window');
  }
  reflectSource();

  return { capture, _state: state }; // _state exposed for debugging only
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/fretboard-panel.test.js`
Expected: PASS (cycleIndex + buildTrail blocks green).

- [ ] **Step 5: Commit**

```bash
git add public/fretboard-panel.js public/fretboard-panel.test.js
git commit -m "feat(fretboard): panel controller + trail/cycle pure helpers"
```

---

## Task 6: Mount the panel in music.html

**Files:**
- Modify: `public/music.html` (DOM inside `#musicPreview`, near line 244; the module `<script type="module">` that constructs the renderer)

**Context:** `#musicPreview` (public/music.html:244) holds the score preview. The renderer instance is created in the page's module script (search for `createMusicRenderer`). This task adds the panel markup and initializes the controller against the existing renderer instance.

- [ ] **Step 1: Add the panel markup**

Inside `#musicPreview`, after the score/preview content, add:

```html
<details id="fretboardPanel" class="fb-wrap" style="margin-top:1rem">
  <summary>🎸 Fretboard</summary>
  <div class="fb-bar">
    <span class="label">Source</span>
    <button type="button" id="fbSrcGuessed" class="fb-chip">Guessed chords</button>
    <button type="button" id="fbSrcWindow" class="fb-chip alt">Chord window</button>
    <label style="margin-left:8px"><input type="checkbox" id="fbSuppress"> include suppressed</label>
    <button type="button" id="fbCapture" class="fb-btn" style="margin-left:auto">Capture → fretboard</button>
  </div>
  <div class="fb-paths">
    <label>Ways to play <select id="fbPaths"></select></label>
  </div>
  <div class="fb-step">
    <button type="button" id="fbPrev" class="fb-btn">◀ Prev</button>
    <span>Step <b id="fbStepLabel">—</b></span>
    <button type="button" id="fbNext" class="fb-btn">Next ▶</button>
    <button type="button" id="fbPlay" class="fb-btn" style="margin-left:8px">▶ Play</button>
    <input type="range" id="fbSpeed" min="200" max="1400" value="700" style="vertical-align:middle;width:90px">
    <span style="margin-left:8px">shape
      <button type="button" id="fbShapePrev" class="fb-chip">◀</button>
      <b id="fbShapeLabel">0 / 0</b>
      <button type="button" id="fbShapeNext" class="fb-chip">▶</button>
    </span>
  </div>
  <div id="fbMsg" class="fb-msg" style="color:#c62828;font-size:12px"></div>
  <svg id="fbSvg"></svg>
</details>
```

Add minimal styles to the page's `<style>` (match the mockup):

```css
#fretboardPanel.fb-wrap{background:#fff;border:1px solid #d8dee8;border-radius:10px;padding:10px 14px}
#fretboardPanel .fb-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px;margin:8px 0}
#fretboardPanel .fb-chip{border:1px solid #1565c0;color:#1565c0;border-radius:999px;padding:2px 10px;cursor:pointer;background:#eef4ff}
#fretboardPanel .fb-chip.alt{border-color:#bbb;color:#555;background:#fff}
#fretboardPanel .fb-btn{border:1px solid #1565c0;background:#1565c0;color:#fff;border-radius:6px;padding:3px 12px;cursor:pointer}
#fretboardPanel .fb-paths{margin:8px 0;font-size:13px}
#fretboardPanel .fb-paths select{font:12.5px monospace;padding:4px 8px;border:1px solid #1565c0;border-radius:6px;min-width:320px}
#fretboardPanel .fb-step{display:flex;gap:8px;align-items:center;font-size:13px;margin:8px 0;flex-wrap:wrap}
#fbSvg{max-width:100%;overflow-x:auto;display:block}
```

- [ ] **Step 2: Import and initialize the controller**

In the page's module script (the `<script type="module">` that calls `createMusicRenderer`), add the import at the top with the other imports:

```js
import { init as initFretboard } from './fretboard-panel.js';
```

After the renderer instance is created (the variable assigned from `createMusicRenderer(...)`, e.g. `const renderer = createMusicRenderer(container, opts);`), initialize the panel once:

```js
initFretboard(renderer, {
  panel: document.getElementById('fretboardPanel'),
  srcGuessed: document.getElementById('fbSrcGuessed'),
  srcWindow: document.getElementById('fbSrcWindow'),
  suppressChk: document.getElementById('fbSuppress'),
  captureBtn: document.getElementById('fbCapture'),
  pathSelect: document.getElementById('fbPaths'),
  prevBtn: document.getElementById('fbPrev'),
  nextBtn: document.getElementById('fbNext'),
  playBtn: document.getElementById('fbPlay'),
  speed: document.getElementById('fbSpeed'),
  shapePrev: document.getElementById('fbShapePrev'),
  shapeNext: document.getElementById('fbShapeNext'),
  stepLabel: document.getElementById('fbStepLabel'),
  shapeLabel: document.getElementById('fbShapeLabel'),
  msg: document.getElementById('fbMsg'),
  svg: document.getElementById('fbSvg'),
});
```

> If the renderer variable name differs (grep `createMusicRenderer` in music.html), use that name. If the renderer is recreated per piece, call `initFretboard` after each (re)creation, or guard so it initializes once and reads the live renderer.

- [ ] **Step 3: Verify the module parses**

Run the project's existing inline-module check used elsewhere in this repo (extract the `<script type="module">` to a temp `.mjs` and `node --check`), or at minimum:

Run: `npx jest public/` (ensures all new modules and existing suites still pass together)
Expected: PASS for `fretboard-core`, `fretboard-render`, `fretboard-panel`, `music-render`; the pre-existing `music_search.test.js` failure is unrelated and may remain.

- [ ] **Step 4: Manual browser verification**

Start the app, open a piece (e.g. A_Time_For_Us), expand 🎸 Fretboard, leave source on *Guessed chords*, click **Capture → fretboard**. Confirm:
- the path selectbox fills with ranked options;
- Next ▶ advances and earlier chords dim along the trail;
- the shape cycler swaps the current chord's voicing;
- switching to *Chord window* and capturing with an active window shows that note-set;
- "include suppressed" off excludes suppressed notes, on includes them.

- [ ] **Step 5: Commit**

```bash
git add public/music.html
git commit -m "feat(fretboard): mount fretboard panel in music.html"
```

---

## Self-Review

**1. Spec coverage:**
- Source toggle (guessed / window) → Task 5 `capture` + Task 4 accessors. ✓
- Include-suppressed toggle (default off) → Task 4 accessors + Task 5 state. ✓
- Capture builds steps → Task 5. ✓
- Ways-to-play selectbox, ranked least-movement → Task 2 `findPaths` + Task 5 `populatePaths`. ✓
- Step controls (Prev/Next, Play+speed) → Task 5. ✓
- Per-chord shape cycler within a path → Task 5 `cycleShape` + `buildTrail` override. ✓
- Horizontal neck, nut left, high-E top, fret-number dots → Task 3. ✓
- Cumulative fading trail → Task 3 opacity + Task 5 `buildTrail` ages. ✓
- One note-set = one step (window capture) → Task 5 (`steps = [single note-set]`). ✓
- Standard EADGBE assumed → Task 1 `STANDARD_TUNING`. ✓
- Port `findNoteOnFretboard`/`usefulChords`/`isPlayable` into pure module → Task 1. ✓
- Edge: no source data, no playable voicing, single-step, enharmonic, panel-closed-mid-play → Tasks 1/2/3/5 (tested). ✓
- guitar.js untouched → only new files + additive accessors. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. The two "if the variable name differs / if jsdom can't render" notes are explicit fallbacks with concrete instructions, not deferred work.

**3. Type consistency:** `voicing = [{string,fret}]` throughout; `findPaths` returns `{voicings, cost, moves, label}` (used by `populatePaths` and `buildTrail`); accessors return `{measure?,name,noteNames}` (consumed by `capture`); `buildTrail` signature `(path, stepVoicings, stepIdx, overrides)` matches its test and call site; `renderFretboard(svg,{trail})` with `trail=[{voicing,age}]` matches renderer + panel. Consistent.
