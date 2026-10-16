import { IDBFactory } from 'fake-indexeddb'
import { cacheIdentity, rememberCache, listSubtitleCaches, cacheSources, removeCacheSource, deleteSubtitleCache } from './cache-manager.js'
const open = (idb, name) => new Promise((resolve, reject) => {
  const r = idb.open(name, 1)
  r.onupgradeneeded = () => r.result.createObjectStore('subtitles', { keyPath: 'link' })
  r.onsuccess = () => resolve(r.result)
  r.onerror = () => reject(r.error)
})
const seed = (db, rows) => new Promise(resolve => {
  const tx = db.transaction('subtitles', 'readwrite')
  rows.forEach(r => tx.objectStore('subtitles').put(r))
  tx.oncomplete = resolve
})
beforeEach(() => localStorage.clear())

test('lists account-scoped and legacy caches without exposing unrelated databases', async () => {
  const idb = new IDBFactory()
  const a = await open(idb, 'cupitor-cache-v1-swedish')
  const b = await open(idb, 'cupitor-cache-v1-spanish@alice')
  const c = await open(idb, 'unrelated')
  rememberCache(b.name, localStorage)
  const list = await listSubtitleCaches(idb, localStorage, a.name)
  expect(list.map(x => x.account)).toEqual(['alice', 'trexsatya'])
  expect(cacheIdentity('cupitor-cache-v1-swedish@~guest').account).toBe('~guest')
  expect(cacheIdentity('cupitor-music')).toBeNull()
  a.close(); b.close(); c.close()
})

test('removes another source from the current cache and preserves self and legacy rows', async () => {
  const idb = new IDBFactory(), db = await open(idb, 'cupitor-cache-v1-swedish@alice')
  await seed(db, [{ link: 'self', owner: 'alice', sv: 'Min text' }, { link: 'other', owner: 'bob' }, { link: 'legacy' }])
  expect(await cacheSources(db, 'alice')).toEqual([{ owner: 'alice', count: 2 }, { owner: 'bob', count: 1 }])
  expect(await removeCacheSource(db, 'bob', 'alice')).toBe(1)
  expect(await cacheSources(db, 'alice')).toEqual([{ owner: 'alice', count: 2 }])
  expect(await removeCacheSource(db, 'nobody', 'alice')).toBe(0)
  db.close()
})

test('deletes an inactive account cache, rejects unrelated names and reports blocked deletes', async () => {
  const idb = new IDBFactory(), name = 'cupitor-cache-v1-swedish@bob'
  let db = await open(idb, name)
  await expect(deleteSubtitleCache(idb, name)).rejects.toThrow('Close other Cupitor tabs')
  db.close()
  await deleteSubtitleCache(idb, name)
  expect((await idb.databases()).some(d => d.name === name)).toBe(false)
  await expect(deleteSubtitleCache(idb, 'unrelated')).rejects.toThrow('Not a subtitle cache')
})

test('older WebViews without database enumeration use the registry', async () => {
  rememberCache('cupitor-cache-v1-swedish@bob', localStorage)
  expect((await listSubtitleCaches({}, localStorage, 'cupitor-cache-v1-swedish')).map(d => d.account)).toEqual(['bob', 'trexsatya'])
})
