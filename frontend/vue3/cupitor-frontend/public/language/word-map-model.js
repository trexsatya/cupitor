// Portable, data-only format: never evaluate imported map scripts.
export const RELATIONS = [
  'association',
  'made from',
  'means',
  'opposite of',
  'related origin',
  'not related',
]
export const newId = () =>
  globalThis.crypto?.randomUUID?.() ||
  'wm-' + Date.now().toString(36) + Math.random().toString(36).slice(2)
export function emptyMap(name = 'Untitled map') {
  return { version: 1, id: newId(), name, nodes: [], edges: [] }
}
export function readMap(value) {
  const data = typeof value === 'string' ? JSON.parse(value) : value
  if (
    !data ||
    data.version !== 1 ||
    typeof data.name !== 'string' ||
    !data.name.trim() ||
    !Array.isArray(data.nodes) ||
    !Array.isArray(data.edges)
  )
    throw Error('Expected a version 1 word map with a name, nodes and edges.')
  if (data.nodes.length > 500 || data.edges.length > 2000)
    throw Error('A map can contain up to 500 words and 2,000 connections.')
  const ids = new Set(),
    edgeIds = new Set()
  const str = (v) => (typeof v === 'string' ? v.slice(0, 10000) : '')
  const color = (v) => (/^#[\da-f]{6}$/i.test(v) ? v : '#dc3636')
  const nodes = data.nodes.map((n) => {
    if (
      !n ||
      typeof n.id !== 'string' ||
      !n.id ||
      ids.has(n.id) ||
      typeof n.word !== 'string' ||
      !n.word.trim() ||
      n.word.length > 100 ||
      !Number.isFinite(n.x) ||
      !Number.isFinite(n.y)
    )
      throw Error(
        'Each word needs a unique id, text (up to 100 characters), and numeric x/y positions.'
      )
    ids.add(n.id)
    return {
      id: n.id,
      word: n.word,
      x: Math.max(80, Math.min(2320, n.x)),
      y: Math.max(40, Math.min(1560, n.y)),
      lookup: str(n.lookup),
      note: str(n.note),
      color: color(n.color),
      shape: n.shape === 'ellipse' ? 'ellipse' : 'rectangle',
    }
  })
  const edges = data.edges.map((e) => {
    if (
      !e ||
      typeof e.id !== 'string' ||
      !e.id ||
      edgeIds.has(e.id) ||
      !ids.has(e.from) ||
      !ids.has(e.to) ||
      e.from === e.to
    )
      throw Error('Each connection needs a unique id and two different existing word ids.')
    edgeIds.add(e.id)
    return {
      id: e.id,
      from: e.from,
      to: e.to,
      relation: str(e.relation) || 'association',
      label: str(e.label),
      note: str(e.note),
      source: str(e.source),
      uncertain: !!e.uncertain,
      dashed: !!e.dashed,
      marker: e.marker === '×' ? '×' : '',
      arrows: ['none', 'start', 'end', 'both'].includes(e.arrows) ? e.arrows : 'none',
    }
  })
  return { version: 1, id: str(data.id) || newId(), name: data.name.slice(0, 200), nodes, edges }
}
export function removeNode(map, id) {
  map.nodes = map.nodes.filter((n) => n.id !== id)
  map.edges = map.edges.filter((e) => e.from !== id && e.to !== id)
}
export function edgeEnds(a, b) {
  const boundary = (n, dx, dy) => {
    const w = Math.max(110, Math.min(380, n.word.length * 12 + 30)) / 2,
      h = 27
    const t =
      n.shape === 'ellipse'
        ? 1 / Math.sqrt((dx * dx) / (w * w) + (dy * dy) / (h * h))
        : Math.min(w / Math.max(Math.abs(dx), 0.001), h / Math.max(Math.abs(dy), 0.001))
    return { x: n.x + dx * t, y: n.y + dy * t }
  }
  const dx = b.x - a.x,
    dy = b.y - a.y
  if (!dx && !dy) return [a, b]
  return [boundary(a, dx, dy), boundary(b, -dx, -dy)]
}
