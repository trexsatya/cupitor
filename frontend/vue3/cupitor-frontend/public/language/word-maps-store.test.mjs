import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyMap, readMap } from './word-map-model.js'
import { createWordMapSync, parseWordMaps } from './word-maps-sync.js'
import { parseWordMapsRoot, readWordMaps, splitWordMaps, wordMapFileStore,
  WORD_MAPS_FORMAT, WORD_MAPS_RETENTION_MS } from './word-maps-store.js'

const map = (id, name = id) => readMap({...emptyMap(name), id, folder:'Swedish/Ideas'})
const copy = value => JSON.parse(JSON.stringify(value))
function fixture(initial = [], format = 'legacy') {
  const disk = new Map([['word-maps.json', JSON.stringify(format === 'legacy' ? initial : {version:1, maps:initial})]])
  const commits = [], data = new Map()
  let local = copy(initial), clock = 0, beforeCommit, fail = false
  const commitFiles = async files => {
    await beforeCommit?.(files)
    if (fail) throw Error('upload failed')
    const changes = await Promise.all(files.map(async file => [file.path,
      file.delete ? null : await file.getContent(disk.get(file.path) ?? null)]))
    for (const [path, text] of changes) text === null ? disk.delete(path) : disk.set(path, text)
    commits.push(files)
  }
  const store = wordMapFileStore({readFile:async path => disk.get(path) ?? null, commitFiles, now:() => clock})
  const options = {storageKey:'maps', sourceKey:'alice/main/swedish',
    storage:{getItem:key => data.get(key) ?? null, setItem:(key, value) => data.set(key, value)},
    resolveConflicts:async () => {throw Error('Unexpected conflict')}, ...store}
  const sync = createWordMapSync(options)
  return {disk, commits, data, store, sync, options,
    get local() {return local}, set local(value) {local = value},
    get:() => local, adopt:value => {local = value},
    set clock(value) {clock = value}, set beforeCommit(fn) {beforeCommit = fn}, set fail(value) {fail = value},
    root:() => JSON.parse(disk.get('word-maps.json')),
  }
}

test('legacy arrays and versioned collections migrate without changing map identities or content', async () => {
  for (const format of ['legacy', 'versioned']) {
    const a = readMap({...map('one'), nodes:[
      {id:'text', word:'Försåt\när en fälla', x:50, y:60, shape:'text', textColor:'#123456', images:['https://example.test/a.png']},
      {id:'other', word:'Ärlighet', x:250, y:60, shape:'ellipse'},
    ], edges:[{id:'edge', from:'text', to:'other', relation:'opposite of'}]})
    const f = fixture([a, map('two')], format)
    await f.sync.pull(f.get, f.adopt)
    await f.sync.push(f.get, f.adopt)
    assert.equal(f.root().format, WORD_MAPS_FORMAT)
    assert.deepEqual(f.root().maps.map(entry => entry.id), ['one', 'two'])
    assert.ok(f.root().maps.every(entry => /^word-maps\/[a-f0-9]{64}\.json$/.test(entry.path)))
    assert.equal(f.commits[0].length, 3)
    assert.deepEqual(parseWordMaps(await f.store.readFile()), [a, map('two')])
    assert.ok(!f.root().maps.some(entry => 'nodes' in entry))
  }
})

test('editing one map writes only its new file and the small index; unchanged sync writes no map files', async () => {
  const f = fixture([map('one'), map('two')])
  await f.sync.push(f.get, f.adopt)
  const original = f.root()
  f.local[0] = {...f.local[0], name:'Revised', folder:'Other'}
  await f.sync.push(f.get, f.adopt)
  assert.equal(f.commits[1].length, 2)
  assert.equal(f.root().maps[1].path, original.maps[1].path)
  assert.notEqual(f.root().maps[0].path, original.maps[0].path)
  assert.ok(f.disk.has(original.maps[0].path), 'old snapshots remain readable during retention')
  await f.sync.push(f.get, f.adopt)
  assert.deepEqual(f.commits[2].map(file => file.path), ['word-maps.json'])
})

test('all-map deletion, empty index and reopening preserve deletions', async () => {
  const f = fixture([map('one')])
  await f.sync.push(f.get, f.adopt)
  f.local = []
  await f.sync.push(f.get, f.adopt)
  assert.deepEqual(f.root().maps, [])
  assert.deepEqual(parseWordMaps(await f.store.readFile()), [])
  await createWordMapSync(f.options).pull(f.get, f.adopt)
  assert.deepEqual(f.local, [])
})

test('index retries re-merge remote additions instead of dropping another device edits', async () => {
  const f = fixture([map('one')])
  await f.sync.pull(f.get, f.adopt)
  f.local.push(map('local'))
  let raced = false
  f.beforeCommit = async () => {
    if (raced) return
    raced = true
    const {root, files} = await splitWordMaps([map('one'), map('remote')])
    for (const [path, text] of files) f.disk.set(path, text)
    f.disk.set('word-maps.json', JSON.stringify(root))
  }
  await f.sync.push(f.get, f.adopt)
  assert.deepEqual(new Set(f.root().maps.map(entry => entry.id)), new Set(['one','local','remote']))
  assert.equal(f.sync.dirty(f.local), false)
})

test('same-map conflicts after a race can be cancelled without any file writes or baseline changes', async () => {
  const f = fixture([map('one')])
  f.options.resolveConflicts = async () => null
  const sync = createWordMapSync(f.options)
  await sync.pull(f.get, f.adopt)
  const baseline = [...f.data]
  f.local = [map('one', 'Local edit')]
  f.beforeCommit = async () => {f.disk.set('word-maps.json', JSON.stringify([map('one', 'Remote edit')]))}
  await assert.rejects(sync.push(f.get, f.adopt), {code:'word-maps-sync-cancelled'})
  assert.equal(f.commits.length, 0)
  assert.equal(f.disk.size, 1)
  assert.deepEqual([...f.data], baseline)
  assert.equal(f.local[0].name, 'Local edit')
})

test('failed uploads preserve the legacy collection and unsynced local data', async () => {
  const f = fixture([map('one')])
  await f.sync.pull(f.get, f.adopt)
  const before = [...f.disk], baseline = [...f.data]
  f.local.push(map('new')); f.fail = true
  await assert.rejects(f.sync.push(f.get, f.adopt), /upload failed/)
  assert.deepEqual([...f.disk], before)
  assert.deepEqual([...f.data], baseline)
  assert.equal(f.sync.dirty(f.local), true)
})

test('validates the entire index before reading parts and rejects malformed or mismatched maps', async () => {
  const {root, files} = await splitWordMaps([map('one')])
  const entry = root.maps[0]
  for (const maps of [null, [null], [{...entry, id:''}], [entry, entry], [{...entry, path:'../outside.json'}],
    [entry, {...entry, id:'two'}], [{...entry, path:'word-maps/manual.json'}]]) {
    await assert.rejects(readWordMaps({format:WORD_MAPS_FORMAT, maps}, () => {throw Error('must not read')}), /Invalid/)
  }
  assert.throws(() => parseWordMapsRoot({format:'unknown', maps:[]}), /Invalid/)
  await assert.rejects(readWordMaps(root, () => JSON.stringify(map('different'))), /identity/)
  await assert.rejects(readWordMaps(root, () => 'not json'), SyntaxError)
  await assert.rejects(readWordMaps(root, () => null), {code:'word-maps-part-missing'})
  assert.deepEqual(await readWordMaps(root, path => files.get(path)), [map('one')])
})

test('a missing expired part retries the index once; a genuinely missing file fails the complete read', async () => {
  const old = await splitWordMaps([map('old')]), next = await splitWordMaps([map('new')])
  let indexReads = 0
  const store = wordMapFileStore({readFile:async path => path === 'word-maps.json'
    ? JSON.stringify(++indexReads === 1 ? old.root : next.root) : next.files.get(path) ?? null})
  assert.deepEqual(parseWordMaps(await store.readFile()), [map('new')])
  assert.equal(indexReads, 2)
  indexReads = 0
  const broken = wordMapFileStore({readFile:async path => {
    if (path === 'word-maps.json') {indexReads++; return JSON.stringify(old.root)}
    return null
  }})
  await assert.rejects(broken.readFile(), {code:'word-maps-part-missing'})
  assert.equal(indexReads, 2)
})

test('retired map versions are removed only after seven days; referenced and unrelated files stay', async () => {
  const f = fixture([map('one')])
  await f.sync.push(f.get, f.adopt)
  const first = f.root().maps[0].path
  f.clock = 100; f.local[0] = map('one', 'Revised')
  await f.sync.push(f.get, f.adopt)
  assert.equal(f.root().retiredParts[first], 100)
  const root = f.root()
  root.retiredParts['word-maps/manual.json'] = 0
  root.retiredParts['../outside.json'] = 0
  f.disk.set('word-maps.json', JSON.stringify(root))
  f.disk.set('word-maps/manual.json', 'keep'); f.disk.set('../outside.json', 'keep')
  f.clock = WORD_MAPS_RETENTION_MS
  await f.sync.push(f.get, f.adopt)
  assert.ok(f.disk.has(first))
  f.clock = WORD_MAPS_RETENTION_MS + 100
  await f.sync.push(f.get, f.adopt)
  assert.ok(!f.disk.has(first))
  assert.ok(f.disk.has(f.root().maps[0].path))
  assert.equal(f.disk.get('word-maps/manual.json'), 'keep')
  assert.equal(f.disk.get('../outside.json'), 'keep')
  assert.equal(f.root().retiredParts, undefined)
})

test('reusing a retired map version makes it active and prevents garbage collection', async () => {
  const f = fixture([map('one')])
  await f.sync.push(f.get, f.adopt)
  const first = f.root().maps[0].path
  f.local[0] = map('one', 'Revised')
  await f.sync.push(f.get, f.adopt)
  f.local[0] = map('one'); f.clock = WORD_MAPS_RETENTION_MS * 2
  await f.sync.push(f.get, f.adopt)
  assert.equal(f.root().maps[0].path, first)
  assert.ok(f.disk.has(first))
  assert.ok(!(first in f.root().retiredParts))
})

test('another device restoring a retired version during cleanup cannot lose its referenced file', async () => {
  const f = fixture([map('one')])
  await f.sync.push(f.get, f.adopt)
  const original = f.root()
  f.local[0] = map('one', 'Revised')
  await f.sync.push(f.get, f.adopt)
  const currentPath = f.root().maps[0].path
  f.clock = WORD_MAPS_RETENTION_MS * 2
  let raced = false
  f.beforeCommit = async () => {
    if (raced) return
    raced = true
    f.disk.set('word-maps.json', JSON.stringify({...original, retiredParts:{[currentPath]:WORD_MAPS_RETENTION_MS}}))
  }
  await f.sync.push(f.get, f.adopt)
  assert.equal(f.root().maps[0].path, original.maps[0].path)
  assert.deepEqual(parseWordMaps(await f.store.readFile()), [map('one')])
})
