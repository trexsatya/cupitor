import test from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory } from 'fake-indexeddb'
import { openUserDataStore } from './user-data-store.js'

const legacy = (entries = {}) => {
  const values = new Map(Object.entries(entries))
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    key: i => [...values.keys()][i], get length() { return values.size } }
}
const fixture = (entries = {}, extra = {}) => {
  const indexedDB = new IDBFactory(), storage = legacy(entries)
  const options = { indexedDB, scope: 'alice/swedish/data/main', legacyStorage: storage,
    legacyKeys: Object.keys(entries).map(key => ({key, validate: JSON.parse})), ...extra }
  return { indexedDB, storage, options, open: changes => openUserDataStore({...options, ...changes}) }
}
function readDatabase(indexedDB, name = 'cupitor-user-data') {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function records(indexedDB, store) {
  const db = await readDatabase(indexedDB)
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(store).objectStore(store).getAll()
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error)
    })
  } finally { db.close() }
}

test('migration verifies exact collections and baselines, keeps originals, and never replays them after new edits', async () => {
  const f = fixture({ playlists: '{"One":{"id":"stable","cards":[2,1]}}', baseline: '{}', pending: '{"id":"capture"}' })
  let store = await f.open()
  assert.equal(store.getItem('playlists'), f.storage.getItem('playlists'))
  assert.equal((await records(f.indexedDB, 'scopes'))[0].migration, 'complete')
  assert.equal((await records(f.indexedDB, 'outbox')).length, 3)
  store.setItem('playlists', '{"New":{"cards":[1,2,3]}}')
  store.removeItem('pending')
  await store.flush(); store.close()
  f.storage.setItem('playlists', '{"Obsolete":{}}')
  store = await f.open()
  assert.equal(store.getItem('playlists'), '{"New":{"cards":[1,2,3]}}')
  assert.equal(store.getItem('pending'), null)
  assert.equal(f.storage.getItem('pending'), '{"id":"capture"}')
  store.close()
})

test('legacy snapshot is claimed once; language, account, repository and branch scopes remain independent', async () => {
  const f = fixture({playlists: '{"Swedish":{}}'})
  const original = await f.open()
  original.setItem('playlists', '{"Edited":{}}'); await original.flush()
  for (const scope of ['alice/spanish/data/main', 'bob/swedish/data/main', 'alice/swedish/new/main', 'alice/swedish/data/next']) {
    const other = await f.open({scope})
    assert.equal(other.getItem('playlists'), null, scope)
    other.setItem('playlists', JSON.stringify({scope})); await other.flush(); other.close()
  }
  assert.equal(original.getItem('playlists'), '{"Edited":{}}')
  original.close()
})

test('malformed legacy data aborts the entire migration and leaves both originals intact', async () => {
  const f = fixture({playlists:'{}', pending:'invalid'})
  await assert.rejects(f.open(), SyntaxError)
  assert.equal((await records(f.indexedDB, 'values')).length, 0)
  assert.equal((await records(f.indexedDB, 'claims')).length, 0)
  assert.equal(f.storage.getItem('pending'), 'invalid')
  f.storage.setItem('pending', '{"fixed":true}')
  const store = await f.open(); assert.equal(store.getItem('pending'), '{"fixed":true}'); store.close()
})

test('collection, baseline and pending marker commit together beyond a localStorage-sized budget', async () => {
  const f = fixture(), store = await f.open()
  const large = JSON.stringify({cards: Array.from({length:14000}, (_, i) => ({id:i, text:'ö'.repeat(400)}))})
  assert.ok(large.length > 5 * 1024 * 1024)
  store.setItem('playlists', large); store.setItem('baseline', '{}'); store.setItem('dirty', '1')
  await store.flush()
  const rows = await records(f.indexedDB, 'values')
  assert.equal(new Set(rows.map(row=>row.revision)).size, 1)
  const journal = await records(f.indexedDB, 'outbox')
  assert.deepEqual(journal, rows)
  store.close()
  const next = await f.open(); assert.equal(next.getItem('playlists'), large); assert.equal(next.getItem('dirty'), '1'); next.close()
})

test('transaction failure preserves latest pending work and never reports a completed save; retry commits it', async () => {
  const f = fixture({playlists:'{}'}), statuses = []
  const store = await f.open({onStatus: status => statuses.push(status)})
  // Abort an actual values/outbox/scopes transaction at the request boundary.
  const db = await readDatabase(f.indexedDB), prototype = Object.getPrototypeOf(db)
  const original = prototype.transaction
  let fail = true
  prototype.transaction = function(names, mode, ...rest) {
    const tx = original.call(this, names, mode, ...rest)
    if (fail && mode === 'readwrite' && [...names].includes('outbox')) {
      fail = false
      queueMicrotask(() => tx.abort())
    }
    return tx
  }
  try {
    store.setItem('playlists', '{"First":{}}')
    await assert.rejects(store.flush())
    assert.ok(store.status.error); assert.ok(store.status.pending)
    store.setItem('playlists', '{"Later":{}}')
    assert.equal(store.exportData().values.playlists, '{"Later":{}}')
    assert.equal((await records(f.indexedDB, 'values'))[0].value, '{}')
    assert.ok(statuses.at(-1).error)
    await store.retry()
    assert.equal(store.status.pending, false); assert.equal(store.status.error, null)
    assert.equal((await records(f.indexedDB, 'values'))[0].value, '{"Later":{}}')
  } finally { prototype.transaction = original; db.close(); store.close() }
})

test('two tabs cannot silently overwrite each other, including when BroadcastChannel is unavailable', async () => {
  const f = fixture({playlists:'{}'}), first = await f.open(), second = await f.open()
  first.setItem('playlists', '{"TabOne":{}}'); await first.flush()
  second.setItem('playlists', '{"TabTwo":{}}')
  await assert.rejects(second.flush(), {code:'user-data-conflict'})
  assert.equal(second.exportData().values.playlists, '{"TabTwo":{}}')
  assert.equal((await records(f.indexedDB, 'values'))[0].value, '{"TabOne":{}}')
  await assert.rejects(second.retry(), {code:'user-data-conflict'})
  first.close(); second.close()
})

test('edits arriving during a commit survive a reload', async () => {
  const f = fixture(), store = await f.open()
  store.setItem('playlists', '{"first":1}')
  const pending = store.flush()
  store.setItem('playlists', '{"second":2}'); store.setItem('capture','{"id":"new"}')
  await pending; store.close()
  const reopened = await f.open()
  assert.equal(reopened.getItem('playlists'), '{"second":2}')
  assert.equal(reopened.getItem('capture'), '{"id":"new"}'); reopened.close()
})

test('source changes block a queued commit and retain a recovery export for its original destination', async () => {
  let current = true
  const f = fixture({}, {assertCurrent: () => {if (!current) throw Object.assign(new Error('changed'),{code:'stale-data-source'})}})
  const store = await f.open()
  store.setItem('pending','{"id":"original"}'); const pending = store.flush(); current = false
  await assert.rejects(pending, {code:'stale-data-source'})
  assert.equal(store.exportData().scope, f.options.scope)
  assert.equal(store.exportData().values.pending, '{"id":"original"}')
  assert.equal((await records(f.indexedDB, 'values')).length, 0); store.close()
})

test('unavailable IndexedDB fails explicitly without adopting the old legacy store', async () => {
  const f = fixture({playlists:'{}'})
  await assert.rejects(f.open({indexedDB:null}), /unavailable/)
  assert.equal(f.storage.getItem('playlists'), '{}')
})

test('restart after an interrupted copy verifies it and completes migration exactly once', async () => {
  const f = fixture({playlists:'{"id":"kept"}'})
  const original = f.storage.getItem
  let reads = 0
  f.storage.getItem = key => { if (++reads === 2) throw new Error('interrupted after copy'); return original(key) }
  await assert.rejects(f.open(), /interrupted/)
  assert.equal((await records(f.indexedDB,'scopes'))[0].migration,'copied')
  assert.equal((await records(f.indexedDB,'values'))[0].value,'{"id":"kept"}')
  f.storage.getItem = original
  const store = await f.open()
  assert.equal(store.getItem('playlists'),'{"id":"kept"}')
  assert.equal((await records(f.indexedDB,'scopes'))[0].migration,'complete'); store.close()
})

test('a schema upgrade closes the old connection and keeps its newest pending work exportable', async () => {
  const f = fixture(), store = await f.open()
  store.setItem('playlists','{"saved":true}'); await store.flush()
  const upgraded = await new Promise((resolve,reject)=>{
    const req=f.indexedDB.open('cupitor-user-data',2)
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)
  })
  assert.equal(store.status.error.code,'user-data-upgrade')
  store.setItem('playlists','{"newer":true}')
  assert.equal(store.exportData().values.playlists,'{"newer":true}')
  await assert.rejects(store.flush(),/closed/)
  upgraded.close();store.close()
})

test('blocked opens reject promptly and close a late connection instead of installing a second writable store', async()=>{
  let closed=false
  const factory={open(){const req={result:{close(){closed=true}}};setTimeout(()=>{req.onblocked();req.onsuccess()},0);return req}}
  await assert.rejects(openUserDataStore({scope:'test',indexedDB:factory}),{code:'user-data-blocked'})
  assert.equal(closed,true)
})

test('recovery import is atomic, scoped, validates before changing data and keeps deletion tombstones',async()=>{
  const f=fixture(),store=await f.open()
  store.setItem('playlists','{"newer":true}');store.setItem('pending','{"temporary":1}');await store.flush()
  const backup={format:'cupitor-user-data-v1',scope:f.options.scope,values:{playlists:'{"restored":true}'}}
  await assert.rejects(store.importData({...backup,scope:'another-repository'}),/account, language and repository/)
  await assert.rejects(store.importData({...backup,values:{playlists:'invalid'}},(_,value)=>JSON.parse(value)),SyntaxError)
  assert.equal(store.getItem('playlists'),'{"newer":true}')
  await store.importData(backup,(_,value)=>JSON.parse(value));store.close()
  const next=await f.open();assert.equal(next.getItem('playlists'),'{"restored":true}');assert.equal(next.getItem('pending'),null);next.close()
})

test('quota failure while creating a transaction retains its batch and reports an incomplete save',async()=>{
  const f=fixture(),store=await f.open(),db=await readDatabase(f.indexedDB)
  const prototype=Object.getPrototypeOf(db),original=prototype.transaction
  let failed=false
  prototype.transaction=function(names,mode,...rest){
    if(!failed&&mode==='readwrite'&&Array.from(names).includes('outbox')){
      failed=true;throw new DOMException('Device storage is full','QuotaExceededError')
    }
    return original.call(this,names,mode,...rest)
  }
  try{
    store.setItem('capture','{"id":"preserved"}')
    await assert.rejects(store.flush(),{name:'QuotaExceededError'})
    assert.equal(store.status.pending,true)
    assert.equal(store.exportData().values.capture,'{"id":"preserved"}')
    await store.retry()
    assert.equal(store.status.pending,false)
  }finally{prototype.transaction=original;db.close();store.close()}
})

test('simultaneous first-load migration verifies selected legacy data for both tabs',async()=>{
  const f=fixture({pending:'["swedish","spanish"]'})
  f.options.legacyKeys=[{key:'pending',extract:raw=>JSON.stringify(JSON.parse(raw).filter(value=>value==='swedish'))}]
  const stores=await Promise.all([f.open(),f.open()])
  for(const store of stores){assert.equal(store.getItem('pending'),'["swedish"]');store.close()}
})
