import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findWordMaps, renderWordMapResultsHtml, readSearchMaps, wordMapStorageKey } from './word-map-search.js'
const maps = [
  { id: 'conflict', name: 'Konflikt', nodes: [
    { id: 'a', word: 'Skälla ut', lookup: 'banna', note: '' },
    { id: 'b', word: 'Gräl', lookup: '', note: 'Bråka med någon' },
    { id: 'c', word: 'Håna', lookup: '', note: '' },
  ] },
  { id: 'other', name: 'Bråka & bråk', nodes: [] },
]
test('matches map names, words, lookup terms and notes, once per map', () => {
  const snapshot = JSON.stringify(maps)
  const hits = findWordMaps(maps, 'skälla\\s+ut|bråka')
  assert.equal(hits.length, 2)
  assert.deepEqual(hits.find(hit => hit.map.id === 'conflict').nodes.map(node => node.id), ['a', 'b'])
  assert.equal(hits.find(hit => hit.map.id === 'other').nameMatched, true)
  assert.equal(findWordMaps(maps, 'BANNA')[0].nodes[0].id, 'a')
  assert.equal(findWordMaps(maps, 'skälla ut')[0].nodes[0].id, 'a')
  assert.equal(JSON.stringify(maps), snapshot)
  for (const query of ['', '  ', '[', 'saknas']) assert.deepEqual(findWordMaps(maps, query), [])
  assert.equal(findWordMaps(maps, '.', { limit: 1 }).length, 1)
})
test('result markup highlights safely, shows map identity and retains folded state', () => {
  const unsafe = [{ id: '"<id>', name: '<script>Bråk</script>', nodes: [{ id: 'n', word: '<img>Bråk', note: '', lookup: '' }] }]
  const html = renderWordMapResultsHtml(findWordMaps(unsafe, 'bråk'), 'bråk', { collapsed: true })
  assert.ok(html.includes('lib-collapsed'))
  assert.ok(html.includes('aria-expanded="false"'))
  assert.ok(html.includes("<span class='highlight'>Bråk</span>"))
  assert.ok(html.includes('data-map-id="&quot;&lt;id&gt;"'))
  assert.ok(!html.includes('<script>') && !html.includes('<img>'))
  assert.ok(renderWordMapResultsHtml([], 'x').includes('No word maps match'))
})
test('storage reads are scoped to account and language and never overwrite corrupt data', () => {
  const data = new Map()
  globalThis.localStorage = { getItem: key => data.get(key) ?? null }
  assert.equal(wordMapStorageKey('?lang=swedish'), 'cupitor:wordMaps:swedish')
  data.set('cupitor:account', JSON.stringify({ login: 'alice', repo: 'cupitor-data', branch: 'main' }))
  assert.equal(wordMapStorageKey('?lang=spanish'), 'cupitor:wordMaps:spanish@alice')
  assert.deepEqual(readSearchMaps(wordMapStorageKey('?lang=swedish')), [])
  data.set('bad', '{invalid')
  assert.throws(() => readSearchMaps('bad'))
  assert.equal(data.get('bad'), '{invalid')
})
