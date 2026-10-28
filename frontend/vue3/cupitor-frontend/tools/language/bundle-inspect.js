// Inspect raw subtitle SRT text without editing any JSON bundle.
import { readFileSync, existsSync, mkdirSync, writeFileSync, lstatSync, readdirSync } from 'node:fs'
import { resolve, join, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { parseStorage, parseBundle, bundlePath } from '../../public/language/subtitle-bundles.js'
import { parseSrtEntries } from '../../public/language/srt-parser.js'

const sha = value => createHash('sha256').update(value).digest('hex')
const safe = value => String(value || '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 45) || 'subtitle'

// Find only copies with different content; identical copies are handled by
// repair --apply and do not need a human comparison.
export function inspectBundleConflicts(srtsDir, { link = '' } = {}) {
  if (typeof srtsDir !== 'string' || !srtsDir) throw new Error('Supply srtsDir for subtitle inspection')
  const root = resolve(srtsDir)
  const manifest = join(root, 'storage.json')
  if (!existsSync(manifest)) throw new Error('Missing subtitle storage.json: ' + manifest)
  const storage = parseStorage(readFileSync(manifest, 'utf8'))
  const locations = new Map()
  for (const pack of storage.packs) {
    const path = bundlePath(pack.path), file = join(root, path)
    if (!lstatSync(file).isFile()) throw new Error('Not a regular subtitle bundle: ' + file)
    const tracks = parseBundle(readFileSync(file, 'utf8'))
    for (const [key, text] of Object.entries(tracks)) {
      if (link && !key.includes(link)) continue
      if (!locations.has(key)) locations.set(key, [])
      locations.get(key).push({ pack: path, text })
    }
  }
  return [...locations]
    .filter(([, copies]) => copies.length > 1 && new Set(copies.map(c => c.text)).size > 1)
    .map(([key, copies]) => ({ key, copies }))
}

// Render full SRT blocks with timestamps and ordinary line breaks instead
// of JSON escape sequences. Each version is labeled with its source pack.
export function formatBundleConflicts(conflicts) {
  if (!conflicts.length) return 'No differing duplicate subtitle tracks found.'
  return conflicts.map(({key, copies}) => [
    'SUBTITLE: ' + key,
    ...copies.flatMap(({pack, text}) => [
      '---- ' + pack + ' (' + parseSrtEntries(text).length + ' cues) ----',
      text.trimEnd(),
      '---- END ' + pack + ' ----',
    ]),
  ].join('\n')).join('\n\n') + '\n'
}

// Export exact SRT contents as readable stand-alone files outside srtsDir.
// The manifest links every exported copy to its full key and original pack.
export function exportBundleConflicts(srtsDir, conflicts, outputDir) {
  if (!outputDir || typeof outputDir !== 'string') throw new Error('Supply --exportDir')
  const root = resolve(srtsDir), output = resolve(outputDir)
  if (output === root || output.startsWith(root + sep)) {
    throw new Error('Exports must be outside srtsDir so they are not mistaken for loose subtitle tracks')
  }
  if (existsSync(output)) {
    if (!lstatSync(output).isDirectory() || readdirSync(output).length) {
      throw new Error('Export directory must be an empty regular directory: ' + output)
    }
  }
  const records = []
  for (const {key, copies} of conflicts) for (const {pack, text} of copies) {
    const match = key.match(/\.([a-z]{2,3}(?:-[a-z0-9]+)*)\.srt$/i)
    const lang = match?.[1] || 'unknown'
    const id = safe(key.split(' || ').at(-1)?.replace(/\.[^.]+\.srt$/i, '') || key)
    const file = `${id}__${safe(pack.split('/').at(-1).replace(/\.json$/, ''))}__${lang}__${sha(key).slice(0, 12)}.srt`
    records.push({ file, subtitle: key, pack, text })
  }
  mkdirSync(output, { recursive: true })
  for (const {file, text} of records) writeFileSync(join(output, file), text, { flag: 'wx' })
  writeFileSync(join(output, 'manifest.json'), JSON.stringify(records.map(({text, ...record}) =>
    ({...record, sha256: sha(text), cues: parseSrtEntries(text).length})), null, 2) + '\n', { flag: 'wx' })
  return { directory: output, files: records.map(({file, subtitle, pack}) => ({file, subtitle, pack})) }
}
