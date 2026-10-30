// Keep bucket identity (search/word/index) while allowing cards from different
// buckets to appear between one another. Old playlists retain their old order.
export function orderedRecordingEntries(items) {
  const entries = []
  for (const [st, words] of Object.entries(items || {})) {
    for (const [w, arr] of Object.entries(words || {})) {
      if (Array.isArray(arr)) arr.forEach((item, idx) => entries.push({ st, w, item, idx }))
    }
  }
  return entries.sort((a, b) => {
    const rank = e => Number.isFinite(e.item?.playlistOrder) ? e.item.playlistOrder : Infinity
    return rank(a) - rank(b)
  })
}

export function insertionIndex(value, total) {
  if (value == null || String(value).trim() === '') return total + 1
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= total + 1 ? n : null
}

export function rankRecordingEntries(entries) {
  entries.forEach(({ item }, i) => { if (item) item.playlistOrder = i })
}

// Validate before touching the destination. Blank means append to the whole
// playlist, even if the destination bucket occurs near its beginning.
export function insertRecordingItem(items, st, w, item, at) {
  const entries = orderedRecordingEntries(items)
  const pos = insertionIndex(at, entries.length)
  if (pos == null) return false
  if (!items[st]) items[st] = {}
  if (!Array.isArray(items[st][w])) items[st][w] = []
  const next = entries.slice(pos - 1).find(e => e.st === st && e.w === w)
  items[st][w].splice(next ? next.idx : items[st][w].length, 0, item)
  entries.splice(pos - 1, 0, { item })
  rankRecordingEntries(entries)
  return true
}

export function reorderRecordingBucket(items, st, w, next) {
  const entries = orderedRecordingEntries(items)
  let i = 0
  entries.forEach(e => { if (e.st === st && e.w === w) e.item = next[i++] })
  items[st][w] = next
  rankRecordingEntries(entries)
}
