// Search over the manual cards in every playlist, shown alongside the
// subtitle results when "include manual cards" is on.
//
// Pure: takes the playlists map (`window._recordings`) and the search text, so
// it can be tested without a page. The search text is the same expanded,
// pipe-separated term the subtitle search runs, and is read the same way —
// a case-insensitive regex with spaces relaxed to any whitespace.

import { escapeHtml } from './html-utils.js'
import { relaxSpaces } from './search-text.js'

// Where addManualEntry files cards: items['Manual']['Card'].
const MANUAL_ST = 'Manual'
const MANUAL_W = 'Card'

function searchRegex(search, flags) {
  const s = String(search == null ? '' : search).trim()
  if (!s) return null
  try {
    return new RegExp(relaxSpaces(s), flags)
  } catch (_) {
    return null
  }
}

// [{ playlist, item }] for every card whose Source or Target matches, in
// playlist-name order. Virtual playlists are skipped (they show cards that
// live in another playlist, which would list one card twice), and so are the
// app's book playlists, which cannot hold manual cards.
export function findManualCards(recordings, search, { limit = 200 } = {}) {
  const re = searchRegex(search, 'i')
  if (!re || !recordings) return []
  const out = []
  for (const name of Object.keys(recordings).sort((a, b) => a.localeCompare(b))) {
    const rec = recordings[name]
    if (!rec || rec.virtual || rec.external) continue
    const bucket = rec.items && rec.items[MANUAL_ST] && rec.items[MANUAL_ST][MANUAL_W]
    if (!Array.isArray(bucket)) continue
    for (const item of bucket) {
      if (!item) continue
      if (re.test(String(item.source || '')) || re.test(String(item.target || ''))) {
        out.push({ playlist: name, item })
        if (out.length >= limit) return out
      }
    }
  }
  return out
}

// `text` as HTML with every match of `search` wrapped in the result list's
// highlight span. Escaped throughout: card text is typed or captured off a
// web page, and must never become markup.
export function highlightMatchesHtml(text, search) {
  const s = String(text == null ? '' : text)
  const re = searchRegex(search, 'gi')
  const parts = []
  let at = 0
  if (re) {
    let m
    while ((m = re.exec(s)) !== null) {
      if (!m[0]) { re.lastIndex++; continue }
      parts.push(escapeHtml(s.slice(at, m.index)))
      parts.push(`<span class='highlight'>${escapeHtml(m[0])}</span>`)
      at = m.index + m[0].length
    }
  }
  parts.push(escapeHtml(s.slice(at)))
  return parts.join('').replace(/\r?\n/g, '<br>')
}

function isWebLink(url) {
  try {
    const p = new URL(url).protocol
    return p === 'http:' || p === 'https:'
  } catch (_) {
    return false
  }
}

export function renderManualResultsHtml(hits, search) {
  if (!hits || !hits.length) {
    return '<div class="manual-results-empty">No manual cards match.</div>'
  }
  const rows = hits.map(({ playlist, item }) => {
    const link = item.mediaUrl && isWebLink(item.mediaUrl)
      ? `<a class="manual-hit-link" href="${escapeHtml(item.mediaUrl)}" target="_blank" rel="noopener" title="Open the card's link">🔗</a>`
      : ''
    return `<div class="manual-hit" data-playlist="${escapeHtml(playlist)}" data-id="${escapeHtml(item.id)}">
      <div class="manual-hit-head">
        <span class="manual-hit-playlist">${escapeHtml(playlist)}</span>
        ${link}
        <button type="button" class="manual-hit-edit lang-tool-btn" title="Edit this card">✎</button>
      </div>
      ${item.source ? `<div class="manual-hit-face">${highlightMatchesHtml(item.source, search)}</div>` : ''}
      ${item.target ? `<div class="manual-hit-face manual-hit-target">${highlightMatchesHtml(item.target, search)}</div>` : ''}
    </div>`
  })
  const n = hits.length
  return `<div class="manual-results-count">${n} manual card${n === 1 ? '' : 's'}</div>${rows.join('')}`
}
