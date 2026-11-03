import { scopedKey } from './account-state.js'
import { parseWordMaps } from './word-maps-sync.js'
import { relaxSpaces } from './search-text.js'
import { escapeHtml } from './html-utils.js'
import { highlightMatchesHtml, matchSnippetHtml } from './manual-search.js'

export function wordMapStorageKey(search = location.search) {
  return scopedKey('cupitor:wordMaps:' + (new URLSearchParams(search).get('lang') || 'swedish'))
}
export function readSearchMaps(key, storage = localStorage) {
  if (storage.readMaps) return storage.readMaps(key)
  return parseWordMaps(storage.getItem(key))
}
// One hit per map; retain every matching node for highlighting, rather than
// listing the same map once for each occurrence. Use the manual-card regex
// semantics, including alternatives and relaxed whitespace.
export function findWordMaps(maps, search, { limit = 200 } = {}) {
  const query = String(search || '').trim()
  if (!query) return []
  let re
  try { re = new RegExp(relaxSpaces(query), 'i') } catch (_) { return [] }
  const hits = []
  for (const map of [...(maps || [])].sort((a, b) => a.name.localeCompare(b.name))) {
    const nodes = map.nodes.filter(node => [node.word, node.lookup, node.note].some(value => re.test(value || '')))
    const nameMatched = re.test(map.name)
    if (nameMatched || nodes.length) hits.push({ map, nodes, nameMatched })
    if (hits.length >= limit) break
  }
  return hits
}
export function renderWordMapResultsHtml(hits, query, { collapsed = false } = {}) {
  if (!hits.length) return '<div class="manual-results-empty">No word maps match.</div>'
  const rows = hits.map(({ map, nodes }) => {
    const node = nodes[0]
    const snippet = node && ([node.word, node.lookup, node.note].map(text => matchSnippetHtml(text, query)).find(Boolean))
    return `<button type="button" class="manual-hit word-map-hit" data-map-id="${escapeHtml(map.id)}" title="Open map and highlight matches">` +
      `<span class="manual-hit-playlist">${highlightMatchesHtml(map.name, query)}</span> ${snippet || ''}` +
      (nodes.length > 1 ? ` <small>(${nodes.length} matching words)</small>` : '') + '</button>'
  }).join('')
  return `<div class="lib-wrap word-map-wrap${collapsed ? ' lib-collapsed' : ''}">
    <button type="button" class="manual-head word-map-head" aria-expanded="${!collapsed}"><span class="lib-caret">${collapsed ? '▸' : '▾'}</span> ◇ ${hits.length} word map${hits.length === 1 ? '' : 's'}</button>
    <div class="lib-body">${rows}</div></div>`
}
