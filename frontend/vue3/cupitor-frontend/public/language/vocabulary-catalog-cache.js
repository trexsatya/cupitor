// Optional derived cache shared across study languages; no authoritative edits
// or backups depend on it. Immutable chunks are bounded by a byte budget.
export const VOCABULARY_CACHE_BYTES = 32 * 1024 * 1024
let database
const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
function open() {
  if (!database) database = new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => { settled = true; reject(new Error('Vocabulary cache timed out.')) }, 3000)
    let req
    try { req = indexedDB.open('cupitor-vocabulary-catalog', 1) }
    catch (error) { clearTimeout(timer); reject(error); return }
    req.onupgradeneeded = () => { req.result.createObjectStore('files'); req.result.createObjectStore('stats') }
    req.onsuccess = () => {
      clearTimeout(timer)
      if (settled) { req.result.close(); return }
      settled = true
      req.result.onversionchange = () => { req.result.close(); database = undefined }
      resolve(req.result)
    }
    const fail = () => { clearTimeout(timer); settled = true; reject(req.error || new Error('Vocabulary cache is blocked.')) }
    req.onerror = req.onblocked = fail
  }).catch(() => null)
  return database
}
export function createVocabularyCatalogCache(scope, { maxBytes = VOCABULARY_CACHE_BYTES } = {}) {
  const key = path => JSON.stringify([scope, path])
  const memory = new Map()
  let memoryBytes = 0
  const remember = (path, value) => {
    if (memory.has(path)) { memoryBytes -= memory.get(path).size; memory.delete(path) }
    const size = value == null ? 0 : new TextEncoder().encode(value).length
    memory.set(path, { value, size }); memoryBytes += size
    for (const [old, entry] of memory) {
      if (memoryBytes <= maxBytes) break
      memory.delete(old); memoryBytes -= entry.size
    }
  }
  return {
    async get(path) {
      if (memory.has(path)) { const { value } = memory.get(path); remember(path, value); return value }
      try {
        const db = await open()
        if (!db) return null
        const row = await request(db.transaction('files').objectStore('files').get(key(path)))
        if (row) remember(path, row.value)
        return row?.value ?? null
      } catch (_) { return null }
    },
    async putAll(entries) {
      for (const [path, value] of entries) remember(path, value)
      try {
        const db = await open()
        if (!db) return
        const tx = db.transaction(['files', 'stats'], 'readwrite')
        const done = new Promise(resolve => { tx.oncomplete = tx.onabort = tx.onerror = () => resolve() })
        const files = tx.objectStore('files'), stats = tx.objectStore('stats')
        const [previousSize, old] = await Promise.all([request(stats.get('bytes')), Promise.all(entries.map(([path]) => request(files.get(key(path)))))])
        let total = previousSize || 0
        entries.forEach(([path, value], index) => {
          const size = value == null ? 0 : new TextEncoder().encode(value).length
          total += size - (old[index]?.size || 0)
          if (value == null) files.delete(key(path))
          else files.put({ key: key(path), value, size, used: Date.now() }, key(path))
        })
        if (total > maxBytes) {
          const rows = await request(files.getAll())
          rows.sort((a, b) => a.used - b.used)
          for (const row of rows) {
            if (total <= maxBytes) break
            files.delete(row.key); total -= row.size
          }
        }
        stats.put(total, 'bytes')
        await done
      } catch (_) { /* Cache availability never blocks a save. */ }
    },
  }
}
