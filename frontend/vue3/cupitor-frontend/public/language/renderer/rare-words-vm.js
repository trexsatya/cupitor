// View-model for the Rare Words dialog. Given the full scan results,
// the active category filter, and the current page, produce the slice
// that should be rendered + the category dropdown option list.
//
// Inputs (raw):
//   found:    [{ line, category, count }, ...]  — scan output
//   filter:   '' | category-name                — empty = no filter
//   page:     0-based current page
//   pageSize: number of items per page
//
// Output (vm consumed by ./rare-words-render.js):
//   {
//     state: 'empty' | 'no-matches' | 'normal',
//     rows: [{ kind: 'header', category } | { kind: 'item', line, count, category }],
//     page, pages, total
//   }

export const RARE_WORDS_PAGE_SIZE = 60

// Count items per category in the scan result. Empty / null categories
// bucket under '' so the renderer can label them '(uncategorised)'.
export function buildCategoryCounts(found) {
  const counts = {}
  ;(found || []).forEach(it => {
    if (!it) return
    counts[it.category || ''] = (counts[it.category || ''] || 0) + 1
  })
  return counts
}

// Build the dropdown options: the always-present "All categories (N)"
// entry first, then one row per category sorted by name.
export function buildCategoryOptions(found) {
  const list = Array.isArray(found) ? found : []
  const counts = buildCategoryCounts(list)
  const cats = Object.keys(counts).sort((a, b) => a.localeCompare(b))
  const opts = [{ value: '', label: `All categories (${list.length})` }]
  cats.forEach(c => {
    opts.push({ value: c, label: `${c || '(uncategorised)'} — ${counts[c]}` })
  })
  return opts
}

// Project the scan results into the page-render view-model.
// When no category filter is active, items are flowed with sticky-ish
// category headers (the renderer emits a 'header' row before the first
// item of each new category). With a filter the list is homogenous, so
// headers are suppressed.
export function buildRareWordsPageVM(found, opts = {}) {
  const list = Array.isArray(found) ? found : []
  const categoryFilter = (opts.categoryFilter || '').toString()
  const pageSize = opts.pageSize || RARE_WORDS_PAGE_SIZE
  const all = categoryFilter
    ? list.filter(it => it && (it.category || '') === categoryFilter)
    : list

  const pages = Math.max(1, Math.ceil(all.length / pageSize))
  const page = Math.min(Math.max(0, opts.page || 0), pages - 1)
  const slice = all.slice(page * pageSize, page * pageSize + pageSize)

  let state = 'normal'
  if (!list.length) state = 'empty'
  else if (!all.length) state = 'no-matches'

  const showHeaders = !categoryFilter
  const rows = []
  if (state === 'normal') {
    let currentCat = null
    let firstSeen = false
    slice.forEach(it => {
      if (showHeaders && (!firstSeen || it.category !== currentCat)) {
        currentCat = it.category
        firstSeen = true
        rows.push({ kind: 'header', category: currentCat || '(uncategorised)' })
      }
      rows.push({ kind: 'item', line: it.line, count: it.count, category: it.category })
    })
  }

  return { state, rows, page, pages, total: all.length }
}
