import { folderPath } from './playlist-folders.js'
// Portable, data-only format: never evaluate imported map scripts.
export const RELATIONS = [
  'association',
  'made from',
  'means',
  'opposite of',
  'related origin',
  'not related',
]
export const LINE_STYLES = ['solid', 'dashed', 'dotted', 'dash-dot']
export const MAX_IMAGES = 12
// Only plain http(s) links are accepted: no javascript:, data: or file: URLs.
export function imageLink(v) {
  if (typeof v !== 'string') return ''
  const t = v.trim()
  if (!t || t.length > 2000) return ''
  try {
    const u = new URL(t)
    return u.protocol === 'http:' || u.protocol === 'https:' ? t : ''
  } catch (_) {
    return ''
  }
}
// Turns pasted text (one link per line, or space separated) into a clean list.
export function parseImageLinks(text) {
  const links = []
  let rejected = 0
  for (const token of String(text || '')
    .split(/\s+/)
    .filter(Boolean)) {
    const link = imageLink(token)
    if (!link) rejected++
    else if (!links.includes(link)) links.push(link)
  }
  return {
    links: links.slice(0, MAX_IMAGES),
    rejected,
    truncated: Math.max(0, links.length - MAX_IMAGES),
  }
}
export const NODE_SHAPES = [
  ['text', 'Text only'],
  ['rectangle', 'Rounded rectangle'],
  ['ellipse', 'Ellipse'],
  ['hexagon', 'Hexagon (triangular ends)'],
  ['parallelogram', 'Parallelogram (slanted sides)'],
]
export const MAX_NODE_TEXT = 500
export const MAX_NODE_LINES = 24
export function nodeTextError(word) {
  if (word.length > MAX_NODE_TEXT || word.split(/\r\n?|\n/).length > MAX_NODE_LINES) {
    return `Use at most ${MAX_NODE_TEXT} characters and ${MAX_NODE_LINES} lines.`
  }
  return ''
}
export const defaultNodeTextColor = shape => shape === 'text' ? '#263343' : '#ffffff'
export function nodeTextLines(word) {
  return word.replace(/\r\n?/g, '\n').split('\n').flatMap(line => {
    const lines = []
    const chars = [...line]
    while (chars.length > 28) {
      const space = chars.slice(0, 29).lastIndexOf(' ')
      lines.push(chars.splice(0, space > 0 ? space + 1 : 28).join('').trimEnd())
    }
    lines.push(chars.join(''))
    return lines
  })
}
export function nodeWidth(node) {
  const lines = nodeTextLines(node.word)
  const longest = Math.max(...lines.map(line => [...line].length))
  const base = Math.max(node.shape === 'text' ? 32 : 110, Math.min(380, longest * 12 + 30))
  if (node.shape === 'ellipse' && lines.length > 1) return base * Math.SQRT2
  // Keep the same space for text when the sides taper inward.
  return base + (['hexagon', 'parallelogram'].includes(node.shape) ? 44 : 0)
}
export const NODE_LINE_HEIGHT = 26
export function nodeHeight(node) {
  const lines = nodeTextLines(node.word)
  const height = (node.shape === 'text' ? 32 : 54) + (lines.length - 1) * NODE_LINE_HEIGHT
  return node.shape === 'ellipse' && lines.length > 1 ? height * Math.SQRT2 : height
}
export function nodePolygon(node) {
  const w = nodeWidth(node) / 2,
    h = nodeHeight(node) / 2,
    inset = 22
  if (node.shape === 'hexagon')
    return [
      [-w + inset, -h],
      [w - inset, -h],
      [w, 0],
      [w - inset, h],
      [-w + inset, h],
      [-w, 0],
    ]
  if (node.shape === 'parallelogram')
    return [
      [-w + inset, -h],
      [w, -h],
      [w - inset, h],
      [-w, h],
    ]
  return null
}
export const newId = () =>
  globalThis.crypto?.randomUUID?.() ||
  'wm-' + Date.now().toString(36) + Math.random().toString(36).slice(2)
export function emptyMap(name = 'Untitled map') {
  return { version: 1, id: newId(), name, nodes: [], edges: [] }
}
// Native colour pickers use six-digit hex; accept shorthand and pasted codes too.
export function normalizeNodeColor(value, fallback = '') {
  if (typeof value !== 'string') return fallback
  let hex = value.trim().replace(/^#/, '')
  if (/^[\da-f]{3}$/i.test(hex)) hex = [...hex].map((c) => c + c).join('')
  return /^[\da-f]{6}$/i.test(hex) ? '#' + hex.toLowerCase() : fallback
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
  const nodes = data.nodes.map((n) => {
    if (
      !n ||
      typeof n.id !== 'string' ||
      !n.id ||
      ids.has(n.id) ||
      typeof n.word !== 'string' ||
      !n.word.trim() ||
      nodeTextError(n.word) ||
      !Number.isFinite(n.x) ||
      !Number.isFinite(n.y)
    )
      throw Error(
        `Each word needs a unique id, text (up to ${MAX_NODE_TEXT} characters and ${MAX_NODE_LINES} lines), and numeric x/y positions.`
      )
    ids.add(n.id)
    return {
      id: n.id,
      word: n.word,
      ...keepNodeOnCanvas(n),
      lookup: str(n.lookup),
      note: str(n.note),
      color: normalizeNodeColor(n.color, '#dc3636'),
      textColor: normalizeNodeColor(n.textColor, defaultNodeTextColor(n.shape)),
      shape: NODE_SHAPES.some(([shape]) => shape === n.shape) ? n.shape : 'rectangle',
      images: [
        ...new Set((Array.isArray(n.images) ? n.images : []).map(imageLink).filter(Boolean)),
      ].slice(0, MAX_IMAGES),
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
      lineStyle: LINE_STYLES.includes(e.lineStyle) ? e.lineStyle : '',
      marker: e.marker === '×' ? '×' : '',
      arrows: ['none', 'start', 'end', 'both'].includes(e.arrows) ? e.arrows : 'none',
    }
  })
  const folder = folderPath(data.folder)
  if (data.folder != null && data.folder !== '' && (!folder || folder.length > 200))
    throw Error('Use a folder path such as Swedish/People, without empty parts, “.” or “..”.')
  return { version: 1, id: str(data.id) || newId(), name: data.name.slice(0, 200),
    ...(folder ? { folder } : {}), nodes, edges }
}
export function keepNodeOnCanvas(node) {
  const halfWidth = Math.max(80, nodeWidth(node) / 2)
  const halfHeight = Math.max(40, nodeHeight(node) / 2)
  return {
    x: Math.max(halfWidth, Math.min(2400 - halfWidth, node.x)),
    y: Math.max(halfHeight, Math.min(1600 - halfHeight, node.y)),
  }
}
export function removeNode(map, id) {
  map.nodes = map.nodes.filter((n) => n.id !== id)
  map.edges = map.edges.filter((e) => e.from !== id && e.to !== id)
}
export function edgeEnds(a, b) {
  const boundary = (n, dx, dy) => {
    const w = nodeWidth(n) / 2,
      h = nodeHeight(n) / 2,
      polygon = nodePolygon(n)
    let t
    if (n.shape === 'ellipse') {
      t = 1 / Math.sqrt((dx * dx) / (w * w) + (dy * dy) / (h * h))
    } else if (polygon) {
      // Intersect the centre-to-centre ray with the rendered polygon rather
      // than its bounding rectangle, so arrowheads touch the slanted sides.
      t = Infinity
      for (let i = 0; i < polygon.length; i++) {
        const p = polygon[i],
          q = polygon[(i + 1) % polygon.length]
        const ex = q[0] - p[0],
          ey = q[1] - p[1]
        const cross = dx * ey - dy * ex
        if (Math.abs(cross) < 1e-10) continue
        const ray = (p[0] * ey - p[1] * ex) / cross
        const side = (p[0] * dy - p[1] * dx) / cross
        if (ray >= 0 && side >= -1e-10 && side <= 1 + 1e-10) t = Math.min(t, ray)
      }
    } else {
      t = Math.min(w / Math.max(Math.abs(dx), 0.001), h / Math.max(Math.abs(dy), 0.001))
    }
    return { x: n.x + dx * t, y: n.y + dy * t }
  }
  const dx = b.x - a.x,
    dy = b.y - a.y
  if (!dx && !dy) return [a, b]
  return [boundary(a, dx, dy), boundary(b, -dx, -dy)]
}
