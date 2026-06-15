// Pure recording-collection helpers: the playlist merge across devices,
// virtual-playlist resolution, item-count rollups, manual-entry id minting,
// and media-URL classification. All take their collection by argument so
// the module doesn't reach into window._recordings.
//
// Storage shape (`coll`):
//   {
//     [playlistName]: {
//       // virtual playlist
//       virtual?: true, members?: [<name>, ...],
//       // real playlist
//       items?: { [searchText]: { [word]: [item, ...] } },
//       createdAt: number, updatedAt: number,
//     }
//   }

export function isVirtual(coll, name) {
  const r = coll && coll[name]
  return !!(r && r.virtual)
}

// Manual items carry their own (Cupitor-minted) media instead of pointing
// at a YouTube clip. The .manual flag is set when the user adds one via
// the manual-entry editor.
export function isManualItem(it) { return !!(it && it.manual) }

// Stable id for a manual entry — identity used for resume reconstitution
// (must survive playlist reorder / sync merge). Prefixed `mc-` to keep it
// distinct from YouTube videoIds (which are 11 chars, no dashes).
export function newManualId(rand = Math.random) {
  return 'mc-' + rand().toString(36).slice(2, 9) + rand().toString(36).slice(2, 5)
}

// Parse a media URL into a discriminator + an extractable id where one
// applies. Returns null for blank input; otherwise one of:
//   { kind: 'youtube', id: '<videoId>', url }
//   { kind: 'audio',   url }    (Cupitor-saved audio recording, file://)
//   { kind: 'link',    url }    (anything else — opens in a new tab)
export function parseMediaUrl(raw) {
  const url = String(raw == null ? '' : raw).trim()
  if (!url) return null
  if (url.startsWith('file://')) return { kind: 'audio', url }
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:[^&]*&)*v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (yt && yt[1]) return { kind: 'youtube', id: yt[1], url }
  return { kind: 'link', url }
}

// Members of a virtual playlist, filtered to existing non-virtual entries
// (so a deleted / renamed member silently drops out — and nested virtual
// playlists are forbidden by collapsing them away).
export function virtualMembers(coll, name) {
  const r = coll && coll[name]
  if (!r || !r.virtual || !Array.isArray(r.members)) return []
  return r.members.filter(m => coll[m] && !coll[m].virtual)
}

// Resolve a virtual playlist's items to a single items-map (the same
// { [searchText]: { [word]: [items] } } shape as a real playlist). Item
// objects are REFERENCED, not copied, so this stays memory-cheap. Order
// follows the members list, then each member's own order, unioned by
// (id, lineIndex) within each (searchText, word).
export function resolveVirtualItems(coll, name) {
  const out = {}
  virtualMembers(coll, name).forEach(m => {
    const items = (coll[m] && coll[m].items) || {}
    Object.keys(items).forEach(st => {
      if (!out[st]) out[st] = {}
      Object.keys(items[st]).forEach(w => {
        if (!out[st][w]) out[st][w] = []
        const seen = new Set(out[st][w].map(it => `${it.id}|${it.lineIndex}`))
        ;(items[st][w] || []).forEach(it => {
          if (!it) return
          const k = `${it.id}|${it.lineIndex}`
          if (seen.has(k)) return
          seen.add(k)
          out[st][w].push(it)
        })
      })
    })
  })
  return out
}

// Items-map for any playlist by name — resolves virtual ones to a fresh
// union. Returns {} when the name is missing.
export function itemsForRecording(coll, name) {
  if (isVirtual(coll, name)) return resolveVirtualItems(coll, name)
  return (coll && coll[name] && coll[name].items) || {}
}

// Total recordable items across all (searchText, word) buckets.
export function recordingItemCountIn(items) {
  return Object.values(items || {}).reduce(
    (sum, words) => sum + Object.values(words).reduce((s2, arr) => s2 + arr.length, 0),
    0
  )
}

export function recordingItemCountByName(coll, name) {
  return recordingItemCountIn(itemsForRecording(coll, name))
}

// Two-sided merge of recording collections: returns a fresh object that
// unions both sides without mutating either. `nowFn` (optional) supplies
// timestamps for entries missing createdAt/updatedAt — defaults to
// Date.now so tests can pin time.
//
// Per-playlist rules:
//   * Side that has the entry wins outright if the other side doesn't.
//   * Virtual playlists: if EITHER side is virtual, the newer side's
//     shape wins. When both are virtual, members are unioned (newer side
//     first); when only the newer side is virtual, it wins as-is and the
//     older non-virtual side is discarded.
//   * Real playlists: items are unioned by (id, lineIndex) per
//     (searchText, word). The newer side's order leads; the older side
//     fills in items the newer doesn't have.
export function mergeRecordingCollections(localColl, remoteColl, nowFn = Date.now) {
  const out = {}
  const allNames = new Set([...Object.keys(localColl || {}), ...Object.keys(remoteColl || {})])
  allNames.forEach(name => {
    const a = (localColl && localColl[name]) || null
    const b = (remoteColl && remoteColl[name]) || null
    if (!a) { out[name] = b; return }
    if (!b) { out[name] = a; return }
    if (a.virtual || b.virtual) {
      const aNewerV = (a.updatedAt || 0) >= (b.updatedAt || 0)
      const newer = aNewerV ? a : b
      const older = aNewerV ? b : a
      if (newer.virtual) {
        const members = []
        const seen = new Set()
        ;[].concat(newer.members || [], older.virtual ? (older.members || []) : []).forEach(m => {
          if (m && !seen.has(m)) { seen.add(m); members.push(m) }
        })
        out[name] = {
          virtual: true,
          members,
          createdAt: Math.min(a.createdAt || nowFn(), b.createdAt || nowFn()),
          updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
        }
      } else {
        out[name] = newer
      }
      return
    }
    const mergedItems = {}
    const stKeys = new Set([...Object.keys(a.items || {}), ...Object.keys(b.items || {})])
    const aNewer = (a.updatedAt || 0) >= (b.updatedAt || 0)
    const first = aNewer ? a : b
    const second = aNewer ? b : a
    stKeys.forEach(st => {
      mergedItems[st] = {}
      const fByW = (first.items && first.items[st]) || {}
      const sByW = (second.items && second.items[st]) || {}
      const wKeys = new Set([...Object.keys(fByW), ...Object.keys(sByW)])
      wKeys.forEach(w => {
        const seen = new Set()
        const dest = []
        const push = (arr) => (arr || []).forEach(it => {
          if (!it) return
          const k = `${it.id}|${it.lineIndex}`
          if (seen.has(k)) return
          seen.add(k)
          dest.push(it)
        })
        push(fByW[w])
        push(sByW[w])
        mergedItems[st][w] = dest
      })
    })
    out[name] = {
      items: mergedItems,
      createdAt: Math.min(a.createdAt || nowFn(), b.createdAt || nowFn()),
      updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
    }
  })
  return out
}
