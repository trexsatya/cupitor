// Bound the rendered playlist without changing its items or playback order.
import { orderedRecordingEntries } from './recordings-order.js'
export const RECORDING_REVIEW_PAGE_SIZE = 50

export function recordingReviewPage(items, requestedPage = 0, size = RECORDING_REVIEW_PAGE_SIZE) {
  const entries = orderedRecordingEntries(items)
  size = Math.max(1, Math.floor(Number(size)) || RECORDING_REVIEW_PAGE_SIZE)
  const total = entries.length, pageCount = Math.max(1, Math.ceil(total / size))
  const page = Math.max(0, Math.min(pageCount - 1, Math.floor(Number(requestedPage)) || 0))
  const start = page * size, end = Math.min(total, start + size)
  const groups = Object.create(null)
  const runs = []
  for (const entry of entries.slice(start, end)) {
    const words = groups[entry.st] || (groups[entry.st] = Object.create(null))
    const group = words[entry.w] || (words[entry.w] = [])
    group.push(entry)
    let run = runs[runs.length - 1]
    if (!run || run.st !== entry.st || run.w !== entry.w) {
      run = { st: entry.st, w: entry.w, entries: [] }
      runs.push(run)
    }
    run.entries.push(entry)
  }
  return { page, pageCount, start, end, total, groups, runs }
}

// A sortable page contains only part of a group. Reorder those positions and
// retain every item outside the page when passing a full order to persistence.
export function recordingReviewOrder(visibleOrder, length) {
  if (new Set(visibleOrder).size !== visibleOrder.length ||
      visibleOrder.some(i => !Number.isInteger(i) || i < 0 || i >= length)) return null
  const order = Array.from({ length }, (_, i) => i)
  visibleOrder.slice().sort((a, b) => a - b).forEach((position, i) => { order[position] = visibleOrder[i] })
  return order
}
