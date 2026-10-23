import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { planMigration, applyMigration } from './subtitle-bundles.mjs'
import { readSubtitleFiles, commitLocalSubtitleFiles, looseSubtitleNames } from './bundle-store.js'
import { saveHit } from './srt-store.js'

test('migration preserves Unicode, CRLF, indexed and orphan tracks exactly; reruns are no-ops', () => {
  const dir = mkdtempSync(join(tmpdir(), 'subtitle-migration-'))
  try {
    const name = 'Kanal || Ra\u0308ksmo\u0308rga\u030as || id'
    const documents = { [name + '.sv.srt']: '\ufeff1\r\n00:00:00,000 --> 00:00:01,000\r\nåäö\r\n',
      [name + '.en.srt']: 'Translation\n', 'unindexed/part2.sv-orig.srt': 'Archive\n' }
    for (const [file, text] of Object.entries(documents)) { mkdirSync(dirname(join(dir, file)), { recursive: true }); writeFileSync(join(dir, file), text) }
    writeFileSync(join(dir, 'index.json'), JSON.stringify([{ link: 'id', name: name.normalize('NFC'), source: 'YouTube' }, { link: 'missing', name: 'Missing' }]))
    const plan = planMigration(dir)
    assert.equal(plan.summary.indexEntriesWithoutFiles, 1)
    assert.equal(looseSubtitleNames(dir).length, 3, 'planning does not modify input')
    applyMigration(dir, plan)
    assert.deepEqual({ ...readSubtitleFiles(dir) }, documents)
    assert.equal(looseSubtitleNames(dir).length, 0)
    assert.equal(JSON.parse(readFileSync(join(dir, 'index.json')))[0].bundleKey, name)
    assert.equal(planMigration(dir).alreadyBundled, true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('local capture merges into bundles, adds a translation and never recreates loose SRT files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'subtitle-authoring-'))
  try {
    const name = 'Kanal || Existing title || id'
    const original = '1\n00:00:01,000 --> 00:00:03,000\nFirst cue.\n'
    writeFileSync(join(dir, name + '.sv.srt'), original)
    writeFileSync(join(dir, 'index.json'), JSON.stringify([{ link: 'id', name, source: 'YouTube' }]))
    applyMigration(dir, planMigration(dir))
    await saveHit(dir, { videoId: 'id', title: 'Changed title', channel: 'Kanal', lines: [{ ts: 10, text: 'Second cue.' }] }, ['Translation'], { sourceLang: 'sv', targetLang: 'en' })
    const documents = readSubtitleFiles(dir)
    assert.match(documents[name + '.sv.srt'], /First cue/)
    assert.match(documents[name + '.sv.srt'], /Second cue/)
    assert.match(documents[name + '.en.srt'], /Translation/)
    assert.equal(readdirSync(dir).filter(f => f.endsWith('.srt')).length, 0)
    await saveHit(dir, { videoId: 'new', title: 'New', channel: 'Kanal', lines: [{ ts: 1, text: 'New cue' }] }, null, { sourceLang: 'sv', targetLang: 'en', writeTarget: false })
    assert(Object.values(readSubtitleFiles(dir)).some(text => text.includes('New cue')))
    const index = JSON.parse(readFileSync(join(dir, 'index.json')))
    assert.equal(index.length, 2)
    assert(index.every(e => e.bundle && e.bundleRevision))
    await commitLocalSubtitleFiles(dir, [{ path: name + '.sv.srt', delete: true }, { path: name + '.en.srt', delete: true },
      { path: 'index.json', getContent: text => JSON.stringify(JSON.parse(text).filter(e => e.link !== 'id')) }])
    assert(!Object.hasOwn(readSubtitleFiles(dir), name + '.sv.srt'))
    assert(Object.values(readSubtitleFiles(dir)).some(text => text.includes('New cue')))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('migration refuses to delete data which changed after the dry run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'subtitle-race-'))
  try {
    writeFileSync(join(dir, 'a.sv.srt'), 'Original')
    writeFileSync(join(dir, 'index.json'), JSON.stringify([{ link: 'a', name: 'a' }]))
    const plan = planMigration(dir)
    writeFileSync(join(dir, 'a.sv.srt'), 'Changed elsewhere')
    assert.throws(() => applyMigration(dir, plan), /changed after planning/)
    assert.equal(readFileSync(join(dir, 'a.sv.srt'), 'utf8'), 'Changed elsewhere')
    assert(!existsSync(join(dir, 'storage.json')))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
