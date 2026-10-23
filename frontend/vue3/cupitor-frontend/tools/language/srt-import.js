// Import authored/downloaded SRTs through the same planner as captures. A plan
// changes nothing; apply verifies the preview and retains external input files.
import { existsSync, lstatSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { resolve, join, relative, dirname, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { readSubtitleFiles, looseSubtitleNames, planLocalSubtitleFiles, applyLocalSubtitleFiles } from './bundle-store.js'
import { parseBundle, parseStorage, jsonText } from '../../public/language/subtitle-bundles.js'
import { parseSrtEntries, mergeSrtWithNewEntries } from '../../public/language/srt-parser.js'
import { buildCapturedSubtitleBaseName, sanitizeFilenameSegment } from '../../public/language/subtitle-naming.js'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const nfc = text => text.normalize('NFC')
const inside = (root, path) => path.startsWith(root + sep)
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key)

function readIndex(path, snapshots) {
  const bytes = existsSync(path) ? readFileSync(path) : null
  const sha = bytes ? hash(bytes) : null
  if (snapshots.has(path) && snapshots.get(path) !== sha) throw new Error('Index changed while planning: ' + path)
  snapshots.set(path, sha)
  if (!bytes) return []
  const text = bytes.toString('utf8')
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('Subtitle index is not UTF-8: ' + path)
  const index = JSON.parse(text)
  if (!Array.isArray(index) || index.some(e => !e || typeof e.name !== 'string' || typeof e.link !== 'string' || !e.link)) {
    throw new Error('Invalid subtitle index: ' + path)
  }
  return index
}

function inputFiles(path) {
  const stat = lstatSync(path)
  if (stat.isSymbolicLink()) throw new Error('Import regular SRT files instead of symlinks: ' + path)
  if (stat.isFile()) {
    if (!/\.srt$/i.test(path)) throw new Error('Input is not an SRT file: ' + path)
    return [path]
  }
  if (!stat.isDirectory()) throw new Error('Input must be an SRT file or directory')
  return readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    if (entry.isDirectory() && entry.name !== '.git') return inputFiles(join(path, entry.name))
    if (/\.srt$/i.test(entry.name)) return inputFiles(join(path, entry.name))
    return []
  })
}

export async function planSrtImport(srtsDir, options = {}) {
  if (typeof srtsDir !== 'string' || !srtsDir) throw new Error('Set --srtsDir (or srtsDir in config.json)')
  for (const key of ['link', 'title', 'channel', 'source', 'lang']) {
    if (options[key] !== undefined && (typeof options[key] !== 'string' || !options[key].trim())) throw new Error('--' + key + ' needs a value')
  }
  if (options.merge && options.replace) throw new Error('Choose either --merge or --replace')
  if (options.input !== undefined && (typeof options.input !== 'string' || !options.input)) throw new Error('--input needs a file or directory')
  const root = resolve(srtsDir), input = resolve(options.input || root)
  const files = inputFiles(input), folder = lstatSync(input).isDirectory() ? input : dirname(input), inputs = new Map()
  const indexPath = join(root, 'index.json'), index = readIndex(indexPath, inputs)
  const hintPath = join(folder, 'index.json'), hints = readIndex(hintPath, inputs)
  const bundled = existsSync(join(root, 'storage.json'))
  const loose = existsSync(root) ? looseSubtitleNames(root) : []
  const initializeBundles = !bundled && !index.length && loose.every(name => files.includes(join(root, name)))
  const documents = existsSync(root) ? readSubtitleFiles(root, { includeLoose: !bundled }) : Object.create(null)
  const groups = new Map()
  const remember = path => {
    const bytes = readFileSync(path)
    inputs.set(path, hash(bytes))
    return bytes
  }
  const addFile = (path, name = relative(folder, path).split(sep).join('/')) => {
    const match = name.match(/^(.+)\.([a-z]{2,3}(?:-[a-z0-9]+)*)\.srt$/i)
    const base = match ? match[1] : name.replace(/\.srt$/i, '')
    const code = (match ? match[2] : options.lang || 'sv').toLowerCase()
    if (!/^[a-z]{2,3}(?:-[a-z0-9]+)*$/i.test(code)) throw new Error('Invalid subtitle language: ' + code)
    const bytes = remember(path), text = bytes.toString('utf8')
    if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('Convert this SRT to UTF-8 before importing: ' + path)
    if (!parseSrtEntries(text).length) throw new Error('No subtitle cues found in: ' + path)
    const key = nfc(base)
    if (!groups.has(key)) groups.set(key, { base, tracks: new Map() })
    const tracks = groups.get(key).tracks
    if (tracks.has(code) && tracks.get(code).text !== text) throw new Error('Two input files disagree for ' + base + '.' + code)
    tracks.set(code, { text, path })
  }
  files.forEach(path => addFile(path))
  if (options.link && groups.size > 1) throw new Error('--link can only be used for one media at a time')
  const nextIndex = index.map(entry => ({ ...entry })), imported = [], operations = [], byKey = new Map()
  let newMedia = 0, changedTracks = 0, unchangedTracks = 0
  const choose = (entries, group) => {
    const found = entries.filter(e => nfc(e.name) === nfc(group.base) || nfc(e.bundleKey || e.name) === nfc(group.base))
    if (new Set(found.map(e => e.link)).size > 1) throw new Error('Ambiguous index entries for: ' + group.base)
    return found[0]
  }
  const byLink = link => {
    const found = nextIndex.filter(e => e.link === link)
    if (new Set(found.map(e => e.name)).size > 1) throw new Error('Several indexed names use link ' + link + '; use the existing filename')
    return found[0]
  }
  let orphanLocations
  const orphanLocation = key => {
    if (!orphanLocations) {
      orphanLocations = new Map()
      const storage = parseStorage(readFileSync(join(root, 'storage.json'), 'utf8'))
      for (const pack of storage.packs) for (const name of Object.keys(parseBundle(readFileSync(join(root, pack.path), 'utf8')))) {
        orphanLocations.set(name, { bundle: pack.path, bundleRevision: pack.revision })
      }
    }
    return orphanLocations.get(key)
  }
  for (const group of groups.values()) {
    const hint = choose(hints, group), named = choose(nextIndex, group)
    const inferred = group.base.includes(' || ') ? group.base.split(' || ').at(-1).trim() : ''
    let suppliedLink = options.link
    if (suppliedLink && /^https?:\/\//i.test(suppliedLink) && (options.source || hint?.source || named?.source || 'YouTube') === 'YouTube') {
      const url = new URL(suppliedLink), host = url.hostname.replace(/^www\./, '')
      suppliedLink = host === 'youtu.be' ? url.pathname.split('/')[1] : ['youtube.com', 'm.youtube.com'].includes(host)
        ? url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] : ''
      if (!suppliedLink) throw new Error('--link needs a YouTube video ID or video URL')
    }
    const link = suppliedLink || hint?.link || named?.link || inferred
    if (!link || typeof link !== 'string') throw new Error('No media link for ' + group.base + '; supply --link or an input index.json')
    if ((named && named.link !== link) || (hint && hint.link !== link)) throw new Error('Conflicting media links for: ' + group.base)
    let entry = named || byLink(link)
    if (!entry) {
      const { bundle, bundleRevision, bundleKey, ...metadata } = hint || {}
      const name = hint || inferred ? group.base : buildCapturedSubtitleBaseName({ videoId: sanitizeFilenameSegment(link, 100), videoTitle: options.title || group.base, channel: options.channel })
      entry = { ...metadata, link, name: nfc(name), source: options.source || hint?.source || 'YouTube', ...(nfc(name) !== name ? { bundleKey: name } : {}) }
      nextIndex.push(entry)
      newMedia++
    }
    const base = entry.bundleKey || entry.name
    // Preserve other loose tracks when adopting a manually indexed media in a
    // bundled directory, even when only one track was selected for import.
    if (bundled && !entry.bundle) for (const name of loose) {
      const match = name.match(/^(.+)\.([a-z]{2,3}(?:-[a-z0-9]+)*)\.srt$/i)
      if (match && nfc(match[1]) === nfc(base) && !group.tracks.has(match[2].toLowerCase())) {
        const path = join(root, name), bytes = remember(path), text = bytes.toString('utf8')
        if (!Buffer.from(text, 'utf8').equals(bytes) || !parseSrtEntries(text).length) throw new Error('Invalid sibling subtitle: ' + name)
        group.tracks.set(match[2].toLowerCase(), { text, path })
      }
    }
    for (const [code, track] of group.tracks) {
      const key = base + '.' + code + '.srt', current = documents[key]
      const transform = current => {
        if (current == null || current === track.text || options.replace) return track.text
        if (options.merge) return mergeSrtWithNewEntries(current, parseSrtEntries(track.text))
        throw new Error('Subtitle already exists with different text: ' + key + '; choose --merge or --replace')
      }
      const text = transform(current)
      if (bundled && !entry.bundle && owns(documents, key)) Object.assign(entry, orphanLocation(key))
      if (byKey.has(key)) {
        if (byKey.get(key).incoming !== track.text) throw new Error('Several inputs would replace the same track: ' + key)
        continue
      }
      if (current === text) unchangedTracks++; else changedTracks++
      const record = { key, text, incoming: track.text, link }
      imported.push(record); byKey.set(key, record)
      operations.push({ path: key, getContent: current => { record.text = transform(current); return record.text } })
    }
  }
  if (operations.length) operations.push({ path: 'index.json', getContent: () => jsonText(nextIndex) })
  const storagePlan = await planLocalSubtitleFiles(root, operations, { initializeBundles })
  const indexRead = storagePlan.reads.find(item => item.path === 'index.json')
  if (indexRead && indexRead.sha !== inputs.get(indexPath)) throw new Error('Subtitle index changed while planning')
  return { root, storagePlan, inputs: [...inputs], imported, bundled: bundled || initializeBundles,
    summary: { media: new Set(imported.map(track => track.link)).size, tracks: imported.length, newMedia, changedTracks, unchangedTracks,
      storage: bundled || initializeBundles ? 'bundles' : 'loose SRTs',
      changedFiles: storagePlan.changes.map(change => relative(root, change.path).split(sep).join('/')) } }
}

export function applySrtImport(plan) {
  for (const [path, sha] of plan.inputs) {
    if ((existsSync(path) ? hash(readFileSync(path)) : null) !== sha) throw new Error('Import input changed after planning: ' + path)
  }
  applyLocalSubtitleFiles(plan.root, plan.storagePlan)
  if (!plan.imported.length) return plan.summary
  const documents = readSubtitleFiles(plan.root, { includeLoose: !plan.bundled })
  for (const track of plan.imported) if (documents[track.key] !== track.text) throw new Error('Imported subtitle verification failed; input files retained: ' + track.key)
  // The originals outside the data directory are always retained. In-place
  // drop-ins are removed only after their exact resulting tracks were verified.
  if (plan.bundled) for (const [path] of plan.inputs) {
    if (/\.srt$/i.test(path) && inside(plan.root, path)) unlinkSync(path)
  }
  return plan.summary
}
