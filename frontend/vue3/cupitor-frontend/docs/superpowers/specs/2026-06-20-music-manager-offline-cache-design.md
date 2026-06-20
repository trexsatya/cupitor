# Music Manager — Offline-First IndexedDB Cache (Design)

**Status:** Approved
**Date:** 2026-06-20
**Branch:** `music-study-app`

## Problem

In the Music Manager (`public/music.html`), **Rebuild & Push** builds the merged
Tier-1 index plus the changed Tier-2 detail files and calls `committer(files)` to
push them to the `gh-pages` branch. Today, if that push throws (offline, GitHub
auth/rate-limit, network error), the `catch` only sets a status string. Nothing is
persisted anywhere: the newly added pieces live only in the in-memory `pending`
array, and `loadIndex` reads exclusively from `gh-pages`. So a failed push — or a
reload before a successful push — silently loses the user's work.

**Goal:** Rebuild & Push must persist pieces into a local database first, so that a
push failure never loses data. Locally-held-but-unpushed pieces survive reloads,
appear in the Manager (badged), are previewable, and can be retried.

## Decisions (locked during brainstorming)

1. **Storage mechanism: IndexedDB.** Detail blobs include full MusicXML source and
   can exceed the ~5 MB localStorage budget, so IndexedDB is the right store. (The
   language app uses localStorage only for small JSON; that precedent does not fit
   here.)
2. **Role: offline-first cache.** Every Rebuild writes index entries + detail blobs
   to IndexedDB *before* attempting the push. On load, the local store is merged
   over the remote index so unpushed pieces appear (badged "not pushed"); Preview
   reads detail from the local store for unpushed pieces; a "Retry push" affordance
   re-sends unpushed pieces.
3. **Architecture: pure core + thin IDB module + Manager wiring.** Keeps the
   push-decision logic pure and unit-testable, isolates IndexedDB behind a thin
   wrapper, and mirrors the testable-core / thin-glue boundary already used by the
   OSMD wrapper (`music-render.js`).

## Data Model (IndexedDB)

Database `cupitor-music`, version 1. Two object stores, each keyed
`_key = "${system}:${id}"` with a non-unique `system` index:

- **`entries`** — `{ _key, system, id, entry, synced }`
  - `entry`: the Tier-1 index entry produced by `buildIndexEntry` (includes
    `contentHash`, `detailPath`, `search`, etc.).
  - `synced`: `false` when written during a Rebuild; flipped to `true` only after
    the push carrying this content succeeds.
- **`details`** — `{ _key, system, id, detail }`
  - `detail`: the Tier-2 object `{ meta, voices, format, source }`.

A piece is **unpushed/dirty** iff its `entries` record has `synced === false`.

`system` ∈ `{ western, sargam }`; the `system` index keeps the two libraries
isolated within a single shared database.

## Modules

### `public/music-local-store.js` (new) — thin promisified IndexedDB wrapper

`createMusicStore({ indexedDB } = {})` — `indexedDB` defaults to
`globalThis.indexedDB`; injectable so tests pass `fake-indexeddb`. Lazily opens and
caches the connection. Returns:

- `putPieces(system, items)` — `items: [{ entry, detail }]`. Writes both stores in a
  single `readwrite` transaction over `['entries','details']`, each `entries`
  record with `synced: false`. Used by Rebuild.
- `getEntries(system)` → `[{ entry, synced }]` (via the `system` index).
- `getDetail(system, id)` → `detail | null`.
- `markSynced(system, ids)` — set `synced: true` on those `entries` records.
- `getUnpushed(system)` → `[{ entry, detail }]` for records with `synced === false`.

No `deletePiece` for now (YAGNI).

### `public/music-index.js` (refactor + additions)

- **Extract** today's rebuild loop into pure
  `computeChanges({ system, pieces, currentIndex, force, updatedAt })` →
  `{ changed, changedPieces, index }`, where `changed` is `[id]`, `changedPieces` is
  `[{ entry, detail }]` (paired, so both `putPieces` and the file builder consume one
  shape), and `index` is `mergeIndex(currentIndex, changedPieces.map(p => p.entry))`.
  No network, no storage. (`entry.updatedAt` is stamped here from the passed
  `updatedAt`, as today.)
- **Add** pure `mergeLocalRemote(remoteIndex, localRecords)` →
  `{ index, unpushedIds }`:
  - Build a Map by `id` from `remoteIndex` (these are pushed).
  - For each local record: if `synced === false`, the local entry overrides
    (it is newer) and its id is added to `unpushedIds`; if `synced === true` and the
    id is absent from the map (remote fetch missed it), include the local entry as
    pushed.
  - `index` = `Array.from(map.values())`; `unpushedIds` = `Set<string>`.
- **Rework** `rebuildAndPush({ system, pieces, currentIndex, committer, store, force, updatedAt })`:
  1. `const { changed, changedPieces, index } = computeChanges(...)`.
  2. If `changed.length === 0` → return `{ changed: [], index, pushed: false }`.
  3. **Write local first:** `await store.putPieces(system, changedPieces)` (records
     written `synced:false`). Wrap in try/catch; on failure capture `localError` but
     continue.
  4. Build `files` (`index.json` + a detail file per `changedPieces` entry) exactly
     as today.
  5. `try { await committer(files); pushed = true } catch (e) { pushed = false; pushError = e.message }` — **never rethrow.**
  6. On `pushed`, `await store.markSynced(system, changed)`.
  7. Return `{ changed, index, pushed, pushError, localError }`.
- **Add** `retryPush({ system, currentIndex, committer, store })`:
  - `const unpushed = await store.getUnpushed(system)`; if empty → `{ pushed: false, changed: [] }`.
  - Build `files`: `index.json` = `JSON.stringify(currentIndex, null, 2)` (the full
    merged index the Manager already holds), plus a detail file per unpushed piece.
  - `await committer(files)`; on success `await store.markSynced(system, unpushed.map(u => u.entry.id))`; return `{ pushed: true, changed: <ids> }`. On throw, return `{ pushed: false, pushError, changed: [] }` (no rethrow).
- **Add** `loadLibrary(system, store)`:
  - `const remote = await loadIndex(system).catch(() => [])`.
  - `const local = await store.getEntries(system).catch(() => [])`.
  - `return mergeLocalRemote(remote, local)` → `{ index, unpushedIds }`.

`loadIndex` is unchanged (remote-only fetch); `loadLibrary` is the merged entry
point the Manager uses.

### `public/music.html` (Manager wiring)

- Create one shared `store = createMusicStore()`.
- On startup, call `loadLibrary(system, store)`; keep `index` as the raw merged
  entries and `unpushedIds` as a `Set`. Render a **"not pushed"** badge for any row
  whose id ∈ `unpushedIds`.
- Pass `store` into `rebuildAndPush`. After it returns: update `index`, recompute
  `unpushedIds` (add `changed` ids when `pushed === false`, remove them when
  `pushed === true`), re-render, and set status — including `pushError` /
  `localError` when present (e.g. `Saved locally; push failed: <msg>`).
- **Preview:** in `openPreview`, if the id ∈ `unpushedIds`, load detail via
  `store.getDetail(system, id)`; otherwise fetch the remote detail file as today.
- **Retry push:** show a **"Retry push (N)"** button when `unpushedIds` is
  non-empty; on click call `retryPush(...)` with the same `committer`, then refresh
  `unpushedIds` and status.

## Data Flow

```
Rebuild & Push
  computeChanges ─► putPieces(synced:false)  [LOCAL FIRST — safety net]
                 └► committer(files)
                       success ─► markSynced(changed)   ─► pushed:true
                       throw   ─► (caught, no rethrow)   ─► pushed:false + pushError
Load
  loadIndex(remote).catch([])  ┐
  store.getEntries(local)      ┴► mergeLocalRemote ─► { index, unpushedIds }
Preview(id)
  id ∈ unpushedIds ? store.getDetail : fetch remote detail
Retry push
  store.getUnpushed ─► committer(index.json + details) ─► markSynced
```

## Error Handling

- **Push fails:** data is already in IndexedDB (`synced:false`); status reports the
  failure; the piece stays badged and retryable. No data loss.
- **Local write fails** (quota exceeded, IndexedDB blocked/unavailable, private
  mode): capture `localError`, surface it in the status line, but **still attempt
  the push** so the piece can at least reach remote. Ordering is: write local →
  then push.
- **Remote index fetch fails on load:** `loadIndex` is `.catch(() => [])`, so the
  Manager still renders from the local store (unpushed pieces visible).

## Testing

`fake-indexeddb` is added as a devDependency (jsdom provides no IndexedDB).

- **`public/music-local-store.test.js`** (new): put/get round-trips for entries and
  details; `system` isolation (western vs sargam keys don't collide); overwrite of
  an existing id; `markSynced` flips only the named ids; `getUnpushed` returns only
  `synced:false` records with their details.
- **`public/music-index` tests** (extend / add):
  - `computeChanges`: unchanged piece skipped via matching `contentHash`; `force`
    includes it anyway; `index` is the correct merge; `updatedAt` stamped.
  - `mergeLocalRemote`: remote-only; local-unpushed overrides remote + appears in
    `unpushedIds`; local-synced absent from remote is included as pushed; dedup by
    id; empty inputs.
  - `rebuildAndPush` (fake `store` + fake `committer`): writes local **before**
    push; `markSynced` called with `changed` on success; on committer throw returns
    `{ pushed:false, pushError }`, leaves records `synced:false`, **does not
    rethrow**; `changed.length===0` short-circuit.
  - `retryPush`: pushes only unpushed pieces + the full index.json; `markSynced` on
    success; no-op when nothing unpushed; no rethrow on committer failure.
- **Manager DOM wiring** (`music.html`): not unit-tested; verified by `node --check`
  and manual browser steps (badge appears on a piece pushed while offline; Retry
  push clears it; Preview of an unpushed piece renders from the local store).

## Files

| Action | File |
|--------|------|
| Create | `public/music-local-store.js` |
| Create | `public/music-local-store.test.js` |
| Modify | `public/music-index.js` (extract `computeChanges`; rework `rebuildAndPush`; add `mergeLocalRemote`, `retryPush`, `loadLibrary`) |
| Modify/Create | `public/music-index.test.js` (pure helpers + `rebuildAndPush`/`retryPush`) |
| Modify | `public/music.html` (load merge, badges, preview-from-local, Retry push, status) |
| Modify | `package.json` (devDependency `fake-indexeddb`) |

## Scope / YAGNI

- Only **unpushed** pieces are fully local (entry + detail) and previewable
  offline. Already-pushed pieces still load their detail from remote on Preview.
- No full offline mirror of the remote library; no eviction policy; no
  `deletePiece`. These are possible later extensions, explicitly out of scope here.
- This feature is independent of the M2 search/render phases and ships on the same
  `music-study-app` branch.
