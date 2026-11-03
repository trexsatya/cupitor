// Authoritative user data. The synchronous view is hydrated once; writes are
// committed asynchronously, in batches, with a revision journal in the same
// transaction. Call flush() before sending data or declaring a save complete.
export const USER_DATA_DB = 'cupitor-user-data'
export const USER_DATA_VERSION = 1
const failure = (message, code = 'user-data-storage') => Object.assign(new Error(message), { code })
const request = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error)
})
const completed = tx => new Promise((resolve, reject) => {
  tx.oncomplete = resolve
  tx.onabort = () => reject(tx.error || failure('The local save was interrupted.'))
  tx.onerror = () => {} // onabort reports the final transaction outcome
})
async function fingerprint(entries) {
  const bytes = new TextEncoder().encode(JSON.stringify(entries))
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join('')
}
function openDatabase(factory, name, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!factory) return reject(failure('Device storage is unavailable. Enable site storage and reload.'))
    let settled = false
    const finish = (error, db) => {
      if (settled) { db?.close(); return }
      settled = true
      clearTimeout(timer)
      error ? reject(error) : resolve(db)
    }
    const timer = setTimeout(() => finish(failure('Opening device storage timed out. Close other Cupitor tabs and reload.')), timeoutMs)
    let req
    try { req = factory.open(name, USER_DATA_VERSION) }
    catch (error) { finish(error); return }
    req.onupgradeneeded = () => {
      const db = req.result
      db.createObjectStore('scopes', { keyPath: 'scope' })
      db.createObjectStore('claims', { keyPath: 'key' })
      for (const name of ['values', 'outbox'])
        db.createObjectStore(name, { keyPath: ['scope', 'key'] }).createIndex('scope', 'scope')
    }
    req.onsuccess = () => finish(null, req.result)
    req.onerror = () => finish(req.error)
    req.onblocked = () => finish(failure('Device storage is held open by another tab. Close other Cupitor tabs and reload.', 'user-data-blocked'))
  })
}

export async function openUserDataStore({
  scope, legacyKeys = [], legacyStorage, indexedDB = globalThis.indexedDB,
  databaseName = USER_DATA_DB, assertCurrent = () => {}, onStatus = () => {}, timeoutMs = 10000,
}) {
  assertCurrent()
  const db = await openDatabase(indexedDB, databaseName, timeoutMs)
  let values = new Map(), revision = 0, pending = new Map(), running = null, error = null, closed = false
  const notify = () => { try { onStatus({ pending: pending.size > 0 || !!running, error, revision }) } catch (_) {} }
  const tx = (names, mode) => db.transaction(names, mode)
  const readSnapshot = async () => {
    const t = tx(['values', 'scopes'], 'readonly'), done = completed(t)
    done.catch(() => {})
    const [records, metadata] = await Promise.all([
      request(t.objectStore('values').index('scope').getAll(scope)),
      request(t.objectStore('scopes').get(scope)),
    ])
    await done
    return { values: new Map(records.map(row => [row.key, row.value])), metadata }
  }
  try {
    let snapshot = await readSnapshot()
    if (!snapshot.metadata) {
      // Snapshot legacy strings first; validate accepted values in the copy
      // transaction so malformed data aborts the entire copy and its claims.
      const legacy = legacyKeys.map(spec => {
        const value = legacyStorage?.getItem(spec.key) ?? null
        return { ...spec, value }
      })
      const t = tx(['values', 'scopes', 'claims', 'outbox'], 'readwrite'), done = completed(t)
      // Attach the rejection handler before awaiting any individual request.
      done.catch(() => {})
      try {
        const existing = await request(t.objectStore('scopes').get(scope))
        if (!existing) {
          const claims = t.objectStore('claims'), accepted = []
          const owners = await Promise.all(legacy.map(item => request(claims.get(item.claim || item.key))))
          legacy.forEach((item, index) => {
            if (owners[index] && owners[index].scope !== scope) return
            const value = item.value != null && item.extract ? item.extract(item.value) : item.value
            if (value != null) item.validate?.(value)
            // Claim absent keys as well: an old client cannot introduce a
            // late legacy snapshot into a new repository after this upgrade.
            claims.put({ key: item.claim || item.key, scope })
            if (value != null) {
              const record = { scope, key: item.key, value, revision: 0 }
              t.objectStore('values').put(record)
              t.objectStore('outbox').put(record)
              accepted.push([item.key, value])
            }
          })
          // Exact content is verified below before this marker is completed.
          t.objectStore('scopes').put({ scope, revision: 0, migration: 'copied', keys: accepted.map(([key]) => key) })
        }
        assertCurrent()
      } catch (cause) { t.abort(); await done.catch(() => {}); throw cause }
      await done
      snapshot = await readSnapshot()
      // Compare every copied value with the legacy snapshot while it is still
      // in memory. Count/byte-length checks alone cannot detect lost content.
      for (const key of snapshot.metadata.keys) {
        const item = legacy.find(item => item.key === key)
        const expected = item?.value != null && item.extract ? item.extract(item.value) : item?.value
        if (snapshot.values.get(key) !== expected)
          throw failure('The legacy data copy could not be verified. Original data is retained.')
      }
    }
    if (snapshot.metadata.migration !== 'complete') {
      // Also safe after interruption between the copy and verification marker.
      const entries = snapshot.metadata.keys.map(key => {
        const value = snapshot.values.get(key)
        const raw = legacyStorage?.getItem(key) ?? null
        const spec = legacyKeys.find(item => item.key === key)
        const original = raw != null && spec?.extract ? spec.extract(raw) : raw
        if (value !== original) throw failure('Legacy data changed during migration. Original and copied data are retained; export them before recovery.')
        return [key, value]
      })
      const digest = await fingerprint(entries)
      const t = tx(['scopes'], 'readwrite'), done = completed(t)
      done.catch(() => {})
      try {
        const meta = await request(t.objectStore('scopes').get(scope))
        if (meta.revision !== snapshot.metadata.revision) throw failure('Another tab changed data during migration.', 'user-data-conflict')
        t.objectStore('scopes').put({ ...meta, migration: 'complete', migrationVersion: 1, legacyDigest: digest })
      } catch (cause) { t.abort(); await done.catch(() => {}); throw cause }
      await done
    }
    values = snapshot.values
    revision = snapshot.metadata.revision
    assertCurrent()
  } catch (cause) { db.close(); throw cause }

  const check = () => {
    assertCurrent()
    if (closed) throw failure('Device storage was closed. Export pending work and reload.')
    if (error) throw error
  }
  const store = {
    scope,
    getItem(key) { assertCurrent(); return values.get(key) ?? null },
    setItem(key, value) {
      assertCurrent(); value = String(value)
      if (values.get(key) === value) return
      values.set(key, value); pending.set(key, value); notify(); schedule()
    },
    removeItem(key) {
      assertCurrent()
      if (!values.has(key)) return
      values.delete(key); pending.set(key, null); notify(); schedule()
    },
    get status() { return { pending: pending.size > 0 || !!running, error, revision } },
    async flush() {
      check()
      if (running) return running
      if (!pending.size) return
      running = (async () => {
        while (pending.size) {
          const batch = pending; pending = new Map()
          let t, done
          try {
            t = tx(['values', 'outbox', 'scopes'], 'readwrite')
            done = completed(t)
            done.catch(() => {})
            const meta = await request(t.objectStore('scopes').get(scope))
            if (meta.revision !== revision)
              throw failure('Another Cupitor tab saved changes. Export pending work, then reload before editing again.', 'user-data-conflict')
            assertCurrent()
            for (const [key, value] of batch) {
              if (value == null) t.objectStore('values').delete([scope, key])
              else t.objectStore('values').put({ scope, key, value, revision: revision + 1 })
              t.objectStore('outbox').put({ scope, key, value, revision: revision + 1 })
            }
            t.objectStore('scopes').put({ ...meta, revision: revision + 1 })
            await done
            revision++
          } catch (cause) {
            try { t?.abort() } catch (_) {}
            await done?.catch(() => {})
            // Newer edits always win in the pending recovery view.
            for (const [key, value] of batch) if (!pending.has(key)) pending.set(key, value)
            error = cause
            throw cause
          }
        }
      })()
      notify()
      try { await running } finally { running = null; notify() }
    },
    async retry() {
      if (closed || error?.code === 'user-data-conflict')
        throw error || failure('Device storage was closed. Export pending work and reload.')
      error = null
      return store.flush()
    },
    // Includes uncommitted edits on failure; never substitutes a legacy copy.
    exportData() {
      return { format: 'cupitor-user-data-v1', scope, revision, pending: pending.size > 0 || !!running,
        values: Object.fromEntries(values), pendingKeys: [...pending.keys()] }
    },
    async importData(backup, validate = () => {}) {
      check()
      if (backup?.format !== 'cupitor-user-data-v1' || backup.scope !== scope ||
          !backup.values || typeof backup.values !== 'object' || Array.isArray(backup.values))
        throw failure('Choose a device backup for this account, language and repository.')
      const entries = Object.entries(backup.values)
      for (const [key, value] of entries) {
        if (typeof value !== 'string') throw failure('The device backup contains invalid data.')
        validate(key, value)
      }
      // Validate everything before staging any changes. Replacement, including
      // deletion tombstones, is one transaction with its journal.
      for (const key of values.keys()) if (!Object.hasOwn(backup.values, key)) store.removeItem(key)
      for (const [key, value] of entries) store.setItem(key, value)
      await store.flush()
    },
    close() { closed = true; db.close() },
  }
  function schedule() {
    queueMicrotask(() => { if (!error && !closed) store.flush().catch(() => {}) })
  }
  db.onversionchange = () => {
    closed = true; db.close()
    error = failure('Device storage was upgraded in another tab. Export pending work and reload.', 'user-data-upgrade')
    notify()
  }
  notify()
  return store
}
