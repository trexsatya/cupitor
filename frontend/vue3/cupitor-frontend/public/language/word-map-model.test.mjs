import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyMap, readMap, removeNode, edgeEnds } from './word-map-model.js'
const sample = () => ({
  ...emptyMap('Relations'),
  nodes: [
    { id: 'a', word: 'Rät', x: 100, y: 100 },
    { id: 'b', word: 'Rätt', x: 500, y: 100 },
  ],
  edges: [
    {
      id: 'e',
      from: 'a',
      to: 'b',
      relation: 'not related',
      arrows: 'both',
      dashed: true,
      marker: '×',
      uncertain: true,
      note: 'Check',
      source: 'Reference',
    },
  ],
})
test('portable map retains positions, meaning, appearance and evidence', () => {
  const map = readMap(sample())
  assert.deepEqual(readMap(JSON.stringify(map)), map)
  assert.equal(map.edges[0].marker, '×')
  assert.equal(map.edges[0].source, 'Reference')
})
test('reject invalid references, duplicate ids and unsupported formats before import', () => {
  for (const change of [
    (m) => (m.version = 2),
    (m) => m.nodes.push(m.nodes[0]),
    (m) => (m.edges[0].to = 'missing'),
    (m) => m.edges.push(m.edges[0]),
    (m) => (m.nodes[0].x = NaN),
    (m) => (m.edges[0].to = 'a'),
  ]) {
    const m = sample()
    change(m)
    assert.throws(() => readMap(m))
  }
})
test('deleting a word removes its connections', () => {
  const m = sample()
  removeNode(m, 'a')
  assert.equal(m.nodes.length, 1)
  assert.equal(m.edges.length, 0)
})
test('connection endpoints stop at word boundaries in both directions', () => {
  const [a, b] = sample().nodes
  const [p, q] = edgeEnds(a, b)
  assert.equal(p.x, 155)
  assert.equal(q.x, 445)
  assert.equal(p.y, 100)
  assert.deepEqual(edgeEnds(b, a), [q, p])
})
