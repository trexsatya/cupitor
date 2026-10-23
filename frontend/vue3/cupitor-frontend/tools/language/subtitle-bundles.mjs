#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs'
import { resolve, join, dirname, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { packDocuments, bundleText, jsonText, parseBundle, byteLength } from '../../public/language/subtitle-bundles.js'
import { readSubtitleFiles, looseSubtitleNames } from './bundle-store.js'

const digest = text => createHash('sha256').update(text).digest('hex')
function inventory(files) {
  return digest(Object.keys(files).sort().map(name => JSON.stringify([name, digest(files[name])])).join('\n'))
}

export function planMigration(srtsDir, options = {}) {
  const documents = readSubtitleFiles(srtsDir)
  const originalIndex = readFileSync(join(srtsDir, 'index.json'), 'utf8')
  const index = JSON.parse(originalIndex)
  if (!Array.isArray(index)) throw new Error('Subtitle index must be an array')
  if (existsSync(join(srtsDir, 'storage.json'))) {
    const loose = looseSubtitleNames(srtsDir)
    if (loose.length) throw new Error('Storage is already bundled but loose SRTs were added. Use lang-manage.js import --srtsDir "' + srtsDir + '" --apply to import them.')
    return { alreadyBundled: true, files: Object.keys(documents).length, inventorySha256: inventory(documents) }
  }
  const { storage, packs, assignments } = packDocuments(documents, options)
  const missing = []
  const bundledIndex = index.map(entry => {
    if (!entry || typeof entry.name !== 'string' || !entry.link) throw new Error('Invalid subtitle index entry')
    let key = entry.name
    if (!assignments.has(key)) {
      const matches = [...assignments.keys()].filter(base => base.normalize('NFC') === key.normalize('NFC'))
      if (matches.length > 1) throw new Error('Ambiguous Unicode subtitle names: ' + key)
      if (matches.length) key = matches[0]
    }
    const path = assignments.get(key)
    if (!path) { missing.push(entry.link); return entry }
    return { ...entry, bundle: path, bundleRevision: 1, ...(key !== entry.name ? { bundleKey: key } : {}) }
  })
  const output = Object.fromEntries([...packs].map(([path, files]) => [path, bundleText(files)]))
  const restored = Object.create(null)
  for (const packedText of Object.values(output)) {
    for (const [name, text] of Object.entries(parseBundle(packedText))) {
      if (Object.prototype.hasOwnProperty.call(restored, name)) throw new Error('Duplicate output subtitle: ' + name)
      restored[name] = text
    }
  }
  const checksum = inventory(documents)
  if (inventory(restored) !== checksum || Object.keys(restored).length !== Object.keys(documents).length) throw new Error('Round-trip verification failed')
  const referenced = new Set(index.map(entry => entry.name))
  return { storage, index: bundledIndex, output, documents, originalIndexSha256: digest(originalIndex),
    summary: { srtFilesBefore: Object.keys(documents).length, bundlesAfter: packs.size, metadataFiles: 2,
      originalBytes: Object.values(documents).reduce((sum, text) => sum + byteLength(text), 0),
      bundleBytes: Object.values(output).reduce((sum, text) => sum + byteLength(text), 0),
      oversizedBundles: storage.packs.filter(pack => pack.bytes > storage.maxBytes).length,
      unindexedMediaPreserved: [...assignments.keys()].filter(base => !referenced.has(base)).length,
      indexEntriesWithoutFiles: missing.length, inventorySha256: checksum } }
}

export function applyMigration(srtsDir, plan) {
  if (plan.alreadyBundled) return
  // The plan must still describe the exact input at apply time.
  if (inventory(readSubtitleFiles(srtsDir)) !== plan.summary.inventorySha256) throw new Error('Subtitle files changed after planning')
  if (digest(readFileSync(join(srtsDir, 'index.json'), 'utf8')) !== plan.originalIndexSha256) throw new Error('Subtitle index changed after planning')
  for (const [path, text] of Object.entries(plan.output)) {
    const destination = join(srtsDir, path)
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination + '.bundle-tmp', text)
    renameSync(destination + '.bundle-tmp', destination)
  }
  writeFileSync(join(srtsDir, 'storage.json.bundle-tmp'), jsonText(plan.storage))
  renameSync(join(srtsDir, 'storage.json.bundle-tmp'), join(srtsDir, 'storage.json'))
  writeFileSync(join(srtsDir, 'index.json.bundle-tmp'), jsonText(plan.index))
  renameSync(join(srtsDir, 'index.json.bundle-tmp'), join(srtsDir, 'index.json'))
  // Verify the on-disk bundles before deleting any source file.
  const reconstructed = Object.assign(Object.create(null), ...Object.keys(plan.output).map(path => parseBundle(readFileSync(join(srtsDir, path), 'utf8'))))
  if (inventory(reconstructed) !== plan.summary.inventorySha256) throw new Error('Written bundle verification failed; original SRTs retained')
  for (const name of Object.keys(plan.documents)) unlinkSync(join(srtsDir, name))
}

function main() {
  const [command, input, ...flags] = process.argv.slice(2)
  if (!input || !['pack', 'unpack', 'verify'].includes(command)) throw new Error('Usage: subtitle-bundles.mjs pack|verify|unpack <srts-dir> [--apply] [--output <directory>]')
  const dir = resolve(input)
  if (command === 'pack') {
    const option = key => flags.includes(key) ? Number(flags[flags.indexOf(key) + 1]) : undefined
    const options = { maxFiles: option('--max-files'), maxBytes: option('--max-bytes') }
    for (const value of Object.values(options)) if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) throw new Error('Invalid bundle limit')
    const plan = planMigration(dir, options)
    if (flags.includes('--apply')) applyMigration(dir, plan)
    console.log(JSON.stringify({ ...plan.summary, ...(plan.alreadyBundled ? plan : {}), applied: flags.includes('--apply') }, null, 2))
  } else {
    const documents = readSubtitleFiles(dir)
    if (command === 'unpack') {
      const at = flags.indexOf('--output')
      if (at < 0 || !flags[at + 1]) throw new Error('Unpack requires a separate --output directory')
      const output = resolve(flags[at + 1])
      if (output === dir) throw new Error('Export to a separate directory')
      mkdirSync(output, { recursive: true })
      for (const [name, text] of Object.entries(documents)) {
        if (name.includes('\\') || name.split('/').some(part => part === '..' || part === '.' || !part)) throw new Error('Unsafe subtitle filename')
        const destination = resolve(output, name)
        if (!destination.startsWith(output + sep)) throw new Error('Unsafe subtitle filename')
        mkdirSync(dirname(destination), { recursive: true })
        if (existsSync(destination) && readFileSync(destination, 'utf8') !== text) throw new Error('Export would replace different content: ' + name)
        writeFileSync(destination, text)
      }
    }
    console.log(JSON.stringify({ files: Object.keys(documents).length, inventorySha256: inventory(documents) }, null, 2))
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
