# Music Study App — M2 Plan 2: Rendering (Phase 2, `music-render.js`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a piece (and a matched measure-range segment) as notation via OSMD, responsively, and provide the pure measure-mapping helpers that turn Phase 1 search results (note ranges / chord ranges) into measure ranges for rendering, playback, and capture.

**Architecture:** A new module `public/music-render.js` with two layers: (1) **pure measure-mapping helpers** over a Tier-2 detail (`measureRangeFromNoteRange`, `collapsedChordSpans`, `measureRangeFromChordMatch`, `responsiveZoom`) — fully TDD'd; (2) a thin **OSMD wrapper** (`createMusicRenderer`) that loads a detail's MusicXML, renders the whole piece or a measure-range segment, and applies zoom. The wrapper takes an **injectable OSMD factory** so its call contract is unit-testable with a spy in jsdom; the actual visual output is verified in a browser. A minimal "Preview" surface is wired into `music.html` for that verification (the full Layout-C UI is Plan 6).

**Tech Stack:** Vanilla ES modules; Jest + jsdom (`npx jest public/<file>.test.js`); vendored OpenSheetMusicDisplay at `public/vendor/opensheetmusicdisplay.min.js` (confirmed: supports `drawFromMeasureNumber`/`drawUpToMeasureNumber` and `Zoom`). Reuses M1 `music-encoding.js` (`primaryVoice`) and `music-index.js` (`buildIndexEntry`, for a contract-pinning test).

**Spec:** [2026-06-20-music-study-app-m2-rendering-search-design.md](../specs/2026-06-20-music-study-app-m2-rendering-search-design.md) §5.

**Builds on:** Plan 1 ([2026-06-20-music-study-app-m2-p1-search.md](2026-06-20-music-study-app-m2-p1-search.md)) — `runQuery` returns `match.kind` ∈ {`note`,`chord`}; melody `range` = primary-voice note indices, chord `range` = indices into the duplicate-collapsed `search.chords` plus `match.symbols`. This plan converts both to measure ranges.

**Scope (Phase 2 only):** Rendering module + its pure helpers + a minimal in-app preview. NOT in this plan: playback (Plan 3), media-linking (Plan 4), capture (Plan 5), the full search/detail UI (Plan 6).

**Deferred to Plan 6 (UI):** in-context notehead *highlighting within a full render* (the spec's `populateNoteheadData` coloring). Phase 2 makes the matched range the visual focus by **segment rendering** — OSMD draws only the matched measures (`drawFromMeasureNumber`/`drawUpToMeasureNumber`). Coloring noteheads inside a full score is OSMD-geometry/DOM work that belongs with the detail-view assembly in Plan 6.

---

## Background the implementer needs

- **Tier-2 detail shape** (from M1 `splitTiers`): `{ meta, voices, format, source }`.
  - `meta`: `{ id, title, system, format, key, time, tempo, instrument, ... }`.
  - `voices`: array of `{ pitch[], interval[], sargam[], duration[], chordSymbol[], lyric[], measureIndex[] }`, all index-aligned to `pitch`. `measureIndex[i]` is the **1-based** measure number of note `i`.
  - `format`: `'musicxml'` or `'note-text'`.
  - `source`: the MusicXML string (for `'musicxml'`) or the raw note text (for `'note-text'`).
- **`primaryVoice(doc)`** (exported from `music-encoding.js`): returns the longest voice (the melody we search/render against).
- **OSMD API** (from `guitar.js` patterns):
  - `const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container)`
  - `osmd.setOptions({ backend:'svg', drawingParameters:'compacttight', drawTitle:false })`
  - `await osmd.load(musicXmlString); osmd.render()`
  - Segment: `osmd.setOptions({ drawFromMeasureNumber: N, drawUpToMeasureNumber: M }); osmd.render()` (measure numbers 1-based).
  - Zoom: `osmd.Zoom = factor; osmd.render()`.
  - After load, `osmd.Sheet.SourceMeasures.length` is the total measure count.
- **Index chord collapsing** (M1 `buildIndexEntry`): `search.chords` is built by walking ALL voices in order and pushing each non-empty `chordSymbol` only when it differs from the previously pushed one (consecutive-duplicate collapse, across voice boundaries). Phase 1 chord ranges index into this collapsed list. `collapsedChordSpans` (Task 2) must replicate this exact walk so the indices line up — pinned by a test against `buildIndexEntry`.
- **Note-text pieces don't render via OSMD** (their `source` is note text, not MusicXML). `loadDetail` returns `{ ok:false, reason:'not-musicxml' }` for them; the measure-mapping helpers still work (note-text has `measureIndex`).

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `public/music-render.js` | Pure measure-mapping helpers + OSMD wrapper (injectable factory) | Create |
| `public/music-render.test.js` | Unit tests for helpers + wrapper contract (fake OSMD spy) | Create |
| `public/music.html` | Add a minimal OSMD "Preview" surface (vendor script, container, preview/segment controls) | Modify |

---

## Task 1: `measureRangeFromNoteRange` (pure)

**Files:**
- Create: `public/music-render.js`
- Create: `public/music-render.test.js`

Map a primary-voice note-index range `[startIdx, endIdx]` to a 1-based measure range `[startMeasure, endMeasure]` via `primaryVoice(detail).measureIndex`. Clamp indices into bounds; return `null` if the voice has no notes.

- [ ] **Step 1: Write the failing test**

Create `public/music-render.test.js`:

```js
import { measureRangeFromNoteRange } from './music-render.js';

const detail = {
  meta: { id: 'x', format: 'musicxml' },
  format: 'musicxml',
  voices: [{
    pitch: [60, 62, 64, 65, 67],
    interval: [], sargam: [], duration: [], chordSymbol: [], lyric: [],
    measureIndex: [1, 1, 2, 2, 3]   // notes 0-1 in m1, 2-3 in m2, 4 in m3
  }]
};

describe('measureRangeFromNoteRange', () => {
  test('maps a note-index range to a measure range', () => {
    expect(measureRangeFromNoteRange(detail, [1, 3])).toEqual([1, 2]);
  });
  test('single note maps to its measure', () => {
    expect(measureRangeFromNoteRange(detail, [4, 4])).toEqual([3, 3]);
  });
  test('clamps out-of-bounds indices', () => {
    expect(measureRangeFromNoteRange(detail, [0, 99])).toEqual([1, 3]);
  });
  test('returns null when there are no notes', () => {
    expect(measureRangeFromNoteRange({ voices: [{ pitch: [], measureIndex: [] }] }, [0, 0])).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-render.test.js`
Expected: FAIL — `Cannot find module './music-render.js'`.

- [ ] **Step 3: Create `music-render.js` with the helper**

Create `public/music-render.js`:

```js
// public/music-render.js
// Rendering for the music study app: pure measure-mapping helpers (TDD) +
// a thin OSMD wrapper (injectable factory) for whole-piece / segment rendering.
import { primaryVoice } from './music-encoding.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Map a primary-voice note-index range to a 1-based [startMeasure, endMeasure].
export function measureRangeFromNoteRange(detail, noteRange) {
  const v = primaryVoice(detail);
  const n = v.pitch.length;
  if (!n) return null;
  const lo = clamp(noteRange[0], 0, n - 1);
  const hi = clamp(noteRange[1], 0, n - 1);
  return [v.measureIndex[lo], v.measureIndex[hi]];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest public/music-render.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/music-render.js public/music-render.test.js
git commit -m "feat(music): measureRangeFromNoteRange (M2 Phase 2)"
```

---

## Task 2: `collapsedChordSpans` (pure) + contract-pinning test

**Files:**
- Modify: `public/music-render.js`
- Modify: `public/music-render.test.js`

Reconstruct the index's collapsed chord list WITH measure spans, replicating `buildIndexEntry`'s walk (all voices in order, push a non-empty `chordSymbol` only when it differs from the previous pushed symbol). Each span: `{ symbol, measureStart, measureEnd }`. A pinning test asserts the symbol sequence equals `buildIndexEntry(doc).search.chords` for the same doc, so the two can't drift.

- [ ] **Step 1: Write the failing test**

Add to `public/music-render.test.js`:

```js
import { collapsedChordSpans } from './music-render.js';
import { encodeMusicXml, inferChords } from './music-encoding.js';
import { buildIndexEntry } from './music-index.js';

describe('collapsedChordSpans', () => {
  test('collapses consecutive duplicate chords and tracks measure spans', () => {
    const d = {
      voices: [{
        pitch: [1, 2, 3, 4, 5],
        chordSymbol: ['C', 'C', 'G', 'G', 'Am'],
        measureIndex: [1, 1, 2, 2, 3],
        interval: [], sargam: [], duration: [], lyric: []
      }]
    };
    expect(collapsedChordSpans(d)).toEqual([
      { symbol: 'C', measureStart: 1, measureEnd: 1 },
      { symbol: 'G', measureStart: 2, measureEnd: 2 },
      { symbol: 'Am', measureStart: 3, measureEnd: 3 }
    ]);
  });
  test('skips null chord slots', () => {
    const d = {
      voices: [{
        pitch: [1, 2, 3],
        chordSymbol: [null, 'C', null],
        measureIndex: [1, 1, 2],
        interval: [], sargam: [], duration: [], lyric: []
      }]
    };
    expect(collapsedChordSpans(d).map(s => s.symbol)).toEqual(['C']);
  });
});
```

Add a pinning test in the same file (guarded on the real Chopin fixture so it skips when absent — mirror the existing M1 integration test style by reading the fixture and setting `global.$`):

```js
import fs from 'fs';
import jQuery from 'jquery';

const CHOPIN = '/Users/satyendra.kumar/Documents/MuseScore3/Scores/Chopin_Nocturne_Op.9_No.2_for_Solo_Guitar.xml';
const haveChopin = (() => { try { return fs.existsSync(CHOPIN); } catch (_) { return false; } })();

(haveChopin ? describe : describe.skip)('collapsedChordSpans pins buildIndexEntry collapse', () => {
  beforeAll(() => { global.$ = global.jQuery = jQuery; });
  test('symbol sequence matches search.chords on real data', () => {
    const xml = fs.readFileSync(CHOPIN, 'utf8');
    const doc = inferChords(encodeMusicXml(xml, { id: 'chopin', system: 'western' }));
    const entry = buildIndexEntry(doc, xml);
    const spans = collapsedChordSpans(doc);   // doc has the same voices a detail does
    expect(spans.map(s => s.symbol).join(' ')).toBe(entry.search.chords);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-render.test.js -t "collapsedChordSpans"`
Expected: FAIL — `collapsedChordSpans` not exported.

- [ ] **Step 3: Implement `collapsedChordSpans`**

Add to `public/music-render.js`:

```js
// Reconstruct the index's collapsed chord list with measure spans. Replicates
// buildIndexEntry's walk (all voices in order; push a non-empty chordSymbol only when
// it differs from the previously pushed one) so Phase-1 chord-range indices line up.
// Measure spans are best-effort: for multi-voice pieces buildIndexEntry concatenates
// voices, so a span may carry the measures of its first occurrence — adequate for
// locating the segment, and pinned to the index by a test.
export function collapsedChordSpans(detail) {
  const spans = [];
  (detail.voices || []).forEach(v => {
    (v.chordSymbol || []).forEach((c, i) => {
      if (!c) return;
      const meas = v.measureIndex[i];
      const last = spans[spans.length - 1];
      if (last && last.symbol === c) {
        if (meas > last.measureEnd) last.measureEnd = meas;
      } else {
        spans.push({ symbol: c, measureStart: meas, measureEnd: meas });
      }
    });
  });
  return spans;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest public/music-render.test.js -t "collapsedChordSpans"`
Expected: PASS (the real-fixture pinning test runs if the Chopin file is present, else skips).

- [ ] **Step 5: Commit**

```bash
git add public/music-render.js public/music-render.test.js
git commit -m "feat(music): collapsedChordSpans + index-collapse pinning test (M2 Phase 2)"
```

---

## Task 3: `measureRangeFromChordMatch` (pure)

**Files:**
- Modify: `public/music-render.js`
- Modify: `public/music-render.test.js`

Convert a Phase-1 chord match (`match.range` = `[startChordIdx, endChordIdx]` into the collapsed list) to a measure range, using `collapsedChordSpans`. Clamp indices; return `null` if out of range or no chords.

- [ ] **Step 1: Write the failing test**

Add to `public/music-render.test.js`:

```js
import { measureRangeFromChordMatch } from './music-render.js';

describe('measureRangeFromChordMatch', () => {
  const detail = {
    voices: [{
      pitch: [1, 2, 3, 4, 5, 6],
      chordSymbol: ['C', 'C', 'G', 'Am', 'Am', 'F'],
      measureIndex: [1, 1, 2, 3, 3, 4],
      interval: [], sargam: [], duration: [], lyric: []
    }]
  };
  // collapsed: [C m1-1, G m2-2, Am m3-3, F m4-4]
  test('maps a chord-index range to a measure range', () => {
    expect(measureRangeFromChordMatch(detail, [0, 1])).toEqual([1, 2]);   // C..G
  });
  test('maps a single chord index', () => {
    expect(measureRangeFromChordMatch(detail, [2, 2])).toEqual([3, 3]);   // Am
  });
  test('spans across the whole progression', () => {
    expect(measureRangeFromChordMatch(detail, [0, 3])).toEqual([1, 4]);
  });
  test('returns null when no chords', () => {
    expect(measureRangeFromChordMatch({ voices: [{ chordSymbol: [], measureIndex: [] }] }, [0, 0])).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-render.test.js -t "measureRangeFromChordMatch"`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement**

Add to `public/music-render.js`:

```js
// Convert a Phase-1 chord match range (indices into the collapsed chord list) to a
// 1-based [startMeasure, endMeasure].
export function measureRangeFromChordMatch(detail, chordRange) {
  const spans = collapsedChordSpans(detail);
  if (!spans.length) return null;
  const lo = clamp(chordRange[0], 0, spans.length - 1);
  const hi = clamp(chordRange[1], 0, spans.length - 1);
  return [spans[lo].measureStart, spans[hi].measureEnd];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest public/music-render.test.js -t "measureRangeFromChordMatch"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/music-render.js public/music-render.test.js
git commit -m "feat(music): measureRangeFromChordMatch (M2 Phase 2)"
```

---

## Task 4: `responsiveZoom` (pure)

**Files:**
- Modify: `public/music-render.js`
- Modify: `public/music-render.test.js`

Compute an OSMD zoom factor from viewport width so the score fits without horizontal scroll. Linear from a baseline, clamped to `[0.4, 1.0]`.

- [ ] **Step 1: Write the failing test**

Add to `public/music-render.test.js`:

```js
import { responsiveZoom } from './music-render.js';

describe('responsiveZoom', () => {
  test('full zoom at/above the baseline width', () => {
    expect(responsiveZoom(900)).toBeCloseTo(1.0);
    expect(responsiveZoom(1800)).toBeCloseTo(1.0);   // clamped
  });
  test('scales down on narrower viewports', () => {
    expect(responsiveZoom(450)).toBeCloseTo(0.5);
  });
  test('clamps to a 0.4 floor on very narrow viewports', () => {
    expect(responsiveZoom(200)).toBeCloseTo(0.4);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-render.test.js -t "responsiveZoom"`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement**

Add to `public/music-render.js`:

```js
// OSMD zoom factor from viewport width: 1.0 at >= BASELINE px, scaling down to a 0.4 floor.
const ZOOM_BASELINE_PX = 900;
export function responsiveZoom(viewportWidth) {
  return clamp(viewportWidth / ZOOM_BASELINE_PX, 0.4, 1.0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest public/music-render.test.js -t "responsiveZoom"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/music-render.js public/music-render.test.js
git commit -m "feat(music): responsiveZoom helper (M2 Phase 2)"
```

---

## Task 5: `createMusicRenderer` — OSMD wrapper (injectable factory, contract-tested)

**Files:**
- Modify: `public/music-render.js`
- Modify: `public/music-render.test.js`

A thin wrapper over OSMD. It takes an **injectable `osmdFactory`** (default: construct the global `opensheetmusicdisplay.OpenSheetMusicDisplay`) so the call contract is unit-testable with a spy. Methods: `loadDetail(detail)` (async; only `format:'musicxml'`), `showFull()`, `showSegment([startM,endM])`, `setZoom(factor)`, `applyResponsiveZoom(width)`.

- [ ] **Step 1: Write the failing test**

Add to `public/music-render.test.js`:

```js
import { createMusicRenderer } from './music-render.js';

// Minimal fake OSMD that records calls.
function fakeOsmd() {
  return {
    calls: [],
    Zoom: 1.0,
    Sheet: { SourceMeasures: [{}, {}, {}, {}] },  // 4 measures
    setOptions(o) { this.calls.push(['setOptions', o]); },
    load(src) { this.calls.push(['load', src]); return Promise.resolve(); },
    render() { this.calls.push(['render']); }
  };
}

describe('createMusicRenderer', () => {
  test('initialises OSMD with svg/compact options', () => {
    const osmd = fakeOsmd();
    createMusicRenderer({}, { osmdFactory: () => osmd });
    expect(osmd.calls.find(c => c[0] === 'setOptions' && c[1].backend === 'svg')).toBeTruthy();
  });

  test('loadDetail loads musicxml source, renders, reports total measures', async () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    const res = await r.loadDetail({ format: 'musicxml', source: '<xml/>' });
    expect(res).toEqual({ ok: true, totalMeasures: 4 });
    expect(osmd.calls.some(c => c[0] === 'load' && c[1] === '<xml/>')).toBe(true);
    expect(osmd.calls.some(c => c[0] === 'render')).toBe(true);
  });

  test('loadDetail refuses note-text pieces', async () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    const res = await r.loadDetail({ format: 'note-text', source: 'C D E' });
    expect(res).toEqual({ ok: false, reason: 'not-musicxml' });
    expect(osmd.calls.some(c => c[0] === 'load')).toBe(false);
  });

  test('showSegment sets the measure window and re-renders', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.showSegment([2, 3]);
    const opt = osmd.calls.filter(c => c[0] === 'setOptions').pop()[1];
    expect(opt.drawFromMeasureNumber).toBe(2);
    expect(opt.drawUpToMeasureNumber).toBe(3);
    expect(osmd.calls.some(c => c[0] === 'render')).toBe(true);
  });

  test('showFull resets the measure window from measure 1', async () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    await r.loadDetail({ format: 'musicxml', source: '<xml/>' });   // sets totalMeasures=4
    r.showFull();
    const opt = osmd.calls.filter(c => c[0] === 'setOptions').pop()[1];
    expect(opt.drawFromMeasureNumber).toBe(1);
    expect(opt.drawUpToMeasureNumber).toBe(4);
  });

  test('setZoom sets OSMD Zoom and re-renders', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.setZoom(0.5);
    expect(osmd.Zoom).toBe(0.5);
    expect(osmd.calls.some(c => c[0] === 'render')).toBe(true);
  });

  test('applyResponsiveZoom derives zoom from viewport width', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.applyResponsiveZoom(450);
    expect(osmd.Zoom).toBeCloseTo(0.5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-render.test.js -t "createMusicRenderer"`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement the wrapper**

Add to `public/music-render.js`:

```js
// Thin OSMD wrapper. opts.osmdFactory(container) lets tests inject a spy; in the browser
// it defaults to the global OpenSheetMusicDisplay. Visual output is browser-verified;
// this wrapper's method/argument contract is unit-tested via an injected fake.
export function createMusicRenderer(container, opts = {}) {
  const factory = opts.osmdFactory || ((c) => new opensheetmusicdisplay.OpenSheetMusicDisplay(c));
  const osmd = factory(container);
  osmd.setOptions({ backend: 'svg', drawingParameters: 'compacttight', drawTitle: false });
  let totalMeasures = 0;

  return {
    osmd,
    async loadDetail(detail) {
      if (!detail || detail.format !== 'musicxml' || !detail.source) {
        return { ok: false, reason: 'not-musicxml' };
      }
      await osmd.load(detail.source);
      osmd.render();
      totalMeasures = (osmd.Sheet && osmd.Sheet.SourceMeasures && osmd.Sheet.SourceMeasures.length) || 0;
      return { ok: true, totalMeasures };
    },
    showFull() {
      osmd.setOptions({ drawFromMeasureNumber: 1, drawUpToMeasureNumber: totalMeasures || Number.MAX_SAFE_INTEGER });
      osmd.render();
    },
    showSegment(measureRange) {
      osmd.setOptions({ drawFromMeasureNumber: measureRange[0], drawUpToMeasureNumber: measureRange[1] });
      osmd.render();
    },
    setZoom(factor) { osmd.Zoom = factor; osmd.render(); },
    applyResponsiveZoom(viewportWidth) { this.setZoom(responsiveZoom(viewportWidth)); }
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest public/music-render.test.js -t "createMusicRenderer"`
Expected: PASS. Then run the whole file `npx jest public/music-render.test.js` to confirm Tasks 1-4 still green.

- [ ] **Step 5: Commit**

```bash
git add public/music-render.js public/music-render.test.js
git commit -m "feat(music): createMusicRenderer OSMD wrapper (contract-tested) (M2 Phase 2)"
```

---

## Task 6: Minimal "Preview" surface in `music.html` (in-browser verification)

**Files:**
- Modify: `public/music.html`

Add a minimal preview so rendering is verifiable in a real browser: load the vendored OSMD, add a hidden `#musicPreview` container with a measure-range input, and a "Preview" button on each piece row that fetches the piece's Tier-2 detail and renders it. This is intentionally minimal — the full Layout-C search/detail UI is Plan 6.

- [ ] **Step 1: Add the OSMD vendor script**

In `public/music.html`, after the `<script src="/github-utils.js"></script>` line (around line 8), add:

```html
    <script src="/vendor/opensheetmusicdisplay.min.js"></script>
```

- [ ] **Step 2: Add the preview container markup**

In `public/music.html`, immediately after `<div id="pieceList"></div>` (around line 148), add:

```html
<div id="musicPreview" style="display:none;margin-top:1rem;border-top:1px solid #ddd;padding-top:1rem">
  <div style="margin-bottom:.5rem">
    <strong id="previewTitle"></strong>
    <button id="previewFullBtn">Full</button>
    <label>Segment measures
      <input id="segFrom" type="number" min="1" style="width:4em" placeholder="from">–
      <input id="segTo" type="number" min="1" style="width:4em" placeholder="to">
    </label>
    <button id="previewSegBtn">Show segment</button>
    <button id="previewCloseBtn">Close</button>
    <span id="previewMsg"></span>
  </div>
  <div id="osmdPreview"></div>
</div>
```

- [ ] **Step 3: Wire the preview into the module script**

In `public/music.html`, change the import line (around line 151) from:

```js
  import { getSystemFromUrl, getMusicResourceUrl, loadIndex, rebuildAndPush } from './music-index.js';
```

to:

```js
  import { getSystemFromUrl, getMusicResourceUrl, loadIndex, rebuildAndPush } from './music-index.js';
  import { createMusicRenderer } from './music-render.js';
```

Then change the `render()` function's index-row template (around lines 167-168) from:

```js
    index.forEach(e => rows.push(
      `<label style="display:block"><input type="checkbox" class="sel" data-id="${e.id}"> ${e.title || e.id} <small>(${e.noteCount} notes, ${e.channels.join('/')})</small></label>`));
```

to:

```js
    index.forEach(e => rows.push(
      `<label style="display:block"><input type="checkbox" class="sel" data-id="${e.id}"> ${e.title || e.id} <small>(${e.noteCount} notes, ${e.channels.join('/')})</small> <button class="previewBtn" data-id="${e.id}">Preview</button></label>`));
```

Then add this preview logic immediately before the final IIFE (`(async () => { ... })();` around line 219):

```js
  let renderer = null;
  function ensureRenderer() {
    if (!renderer) renderer = createMusicRenderer(document.getElementById('osmdPreview'));
    return renderer;
  }
  async function openPreview(id) {
    const title = (index.find(e => e.id === id) || {}).title || id;
    document.getElementById('previewTitle').textContent = title;
    document.getElementById('previewMsg').textContent = 'Loading…';
    document.getElementById('musicPreview').style.display = 'block';
    let detail;
    try {
      detail = await fetch(`${getMusicResourceUrl(system)}/details/${id}.json`).then(x => x.json());
    } catch (e) { document.getElementById('previewMsg').textContent = 'Failed to load detail.'; return; }
    const res = await ensureRenderer().loadDetail(detail);
    if (!res.ok) { document.getElementById('previewMsg').textContent = 'Cannot render (note-text piece).'; return; }
    renderer.applyResponsiveZoom(document.getElementById('osmdPreview').clientWidth || window.innerWidth);
    renderer.showFull();
    document.getElementById('previewMsg').textContent = `${res.totalMeasures} measures`;
  }
  document.getElementById('pieceList').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.previewBtn');
    if (btn) { ev.preventDefault(); openPreview(btn.dataset.id); }
  });
  document.getElementById('previewFullBtn').onclick = () => renderer && renderer.showFull();
  document.getElementById('previewSegBtn').onclick = () => {
    const from = parseInt(document.getElementById('segFrom').value, 10);
    const to = parseInt(document.getElementById('segTo').value, 10);
    if (renderer && Number.isFinite(from) && Number.isFinite(to)) renderer.showSegment([from, to]);
  };
  document.getElementById('previewCloseBtn').onclick = () => { document.getElementById('musicPreview').style.display = 'none'; };
```

- [ ] **Step 4: Manual browser verification (no automated test — OSMD needs a real DOM)**

Run the app's dev server (the project's usual command, e.g. `npx vue-cli-service serve`), open `http://localhost:<port>/music.html?system=western`, and verify:
1. The page loads without console errors and the piece list shows a **Preview** button per indexed piece.
2. Clicking **Preview** on a **MusicXML** piece renders its full score in `#osmdPreview` and shows the measure count.
3. Entering `from`/`to` (e.g. 3 / 6) and clicking **Show segment** redraws only those measures.
4. **Full** restores the whole score.
5. Narrowing the browser window and re-previewing fits the score width (responsive zoom) without horizontal page scroll.
6. Clicking **Preview** on a **note-text** piece shows "Cannot render (note-text piece)."

Record the outcome in the commit message / report. (Requires the gh-pages index + at least one pushed MusicXML detail; if none is pushed yet, push one via the Manager's Rebuild first, or load a local MusicXML file.)

- [ ] **Step 5: Commit**

```bash
git add public/music.html
git commit -m "feat(music): minimal OSMD preview surface in music.html (M2 Phase 2)"
```

---

## Done criteria for this plan

- `public/music-render.js` exports `measureRangeFromNoteRange`, `collapsedChordSpans`, `measureRangeFromChordMatch`, `responsiveZoom`, `createMusicRenderer`.
- The pure helpers convert Phase-1 melody note-ranges and chord-ranges into 1-based measure ranges; `collapsedChordSpans` is pinned to `buildIndexEntry`'s collapse by a real-fixture test.
- `createMusicRenderer` loads a MusicXML detail, renders whole-piece and measure-range segments, and applies responsive zoom — its call contract verified via an injected fake OSMD; note-text details are refused cleanly.
- `music.html` has a working in-browser Preview (full + segment + responsive), verified manually.
- `npx jest public/music-render.test.js` green; `npx jest public/` shows no new failures (the one pre-existing `music_search.test.js` "Too large jump" failure remains, unrelated).

## Follow-on plans (not this plan)

- **M2 Plan 3 — Playback (Phase 3):** vendor Tone.js, `buildSchedule` from detail voices (reads `meta.tempo`), transport + OSMD cursor, YouTube IFrame control.
- **M2 Plan 4 — Media-linking (Phase 4):** `music-media.js`, `guessSegmentStart`, link YouTube + push via GitHubUtils.
- **M2 Plan 5 — Capture (Phase 5):** `music-vocab.js`, `buildVocabEntry`, `vocab.json` load/save.
- **M2 Plan 6 — UI (Layout C):** assemble the search/detail screens wiring search + render + play + media + capture (this is where the visual companion / mockups add the most value).
