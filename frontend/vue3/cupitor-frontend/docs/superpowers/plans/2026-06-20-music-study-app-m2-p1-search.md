# Music Study App — M2 Plan 1: Encoder Tempo (Phase 0) + Search Engine (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse MusicXML `<sound tempo>` into `meta.tempo` (Phase 0), then build a pure, fully-tested client-side search engine (`music-query.js`) that runs chord and melody queries over the M1 Tier-1 index and returns ranked matches.

**Architecture:** All logic is pure and runs over the M1 index entries' `search.*` fields (no DOM, no fetch). Chord matching decomposes normalised chord symbols into `{rootPc, quality, ext}` using the M1 reference data; melody matching works octave-agnostically over `search.pitchClasses` or transposition-invariantly over `search.contour`. `runQuery(query, entries)` is the single entry point. Browser wiring (the search UI, `loadIndex`, detail fetch) is deferred to later M2 plans.

**Tech Stack:** Vanilla ES modules; Jest + jsdom (`npx jest public/<file>.test.js`, babel ESM transform via `babel.config.js`); jQuery (only for the MusicXML parse in Phase 0). Reuses M1 `music-encoding.js` (`pitchClass`, `intervalsOf`, `unpackContour`) and `music-reference-data.js` (`allChords`, `normaliseChordName`).

**Scope of this plan (Phase 0 + Phase 1 only):** Tempo parsing and the search engine. NOT in this plan: rendering (Phase 2), playback (Phase 3), media-linking (Phase 4), capture (Phase 5), and the `music.html` search UI — those are separate M2 plans written after this one lands.

**Spec:** [2026-06-20-music-study-app-m2-rendering-search-design.md](../specs/2026-06-20-music-study-app-m2-rendering-search-design.md)

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `public/music-encoding.js` | M1 encoder — add `<sound tempo>` → `meta.tempo` in `encodeMusicXml` | Modify |
| `public/music-query.js` | Pure search engine: parse/validate queries, chord decomposition + matching, melody pitch-class + interval matching, `runQuery` + scoring | Create |
| `public/music-encoding.test.js` | Add a hermetic tempo-parse unit test | Modify |
| `public/music-query.test.js` | Unit tests for all `music-query.js` exports | Create |
| `public/music-index.integration.test.js` | Add `meta.tempo` assertion + a real-fixture `runQuery` smoke test | Modify |

### Phase 1 → Phase 2 contract (note for later plans)

`runQuery` returns results with a `match` object:
- **Melody** results: `match.kind === 'note'`, `match.range = [startNoteIdx, endNoteIdx]` — indices into the primary voice's note arrays (aligned to `search.pitchClasses` / `search.contour`). Phase 2's `measureRangeFromNoteRange` converts this to measures via the Tier-2 detail's `measureIndex`.
- **Chord** results: `match.kind === 'chord'`, `match.range = [startChordIdx, endChordIdx]` (indices into the space-split `search.chords` list, which collapses consecutive duplicates) plus `match.symbols = [...]` (the matched piece symbols, in order). Phase 2 locates these symbols in the detail's full (non-collapsed) `chordSymbol[]` to derive measures.

This refines the spec's single `matchNoteRange` field (the spec §4 is updated to match). Chord positions can't be expressed as primary-voice note indices because the index's `search.chords` is duplicate-collapsed.

---

## Task 1: Phase 0 — parse `<sound tempo>` into `meta.tempo`

**Files:**
- Modify: `public/music-encoding.js` (inside `encodeMusicXml`, near the other `$xml.find(...)` metadata reads, ~lines 116-123)
- Test: `public/music-encoding.test.js` (add one test)
- Test: `public/music-index.integration.test.js` (add one assertion)

Real data: MuseScore exports `<direction><sound tempo="54"/></direction>`. The first such element in document order is the piece's initial tempo (Chopin fixture = `54`, Sor = `144`). Absent → `meta.tempo` stays `null` (note-text pieces already get `null` from `encodeNoteText`).

- [ ] **Step 1: Write the failing unit test**

Add to `public/music-encoding.test.js`:

```js
// --- Phase 0: tempo parsing (needs jQuery global for the MusicXML parse) ---
describe('encodeMusicXml tempo parsing', () => {
  beforeAll(() => { global.$ = global.jQuery = require('jquery'); });

  const xmlWith = (soundEl) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      ${soundEl}
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;

  test('reads <sound tempo> into meta.tempo as a number', () => {
    const { encodeMusicXml } = require('./music-encoding.js');
    const doc = encodeMusicXml(xmlWith('<direction><sound tempo="120"/></direction>'));
    expect(doc.meta.tempo).toBe(120);
  });

  test('parses fractional tempo', () => {
    const { encodeMusicXml } = require('./music-encoding.js');
    const doc = encodeMusicXml(xmlWith('<direction><sound tempo="42.5"/></direction>'));
    expect(doc.meta.tempo).toBe(42.5);
  });

  test('meta.tempo is null when no <sound tempo> present', () => {
    const { encodeMusicXml } = require('./music-encoding.js');
    const doc = encodeMusicXml(xmlWith(''));
    expect(doc.meta.tempo).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-encoding.test.js -t "tempo parsing"`
Expected: FAIL — the first two assert `120` / `42.5` but receive `null` (encoder currently hard-codes `tempo: null`).

- [ ] **Step 3: Implement tempo parsing**

In `public/music-encoding.js`, inside `encodeMusicXml`, add a tempo read alongside the other metadata reads. Find this block:

```js
  const instrument = $xml.find('instrument-name').first().text() ||
                     $xml.find('part-name').first().text() || null;
```

Add immediately after it:

```js
  const tempoAttr = $xml.find('sound[tempo]').first().attr('tempo');
  const tempo = (tempoAttr != null && tempoAttr !== '' && !Number.isNaN(parseFloat(tempoAttr)))
    ? parseFloat(tempoAttr)
    : null;
```

Then, in the `return` of `encodeMusicXml`, change the meta line from:

```js
      key, time, tempo: null, instrument
```

to:

```js
      key, time, tempo, instrument
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npx jest public/music-encoding.test.js -t "tempo parsing"`
Expected: PASS (3/3).

- [ ] **Step 5: Add a real-fixture assertion**

In `public/music-index.integration.test.js`, in the Chopin test (`'encodes; key from 4 sharps; channels present'`), add after the `expect(doc.meta.key).toBe('E');` line:

```js
    expect(doc.meta.tempo).toBe(54);   // Phase 0: <sound tempo="54">
```

- [ ] **Step 6: Run the full encoding + integration suites**

Run: `npx jest public/music-encoding.test.js public/music-index.integration.test.js`
Expected: PASS (integration tests skip gracefully if the MuseScore fixtures are absent on this machine; on the dev machine the Chopin tempo assertion passes).

- [ ] **Step 7: Commit**

```bash
git add public/music-encoding.js public/music-encoding.test.js public/music-index.integration.test.js
git commit -m "feat(music): parse <sound tempo> into meta.tempo (M2 Phase 0)"
```

---

## Task 2: `music-query.js` scaffold — `parseQuery` / `validateQuery`

**Files:**
- Create: `public/music-query.js`
- Create: `public/music-query.test.js`

Queries arrive as either a JSON string or an object. `parseQuery` normalises one into a complete object with all knobs defaulted; `validateQuery` returns `{ ok, error }`.

Defaults: `strict_extensions:false`, `max_gap:0`, `transpose_invariant:false` (chord); `search_by_interval:false`, `pitch_tolerance:0`, `allow_passing:true`, `allow_repetition:true` (melody); `max_results` undefined unless provided.

- [ ] **Step 1: Write the failing test**

Create `public/music-query.test.js`:

```js
import { parseQuery, validateQuery } from './music-query.js';

describe('validateQuery', () => {
  test('rejects unknown type', () => {
    expect(validateQuery({ type: 'rhythm' }).ok).toBe(false);
  });
  test('chord query needs a non-empty chords array', () => {
    expect(validateQuery({ type: 'chord', chords: [] }).ok).toBe(false);
    expect(validateQuery({ type: 'chord', chords: [{ chord: 'C' }] }).ok).toBe(true);
  });
  test('melody query needs a non-empty notes array', () => {
    expect(validateQuery({ type: 'melody', notes: [] }).ok).toBe(false);
    expect(validateQuery({ type: 'melody', notes: ['C', '.', 'E'] }).ok).toBe(true);
  });
});

describe('parseQuery', () => {
  test('parses a JSON string and fills chord defaults', () => {
    const q = parseQuery('{"type":"chord","chords":[{"chord":"C"}]}');
    expect(q.type).toBe('chord');
    expect(q.strict_extensions).toBe(false);
    expect(q.max_gap).toBe(0);
    expect(q.transpose_invariant).toBe(false);
  });
  test('fills melody defaults', () => {
    const q = parseQuery({ type: 'melody', notes: ['C', 'E', 'G'] });
    expect(q.search_by_interval).toBe(false);
    expect(q.pitch_tolerance).toBe(0);
    expect(q.allow_passing).toBe(true);
    expect(q.allow_repetition).toBe(true);
  });
  test('preserves explicit knob values', () => {
    const q = parseQuery({ type: 'chord', chords: [{ chord: 'G', extensions_allowed: ['7'] }], strict_extensions: true, max_gap: 2 });
    expect(q.strict_extensions).toBe(true);
    expect(q.max_gap).toBe(2);
    expect(q.chords[0].extensions_allowed).toEqual(['7']);
  });
  test('throws on an invalid query', () => {
    expect(() => parseQuery({ type: 'chord', chords: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-query.test.js`
Expected: FAIL — `Cannot find module './music-query.js'`.

- [ ] **Step 3: Create `music-query.js` with the scaffold**

Create `public/music-query.js`:

```js
// public/music-query.js
// Pure client-side search engine over the M1 Tier-1 index (search.* fields).
// No DOM, no fetch — all inputs are plain data.
import { pitchClass, intervalsOf, unpackContour } from './music-encoding.js';
import { allChords, normaliseChordName } from './music-reference-data.js';

// ---------- query parse / validate ----------

export function validateQuery(q) {
  if (!q || typeof q !== 'object') return { ok: false, error: 'query must be an object' };
  if (q.type === 'chord') {
    if (!Array.isArray(q.chords) || q.chords.length === 0) return { ok: false, error: 'chord query needs a non-empty chords array' };
    if (!q.chords.every(c => c && typeof c.chord === 'string' && c.chord.length)) return { ok: false, error: 'each chord needs a "chord" string' };
    return { ok: true };
  }
  if (q.type === 'melody') {
    if (!Array.isArray(q.notes) || q.notes.length === 0) return { ok: false, error: 'melody query needs a non-empty notes array' };
    if (!q.notes.every(n => typeof n === 'string' && n.length)) return { ok: false, error: 'each note must be a string' };
    return { ok: true };
  }
  return { ok: false, error: `unknown query type: ${q.type}` };
}

export function parseQuery(input) {
  const raw = typeof input === 'string' ? JSON.parse(input) : input;
  const v = validateQuery(raw);
  if (!v.ok) throw new Error(v.error);
  if (raw.type === 'chord') {
    return {
      type: 'chord',
      chords: raw.chords.map(c => ({ chord: c.chord, extensions_allowed: c.extensions_allowed || [] })),
      strict_extensions: raw.strict_extensions === true,
      max_gap: Number.isFinite(raw.max_gap) ? raw.max_gap : 0,
      transpose_invariant: raw.transpose_invariant === true,
      max_results: raw.max_results
    };
  }
  return {
    type: 'melody',
    notes: raw.notes.slice(),
    search_by_interval: raw.search_by_interval === true,
    pitch_tolerance: Number.isFinite(raw.pitch_tolerance) ? raw.pitch_tolerance : 0,
    allow_passing: raw.allow_passing !== false,
    allow_repetition: raw.allow_repetition !== false,
    max_results: raw.max_results
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest public/music-query.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/music-query.js public/music-query.test.js
git commit -m "feat(music): music-query.js scaffold — parse/validate queries (M2 Phase 1)"
```

---

## Task 3: Chord decomposition — `decomposeChord`

**Files:**
- Modify: `public/music-query.js`
- Modify: `public/music-query.test.js`

Decompose a normalised chord symbol into `{ rootPc, quality, ext }` where `quality ∈ {maj,min,dim,aug}` and `ext` is a `Set` of canonical extension tokens. Built once from `allChords`: each key is `<majorScaleRoot><chordPatternKey>` (e.g. `"C#min7"` → root `"C#"`, pattern key `"min7"`); `normaliseChordName(key)` gives the index spelling (`"C#m7"`). Quality and extension are mapped per pattern key. A regex fallback handles symbols not in the table (root + simple `m`/`o`/`+` suffix).

Canonical extension tokens: `'6'`, `'7'`, `'maj7'`, `'9'`, `'add9'`, `'sus4'`. The query's `extensions_allowed` tokens are normalised through the same alias map (`'+9'`→`'add9'`, `'M7'`→`'maj7'`, `'dom7'`→`'7'`, etc.).

- [ ] **Step 1: Write the failing test**

Add to `public/music-query.test.js`:

```js
import { decomposeChord, normExtToken } from './music-query.js';

describe('decomposeChord', () => {
  const pc = { C: 0, G: 7, A: 9 };
  test('plain major triad', () => {
    const d = decomposeChord('C');
    expect(d.rootPc).toBe(pc.C);
    expect(d.quality).toBe('maj');
    expect([...d.ext]).toEqual([]);
  });
  test('minor triad spelled with m', () => {
    const d = decomposeChord('Am');
    expect(d.rootPc).toBe(pc.A);
    expect(d.quality).toBe('min');
  });
  test('dominant seventh', () => {
    const d = decomposeChord('G7');
    expect(d.rootPc).toBe(pc.G);
    expect(d.quality).toBe('maj');
    expect(d.ext.has('7')).toBe(true);
  });
  test('major seventh normalises to M7', () => {
    const d = decomposeChord('CM7');
    expect(d.quality).toBe('maj');
    expect(d.ext.has('maj7')).toBe(true);
  });
  test('diminished spelled with o', () => {
    expect(decomposeChord('Co').quality).toBe('dim');
  });
  test('augmented spelled with +', () => {
    expect(decomposeChord('C+').quality).toBe('aug');
  });
  test('sharp root parses', () => {
    expect(decomposeChord('F#m').rootPc).toBe(pitchClassOf('F#'));
  });
  test('unknown symbol falls back to root + quality', () => {
    const d = decomposeChord('Dm13');
    expect(d.rootPc).toBe(pitchClassOf('D'));
    expect(d.quality).toBe('min');
  });
});

function pitchClassOf(name) {
  const map = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  return map[name];
}

describe('normExtToken', () => {
  test('aliases map to canonical tokens', () => {
    expect(normExtToken('+9')).toBe('add9');
    expect(normExtToken('add9')).toBe('add9');
    expect(normExtToken('M7')).toBe('maj7');
    expect(normExtToken('maj7')).toBe('maj7');
    expect(normExtToken('dom7')).toBe('7');
    expect(normExtToken('7')).toBe('7');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-query.test.js -t "decomposeChord"`
Expected: FAIL — `decomposeChord` / `normExtToken` not exported.

- [ ] **Step 3: Implement the decomposition**

Add to `public/music-query.js` (after the parse/validate section):

```js
// ---------- chord decomposition ----------

// Base triad quality per chordPattern key (see music-reference-data.js chordPatterns).
const QUALITY_BY_CPK = {
  'maj': 'maj', 'min': 'min', 'aug': 'aug', 'dim': 'dim', 'dim7': 'dim',
  'sus4': 'maj', '7Sus4': 'maj',
  'min+9': 'min', 'maj+9': 'maj',
  '6': 'maj', 'min6': 'min', '6+9': 'maj', 'min6+9': 'min',
  '7': 'maj', 'maj7': 'maj', 'min7': 'min', 'minMaj7': 'min',
  '9': 'maj', 'maj9': 'maj', 'min9': 'min'
};

// Extension tokens beyond the base triad, per chordPattern key. Canonical tokens only.
const EXT_BY_CPK = {
  'maj': [], 'min': [], 'aug': [], 'dim': [],
  'dim7': ['7'], 'sus4': ['sus4'], '7Sus4': ['7', 'sus4'],
  'min+9': ['add9'], 'maj+9': ['add9'],
  '6': ['6'], 'min6': ['6'], '6+9': ['6', 'add9'], 'min6+9': ['6', 'add9'],
  '7': ['7'], 'maj7': ['maj7'], 'min7': ['7'], 'minMaj7': ['maj7'],
  '9': ['7', '9'], 'maj9': ['maj7', '9'], 'min9': ['7', '9']
};

const EXT_ALIASES = {
  '+9': 'add9', 'add9': 'add9', '9add': 'add9',
  'M7': 'maj7', 'maj7': 'maj7',
  'dom7': '7', '7': '7', 'b7': '7',
  '6': '6', 'sus4': 'sus4', 'sus': 'sus4', '9': '9'
};

export function normExtToken(token) {
  const t = String(token).trim();
  return EXT_ALIASES[t] || t;
}

// Build a lookup: normalised symbol -> {rootPc, quality, ext:Set}. Done once.
const CHORD_TABLE = (() => {
  const table = new Map();
  Object.keys(allChords).forEach(key => {
    const root = allChords[key].root;
    const cpk = key.slice(root.length);
    const quality = QUALITY_BY_CPK[cpk];
    if (!quality) return;
    const rootPc = pitchClass(root);
    if (rootPc === undefined) return;
    const sym = normaliseChordName(key);
    if (!table.has(sym)) table.set(sym, { rootPc, quality, ext: new Set(EXT_BY_CPK[cpk] || []) });
  });
  return table;
})();

export function decomposeChord(symbol) {
  const sym = String(symbol).trim();
  if (CHORD_TABLE.has(sym)) {
    const e = CHORD_TABLE.get(sym);
    return { rootPc: e.rootPc, quality: e.quality, ext: new Set(e.ext) };
  }
  // Fallback: root + simple quality marker; extensions best-effort empty.
  const m = /^([A-G][#b]?)(.*)$/.exec(sym);
  if (!m) return null;
  const rootPc = pitchClass(m[1]);
  if (rootPc === undefined) return null;
  const suffix = m[2];
  let quality = 'maj';
  if (suffix.startsWith('o')) quality = 'dim';
  else if (suffix.startsWith('+')) quality = 'aug';
  else if (suffix.startsWith('m') && !suffix.startsWith('maj') && !suffix.startsWith('M')) quality = 'min';
  return { rootPc, quality, ext: new Set() };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest public/music-query.test.js -t "decomposeChord"` then `npx jest public/music-query.test.js -t "normExtToken"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/music-query.js public/music-query.test.js
git commit -m "feat(music): chord symbol decomposition (M2 Phase 1)"
```

---

## Task 4: Chord matching — `matchChordQuery`

**Files:**
- Modify: `public/music-query.js`
- Modify: `public/music-query.test.js`

Match a chord query against a piece's `search.chords` string. A query chord matches a piece chord when **root + quality** agree (root literal unless `transpose_invariant`). Extensions are tolerated by default; under `strict_extensions`, every piece extension must be in that chord's `extensions_allowed`. The query sequence must appear as a sub-sequence — contiguous when `max_gap=0`, else ≤ `max_gap` intervening chords between consecutive matches. `transpose_invariant` matches the root-interval shape (qualities preserved) anchored to the first matched chord.

Returns `null` (no match) or `{ start, end, indices, symbols }` (chord-list indices; `symbols` = matched piece symbols in order).

- [ ] **Step 1: Write the failing test**

Add to `public/music-query.test.js`:

```js
import { matchChordQuery } from './music-query.js';

const Q = (chords, extra = {}) => ({ type: 'chord', chords, strict_extensions: false, max_gap: 0, transpose_invariant: false, ...extra });

describe('matchChordQuery', () => {
  test('contiguous match returns the chord range', () => {
    const m = matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }]), 'Am C G F');
    expect(m).not.toBeNull();
    expect(m.symbols).toEqual(['C', 'G']);
    expect(m.start).toBe(1);
    expect(m.end).toBe(2);
  });
  test('no contiguous match when chords are separated and max_gap=0', () => {
    expect(matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }]), 'C Am G')).toBeNull();
  });
  test('max_gap allows intervening chords', () => {
    const m = matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }], { max_gap: 1 }), 'C Am G');
    expect(m).not.toBeNull();
    expect(m.start).toBe(0);
    expect(m.end).toBe(2);
  });
  test('extension tolerated by default: query C matches piece CM7', () => {
    expect(matchChordQuery(Q([{ chord: 'C' }]), 'CM7 G')).not.toBeNull();
  });
  test('strict_extensions rejects unlisted extension', () => {
    const strict = Q([{ chord: 'C', extensions_allowed: [] }], { strict_extensions: true });
    expect(matchChordQuery(strict, 'CM7 G')).toBeNull();           // CM7 has maj7, not allowed
    expect(matchChordQuery(strict, 'C G')).not.toBeNull();         // plain triad ok
  });
  test('strict_extensions accepts a listed extension', () => {
    const strict = Q([{ chord: 'G', extensions_allowed: ['7'] }], { strict_extensions: true });
    expect(matchChordQuery(strict, 'C G7')).not.toBeNull();
  });
  test('quality must match: query Am does not match piece A', () => {
    expect(matchChordQuery(Q([{ chord: 'Am' }]), 'A C')).toBeNull();
  });
  test('transpose_invariant matches the same shape in another key', () => {
    // C -> G is +7; D -> A is also +7, same qualities (maj, maj)
    const m = matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }], { transpose_invariant: true }), 'D A E');
    expect(m).not.toBeNull();
    expect(m.symbols).toEqual(['D', 'A']);
  });
  test('transpose_invariant rejects a different shape', () => {
    // query interval C->G is +7; piece D->F is +3, no match
    expect(matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }], { transpose_invariant: true }), 'D F')).toBeNull();
  });
  test('empty piece chords -> null', () => {
    expect(matchChordQuery(Q([{ chord: 'C' }]), '')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-query.test.js -t "matchChordQuery"`
Expected: FAIL — `matchChordQuery` not exported.

- [ ] **Step 3: Implement chord matching**

Add to `public/music-query.js`:

```js
// ---------- chord matching ----------

const mod12 = n => ((n % 12) + 12) % 12;

// Does query chord q match piece chord p, given anchor (null for the first match)?
function chordMatchesAt(q, p, query, anchor) {
  if (!q || !p) return false;
  if (q.quality !== p.quality) return false;
  if (query.transpose_invariant) {
    if (anchor) {
      const want = mod12(q.rootPc - anchor.qRoot);
      const got = mod12(p.rootPc - anchor.pRoot);
      if (want !== got) return false;
    }
  } else if (q.rootPc !== p.rootPc) {
    return false;
  }
  if (query.strict_extensions) {
    const allowed = q.allowed; // Set of canonical tokens
    for (const e of p.ext) if (!allowed.has(e)) return false;
  }
  return true;
}

// Recursive constrained sub-sequence search. Returns array of matched indices, or null.
function matchSeq(qDec, pieceDec, query, qi, prevIdx, anchor) {
  if (qi === qDec.length) return [];
  const from = prevIdx + 1;
  const to = (qi === 0) ? pieceDec.length - 1 : Math.min(pieceDec.length - 1, prevIdx + 1 + (query.max_gap || 0));
  for (let j = from; j <= to; j++) {
    const p = pieceDec[j];
    if (chordMatchesAt(qDec[qi], p, query, qi === 0 ? null : anchor)) {
      const nextAnchor = anchor || { qRoot: qDec[qi].rootPc, pRoot: p.rootPc };
      const tail = matchSeq(qDec, pieceDec, query, qi + 1, j, nextAnchor);
      if (tail) return [j, ...tail];
    }
  }
  return null;
}

export function matchChordQuery(query, pieceChordsStr) {
  const pieceSyms = (pieceChordsStr || '').split(/\s+/).filter(Boolean);
  if (pieceSyms.length === 0) return null;
  const pieceDec = pieceSyms.map(decomposeChord);
  const qDec = query.chords.map(c => {
    const d = decomposeChord(c.chord);
    return d && { ...d, allowed: new Set((c.extensions_allowed || []).map(normExtToken)) };
  });
  if (qDec.some(d => !d)) return null;
  const indices = matchSeq(qDec, pieceDec, query, 0, -1, null);
  if (!indices) return null;
  return {
    start: indices[0],
    end: indices[indices.length - 1],
    indices,
    symbols: indices.map(i => pieceSyms[i])
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest public/music-query.test.js -t "matchChordQuery"`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add public/music-query.js public/music-query.test.js
git commit -m "feat(music): chord sequence matching with strict/max_gap/transpose (M2 Phase 1)"
```

---

## Task 5: Melody pitch-class matching — `matchMelodyPitchClasses`

**Files:**
- Modify: `public/music-query.js`
- Modify: `public/music-query.test.js`

Octave-agnostic exact match: each non-`.` query token must equal the piece note's pitch class (0–11); `.` skips a position. The piece sequence is `search.pitchClasses` (compact spelling `"C Cs D ..."`); query tokens use sharps/flats (`"C#"`, `"Db"`). Both normalise to pitch-class numbers before comparing. Returns `null` or `{ start, end }` (note indices; the window length equals the query length).

- [ ] **Step 1: Write the failing test**

Add to `public/music-query.test.js`:

```js
import { parseMelodyTokens, matchMelodyPitchClasses } from './music-query.js';

describe('parseMelodyTokens', () => {
  test('maps note names to pitch classes and "." to null', () => {
    expect(parseMelodyTokens(['C', '.', 'E', 'G'])).toEqual([0, null, 4, 7]);
  });
  test('handles sharps and flats equivalently', () => {
    expect(parseMelodyTokens(['C#', 'Db'])).toEqual([1, 1]);
  });
});

describe('matchMelodyPitchClasses', () => {
  const piece = 'C D E F G';   // pcs 0 2 4 5 7
  test('exact contiguous window', () => {
    const m = matchMelodyPitchClasses(['D', 'E', 'F'], piece);
    expect(m).toEqual({ start: 1, end: 3 });
  });
  test('wildcard skips a position', () => {
    const m = matchMelodyPitchClasses(['C', '.', 'E'], piece);
    expect(m).toEqual({ start: 0, end: 2 });
  });
  test('octave-agnostic across compact spelling', () => {
    // "Cs" in the index == C#/Db query
    const m = matchMelodyPitchClasses(['C#'], 'C Cs D');
    expect(m).toEqual({ start: 1, end: 1 });
  });
  test('no match returns null', () => {
    expect(matchMelodyPitchClasses(['G', 'G'], piece)).toBeNull();
  });
  test('returns the earliest match', () => {
    const m = matchMelodyPitchClasses(['C'], 'C D C');
    expect(m).toEqual({ start: 0, end: 0 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-query.test.js -t "matchMelodyPitchClasses"`
Expected: FAIL — exports missing.

- [ ] **Step 3: Implement pitch-class matching**

Add to `public/music-query.js`:

```js
// ---------- melody: pitch-class matching ----------

// Query token spelling (sharps/flats) -> pitch class number.
const QUERY_PC = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, 'E#': 5, Fb: 4,
  F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10,
  B: 11, 'B#': 0, Cb: 11
};
// Index compact spelling ("Cs"=1 ...) -> pitch class number.
const COMPACT_PC = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 };

export function parseMelodyTokens(notes) {
  return notes.map(n => (n === '.' ? null : QUERY_PC[n]));
}

function pitchClassesToNumbers(pcStr) {
  return (pcStr || '').split(/\s+/).filter(Boolean).map(t => COMPACT_PC[t]);
}

export function matchMelodyPitchClasses(notes, pitchClassesStr) {
  const q = parseMelodyTokens(notes);
  const seq = pitchClassesToNumbers(pitchClassesStr);
  const len = q.length;
  for (let start = 0; start + len <= seq.length; start++) {
    let ok = true;
    for (let i = 0; i < len; i++) {
      if (q[i] === null) continue;       // wildcard
      if (seq[start + i] !== q[i]) { ok = false; break; }
    }
    if (ok) return { start, end: start + len - 1 };
  }
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest public/music-query.test.js -t "matchMelodyPitchClasses"` then `npx jest public/music-query.test.js -t "parseMelodyTokens"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/music-query.js public/music-query.test.js
git commit -m "feat(music): octave-agnostic melody pitch-class matching (M2 Phase 1)"
```

---

## Task 6: Melody interval matching — `matchMelodyIntervals`

**Files:**
- Modify: `public/music-query.js`
- Modify: `public/music-query.test.js`

Transposition-invariant match over `search.contour` (the packed interval list). The query's intervals come from its concrete notes (`intervalsOf` on the query pitch classes); a `.` wildcard makes the interval(s) it touches "free" (any step). `pitch_tolerance` widens each interval comparison by ±N semitones. This generalises `findIntervalMatches` from [music_search.js](../../../public/music_search.js) (same transposition-invariant idea) by adding wildcard and tolerance support; a test pins agreement with `findIntervalMatches` on a no-wildcard, zero-tolerance case. Returns `null` or `{ start, end }` (note indices).

Note: `search.contour` has length `noteCount - 1` (it is the interval list). A matched note window of `q.length` notes corresponds to `q.length - 1` interval comparisons. A single-note query (no intervals) matches trivially at `start=0` — guard that case to require ≥2 notes for interval mode (callers route single-note melodies to pitch-class mode in Task 7).

- [ ] **Step 1: Write the failing test**

Add to `public/music-query.test.js`:

```js
import { matchMelodyIntervals } from './music-query.js';
import { findIntervalMatches } from './music_search.js';
import { intervalsOf } from './music-encoding.js';

describe('matchMelodyIntervals', () => {
  // piece: C D E C  (midi 60 62 64 60) -> intervals [2, 2, -4]
  const contour = intervalsOf([60, 62, 64, 60]); // [2,2,-4]
  test('matches an ascending whole-tone pair regardless of key', () => {
    // query G A (intervals [2]) -> should match the C->D and D->E steps
    const m = matchMelodyIntervals(['G', 'A'], contour, { pitch_tolerance: 0 });
    expect(m).toEqual({ start: 0, end: 1 });
  });
  test('matches a 3-note ascending shape', () => {
    const m = matchMelodyIntervals(['C', 'D', 'E'], contour, { pitch_tolerance: 0 });
    expect(m).toEqual({ start: 0, end: 2 });
  });
  test('wildcard frees the second interval', () => {
    // query C . E : first interval = +2 (C->.), but "." frees both touching intervals
    const m = matchMelodyIntervals(['C', '.', 'C'], contour, { pitch_tolerance: 0 });
    expect(m).not.toBeNull();
  });
  test('pitch_tolerance widens the interval', () => {
    // query asking +3 won't match +2 exactly, but tolerance 1 makes it match
    expect(matchMelodyIntervals(['C', 'Eb'], contour, { pitch_tolerance: 0 })).toBeNull();
    expect(matchMelodyIntervals(['C', 'Eb'], contour, { pitch_tolerance: 1 })).not.toBeNull();
  });
  test('no match returns null', () => {
    expect(matchMelodyIntervals(['C', 'F#'], contour, { pitch_tolerance: 0 })).toBeNull(); // +6 absent
  });
  test('agrees with findIntervalMatches on a no-wildcard, zero-tolerance case', () => {
    const melodyPitches = [60, 62, 64, 60];
    const queryPitches = [67, 69, 71]; // G A B -> intervals [2,2]
    const ref = findIntervalMatches(melodyPitches, queryPitches);
    const mine = matchMelodyIntervals(['G', 'A', 'B'], intervalsOf(melodyPitches), { pitch_tolerance: 0 });
    // both find the C-D-E window at note index 0
    expect(ref.length > 0).toBe(true);
    expect(mine).toEqual({ start: 0, end: 2 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-query.test.js -t "matchMelodyIntervals"`
Expected: FAIL — export missing.

- [ ] **Step 3: Implement interval matching**

Add to `public/music-query.js`:

```js
// ---------- melody: interval (transposition-invariant) matching ----------

// Build query intervals with a "free" flag. notes -> { intervals:[{value,free}] }.
// "." makes any interval touching it free (value ignored).
function queryIntervals(notes) {
  const pcs = notes.map(n => (n === '.' ? null : QUERY_PC[n]));
  const out = [];
  for (let i = 1; i < pcs.length; i++) {
    const a = pcs[i - 1], b = pcs[i];
    if (a === null || b === null) out.push({ value: 0, free: true });
    else out.push({ value: b - a, free: false });   // mod-free: pitch-class delta is fine for contour shape
  }
  return out;
}

const within = (a, b, tol) => Math.abs(a - b) <= tol;

export function matchMelodyIntervals(notes, contour, opts = {}) {
  if (notes.length < 2) return null;       // need at least one interval; single notes use pc mode
  const tol = opts.pitch_tolerance || 0;
  const q = queryIntervals(notes);
  const k = q.length;                       // intervals to match
  for (let start = 0; start + k <= contour.length; start++) {
    let ok = true;
    for (let i = 0; i < k; i++) {
      if (q[i].free) continue;
      if (!within(contour[start + i], q[i].value, tol)) { ok = false; break; }
    }
    if (ok) return { start, end: start + k };  // note window spans k+1 notes: [start, start+k]
  }
  return null;
}
```

Note on the pitch-class delta: query intervals are computed from pitch-class numbers (0–11), so a query like `C E` yields `+4` and a piece leap of `+4` (within an octave) matches. Octave-crossing leaps in the contour (e.g. `+16`) won't match a small query interval — acceptable for M2; documented as a known limitation (the contour stores true semitone deltas, the query is octave-agnostic). The `findIntervalMatches`-agreement test uses small intervals where both agree.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest public/music-query.test.js -t "matchMelodyIntervals"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/music-query.js public/music-query.test.js
git commit -m "feat(music): transposition-invariant melody interval matching (M2 Phase 1)"
```

---

## Task 7: `runQuery` — top-level engine, scoring, real-fixture smoke test

**Files:**
- Modify: `public/music-query.js`
- Modify: `public/music-query.test.js`
- Modify: `public/music-index.integration.test.js`

`runQuery(input, entries)` parses/validates the query, runs the right matcher over each entry's `search.*`, scores hits, sorts (score desc, then `pieceId` asc), and applies `max_results`. Result shape per the Phase 1→Phase 2 contract.

Scoring:
- **Chord:** density = `chords.length / (end - start + 1)` (1.0 when contiguous; lower with gaps).
- **Melody:** `1.0` for a hit (all required positions satisfied). Ties broken by sort order.

Melody routing: single-note melody (or `search_by_interval=false`) → pitch-class matcher; `search_by_interval=true` with ≥2 notes → interval matcher.

- [ ] **Step 1: Write the failing test**

Add to `public/music-query.test.js`:

```js
import { runQuery } from './music-query.js';

const entry = (id, search) => ({ id, system: 'western', search });

describe('runQuery', () => {
  const entries = [
    entry('alpha', { chords: 'C G Am F', pitchClasses: 'C E G', contour: '4,3' }),
    entry('beta',  { chords: 'Dm G7 C', pitchClasses: 'D F A', contour: '3,4' })
  ];

  test('chord query returns matching pieces with chord ranges', () => {
    const res = runQuery({ type: 'chord', chords: [{ chord: 'C' }, { chord: 'G' }] }, entries);
    expect(res.map(r => r.pieceId)).toEqual(['alpha']);
    expect(res[0].match.kind).toBe('chord');
    expect(res[0].match.range).toEqual([0, 1]);
    expect(res[0].match.symbols).toEqual(['C', 'G']);
    expect(res[0].score).toBeCloseTo(1.0);
  });

  test('melody pitch-class query (octave-agnostic)', () => {
    const res = runQuery({ type: 'melody', notes: ['C', 'E', 'G'] }, entries);
    expect(res.map(r => r.pieceId)).toEqual(['alpha']);
    expect(res[0].match.kind).toBe('note');
    expect(res[0].match.range).toEqual([0, 2]);
  });

  test('melody interval query is transposition-invariant', () => {
    // shape +4,+3 (major then minor third) appears in alpha (C E G)
    const res = runQuery({ type: 'melody', notes: ['C', 'E', 'G'], search_by_interval: true }, entries);
    expect(res.map(r => r.pieceId)).toContain('alpha');
  });

  test('max_results caps output', () => {
    const many = [entry('a', { chords: 'C G' }), entry('b', { chords: 'C G' })];
    const res = runQuery({ type: 'chord', chords: [{ chord: 'C' }, { chord: 'G' }], max_results: 1 }, many);
    expect(res.length).toBe(1);
  });

  test('throws on invalid query', () => {
    expect(() => runQuery({ type: 'chord', chords: [] }, entries)).toThrow();
  });

  test('no matches returns empty array', () => {
    expect(runQuery({ type: 'chord', chords: [{ chord: 'F#' }] }, entries)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-query.test.js -t "runQuery"`
Expected: FAIL — `runQuery` not exported.

- [ ] **Step 3: Implement `runQuery`**

Add to `public/music-query.js`:

```js
// ---------- top-level engine ----------

function runMelody(query, search) {
  const useInterval = query.search_by_interval && query.notes.length >= 2;
  if (useInterval) {
    const contour = unpackContour(search.contour);
    const m = matchMelodyIntervals(query.notes, contour, { pitch_tolerance: query.pitch_tolerance });
    return m && { kind: 'note', range: [m.start, m.end], score: 1.0 };
  }
  const m = matchMelodyPitchClasses(query.notes, search.pitchClasses);
  return m && { kind: 'note', range: [m.start, m.end], score: 1.0 };
}

function runChord(query, search) {
  const m = matchChordQuery(query, search.chords);
  if (!m) return null;
  const span = m.end - m.start + 1;
  const score = query.chords.length / span;
  return { kind: 'chord', range: [m.start, m.end], symbols: m.symbols, score };
}

export function runQuery(input, entries) {
  const query = parseQuery(input);
  const results = [];
  for (const e of entries) {
    const search = e.search || {};
    const m = query.type === 'chord' ? runChord(query, search) : runMelody(query, search);
    if (m) results.push({ pieceId: e.id, system: e.system, type: query.type, score: m.score, match: m });
  }
  results.sort((a, b) => (b.score - a.score) || a.pieceId.localeCompare(b.pieceId));
  return query.max_results ? results.slice(0, query.max_results) : results;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest public/music-query.test.js -t "runQuery"`
Expected: PASS.

- [ ] **Step 5: Add a real-fixture smoke test**

In `public/music-index.integration.test.js`, add these imports at the top (after the existing imports):

```js
import { runQuery } from './music-query.js';
```

Then add a new test inside the existing Chopin `describe` block (after the channels test):

```js
  test('runQuery finds a chord that the index actually contains', () => {
    const xml = fs.readFileSync(CHOPIN, 'utf8');
    const doc = inferChords(encodeMusicXml(xml, { id: 'Chopin_Nocturne_Op.9_No.2_for_Solo_Guitar', system: 'western' }));
    const entry = buildIndexEntry(doc, xml);
    const firstChord = entry.search.chords.split(/\s+/).filter(Boolean)[0];
    expect(firstChord).toBeTruthy();
    const res = runQuery({ type: 'chord', chords: [{ chord: firstChord }] }, [entry]);
    expect(res.length).toBe(1);
    expect(res[0].pieceId).toBe('Chopin_Nocturne_Op.9_No.2_for_Solo_Guitar');
  });

  test('runQuery finds the opening melodic pitch classes', () => {
    const xml = fs.readFileSync(CHOPIN, 'utf8');
    const doc = inferChords(encodeMusicXml(xml, { id: 'Chopin_Nocturne_Op.9_No.2_for_Solo_Guitar', system: 'western' }));
    const entry = buildIndexEntry(doc, xml);
    const firstThree = entry.search.pitchClasses.split(/\s+/).filter(Boolean).slice(0, 3);
    // convert compact spelling back to query spelling: Cs->C#, etc.
    const toQuery = { Cs: 'C#', Ds: 'D#', Fs: 'F#', Gs: 'G#', As: 'A#' };
    const notes = firstThree.map(t => toQuery[t] || t);
    const res = runQuery({ type: 'melody', notes }, [entry]);
    expect(res.length).toBe(1);
    expect(res[0].match.range[0]).toBe(0);
  });
```

- [ ] **Step 6: Run the full suite**

Run: `npx jest public/music-query.test.js public/music-index.integration.test.js public/music-encoding.test.js`
Expected: PASS (integration tests skip if fixtures absent).

- [ ] **Step 7: Run the entire project test suite to confirm no regressions**

Run: `npx jest public/`
Expected: All M1 + new M2 Phase 0/1 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add public/music-query.js public/music-query.test.js public/music-index.integration.test.js
git commit -m "feat(music): runQuery engine + scoring + real-fixture search tests (M2 Phase 1)"
```

---

## Done criteria for this plan

- `encodeMusicXml` populates `meta.tempo` from `<sound tempo>` (Chopin → 54), `null` when absent.
- `public/music-query.js` exports `parseQuery`, `validateQuery`, `decomposeChord`, `normExtToken`, `matchChordQuery`, `parseMelodyTokens`, `matchMelodyPitchClasses`, `matchMelodyIntervals`, `runQuery`.
- Chord search honours `strict_extensions`, `max_gap`, `transpose_invariant`; melody search supports octave-agnostic pitch-class and transposition-invariant interval modes with wildcards and tolerance.
- `runQuery` returns ranked results matching the Phase 1→Phase 2 contract; real Chopin fixture searches pass.
- All Jest suites green (`npx jest public/`).

## Follow-on plans (not this plan)

- **M2 Plan 2 — Rendering (Phase 2):** `music-render.js`, OSMD whole/segment render, mobile zoom, `measureRangeFromNoteRange`, chord-range→measure resolution against the Tier-2 detail.
- **M2 Plan 3 — Playback (Phase 3):** vendor Tone.js, `buildSchedule`, transport + OSMD cursor, YouTube IFrame control (reads `meta.tempo` from Phase 0).
- **M2 Plan 4 — Media-linking (Phase 4):** `music-media.js`, `guessSegmentStart`, link YouTube + push via GitHubUtils.
- **M2 Plan 5 — Capture (Phase 5):** `music-vocab.js`, `buildVocabEntry`, `db/music/<system>/vocab.json` load/save.
- **M2 Plan 6 — UI (Layout C):** the search/detail screens in `music.html` wiring all of the above.
