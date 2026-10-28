import test from 'node:test'
import assert from 'node:assert/strict'
import { bundleText, jsonText, packDocuments, createBundleLoader, createSubtitleBundleAdapter } from './subtitle-bundles.js'

const dir = 'db/language/swedish/srts'
const indexEntry = (name, link = name) => ({ name, link, source: 'YouTube' })
function repository(documents, options) {
  const packed = packDocuments(documents, options)
  const names = [...packed.assignments.keys()]
  const index = names.map(name => ({ ...indexEntry(name), bundle: packed.assignments.get(name), bundleRevision: 1 }))
  const data = new Map([[dir + '/storage.json', jsonText(packed.storage)], [dir + '/index.json', jsonText(index)]])
  packed.packs.forEach((files, path) => data.set(dir + '/' + path, bundleText(files)))
  const read = async path => data.has(path) ? { content: data.get(path), sha: data.get(path) } : null
  const apply = async operations => {
    const planned = await createSubtitleBundleAdapter().prepare({ files: operations, read })
    for (const file of planned.files) {
      if (file.delete) data.delete(file.path)
      else data.set(file.path, await file.getContent(data.get(file.path)))
    }
    return planned
  }
  return { data, index, read, apply }
}
const edit = (name, transform) => ({ path: `${dir}/${name}.sv.srt`, getContent: transform })
const indexWrite = transform => ({ path: dir + '/index.json', getContent: text => jsonText(transform(JSON.parse(text))) })

test('200-track cap keeps media pairs together and round-trips every byte', () => {
  const documents = Object.fromEntries(Array.from({ length: 301 }, (_, i) => [`name${i}.sv.srt`, `1\r\n00:00:00,000 --> 00:00:01,000\r\nåäö ${i}\r\n`]))
  documents['name199.en.srt'] = 'English\n'
  const p = packDocuments(documents)
  assert.equal(p.packs.size, 2)
  assert.deepEqual(Object.assign({}, ...p.packs.values()), documents)
  assert([...p.packs.values()].every(files => Object.keys(files).length <= 200))
})

test('byte limit uses UTF-8 bytes, with oversized single media preserved alone', () => {
  const p = packDocuments({ 'a.sv.srt': 'å'.repeat(1000), 'a.en.srt': 'English', 'b.sv.srt': 'small' }, { maxBytes: 1000 })
  assert.equal(p.packs.size, 2)
  assert.equal(p.packs.get(p.assignments.get('a'))['a.sv.srt'], 'å'.repeat(1000))
})

test('simultaneous track loads share one request; languages and owners stay separate', async () => {
  const urls = []
  const loader = createBundleLoader(async url => { urls.push(url); return bundleText({ 'a.sv.srt': url, 'a.en.srt': 'English' }) })
  const e = { name: 'a', bundle: 'packs/pack-000001.json', bundleRevision: 1 }
  const result = await Promise.all([loader.track(e, 'sv', 'https://self'), loader.track(e, 'en', 'https://self')])
  assert.equal(urls.length, 1)
  assert.equal(result[1], 'English')
  await loader.track(e, 'sv', 'https://other')
  await loader.track({ ...e, bundleRevision: 2 }, 'sv', 'https://self')
  assert.equal(urls.length, 3)
})

test('failed or malformed bundles retry without caching a rejection', async () => {
  let calls = 0
  const loader = createBundleLoader(async () => { if (!calls++) throw Error('network'); return bundleText({ 'a.sv.srt': 'ok' }) })
  const e = { name: 'a', bundle: 'packs/pack-000001.json' }
  await assert.rejects(loader.track(e, 'sv', 'https://self'))
  assert.equal(await loader.track(e, 'sv', 'https://self'), 'ok')
  await assert.rejects(loader.track({ ...e, bundle: '../secret' }, 'sv', 'https://self'))
})

test('several edits in one pack preserve unchecked siblings and bump all affected cache revisions', async () => {
  const r = repository({ 'a.sv.srt': 'A', 'a.en.srt': 'English A', 'b.sv.srt': 'B', 'c.sv.srt': 'C' })
  const planned = await r.apply([edit('a', text => text + ' edited'), edit('b', text => text + ' edited')])
  const packs = planned.files.filter(f => /pack-/.test(f.path))
  assert.equal(packs.length, 1)
  const files = JSON.parse(r.data.get(packs[0].path)).files
  assert.equal(files['a.en.srt'], 'English A')
  assert.equal(files['c.sv.srt'], 'C')
  assert.equal(files['a.sv.srt'], 'A edited')
  assert(JSON.parse(r.data.get(dir + '/index.json')).every(e => e.bundleRevision === 2))
})

test('no-op transformations create no physical changes', async () => {
  const r = repository({ 'a.sv.srt': 'A', 'b.sv.srt': 'B' })
  assert.deepEqual((await createSubtitleBundleAdapter().prepare({ files: [edit('a', text => text)], read: r.read })).files, [])
})

test('new records fill the tail and allocate stable new packs without repacking existing records', async () => {
  const r = repository({ 'a.sv.srt': 'A', 'b.sv.srt': 'B' }, { maxFiles: 2 })
  const additions = ['c', 'd', 'e']
  await r.apply([...additions.map(name => edit(name, () => name)), indexWrite(index => [...index, ...additions.map(name => indexEntry(name))])])
  const index = JSON.parse(r.data.get(dir + '/index.json'))
  assert.equal(index.find(e => e.name === 'a').bundle, r.index[0].bundle)
  assert.equal(index.find(e => e.name === 'c').bundle, index.find(e => e.name === 'd').bundle)
  assert.notEqual(index.find(e => e.name === 'd').bundle, index.find(e => e.name === 'e').bundle)
  assert.equal(JSON.parse(r.data.get(dir + '/storage.json')).packs.length, 3)
})

test('growing media moves only its own tracks when the byte limit is exceeded', async () => {
  const r = repository({ 'a.sv.srt': 'A', 'b.sv.srt': 'B' }, { maxBytes: 150 })
  await r.apply([edit('a', () => 'x'.repeat(500))])
  const index = JSON.parse(r.data.get(dir + '/index.json'))
  assert.notEqual(index[0].bundle, index[1].bundle)
  assert.equal(index[1].bundle, r.index[1].bundle)
})

test('index-only deletion preserves siblings and archived unindexed tracks', async () => {
  const r = repository({ 'a.sv.srt': 'A', 'b.sv.srt': 'B', 'archive.sv.srt': 'Archive' })
  r.data.set(dir + '/index.json', jsonText(r.index.filter(e => e.name !== 'archive')))
  await r.apply([indexWrite(index => index.filter(e => e.name !== 'a'))])
  const files = JSON.parse(r.data.get(dir + '/' + r.index[0].bundle)).files
  assert.deepEqual(files, { 'b.sv.srt': 'B', 'archive.sv.srt': 'Archive' })
})

test('replanning on a newer head preserves a concurrent sibling edit', async () => {
  const r = repository({ 'a.sv.srt': 'A', 'b.sv.srt': 'B' })
  const request = [edit('a', text => text + ' local')]
  await createSubtitleBundleAdapter().prepare({ files: request, read: r.read })
  await r.apply([edit('b', text => text + ' remote')])
  await r.apply(request)
  const files = JSON.parse(r.data.get(dir + '/' + r.index[0].bundle)).files
  assert.equal(files['a.sv.srt'], 'A local')
  assert.equal(files['b.sv.srt'], 'B remote')
})

test('malformed/missing bundles and stale conditional writes abort without publishing an empty file', async () => {
  const r = repository({ 'a.sv.srt': 'A' })
  await assert.rejects(r.apply([{ ...edit('a', () => 'changed'), expectedSha: 'stale' }]), /409/)
  r.data.delete(dir + '/' + r.index[0].bundle)
  await assert.rejects(r.apply([edit('a', () => 'changed')]), /Missing subtitle bundle/)
})

test('legacy repositories keep their original physical writes', async () => {
  const operations = [edit('a', () => 'A')]
  const plan = await createSubtitleBundleAdapter().prepare({ files: operations, read: async () => null })
  assert.deepEqual(plan.files, operations)
})

test('deleting the final track removes its index entry and empty pack; future captures still use bundles', async () => {
  const r = repository({ 'a.sv.srt': 'A' })
  await r.apply([{ path: dir + '/a.sv.srt', delete: true }])
  assert.deepEqual(JSON.parse(r.data.get(dir + '/index.json')), [])
  assert.equal(JSON.parse(r.data.get(dir + '/storage.json')).packs.length, 0)
  await r.apply([edit('new', () => 'New'), indexWrite(index => [...index, indexEntry('new')])])
  assert(JSON.parse(r.data.get(dir + '/index.json'))[0].bundle)
})

test('15,000 media with two SRTs each fit into 150 bundles at the file-count target', () => {
  const documents = Object.create(null)
  for (let i = 0; i < 15000; i++) {
    documents[`video${i}.sv.srt`] = 'Original cue ' + i
    documents[`video${i}.en.srt`] = 'Translated cue ' + i
  }
  const p = packDocuments(documents)
  assert.equal(p.packs.size, 150)
  assert.equal([...p.packs.values()].reduce((sum, files) => sum + Object.keys(files).length, 0), 30000)
})

test('new index entry reuses previously orphaned bundled tracks instead of duplicating them', async () => {
  const r = repository({ 'orphan.sv.srt': 'Old Swedish', 'orphan.en.srt': 'Old English', 'neighbor.sv.srt': 'Neighbor' })
  const indexPath = dir + '/index.json'
  const original = JSON.parse(r.data.get(indexPath))
  r.data.set(indexPath, jsonText(original.filter(e => e.name !== 'orphan')))
  const oldPack = original.find(e => e.name === 'orphan').bundle
  await r.apply([
    edit('orphan', text => text + ' + captured'),
    indexWrite(index => [...index, indexEntry('orphan', 'video-orphan')]),
  ])
  const index = JSON.parse(r.data.get(indexPath))
  assert.equal(index.find(e => e.link === 'video-orphan').bundle, oldPack)
  const documents = [...r.data.entries()]
    .filter(([path]) => /packs\\/pack-/.test(path))
    .map(([, text]) => JSON.parse(text).files)
  assert.equal(documents.filter(pack => 'orphan.sv.srt' in pack).length, 1)
  assert.equal(documents.filter(pack => 'orphan.en.srt' in pack).length, 1)
  const saved = Object.assign({}, ...documents)
  assert.equal(saved['orphan.sv.srt'], 'Old Swedish + captured')
  assert.equal(saved['orphan.en.srt'], 'Old English')
})
