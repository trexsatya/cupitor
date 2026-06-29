// public/music-local-store.js
// Thin promisified IndexedDB wrapper for the Music Manager's offline-first cache.
// Two object stores keyed `${system}:${id}`:
//   entries  { _key, system, id, entry, synced }
//   details  { _key, system, id, detail }
// `synced` is false when written during a Rebuild; flipped true only after the
// push carrying this content succeeds. The `system` index isolates western/sargam.

const DB_NAME = 'cupitor-music';
const DB_VERSION = 3;

const keyOf = (system, id) => `${system}:${id}`;

// Reject with a real Error: an aborted tx can have a null `.error`, and callers
// consume failures as `e.message`, which would otherwise throw on null.
function reqDone(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
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
        // v2: per-system vocabulary snapshot, keyed by system (one row per system).
        if (!db.objectStoreNames.contains('vocab')) {
          db.createObjectStore('vocab', { keyPath: 'system' });
        }
        // v3: per-system pattern-tag registry snapshot (the global tag list), keyed by system.
        if (!db.objectStoreNames.contains('tags')) {
          db.createObjectStore('tags', { keyPath: 'system' });
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

    // Remove a piece entirely from the local cache (entry + detail). Deleting a missing
    // key is a harmless no-op in IndexedDB.
    async deletePiece(system, id) {
      const db = await open();
      const tx = db.transaction(['entries', 'details'], 'readwrite');
      tx.objectStore('entries').delete(keyOf(system, id));
      tx.objectStore('details').delete(keyOf(system, id));
      await txDone(tx);
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

    // Store the full per-system vocab array so captures survive reload even if the push fails.
    async putVocab(system, vocab) {
      const db = await open();
      const tx = db.transaction('vocab', 'readwrite');
      tx.objectStore('vocab').put({ system, vocab: vocab || [] });
      await txDone(tx);
    },

    async getVocab(system) {
      const db = await open();
      const tx = db.transaction('vocab', 'readonly');
      const row = await reqDone(tx.objectStore('vocab').get(system));
      return row ? row.vocab : [];
    },

    async putTags(system, tags) {
      const db = await open();
      const tx = db.transaction('tags', 'readwrite');
      tx.objectStore('tags').put({ system, tags: tags || [] });
      await txDone(tx);
    },

    async getTags(system) {
      const db = await open();
      const tx = db.transaction('tags', 'readonly');
      const row = await reqDone(tx.objectStore('tags').get(system));
      return row ? row.tags : [];
    },
  };
}
