import { runInBatches } from './net.js'
import { planRecordingsCleanup, RECORDINGS_SCAN_MS } from './recordings-gc.js'

// Backwards-compatible recordings storage. The root is either the legacy
// collection or a small manifest. Content-addressed parts are immutable, so a
// cached manifest always reads a coherent snapshot, even during another sync.
export const RECORDINGS_FORMAT = 'cupitor-recordings-v1'
export const RECORDINGS_PART_BYTES = 256 * 1024
const object = v => v && typeof v === 'object' && !Array.isArray(v)
const own = (o, k, v) => Object.defineProperty(o, k, { value: v, writable: true, enumerable: true, configurable: true })
const bytes = s => new TextEncoder().encode(s)

export function parseRecordingsRoot(text) {
  if (text == null) return {}
  const v = JSON.parse(text)
  if (!object(v)) throw new Error('Invalid recordings file')
  if (v.format === RECORDINGS_FORMAT && !Array.isArray(v.playlists)) throw new Error('Invalid recordings manifest')
  if (v.format !== RECORDINGS_FORMAT && Object.values(v).some(rec => !object(rec))) throw new Error('Invalid recordings collection')
  return v
}

export async function readRecordings(root, readPart) {
  if (!object(root)) throw new Error('Invalid recordings file')
  if (root.format !== RECORDINGS_FORMAT) return root
  const paths = new Set()
  for (const entry of root.playlists) {
    if (!entry || !Array.isArray(entry.parts)) throw new Error('Invalid recordings playlist')
    for (const path of entry.parts) {
      if (typeof path !== 'string' || !/^recordings\/[a-f0-9]{64}\.json$/.test(path)) throw new Error('Invalid recordings part path')
      paths.add(path)
    }
  }
  const parts = new Map()
  const fetched = await runInBatches([...paths], async path => parts.set(path, await readPart(path)), 6)
  const failed = fetched.find(result => result.status === 'rejected')
  if (failed) throw failed.reason
  const out = {}
  for (const entry of root.playlists) {
    if (!entry || typeof entry.name !== 'string' || !object(entry.meta) || !Array.isArray(entry.parts)
      || Object.prototype.hasOwnProperty.call(out, entry.name)) throw new Error('Invalid recordings playlist')
    const rec = { ...entry.meta }
    if (entry.hasItems) rec.items = {}
    for (const path of entry.parts) {
      if (!/^recordings\/[a-f0-9]{64}\.json$/.test(path)) throw new Error('Invalid recordings part path')
      // Never return a partial collection: a missing part must not look like
      // deletions to the three-way merge.
      const rows = JSON.parse(parts.get(path))
      if (!entry.hasItems || !Array.isArray(rows)) throw new Error('Invalid recordings part')
      for (const row of rows) {
        if (!Array.isArray(row) || row.length < 1 || row.length > 3 || typeof row[0] !== 'string'
          || (row.length > 1 && typeof row[1] !== 'string')) throw new Error('Invalid recordings row')
        const [st, word, item] = row
        if (!Object.prototype.hasOwnProperty.call(rec.items, st)) own(rec.items, st, {})
        if (row.length > 1) {
          const words = rec.items[st]
          if (!Object.prototype.hasOwnProperty.call(words, word)) own(words, word, [])
          if (row.length === 3) words[word].push(item)
        }
      }
    }
    own(out, entry.name, rec)
  }
  return out
}

// A manifest cached longer than the retention period may reference a removed
// part. Retry once with a fresh index; a genuinely missing active part still
// fails the entire read, never masquerading as deleted cards.
export async function loadRecordingsFiles(readFile) {
  const load = async fresh => readRecordings(parseRecordingsRoot(await readFile('recordings.json', fresh)),
    path => readFile(path, fresh))
  try { return await load(false) }
  catch (e) {
    if (e.code !== 'recordings-part-missing') throw e
    return load(true)
  }
}

export async function splitRecordings(collection, { maxBytes = RECORDINGS_PART_BYTES, digest } = {}) {
  const hash = digest || (async text => {
    const result = await globalThis.crypto.subtle.digest('SHA-256', bytes(text))
    return Array.from(new Uint8Array(result), b => b.toString(16).padStart(2, '0')).join('')
  })
  const manifest = { format: RECORDINGS_FORMAT, playlists: [] }
  const files = new Map()
  for (const [name, rec] of Object.entries(collection)) {
    const { items, ...meta } = rec
    const entry = { name, meta, hasItems: items !== undefined, parts: [] }
    let rows = [], size = 2
    const flush = async () => {
      if (!rows.length) return
      const text = '[' + rows.join(',') + ']\n'
      const path = `recordings/${await hash(text)}.json`
      files.set(path, text)
      entry.parts.push(path)
      rows = []; size = 2
    }
    const push = async row => {
      const text = JSON.stringify(row)
      const len = bytes(text).length + 1
      // A card is indivisible. Refuse an oversized one rather than produce a
      // part that the GitHub contents API cannot read normally.
      if (len + 2 > maxBytes) throw new Error(`A card in "${name}" exceeds the recordings part size limit`)
      if (size + len > maxBytes) await flush()
      rows.push(text); size += len
    }
    for (const [st, words] of Object.entries(items || {})) {
      await push([st])
      for (const [word, entries] of Object.entries(words)) {
        await push([st, word])
        for (const item of entries) await push([st, word, item])
      }
    }
    await flush()
    manifest.playlists.push(entry)
  }
  return { text: JSON.stringify(manifest, null, 2) + '\n', files }
}

// One atomic commit holds both the index and its new parts. If the index
// changes after our read, re-read it and re-run the existing conflict policy.
// commitFiles also retries ref conflicts; its root guard runs on every retry.
export async function syncRecordingsFiles({ readFile, commitFiles, merge, listParts, now = Date.now,
  log = (message, error) => console.warn(message, error), maxAttempts = 5, splitOptions }) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const before = await readFile('recordings.json')
    const root = parseRecordingsRoot(before)
    const remote = await readRecordings(root, readFile)
    const merged = await merge(remote)
    const split = await splitRecordings(merged, splitOptions)
    const previous = root.format === RECORDINGS_FORMAT ? root : {}
    const timestamp = now()
    let scannedAt = previous.partsScannedAt
    let discovered = []
    if (listParts && (!Number.isFinite(scannedAt) || timestamp - scannedAt >= RECORDINGS_SCAN_MS)) {
      try {
        const paths = await listParts()
        if (!Array.isArray(paths)) throw new Error('Invalid recordings directory listing')
        discovered = paths; scannedAt = timestamp
      }
      catch (e) { log('[recordings] part discovery failed; sync will still clean up tracked files', e) }
    }
    const cleanup = planRecordingsCleanup(previous, split.files.keys(), timestamp, discovered)
    const manifest = JSON.parse(split.text)
    if (Object.keys(cleanup.retired).length) manifest.retiredParts = cleanup.retired
    if (Number.isFinite(scannedAt)) manifest.partsScannedAt = scannedAt
    const text = JSON.stringify(manifest, null, 2) + '\n'
    const existing = new Set(root.format === RECORDINGS_FORMAT ? root.playlists.flatMap(e => e.parts) : [])
    const files = [...split.files].filter(([path]) => !existing.has(path))
      .map(([path, text]) => ({ path, getContent: () => text }))
    files.push(...cleanup.remove.map(path => ({ path, delete: true })))
    files.push({ path: 'recordings.json', getContent: current => {
      if (current !== before) throw new Error('recordings-index-changed')
      return text
    } })
    try {
      await commitFiles(files)
      return merged
    } catch (e) {
      if (e.message !== 'recordings-index-changed' || attempt === maxAttempts - 1) throw e
    }
  }
}
