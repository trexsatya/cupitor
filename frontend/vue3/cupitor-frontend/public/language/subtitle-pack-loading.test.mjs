import test from 'node:test'
import assert from 'node:assert/strict'
import { createBundleLoader, bundleText } from './subtitle-bundles.js'
import { loadSubtitlePacks } from './subtitle-pack-loading.js'

function fixture({packs = 6, perPack = 40, maxBytes = 1000} = {}) {
  const entries = [], files = new Map(), requests = []
  for (let row = 0; row < perPack; row++) for (let pack = 0; pack < packs; pack++) {
    const bundle = `packs/pack-${String(pack + 1).padStart(6, '0')}.json`
    if (!files.has(bundle)) files.set(bundle, {})
    const name = `clip-${pack}-${row}`
    entries.push({name, link:name, bundle, bundleRevision:1})
    files.get(bundle)[name + '.sv.srt'] = 'å'.repeat(200)
    files.get(bundle)[name + '.en.srt'] = 'English'.repeat(30)
  }
  const loader = createBundleLoader(async url => {
    requests.push(url)
    return bundleText(files.get(new URL(url).pathname.slice(1)))
  }, {maxBytes})
  return {entries, files, requests, loader}
}
const options = {baseUrl:() => 'https://library', code:'sv', loadLoose:() => {throw new Error('Unexpected loose entry')}}

test('interleaved entries previously refetch evicted packs; bulk import reads each pack once and batches all tracks', async () => {
  const old = fixture()
  for (const entry of old.entries) {
    await old.loader.track(entry, 'sv', 'https://library')
    await old.loader.track(entry, 'en', 'https://library')
  }
  assert.equal(old.requests.length, old.entries.length * 2, 'an oversized pack is evicted between even its two language reads')
  const f = fixture(), batches = [], progress = []
  await loadSubtitlePacks(f.entries, {...options, loader:f.loader,
    commitBatch:async rows => {batches.push(rows); await new Promise(resolve => setImmediate(resolve))},
    onProgress:(done,total) => progress.push([done,total]),
  })
  assert.equal(f.requests.length, 6)
  assert.equal(batches.length, 12)
  assert.equal(batches.flat().length, f.entries.length)
  assert.deepEqual(new Set(batches.flat().map(row => row.entry.link)), new Set(f.entries.map(entry => entry.link)))
  assert.ok(batches.every(rows => rows.length <= 32 && rows.every(row => row.sv === 'å'.repeat(200) && row.en === 'English'.repeat(30))))
  assert.deepEqual(progress.at(-1), [240,240])
})

test('batches obey the byte budget and preserve an oversized single transcript intact', async () => {
  const f = fixture({packs:1, perPack:3}), sizes = []
  f.files.values().next().value['clip-0-1.sv.srt'] = 'x'.repeat(2500)
  await loadSubtitlePacks(f.entries, {...options, loader:f.loader, maxBytes:1000,
    commitBatch:async rows => sizes.push(rows.map(row => 2 * (row.sv.length + row.en.length))),
  })
  assert.deepEqual(sizes.map(rows => rows.length), [1,1,1])
  assert.ok(sizes[1][0] > 1000)
  assert.equal(f.requests.length, 1)
})

test('source URLs and pack revisions remain separate; bundle keys, missing English and loose entries survive', async () => {
  const entries = [
    {link:'own', name:'display name', bundleKey:'original', bundle:'packs/pack-000001.json', bundleRevision:1, base:'https://own'},
    {link:'shared', name:'original', bundle:'packs/pack-000001.json', bundleRevision:1, base:'https://shared'},
    {link:'revised', name:'original', bundle:'packs/pack-000001.json', bundleRevision:2, base:'https://own'},
    {link:'loose'},
  ]
  const urls = [], result = [], loose = []
  const loader = createBundleLoader(async url => {urls.push(url); return bundleText({'original.es.srt':url})})
  await loadSubtitlePacks(entries, {...options, code:'es', baseUrl:entry => entry.base || 'https://own', loader,
    commitBatch:async rows => result.push(...rows), loadLoose:async entry => loose.push(entry.link),
  })
  assert.equal(new Set(urls).size, 3)
  assert.equal(result.length, 3)
  assert.ok(result.every(row => row.en === null && row.sv.includes(row.entry.base)))
  assert.deepEqual(loose, ['loose'])
})

test('a missing source track fails that entry only; missing English is optional and empty tracks are retained', async () => {
  const f = fixture({packs:1,perPack:3}), rows = [], failed = []
  const files = f.files.values().next().value
  delete files['clip-0-0.sv.srt']; delete files['clip-0-1.en.srt']; files['clip-0-2.sv.srt'] = ''
  await loadSubtitlePacks(f.entries, {...options, loader:f.loader, commitBatch:async batch => rows.push(...batch),
    onFailure:(entry,error) => failed.push([entry.link,error.kind]),
  })
  assert.deepEqual(failed, [['clip-0-0','notfound']])
  assert.equal(rows[0].en, null); assert.equal(rows[1].sv, '')
})

test('failed packs are attempted once per round, report every affected entry and can retry', async () => {
  const f = fixture({packs:1,perPack:40}), failed = [], rows = []
  let reads = 0
  const loader = createBundleLoader(async () => {if (!reads++) throw new Error('network'); return bundleText(f.files.values().next().value)})
  const config = {...options,loader,commitBatch:async batch => rows.push(...batch),onFailure:entry => failed.push(entry)}
  await loadSubtitlePacks(f.entries, config)
  assert.equal(reads, 1); assert.equal(failed.length, 40); assert.equal(rows.length, 0)
  await loadSubtitlePacks(failed, config)
  assert.equal(reads, 2); assert.equal(rows.length, 40)
})

test('a persistence failure stops all lanes before unacknowledged raw text can grow without bound', async () => {
  const f = fixture({packs:10,perPack:40}), staged = [], progress = []
  const error = new Error('storage')
  await assert.rejects(loadSubtitlePacks(f.entries, {...options,loader:f.loader,
    commitBatch:async rows => {staged.push(rows); throw error}, onProgress:done => progress.push(done),
  }),error)
  assert.equal(f.requests.length,4,'no queued pack starts after a failed commit')
  assert.ok(staged.length <= 4 && staged.every(rows => rows.length === 32))
  assert.deepEqual(progress,[])
})

test('a source change during download rejects before committing the old pack', async () => {
  const f = fixture({packs:1,perPack:3})
  let current = true, commits = 0
  const error = Object.assign(new Error('source changed'), {code:'stale-data-source'})
  await assert.rejects(loadSubtitlePacks(f.entries, {...options,
    loader:{bundle:async () => {current = false; return f.files.values().next().value}},
    assertCurrent:() => {if (!current) throw error}, commitBatch:async () => {commits++},
  }), error)
  assert.equal(commits, 0)
})

test('at most four packs download concurrently while each batch is acknowledged before the next', async () => {
  const f = fixture({packs:10,perPack:40}), inflight = new Set()
  let active = 0, peak = 0
  const loader = {bundle:async entry => {
    peak = Math.max(peak, ++active)
    await new Promise(resolve => setImmediate(resolve)); active--
    return f.files.get(entry.bundle)
  }}
  await loadSubtitlePacks(f.entries, {...options,loader,commitBatch:async rows => {
    const pack = rows[0].entry.bundle
    assert.equal(inflight.has(pack), false)
    inflight.add(pack); await new Promise(resolve => setImmediate(resolve)); inflight.delete(pack)
  }})
  assert.equal(peak, 4)
})
