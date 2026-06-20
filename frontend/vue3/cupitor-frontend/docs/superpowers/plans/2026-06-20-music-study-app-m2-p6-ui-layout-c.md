# Music Study App — M2 Plan 6: UI / Layout C (`music.html`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assemble the five M2 modules into the master→detail study app: a search view (chord chip-builder + melody note-picker + flexibility controls + results list) beside a focused detail view (the existing render/transport/media/vocab pane), with the M1 Manager tucked into a collapsible section; responsive (side-by-side on desktop, stacked on mobile).

**Architecture:** Two small pure helpers — `music-search-ui.js` (UI-state → `music-query.js` query JSON + a result-row summary) and `resolveMatchMeasures` in `music-render.js` (dispatch a result's match → measure range) — are TDD'd. The rest is DOM glue in `music.html`: it builds queries, calls the already-built `runQuery`, lists results, and on selection reuses the existing `openPreview` detail pane (render + transport + media + vocab) showing the matched segment.

**Tech Stack:** Vanilla ES modules; reuses `runQuery` (`music-query.js`), `resolveMatchMeasures`/`createMusicRenderer` (`music-render.js`), and the detail-pane wiring already in `music.html`; Jest + jsdom + Babel for the pure helpers; CSS flexbox for the responsive layout.

**Spec:** `docs/superpowers/specs/2026-06-20-music-study-app-m2-rendering-search-design.md` §9 (UI Layout C), decisions 1 (master→detail), 2 (chord chip-builder), and the melody note-picker (resolved review item 2).

**Test runner:** `npx jest public/<file>.test.js`.

**Grounded facts:**
- `runQuery(queryJSON, entries)` (`music-query.js`) takes the raw query JSON and the Tier-1 entries (each with `.id`, `.system`, `.search`), returns `[{ pieceId, system, type, score, match }]` sorted by score; `match` is `{ kind:'note', range:[startNoteIdx,endNoteIdx] }` or `{ kind:'chord', range:[startChordIdx,endChordIdx], symbols:[...] }`. It validates internally and **throws** on an invalid query.
- Chord query JSON: `{ type:'chord', chords:[{chord:'C', extensions_allowed:['add9']}], strict_extensions, max_gap, transpose_invariant, max_results }`. Melody: `{ type:'melody', notes:['C','.','E'], search_by_interval, pitch_tolerance, max_results }`.
- Chord/note tokens use **sharp** spellings accepted by `pitchClass`: `C C# D D# E F F# G G# A A# B`. Base qualities map to symbol suffixes: maj→`""`, min→`"m"`, dim→`"dim"`, aug→`"aug"`. Canonical extension tokens: `add9, 7, maj7, 6, 9, sus4`.
- `music-render.js` exports `measureRangeFromNoteRange(detail, noteRange)` and `measureRangeFromChordMatch(detail, chordRange)` (both → `[startMeasure, endMeasure]` or null).
- `music.html` already has: `index` (merged Tier-1 entries with `.search`), `openPreview(id)` (async; fetches detail, renders OSMD, sets module-level `currentDetail` on success, `showFull()`), `renderer` (with `showSegment([from,to])`), `#segFrom`/`#segTo`, and the transport/media/vocab handlers. The Manager UI is `.controls` + `#textInput` + `#pieceList`.
- **Note-text pieces** can't render in OSMD, so a note-text search result opens the detail pane to "Cannot render (note-text piece)" (notation/transport are MusicXML-only — a documented, pre-existing limitation; the result still appears in the list).
- `allow_passing`/`allow_repetition` are reserved/not consumed — the melody UI must NOT expose them (per spec deferral §12).

**Test economy (standing instruction):** TDD the two pure helpers only; the DOM is browser-verified (`node --check` + id-check + manual). No tests for the chip-builder/results DOM.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `public/music-search-ui.js` | Pure `buildChordQuery`, `buildMelodyQuery`, `matchSummary`. |
| Create | `public/music-search-ui.test.js` | Tests for the three pure helpers. |
| Modify | `public/music-render.js` | Add pure `resolveMatchMeasures(detail, match)`. |
| Modify | `public/music-render.test.js` | Test `resolveMatchMeasures` dispatch. |
| Modify | `public/music.html` | Layout C: search view (chip-builder + note-picker + controls + results), Manager collapsed into `<details>`, result→detail wiring, responsive CSS. |

---

## Task 1: Pure search-UI helpers (`music-search-ui.js`)

**Files:** Create `public/music-search-ui.js`, create `public/music-search-ui.test.js`.

- [ ] **Step 1: Write the failing test** — create `public/music-search-ui.test.js`:

```js
// public/music-search-ui.test.js
import { buildChordQuery, buildMelodyQuery, matchSummary } from './music-search-ui.js';

describe('buildChordQuery', () => {
  test('maps chips (root+quality+extensions) to chord query JSON with opts', () => {
    const q = buildChordQuery(
      [{ root: 'C', quality: 'maj', extensions: ['add9'] }, { root: 'A', quality: 'min', extensions: [] }],
      { strict_extensions: true, max_gap: 2, transpose_invariant: true, max_results: 10 }
    );
    expect(q).toEqual({
      type: 'chord',
      chords: [{ chord: 'C', extensions_allowed: ['add9'] }, { chord: 'Am', extensions_allowed: [] }],
      strict_extensions: true, max_gap: 2, transpose_invariant: true, max_results: 10,
    });
  });

  test('quality suffixes + defaults (no opts → contiguous, lenient, no transpose, no cap)', () => {
    const q = buildChordQuery([{ root: 'G', quality: 'dim', extensions: [] }, { root: 'F', quality: 'aug', extensions: [] }]);
    expect(q.chords.map(c => c.chord)).toEqual(['Gdim', 'Faug']);
    expect(q.strict_extensions).toBe(false);
    expect(q.max_gap).toBe(0);
    expect(q.transpose_invariant).toBe(false);
    expect(q.max_results).toBeUndefined();
  });
});

describe('buildMelodyQuery', () => {
  test('passes tokens through with interval/tolerance/max_results opts', () => {
    const q = buildMelodyQuery(['C', '.', 'E', 'G'], { search_by_interval: true, pitch_tolerance: 1, max_results: 5 });
    expect(q).toEqual({ type: 'melody', notes: ['C', '.', 'E', 'G'], search_by_interval: true, pitch_tolerance: 1, max_results: 5 });
  });
  test('defaults: literal pitch-class match, zero tolerance, no cap', () => {
    const q = buildMelodyQuery(['C', 'E']);
    expect(q).toEqual({ type: 'melody', notes: ['C', 'E'], search_by_interval: false, pitch_tolerance: 0, max_results: undefined });
  });
});

describe('matchSummary', () => {
  test('chord result summarises matched symbols + score', () => {
    const s = matchSummary({ score: 0.8, match: { kind: 'chord', range: [0, 1], symbols: ['C', 'G7'] } });
    expect(s).toContain('C G7');
    expect(s).toContain('0.80');
  });
  test('note result summarises matched count + score', () => {
    const s = matchSummary({ score: 1, match: { kind: 'note', range: [2, 6] } });
    expect(s).toContain('5 notes');
    expect(s).toContain('1.00');
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx jest public/music-search-ui.test.js` → module not found.

- [ ] **Step 3: Implement** — create `public/music-search-ui.js`:

```js
// public/music-search-ui.js
// Pure helpers: turn the search UI's state into music-query.js query JSON, and format a
// result row. The DOM lives in music.html; these are unit-tested.

// Base-quality → chord-symbol suffix (matches normaliseChordName conventions).
const QUALITY_SUFFIX = { maj: '', min: 'm', dim: 'dim', aug: 'aug' };

const cap = (v) => (Number.isFinite(v) && v > 0) ? Math.floor(v) : undefined;

// chips: [{ root, quality, extensions:[...] }] → chord query JSON for runQuery.
export function buildChordQuery(chips, opts = {}) {
  return {
    type: 'chord',
    chords: (chips || []).map(c => ({
      chord: `${c.root}${QUALITY_SUFFIX[c.quality] || ''}`,
      extensions_allowed: Array.isArray(c.extensions) ? c.extensions.slice() : [],
    })),
    strict_extensions: opts.strict_extensions === true,
    max_gap: Number.isFinite(opts.max_gap) ? opts.max_gap : 0,
    transpose_invariant: opts.transpose_invariant === true,
    max_results: cap(opts.max_results),
  };
}

// tokens: array of note strings / '.' → melody query JSON for runQuery.
export function buildMelodyQuery(tokens, opts = {}) {
  return {
    type: 'melody',
    notes: (tokens || []).slice(),
    search_by_interval: opts.search_by_interval === true,
    pitch_tolerance: Number.isFinite(opts.pitch_tolerance) ? opts.pitch_tolerance : 0,
    max_results: cap(opts.max_results),
  };
}

// One-line human summary of a result for the results list.
export function matchSummary(result) {
  const m = result && result.match;
  if (!m) return '';
  const score = typeof result.score === 'number' ? ` · score ${result.score.toFixed(2)}` : '';
  if (m.kind === 'chord') return `chords: ${(m.symbols || []).join(' ')}${score}`;
  const n = m.range[1] - m.range[0] + 1;
  return `${n} note${n === 1 ? '' : 's'} matched${score}`;
}
```

- [ ] **Step 4: Run, verify PASS** — `npx jest public/music-search-ui.test.js` → 6 tests.

- [ ] **Step 5: Commit**

```bash
git add public/music-search-ui.js public/music-search-ui.test.js
git commit -m "feat(music): pure search-UI helpers (query builders + result summary)"
```

---

## Task 2: `resolveMatchMeasures` (`music-render.js`)

**Files:** Modify `public/music-render.js`, modify `public/music-render.test.js`.

- [ ] **Step 1: Write the failing test** — APPEND to `public/music-render.test.js` (and add `resolveMatchMeasures` to the existing `./music-render.js` import lines at the top):

```js
describe('resolveMatchMeasures', () => {
  const detail = {
    meta: { id: 'x', format: 'musicxml' }, format: 'musicxml',
    voices: [{
      pitch: [60, 62, 64, 65], interval: [], sargam: [], duration: [],
      chordSymbol: ['C', 'C', 'G', 'G'], lyric: [], measureIndex: [1, 1, 2, 2],
    }],
  };
  test('note match → measure range via note indices', () => {
    expect(resolveMatchMeasures(detail, { kind: 'note', range: [0, 2] })).toEqual([1, 2]);
  });
  test('chord match → measure range via collapsed chord spans', () => {
    expect(resolveMatchMeasures(detail, { kind: 'chord', range: [0, 1], symbols: ['C', 'G'] })).toEqual([1, 2]);
  });
  test('null match → null', () => {
    expect(resolveMatchMeasures(detail, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx jest public/music-render.test.js -t resolveMatchMeasures`.

- [ ] **Step 3: Implement** — add to `public/music-render.js` (after `measureRangeFromChordMatch`):

```js
// Map a query result's match to a 1-based measure range, dispatching on match.kind.
export function resolveMatchMeasures(detail, match) {
  if (!detail || !match) return null;
  if (match.kind === 'chord') return measureRangeFromChordMatch(detail, match.range);
  return measureRangeFromNoteRange(detail, match.range);
}
```

- [ ] **Step 4: Run, verify PASS** — `npx jest public/music-render.test.js` → all pass (3 new + existing).

- [ ] **Step 5: Commit**

```bash
git add public/music-render.js public/music-render.test.js
git commit -m "feat(music): resolveMatchMeasures — dispatch a query match to a measure range"
```

---

## Task 3: Layout C scaffold in `music.html` (HTML + CSS)

**Files:** Modify `public/music.html`. No unit tests; verify with `node --check` (the body is HTML, so this task's check is the id-existence check below + the full suite).

Read `public/music.html` first to confirm snippets.

- [ ] **Step 1: Add responsive layout CSS** — inside the `<style>` block, before its closing `</style>`, add:

```css
        #appLayout { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-start; }
        #searchView { flex: 1 1 320px; min-width: 280px; }
        #musicPreview { flex: 2 1 460px; min-width: 280px; }
        #results .resultRow { padding: 6px 8px; border: 1px solid #ddd; border-radius: 6px; margin: 4px 0; cursor: pointer; }
        #results .resultRow:hover { background: #f3f3f3; }
        .chordChip { display: inline-flex; gap: 4px; align-items: center; border: 1px solid #ccc; border-radius: 6px; padding: 4px 6px; margin: 2px; }
        .extPill { border: 1px solid #bbb; border-radius: 10px; padding: 0 8px; cursor: pointer; background: #fff; }
        .extPill.active { background: #2563eb; color: #fff; border-color: #2563eb; }
        #managerSection { margin-bottom: 1rem; }
        #managerSection > summary { cursor: pointer; font-weight: 600; }
```

- [ ] **Step 2: Wrap the Manager controls in a collapsible section**

FIND:
```
<div class="controls">
  <button id="addXmlBtn">Add MusicXML…</button>
  <input type="file" id="xmlFile" accept=".xml,.musicxml,application/xml,text/xml" style="display:none" multiple>
  <button id="addTextBtn">Add note-text…</button>
  <button id="rebuildBtn">Rebuild &amp; Push selected/new</button>
  <button id="retryBtn" style="display:none"></button>
  <span id="status"></span>
</div>
<textarea id="textInput" placeholder="Paste note-text, first line = title" style="display:none;width:100%;height:6em"></textarea>
<div id="pieceList"></div>
```
REPLACE:
```
<details id="managerSection">
  <summary>Manage library (add / rebuild / push pieces)</summary>
  <div class="controls">
    <button id="addXmlBtn">Add MusicXML…</button>
    <input type="file" id="xmlFile" accept=".xml,.musicxml,application/xml,text/xml" style="display:none" multiple>
    <button id="addTextBtn">Add note-text…</button>
    <button id="rebuildBtn">Rebuild &amp; Push selected/new</button>
    <button id="retryBtn" style="display:none"></button>
    <span id="status"></span>
  </div>
  <textarea id="textInput" placeholder="Paste note-text, first line = title" style="display:none;width:100%;height:6em"></textarea>
  <div id="pieceList"></div>
</details>
```

- [ ] **Step 3: Add the app layout + search view around the detail pane**

FIND:
```
<div id="musicPreview" style="display:none;margin-top:1rem;border-top:1px solid #ddd;padding-top:1rem">
```
REPLACE:
```
<div id="appLayout">
  <div id="searchView">
    <div id="searchPanel">
      <div>
        <label><input type="radio" name="searchMode" value="chord" checked> Chord</label>
        <label><input type="radio" name="searchMode" value="melody"> Melody</label>
      </div>
      <div id="chordMode">
        <div id="chips"></div>
        <button id="addChipBtn">+ Add chord</button>
        <div>
          <label><input type="checkbox" id="strictExt"> strict extensions</label>
          <label>max gap <input id="maxGap" type="number" min="0" value="0" style="width:3em"></label>
          <label><input type="checkbox" id="transposeInv"> transpose-invariant</label>
        </div>
      </div>
      <div id="melodyMode" style="display:none">
        <div id="noteButtons"></div>
        <input id="melodyTokens" type="text" placeholder="C . . E G" style="width:16em">
        <div>
          <label><input type="checkbox" id="byInterval"> by interval</label>
          <label>tolerance <input id="pitchTol" type="number" min="0" value="0" style="width:3em"></label>
        </div>
      </div>
      <div>
        <label>max results <input id="maxResults" type="number" min="1" value="20" style="width:4em"></label>
        <button id="searchBtn">Search</button>
        <span id="searchMsg"></span>
      </div>
    </div>
    <div id="results"></div>
  </div>
<div id="musicPreview" style="display:none;border-top:1px solid #ddd;padding-top:1rem">
```

- [ ] **Step 4: Close the app layout after the detail pane**

FIND:
```
  <div id="osmdPreview"></div>
  <div id="ytPlayer" style="display:none"></div>
</div>

<script type="module">
```
REPLACE:
```
  <div id="osmdPreview"></div>
  <div id="ytPlayer" style="display:none"></div>
</div>
</div>

<script type="module">
```

- [ ] **Step 5: Confirm the new ids exist and the structure is balanced**

Run:
```bash
for id in managerSection appLayout searchView searchPanel chordMode melodyMode chips addChipBtn strictExt maxGap transposeInv noteButtons melodyTokens byInterval pitchTol maxResults searchBtn searchMsg results; do grep -q "id=\"$id\"" public/music.html && echo "$id OK" || echo "$id MISSING"; done
node -e "const h=require('fs').readFileSync('public/music.html','utf8');const o=(h.match(/<div/g)||[]).length,c=(h.match(/<\/div>/g)||[]).length;console.log('div open',o,'close',c, o===c?'BALANCED':'IMBALANCED')"
```
Expected: all ids OK; `div open N close N BALANCED`.

- [ ] **Step 6: Commit**

```bash
git add public/music.html
git commit -m "feat(music): Layout C scaffold — search view + collapsible Manager + responsive flex (M2 Phase 6)"
```

---

## Task 4: Wire search → results → detail in `music.html` (JS)

**Files:** Modify `public/music.html`. No unit tests; verify with `node --check`, id-check, full suite, manual.

- [ ] **Step 1: Extend imports**

FIND:
```
  import { getSystemFromUrl, getMusicResourceUrl, loadLibrary, rebuildAndPush, retryPush } from './music-index.js';
  import { createMusicRenderer } from './music-render.js';
```
REPLACE:
```
  import { getSystemFromUrl, getMusicResourceUrl, loadLibrary, rebuildAndPush, retryPush } from './music-index.js';
  import { runQuery } from './music-query.js';
  import { createMusicRenderer, resolveMatchMeasures } from './music-render.js';
  import { buildChordQuery, buildMelodyQuery, matchSummary } from './music-search-ui.js';
```

- [ ] **Step 2: Add the search-UI builders + handlers** (insert immediately before the bootstrap IIFE — i.e. before the `(async () => {` that calls `loadLibrary`)

FIND:
```
  (async () => {
    try { const lib = await loadLibrary(system, store); index = lib.index; unpushedIds = lib.unpushedIds; }
    catch (_) { index = []; unpushedIds = new Set(); }
    try { vocab = await loadVocab(system); } catch (_) { vocab = []; }
    render(); updateRetryBtn();
  })();
```
REPLACE:
```
  // ---- Search UI (Layout C) ----
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const QUALITIES = ['maj', 'min', 'dim', 'aug'];
  const EXTENSIONS = ['add9', '7', 'maj7', '6', '9', 'sus4'];

  function addChip() {
    const chip = document.createElement('div');
    chip.className = 'chordChip';
    const rootSel = document.createElement('select');
    NOTE_NAMES.forEach(n => rootSel.add(new Option(n, n)));
    const qualSel = document.createElement('select');
    QUALITIES.forEach(q => qualSel.add(new Option(q, q)));
    chip.appendChild(rootSel);
    chip.appendChild(qualSel);
    EXTENSIONS.forEach(ext => {
      const pill = document.createElement('button');
      pill.type = 'button'; pill.className = 'extPill'; pill.textContent = ext; pill.dataset.ext = ext;
      pill.onclick = () => pill.classList.toggle('active');
      chip.appendChild(pill);
    });
    const del = document.createElement('button');
    del.type = 'button'; del.textContent = '×'; del.onclick = () => chip.remove();
    chip.appendChild(del);
    document.getElementById('chips').appendChild(chip);
  }
  function readChips() {
    return Array.from(document.querySelectorAll('#chips .chordChip')).map(chip => {
      const sels = chip.querySelectorAll('select');
      return {
        root: sels[0].value, quality: sels[1].value,
        extensions: Array.from(chip.querySelectorAll('.extPill.active')).map(p => p.dataset.ext),
      };
    });
  }
  function buildNoteButtons() {
    const box = document.getElementById('noteButtons');
    const append = (tok) => { const t = document.getElementById('melodyTokens'); t.value = (t.value ? t.value + ' ' : '') + tok; };
    [...NOTE_NAMES, '.'].forEach(tok => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = tok; b.onclick = () => append(tok);
      box.appendChild(b);
    });
    const clr = document.createElement('button');
    clr.type = 'button'; clr.textContent = 'clear'; clr.onclick = () => { document.getElementById('melodyTokens').value = ''; };
    box.appendChild(clr);
  }
  function currentMode() {
    return document.querySelector('input[name="searchMode"]:checked').value;
  }
  function maxResultsVal() {
    const n = parseInt(document.getElementById('maxResults').value, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
  function buildQuery() {
    if (currentMode() === 'chord') {
      return buildChordQuery(readChips(), {
        strict_extensions: document.getElementById('strictExt').checked,
        max_gap: parseInt(document.getElementById('maxGap').value, 10) || 0,
        transpose_invariant: document.getElementById('transposeInv').checked,
        max_results: maxResultsVal(),
      });
    }
    const tokens = document.getElementById('melodyTokens').value.trim().split(/\s+/).filter(Boolean);
    return buildMelodyQuery(tokens, {
      search_by_interval: document.getElementById('byInterval').checked,
      pitch_tolerance: parseInt(document.getElementById('pitchTol').value, 10) || 0,
      max_results: maxResultsVal(),
    });
  }
  function renderResults(results) {
    const box = document.getElementById('results');
    if (!results.length) { box.innerHTML = '<em>No matches.</em>'; return; }
    box.innerHTML = '';
    results.forEach(r => {
      const title = (index.find(e => e.id === r.pieceId) || {}).title || r.pieceId;
      const row = document.createElement('div');
      row.className = 'resultRow';
      row.innerHTML = `<strong>${title}</strong><br><small>${matchSummary(r)}</small>`;
      row.onclick = () => openResult(r);
      box.appendChild(row);
    });
  }
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
  document.querySelectorAll('input[name="searchMode"]').forEach(radio => {
    radio.onchange = () => {
      document.getElementById('chordMode').style.display = currentMode() === 'chord' ? '' : 'none';
      document.getElementById('melodyMode').style.display = currentMode() === 'melody' ? '' : 'none';
    };
  });
  document.getElementById('addChipBtn').onclick = addChip;
  document.getElementById('searchBtn').onclick = () => {
    let query;
    try { query = buildQuery(); } catch (e) { document.getElementById('searchMsg').textContent = e.message; return; }
    let results;
    try { results = runQuery(query, index); }
    catch (e) { document.getElementById('searchMsg').textContent = 'Invalid query: ' + e.message; return; }
    document.getElementById('searchMsg').textContent = `${results.length} match${results.length === 1 ? '' : 'es'}`;
    renderResults(results);
  };
  addChip();            // start with one chord chip
  buildNoteButtons();   // populate the melody note-picker

  (async () => {
    try { const lib = await loadLibrary(system, store); index = lib.index; unpushedIds = lib.unpushedIds; }
    catch (_) { index = []; unpushedIds = new Set(); }
    try { vocab = await loadVocab(system); } catch (_) { vocab = []; }
    render(); updateRetryBtn();
  })();
```

- [ ] **Step 3: Syntax-check the inline module**

Run:
```bash
F="$(node -e "const os=require('os'),p=require('path');console.log(p.join(os.tmpdir(),'music_mod_p6.mjs'))")"
node -e "const fs=require('fs');const h=fs.readFileSync('public/music.html','utf8');const m=h.match(/<script type=\"module\">([\s\S]*?)<\/script>/);fs.writeFileSync(process.argv[1],m[1]);" "$F"
node --check "$F" && echo "SYNTAX OK" && rm -f "$F"
```
Expected: `SYNTAX OK`.

- [ ] **Step 4: Full suite — no regression**

Run: `npx jest public/ 2>&1 | tail -6`
Expected: only the pre-existing `music_search.test.js` "9. Too large jump" failure.

- [ ] **Step 5: Commit**

```bash
git add public/music.html
git commit -m "feat(music): wire search → results → detail (Layout C) (M2 Phase 6)"
```

- [ ] **Step 6: Manual browser verification (human step)**

1. Open `music.html?system=western`. The search panel shows (Chord mode default) with one chord chip; the Manager is collapsed under "Manage library".
2. **Chord search:** set a chip (e.g. C maj), optionally toggle extension pills / add a second chip / set max gap; click **Search** → matching pieces list with a score summary.
3. Click a result → the detail pane renders the piece and jumps to the matched **segment** (segFrom/segTo filled); transport (Play/loop), Link YouTube + guess, and Add-to-vocab all work on it.
4. **Melody search:** switch to Melody, build `C . . E G` via the note buttons (or type), optionally check "by interval" + tolerance, **Search** → results; selecting one shows the matched note range as a segment.
5. **Responsive:** widen → search and detail sit side-by-side; narrow (mobile width) → they stack; the detail pane's **Close** acts as back-to-results.
6. **Manager still works:** expand "Manage library", Preview/Rebuild/Retry behave as before.

---

## Notes for the implementer

- **Reuse, don't duplicate:** the detail pane (render + transport + media + vocab) already exists as `#musicPreview` + `openPreview`; `openResult` just calls `openPreview` then shows the matched segment via `resolveMatchMeasures`. Do NOT rebuild the detail pane.
- **Don't expose `allow_passing`/`allow_repetition`** in the melody UI (reserved per the spec deferral).
- **Note-text results:** `openPreview` shows "Cannot render (note-text piece)" and leaves `currentDetail` null, so `openResult` returns early — expected; OSMD notation + MIDI transport remain MusicXML-only this milestone.
- **Don't disturb** the offline-cache / playback / media / vocab wiring; Task 4 only ADDS search-UI code before the bootstrap IIFE and extends the import lines.
- Keep the `index` reference shared: `runQuery(query, index)` searches the same merged Tier-1 entries the Manager loads.
