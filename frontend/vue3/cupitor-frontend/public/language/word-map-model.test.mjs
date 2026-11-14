import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyMap, readMap, removeNode, edgeEnds, nodeHeight, nodeWidth, nodeTextLines } from './word-map-model.js'
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

test('node colours keep legacy backgrounds and round-trip both hex values', () => {
  const legacy = readMap(sample())
  assert.equal(legacy.nodes[0].color, '#dc3636')
  assert.equal(legacy.nodes[0].textColor, '#ffffff')
  const data = sample()
  data.nodes[0].color = '  #AbC  '
  data.nodes[0].textColor = '123456'
  data.nodes[1].textColor = 'red; background:url(x)'
  const map = readMap(data)
  assert.equal(map.nodes[0].color, '#aabbcc')
  assert.equal(map.nodes[0].textColor, '#123456')
  assert.equal(map.nodes[1].textColor, '#ffffff')
  assert.deepEqual(readMap(JSON.stringify(map)), map)
})

test('angled node shapes survive import/export and unknown shapes fall back', () => {
  const data = sample()
  data.nodes[0].shape = 'hexagon'
  data.nodes[1].shape = 'parallelogram'
  const map = readMap(data)
  assert.equal(map.nodes[0].shape, 'hexagon')
  assert.equal(map.nodes[1].shape, 'parallelogram')
  assert.deepEqual(readMap(JSON.stringify(map)), map)
  data.nodes[0].shape = 'unknown'
  assert.equal(readMap(data).nodes[0].shape, 'rectangle')
})
test('multiline labels round-trip and connection endpoints use their height', () => {
  const data = sample()
  data.nodes[0].shape = 'text'
  data.nodes[0].word = 'One\n\nTwo'
  data.nodes[1].x = data.nodes[0].x
  data.nodes[1].y = 300
  const map = readMap(data)
  const [a, b] = map.nodes
  assert.equal(a.shape, 'text')
  assert.equal(a.textColor, '#263343')
  assert.equal(nodeWidth(a), 66)
  assert.equal(nodeHeight(a), 84)
  assert.deepEqual(nodeTextLines(a.word), ['One', '', 'Two'])
  assert.equal(edgeEnds(a, b)[0].y, a.y + 42)
  assert.deepEqual(readMap(JSON.stringify(map)), map)
})
test('arrows touch the triangular tips and slanted sides, not bounding boxes', () => {
  const a = { id: 'a', word: 'Rät', x: 100, y: 100, shape: 'hexagon' }
  const b = { id: 'b', word: 'Rätt', x: 500, y: 100, shape: 'rectangle' }
  assert.equal(edgeEnds(a, b)[0].x, 177)
  a.shape = 'parallelogram'
  assert.equal(edgeEnds(a, b)[0].x, 166)
  b.x = 400
  b.y = 180
  for (const shape of ['hexagon', 'parallelogram']) {
    a.shape = shape
    const [p] = edgeEnds(a, b)
    const t =
      shape === 'hexagon'
        ? 77 / (300 + (22 / 27) * 80)
        : 66 / (300 + (22 / 54) * 80)
    assert.ok(Math.abs(p.x - (100 + 300 * t)) < 1e-8)
    assert.ok(Math.abs(p.y - (100 + 80 * t)) < 1e-8)
    const reversed = edgeEnds(b, a)
    assert.deepEqual(reversed[1], p)
  }
})


test('nested folder paths normalize and survive portable maps without changing legacy maps', () => {
  const legacy = readMap(sample())
  assert.equal(Object.hasOwn(legacy, 'folder'), false)
  const nested = readMap({...sample(), folder: ' Swedish / Feelings / Conflict '})
  assert.equal(nested.folder, 'Swedish/Feelings/Conflict')
  assert.deepEqual(readMap(JSON.stringify(nested)), nested)
  for (const folder of ['a//b', '../a', 'a/..', 'a\\b', 42])
    assert.throws(() => readMap({...sample(), folder}), /folder path/)
})
