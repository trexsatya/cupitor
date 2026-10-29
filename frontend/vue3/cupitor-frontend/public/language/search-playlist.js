import { contiguousClipWindow } from './random-playlist.js'

// Use the complete, filtered result group rather than the limited set of
// rendered cards. Keep the same context and sparse-subtitle bounds as Search.
export function buildSearchPlaylist(items, { files = [], lang = 'sv', word = '', searchText = word,
  contextBefore = 0, contextAfter = 0, gapThreshold = 2.5 } = {}) {
  const byUrl = new Map(files.map(file => [file.url, file]))
  const parsed = new Map()
  const seen = new Set()
  const queue = []
  for (const item of items || []) {
    if (!item?.url || !item.line) continue
    const key = JSON.stringify([item.url, String(item.line.index)])
    if (seen.has(key)) continue
    seen.add(key)
    if (!parsed.has(item.url)) {
      const file = byUrl.get(item.url)
      const lines = file?.[lang === 'en' ? 'en_subs' : 'sv_subs']?.data || []
      parsed.set(item.url, lines.map(line => ({ ...line,
        ts: line.start?.ordinal, te: line.end?.ordinal })))
    }
    const lines = parsed.get(item.url)
    const pos = lines.findIndex(line => String(line.index) === String(item.line.index))
    if (pos < 0 || !Number.isFinite(lines[pos].ts) || !Number.isFinite(lines[pos].te)) continue
    const win = contiguousClipWindow(lines, pos, {
      loBound: Math.max(0, pos - contextBefore), hiBound: Math.min(lines.length - 1, pos + contextAfter),
      gapThreshold, maxDuration: Infinity,
    })
    if (win.timeEnd <= win.timeStart) continue
    queue.push({ id: item.url, source: item.source, word: item.word || word, searchText,
      lineIndex: item.line.index, timeStart: Math.max(0, Math.floor(win.timeStart)),
      timeEnd: Math.ceil(win.timeEnd), enabled: true, _temporary: true })
  }
  return queue
}

export function buildSelectedSearchPlaylist(groups, selectedWords, { maxPerHeader = '', ...options } = {}) {
  const limit = maxPerHeader === '' ? Infinity : Number(maxPerHeader)
  if (maxPerHeader !== '' && (!Number.isSafeInteger(limit) || limit < 1)) {
    throw new RangeError('Max clips per heading must be a positive whole number.')
  }
  const selected = new Set(selectedWords)
  return groups.filter(group => selected.has(group.word)).flatMap(group =>
    buildSearchPlaylist(group.items, { ...options, word: group.word }).slice(0, limit))
}
