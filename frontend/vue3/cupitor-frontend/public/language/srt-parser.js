// SRT subtitle parsing, formatting, and merge logic — all pure. The
// modal merge-conflict dialog (`presentSrtMergeDialog`) stays in
// language.js because it touches jQuery UI / the DOM; the resolution
// Map it produces is consumed by `mergeSrtWithResolution` here.
//
// Time format conventions:
//   * SRT canonical: "HH:MM:SS,mmm" with comma decimal.
//   * Parsers also accept "HH:MM:SS.mmm" (dot decimal) — both seen in
//     the wild — and tolerate 1–3 digit ms.
//   * Item.start / Item.end may be a string ("HH:MM:SS,mmm"), a number
//     (seconds), or an object {ordinal} | {seconds}. srtTimeFromValue
//     canonicalises all three.

import { toSeconds } from './time-format.js'

// Tag a failed SRT fetch so the loader can tell a genuine miss from a
// recoverable one:
//   'notfound'  — HTTP 404: the file really isn't there, never retry.
//   'transient' — rate limiting (429), 5xx, network blip, or timeout: retry.
export function srtError(kind, message) {
  const e = new Error(message || kind)
  e.kind = kind
  e.isSrtError = true
  return e
}

// Parse a full SRT document into item records with .start/.end (as
// {ordinal: seconds}), .ts/.te (verbatim time strings), .text (concatenated
// body), .index/.id (sequence number from the file). When `lang` is given
// and not 'text', also mirror the body onto an item[lang] property — keeps
// legacy callers working without forcing them to rename to .text.
export function srtToJson(text, lang) {
  const mirror = lang && lang !== 'text'
  text = text.replaceAll('<c.huvudpratare>', '')
  const items = []
  let currentItem = { text: '' }
  if (mirror) currentItem[lang] = ''
  text.split('\n').forEach(line => {
    line = line.trim()
    const matchTime = line.match(/(\d\d:\d\d:\d\d[,.]\d\d\d) --> (\d\d:\d\d:\d\d[,.]\d\d\d)/m)
    const matchId = line.match(/^\d+$/m)
    if (matchId) {
      items.push(currentItem)
      currentItem = { index: line, id: line, text: '' }
      if (mirror) currentItem[lang] = ''
    } else if (matchTime) {
      currentItem['start'] = { ordinal: toSeconds(matchTime[1]) }
      currentItem['end'] = { ordinal: toSeconds(matchTime[2]) }
      currentItem['ts'] = matchTime[1]
      currentItem['te'] = matchTime[2]
    } else {
      currentItem.text += (line + '\n')
      if (mirror) currentItem[lang] += (line + '\n')
    }
  })
  items.push(currentItem)
  return items.filter(it => it.start && it.start.ordinal != null)
}

// Compact debug-string representation of a sub — number, time window,
// first 30 chars of the Swedish body.
export function toStringSubtitle(sub) {
  return `${sub.number}\n${sub.ts_o} --> ${sub.te_o}\n${sub.sv.substring(0, 30)}...`
}

// Canonicalise any of the supported time encodings to "HH:MM:SS,mmm".
// Falls back to '00:00:00,000' for unparseable input rather than throwing
// — caller code routinely passes through entries with missing timestamps.
export function srtTimeFromValue(v) {
  if (v == null) return '00:00:00,000'
  if (typeof v === 'object') {
    if (v.ordinal != null) return srtTimeFromValue(v.ordinal)
    if (v.seconds != null) return srtTimeFromValue(v.seconds)
    return '00:00:00,000'
  }
  if (typeof v === 'string') {
    const m = v.match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/)
    if (m) {
      const ms = (m[4] + '000').slice(0, 3)
      return `${m[1].padStart(2, '0')}:${m[2]}:${m[3]},${ms}`
    }
    const n = Number(v)
    if (!Number.isNaN(n)) return srtTimeFromValue(n)
    return '00:00:00,000'
  }
  const total = Math.max(0, Number(v) || 0)
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = Math.floor(total % 60)
  const ms = Math.round((total - Math.floor(total)) * 1000)
  const pad = (n, w) => String(n).padStart(w, '0')
  return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(ms, 3)}`
}

// Inverse: "HH:MM:SS,mmm" / "HH:MM:SS.mmm" → seconds. Tolerant of 1–3
// digit ms (pads on the right). Returns 0 for malformed input.
export function srtTimeToSeconds(ts) {
  const m = String(ts).match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/)
  if (!m) return 0
  return parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 +
         parseInt(m[3], 10) + parseInt((m[4] + '000').slice(0, 3), 10) / 1000
}

// Coarse entry parser used by the merge logic (cheaper than srtToJson and
// returns canonicalised time strings instead of {ordinal} objects).
// Tolerant: a missing sequence number on the first line is OK, blank
// blocks are skipped, blocks without a time-arrow line are skipped.
export function parseSrtEntries(text) {
  if (!text || typeof text !== 'string') return []
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/)
  const entries = []
  blocks.forEach(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return
    let startIdx = 0
    if (/^\d+$/.test(lines[0])) startIdx = 1
    const timeLine = lines[startIdx]
    const m = timeLine && timeLine.match(/(\d\d:\d\d:\d\d[,.]\d{1,3})\s*-->\s*(\d\d:\d\d:\d\d[,.]\d{1,3})/)
    if (!m) return
    const textLines = lines.slice(startIdx + 1)
    entries.push({
      start: srtTimeFromValue(m[1]),
      end: srtTimeFromValue(m[2]),
      text: textLines.join('\n')
    })
  })
  return entries
}

// Render a list of {start, end, text} entries back into SRT text with
// sequential 1-based numbering. Ends with a trailing newline.
export function entriesToSrtText(entries) {
  return entries.map((it, i) => {
    return `${i + 1}\n${it.start} --> ${it.end}\n${it.text}`
  }).join('\n\n') + '\n'
}

// Convert a list of "loose" items (start/end can be any srtTimeFromValue-
// compatible shape) into canonical SRT text, sorted by start time.
export function linesToSrtText(items) {
  const entries = (items || []).map(it => ({
    start: srtTimeFromValue(it.start),
    end: srtTimeFromValue(it.end),
    text: (it.text || '').replace(/\r\n/g, '\n')
  }))
  entries.sort((a, b) => srtTimeToSeconds(a.start) - srtTimeToSeconds(b.start))
  return entriesToSrtText(entries)
}

// Plain union of existing SRT text + new items. Drops exact duplicates
// (same start AND same text). Equivalent to mergeSrtWithResolution(_, _, null).
export function mergeSrtWithNewEntries(existingText, newItems) {
  return mergeSrtWithResolution(existingText, newItems, null)
}

// Conflict-aware merge. `resolution` is a Map<startTimeStr, {action, text}>
// where action is 'keep' | 'use-new' | 'edit'. For every existing entry
// whose start matches a 'use-new' / 'edit' decision, the existing entry
// is dropped so the incoming one takes its place. For 'keep' decisions
// the incoming entry is dropped instead. Re-applied verbatim on every
// commit retry so the user's resolution survives 409/422 retries even if
// the remote text drifted between attempts.
export function mergeSrtWithResolution(existingText, newItems, resolution) {
  const existing = parseSrtEntries(existingText)
  let incoming = (newItems || []).map(it => ({
    start: srtTimeFromValue(it.start),
    end: srtTimeFromValue(it.end),
    text: (it.text || '').replace(/\r\n/g, '\n')
  }))
  let filteredExisting = existing
  if (resolution && resolution.size) {
    filteredExisting = existing.filter(e => {
      const r = resolution.get(e.start)
      return !r || r.action === 'keep'
    })
    incoming = incoming.flatMap(e => {
      const r = resolution.get(e.start)
      if (!r) return [e]
      if (r.action === 'keep') return []
      if (r.action === 'edit') return [{ ...e, text: r.text }]
      return [e]
    })
  }
  const all = filteredExisting.concat(incoming)
  const seen = new Set()
  const deduped = []
  all.forEach(e => {
    const key = `${e.start}|${e.text}`
    if (seen.has(key)) return
    seen.add(key)
    deduped.push(e)
  })
  deduped.sort((a, b) => srtTimeToSeconds(a.start) - srtTimeToSeconds(b.start))
  return entriesToSrtText(deduped)
}

// Find entries where existing and incoming disagree on the same start time.
// Returns an array of {start, end, existingText, incomingText} — empty if
// the merge would be a clean union with no conflict resolution needed.
export function detectSrtConflicts(existingText, newItems) {
  if (!existingText) return []
  const existing = parseSrtEntries(existingText)
  const byStart = new Map(existing.map(e => [e.start, e]))
  const conflicts = []
  ;(newItems || []).forEach(it => {
    const start = srtTimeFromValue(it.start)
    const end   = srtTimeFromValue(it.end)
    const incomingText = String(it.text || '').replace(/\r\n/g, '\n').trim()
    const ex = byStart.get(start)
    if (!ex) return
    if ((ex.text || '').trim() === incomingText) return
    conflicts.push({
      start,
      end,
      existingText: (ex.text || ''),
      incomingText
    })
  })
  return conflicts
}
