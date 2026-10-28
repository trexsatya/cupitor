// Inspect duplicate SRT keys across packs and plan a non-destructive repair.
// A video is the unit of movement: all its language tracks must live in the
// same pack because index.json exposes only one bundle pointer per video.
import { readFileSync, existsSync, lstatSync, mkdirSync, copyFileSync, mkdtempSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { parseStorage, parseBundle, bundleText, jsonText, bundlePath } from '../../public/language/subtitle-bundles.js'
import { parseSrtEntries, detectSrtConflicts, mergeSrtWithNewEntries } from '../../public/language/srt-parser.js'
import { applyLocalSubtitleFiles, readSubtitleFiles } from './bundle-store.js'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const baseOf = name => name.replace(/\.[^.]+\.srt$/i, '')
const normalized = name => String(name || '').normalize('NFC')
const owns = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)
const packName = n => `packs/pack-${String(n).padStart(6, '0')}.json`

export function planBundleRepair(srtsDir, { merge = false } = {}) {
  if (!srtsDir || typeof srtsDir !== 'string') throw new Error('Supply --srtsDir or configure srtsDir')
  const root = resolve(srtsDir), snapshots = new Map()
  const read = name => {
    const file = join(root, name)
    if (!existsSync(file)) throw new Error('Missing subtitle storage file: ' + file)
    if (!lstatSync(file).isFile()) throw new Error('Subtitle storage must be regular files: ' + file)
    const bytes = readFileSync(file)
    const text = bytes.toString('utf8')
    if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('Subtitle storage is not UTF-8: ' + file)
    snapshots.set(name, hash(bytes))
    return text
  }
  const storage = parseStorage(read('storage.json'))
  if (!storage) throw new Error('Bundle repair requires storage.json')
  const index = JSON.parse(read('index.json'))
  if (!Array.isArray(index) || index.some(e => !e || typeof e.name !== 'string' || typeof e.link !== 'string' || !e.link)) {
    throw new Error('Invalid subtitle index')
  }
  const originalPacks = new Map(), working = new Map(), byKey = new Map()
  for (const meta of storage.packs) {
    const path = bundlePath(meta.path), files = parseBundle(read(path))
    originalPacks.set(path, files)
    working.set(path, { ...files })
    for (const [key, text] of Object.entries(files)) {
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key).push({ path, text })
    }
  }

  const duplicates = [...byKey].filter(([, sources]) => sources.length > 1)
  const bases = [...new Set(duplicates.map(([key]) => baseOf(key)))]
  const collisions = [], assignments = new Map(), unindexed = []
  const hasTrack = (path, base) => Object.keys(working.get(path) || {}).some(key => baseOf(key) === base)

  for (const base of bases) {
    const grouped = [...byKey].filter(([key]) => baseOf(key) === base)
    const entries = index.filter(e => normalized(e.bundleKey || e.name) === normalized(base))
    if (entries.length > 1 && new Set(entries.map(e => e.bundle)).size > 1) {
      collisions.push({ media: base, reason: 'Conflicting index bundle pointers', packs: entries.map(e => e.bundle) })
      continue
    }
    if (!entries.length) unindexed.push(base)
    const found = storage.packs.map(p => p.path).filter(path => grouped.some(([, sources]) => sources.some(s => s.path === path)))
    const indicated = entries[0]?.bundle
    const preferred = indicated && found.includes(indicated) ? indicated : found[0]
    const resolved = {}
    for (const [key, sources] of grouped) {
      const ordered = [...sources].sort((a, b) => (a.path === preferred ? -1 : 0) - (b.path === preferred ? -1 : 0))
      let text = ordered[0].text
      for (const source of ordered.slice(1)) {
        if (source.text === text) continue
        if (!merge) {
          collisions.push({ media: base, file: key, reason: 'Different subtitle contents; inspect or rerun with --merge',
            packs: sources.map(s => s.path) })
          continue
        }
        const incoming = parseSrtEntries(source.text)
        if (!incoming.length || !parseSrtEntries(text).length) {
          collisions.push({ media: base, file: key, reason: 'Cannot safely merge malformed or empty SRT', packs: sources.map(s => s.path) })
          continue
        }
        const conflicts = detectSrtConflicts(text, incoming)
        if (conflicts.length) {
          collisions.push({ media: base, file: key, reason: 'Different text at identical start timestamps; manual resolution required',
            timestamps: conflicts.slice(0, 8).map(c => c.start), packs: sources.map(s => s.path) })
          continue
        }
        text = mergeSrtWithNewEntries(text, incoming)
      }
      resolved[key] = text
    }
    if (collisions.some(c => c.media === base)) continue

    // All the tracks from this video move together, including language tracks
    // which were present in only one of the conflicting packs.
    for (const path of found) {
      const files = working.get(path)
      for (const key of Object.keys(files)) if (baseOf(key) === base) delete files[key]
    }
    let destination = preferred
    const candidate = { ...working.get(destination), ...resolved }
    if (Object.keys(working.get(destination)).length &&
        (Object.keys(candidate).length > storage.maxFiles || Buffer.byteLength(bundleText(candidate)) > storage.maxBytes)) {
      destination = packName(storage.nextPack++)
      if (working.has(destination)) throw new Error('Subtitle pack ID already used: ' + destination)
      working.set(destination, {})
    }
    Object.assign(working.get(destination), resolved)
    assignments.set(base, destination)
  }

  const summary = { duplicateTracks: duplicates.length, affectedMedia: bases.length,
    duplicates: duplicates.map(([key, sources]) => ({ file: key, packs: sources.map(s => s.path) })),
    unindexedMedia: unindexed, conflicts: collisions, changedFiles: [] }
  if (collisions.length) return { root, blocked: true, summary, reads: [], changes: [] }

  // The planner must not emit a repair which still contains duplicate keys.
  const seen = new Set()
  for (const files of working.values()) for (const key of Object.keys(files)) {
    if (seen.has(key)) throw new Error('Repair still contains duplicate subtitle: ' + key)
    seen.add(key)
  }

  const changes = [], revisions = new Map(), packs = []
  for (const metadata of storage.packs) {
    const name = metadata.path, before = originalPacks.get(name), after = working.get(name)
    const different = bundleText(before) !== bundleText(after)
    if (!Object.keys(after).length) {
      if (different) changes.push({ path: join(root, name), delete: true })
      continue
    }
    const revision = metadata.revision + (different ? 1 : 0)
    revisions.set(name, revision)
    packs.push({ ...metadata, revision, files: Object.keys(after).length, bytes: Buffer.byteLength(bundleText(after)) })
    if (different) changes.push({ path: join(root, name), text: bundleText(after) })
  }
  for (const [name, files] of working) if (!originalPacks.has(name) && Object.keys(files).length) {
    const text = bundleText(files)
    packs.push({ path: name, revision: 1, files: Object.keys(files).length, bytes: Buffer.byteLength(text) })
    revisions.set(name, 1)
    snapshots.set(name, null)
    changes.push({ path: join(root, name), text })
  }
  const nextIndex = index.map(entry => {
    const base = normalized(entry.bundleKey || entry.name)
    const bundle = assignments.get(base) || entry.bundle
    return bundle && revisions.has(bundle) ? { ...entry, bundle, bundleRevision: revisions.get(bundle) } : { ...entry }
  })
  const nextStorageText = jsonText({ ...storage, packs })
  const nextIndexText = jsonText(nextIndex)
  if (nextStorageText !== readFileSync(join(root, 'storage.json'), 'utf8')) changes.push({ path: join(root, 'storage.json'), text: nextStorageText })
  if (nextIndexText !== readFileSync(join(root, 'index.json'), 'utf8')) changes.push({ path: join(root, 'index.json'), text: nextIndexText })
  summary.changedFiles = changes.map(c => c.path.slice(root.length + 1).split('\\').join('/'))
  return { root, blocked: false, summary, reads: [...snapshots].map(([path, sha]) => ({ path, sha })), changes }
}

export function applyBundleRepair(plan) {
  if (plan.blocked) throw new Error('Repair has conflicts: review the reported copies before applying')
  if (!plan.changes.length) return { ...plan.summary, applied: true, backup: null }
  // applyLocalSubtitleFiles checks all snapshot hashes again before writing.
  // Keep original bytes outside the live SRT directory for easy recovery.
  for (const { path, sha } of plan.reads) {
    const file = join(plan.root, path)
    const current = existsSync(file) ? hash(readFileSync(file)) : null
    if (current !== sha) throw new Error('Subtitle storage changed since repair preview: ' + path)
  }
  const backup = mkdtempSync(plan.root + '-repair-backup-')
  for (const change of plan.changes) if (existsSync(change.path)) {
    const relative = change.path.slice(plan.root.length + 1)
    const dest = join(backup, relative)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(change.path, dest)
  }
  applyLocalSubtitleFiles(plan.root, plan)
  readSubtitleFiles(plan.root, { includeLoose: false }) // verify no duplicates remain
  return { ...plan.summary, applied: true, backup }
}
