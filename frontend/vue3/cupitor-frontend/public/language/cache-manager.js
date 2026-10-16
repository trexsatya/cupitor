// Only subtitle caches are disposable. Local playlists, pending edits, music
// and account credentials are deliberately outside this module's scope.
export const CACHE_REGISTRY_KEY = 'cupitor:subtitleCaches'
export function cacheIdentity(name) {
  const match = /^cupitor-cache-v1-([a-z][a-z-]*)(?:@([A-Za-z0-9~-]+))?$/.exec(name || '')
  return match ? { name, language: match[1], account: match[2] || 'trexsatya' } : null
}

export function rememberCache(name, storage) {
  try {
    const names = JSON.parse(storage.getItem(CACHE_REGISTRY_KEY) || '[]')
    storage.setItem(CACHE_REGISTRY_KEY, JSON.stringify([...new Set([...names, name])]))
  } catch (_) {}
}

export async function listSubtitleCaches(idb, storage, currentName) {
  let names = [currentName]
  try { names.push(...JSON.parse(storage.getItem(CACHE_REGISTRY_KEY) || '[]')) } catch (_) {}
  if (idb && typeof idb.databases === 'function') {
    names.push(...(await idb.databases()).map(d => d.name))
  }
  return [...new Set(names)].map(cacheIdentity).filter(Boolean)
    .sort((a, b) => a.account.localeCompare(b.account) || a.language.localeCompare(b.language))
}

// Group the currently open cache by the user whose repo supplied each pair.
// No full copy of subtitle text is accumulated in memory.
export function cacheSources(db, defaultOwner) {
  return new Promise((resolve, reject) => {
    const groups = new Map()
    const tx = db.transaction('subtitles', 'readonly')
    const request = tx.objectStore('subtitles').openCursor()
    request.onsuccess = () => {
      const c = request.result
      if (!c) return
      const owner = c.value.owner || defaultOwner || '(unknown)'
      groups.set(owner, (groups.get(owner) || 0) + 1)
      c.continue()
    }
    tx.oncomplete = () => resolve([...groups].map(([owner, count]) => ({ owner, count })))
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Could not read subtitle cache'))
  })
}

export function removeCacheSource(db, owner, defaultOwner) {
  return new Promise((resolve, reject) => {
    let removed = 0
    const tx = db.transaction('subtitles', 'readwrite')
    const request = tx.objectStore('subtitles').openCursor()
    request.onsuccess = () => {
      const c = request.result
      if (!c) return
      if ((c.value.owner || defaultOwner || '(unknown)') === owner) { c.delete(); removed++ }
      c.continue()
    }
    tx.oncomplete = () => resolve(removed)
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Could not remove cached subtitles'))
  })
}

export function deleteSubtitleCache(idb, name) {
  if (!cacheIdentity(name)) return Promise.reject(new Error('Not a subtitle cache'))
  return new Promise((resolve, reject) => {
    const request = idb.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error || new Error('Could not remove cache'))
    request.onblocked = () => reject(new Error('Close other Cupitor tabs using this cache, then try again.'))
  })
}
