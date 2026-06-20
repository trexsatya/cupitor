# Music Study App — M2 Plan 5: Segment Capture → Vocabulary (`music-vocab.js`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture a measure-range segment of a piece into a per-system vocabulary store (`db/music/<system>/vocab.json`), carrying a snapshot, the linked YouTube URL, and the (edited) start time — loadable and pushable.

**Architecture:** Pure, TDD'd builders — `buildSnapshot` (pitches + chords in a measure range), `buildVocabEntry` (the categorized entry incl. its id), and `upsertVocab` (add/replace by id) — plus integration `loadVocab` / `saveVocabAndPush` (fetch + push `vocab.json`, no-rethrow). A minimal "Add to vocab" control in the Preview panel demonstrates capture; the full detail-view treatment is Phase 6.

**Tech Stack:** Vanilla ES modules; reuses `primaryVoice` (`music-encoding.js`) and `getMusicResourceUrl` (`music-index.js`); GitHubUtils committer; Jest + jsdom + Babel.

**Spec:** `docs/superpowers/specs/2026-06-20-music-study-app-m2-rendering-search-design.md` §8 (Phase 5) + decisions 6 (segment = measure range) and 7 (per-system `vocab.json`, categorized).

**Test runner:** `npx jest public/<file>.test.js`.

**Grounded facts:**
- A Tier-2 detail is `{ meta, voices, format, source }`; voices have index-aligned `pitch[]` (MIDI), `chordSymbol[]` (string|null), `measureIndex[]` (1-based). `primaryVoice({ voices })` returns the voice with the most notes.
- The captured vocab entry is the home for the edited start time (Plan 4 produces a guess; Plan 5 persists it on the entry — the piece is NOT mutated with a timestamp).
- `getMusicResourceUrl(system)` → `https://raw.githubusercontent.com/.../db/music/<system>`. The committer pushes `{path, getContent}` files (same shape as `rebuildAndPush`).
- The Manager already holds (from prior plans): `currentDetail`, `currentPreviewId`, `segmentRange()`, `makeCommitter(label)`, `system`, and `#guessSec` (the edited start seconds from Plan 4).

**Test economy (standing instruction):** test the pure builders + the save contract; skip trivial fetch wrappers (`loadVocab` is a thin fetch, like `loadLibrary` in the offline-cache plan).

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `public/music-vocab.js` | Pure `buildSnapshot`, `buildVocabEntry`, `upsertVocab`; integration `loadVocab`, `saveVocabAndPush`. |
| Create | `public/music-vocab.test.js` | Tests for the pure builders + the save contract. |
| Modify | `public/music.html` | "Add to vocab" control (category + button) in the Preview panel; load vocab on startup. |

---

## Task 1: Pure `buildSnapshot`

**Files:** Create `public/music-vocab.js`, create `public/music-vocab.test.js`.

- [ ] **Step 1: Write the failing test** — create `public/music-vocab.test.js`:

```js
// public/music-vocab.test.js
import { buildSnapshot, buildVocabEntry, upsertVocab } from './music-vocab.js';

function detailWith(pitch, chordSymbol, measureIndex) {
  return { meta: { id: 'p' }, format: 'musicxml', source: '<x/>',
           voices: [{ pitch, interval: [], sargam: [], duration: [], chordSymbol, lyric: [], measureIndex }] };
}

describe('buildSnapshot', () => {
  test('collects primary-voice pitches in the measure range and collapses consecutive chords', () => {
    const d = detailWith(
      [60, 62, 64, 65, 67],
      ['C', 'C', 'G', 'G', null],
      [1, 2, 2, 3, 4]
    );
    const snap = buildSnapshot(d, [2, 3]);
    expect(snap.pitches).toEqual([62, 64, 65]);     // measures 2..3
    expect(snap.chords).toEqual(['C', 'G']);        // consecutive dupes collapsed, nulls dropped
  });

  test('empty range / no voices → empty snapshot', () => {
    expect(buildSnapshot(detailWith([60], ['C'], [1]), [5, 6])).toEqual({ pitches: [], chords: [] });
    expect(buildSnapshot({ voices: [] }, [1, 2])).toEqual({ pitches: [], chords: [] });
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx jest public/music-vocab.test.js -t buildSnapshot` → module/function not defined.

- [ ] **Step 3: Implement** — create `public/music-vocab.js`:

```js
// public/music-vocab.js
// Segment capture → per-system vocabulary (db/music/<system>/vocab.json). Pure builders
// (snapshot, entry, upsert) are unit-tested; load/save are integration over fetch + GitHub.
import { primaryVoice } from './music-encoding.js';
import { getMusicResourceUrl } from './music-index.js';

// Pure: pitches (MIDI) and collapsed chord symbols from the primary voice within a
// 1-based inclusive measure range.
export function buildSnapshot(detail, measureRange) {
  const v = primaryVoice({ voices: (detail && detail.voices) || [] });
  const [from, to] = measureRange || [];
  const pitches = [];
  const chords = [];
  for (let i = 0; i < v.pitch.length; i++) {
    const m = v.measureIndex[i];
    if (m < from || m > to) continue;
    pitches.push(v.pitch[i]);
    const c = v.chordSymbol[i];
    if (c && chords[chords.length - 1] !== c) chords.push(c);
  }
  return { pitches, chords };
}
```

- [ ] **Step 4: Run, verify PASS** — `npx jest public/music-vocab.test.js -t buildSnapshot` → 2 tests. (`buildVocabEntry`/`upsertVocab` imports are unused here — fine.)

- [ ] **Step 5: Commit**

```bash
git add public/music-vocab.js public/music-vocab.test.js
git commit -m "feat(music): buildSnapshot — pitches + chords for a measure range"
```

---

## Task 2: Pure `buildVocabEntry`

**Files:** Modify `public/music-vocab.js`, modify `public/music-vocab.test.js`.

- [ ] **Step 1: Write the failing test** — APPEND to `public/music-vocab.test.js`:

```js
describe('buildVocabEntry', () => {
  test('assembles a categorized entry with id = pieceId_start_end and the given fields', () => {
    const entry = buildVocabEntry({
      pieceId: 'chopin op9', system: 'western', measureRange: [5, 8],
      youtube: 'https://youtu.be/abc', startSeconds: 42.5,
      snapshot: { pitches: [60, 62], chords: ['C'] }, category: 'cadences', createdAt: '2026-06-20',
    });
    expect(entry).toEqual({
      id: 'chopin_op9_5_8',
      category: 'cadences',
      pieceId: 'chopin op9',
      system: 'western',
      measureStart: 5,
      measureEnd: 8,
      youtube: 'https://youtu.be/abc',
      startSeconds: 42.5,
      snapshot: { pitches: [60, 62], chords: ['C'] },
      createdAt: '2026-06-20',
    });
  });

  test('defaults: category=uncategorized, youtube/startSeconds null, empty snapshot', () => {
    const entry = buildVocabEntry({ pieceId: 'p', system: 'sargam', measureRange: [1, 1], createdAt: '2026-06-20' });
    expect(entry.category).toBe('uncategorized');
    expect(entry.youtube).toBeNull();
    expect(entry.startSeconds).toBeNull();
    expect(entry.snapshot).toEqual({ pitches: [], chords: [] });
    expect(entry.id).toBe('p_1_1');
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx jest public/music-vocab.test.js -t buildVocabEntry`.

- [ ] **Step 3: Implement** — add to `public/music-vocab.js` after `buildSnapshot`:

```js
// Pure: build a categorized vocab entry. id follows M1 (pieceId + measure range, spaces→_).
export function buildVocabEntry({ pieceId, system, measureRange, youtube = null, startSeconds = null,
                                  snapshot = null, category = 'uncategorized', createdAt = null }) {
  const [measureStart, measureEnd] = measureRange;
  const id = `${pieceId}_${measureStart}_${measureEnd}`.replace(/\s+/g, '_');
  return {
    id, category, pieceId, system, measureStart, measureEnd,
    youtube, startSeconds,
    snapshot: snapshot || { pitches: [], chords: [] },
    createdAt,
  };
}
```

- [ ] **Step 4: Run, verify PASS** — `npx jest public/music-vocab.test.js` → 4 tests.

- [ ] **Step 5: Commit**

```bash
git add public/music-vocab.js public/music-vocab.test.js
git commit -m "feat(music): buildVocabEntry — categorized vocab entry with M1-style id"
```

---

## Task 3: `upsertVocab` + `loadVocab` + `saveVocabAndPush`

**Files:** Modify `public/music-vocab.js`, modify `public/music-vocab.test.js`.

- [ ] **Step 1: Write the failing test** — APPEND to `public/music-vocab.test.js`:

```js
import { saveVocabAndPush } from './music-vocab.js';

describe('upsertVocab', () => {
  test('appends a new entry and replaces an existing one by id', () => {
    const a = { id: 'x_1_2', category: 'a' };
    const b = { id: 'y_1_1', category: 'b' };
    const list1 = upsertVocab([a], b);
    expect(list1.map(e => e.id)).toEqual(['x_1_2', 'y_1_1']);
    const list2 = upsertVocab(list1, { id: 'x_1_2', category: 'updated' });
    expect(list2.find(e => e.id === 'x_1_2').category).toBe('updated');
    expect(list2).toHaveLength(2);
  });
});

describe('saveVocabAndPush', () => {
  test('pushes vocab.json with the full array; returns pushed:true', async () => {
    let files = null;
    const committer = async (f) => { files = f; };
    const vocab = [{ id: 'x_1_2', category: 'a' }];
    const res = await saveVocabAndPush({ system: 'western', vocab, committer });
    expect(res.pushed).toBe(true);
    expect(files[0].path).toBe('db/music/western/vocab.json');
    expect(JSON.parse(await files[0].getContent(null))).toEqual(vocab);
  });

  test('push failure: pushed:false + pushError, no rethrow', async () => {
    const committer = async () => { throw new Error('offline'); };
    const res = await saveVocabAndPush({ system: 'western', vocab: [], committer });
    expect(res.pushed).toBe(false);
    expect(res.pushError).toBe('offline');
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx jest public/music-vocab.test.js -t "upsertVocab|saveVocabAndPush"`.

- [ ] **Step 3: Implement** — add to `public/music-vocab.js`:

```js
// Pure: add or replace a vocab entry by id, returning a new array.
export function upsertVocab(vocab, entry) {
  const out = (vocab || []).filter(e => e.id !== entry.id);
  out.push(entry);
  return out;
}

// Integration: fetch the per-system vocab.json (empty array if missing/unreachable).
export async function loadVocab(system) {
  const res = await fetch(`${getMusicResourceUrl(system)}/vocab.json`);
  if (!res.ok) return [];
  return res.json();
}

// Integration: push the full vocab array to vocab.json. Never rethrows a push failure.
export async function saveVocabAndPush({ system, vocab, committer }) {
  const files = [{ path: `db/music/${system}/vocab.json`, getContent: () => JSON.stringify(vocab, null, 2) }];
  try { await committer(files); return { pushed: true }; }
  catch (e) { return { pushed: false, pushError: e.message }; }
}
```

- [ ] **Step 4: Run, verify PASS** — `npx jest public/music-vocab.test.js` → 7 tests.

- [ ] **Step 5: Commit**

```bash
git add public/music-vocab.js public/music-vocab.test.js
git commit -m "feat(music): upsertVocab + loadVocab + saveVocabAndPush"
```

---

## Task 4: Wire "Add to vocab" into the Preview panel

**Files:** Modify `public/music.html`. No unit tests; verify with `node --check`, id-check, full suite.

Read `public/music.html` first to confirm snippets.

- [ ] **Step 1: Add the capture control to the media row**

FIND:
```
    <input id="guessSec" type="number" step="0.1" style="width:6em" placeholder="sec">
    <span id="mediaMsg"></span>
  </div>
```
REPLACE:
```
    <input id="guessSec" type="number" step="0.1" style="width:6em" placeholder="sec">
    <input id="vocabCat" type="text" placeholder="category" style="width:8em">
    <button id="addVocabBtn">Add to vocab</button>
    <span id="mediaMsg"></span>
  </div>
```

- [ ] **Step 2: Import the vocab module**

FIND:
```
  import { guessSegmentStart, linkYouTubeAndPush } from './music-media.js';
```
REPLACE:
```
  import { guessSegmentStart, linkYouTubeAndPush } from './music-media.js';
  import { buildSnapshot, buildVocabEntry, upsertVocab, loadVocab, saveVocabAndPush } from './music-vocab.js';
```

- [ ] **Step 3: Add the capture handler** (after the `guessBtn` handler)

FIND:
```
    document.getElementById('guessSec').value = sec.toFixed(1);
    document.getElementById('mediaMsg').textContent = `Guess: ${sec.toFixed(1)}s of ${dur.toFixed(0)}s`;
  };
```
REPLACE:
```
    document.getElementById('guessSec').value = sec.toFixed(1);
    document.getElementById('mediaMsg').textContent = `Guess: ${sec.toFixed(1)}s of ${dur.toFixed(0)}s`;
  };

  document.getElementById('addVocabBtn').onclick = async () => {
    if (!currentDetail || !currentPreviewId) { document.getElementById('mediaMsg').textContent = 'Preview a piece first.'; return; }
    const range = segmentRange();
    const from = range.fromMeasure || 1, to = range.toMeasure || from;
    const secRaw = parseFloat(document.getElementById('guessSec').value);
    const entry = buildVocabEntry({
      pieceId: currentPreviewId, system, measureRange: [from, to],
      youtube: (currentDetail.meta && currentDetail.meta.youtube) || null,
      startSeconds: Number.isFinite(secRaw) ? secRaw : null,
      snapshot: buildSnapshot(currentDetail, [from, to]),
      category: document.getElementById('vocabCat').value.trim() || 'uncategorized',
      createdAt: new Date().toISOString().slice(0, 10),
    });
    vocab = upsertVocab(vocab, entry);
    document.getElementById('mediaMsg').textContent = 'Saving vocab…';
    const res = await saveVocabAndPush({ system, vocab, committer: makeCommitter(`vocab ${entry.id}`) });
    document.getElementById('mediaMsg').textContent = res.pushed
      ? `Added "${entry.id}" (${vocab.length} total)`
      : `Saved locally; push failed: ${res.pushError}`;
  };
```

- [ ] **Step 4: Declare `vocab` state + load it on startup**

FIND:
```
  let index = [];
  let unpushedIds = new Set();
  const store = createMusicStore();
```
REPLACE:
```
  let index = [];
  let unpushedIds = new Set();
  let vocab = [];
  const store = createMusicStore();
```

Then FIND the bootstrap IIFE:
```
  (async () => {
    try { const lib = await loadLibrary(system, store); index = lib.index; unpushedIds = lib.unpushedIds; }
    catch (_) { index = []; unpushedIds = new Set(); }
    render(); updateRetryBtn();
  })();
```
REPLACE:
```
  (async () => {
    try { const lib = await loadLibrary(system, store); index = lib.index; unpushedIds = lib.unpushedIds; }
    catch (_) { index = []; unpushedIds = new Set(); }
    try { vocab = await loadVocab(system); } catch (_) { vocab = []; }
    render(); updateRetryBtn();
  })();
```

- [ ] **Step 5: Syntax-check the inline module**

Run:
```bash
F="$(node -e "const os=require('os'),p=require('path');console.log(p.join(os.tmpdir(),'music_mod_p5.mjs'))")"
node -e "const fs=require('fs');const h=fs.readFileSync('public/music.html','utf8');const m=h.match(/<script type=\"module\">([\s\S]*?)<\/script>/);fs.writeFileSync(process.argv[1],m[1]);" "$F"
node --check "$F" && echo "SYNTAX OK" && rm -f "$F"
```
Expected: `SYNTAX OK`.

- [ ] **Step 6: Confirm new ids exist**

Run:
```bash
for id in vocabCat addVocabBtn; do grep -q "id=\"$id\"" public/music.html && echo "$id OK" || echo "$id MISSING"; done
```
Expected: all OK.

- [ ] **Step 7: Full suite — no regression**

Run: `npx jest public/ 2>&1 | tail -6`
Expected: only the pre-existing `music_search.test.js` "9. Too large jump" failure.

- [ ] **Step 8: Commit**

```bash
git add public/music.html
git commit -m "feat(music): Add-to-vocab capture in the Preview panel (M2 Phase 5)"
```

- [ ] **Step 9: Manual browser verification (human step)**

1. Preview a MusicXML piece; optionally set a segment (e.g. `3`–`6`) and a category (e.g. "licks").
2. (Optional) Link a YouTube URL + Guess segment start so the entry carries `youtube` + `startSeconds`.
3. Click **Add to vocab** → status shows `Added "<id>" (N total)` (or "Saved locally; push failed" offline). Confirm `db/music/<system>/vocab.json` on gh-pages gains the entry with `measureStart/End`, `snapshot.pitches/chords`, `youtube`, `startSeconds`, `category`.

---

## Notes for the implementer

- **Timestamp home:** `startSeconds` comes from the edited `#guessSec` field (Plan 4) and is stored on the vocab entry — the piece is never mutated with a timestamp.
- **No offline-store for vocab:** `vocab.json` is loaded/pushed directly; the in-memory `vocab` array retains the entry during the session even if the push fails (no-rethrow). Cross-reload offline survival of vocab is out of scope (the offline store holds pieces, not vocab).
- **Reuse:** `buildSnapshot` uses `primaryVoice`; `loadVocab` uses `getMusicResourceUrl`; the push uses the same `{path,getContent}` shape + `makeCommitter` as the rest of the app.
- **Don't disturb** the offline-cache, playback, or media wiring already in `music.html`; Task 4 only ADDS the capture control, handler, `vocab` state, and one bootstrap line.
