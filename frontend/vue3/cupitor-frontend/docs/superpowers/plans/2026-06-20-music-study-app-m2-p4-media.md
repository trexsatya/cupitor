# Music Study App — M2 Plan 4: Media-linking + Timestamps (`music-media.js`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach a YouTube URL to a piece (persisted to both index tiers) and compute a duration-weighted timestamp guess for a measure-range segment, shown editable before it's saved.

**Architecture:** Two pure, TDD'd functions — `guessSegmentStart` (duration-weighted proportional guess) and `applyYouTubeLink` (patch `meta.youtube` into an entry + detail) — plus one integration function `linkYouTubeAndPush` that writes the patched pieces to the offline-first store and pushes them (reusing the write-local-first / no-rethrow pattern from the offline-cache plan). A minimal media row in the Preview panel demonstrates linking + the guess; the full detail-view treatment is Phase 6.

**Tech Stack:** Vanilla ES modules; reuses `NOTE_TYPE_BEATS` from `music-player.js` and `primaryVoice` from `music-encoding.js`; `mergeIndex` from `music-index.js`; GitHubUtils committer; Jest + jsdom + Babel.

**Spec:** `docs/superpowers/specs/2026-06-20-music-study-app-m2-rendering-search-design.md` §7 (Phase 4) and decision 5 (duration-weighted proportional, user-editable). Note: saved start times live on the captured **vocab** entry (Phase 5), not mutated onto the piece — Plan 4 only computes/edits the guess; Plan 5 persists it.

**Test runner:** `npx jest public/<file>.test.js`.

**Grounded facts:**
- A Tier-1 entry includes a `youtube` field (`buildIndexEntry` sets `youtube: doc.meta.youtube`). A Tier-2 detail is `{ meta, voices, format, source }` with `meta.youtube`.
- `NOTE_TYPE_BEATS` (exported from `music-player.js`) maps a note `<type>` → beats; `null`/unknown → treat as a quarter (1 beat). `primaryVoice({ voices })` (from `music-encoding.js`) returns the voice with the most notes. `measureIndex[]` is 1-based.
- The duration ratio is tempo-independent, so the guess works in "beats" without needing a tempo.
- The offline-first store (`createMusicStore`) exposes `putPieces`, `getDetail`, `markSynced`; `rebuildAndPush`/`retryPush` (in `music-index.js`) established the file-shape `{ path, getContent }` + write-local-first + no-rethrow pattern. `mergeIndex(existing, entries)` replaces by id.

**Test economy (standing instruction):** test the pure functions and the integration contract that matters (patches both tiers, pushes both files, no rethrow). No trivial/redundant cases.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `public/music-media.js` | Pure `guessSegmentStart`, pure `applyYouTubeLink`; integration `linkYouTubeAndPush`. |
| Create | `public/music-media.test.js` | Tests for the two pure functions + the integration contract. |
| Modify | `public/music.html` | Media row in the Preview panel: link a YouTube URL (save to the piece) + compute/show an editable segment-start guess. |

---

## Task 1: Pure `guessSegmentStart`

**Files:** Create `public/music-media.js`, create `public/music-media.test.js`.

- [ ] **Step 1: Write the failing test** — create `public/music-media.test.js`:

```js
// public/music-media.test.js
import { guessSegmentStart, applyYouTubeLink } from './music-media.js';

// detail.voices: index-aligned arrays. duration = <type> string|null, measureIndex 1-based.
function detailWith(pitch, duration, measureIndex) {
  return { meta: { id: 'p', youtube: null }, format: 'musicxml', source: '<x/>',
           voices: [{ pitch, interval: [], sargam: [], duration, chordSymbol: [], lyric: [], measureIndex }] };
}

describe('guessSegmentStart', () => {
  test('duration-weighted: start ∝ (beats before segment / total beats) × mediaSeconds', () => {
    // 4 quarter notes, one per measure (1..4). Segment [3,4] → 2 of 4 beats before → 0.5 × 100 = 50.
    const d = detailWith([60, 62, 64, 65], ['quarter', 'quarter', 'quarter', 'quarter'], [1, 2, 3, 4]);
    expect(guessSegmentStart(d, [3, 4], 100)).toBeCloseTo(50, 5);
  });

  test('weights by note type, not note count', () => {
    // half(2b) in m1, quarter(1b) in m2, quarter(1b) in m3. total=4 beats. segment [2,?] → 2 beats before → 0.5×80=40.
    const d = detailWith([60, 62, 64], ['half', 'quarter', 'quarter'], [1, 2, 3]);
    expect(guessSegmentStart(d, [2, 3], 80)).toBeCloseTo(40, 5);
  });

  test('segment starting at measure 1 → 0; null durations counted as a quarter each', () => {
    const d = detailWith([60, 62], [null, null], [1, 2]);
    expect(guessSegmentStart(d, [1, 2], 120)).toBe(0);
    expect(guessSegmentStart(d, [2, 2], 120)).toBeCloseTo(60, 5); // 1 of 2 beats before
  });

  test('zero total duration or zero media → 0', () => {
    const empty = { voices: [{ pitch: [], duration: [], measureIndex: [], interval: [], sargam: [], chordSymbol: [], lyric: [] }] };
    expect(guessSegmentStart(empty, [1, 1], 100)).toBe(0);
    const d = detailWith([60], ['quarter'], [1]);
    expect(guessSegmentStart(d, [1, 1], 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test, verify it FAILS**

Run: `npx jest public/music-media.test.js -t guessSegmentStart`
Expected: FAIL — module/function not defined.

- [ ] **Step 3: Implement** — create `public/music-media.js`:

```js
// public/music-media.js
// Media-linking: attach a YouTube URL to a piece, and guess a segment's start time
// in the linked video by duration-weighted proportion. Pure guess/patch fns are
// unit-tested; the push is integration glue over the offline-first store + committer.
import { primaryVoice } from './music-encoding.js';
import { NOTE_TYPE_BEATS } from './music-player.js';
import { mergeIndex } from './music-index.js';

const DEFAULT_BEATS = 1; // quarter, used when duration is null/unknown

// Pure: estimate where `measureRange` (1-based [start,end]) begins in a media file of
// `mediaSeconds`, as (note-beats before the segment ÷ total note-beats) × mediaSeconds.
export function guessSegmentStart(detail, measureRange, mediaSeconds) {
  if (!detail || !measureRange || !mediaSeconds) return 0;
  const v = primaryVoice({ voices: detail.voices || [] });
  const start = measureRange[0];
  let total = 0, before = 0;
  for (let i = 0; i < v.pitch.length; i++) {
    const beats = NOTE_TYPE_BEATS[v.duration[i]] ?? DEFAULT_BEATS;
    total += beats;
    if (v.measureIndex[i] < start) before += beats;
  }
  return total > 0 ? (before / total) * mediaSeconds : 0;
}
```

- [ ] **Step 4: Run the test, verify it PASSES**

Run: `npx jest public/music-media.test.js -t guessSegmentStart`
Expected: PASS — 4 tests. (The `applyYouTubeLink` import is unused here; resolves to undefined under Babel — fine.)

- [ ] **Step 5: Commit**

```bash
git add public/music-media.js public/music-media.test.js
git commit -m "feat(music): guessSegmentStart — duration-weighted timestamp guess"
```

---

## Task 2: Pure `applyYouTubeLink`

**Files:** Modify `public/music-media.js`, modify `public/music-media.test.js`.

- [ ] **Step 1: Write the failing test** — APPEND to `public/music-media.test.js`:

```js
describe('applyYouTubeLink', () => {
  test('sets youtube on both the entry and the detail meta, without mutating inputs', () => {
    const entry = { id: 'p', title: 'P', youtube: null };
    const detail = { meta: { id: 'p', youtube: null, title: 'P' }, voices: [], format: 'musicxml', source: '<x/>' };
    const url = 'https://youtu.be/dQw4w9WgXcQ';
    const out = applyYouTubeLink(entry, detail, url);
    expect(out.entry.youtube).toBe(url);
    expect(out.detail.meta.youtube).toBe(url);
    // originals untouched
    expect(entry.youtube).toBeNull();
    expect(detail.meta.youtube).toBeNull();
    // other fields preserved
    expect(out.entry.title).toBe('P');
    expect(out.detail.meta.title).toBe('P');
    expect(out.detail.source).toBe('<x/>');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx jest public/music-media.test.js -t applyYouTubeLink`
Expected: FAIL — not a function.

- [ ] **Step 3: Implement** — add to `public/music-media.js` (after `guessSegmentStart`):

```js
// Pure: return copies of the Tier-1 entry and Tier-2 detail with meta.youtube set.
export function applyYouTubeLink(entry, detail, url) {
  return {
    entry: { ...entry, youtube: url },
    detail: { ...detail, meta: { ...detail.meta, youtube: url } },
  };
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx jest public/music-media.test.js`
Expected: PASS — 5 tests (guessSegmentStart + applyYouTubeLink).

- [ ] **Step 5: Commit**

```bash
git add public/music-media.js public/music-media.test.js
git commit -m "feat(music): applyYouTubeLink — patch youtube into entry + detail"
```

---

## Task 3: Integration `linkYouTubeAndPush`

**Files:** Modify `public/music-media.js`, modify `public/music-media.test.js`.

- [ ] **Step 1: Write the failing test** — APPEND to `public/music-media.test.js`:

```js
import { linkYouTubeAndPush } from './music-media.js';

describe('linkYouTubeAndPush', () => {
  function fakeStore(detail) {
    const calls = { put: [], synced: [] };
    return {
      calls,
      async getDetail() { return detail; },
      async putPieces(system, items) { calls.put.push({ system, items }); },
      async markSynced(system, ids) { calls.synced.push({ system, ids }); },
    };
  }
  const detail = { meta: { id: 'p', youtube: null }, voices: [], format: 'musicxml', source: '<x/>' };
  const currentIndex = [{ id: 'p', title: 'P', youtube: null }, { id: 'other', title: 'O' }];
  const url = 'https://youtu.be/dQw4w9WgXcQ';

  test('patches both tiers, pushes index.json + the detail, writes local + marks synced on success', async () => {
    let pushed = null;
    const committer = async (files) => { pushed = files; };
    const store = fakeStore(detail);
    const res = await linkYouTubeAndPush({ system: 'western', id: 'p', url, currentIndex, store, committer });
    expect(res.pushed).toBe(true);
    expect(res.index.find(e => e.id === 'p').youtube).toBe(url);
    expect(res.index.find(e => e.id === 'other').youtube).toBeUndefined(); // untouched
    const paths = pushed.map(f => f.path);
    expect(paths).toContain('db/music/western/index.json');
    expect(paths).toContain('db/music/western/details/p.json');
    const savedDetail = JSON.parse(await pushed.find(f => f.path === 'db/music/western/details/p.json').getContent(null));
    expect(savedDetail.meta.youtube).toBe(url);
    expect(store.calls.put[0].items[0].entry.youtube).toBe(url);
    expect(store.calls.synced[0].ids).toEqual(['p']);
  });

  test('push failure: pushed:false + pushError, no rethrow, not marked synced (local copy kept)', async () => {
    const store = fakeStore(detail);
    const committer = async () => { throw new Error('offline'); };
    const res = await linkYouTubeAndPush({ system: 'western', id: 'p', url, currentIndex, store, committer });
    expect(res.pushed).toBe(false);
    expect(res.pushError).toBe('offline');
    expect(store.calls.put.length).toBe(1);   // saved locally
    expect(store.calls.synced).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx jest public/music-media.test.js -t linkYouTubeAndPush`
Expected: FAIL — not a function.

- [ ] **Step 3: Implement** — add to `public/music-media.js` (after `applyYouTubeLink`):

```js
// Integration: link a YouTube URL to piece `id` and persist it. Patches the Tier-1
// entry + Tier-2 detail, writes them to the local store first (synced:false), then
// pushes index.json + the detail. Never rethrows a push failure (mirrors rebuildAndPush).
export async function linkYouTubeAndPush({ system, id, url, currentIndex = [], store, committer }) {
  const prevEntry = currentIndex.find(e => e.id === id);
  if (!prevEntry) return { pushed: false, index: currentIndex, error: 'piece not found' };
  const detail = await store.getDetail(system, id);
  if (!detail) return { pushed: false, index: currentIndex, error: 'detail not found' };

  const { entry, detail: patched } = applyYouTubeLink(prevEntry, detail, url);
  const index = mergeIndex(currentIndex, [entry]);

  let localError = null;
  try { await store.putPieces(system, [{ entry, detail: patched }]); }
  catch (e) { localError = e.message; }

  const files = [
    { path: `db/music/${system}/index.json`, getContent: () => JSON.stringify(index, null, 2) },
    { path: `db/music/${system}/details/${id}.json`, getContent: () => JSON.stringify(patched) },
  ];

  let pushed = false, pushError = null;
  try { await committer(files); pushed = true; }
  catch (e) { pushError = e.message; }
  if (pushed) { try { await store.markSynced(system, [id]); } catch (e) { if (!localError) localError = e.message; } }

  return { index, pushed, pushError, localError };
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx jest public/music-media.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add public/music-media.js public/music-media.test.js
git commit -m "feat(music): linkYouTubeAndPush — persist YouTube link to both index tiers"
```

---

## Task 4: Wire media-linking + guess into the Preview panel

**Files:** Modify `public/music.html`. No unit tests; verify with `node --check`, the id-existence check, and the full suite.

Read `public/music.html` first to confirm snippets.

- [ ] **Step 1: Add a media row to the Preview panel**

FIND:
```
    <span id="transportMsg"></span>
  </div>
  <div id="osmdPreview"></div>
```
REPLACE:
```
    <span id="transportMsg"></span>
  </div>
  <div id="mediaRow" style="margin:.25rem 0">
    <input id="ytUrl" type="text" placeholder="YouTube URL" style="width:18em">
    <button id="ytSaveBtn">Link YouTube</button>
    <button id="guessBtn">Guess segment start</button>
    <input id="guessSec" type="number" step="0.1" style="width:6em" placeholder="sec">
    <span id="mediaMsg"></span>
  </div>
  <div id="osmdPreview"></div>
```

- [ ] **Step 2: Import the media module**

FIND:
```
  import { buildSchedule, createMusicPlayer, createYouTubeController, parseYouTubeId } from './music-player.js';
```
REPLACE:
```
  import { buildSchedule, createMusicPlayer, createYouTubeController, parseYouTubeId } from './music-player.js';
  import { guessSegmentStart, linkYouTubeAndPush } from './music-media.js';
```

- [ ] **Step 3: Wire the link + guess handlers** (place right after the `stopBtn` onclick handler added in Plan 3)

FIND:
```
  document.getElementById('stopBtn').onclick = () => {
    if (player) player.stop();
    if (yt) yt.pause();
    document.getElementById('transportMsg').textContent = '';
  };
```
REPLACE:
```
  document.getElementById('stopBtn').onclick = () => {
    if (player) player.stop();
    if (yt) yt.pause();
    document.getElementById('transportMsg').textContent = '';
  };

  let currentPreviewId = null;
  document.getElementById('ytSaveBtn').onclick = async () => {
    const url = document.getElementById('ytUrl').value.trim();
    if (!currentPreviewId || !url) { document.getElementById('mediaMsg').textContent = 'Preview a piece and enter a URL.'; return; }
    document.getElementById('mediaMsg').textContent = 'Saving link…';
    const res = await linkYouTubeAndPush({ system, id: currentPreviewId, url, currentIndex: index,
      store, committer: makeCommitter(`link ${currentPreviewId}`) });
    if (res.error) { document.getElementById('mediaMsg').textContent = res.error; return; }
    index = res.index;
    if (currentDetail && currentDetail.meta) currentDetail.meta.youtube = url;
    if (!res.pushed) unpushedIds.add(currentPreviewId); else unpushedIds.delete(currentPreviewId);
    render(); updateRetryBtn();
    document.getElementById('mediaMsg').textContent = res.pushed ? 'Linked + pushed.'
      : `Saved locally; push failed: ${res.pushError}`;
  };
  document.getElementById('guessBtn').onclick = () => {
    if (!currentDetail) { document.getElementById('mediaMsg').textContent = 'Preview a piece first.'; return; }
    const dur = yt && yt.getDuration ? yt.getDuration() : 0;
    if (!dur) { document.getElementById('mediaMsg').textContent = 'Load the YouTube video first (▶ on YouTube source).'; return; }
    const range = segmentRange();
    const from = range.fromMeasure || 1, to = range.toMeasure || from;
    const sec = guessSegmentStart(currentDetail, [from, to], dur);
    document.getElementById('guessSec').value = sec.toFixed(1);
    document.getElementById('mediaMsg').textContent = `Guess: ${sec.toFixed(1)}s of ${dur.toFixed(0)}s`;
  };
```

- [ ] **Step 4: Track the previewed id + prefill the URL when a preview opens**

FIND:
```
    currentDetail = detail;
    document.getElementById('tempoInput').value = (detail.meta && detail.meta.tempo) || 90;
    if (player) player.stop();
```
REPLACE:
```
    currentDetail = detail;
    currentPreviewId = id;
    document.getElementById('ytUrl').value = (detail.meta && detail.meta.youtube) || '';
    document.getElementById('guessSec').value = '';
    document.getElementById('tempoInput').value = (detail.meta && detail.meta.tempo) || 90;
    if (player) player.stop();
```

- [ ] **Step 5: Syntax-check the inline module**

Run:
```bash
F="$(node -e "const os=require('os'),p=require('path');console.log(p.join(os.tmpdir(),'music_mod_p4.mjs'))")"
node -e "const fs=require('fs');const h=fs.readFileSync('public/music.html','utf8');const m=h.match(/<script type=\"module\">([\s\S]*?)<\/script>/);fs.writeFileSync(process.argv[1],m[1]);" "$F"
node --check "$F" && echo "SYNTAX OK" && rm -f "$F"
```
Expected: `SYNTAX OK`.

- [ ] **Step 6: Confirm new ids exist**

Run:
```bash
for id in ytUrl ytSaveBtn guessBtn guessSec mediaMsg; do grep -q "id=\"$id\"" public/music.html && echo "$id OK" || echo "$id MISSING"; done
```
Expected: all OK.

- [ ] **Step 7: Full suite — no regression**

Run: `npx jest public/ 2>&1 | tail -6`
Expected: only the pre-existing `music_search.test.js` failure.

- [ ] **Step 8: Commit**

```bash
git add public/music.html
git commit -m "feat(music): link YouTube + segment-start guess in the Preview panel (M2 Phase 4)"
```

- [ ] **Step 9: Manual browser verification (human step)**

1. Preview a MusicXML piece, paste a YouTube URL, **Link YouTube** → status "Linked + pushed" (or "Saved locally; push failed" offline + the row badges "not pushed"); reopening the piece prefills the URL.
2. Switch source to **YouTube**, ▶ to load the video; enter a segment (e.g. `3`–`6`), click **Guess segment start** → the seconds field fills with a proportional estimate (editable).

---

## Notes for the implementer

- **Reuses, don't reinvent:** `guessSegmentStart` uses `NOTE_TYPE_BEATS` from `music-player.js` and `primaryVoice` from `music-encoding.js`; `linkYouTubeAndPush` uses `mergeIndex` from `music-index.js` and the same `{path,getContent}` file shape + write-local-first + no-rethrow as `rebuildAndPush`.
- **No piece mutation for timestamps:** the guessed/edited seconds are NOT written to the piece here — they belong on the vocab entry in Plan 5. Plan 4 only links the URL and surfaces the guess.
- **Don't disturb** the offline-cache or playback wiring already in `music.html`; Task 4 only ADDS a media row + handlers and two lines in `openPreview`.
