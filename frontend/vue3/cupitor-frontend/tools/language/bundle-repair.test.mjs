import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { planBundleRepair, applyBundleRepair } from './bundle-repair.js'
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
  const root = mkdtempSync(join(tmpdir(), 'bundle-repair-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'packs'))
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
