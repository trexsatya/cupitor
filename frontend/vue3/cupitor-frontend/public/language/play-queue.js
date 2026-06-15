// Pure helpers for assembling, shuffling, snapshotting, and resuming a
// play / practice queue. The localStorage I/O and the confirm() prompt
// stay in language.js — this module's job is to transform shapes so the
// state can be inspected and tested without a browser.
//
// Item shape (carried through the queue):
//   { ...originalItem, _recName, _st, _w, _idx }
//     _recName: source playlist name
//     _st / _w: searchText / word bucket
//     _idx:     position within the bucket array
//
// Identity tuple for a saved queue:
//   { recName, st, w, id, lineIndex }
//
// last-played map shape:
//   { [recName]: { play?: <entry>, practice?: <entry> } }
//
// Each entry: { recName, st, w, idx, id, lineIndex, mode, queueKeys, queuePos, ts }

import { resolveVirtualItems } from './recordings-merge.js'

// Walk a single recording's items map into a queue, skipping items where
// `enabled === false`. Caller controls which items are passed in.
function _pushFrom(queue, recName, items) {
  if (!items) return
  for (const st of Object.keys(items)) {
    const byW = items[st] || {}
    for (const w of Object.keys(byW)) {
      const arr = byW[w] || []
      arr.forEach((it, idx) => {
        if (!it || it.enabled === false) return
        queue.push({ ...it, _recName: recName, _st: st, _w: w, _idx: idx })
      })
    }
  }
}

// Build the play queue for a session. When `loop === 'all'` we union every
// real playlist in the collection (sorted by name). Otherwise we use just
// the `currentName` playlist's items — caller-resolved, so a virtual
// playlist's union has already been computed upstream.
//
// Skips virtual playlists in the 'all' walk because their items are
// duplicates of the real members already iterated.
export function buildPlayQueue({ loop, recordings, currentName, currentItems }) {
  const queue = []
  if (loop === 'all') {
    Object.keys(recordings || {}).sort().forEach(n => {
      const rec = recordings[n]
      if (!rec || rec.virtual) return
      _pushFrom(queue, n, rec.items)
    })
  } else {
    _pushFrom(queue, currentName, currentItems || {})
  }
  return queue
}

// Fisher-Yates shuffle. Mutates `q` in place and returns it for chaining.
// `randFn` (defaults to Math.random) lets tests pin the order.
export function shuffleQueue(q, randFn = Math.random) {
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(randFn() * (i + 1))
    const tmp = q[i]; q[i] = q[j]; q[j] = tmp
  }
  return q
}

// Migrate a legacy single-cursor object into the new map shape (keyed by
// recName + mode). If `parsed` is already in the new shape, return it
// unchanged. Returns `null` for falsy / non-object inputs.
export function migrateLegacyLastPlayedMap(parsed) {
  if (!parsed || typeof parsed !== 'object') return null
  if (!parsed.recName) return parsed
  const m = {}
  const mode = parsed.mode === 'practice' ? 'practice' : 'play'
  m[parsed.recName] = {}
  m[parsed.recName][mode] = parsed
  return m
}

// Pure update: snapshot a single item's cursor into the map under the
// chosen mode. Returns a NEW map (or the same instance if `it` is missing
// origin metadata). Ad-hoc queues without `_recName` are no-ops so they
// don't clobber a resumable session.
export function setLastPlayedEntry(map, it, mode, pos) {
  if (!it || !it._recName) return map
  const m = (mode === 'practice') ? 'practice' : 'play'
  const next = { ...(map || {}) }
  if (!next[it._recName]) next[it._recName] = {}
  next[it._recName] = { ...next[it._recName] }
  const prev = next[it._recName][m] || {}
  next[it._recName][m] = {
    ...prev,
    recName: it._recName, st: it._st, w: it._w, idx: it._idx,
    id: it.id, lineIndex: it.lineIndex,
    mode: m,
    queuePos: (typeof pos === 'number') ? pos : prev.queuePos,
    ts: prev.ts || 0,
  }
  return next
}

// Pick the newer of (play, practice) entries for `recName`, or null if
// neither exists. The ts field is hand-rolled monotonic in saveQueueOrder.
export function getNewestEntry(map, recName) {
  if (!map || !recName || !map[recName]) return null
  const p = map[recName].play, q = map[recName].practice
  if (p && q) return ((p.ts || 0) >= (q.ts || 0)) ? p : q
  return p || q || null
}

// Identity tuples for every item in `queue` that has playlist origin.
// Used to anchor a saved queue across playlist edits.
export function buildQueueKeys(queue) {
  if (!Array.isArray(queue)) return []
  const keys = []
  for (const it of queue) {
    if (!it || !it._recName) continue
    keys.push({
      recName: it._recName, st: it._st, w: it._w,
      id: it.id, lineIndex: it.lineIndex,
    })
  }
  return keys
}

// Pure update: snapshot the queue order + reset queuePos. Returns a NEW
// map. `recName` is the target playlist (caller supplies — usually the
// active one). No-op if `queue` is empty / has no origin items.
export function saveQueueOrderInto(map, queue, mode, recName) {
  const keys = buildQueueKeys(queue)
  if (!keys.length) return map || {}
  const m = (mode === 'practice') ? 'practice' : 'play'
  const next = { ...(map || {}) }
  if (!next[recName]) next[recName] = {}
  next[recName] = { ...next[recName] }
  const prev = next[recName][m] || {}
  next[recName][m] = {
    ...prev,
    mode: m,
    queueKeys: keys,
    queuePos: 0,
    ts: prev.ts || 1,
  }
  // Hand-roll a monotonic timestamp so picking "newest" across modes
  // works without relying on Date.now (kept deterministic for tests).
  let maxTs = 0
  Object.values(next).forEach(byMode => {
    Object.values(byMode || {}).forEach(e => { if (e && e.ts > maxTs) maxTs = e.ts })
  })
  next[recName][m].ts = maxTs + 1
  return next
}

// Rebuild a live queue from saved identity tuples. Skips keys whose item
// no longer exists or is now disabled. `collection` is the full
// recordings map (used to resolve virtual playlists on the fly).
export function reconstituteQueue(collection, keys) {
  const out = []
  if (!Array.isArray(keys)) return out
  for (const k of keys) {
    if (!k || !k.recName) continue
    const rec = collection && collection[k.recName]
    if (!rec) continue
    const items = rec.virtual ? resolveVirtualItems(collection, k.recName) : rec.items
    const arr = items && items[k.st] && items[k.st][k.w]
    if (!Array.isArray(arr)) continue
    let liveIdx = -1, live = null
    for (let i = 0; i < arr.length; i++) {
      const it = arr[i]
      if (it && it.id === k.id && it.lineIndex === k.lineIndex) {
        liveIdx = i; live = it; break
      }
    }
    if (!live || live.enabled === false) continue
    out.push({ ...live, _recName: k.recName, _st: k.st, _w: k.w, _idx: liveIdx })
  }
  return out
}

// Build the prompt text the language.js wrapper shows to the user.
// Extracted as a pure function so callers can show their own UI without
// re-deriving "X of N remaining" elsewhere.
export function resumePromptMessage(recName, mode, remaining, total) {
  const m = (mode === 'practice') ? 'practice' : 'play'
  return `Resume your last ${m} session in "${recName}"?\n\n` +
         `${remaining} of ${total} item(s) remaining (same order).\n\n` +
         `OK = continue from where you left off\n` +
         `Cancel = start fresh (re-shuffles if shuffle is on)`
}

// Returns { queue, pos, message } if a resumable session exists for the
// active playlist + mode, or null otherwise. The caller decides whether
// to confirm() with the user; `message` is provided as a convenience.
// queuePos >= queueKeys.length (full replay) returns null — no point
// resuming "1 of N" on the last item.
export function computeResumePoint(map, collection, recName, mode) {
  if (!recName || !collection || !collection[recName]) return null
  const m = (mode === 'practice') ? 'practice' : 'play'
  const lp = map && map[recName] && map[recName][m]
  if (!lp || !Array.isArray(lp.queueKeys) || !lp.queueKeys.length) return null
  const live = reconstituteQueue(collection, lp.queueKeys)
  if (!live.length) return null
  const rawPos = lp.queuePos || 0
  if (rawPos >= lp.queueKeys.length) return null
  const pos = Math.min(Math.max(0, rawPos), live.length - 1)
  const remaining = live.length - pos
  return { queue: live, pos, message: resumePromptMessage(recName, m, remaining, live.length) }
}
