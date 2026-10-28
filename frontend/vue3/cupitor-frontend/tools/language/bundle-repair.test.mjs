import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { planBundleRepair, applyBundleRepair } from './bundle-repair.js'
import { inspectBundleConflicts, formatBundleConflicts, exportBundleConflicts } from './bundle-inspect.js'
import { readSubtitleFiles } from './bundle-store.js'
import { bundleText, jsonText, emptyStorage, parseBundle } from '../../public/language/subtitle-bundles.js'
import { parseSrtEntries } from '../../public/language/srt-parser.js'

const a = 'Channel || Title || video001'
const b = 'Another || Title || video002'
const c = 'Third || Title || video003'
const p1 = 'packs/pack-000001.json'
const p2 = 'packs/pack-000002.json'
const cue = (text, sec = 10) => `1\n00:00:${String(sec).padStart(2, '0')},000 --> 00:00:${String(sec + 2).padStart(2, '0')},000\n${text}\n`
const source = `${a}.sv.srt`
const translated = `${a}.en.srt`
const other = `${b}.sv.srt`
const unrelated = `${c}.sv.srt`

function setup(t, { first, second, indexBundle = p2, includeIndex = true, maxFiles = 200, rawIndex = null } = {}) {
  const parent = mkdtempSync(join(tmpdir(), 'bundle-repair-test-'))
  const root = join(parent, 'srts')
  t.after(() => rmSync(parent, { recursive: true, force: true }))
  mkdirSync(join(root, 'packs'), { recursive: true })
  const one = first || { [source]: cue('Hej'), [other]: cue('Other') }
  const two = second || { [source]: cue('Hej'), [translated]: cue('Hello'), [unrelated]: cue('Third') }
  writeFileSync(join(root, p1), bundleText(one))
  writeFileSync(join(root, p2), bundleText(two))
  const storage = emptyStorage({ maxFiles })
  storage.nextPack = 3
  storage.packs = [one, two].map((files, i) => ({
    path: i ? p2 : p1, revision: 1,
    files: Object.keys(files).length, bytes: Buffer.byteLength(bundleText(files)),
  }))
  writeFileSync(join(root, 'storage.json'), jsonText(storage))
  writeFileSync(join(root, 'index.json'), rawIndex || jsonText([
    ...(includeIndex ? [{ name: a, link: 'video001', source: 'YouTube', bundle: indexBundle, bundleRevision: 1, category: 'Retain me' }] : []),
    { name: b, link: 'video002', source: 'YouTube', bundle: p1, bundleRevision: 1 },
    { name: c, link: 'video003', source: 'YouTube', bundle: p2, bundleRevision: 1 },
  ]))
  return root
}

const getIndex = root => JSON.parse(readFileSync(join(root, 'index.json'), 'utf8'))
const getStorage = root => JSON.parse(readFileSync(join(root, 'storage.json'), 'utf8'))
const docs = root => readSubtitleFiles(root, { includeLoose: false })

test('dry run reports duplicates without touching files; apply preserves all tracks and metadata, with backup', t => {
  const root = setup(t)
  assert.throws(() => docs(root), /more than one bundle/)
  const old1 = readFileSync(join(root, p1), 'utf8')
  const old2 = readFileSync(join(root, p2), 'utf8')
  const plan = planBundleRepair(root)
  assert.equal(plan.blocked, false)
  assert.equal(plan.summary.duplicateTracks, 1)
  assert.equal(plan.summary.affectedMedia, 1)
  assert(plan.summary.changedFiles.includes(p1))
  assert.equal(readFileSync(join(root, p1), 'utf8'), old1, 'planning never writes')
  assert.equal(readFileSync(join(root, p2), 'utf8'), old2)

  const outcome = applyBundleRepair(plan)
  assert(existsSync(join(outcome.backup, p1)))
  assert.equal(readFileSync(join(outcome.backup, p1), 'utf8'), old1)
  assert.deepEqual(Object.keys(docs(root)).sort(), [source, translated, other, unrelated].sort())
  assert.deepEqual(parseSrtEntries(docs(root)[translated]).map(x => x.text), ['Hello'])
  const entries = getIndex(root)
  assert.equal(entries.find(x => x.link === 'video001').bundle, p2)
  assert.equal(entries.find(x => x.link === 'video001').category, 'Retain me')
  assert.equal(entries.find(x => x.link === 'video002').bundleRevision, 2, 'old pack revision refreshed')
  assert.equal(getStorage(root).packs.find(x => x.path === p1).files, 1)
  assert.equal(planBundleRepair(root).summary.duplicateTracks, 0)
  assert.deepEqual(planBundleRepair(root).summary.changedFiles, [], 'second run is a no-op')
})

test('a duplicate without an index entry retains both language tracks in one original pack', t => {
  const root = setup(t, { includeIndex: false })
  const plan = planBundleRepair(root)
  assert.deepEqual(plan.summary.unindexedMedia, [a])
  applyBundleRepair(plan)
  const after = docs(root)
  assert.equal(after[source], cue('Hej'))
  assert.equal(after[translated], cue('Hello'))
  assert.deepEqual(Object.keys(after).sort(), [source, translated, other, unrelated].sort())
  assert.equal(getIndex(root).some(entry => entry.link === 'video001'), false, 'repair does not invent metadata')
})

test('differing copies are blocked without --merge, and conflicting timestamps are blocked with --merge', t => {
  const root = setup(t, { second: { [source]: cue('Different'), [translated]: cue('Hello'), [unrelated]: cue('Third') } })
  const before = readFileSync(join(root, p1), 'utf8')
  let plan = planBundleRepair(root)
  assert.equal(plan.blocked, true)
  assert.match(plan.summary.conflicts[0].reason, /Different/)
  assert.throws(() => applyBundleRepair(plan), /conflicts/)
  plan = planBundleRepair(root, { merge: true })
  assert.equal(plan.blocked, true)
  assert(plan.summary.conflicts[0].timestamps.length > 0)
  assert.equal(readFileSync(join(root, p1), 'utf8'), before)
})

test('non-overlapping differing SRTs require opt-in merge and preserve all cues', t => {
  const root = setup(t, { second: { [source]: cue('Second cue', 20), [translated]: cue('Hello'), [unrelated]: cue('Third') } })
  assert.equal(planBundleRepair(root).blocked, true)
  const plan = planBundleRepair(root, { merge: true })
  assert.equal(plan.blocked, false)
  const done = applyBundleRepair(plan)
  assert(existsSync(done.backup))
  assert.deepEqual(parseSrtEntries(docs(root)[source]).map(x => x.text), ['Hej', 'Second cue'])
  assert.equal(planBundleRepair(root).summary.duplicateTracks, 0)
})

test('full existing preferred pack allocates a new pack and keeps index pointers valid', t => {
  const root = setup(t, {
    maxFiles: 1,
    first: { [source]: cue('Hej'), [other]: cue('Other') },
    second: { [source]: cue('Hej'), [unrelated]: cue('Third') },
  })
  const plan = planBundleRepair(root)
  assert.equal(plan.blocked, false)
  applyBundleRepair(plan)
  const index = getIndex(root)
  const firstMedia = index.find(x => x.link === 'video001')
  assert.equal(firstMedia.bundle, 'packs/pack-000003.json')
  assert.equal(index.find(x => x.link === 'video002').bundle, p1)
  assert.equal(index.find(x => x.link === 'video003').bundle, p2)
  assert.equal(getStorage(root).nextPack, 4)
  assert.equal(docs(root)[source], cue('Hej'))
  assert.equal(Object.keys(docs(root)).length, 3)
})

test('a stale preview never overwrites a newly updated pack', t => {
  const root = setup(t), plan = planBundleRepair(root)
  writeFileSync(join(root, p1), readFileSync(join(root, p1), 'utf8') + ' ')
  assert.throws(() => applyBundleRepair(plan), /changed since repair preview/)
})

test('a valid store without duplicate keys is unchanged, including original index whitespace', t => {
  const root = setup(t, { first: { [other]: cue('Other') }, rawIndex: JSON.stringify([
    { name: b, link: 'video002', bundle: p1, bundleRevision: 1 },
    { name: a, link: 'video001', bundle: p2, bundleRevision: 1 },
    { name: c, link: 'video003', bundle: p2, bundleRevision: 1 },
  ]) })
  const original = readFileSync(join(root, 'index.json'), 'utf8')
  const plan = planBundleRepair(root)
  assert.deepEqual(plan.summary.changedFiles, [])
  assert.equal(applyBundleRepair(plan).backup, null)
  assert.equal(readFileSync(join(root, 'index.json'), 'utf8'), original)
})

test('inspect reports differing pack copies with legible SRT text and exact timestamps', t => {
  const root = setup(t, { second: { [source]: cue('Andra versionen', 20), [translated]: cue('Hello') } })
  const conflicts = inspectBundleConflicts(root, { link: 'video001' })
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].key, source)
  assert.deepEqual(conflicts[0].copies.map(c => c.pack), [p1, p2])
  const readable = formatBundleConflicts(conflicts)
  assert.match(readable, /SUBTITLE: Channel/)
  assert.match(readable, /pack-000001.json/)
  assert.match(readable, /00:00:10,000 --> 00:00:12,000\nHej/)
  assert.match(readable, /00:00:20,000 --> 00:00:22,000\nAndra versionen/)
  assert.equal(inspectBundleConflicts(root, { link: 'different-video' }).length, 0)
  assert.match(formatBundleConflicts([]), /No differing duplicate/)
  assert.equal(readFileSync(join(root, p1), 'utf8').includes('Andra versionen'), false, 'inspection is read-only')
})

test('export writes unchanged readable SRTs with source-pack mapping outside the data store', t => {
  const root = setup(t, { second: { [source]: cue('Second', 20) } })
  const out = join(dirname(root), 'readable-conflicts')
  const conflicts = inspectBundleConflicts(root)
  const result = exportBundleConflicts(root, conflicts, out)
  assert.equal(result.files.length, 2)
  for (const file of result.files) {
    assert.equal(readFileSync(join(out, file.file), 'utf8'),
      conflicts[0].copies.find(c => c.pack === file.pack).text)
    assert(file.file.endsWith('.srt'))
  }
  const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'))
  assert.equal(manifest[0].subtitle, source)
  assert.deepEqual(manifest.map(x => x.pack), [p1, p2])
  assert.equal(readdirSync(out).length, 3)
  assert.throws(() => exportBundleConflicts(root, conflicts, out), /empty regular directory/)
  assert.throws(() => exportBundleConflicts(root, conflicts, join(root, 'extracted')), /outside srtsDir/)
  assert.throws(() => docs(root), /more than one bundle/, 'export does not touch the original packs')
})

test('CLI provides readable console inspection and export, without applying or modifying bundles', t => {
  const root = setup(t, { second: { [source]: cue('Second', 20) } })
  const cli = fileURLToPath(new URL('./lang-manage.js', import.meta.url))
  const original = readFileSync(join(root, p1), 'utf8')
  const lines = execFileSync(process.execPath, [cli, 'repair', '--srtsDir', root, '--inspect', '--link', 'video001'], { encoding: 'utf8' })
  assert.match(lines, /pack-000001.json/)
  assert.match(lines, /00:00:20,000 --> 00:00:22,000\nSecond/)
  assert.equal(readFileSync(join(root, p1), 'utf8'), original)
  const output = join(dirname(root), 'cli-conflicts')
  const shown = execFileSync(process.execPath, [cli, 'repair', '--srtsDir', root, '--exportDir', output], { encoding: 'utf8' })
  assert.match(shown, /readable|cli-conflicts/)
  assert.equal(readdirSync(output).filter(x => x.endsWith('.srt')).length, 2)
  const invalid = spawnSync(process.execPath, [cli, 'repair', '--srtsDir', root, '--inspect', '--apply'], { encoding: 'utf8' })
  assert.equal(invalid.status, 1)
  assert.match(invalid.stderr, /do not combine with --apply/)
  assert.equal(readFileSync(join(root, p1), 'utf8'), original)
})

test('explicit indexed-preference repair keeps clean SV, retains orphan EN and backs up originals', t => {
  const manual = cue('Clean manually transcribed Swedish', 11)
  const rough = cue('Rough automatic speech', 10)
  const root = setup(t, {
    first: { [source]: rough, [translated]: cue('English translation', 10), [other]: cue('Other') },
    second: { [source]: manual, [unrelated]: cue('Third') },
  })
  assert.equal(planBundleRepair(root).blocked, true)
  const plan = planBundleRepair(root, { preferIndexed: true })
  assert.equal(plan.blocked, false)
  const done = applyBundleRepair(plan)
  assert(existsSync(join(done.backup, p1)))
  assert.equal(parseBundle(readFileSync(join(done.backup, p1), 'utf8'))[source], rough)
  const files = docs(root)
  assert.equal(files[source], manual)
  assert.equal(files[translated], cue('English translation', 10))
  assert.equal(getIndex(root).find(e => e.link === 'video001').bundle, p2)
  assert.equal(planBundleRepair(root).summary.duplicateTracks, 0)
})

test('indexed-preference repair refuses unindexed duplicate data and incompatible merging options', t => {
  const root = setup(t, { includeIndex: false, second: { [source]: cue('Different', 20) } })
  assert.equal(planBundleRepair(root, { preferIndexed: true }).blocked, true)
  assert.match(planBundleRepair(root, { preferIndexed: true }).summary.conflicts[0].reason, /indexed pack/)
  assert.throws(() => planBundleRepair(root, { merge: true, preferIndexed: true }), /either/)
})
