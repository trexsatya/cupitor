import { runInBatches } from './net.js'
import { parseWordMaps } from './word-maps-sync.js'

export const WORD_MAPS_FORMAT = 'cupitor-word-maps-v1'
export const WORD_MAPS_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const partPath = path => typeof path === 'string' && /^word-maps\/[a-f0-9]{64}\.json$/.test(path)
const encoded = value => JSON.stringify(value, null, 2) + '\n'

export function parseWordMapsRoot(text) {
  const root = typeof text === 'string' ? JSON.parse(text) : text
  if (root?.format !== WORD_MAPS_FORMAT) {
    parseWordMaps(root)
    return root
  }
  if (!Array.isArray(root.maps)) throw new Error('Invalid word maps index')
  const ids = new Set(), paths = new Set()
  for (const entry of root.maps) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)
      || !partPath(entry.path) || paths.has(entry.path)) throw new Error('Invalid word maps index entry')
    ids.add(entry.id); paths.add(entry.path)
  }
  return root
}

// Immutable map files keep every index readable while another device syncs.
// Never let missing/corrupt files masquerade as deleted maps in the merge.
export async function readWordMaps(root, readPart) {
  root = parseWordMapsRoot(root)
  if (root?.format !== WORD_MAPS_FORMAT) return parseWordMaps(root)
  const results = await runInBatches(root.maps, async entry => {
    const text = await readPart(entry.path)
    if (text == null) throw Object.assign(new Error(`Missing word map file: ${entry.path}`),
      { code: 'word-maps-part-missing' })
    const [map] = parseWordMaps([JSON.parse(text)])
    if (map.id !== entry.id) throw new Error('Word map identity does not match its index')
    return map
  }, 6)
  const failed = results.find(result => result.status === 'rejected')
  if (failed) throw failed.reason
  return results.map(result => result.value)
}

export async function splitWordMaps(maps) {
  const root = { format: WORD_MAPS_FORMAT, maps: [] }, files = new Map()
  for (const map of parseWordMaps(maps)) {
    const text = encoded(map)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    const path = `word-maps/${hash}.json`
    files.set(path, text)
    root.maps.push({ id: map.id, path })
  }
  return { root, files }
}

function cleanupParts(previous, activePaths, now) {
  const active = new Set(activePaths)
  const prior = new Set(previous?.format === WORD_MAPS_FORMAT ? previous.maps.map(entry => entry.path) : [])
  const retired = {}, remove = []
  for (const [path, at] of Object.entries(previous?.retiredParts || {})) {
    if (partPath(path) && Number.isFinite(at) && at >= 0 && !active.has(path) && !prior.has(path)) retired[path] = at
  }
  for (const path of prior) if (!active.has(path)) retired[path] = now
  for (const [path, at] of Object.entries(retired)) {
    if (now - at >= WORD_MAPS_RETENTION_MS) { remove.push(path); delete retired[path] }
  }
  return { retired, remove }
}

// Adapt the existing three-way sync to a small index + one file per map.
// Both the migration and subsequent edits are committed atomically. Guarding
// the index at the exact commit head re-runs conflict resolution after races.
export function wordMapFileStore({ readFile, commitFiles, now = Date.now, maxAttempts = 5 }) {
  return {
    async readFile() {
      for (let attempt = 0; attempt < 2; attempt++) {
        try { return encoded(await readWordMaps(await readFile('word-maps.json'), readFile)) }
        catch (e) { if (e.code !== 'word-maps-part-missing' || attempt) throw e }
      }
    },
    async commitFile(transform) {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const before = await readFile('word-maps.json')
        const previous = parseWordMapsRoot(before)
        const remote = await readWordMaps(previous, readFile)
        const merged = parseWordMaps(await transform(encoded(remote)))
        const { root, files: parts } = await splitWordMaps(merged)
        const cleanup = cleanupParts(previous, parts.keys(), now())
        if (Object.keys(cleanup.retired).length) root.retiredParts = cleanup.retired
        const existing = new Set(previous?.format === WORD_MAPS_FORMAT ? previous.maps.map(entry => entry.path) : [])
        const files = [...parts].filter(([path]) => !existing.has(path))
          .map(([path, text]) => ({ path, getContent: () => text }))
        files.push(...cleanup.remove.map(path => ({ path, delete: true })))
        files.push({ path: 'word-maps.json', getContent: current => {
          if (current !== before) throw new Error('word-maps-index-changed')
          return encoded(root)
        } })
        try { return await commitFiles(files) }
        catch (e) {
          if (e.message !== 'word-maps-index-changed' || attempt === maxAttempts - 1) throw e
        }
      }
    },
  }
}
