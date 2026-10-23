import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { planSrtImport, applySrtImport } from './srt-import.js'
import { readSubtitleFiles, looseSubtitleNames } from './bundle-store.js'
import { applyMigration, planMigration } from './subtitle-bundles.mjs'

const cue = (text, second = '01') => `1\n00:00:${second},000 --> 00:00:${String(Number(second) + 2).padStart(2, '0')},000\n${text}\n`
const first = 'Kanal || Första || video000001', second = 'Kanal || Andra || video000002'
const write = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text) }
const index = dir => JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'))
const snapshot = dir => existsSync(dir) ? Object.fromEntries(readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter(e => e.isFile()).map(e => { const path = join(e.parentPath, e.name); return [path.slice(dir.length), readFileSync(path).toString('base64')] })) : {}
function setup(t, { bundled = true } = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'srt-import-')), target = join(temp, 'srts'), input = join(temp, 'incoming')
  t.after(() => rmSync(temp, { recursive: true, force: true }))
  mkdirSync(target); mkdirSync(input)
  write(join(target, first + '.sv.srt'), cue('Första raden.'))
  write(join(target, first + '.en.srt'), cue('First line.'))
  write(join(target, second + '.sv.srt'), cue('Andra raden.'))
  write(join(target, 'index.json'), JSON.stringify([{ name: first, link: 'video000001', source: 'YouTube', category: 'Keep me' },
    { name: second, link: 'video000002', source: 'YouTube' }]))
  if (bundled) applyMigration(target, planMigration(target))
  return { temp, target, input }
}

test('fresh folder import previews without writing, preserves UTF-8/BOM/CRLF, then creates bundles', async t => {
  const { temp, input } = setup(t), target = join(temp, 'new-language')
  const name = 'Kanal || Ny || video000003', source = '\ufeff' + cue('Räksmörgås.').replaceAll('\n', '\r\n')
  write(join(input, name + '.sv.srt'), source); write(join(input, name + '.en.srt'), cue('Shrimp sandwich.'))
  const plan = await planSrtImport(target, { input })
  assert(!existsSync(target)); assert.equal(plan.summary.tracks, 2); assert.equal(plan.summary.storage, 'bundles')
  applySrtImport(plan)
  assert.equal(index(target)[0].link, 'video000003'); assert(index(target)[0].bundle)
  assert.equal(readSubtitleFiles(target)[name + '.sv.srt'], source)
  assert.equal(looseSubtitleNames(target).length, 0)
  assert(existsSync(join(input, name + '.sv.srt')), 'external originals remain')
  const again = await planSrtImport(target, { input })
  assert.deepEqual(again.summary.changedFiles, []); applySrtImport(again)
})

test('plain make-srt output imports with a media id and configured source language', async t => {
  const { temp, input } = setup(t), target = join(temp, 'new-language'), file = join(input, 'episode.srt')
  write(file, cue('Hola.'))
  const plan = await planSrtImport(target, { input: file, link: 'episode0001', title: 'Episode', channel: 'Podcast', lang: 'es', source: 'Podcast' })
  applySrtImport(plan)
  assert.equal(index(target)[0].source, 'Podcast')
  assert.equal(readSubtitleFiles(target)['Podcast || Episode || episode0001.es.srt'], cue('Hola.'))
})

test('folder index supplies other media providers and metadata without reusing foreign pack pointers', async t => {
  const { temp, input } = setup(t), target = join(temp, 'new-language')
  write(join(input, 'episode.es.srt'), cue('Hola.'))
  write(join(input, 'index.json'), JSON.stringify([{ name: 'episode', link: 'spotify-episode', source: 'Spotify', title: 'Keep title',
    bundle: 'packs/pack-999999.json', bundleRevision: 77, bundleKey: 'Foreign' }]))
  applySrtImport(await planSrtImport(target, { input }))
  const entry = index(target)[0]
  assert.equal(entry.source, 'Spotify'); assert.equal(entry.title, 'Keep title')
  assert.notEqual(entry.bundle, 'packs/pack-999999.json'); assert.equal(entry.bundleRevision, 1); assert(!entry.bundleKey)
})

test('a YouTube URL is stored as its video ID, while non-YouTube URLs need their provider', async t => {
  const { target, input } = setup(t), file = join(input, 'episode.srt')
  write(file, cue('From YouTube.'))
  applySrtImport(await planSrtImport(target, { input: file, link: 'https://www.youtube.com/watch?v=newVideo001&t=12' }))
  assert(index(target).find(e => e.link === 'newVideo001'))
  await assert.rejects(planSrtImport(target, { input: file, link: 'https://example.com/episode' }), /YouTube video ID or video URL/)
  await assert.rejects(planSrtImport(target, { input: file, link: true }), /--link needs a value/)
})

test('updates require an explicit mode; replacement preserves siblings, metadata and existing filename', async t => {
  const { target, input } = setup(t), before = snapshot(target), oldPack = index(target)[0].bundle
  const renamed = 'Other channel || Different title || video000001'
  write(join(input, renamed + '.sv.srt'), cue('Replacement.'))
  await assert.rejects(planSrtImport(target, { input }), /--merge or --replace/)
  assert.deepEqual(snapshot(target), before)
  const plan = await planSrtImport(target, { input, replace: true })
  assert.deepEqual(snapshot(target), before, 'preview never writes')
  applySrtImport(plan)
  const docs = readSubtitleFiles(target)
  assert.equal(docs[first + '.sv.srt'], cue('Replacement.')); assert.equal(docs[first + '.en.srt'], cue('First line.'))
  assert.equal(docs[second + '.sv.srt'], cue('Andra raden.'))
  assert.equal(index(target).length, 2); assert.equal(index(target)[0].name, first); assert.equal(index(target)[0].category, 'Keep me')
  assert.equal(index(target)[0].bundle, oldPack)
  assert(index(target).every(e => e.bundleRevision === 2), 'siblings receive the changed pack revision')
})

test('merge keeps old and new cues; a rerun produces no changed files', async t => {
  const { target, input } = setup(t)
  write(join(input, first + '.sv.srt'), cue('New cue.', '10'))
  applySrtImport(await planSrtImport(target, { input, merge: true }))
  const text = readSubtitleFiles(target)[first + '.sv.srt']
  assert.match(text, /Första raden/); assert.match(text, /New cue/)
  assert.deepEqual((await planSrtImport(target, { input, merge: true })).summary.changedFiles, [])
})

test('growing imports move only the edited media when a pack reaches its limit', async t => {
  const { target, input } = setup(t)
  const storage = JSON.parse(readFileSync(join(target, 'storage.json')))
  storage.maxBytes = storage.packs[0].bytes + 1
  write(join(target, 'storage.json'), JSON.stringify(storage, null, 2) + '\n')
  write(join(input, first + '.sv.srt'), cue('A'.repeat(3000)))
  const oldPack = index(target)[0].bundle
  applySrtImport(await planSrtImport(target, { input, replace: true }))
  assert.notEqual(index(target)[0].bundle, oldPack)
  assert.equal(index(target)[1].bundle, oldPack)
  assert.equal(readSubtitleFiles(target)[first + '.en.srt'], cue('First line.'))
  assert.equal(readSubtitleFiles(target)[second + '.sv.srt'], cue('Andra raden.'))
})

test('in-place import adopts manually indexed tracks and their sibling translation before removing loose originals', async t => {
  const { target } = setup(t), name = 'Kanal || Ny || video000003'
  write(join(target, name + '.sv.srt'), cue('Nytt.')); write(join(target, name + '.en.srt'), cue('New.'))
  write(join(target, 'index.json'), JSON.stringify([...index(target), { name, link: 'video000003', source: 'YouTube' }]))
  const plan = await planSrtImport(target, { input: join(target, name + '.sv.srt') })
  assert.equal(plan.summary.tracks, 2); assert(existsSync(join(target, name + '.sv.srt')))
  applySrtImport(plan)
  assert.equal(readSubtitleFiles(target)[name + '.en.srt'], cue('New.'))
  assert(index(target).find(e => e.link === 'video000003').bundle)
  assert.equal(looseSubtitleNames(target).length, 0)
  assert.equal((await planSrtImport(target)).summary.tracks, 0)
})

test('drop-ins in a new unindexed directory initialize bundled storage', async t => {
  const { temp } = setup(t), target = join(temp, 'dropped')
  write(join(target, first + '.sv.srt'), cue('New directory.'))
  applySrtImport(await planSrtImport(target))
  assert(existsSync(join(target, 'storage.json'))); assert(index(target)[0].bundle)
  assert.equal(looseSubtitleNames(target).length, 0)
})

test('an unindexed archive can be adopted without duplicating tracks or losing its translation', async t => {
  for (const replace of [false, true]) {
    const { target, input } = setup(t), name = 'Archive || Old || archive0001'
    // Add an archive before migration using the legacy reader/migration path.
    const { packDocuments, bundleText, jsonText } = await import('../../public/language/subtitle-bundles.js')
    const packed = packDocuments({ ...readSubtitleFiles(target), [name + '.sv.srt']: cue('Archived.'), [name + '.en.srt']: cue('Archived translation.') })
    for (const [path, files] of packed.packs) write(join(target, path), bundleText(files))
    write(join(target, 'storage.json'), jsonText(packed.storage))
    const records = index(target).map(e => ({ ...e, bundle: packed.assignments.get(e.name), bundleRevision: 1 }))
    write(join(target, 'index.json'), jsonText(records))
    const incoming = cue(replace ? 'Replaced archive.' : 'Archived.')
    write(join(input, name + '.sv.srt'), incoming)
    applySrtImport(await planSrtImport(target, { input, replace }))
    assert.equal(Object.keys(readSubtitleFiles(target)).length, 5)
    assert.equal(readSubtitleFiles(target)[name + '.sv.srt'], incoming)
    assert.equal(readSubtitleFiles(target)[name + '.en.srt'], cue('Archived translation.'))
    assert(index(target).find(e => e.link === 'archive0001').bundle)
  }
})

test('Unicode bundle keys are retained when importing a translation', async t => {
  const { temp, input } = setup(t), target = join(temp, 'unicode'), name = 'Kanal || Ra\u0308ksmo\u0308rga\u030as || unicode0001'
  write(join(target, name + '.sv.srt'), cue('Räksmörgås.'))
  write(join(target, 'index.json'), JSON.stringify([{ name: name.normalize('NFC'), link: 'unicode0001', source: 'YouTube' }]))
  applyMigration(target, planMigration(target))
  write(join(input, name.normalize('NFC') + '.en.srt'), cue('Translation.'))
  applySrtImport(await planSrtImport(target, { input }))
  assert.equal(index(target)[0].bundleKey, name)
  assert.equal(readSubtitleFiles(target)[name + '.en.srt'], cue('Translation.'))
})

test('legacy directories retain their format and index metadata', async t => {
  const { target, input } = setup(t, { bundled: false }), name = 'Kanal || Ny || video000003'
  write(join(input, name + '.sv.srt'), cue('New legacy media.'))
  applySrtImport(await planSrtImport(target, { input }))
  assert(!existsSync(join(target, 'storage.json'))); assert(existsSync(join(target, name + '.sv.srt')))
  assert.equal(index(target)[0].category, 'Keep me')
})

test('conflicting aliases for one media or one indexed name cannot silently overwrite each other', async t => {
  const { target, input } = setup(t), before = snapshot(target)
  write(join(input, 'One || Title || newVideo001.sv.srt'), cue('One.'))
  write(join(input, 'Two || Title || newVideo001.sv.srt'), cue('Two.'))
  await assert.rejects(planSrtImport(target, { input }), /same track/)
  assert.deepEqual(snapshot(target), before)
  write(join(input, 'index.json'), JSON.stringify([{ name: 'One || Title || newVideo001', link: 'a' }, { name: 'One || Title || newVideo001', link: 'b' }]))
  await assert.rejects(planSrtImport(target, { input }), /Ambiguous index/)
  assert.deepEqual(snapshot(target), before)
})

test('invalid batches, encodings, ambiguous names, links and symlinks leave all data untouched', async t => {
  const { target, input } = setup(t), before = snapshot(target)
  const bad = join(input, 'bad.sv.srt')
  for (const data of [Buffer.from([0xff, 0xfe, 0x31]), 'not an SRT']) {
    write(bad, data); await assert.rejects(planSrtImport(target, { input }), /UTF-8|No subtitle cues/)
    assert.deepEqual(snapshot(target), before)
  }
  rmSync(bad)
  write(join(input, 'episode.sv.srt'), cue('Valid.'))
  await assert.rejects(planSrtImport(target, { input }), /No media link/)
  await assert.rejects(planSrtImport(target, { input, merge: true, replace: true }), /either/)
  write(join(input, 'second.sv.srt'), cue('Also valid.'))
  await assert.rejects(planSrtImport(target, { input, link: 'one' }), /one media/)
  write(join(input, 'index.json'), '{broken')
  await assert.rejects(planSrtImport(target, { input }))
  rmSync(join(input, 'index.json')); rmSync(join(input, 'episode.sv.srt')); rmSync(join(input, 'second.sv.srt'))
  symlinkSync(join(target, 'storage.json'), bad)
  await assert.rejects(planSrtImport(target, { input }), /symlinks/)
  assert.deepEqual(snapshot(target), before)
})

test('a changed input, new input index or changed target after preview aborts before writing', async t => {
  const { target, input } = setup(t), name = 'Kanal || Ny || video000003', file = join(input, name + '.sv.srt')
  write(file, cue('Initial.'))
  let plan = await planSrtImport(target, { input }), before = snapshot(target)
  write(file, cue('Changed.'))
  assert.throws(() => applySrtImport(plan), /input changed/); assert.deepEqual(snapshot(target), before)
  plan = await planSrtImport(target, { input })
  write(join(input, 'index.json'), '[]')
  assert.throws(() => applySrtImport(plan), /input changed/); assert.deepEqual(snapshot(target), before)
  plan = await planSrtImport(target, { input })
  write(join(target, index(target)[0].bundle), readFileSync(join(target, index(target)[0].bundle), 'utf8') + ' ')
  before = snapshot(target)
  assert.throws(() => applySrtImport(plan), /storage changed/); assert.deepEqual(snapshot(target), before)
})

test('CLI honors config, previews an import and applies it without network calls', t => {
  const { temp, target, input } = setup(t), file = join(input, 'episode.srt')
  write(file, cue('CLI subtitle.'))
  const config = join(temp, 'config.json'); write(config, JSON.stringify({ srtsDir: target, lang: 'sv' }))
  const cli = fileURLToPath(new URL('./lang-manage.js', import.meta.url))
  const args = [cli, 'import', '--config', config, '--input', file, '--link', 'cli00000001', '--channel', 'CLI']
  const before = snapshot(target)
  assert.match(execFileSync(process.execPath, args, { encoding: 'utf8' }), /Dry run/)
  assert.deepEqual(snapshot(target), before)
  assert.match(execFileSync(process.execPath, [...args, '--apply'], { encoding: 'utf8' }), /"applied": true/)
  assert(index(target).find(e => e.link === 'cli00000001').bundle)
  const failed = spawnSync(process.execPath, [cli, 'import', '--srtsDir', target, '--input', file], { encoding: 'utf8' })
  assert.equal(failed.status, 1); assert.match(failed.stderr, /No media link/)
})
