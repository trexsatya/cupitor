import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs'
import { join, dirname, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { parseStorage, parseBundle, createSubtitleBundleAdapter, emptyStorage, jsonText } from '../../public/language/subtitle-bundles.js'

export function looseSubtitleNames(srtsDir, prefix = '') {
  const out = []
  for (const entry of readdirSync(join(srtsDir, prefix), { withFileTypes: true })) {
    const name = prefix ? prefix + '/' + entry.name : entry.name
    if (entry.isDirectory()) out.push(...looseSubtitleNames(srtsDir, name))
    else if (entry.isFile() && entry.name.endsWith('.srt')) out.push(name)
    else if (entry.isSymbolicLink() && entry.name.endsWith('.srt')) throw new Error('Resolve subtitle symlinks before migration: ' + name)
  }
  return out
}

export function readSubtitleFiles(srtsDir, { includeLoose = true } = {}) {
  const files = Object.create(null)
  const manifestPath = join(srtsDir, 'storage.json')
  if (existsSync(manifestPath)) {
    const storage = parseStorage(readFileSync(manifestPath, 'utf8'))
    for (const pack of storage.packs) {
      for (const [name, text] of Object.entries(parseBundle(readFileSync(join(srtsDir, pack.path), 'utf8')))) {
        if (Object.prototype.hasOwnProperty.call(files, name)) throw new Error('Subtitle appears in more than one bundle: ' + name)
        files[name] = text
      }
    }
  }
  for (const name of includeLoose ? looseSubtitleNames(srtsDir) : []) {
    const bytes = readFileSync(join(srtsDir, name))
    const text = bytes.toString('utf8')
    if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('Subtitle is not valid UTF-8; convert its encoding before bundling: ' + name)
    if (Object.prototype.hasOwnProperty.call(files, name) && files[name] !== text) throw new Error('Loose and bundled subtitles disagree: ' + name)
    files[name] = text
  }
  return files
}

const checksum = data => createHash('sha256').update(data).digest('hex')

// Planning is read-only. Remember every physical read so applying a stale plan
// cannot overwrite a capture or edit made since the preview.
export async function planLocalSubtitleFiles(srtsDir, operations, { initializeBundles = false } = {}) {
  const prefix = 'db/language/local/srts/'
  const root = resolve(srtsDir)
  const physicalPath = path => {
    if (!path.startsWith(prefix)) throw new Error('Unexpected subtitle path')
    const destination = resolve(root, path.slice(prefix.length))
    if (!destination.startsWith(root + sep)) throw new Error('Subtitle path leaves its data directory')
    return destination
  }
  const adapter = createSubtitleBundleAdapter()
  const reads = new Map()
  const read = async path => {
    if (reads.has(path)) return reads.get(path).value
    const file = physicalPath(path)
    let value = null
    try {
      const bytes = readFileSync(file)
      value = { content: bytes.toString('utf8'), sha: checksum(bytes) }
    } catch (e) { if (e.code !== 'ENOENT') throw e }
    const sha = value?.sha ?? null
    if (!value && initializeBundles && path === prefix + 'storage.json') value = { content: jsonText(emptyStorage()) }
    reads.set(path, { path: path.slice(prefix.length), sha, value })
    return value
  }
  const prepared = await adapter.prepare({ read, files: operations.map(f => ({ ...f, path: prefix + f.path })) })
  const changes = []
  for (const operation of prepared.files) {
    const path = physicalPath(operation.path)
    const current = await read(operation.path)
    if (operation.delete) { if (current) changes.push({ path, delete: true }); continue }
    const text = await operation.getContent(current?.content ?? null)
    if (text == null || text === current?.content) continue
    changes.push({ path, text })
  }
  return { ...prepared, root, changes, reads: [...reads.values()].map(({ path, sha }) => ({ path, sha })) }
}

// Local authoring uses the same planner as GitHub. Stage writes first, publish
// the index last, then remove obsolete packs. No directory is made by a dry run.
export function applyLocalSubtitleFiles(srtsDir, plan) {
  const root = resolve(srtsDir)
  if (root !== plan.root) throw new Error('Subtitle plan belongs to another directory')
  for (const item of plan.reads) {
    const file = join(root, item.path)
    const sha = existsSync(file) ? checksum(readFileSync(file)) : null
    if (sha !== item.sha) throw new Error('Subtitle storage changed after planning: ' + item.path)
  }
  const changes = plan.changes.map(change => ({ ...change }))
  changes.sort((a, b) => Number(a.path.endsWith('/index.json')) - Number(b.path.endsWith('/index.json')))
  try {
    for (const change of changes) if (!change.delete) {
      mkdirSync(dirname(change.path), { recursive: true })
      change.temp = change.path + '.bundle-tmp'
      writeFileSync(change.temp, change.text)
    }
    for (const change of changes) if (!change.delete) renameSync(change.temp, change.path)
    for (const change of changes) if (change.delete && existsSync(change.path)) unlinkSync(change.path)
  } finally {
    for (const change of changes) if (change.temp && existsSync(change.temp)) unlinkSync(change.temp)
  }
  return plan
}

export async function commitLocalSubtitleFiles(srtsDir, operations) {
  return applyLocalSubtitleFiles(srtsDir, await planLocalSubtitleFiles(srtsDir, operations))
}
