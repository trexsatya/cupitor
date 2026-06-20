# Music Manager Offline-First IndexedDB Cache — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Music Manager's "Rebuild & Push" persist pieces into an IndexedDB cache *before* pushing, so a push failure never loses data; unpushed pieces survive reloads (badged), preview from the local store, and can be retried.

**Architecture:** A thin promisified IndexedDB wrapper (`music-local-store.js`) holds two object stores (`entries`, `details`) keyed `${system}:${id}` with a `synced` flag. Push-decision logic stays pure in `music-index.js` (`computeChanges`, `mergeLocalRemote`); `rebuildAndPush` is reworked to write-local-then-push without rethrowing on push failure, and `retryPush`/`loadLibrary` are added. `music.html` wires it together: merge-on-load, "not pushed" badges, preview-from-local, and a "Retry push" button.

**Tech Stack:** Vanilla ES modules, IndexedDB, jQuery (already global in `music.html`); Jest + jsdom with `fake-indexeddb` for the IDB wrapper; Babel ESM transform.

**Spec:** `docs/superpowers/specs/2026-06-20-music-manager-offline-cache-design.md`

**Test runner:** `npx jest public/<file>.test.js` (jsdom; default testMatch `public/*.test.js`).

**Backwards-compat constraint:** The three existing `rebuildAndPush` tests in `public/music-index.test.js` call it **without** a `store` argument. The rework MUST keep `store` optional (no-op default) so those tests stay green untouched.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `public/music-local-store.js` | Promisified IndexedDB wrapper: `createMusicStore({indexedDB})` → `putPieces`/`getEntries`/`getDetail`/`markSynced`/`getUnpushed`. |
| Create | `public/music-local-store.test.js` | Round-trip / isolation / sync tests for the wrapper (uses `fake-indexeddb`). |
| Modify | `public/music-index.js` | Extract pure `computeChanges`; add pure `mergeLocalRemote`; rework `rebuildAndPush` (store + no-rethrow); add `retryPush`, `loadLibrary`. |
| Modify | `public/music-index.test.js` | Add tests for `computeChanges`, `mergeLocalRemote`, store-aware `rebuildAndPush`, `retryPush`. |
| Modify | `public/music.html` | Shared store; merge-on-load; "not pushed" badges; preview-from-local; "Retry push" button; richer status. |
| Modify | `package.json` | Add `fake-indexeddb` devDependency. |

---

## Task 1: IndexedDB wrapper (`music-local-store.js`)

**Files:**
- Create: `public/music-local-store.js`
- Create: `public/music-local-store.test.js`
- Modify: `package.json` (add `fake-indexeddb` devDependency)

- [ ] **Step 1: Install `fake-indexeddb` as a devDependency**

Run:
```bash
npm install --save-dev fake-indexeddb
```
Expected: `package.json` gains `"fake-indexeddb"` under `devDependencies` (version ~`^6.2.5`), exit 0.

- [ ] **Step 2: Write the failing test**

Create `public/music-local-store.test.js`:

```js
// public/music-local-store.test.js
import { IDBFactory } from 'fake-indexeddb';
import { createMusicStore } from './music-local-store.js';

// Fresh isolated IndexedDB per store instance.
function freshStore() {
  return createMusicStore({ indexedDB: new IDBFactory() });
}

const entryA = { id: 'a', title: 'A', contentHash: 'h1', search: { chords: 'C' } };
const entryB = { id: 'b', title: 'B', contentHash: 'h2', search: { chords: 'G' } };
const detailA = { meta: { id: 'a' }, voices: [], format: 'musicxml', source: '<a/>' };
const detailB = { meta: { id: 'b' }, voices: [], format: 'note-text', source: 'b' };

describe('createMusicStore', () => {
  test('putPieces then getEntries returns entries with synced:false', async () => {
    const store = freshStore();
    await store.putPieces('western', [{ entry: entryA, detail: detailA }]);
    const rows = await store.getEntries('western');
    expect(rows).toEqual([{ entry: entryA, synced: false }]);
  });

  test('getDetail returns the stored detail, null when absent', async () => {
    const store = freshStore();
    await store.putPieces('western', [{ entry: entryA, detail: detailA }]);
    expect(await store.getDetail('western', 'a')).toEqual(detailA);
    expect(await store.getDetail('western', 'missing')).toBeNull();
  });

  test('systems are isolated (same id, different system)', async () => {
    const store = freshStore();
    await store.putPieces('western', [{ entry: entryA, detail: detailA }]);
    await store.putPieces('sargam', [{ entry: { ...entryA, title: 'A-sargam' }, detail: detailB }]);
    const w = await store.getEntries('western');
    const s = await store.getEntries('sargam');
    expect(w).toHaveLength(1);
    expect(s).toHaveLength(1);
    expect(w[0].entry.title).toBe('A');
    expect(s[0].entry.title).toBe('A-sargam');
    expect(await store.getDetail('sargam', 'a')).toEqual(detailB);
  });

  test('putPieces overwrites an existing id and resets synced:false', async () => {
    const store = freshStore();
    await store.putPieces('western', [{ entry: entryA, detail: detailA }]);
    await store.markSynced('western', ['a']);
    expect((await store.getEntries('western'))[0].synced).toBe(true);
    const entryA2 = { ...entryA, contentHash: 'h1b' };
    await store.putPieces('western', [{ entry: entryA2, detail: detailA }]);
    const rows = await store.getEntries('western');
    expect(rows).toHaveLength(1);
    expect(rows[0].entry.contentHash).toBe('h1b');
    expect(rows[0].synced).toBe(false);
  });

  test('markSynced flips only the named ids', async () => {
    const store = freshStore();
    await store.putPieces('western', [
      { entry: entryA, detail: detailA },
      { entry: entryB, detail: detailB },
    ]);
    await store.markSynced('western', ['a']);
    const rows = await store.getEntries('western');
    const byId = Object.fromEntries(rows.map(r => [r.entry.id, r.synced]));
    expect(byId).toEqual({ a: true, b: false });
  });

  test('getUnpushed returns only synced:false records paired with their detail', async () => {
    const store = freshStore();
    await store.putPieces('western', [
      { entry: entryA, detail: detailA },
      { entry: entryB, detail: detailB },
    ]);
    await store.markSynced('western', ['a']);
    const unpushed = await store.getUnpushed('western');
    expect(unpushed).toEqual([{ entry: entryB, detail: detailB }]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest public/music-local-store.test.js`
Expected: FAIL — `createMusicStore is not a function` / module not found.

- [ ] **Step 4: Write the implementation**

Create `public/music-local-store.js`:

```js
// public/music-local-store.js
// Thin promisified IndexedDB wrapper for the Music Manager's offline-first cache.
// Two object stores keyed `${system}:${id}`:
//   entries  { _key, system, id, entry, synced }
//   details  { _key, system, id, detail }
// `synced` is false when written during a Rebuild; flipped true only after the
// push carrying this content succeeds. The `system` index isolates western/sargam.

const DB_NAME = 'cupitor-music';
const DB_VERSION = 1;

const keyOf = (system, id) => `${system}:${id}`;

function reqDone(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function createMusicStore({ indexedDB } = {}) {
  const idb = indexedDB || (typeof globalThis !== 'undefined' ? globalThis.indexedDB : undefined);
  if (!idb) throw new Error('IndexedDB is not available');
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = idb.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of ['entries', 'details']) {
          if (!db.objectStoreNames.contains(name)) {
            const s = db.createObjectStore(name, { keyPath: '_key' });
            s.createIndex('system', 'system', { unique: false });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function getAllBySystem(storeName, system) {
    const db = await open();
    const tx = db.transaction(storeName, 'readonly');
    return reqDone(tx.objectStore(storeName).index('system').getAll(system));
  }

  return {
    async putPieces(system, items) {
      const db = await open();
      const tx = db.transaction(['entries', 'details'], 'readwrite');
      const entries = tx.objectStore('entries');
      const details = tx.objectStore('details');
      for (const { entry, detail } of items) {
        const _key = keyOf(system, entry.id);
        entries.put({ _key, system, id: entry.id, entry, synced: false });
        details.put({ _key, system, id: entry.id, detail });
      }
      await txDone(tx);
    },

    async getEntries(system) {
      const rows = await getAllBySystem('entries', system);
      return rows.map(r => ({ entry: r.entry, synced: r.synced }));
    },

    async getDetail(system, id) {
      const db = await open();
      const tx = db.transaction('details', 'readonly');
      const row = await reqDone(tx.objectStore('details').get(keyOf(system, id)));
      return row ? row.detail : null;
    },

    async markSynced(system, ids) {
      const idSet = new Set(ids);
      const rows = await getAllBySystem('entries', system);  // readonly tx completes first
      const toUpdate = rows.filter(r => idSet.has(r.id));
      if (!toUpdate.length) return;
      const db = await open();
      const tx = db.transaction('entries', 'readwrite');
      const store = tx.objectStore('entries');
      for (const row of toUpdate) { row.synced = true; store.put(row); }  // no await between puts
      await txDone(tx);
    },

    async getUnpushed(system) {
      const [entryRows, detailRows] = await Promise.all([
        getAllBySystem('entries', system),
        getAllBySystem('details', system),
      ]);
      const detailById = new Map(detailRows.map(r => [r.id, r.detail]));
      return entryRows
        .filter(r => r.synced === false)
        .map(r => ({ entry: r.entry, detail: detailById.get(r.id) || null }));
    },
  };
}
```

**Note for the implementer:** Do **not** `await` an IndexedDB request *inside* a `readwrite` transaction before issuing the next write — the transaction can auto-commit while you await. `markSynced` deliberately reads everything in a finished readonly transaction first, then issues all `put`s synchronously in one readwrite transaction. Keep that shape.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest public/music-local-store.test.js`
Expected: PASS — 6 tests green.

- [ ] **Step 6: Commit**

```bash
git add public/music-local-store.js public/music-local-store.test.js package.json package-lock.json
git commit -m "feat(music): IndexedDB local store wrapper for offline-first cache"
```

---

## Task 2: Extract pure `computeChanges` from `rebuildAndPush`

**Files:**
- Modify: `public/music-index.js:89-119` (refactor `rebuildAndPush` to delegate to a new exported `computeChanges`)
- Modify: `public/music-index.test.js` (add `computeChanges` tests; existing tests must stay green)

- [ ] **Step 1: Write the failing test**

Add to `public/music-index.test.js` (new `describe` block, and add `computeChanges` to the import on line 3):

```js
describe('computeChanges (pure)', () => {
  test('returns changed ids, paired entry+detail, and merged index', () => {
    const { changed, changedPieces, index } = computeChanges({
      system: 'western',
      pieces: [{ id: 'triad', format: 'note-text', source: 'C4 E4 G4', key: 'C' }],
      currentIndex: [], updatedAt: '2026-06-20',
    });
    expect(changed).toEqual(['triad']);
    expect(changedPieces).toHaveLength(1);
    expect(changedPieces[0].entry.id).toBe('triad');
    expect(changedPieces[0].entry.system).toBe('western');
    expect(changedPieces[0].entry.updatedAt).toBe('2026-06-20');
    expect(changedPieces[0].detail.format).toBe('note-text');
    expect(index.find(e => e.id === 'triad')).toBeTruthy();
  });

  test('skips a piece whose contentHash is unchanged, unless force', () => {
    const args = {
      system: 'western',
      pieces: [{ id: 'x', format: 'note-text', source: 'C4 E4 G4', key: 'C' }],
      currentIndex: [],
    };
    const first = computeChanges(args);
    const second = computeChanges({ ...args, currentIndex: first.index });
    expect(second.changed).toEqual([]);
    const forced = computeChanges({ ...args, currentIndex: first.index, force: true });
    expect(forced.changed).toEqual(['x']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-index.test.js`
Expected: FAIL — `computeChanges is not defined` (import resolves to undefined).

- [ ] **Step 3: Refactor `rebuildAndPush` to delegate to `computeChanges`**

In `public/music-index.js`, replace the existing `rebuildAndPush` (lines 88-119) with:

```js
// Pure: encode + diff pieces against the current index. No network, no storage.
export function computeChanges({ system, pieces, currentIndex = [], force = false, updatedAt = null }) {
  const currentById = new Map(currentIndex.map(e => [e.id, e]));
  const changedPieces = [];   // [{ entry, detail }]
  const changed = [];
  for (const piece of pieces) {
    const doc = encodePiece(piece);
    doc.meta.system = system;
    const { entry, detail } = splitTiers(doc, piece.source);
    entry.updatedAt = updatedAt;
    const prev = currentById.get(entry.id);
    if (!force && prev && prev.contentHash === entry.contentHash) continue; // unchanged
    changedPieces.push({ entry, detail });
    changed.push(entry.id);
  }
  const index = mergeIndex(currentIndex, changedPieces.map(p => p.entry));
  return { changed, changedPieces, index };
}

// committer: async (files:[{path, getContent(current)}]) => any   (wraps GitHubUtils.commitMultipleFiles)
export async function rebuildAndPush({ system, pieces, currentIndex = [], committer, force = false, updatedAt = null }) {
  const { changed, changedPieces, index } = computeChanges({ system, pieces, currentIndex, force, updatedAt });
  if (changed.length === 0) return { changed, index, pushed: false };

  const files = [
    { path: `db/music/${system}/index.json`, getContent: () => JSON.stringify(index, null, 2) },
    ...changedPieces.map(({ entry, detail }) => ({
      path: `db/music/${system}/details/${entry.id}.json`,
      getContent: () => JSON.stringify(detail)
    }))
  ];
  await committer(files);
  return { changed, index, pushed: true };
}
```

(Store wiring + no-rethrow comes in Task 4 — this task only extracts the pure core and keeps behavior identical.)

- [ ] **Step 4: Run the tests to verify all pass**

Run: `npx jest public/music-index.test.js`
Expected: PASS — the two new `computeChanges` tests plus all pre-existing tests (including the three `rebuildAndPush` payload-assembly tests) green.

- [ ] **Step 5: Commit**

```bash
git add public/music-index.js public/music-index.test.js
git commit -m "refactor(music): extract pure computeChanges from rebuildAndPush"
```

---

## Task 3: Pure `mergeLocalRemote`

**Files:**
- Modify: `public/music-index.js` (add `mergeLocalRemote`)
- Modify: `public/music-index.test.js` (add `mergeLocalRemote` tests)

- [ ] **Step 1: Write the failing test**

Add to `public/music-index.test.js` (and add `mergeLocalRemote` to the import on line 3):

```js
describe('mergeLocalRemote (pure)', () => {
  const remote = [{ id: 'a', title: 'A-remote' }, { id: 'b', title: 'B-remote' }];

  test('remote-only: passes through, no unpushed', () => {
    const { index, unpushedIds } = mergeLocalRemote(remote, []);
    expect(index.map(e => e.id).sort()).toEqual(['a', 'b']);
    expect(unpushedIds.size).toBe(0);
  });

  test('local unpushed overrides remote and is flagged', () => {
    const local = [{ entry: { id: 'a', title: 'A-local' }, synced: false }];
    const { index, unpushedIds } = mergeLocalRemote(remote, local);
    expect(index.find(e => e.id === 'a').title).toBe('A-local');
    expect(unpushedIds.has('a')).toBe(true);
    expect(unpushedIds.size).toBe(1);
  });

  test('local synced absent from remote is included as pushed', () => {
    const local = [{ entry: { id: 'c', title: 'C-local' }, synced: true }];
    const { index, unpushedIds } = mergeLocalRemote(remote, local);
    expect(index.map(e => e.id).sort()).toEqual(['a', 'b', 'c']);
    expect(unpushedIds.size).toBe(0);
  });

  test('local synced already in remote: remote wins, not flagged', () => {
    const local = [{ entry: { id: 'a', title: 'A-stale-local' }, synced: true }];
    const { index, unpushedIds } = mergeLocalRemote(remote, local);
    expect(index.find(e => e.id === 'a').title).toBe('A-remote');
    expect(unpushedIds.size).toBe(0);
  });

  test('handles empty / missing inputs', () => {
    const { index, unpushedIds } = mergeLocalRemote([], []);
    expect(index).toEqual([]);
    expect(unpushedIds.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-index.test.js -t mergeLocalRemote`
Expected: FAIL — `mergeLocalRemote is not defined`.

- [ ] **Step 3: Write the implementation**

Add to `public/music-index.js` (after `mergeIndex`):

```js
// Pure: overlay local store records onto the remote index for display.
// Local unpushed (synced:false) records override remote (they are newer) and are
// flagged in `unpushedIds`. Local synced records fill gaps the remote fetch missed.
export function mergeLocalRemote(remoteIndex = [], localRecords = []) {
  const byId = new Map((remoteIndex || []).map(e => [e.id, e]));
  const unpushedIds = new Set();
  for (const rec of (localRecords || [])) {
    const e = rec && rec.entry;
    if (!e) continue;
    if (rec.synced === false) {
      byId.set(e.id, e);
      unpushedIds.add(e.id);
    } else if (!byId.has(e.id)) {
      byId.set(e.id, e);
    }
  }
  return { index: Array.from(byId.values()), unpushedIds };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest public/music-index.test.js -t mergeLocalRemote`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add public/music-index.js public/music-index.test.js
git commit -m "feat(music): mergeLocalRemote — overlay local cache on remote index"
```

---

## Task 4: Store-aware `rebuildAndPush` (write-local-first, no rethrow)

**Files:**
- Modify: `public/music-index.js` (rework `rebuildAndPush`; add `NOOP_STORE`)
- Modify: `public/music-index.test.js` (add store-aware tests)

- [ ] **Step 1: Write the failing test**

Add to `public/music-index.test.js`:

```js
describe('rebuildAndPush with local store', () => {
  function fakeStore() {
    const calls = { put: [], synced: [] };
    return {
      calls,
      async putPieces(system, items) { calls.put.push({ system, ids: items.map(i => i.entry.id) }); },
      async markSynced(system, ids) { calls.synced.push({ system, ids }); },
      async getEntries() { return []; },
      async getDetail() { return null; },
      async getUnpushed() { return []; },
    };
  }
  const piece = { id: 'p1', format: 'note-text', source: 'C4 E4 G4', key: 'C' };

  test('writes to the store before pushing, then marks synced on success', async () => {
    const order = [];
    const store = fakeStore();
    const origPut = store.putPieces;
    store.putPieces = async (...a) => { order.push('put'); return origPut(...a); };
    const committer = async () => { order.push('push'); };
    const res = await rebuildAndPush({ system: 'western', pieces: [piece], currentIndex: [], committer, store });
    expect(res.pushed).toBe(true);
    expect(order).toEqual(['put', 'push']);
    expect(store.calls.put[0].ids).toEqual(['p1']);
    expect(store.calls.synced[0].ids).toEqual(['p1']);
  });

  test('push failure: returns pushed:false + pushError, store still written, no rethrow, NOT marked synced', async () => {
    const store = fakeStore();
    const committer = async () => { throw new Error('offline'); };
    const res = await rebuildAndPush({ system: 'western', pieces: [piece], currentIndex: [], committer, store });
    expect(res.pushed).toBe(false);
    expect(res.pushError).toBe('offline');
    expect(store.calls.put[0].ids).toEqual(['p1']); // saved locally
    expect(store.calls.synced).toEqual([]);         // never marked synced
  });

  test('local write failure: surfaces localError but still attempts push', async () => {
    const store = fakeStore();
    store.putPieces = async () => { throw new Error('quota'); };
    let pushed = false;
    const committer = async () => { pushed = true; };
    const res = await rebuildAndPush({ system: 'western', pieces: [piece], currentIndex: [], committer, store });
    expect(res.localError).toBe('quota');
    expect(pushed).toBe(true);
    expect(res.pushed).toBe(true);
  });

  test('no changes: short-circuits without touching store or committer', async () => {
    const store = fakeStore();
    let committed = false;
    const committer = async () => { committed = true; };
    const built = computeChanges({ system: 'western', pieces: [piece], currentIndex: [] });
    const res = await rebuildAndPush({ system: 'western', pieces: [piece], currentIndex: built.index, committer, store });
    expect(res.changed).toEqual([]);
    expect(res.pushed).toBe(false);
    expect(committed).toBe(false);
    expect(store.calls.put).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-index.test.js -t "with local store"`
Expected: FAIL — current `rebuildAndPush` rethrows on committer error and ignores `store` (no `pushError`/`localError`, `order`/`synced` assertions fail).

- [ ] **Step 3: Rework `rebuildAndPush`**

In `public/music-index.js`, replace the `rebuildAndPush` body written in Task 2 with:

```js
const NOOP_STORE = {
  async putPieces() {}, async markSynced() {},
  async getEntries() { return []; }, async getDetail() { return null; }, async getUnpushed() { return []; }
};

// committer: async (files:[{path, getContent(current)}]) => any
// store: created via createMusicStore() (music-local-store.js); defaults to a no-op
//        so callers/tests that don't care about local persistence still work.
// Writes changed pieces to the local store BEFORE pushing, so a push failure never
// loses data. Never rethrows a push failure — reports it via { pushed:false, pushError }.
export async function rebuildAndPush({ system, pieces, currentIndex = [], committer, store = NOOP_STORE, force = false, updatedAt = null }) {
  const { changed, changedPieces, index } = computeChanges({ system, pieces, currentIndex, force, updatedAt });
  if (changed.length === 0) return { changed, index, pushed: false };

  let localError = null;
  try { await store.putPieces(system, changedPieces); }
  catch (e) { localError = e.message; }

  const files = [
    { path: `db/music/${system}/index.json`, getContent: () => JSON.stringify(index, null, 2) },
    ...changedPieces.map(({ entry, detail }) => ({
      path: `db/music/${system}/details/${entry.id}.json`,
      getContent: () => JSON.stringify(detail)
    }))
  ];

  let pushed = false, pushError = null;
  try { await committer(files); pushed = true; }
  catch (e) { pushError = e.message; }

  if (pushed) {
    try { await store.markSynced(system, changed); }
    catch (e) { if (!localError) localError = e.message; }
  }
  return { changed, index, pushed, pushError, localError };
}
```

- [ ] **Step 4: Run the full music-index suite to verify all pass**

Run: `npx jest public/music-index.test.js`
Expected: PASS — new store-aware tests green AND the three original `rebuildAndPush` payload-assembly tests still green (they pass no `store`, so `NOOP_STORE` is used and `committer` succeeds → `pushed:true`).

- [ ] **Step 5: Commit**

```bash
git add public/music-index.js public/music-index.test.js
git commit -m "feat(music): rebuildAndPush writes local store first, never rethrows push failure"
```

---

## Task 5: `retryPush` and `loadLibrary`

**Files:**
- Modify: `public/music-index.js` (add `retryPush`, `loadLibrary`)
- Modify: `public/music-index.test.js` (add `retryPush` tests)

- [ ] **Step 1: Write the failing test**

Add to `public/music-index.test.js`:

```js
describe('retryPush', () => {
  const unpushedFixture = [
    { entry: { id: 'u1', title: 'U1' }, detail: { meta: { id: 'u1' }, format: 'note-text', source: 'x' } },
  ];
  function storeWithUnpushed(list) {
    const calls = { synced: [] };
    return {
      calls,
      async getUnpushed() { return list; },
      async markSynced(system, ids) { calls.synced.push({ system, ids }); },
    };
  }

  test('pushes index.json (full current index) + a detail file per unpushed piece, then marks synced', async () => {
    let pushedFiles = null;
    const committer = async (files) => { pushedFiles = files; };
    const store = storeWithUnpushed(unpushedFixture);
    const currentIndex = [{ id: 'u1', title: 'U1' }, { id: 'already', title: 'Already' }];
    const res = await retryPush({ system: 'western', currentIndex, committer, store });
    expect(res.pushed).toBe(true);
    expect(res.changed).toEqual(['u1']);
    const paths = pushedFiles.map(f => f.path);
    expect(paths).toContain('db/music/western/index.json');
    expect(paths).toContain('db/music/western/details/u1.json');
    expect(paths).not.toContain('db/music/western/details/already.json');
    const idx = JSON.parse(await pushedFiles.find(f => f.path === 'db/music/western/index.json').getContent(null));
    expect(idx.map(e => e.id).sort()).toEqual(['already', 'u1']);
    expect(store.calls.synced[0].ids).toEqual(['u1']);
  });

  test('no unpushed pieces: no-op, committer not called', async () => {
    let committed = false;
    const committer = async () => { committed = true; };
    const res = await retryPush({ system: 'western', currentIndex: [], committer, store: storeWithUnpushed([]) });
    expect(res).toEqual({ pushed: false, changed: [] });
    expect(committed).toBe(false);
  });

  test('committer throws: returns pushed:false + pushError, does not mark synced, no rethrow', async () => {
    const store = storeWithUnpushed(unpushedFixture);
    const committer = async () => { throw new Error('rate limit'); };
    const res = await retryPush({ system: 'western', currentIndex: [{ id: 'u1' }], committer, store });
    expect(res.pushed).toBe(false);
    expect(res.pushError).toBe('rate limit');
    expect(res.changed).toEqual([]);
    expect(store.calls.synced).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest public/music-index.test.js -t retryPush`
Expected: FAIL — `retryPush is not defined`.

- [ ] **Step 3: Write the implementation**

Add to `public/music-index.js`:

```js
// Re-push pieces still sitting in the local store as synced:false. Pushes the full
// current index plus one detail file per unpushed piece. Never rethrows.
export async function retryPush({ system, currentIndex = [], committer, store }) {
  const unpushed = await store.getUnpushed(system);
  if (!unpushed.length) return { pushed: false, changed: [] };
  const files = [
    { path: `db/music/${system}/index.json`, getContent: () => JSON.stringify(currentIndex, null, 2) },
    ...unpushed.map(({ entry, detail }) => ({
      path: `db/music/${system}/details/${entry.id}.json`,
      getContent: () => JSON.stringify(detail)
    }))
  ];
  const ids = unpushed.map(u => u.entry.id);
  try {
    await committer(files);
    await store.markSynced(system, ids);
    return { pushed: true, changed: ids };
  } catch (e) {
    return { pushed: false, pushError: e.message, changed: [] };
  }
}

// Merge the remote index with the local store for the Manager's initial render.
export async function loadLibrary(system, store) {
  const remote = await loadIndex(system).catch(() => []);
  const local = await store.getEntries(system).catch(() => []);
  return mergeLocalRemote(remote, local);
}
```

- [ ] **Step 4: Run the full music-index suite to verify all pass**

Run: `npx jest public/music-index.test.js`
Expected: PASS — `retryPush` tests green, everything else still green.

- [ ] **Step 5: Commit**

```bash
git add public/music-index.js public/music-index.test.js
git commit -m "feat(music): retryPush + loadLibrary for offline-first cache"
```

---

## Task 6: Wire the Manager (`music.html`)

**Files:**
- Modify: `public/music.html` (imports, shared store, merge-on-load, badges, preview-from-local, Retry push button, status)

No unit tests (DOM glue); verified with `node --check` and a manual browser pass.

- [ ] **Step 1: Update imports and add the Retry button to the controls**

In `public/music.html`, change the import on line 166-167 to:

```js
  import { getSystemFromUrl, getMusicResourceUrl, loadLibrary, rebuildAndPush, retryPush } from './music-index.js';
  import { createMusicRenderer } from './music-render.js';
  import { createMusicStore } from './music-local-store.js';
```

In the `.controls` div (after the `rebuildBtn` button, line 145), add:

```html
  <button id="retryBtn" style="display:none"></button>
```

- [ ] **Step 2: Add the shared store, `unpushedIds`, and badge + retry-button helpers**

Replace the state declarations (lines 169-179, from `const system = ...` through `function setStatus(...)`) with:

```js
  const system = getSystemFromUrl().name;
  document.getElementById('systemLabel').textContent = system;

  // jQuery is already global in music.html (loaded via <script>); musicxml.js needs it.
  let index = [];
  let unpushedIds = new Set();
  const store = createMusicStore();
  const pending = [];  // newly added pieces not yet pushed: {id,title,format,source,key}

  function idFromName(name) {
    return name.replace(/\.(xml|musicxml|txt)$/i, '').trim().replace(/\s+/g, '_').replace(/[\/\\:*?"<>|]/g, '');
  }
  function setStatus(s) { document.getElementById('status').textContent = s; }

  function updateRetryBtn() {
    const btn = document.getElementById('retryBtn');
    if (unpushedIds.size) { btn.style.display = ''; btn.textContent = `Retry push (${unpushedIds.size})`; }
    else { btn.style.display = 'none'; }
  }

  function makeCommitter(label) {
    return (files) => window.GitHubUtils.commitMultipleFiles({
      owner: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages',
      commitMessage: `music(${system}): rebuild ${label}`, files
    });
  }
```

- [ ] **Step 3: Show a "not pushed" badge in `render()`**

Replace the `index.forEach` row template inside `render()` (lines 183-184) with:

```js
    index.forEach(e => rows.push(
      `<label style="display:block"><input type="checkbox" class="sel" data-id="${e.id}"> ${e.title || e.id} <small>(${e.noteCount} notes, ${e.channels.join('/')})</small> <button class="previewBtn" data-id="${e.id}">Preview</button>${unpushedIds.has(e.id) ? ' <span style="color:#c00;font-weight:600">● not pushed</span>' : ''}</label>`));
```

- [ ] **Step 4: Rework the Rebuild handler to inject the store and report local/push outcomes**

Replace the `rebuildBtn.onclick` handler (lines 209-233) with:

```js
  document.getElementById('rebuildBtn').onclick = async () => {
    const selectedIds = new Set(Array.from(document.querySelectorAll('.sel:checked')).map(c => c.dataset.id));
    const reselected = index
      .filter(e => selectedIds.has(e.id))
      .map(e => ({ id: e.id, title: e.title, format: e.format, source: null, key: e.key }));
    // For already-indexed pieces we need their source; prefer the local store, else fetch the detail file.
    for (const r of reselected) {
      let detail = await store.getDetail(system, r.id).catch(() => null);
      if (!detail) detail = await fetch(`${getMusicResourceUrl(system)}/details/${r.id}.json`).then(x => x.json());
      r.source = detail.source; r.format = detail.format;
    }
    const pieces = [...pending, ...reselected];
    if (!pieces.length) { setStatus('Nothing selected.'); return; }
    setStatus('Saving…');
    const committer = makeCommitter(pieces.map(p => p.id).join(', '));
    try {
      const res = await rebuildAndPush({ system, pieces, currentIndex: index, committer, store,
        force: selectedIds.size > 0, updatedAt: new Date().toISOString().slice(0, 10) });
      index = res.index; pending.length = 0;
      res.changed.forEach(id => { if (res.pushed) unpushedIds.delete(id); else unpushedIds.add(id); });
      render(); updateRetryBtn();
      let msg = res.pushed ? `Pushed: ${res.changed.join(', ')}`
              : (res.changed.length ? `Saved locally; push failed: ${res.pushError}` : 'No changes.');
      if (res.localError) msg += ` (local save error: ${res.localError})`;
      setStatus(msg);
    } catch (e) { setStatus('Error: ' + e.message); }
  };

  document.getElementById('retryBtn').onclick = async () => {
    setStatus('Retrying push…');
    try {
      const res = await retryPush({ system, currentIndex: index, committer: makeCommitter('retry unpushed'), store });
      res.changed.forEach(id => unpushedIds.delete(id));
      render(); updateRetryBtn();
      setStatus(res.pushed ? `Pushed: ${res.changed.join(', ')}`
              : (res.pushError ? 'Retry failed: ' + res.pushError : 'Nothing to retry.'));
    } catch (e) { setStatus('Retry failed: ' + e.message); }
  };
```

- [ ] **Step 5: Preview from the local store for unpushed pieces**

In `openPreview` (lines 240-257), replace the detail fetch (lines 245-248) with:

```js
    let detail;
    try {
      detail = unpushedIds.has(id)
        ? await store.getDetail(system, id)
        : await fetch(`${getMusicResourceUrl(system)}/details/${id}.json`).then(x => x.json());
      if (!detail) throw new Error('detail not found');
    } catch (e) { document.getElementById('previewMsg').textContent = 'Failed to load detail.'; return; }
```

- [ ] **Step 6: Load via `loadLibrary` and initialise the retry button**

Replace the bootstrap line (line 270):

```js
  (async () => { try { index = await loadIndex(system); } catch (_) { index = []; } render(); })();
```

with:

```js
  (async () => {
    try { const lib = await loadLibrary(system, store); index = lib.index; unpushedIds = lib.unpushedIds; }
    catch (_) { index = []; unpushedIds = new Set(); }
    render(); updateRetryBtn();
  })();
```

- [ ] **Step 7: Syntax-check the module**

Run:
```bash
node --input-type=module --check < <(sed -n '/<script type="module">/,/<\/script>/p' public/music.html | sed '1d;$d')
```
Expected: exit 0, no output. (Strips the `<script type="module">` wrapper and checks the ESM body.)

If `sed`/process-substitution is awkward in the shell, instead copy the module body into a scratch `.mjs` file and run `node --check scratch.mjs`. Expected: no syntax errors.

- [ ] **Step 8: Run the whole suite to confirm nothing regressed**

Run: `npx jest public/`
Expected: same baseline as before this plan — all music tests pass; the only failure is the pre-existing `public/music_search.test.js` "9. Too large jump → should fail" (unrelated to this work).

- [ ] **Step 9: Commit**

```bash
git add public/music.html
git commit -m "feat(music): Manager offline-first cache — merge-on-load, badges, retry, local preview"
```

- [ ] **Step 10: Manual browser verification (human step)**

1. Start the dev server (`npx vue-cli-service serve`) and open `http://localhost:<port>/music.html?system=western`.
2. Add a MusicXML piece, then **with the network/GitHub push set to fail** (e.g. offline, or an invalid token) click **Rebuild & Push**. Status should read `Saved locally; push failed: …`, the row should show **● not pushed**, and **Retry push (1)** should appear.
3. Reload the page. The unpushed piece is still listed (from IndexedDB) and still badged.
4. Click **Preview** on the unpushed piece → it renders from the local store (no network).
5. Restore connectivity and click **Retry push** → status `Pushed: …`, badge and Retry button clear.
6. Confirm in DevTools ▸ Application ▸ IndexedDB that database `cupitor-music` exists with `entries`/`details` stores.

---

## Notes for the implementer

- **DRY:** the file-array shape (`{path, getContent}`) is identical in `rebuildAndPush` and `retryPush` by design — both feed the same `committer`. Don't try to over-abstract it; the two call sites differ in which index/details they include.
- **No rethrow on push:** both `rebuildAndPush` and `retryPush` must resolve (never reject) on a push failure — the Manager relies on `res.pushed`/`res.pushError`, not a thrown error.
- **IndexedDB transaction discipline:** never `await` a request inside a `readwrite` transaction before the next write (see the note in Task 1, Step 4).
- **Backwards compat:** never change the three original `rebuildAndPush` tests; they pin the no-store default path.
