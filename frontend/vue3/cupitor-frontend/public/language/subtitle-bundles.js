// Canonical, lossless subtitle storage shared by the browser and local tools.
// Files stay individually addressable inside small, stable JSON bundles.
export const BUNDLE_VERSION = 1
export const BUNDLE_MAX_FILES = 200
export const BUNDLE_MAX_BYTES = 1024 * 1024
export const storageName = 'storage.json'
export const byteLength = text => new TextEncoder().encode(text).length
export const bundleText = files => JSON.stringify({ version: BUNDLE_VERSION, files }, null, 2) + '\n'
export const jsonText = value => JSON.stringify(value, null, 2) + '\n'
export function bundlePath(path) {
  if (!/^packs\/pack-\d{6,}\.json$/.test(path || '')) throw new Error('Invalid subtitle bundle path')
  return path
}
export function parseBundle(text) {
  const data = JSON.parse(text)
  if (data?.version !== BUNDLE_VERSION || !data.files || Array.isArray(data.files) || typeof data.files !== 'object' ||
      Object.values(data.files).some(text => typeof text !== 'string')) throw new Error('Invalid subtitle bundle')
  return data.files
}
export function parseStorage(text) {
  if (text == null) return null
  const data = JSON.parse(text)
  if (data?.format !== 'cupitor-srt-bundles' || data.version !== BUNDLE_VERSION || !Array.isArray(data.packs) ||
      !Number.isSafeInteger(data.nextPack) || data.nextPack < 1 || !Number.isSafeInteger(data.maxFiles) || data.maxFiles < 1 ||
      !Number.isSafeInteger(data.maxBytes) || data.maxBytes < 1) throw new Error('Invalid subtitle storage manifest')
  const seen = new Set()
  for (const pack of data.packs) {
    bundlePath(pack.path)
    if (seen.has(pack.path) || !Number.isSafeInteger(pack.revision) || pack.revision < 1) throw new Error('Invalid subtitle pack metadata')
    seen.add(pack.path)
    if (Number(pack.path.match(/pack-(\d+)/)[1]) >= data.nextPack) throw new Error('Subtitle pack ID would be reused')
  }
  return data
}
export function emptyStorage(options = {}) {
  return { format: 'cupitor-srt-bundles', version: BUNDLE_VERSION,
    maxFiles: options.maxFiles || BUNDLE_MAX_FILES, maxBytes: options.maxBytes || BUNDLE_MAX_BYTES,
    nextPack: 1, packs: [] }
}
const packName = number => `packs/pack-${String(number).padStart(6, '0')}.json`
const normalized = value => String(value || '').normalize('NFC')
const baseOf = file => file.replace(/\.[^.]+\.srt$/i, '')
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key)

// Keep all language tracks of a media together. A single media larger than
// the byte target gets its own bundle; it is never truncated or split.
export function packDocuments(documents, options = {}) {
  const storage = emptyStorage(options), packs = new Map(), assignments = new Map()
  const groups = new Map()
  for (const [name, text] of Object.entries(documents)) {
    if (typeof text !== 'string') throw new Error('Subtitle file is not text: ' + name)
    const base = baseOf(name)
    if (!groups.has(base)) groups.set(base, {})
    Object.defineProperty(groups.get(base), name, { value: text, enumerable: true, writable: true, configurable: true })
  }
  let current = null
  for (const [base, files] of groups) {
    const merged = { ...(current ? packs.get(current) : {}), ...files }
    if (!current || Object.keys(merged).length > storage.maxFiles || byteLength(bundleText(merged)) > storage.maxBytes) {
      current = packName(storage.nextPack++)
      packs.set(current, {})
    }
    Object.assign(packs.get(current), files)
    assignments.set(base, current)
  }
  storage.packs = [...packs].map(([path, files]) => ({ path, revision: 1,
    files: Object.keys(files).length, bytes: byteLength(bundleText(files)) }))
  return { storage, packs, assignments }
}

export function createBundleLoader(fetchText) {
  const pending = new Map()
  return {
    clear() { pending.clear() },
    async track(entry, code, baseUrl) {
      const path = bundlePath(entry.bundle)
      const url = baseUrl.replace(/\/$/, '') + '/' + path + '?v=' + encodeURIComponent(entry.bundleRevision || 1)
      if (!pending.has(url)) {
        const promise = Promise.resolve().then(() => fetchText(url)).then(parseBundle)
        pending.set(url, promise)
        promise.catch(() => { if (pending.get(url) === promise) pending.delete(url) })
      }
      const files = await pending.get(url)
      const key = (entry.bundleKey || entry.name) + '.' + code + '.srt'
      return owns(files, key) ? files[key] : null
    },
  }
}

// Virtual .srt paths let the existing capture/edit/delete flows continue to
// transform one subtitle at a time. Physical writes are grouped per bundle.
function splitPath(path) {
  const match = String(path).match(/^(db\/language\/[^/]+\/srts)\/(.+)$/)
  return match ? { dir: match[1], file: match[2] } : null
}
function decode(value) { try { return decodeURIComponent(value) } catch (_) { return value } }
function entryForFile(index, file) {
  for (const candidate of [file, decode(file)]) {
    const base = baseOf(candidate)
    const entry = index.find(entry => normalized(entry?.name) === normalized(base))
    if (entry) return { entry, key: (entry.bundleKey || entry.name) + candidate.slice(base.length) }
  }
  return null
}
function parseIndex(text) {
  const entries = JSON.parse(text || '[]')
  if (!Array.isArray(entries) || entries.some(e => !e || typeof e.name !== 'string' || !e.link)) throw new Error('Invalid subtitle index')
  return entries
}
function conflict() {
  const error = new Error('GitHub API error 409: subtitle changed; read and merge again')
  error.conditionalWrite = true
  throw error
}

export function createSubtitleBundleAdapter({ onCommitted = () => {} } = {}) {
  return {
    handles(path) { const p = splitPath(path); return !!p && (p.file === 'index.json' || /\.srt$/i.test(p.file)) },
    async read({ path, read }) {
      const p = splitPath(path)
      if (!p || !/\.srt$/i.test(p.file)) return undefined
      const storage = parseStorage((await read(p.dir + '/' + storageName))?.content)
      if (!storage) return undefined
      const index = parseIndex((await read(p.dir + '/index.json'))?.content)
      const found = entryForFile(index, p.file)
      if (!found?.entry.bundle) {
        for (const pack of storage.packs) {
          const file = await read(p.dir + '/' + pack.path)
          if (!file) throw new Error('Missing subtitle bundle: ' + pack.path)
          const contents = parseBundle(file.content)
          for (const key of [p.file, decode(p.file)]) if (owns(contents, key)) return { content: contents[key], sha: file.sha }
        }
        return undefined
      }
      const physical = await read(p.dir + '/' + bundlePath(found.entry.bundle))
      if (!physical) throw new Error('Missing subtitle bundle: ' + found.entry.bundle)
      const files = parseBundle(physical.content)
      if (!owns(files, found.key)) throw new Error('GitHub API error 404: subtitle track does not exist')
      return { content: files[found.key], sha: physical.sha }
    },
    async prepare({ files, read }) {
      let output = [...files]
      const callbacks = []
      const dirs = [...new Set(files.filter(f => this.handles(f.path)).map(f => splitPath(f.path).dir))]
      for (const dir of dirs) {
        const storageFile = await read(dir + '/' + storageName)
        const storage = parseStorage(storageFile?.content)
        if (!storage) continue
        const operations = output.filter(f => splitPath(f.path)?.dir === dir && this.handles(f.path))
        const planned = await prepareDirectory(dir, storage, operations, read)
        output = output.filter(f => !operations.includes(f)).concat(planned.files)
        callbacks.push(() => onCommitted({ dir, index: planned.index }))
      }
      return { files: output, afterCommit() { callbacks.forEach(fn => fn()) } }
    },
  }
}

async function prepareDirectory(dir, storage, operations, read) {
  const indexPath = dir + '/index.json'
  const indexFile = await read(indexPath)
  const before = parseIndex(indexFile?.content)
  let index = before.map(entry => ({ ...entry }))
  for (const operation of operations.filter(f => splitPath(f.path).file === 'index.json')) {
    if (operation.delete) throw new Error('The subtitle index cannot be deleted while bundle storage is enabled')
    if (operation.expectedSha && operation.expectedSha !== indexFile?.sha) conflict()
    const updated = await operation.getContent(jsonText(index))
    if (updated != null) index = parseIndex(updated)
  }
  const packs = new Map(), originals = new Map()
  let tail = storage.packs.at(-1)?.path
  const load = async path => {
    bundlePath(path)
    if (!packs.has(path)) {
      const file = await read(dir + '/' + path)
      if (!file) throw new Error('Missing subtitle bundle: ' + path)
      packs.set(path, { ...parseBundle(file.content) })
      originals.set(path, file)
    }
    return packs.get(path)
  }
  const allocation = async group => {
    // Only the tail is considered for new entries. Existing assignments never
    // depend on alphabetical position or the size of the entire corpus.
    if (tail) {
      const candidate = { ...await load(tail), ...group }
      if (Object.keys(candidate).length <= storage.maxFiles && byteLength(bundleText(candidate)) <= storage.maxBytes) return tail
    }
    const path = packName(storage.nextPack++)
    packs.set(path, {})
    tail = path
    return path
  }
  const staged = new Map()
  for (const operation of operations.filter(f => /\.srt$/i.test(splitPath(f.path).file))) {
    const file = splitPath(operation.path).file
    let old = entryForFile(before, file)
    const next = entryForFile(index, file)
    if (!old && !next) {
      for (const metadata of storage.packs) {
        const contents = await load(metadata.path)
        const key = [file, decode(file)].find(key => owns(contents, key))
        if (key) { old = { entry: { name: baseOf(key), bundle: metadata.path }, key }; break }
      }
    }
    const found = next || old
    if (!found) throw new Error('A new subtitle must include its index entry in the same commit: ' + file)
    const oldPack = old?.entry.bundle || next?.entry.bundle
    const oldFiles = oldPack ? await load(oldPack) : null
    const oldKey = old?.key || found.key
    let text = oldFiles && owns(oldFiles, oldKey) ? oldFiles[oldKey] : null
    if (!oldPack) text = (await read(operation.path))?.content ?? null
    if (operation.expectedSha && operation.expectedSha !== originals.get(oldPack)?.sha) conflict()
    const changed = operation.delete ? null : await operation.getContent(text)
    if (!operation.delete && changed == null) continue
    // An indexed loose track still needs an assignment when its text is
    // unchanged. This happens when local SRT files are imported in place.
    if ((!operation.delete && changed === text && oldPack) || (operation.delete && text == null)) continue
    const base = found.entry.bundleKey || found.entry.name
    if (!staged.has(base)) staged.set(base, { entry: next?.entry, oldPack, files: oldFiles ?
      Object.fromEntries(Object.entries(oldFiles).filter(([key]) => baseOf(key) === (old?.entry.bundleKey || old?.entry.name || base))) : {} })
    const group = staged.get(base)
    if (operation.delete) delete group.files[found.key]
    else Object.defineProperty(group.files, found.key, { value: changed, enumerable: true, configurable: true, writable: true })
  }
  for (const [base, group] of staged) {
    if (group.oldPack) {
      const oldFiles = await load(group.oldPack)
      for (const key of Object.keys(oldFiles)) if (baseOf(key) === base) delete oldFiles[key]
    }
    if (!Object.keys(group.files).length) {
      index = index.filter(entry => (entry.bundleKey || entry.name) !== base)
      continue
    }
    let destination = group.oldPack
    if (destination) {
      const candidate = { ...await load(destination), ...group.files }
      if ((Object.keys(candidate).length > storage.maxFiles || byteLength(bundleText(candidate)) > storage.maxBytes) &&
          Object.keys(await load(destination)).length) destination = null
    }
    if (!destination) destination = await allocation(group.files)
    Object.assign(packs.get(destination), group.files)
    for (const entry of index) if ((entry.bundleKey || entry.name) === base) entry.bundle = destination
  }
  // Index-only deletions also remove the deleted media's tracks, preserving
  // every other record in the bundle and any unindexed archived tracks.
  for (const entry of before) {
    const base = entry.bundleKey || entry.name
    if (entry.bundle && !index.some(e => (e.bundleKey || e.name) === base)) {
      const files = await load(entry.bundle)
      for (const key of Object.keys(files)) if (baseOf(key) === base) delete files[key]
    }
  }
  const physical = []
  for (const [path, contents] of packs) {
    const text = bundleText(contents), original = originals.get(path)
    if (original?.content === text) continue
    const previous = storage.packs.find(p => p.path === path)
    const revision = (previous?.revision || 0) + 1
    if (byteLength(text) >= 95 * 1024 * 1024) throw new Error('Subtitle bundle exceeds the safe GitHub object size')
    if (Object.keys(contents).length) {
      const metadata = { path, revision, files: Object.keys(contents).length, bytes: byteLength(text) }
      if (previous) Object.assign(previous, metadata)
      else storage.packs.push(metadata)
      physical.push({ path: dir + '/' + path, getContent: () => text })
    } else {
      storage.packs = storage.packs.filter(p => p.path !== path)
      if (original) physical.push({ path: dir + '/' + path, delete: true })
    }
    index.forEach(entry => { if (entry.bundle === path) entry.bundleRevision = revision })
  }
  const storageText = jsonText(storage), nextIndex = jsonText(index)
  if (storageText !== (await read(dir + '/' + storageName))?.content) physical.push({ path: dir + '/' + storageName, getContent: () => storageText })
  if (nextIndex !== indexFile?.content) physical.push({ path: indexPath, getContent: () => nextIndex })
  return { files: physical, index }
}
