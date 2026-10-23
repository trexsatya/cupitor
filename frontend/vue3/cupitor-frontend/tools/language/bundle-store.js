import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs'
import { join, dirname, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { parseStorage, parseBundle, createSubtitleBundleAdapter } from '../../public/language/subtitle-bundles.js'

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

export function readSubtitleFiles(srtsDir) {
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
  for (const name of looseSubtitleNames(srtsDir)) {
    const bytes = readFileSync(join(srtsDir, name))
    const text = bytes.toString('utf8')
    if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('Subtitle is not valid UTF-8; convert its encoding before bundling: ' + name)
    if (Object.prototype.hasOwnProperty.call(files, name) && files[name] !== text) throw new Error('Loose and bundled subtitles disagree: ' + name)
    files[name] = text
  }
  return files
}

// Local authoring uses the same transaction planner as GitHub. Write temp
// files first, publish the new index last, then remove obsolete empty packs.
export async function commitLocalSubtitleFiles(srtsDir, operations) {
  const prefix = 'db/language/local/srts/'
  const root = resolve(srtsDir)
  const physicalPath = path => {
    if (!path.startsWith(prefix)) throw new Error('Unexpected subtitle path')
    const destination = resolve(root, path.slice(prefix.length))
    if (!destination.startsWith(root + sep)) throw new Error('Subtitle path leaves its data directory')
    return destination
  }
  const adapter = createSubtitleBundleAdapter()
  const read = async path => {
    const file = physicalPath(path)
    try {
      const content = readFileSync(file, 'utf8')
      return { content, sha: createHash('sha256').update(content).digest('hex') }
    } catch (e) { if (e.code === 'ENOENT') return null; throw e }
  }
  const prepared = await adapter.prepare({ read, files: operations.map(f => ({ ...f, path: prefix + f.path })) })
  const changes = []
  for (const operation of prepared.files) {
    const path = physicalPath(operation.path)
    const current = await read(operation.path)
    if (operation.delete) { changes.push({ path, delete: true }); continue }
    const text = await operation.getContent(current?.content ?? null)
    if (text == null || text === current?.content) continue
    mkdirSync(dirname(path), { recursive: true })
    const temp = path + '.bundle-tmp'
    writeFileSync(temp, text)
    changes.push({ path, temp })
  }
  changes.sort((a, b) => Number(a.path.endsWith('/index.json')) - Number(b.path.endsWith('/index.json')))
  for (const change of changes) if (!change.delete) renameSync(change.temp, change.path)
  for (const change of changes) if (change.delete && existsSync(change.path)) unlinkSync(change.path)
  return prepared
}
