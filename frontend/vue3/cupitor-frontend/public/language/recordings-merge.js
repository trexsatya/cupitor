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

// A manual card's media may have a bounded clip even though the card has no
// subtitles. Numeric values are seconds; mm:ss and hh:mm:ss are also accepted.
export function parseMediaTime(value) {
  if (value == null || String(value).trim() === '') return null
  const raw = String(value).trim()
  if (!/^\d+(?:\.\d+)?$/.test(raw) &&
      !/^\d+:\d{1,2}(?::\d{1,2}(?:\.\d+)?)?$/.test(raw)) return NaN
  const parts = raw.split(':').map(Number)
  if (parts.length > 1 && (parts[parts.length - 1] >= 60 ||
      (parts.length === 3 && parts[1] >= 60))) return NaN
  const seconds = parts.reduce((total, n) => total * 60 + n, 0)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : NaN
}

// Respect a YouTube link's own start position if the editor's start field is
// blank. Handles t=90, t=1m30s, start=90 and #t=1:30.
export function mediaStartFromUrl(url) {
  try {
    // Match ?t=, &start= or #t= without needing URL construction (also
    // works in offline / embedded runtimes that omit the URL class).
    const param = String(url || '').match(/[?&#](?:t|start)=([^&#]+)/i)
    const raw = param ? decodeURIComponent(param[1].replace(/\+/g, ' ')) : null
    if (!raw) return 0
    const hms = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/i)
    if (hms && /[hms]/i.test(raw)) {
      return (Number(hms[1]) || 0) * 3600 + (Number(hms[2]) || 0) * 60 + (Number(hms[3]) || 0)
    }
    const secs = parseMediaTime(raw)
    return Number.isFinite(secs) ? secs : 0
  } catch (_) { return 0 }
}

// Validate editor inputs and convert either an absolute end or a duration
// into the same persisted mediaStart/mediaEnd seconds pair. A null end means
// no automatic stop, preserving the behaviour of existing manual cards.
export function buildManualMediaTiming({ url, start, end, duration }) {
  const has = v => v != null && String(v).trim() !== ''
  if (!url && (has(start) || has(end) || has(duration))) {
    throw new Error('Enter a media URL before setting clip times.')
  }
  if (has(end) && has(duration)) {
    throw new Error('Enter either an end time or a duration, not both.')
  }
  const parsedStart = parseMediaTime(start)
  const parsedEnd = parseMediaTime(end)
  const parsedDuration = parseMediaTime(duration)
  if (Number.isNaN(parsedStart) || Number.isNaN(parsedEnd) || Number.isNaN(parsedDuration)) {
    throw new Error('Times must be seconds, mm:ss or hh:mm:ss.')
  }
  const mediaStart = parsedStart == null ? mediaStartFromUrl(url) : parsedStart
  const mediaEnd = parsedEnd != null ? parsedEnd :
    parsedDuration != null ? mediaStart + parsedDuration : null
  if (parsedDuration != null && parsedDuration <= 0) {
    throw new Error('Duration must be greater than zero.')
  }
  if (mediaEnd != null && mediaEnd <= mediaStart) {
    throw new Error('End time must be later than start time.')
  }
  return {
    mediaStart,
    mediaEnd,
    mediaTimeMode: parsedDuration != null ? 'duration' : 'end'
  }
}

export function manualMediaClip(item) {
  if (!item || !item.mediaUrl) return null
  const s = item.mediaStart == null ? mediaStartFromUrl(item.mediaUrl) : Number(item.mediaStart)
  const e = item.mediaEnd == null ? null : Number(item.mediaEnd)
  const start = Number.isFinite(s) && s >= 0 ? s : 0
  return { start, end: Number.isFinite(e) && e > start ? e : null }
}

// Resolve a Practice card's YouTube cue in one place, including manual
// cards whose clip time lives in mediaStart/mediaEnd rather than timeStart.
// Used on initial render, restore and explicit playback so they cannot
// disagree about the media id or start position.
export function practiceVideoTarget(item) {
  if (!item) return null
  if (item.manual) {
    if (item.mediaKind !== 'youtube' || !item.mediaVideoId) return null
    const clip = manualMediaClip(item)
    return { videoId: item.mediaVideoId, start: clip ? clip.start : 0,
      end: clip ? clip.end : null }
  }
  if (!item.id) return null
  const start = Number(item.timeStart)
  const end = Number(item.timeEnd)
  return { videoId: item.id, start: Number.isFinite(start) && start >= 0 ? start : 0,
    end: Number.isFinite(end) && end > start ? end : null }
}

// Unlike rewriting an iframe's src (which reloads at t=0), the YouTube
// IFrame API accepts startSeconds for a paused cue. Also works when
// the same video is already loaded: restore should seek to the card start.
export function cuePracticeYoutubeVideo(player, target) {
  if (!player || typeof player.cueVideoById !== 'function' || !target) return false
  player.cueVideoById({ videoId: target.videoId, startSeconds: target.start })
  return true
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
