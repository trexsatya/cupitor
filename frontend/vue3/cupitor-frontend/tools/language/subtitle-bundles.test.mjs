import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { planMigration, applyMigration } from './subtitle-bundles.mjs'
import { readSubtitleFiles, commitLocalSubtitleFiles, looseSubtitleNames } from './bundle-store.js'
import { saveHit } from './srt-store.js'
import { execFileSync } from 'node:child_process'
import { parseSrtEntries, linesToSrtText, srtTimeToSeconds } from '../../public/language/srt-parser.js'
import { emptyStorage } from '../../public/language/subtitle-bundles.js'

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

// Real captures from before/after a9471fea. The merger keeps the old context;
// span-only pruning subsequently mistook the sparse union for a full transcript.
const captureFixture = suffix => parseSrtEntries(readFileSync(new URL(
  '../../tests/fixtures/captured-context/CwQNmKM3b04.' + suffix + '.sv.srt', import.meta.url), 'utf8'))

for (const bundled of [false, true]) for (const allCovered of [false, true]) {
  test(`capture → merge → prune preserves fördömelse and context (bundled=${bundled}, allCovered=${allCovered})`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'captured-context-prune-'))
    const srts = join(root, 'srts'), out = join(root, 'out')
    mkdirSync(srts)
    try {
      if (bundled) writeFileSync(join(srts, 'storage.json'), JSON.stringify(emptyStorage()))
      writeFileSync(join(root, 'vocabulary.txt'), '# Test\n(condemnation)|fördömelse|\n(sermon)|predikan|\n(unique)|unikord|\n')
      const original = captureFixture('original'), later = captureFixture('later')
      const videoId = 'CwQNmKM3b04', opts = { sourceLang: 'sv', targetLang: 'en', writeTarget: false }
      const capture = async (entries, extra = {}) => saveHit(srts, {
        videoId, title: 'Fredag morgon _ Marie-Louise Nilsson', channel: 'Word of Life Play',
        lines: entries.map(cue => ({ ts: srtTimeToSeconds(cue.start), text: cue.text })),
      }, null, { ...opts, defaultDurSec: srtTimeToSeconds(entries.at(-1).end) - srtTimeToSeconds(entries.at(-1).start), ...extra })
      const { baseName } = await capture(original)
      const key = baseName + '.sv.srt'
      await saveHit(srts, { videoId: 'other', title: 'Other example', channel: 'Test',
        lines: [{ ts: 1, text: allCovered ? 'fördömelse och predikan' : 'fördömelse' }] }, null, opts)

      // A genuine continuous transcript must still shrink around its unique
      // vocabulary; a fully redundant continuous transcript must still delete.
      const full = linesToSrtText(Array.from({ length: 100 }, (_, i) => ({ start: i * 2, end: i * 2 + 2,
        text: i === 30 ? 'unikord' : 'en neutral rad' })))
      const redundant = full.replace('unikord', 'en neutral rad')
      await commitLocalSubtitleFiles(srts, [
        { path: 'full.sv.srt', getContent: () => full },
        { path: 'redundant.sv.srt', getContent: () => redundant },
        { path: baseName + '.en.srt', getContent: () => '1\n01:17:40,280 --> 01:17:42,880\nExisting translation\n' },
        { path: 'index.json', getContent: text => JSON.stringify([...JSON.parse(text),
          { name: 'full', link: 'full', source: 'YouTube' }, { name: 'redundant', link: 'redundant', source: 'YouTube' }]) },
      ])
      await capture(later.slice(0, 7))
      await capture(later.slice(7))
      const before = readSubtitleFiles(srts)
      assert.equal(parseSrtEntries(before[key]).length, 14, 'the real capture/store path retained both windows')
      const legacyIndex = JSON.parse(readFileSync(join(srts, 'index.json')))
      assert.equal(legacyIndex.find(entry => entry.link === videoId).preserveCapturedContext, true)
      // Exercise the layout fallback for legacy captures saved before the
      // explicit capture marker was introduced.
      legacyIndex.forEach(entry => { if (entry.link === videoId) delete entry.preserveCapturedContext })
      writeFileSync(join(srts, 'index.json'), JSON.stringify(legacyIndex))
      for (const cue of original) assert(parseSrtEntries(before[key]).some(saved =>
        saved.start === cue.start && saved.end === cue.end && saved.text === cue.text))
      const run = () => execFileSync(process.execPath, ['tools/language/lang-manage.js', 'prune',
        '--dataDir', root, '--srtsDir', srts, '--outDir', out, '--apply'], { encoding: 'utf8', timeout: 15000 })
      run()
      const after = readSubtitleFiles(srts)
      assert.equal(after[key], before[key], 'pruning must preserve every merged cue, even if its word exists elsewhere')
      assert.equal(after[baseName + '.en.srt'], before[baseName + '.en.srt'], 'paired translation remains unchanged')
      assert.equal(parseSrtEntries(after['full.sv.srt']).length, 9, 'continuous full transcript still shrinks to context')
      assert(!Object.hasOwn(after, 'redundant.sv.srt'), 'redundant continuous full transcript still deletes')
      const plan = JSON.parse(readFileSync(join(out, 'prune-plan.json')))
      assert(!plan.some(entry => entry.name === baseName), 'captured excerpts never enter the destructive plan')
      const index = JSON.parse(readFileSync(join(srts, 'index.json')))
      assert(index.some(entry => entry.link === videoId))
      assert(!index.some(entry => entry.link === 'redundant'))
      const state = JSON.stringify(after)
      run()
      assert.equal(JSON.stringify(readSubtitleFiles(srts)), state, 'a second prune is a no-op')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
}

for (const bundled of [false, true]) for (const origin of ['capture', 'recovery']) {
  test(`explicit ${origin} protection keeps continuous examples intact (bundled=${bundled})`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'protected-context-prune-')), srts = join(root, 'srts')
    mkdirSync(srts)
    try {
      if (bundled) writeFileSync(join(srts, 'storage.json'), JSON.stringify(emptyStorage()))
      writeFileSync(join(root, 'vocabulary.txt'), '# Test\n(word)|ord|\n')
      const captured = await saveHit(srts, { videoId: 'continuous', title: 'Long example', channel: 'Test',
        lines: Array.from({ length: 50 }, (_, n) => ({ ts: n * 2, text: 'ord ' + n })) }, null,
      { sourceLang: 'sv', targetLang: 'en', writeTarget: false, defaultDurSec: 2 })
      if (origin === 'recovery') {
        const index = JSON.parse(readFileSync(join(srts, 'index.json')))
        // Recovery may retain a legacy bundleKey behind a normalized name.
        index[0].bundleKey = captured.baseName
        index[0].name = 'Normalized name'
        index[0].preserveCapturedContext = true
        writeFileSync(join(srts, 'index.json'), JSON.stringify(index))
      }
      const before = readSubtitleFiles(srts)
      execFileSync(process.execPath, ['tools/language/lang-manage.js', 'prune', '--dataDir', root,
        '--srtsDir', srts, '--outDir', join(root, 'out'), '--apply'], { encoding: 'utf8', timeout: 15000 })
      assert.deepEqual(readSubtitleFiles(srts), before)
      assert.equal(parseSrtEntries(before[captured.baseName + '.sv.srt']).length, 50)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
}
