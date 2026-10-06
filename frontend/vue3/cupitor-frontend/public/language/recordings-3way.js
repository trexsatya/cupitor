// Three-way sync of the playlist collection (recordings.json).
//
// `base` is the server's copy as of the last time this device and the server
// agreed — after a pull at load, or a successful Sync. Comparing each side to
// it is what tells "I deleted this" apart from "the other device added this",
// which a two-way union cannot: it brings every deleted item back.
//
// Pure: everything comes in as plain objects, so it is testable without a page.
// The shape is the one recordings-merge.js documents:
//   { [playlist]: { items?: { [st]: { [w]: [item] } }, virtual?, members?,
//                   createdAt, updatedAt, ...settings } }

// JSON with object keys sorted, so the same data written in a different key
// order compares equal. Arrays keep their order: reordering a playlist is a
// change.
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']'
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort()
      .filter(k => v[k] !== undefined)
      .map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
  }
  return JSON.stringify(v === undefined ? null : v)
}

export function sameJson(a, b) {
  return stable(a == null ? null : a) === stable(b == null ? null : b)
}

// Same playlist content. `updatedAt` is left out: saving a playlist bumps it
// even when nothing in it changed, and that alone must not make a playlist
// "changed on both sides".
function samePlaylist(a, b) {
  const strip = p => (p && typeof p === 'object' ? { ...p, updatedAt: undefined } : p)
  return sameJson(strip(a), strip(b))
}

// Per playlist: unchanged on one side → the other side wins (a deletion
// included); changed the same way on both → either; changed differently on
// both → a conflict the caller resolves. Conflicts are left out of `merged`.
export function threeWayRecordings(base, local, remote) {
  const b0 = base || {}, l0 = local || {}, r0 = remote || {}
  const merged = {}
  const conflicts = []
  const names = new Set([...Object.keys(b0), ...Object.keys(l0), ...Object.keys(r0)])
  for (const name of [...names].sort((x, y) => x.localeCompare(y))) {
    const b = b0[name] || null, l = l0[name] || null, r = r0[name] || null
    let out
    if (samePlaylist(l, r)) out = l
    else if (samePlaylist(l, b)) out = r
    else if (samePlaylist(r, b)) out = l
    else { conflicts.push({ name, base: b, local: l, remote: r }); continue }
    if (out) merged[name] = out
  }
  return { merged, conflicts }
}

function itemKey(it) {
  return `${it && it.id}|${it && it.lineIndex}`
}

// One item's three versions → the merged one (null = deleted), and whether
// both sides changed it.
function mergeOne(b, l, r, localNewer) {
  if (sameJson(l, r)) return { v: l, hit: false }
  if (sameJson(l, b)) return { v: r, hit: false }
  if (sameJson(r, b)) return { v: l, hit: false }
  // Changed on both. A deletion against an edit keeps the edit: losing the
  // text someone just wrote is the worse of the two.
  if (!l) return { v: r, hit: true }
  if (!r) return { v: l, hit: true }
  return { v: localNewer ? l : r, hit: true }
}

function bucketsOf(p) {
  const out = new Map()   // "st\0w" -> Map(key -> item)
  const items = (p && p.items) || {}
  for (const st of Object.keys(items)) {
    for (const w of Object.keys(items[st] || {})) {
      const m = new Map()
      for (const it of items[st][w] || []) if (it) m.set(itemKey(it), it)
      out.set(st + '\u0000' + w, m)
    }
  }
  return out
}

// Item-level merge of one playlist changed on both sides. Additions from both
// sides are kept and deletions from either honoured. An item changed on both
// takes the newer playlist's version and is listed in `collisions` as
// "st / w / id", so the person can be told which cards to look at. Order
// follows this device's list, with the server's additions after it.
export function mergePlaylist3(base, local, remote) {
  const b = base || {}, l = local || {}, r = remote || {}
  const localNewer = (l.updatedAt || 0) >= (r.updatedAt || 0)
  const collisions = []
  if (!!l.virtual !== !!r.virtual) {
    return { playlist: localNewer ? l : r, collisions: ['(playlist type)'] }
  }

  const out = {}
  const fields = new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])
  for (const f of fields) {
    if (f === 'items' || f === 'createdAt' || f === 'updatedAt') continue
    const { v, hit } = mergeOne(b[f], l[f], r[f], localNewer)
    if (hit) collisions.push(`(setting ${f})`)
    if (v !== undefined && v !== null) out[f] = v
  }
  out.createdAt = Math.min(l.createdAt || Infinity, r.createdAt || Infinity, b.createdAt || Infinity)
  if (!Number.isFinite(out.createdAt)) delete out.createdAt
  out.updatedAt = Math.max(l.updatedAt || 0, r.updatedAt || 0)

  if (l.items || r.items || b.items) {
    const bb = bucketsOf(b), lb = bucketsOf(l), rb = bucketsOf(r)
    const items = {}
    const bucketKeys = new Set([...lb.keys(), ...rb.keys(), ...bb.keys()])
    for (const bk of bucketKeys) {
      const [st, w] = bk.split('\u0000')
      const bm = bb.get(bk) || new Map(), lm = lb.get(bk) || new Map(), rm = rb.get(bk) || new Map()
      const order = [...lm.keys(), ...[...rm.keys()].filter(k => !lm.has(k)),
        ...[...bm.keys()].filter(k => !lm.has(k) && !rm.has(k))]
      const dest = []
      for (const k of order) {
        const { v, hit } = mergeOne(bm.get(k) || null, lm.get(k) || null, rm.get(k) || null, localNewer)
        if (hit) collisions.push(`${st} / ${w} / ${k.split('|')[0]}`)
        if (v) dest.push(v)
      }
      if (!dest.length && !lm.size && !rm.size) continue
      if (!items[st]) items[st] = {}
      items[st][w] = dest
    }
    out.items = items
  }
  return { playlist: out, collisions }
}

// What one side did to a playlist since the last sync, in counts a person can
// weigh up: { state: 'new' | 'deleted' | 'changed' | 'same', added, removed,
// edited, total }.
export function summarizePlaylistChange(base, side) {
  if (!side) return { state: 'deleted', added: 0, removed: 0, edited: 0, total: 0 }
  const count = m => [...m.values()].reduce((n, x) => n + x.size, 0)
  const sb = bucketsOf(side)
  if (!base) return { state: 'new', added: count(sb), removed: 0, edited: 0, total: count(sb) }
  const bb = bucketsOf(base)
  let added = 0, removed = 0, edited = 0
  const keys = new Set([...bb.keys(), ...sb.keys()])
  for (const k of keys) {
    const bm = bb.get(k) || new Map(), sm = sb.get(k) || new Map()
    for (const [ik, it] of sm) {
      if (!bm.has(ik)) added++
      else if (!sameJson(bm.get(ik), it)) edited++
    }
    for (const ik of bm.keys()) if (!sm.has(ik)) removed++
  }
  const state = sameJson(base, side) ? 'same' : 'changed'
  return { state, added, removed, edited, total: count(sb) }
}
