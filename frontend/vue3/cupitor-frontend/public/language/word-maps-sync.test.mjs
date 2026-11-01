import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createWordMapSync,
  parseWordMaps,
  mergeWordMaps,
} from './word-maps-sync.js'
import { emptyMap, readMap } from './word-map-model.js'
const copy = (v) => JSON.parse(JSON.stringify(v))
const map = (id, name = id) => readMap({ ...emptyMap(name), id })
function memory() {
  const data = new Map()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    data,
  }
}
function fixture(local = [], remote = []) {
  const storage = memory()
  let here = copy(local),
    there = copy(remote),
    writes = 0
  const options = {
    storageKey: 'maps',
    sourceKey: 'self/main/swedish',
    storage,
    readFile: async () => JSON.stringify({ version: 1, maps: there }),
    commitFile: async (getContent) => {
      there = parseWordMaps(
        await getContent(JSON.stringify({ version: 1, maps: there }))
      )
      writes++
    },
    resolveConflicts: async (cs) =>
      Object.fromEntries(cs.map((c) => [c.id, 'both'])),
  }
  return {
    options,
    get local() {
      return here
    },
    set local(v) {
      here = v
    },
    get remote() {
      return there
    },
    set remote(v) {
      there = v
    },
    get writes() {
      return writes
    },
    get: () => here,
    adopt: (v) => {
      here = v
    },
  }
}
test('validates all remote maps before any adoption; duplicate ids rejected', () => {
  assert.throws(() => parseWordMaps([map('a'), map('a')]), /unique/)
  assert.throws(() => parseWordMaps({ version: 2, maps: [] }), /Invalid/)
  assert.throws(() => parseWordMaps([{ ...map('a'), id: '' }]), /stable/)
  assert.deepEqual(parseWordMaps(null), [])
})
test('merges independent maps and propagates deletions without resurrecting them', () => {
  const a = map('a'),
    b = map('b'),
    changed = { ...b, name: 'remote changed' }
  const result = mergeWordMaps([a, b], [b], [a, changed, map('c')])
  assert.deepEqual(result.maps, [changed, map('c')])
  assert.equal(result.conflicts.length, 0)
})
test('first load migrates local-only maps and pulls remote-only maps', async () => {
  const f = fixture([map('local')], [map('remote')]),
    sync = createWordMapSync(f.options)
  await sync.pull(f.get, f.adopt)
  assert.equal(f.local.length, 2)
  assert.equal(sync.dirty(f.local), true)
  await sync.push(f.get, f.adopt)
  assert.equal(f.remote.length, 2)
  assert.equal(sync.dirty(f.local), false)
  const reopened = createWordMapSync(f.options)
  assert.equal(reopened.dirty(f.local), false)
})
test('load defers simultaneous edits and Sync can keep both with stable identities', async () => {
  const f = fixture([map('a')], [map('a')]),
    sync = createWordMapSync(f.options)
  await sync.pull(f.get, f.adopt)
  f.local = [map('a', 'local edit')]
  f.remote = [map('a', 'remote edit')]
  assert.equal((await sync.pull(f.get, f.adopt)).conflicts, 1)
  assert.equal(f.local[0].name, 'local edit')
  await sync.push(f.get, f.adopt)
  assert.equal(f.remote.length, 2)
  assert.equal(f.remote.find((m) => m.id === 'a').name, 'local edit')
  assert.equal(
    f.remote.find((m) => m.id !== 'a').name,
    'remote edit (from GitHub)'
  )
  assert.equal(sync.dirty(f.local), false)
})
test('cancelled conflicts and failed uploads preserve local data and baseline', async () => {
  const f = fixture([map('a')], [map('a')])
  f.options.resolveConflicts = async () => null
  const sync = createWordMapSync(f.options)
  await sync.pull(f.get, f.adopt)
  const base = f.options.storage.getItem('maps:base:self/main/swedish')
  f.local = [map('a', 'local')]
  f.remote = [map('a', 'remote')]
  await assert.rejects(sync.push(f.get, f.adopt), {
    code: 'word-maps-sync-cancelled',
  })
  assert.equal(f.writes, 0)
  assert.equal(f.local[0].name, 'local')
  assert.equal(f.options.storage.getItem('maps:base:self/main/swedish'), base)
  assert.equal(sync.dirty(f.local), true)
})
test('simultaneous delete/edit requires a choice; remote choice restores the edited map', async () => {
  const f = fixture([map('a')], [map('a')])
  f.options.resolveConflicts = async (cs) => {
    assert.equal(cs[0].local, null)
    return { a: 'remote' }
  }
  const sync = createWordMapSync(f.options)
  await sync.pull(f.get, f.adopt)
  f.local = []
  f.remote = [map('a', 'edited')]
  await sync.pull(f.get, f.adopt)
  assert.deepEqual(f.local, [])
  await sync.push(f.get, f.adopt)
  assert.equal(f.local[0].name, 'edited')
})
test('unsynced changes made during upload are preserved and remain dirty', async () => {
  const f = fixture([map('a')], [map('a')])
  let release, started
  const began = new Promise((r) => (started = r)),
    gate = new Promise((r) => (release = r))
  f.options.commitFile = async (transform) => {
    f.remote = parseWordMaps(await transform(JSON.stringify(f.remote)))
    started()
    await gate
  }
  const sync = createWordMapSync(f.options)
  await sync.pull(f.get, f.adopt)
  f.local = [map('a', 'first edit')]
  const uploading = sync.push(f.get, f.adopt)
  await began
  f.local = [map('a', 'later edit'), map('new')]
  release()
  await uploading
  assert.equal(f.remote[0].name, 'first edit')
  assert.equal(f.local[0].name, 'later edit')
  assert.equal(f.local.length, 2)
  assert.equal(sync.dirty(f.local), true)
})
test('concurrent remote additions are re-merged on commit retries', async () => {
  const f = fixture([map('a')], [map('a')])
  f.options.commitFile = async (transform) => {
    await transform(JSON.stringify(f.remote))
    f.remote.push(map('remote-new'))
    f.remote = parseWordMaps(await transform(JSON.stringify(f.remote)))
  }
  const sync = createWordMapSync(f.options)
  await sync.pull(f.get, f.adopt)
  f.local.push(map('local-new'))
  await sync.push(f.get, f.adopt)
  assert.deepEqual(
    new Set(f.remote.map((m) => m.id)),
    new Set(['a', 'remote-new', 'local-new'])
  )
})
test('offline/corrupt reads do not erase local maps or advance the baseline', async () => {
  const f = fixture([map('a')], [map('a')])
  let bad = false
  f.options.readFile = async () => (bad ? 'not json' : JSON.stringify(f.remote))
  const sync = createWordMapSync(f.options)
  await sync.pull(f.get, f.adopt)
  const before = copy(f.local)
  bad = true
  await assert.rejects(sync.pull(f.get, f.adopt))
  assert.deepEqual(f.local, before)
  await assert.rejects(
    createWordMapSync({
      ...f.options,
      readFile: async () => {
        throw Error('offline')
      },
    }).pull(f.get, f.adopt),
    /offline/
  )
  assert.deepEqual(f.local, before)
})
test('baselines are isolated by repository and branch', async () => {
  const f = fixture([map('a')], [map('a')]),
    sync = createWordMapSync(f.options)
  await sync.pull(f.get, f.adopt)
  const other = createWordMapSync({
    ...f.options,
    sourceKey: 'other/branch/swedish',
  })
  assert.equal(other.dirty(f.local), true)
})
test('all-map deletion stays deleted after syncing and reopening', async () => {
  const f = fixture([map('a')], [map('a')]),
    sync = createWordMapSync(f.options)
  await sync.pull(f.get, f.adopt)
  f.local = []
  await sync.push(f.get, f.adopt)
  assert.deepEqual(f.remote, [])
  assert.equal(sync.dirty(f.local), false)
  await createWordMapSync(f.options).pull(f.get, f.adopt)
  assert.deepEqual(f.local, [])
})

test('failed upload keeps the prior baseline and unsynced local changes', async () => {
  const f = fixture([map('a')], [map('a')])
  f.options.commitFile = async (transform) => {
    await transform(JSON.stringify(f.remote))
    throw Error('upload offline')
  }
  const sync = createWordMapSync(f.options)
  await sync.pull(f.get, f.adopt)
  const before = f.options.storage.getItem('maps:base:self/main/swedish')
  f.local = [map('a', 'unsynced edit')]
  await assert.rejects(sync.push(f.get, f.adopt), /upload offline/)
  assert.equal(f.local[0].name, 'unsynced edit')
  assert.equal(f.options.storage.getItem('maps:base:self/main/swedish'), before)
  assert.equal(sync.dirty(f.local), true)
})
