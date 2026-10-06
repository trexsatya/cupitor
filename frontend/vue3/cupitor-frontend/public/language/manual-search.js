// Search over the manual cards in every playlist, shown alongside the
// subtitle results when "include manual cards" is on.
//
// Pure: takes the playlists map (`window._recordings`) and the search text, so
// it can be tested without a page. The search text is the same expanded,
// pipe-separated term the subtitle search runs, and is read the same way —
// a case-insensitive regex with spaces relaxed to any whitespace.

import { escapeHtml } from './html-utils.js'
import { relaxSpaces } from './search-text.js'
import { cardPlainText } from './card-html.js'

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
      // The words, so a search for "span" does not find every card in colour.
      if (re.test(cardPlainText(item.source)) || re.test(cardPlainText(item.target))) {
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

// One line of `text` around the first match, as HTML: whitespace (line breaks
// included) flattened to single spaces, cut to about `radius` characters
// either side of the match at word boundaries, with … where it was cut, and
// every match inside the cut highlighted. Null when nothing matches.
export function matchSnippetHtml(text, search, radius = 40) {
  const flat = String(text == null ? '' : text).replace(/\s+/g, ' ').trim()
  const re = searchRegex(search, 'i')
  const m = re && flat ? re.exec(flat) : null
  if (!m) return null
  const mEnd = m.index + m[0].length
  let start = Math.max(0, m.index - radius)
  let end = Math.min(flat.length, mEnd + radius)
  if (start > 0) {
    const sp = flat.indexOf(' ', start)
    if (sp >= 0 && sp < m.index) start = sp + 1
  }
  if (end < flat.length) {
    const sp = flat.lastIndexOf(' ', end)
    if (sp > mEnd) end = sp
  }
  return (start > 0 ? '…' : '') +
    highlightMatchesHtml(flat.slice(start, end), search) +
    (end < flat.length ? '…' : '')
}

// The manual-card block for the results area: a header that folds it, and
// one line per card — the matching face cut down to the match. `collapsed`
// renders it folded; the header stays so the count is still visible.
export function renderManualResultsHtml(hits, search, { collapsed = false } = {}) {
  if (!hits || !hits.length) {
    return '<div class="manual-results-empty">No manual cards match.</div>'
  }
  const rows = hits.map(({ playlist, item }) => {
    const snippet = matchSnippetHtml(cardPlainText(item.source), search) ||
      matchSnippetHtml(cardPlainText(item.target), search) || ''
    return `<button type="button" class="manual-hit" data-playlist="${escapeHtml(playlist)}" data-id="${escapeHtml(item.id)}" title="Practice this card">` +
      `<span class="manual-hit-playlist">${escapeHtml(playlist)}</span> ${snippet}</button>`
  })
  const n = hits.length
  return `<div class="lib-wrap manual-wrap${collapsed ? ' lib-collapsed' : ''}">
  <button type="button" class="manual-head" aria-expanded="${!collapsed}" title="Show / hide the manual cards"><span class="lib-caret">${collapsed ? '▸' : '▾'}</span> 🗂 ${n} manual card${n === 1 ? '' : 's'}</button>
  <div class="lib-body">${rows.join('')}</div>
</div>`
}
