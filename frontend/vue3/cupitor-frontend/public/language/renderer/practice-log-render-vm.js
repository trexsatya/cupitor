// View-model for the Practice Log dialog. Two tabs (Plan / History),
// each with its own VM builder. Status lookup is shared so the renderer
// emits identical labels + css classes for both tabs.
//
// Inputs come from `./practice-log.js`-shaped data — the in-memory
// `window._practiceLog` map. We don't reach into it directly here;
// callers pass it in.
//
// Module name has '-render-vm' rather than just '-vm' to avoid colliding
// with the legacy ./practice-log.js (storage) and ./practice-log.test.js
// at the parent folder.

import { PRACTICE_LOG_STATUSES, PRACTICE_LOG_DEFAULT_ITEMS, PRACTICE_LOG_DEFAULT_RETAIN } from '../practice-log.js'

// Lookup the {value, label, cls} record for a given status. Returns the
// 'not_started' default entry when the value is unknown — production
// code rendered the same fallback inline.
export function statusInfo(value) {
  return PRACTICE_LOG_STATUSES.find(s => s.value === (value || 'not_started')) || PRACTICE_LOG_STATUSES[0]
}

// VM for the Plan tab. Expects `weekRecord` to already be backfilled
// (call ensurePracticeLogWeek in the wrapper first so this stays pure).
export function buildPracticeLogPlanVM(customItems, weekRecord, weekLabel) {
  const items = (customItems || []).map(name => {
    const rec = (weekRecord && weekRecord[name]) || { status: 'not_started', notes: '' }
    return {
      name,
      status: rec.status || 'not_started',
      notes: rec.notes || '',
      isDefault: PRACTICE_LOG_DEFAULT_ITEMS.indexOf(name) !== -1,
    }
  })
  return { weekLabel, items }
}

// VM for the History tab. Takes the whole practice-log `data`, applies
// the retention slice (most-recent N weeks by ISO label), and projects
// each week to its renderable shape.
//
// Returns one of:
//   { state: 'empty', retainWeeks }
//   { state: 'normal', retainWeeks, weeks: [{ label, items: [{...}], empty }] }
export function buildPracticeLogHistoryVM(data) {
  const safeData = data || {}
  const retainWeeks = Math.max(
    1,
    parseInt(safeData.historyRetainWeeks, 10) || PRACTICE_LOG_DEFAULT_RETAIN
  )
  const allWeeks = Object.keys(safeData.weeks || {}).sort().reverse()
  if (!allWeeks.length) return { state: 'empty', retainWeeks }
  const slice = allWeeks.slice(0, retainWeeks)
  const weeks = slice.map(wk => {
    const week = safeData.weeks[wk] || {}
    const itemNames = Object.keys(week)
    const items = itemNames.map(name => {
      const rec = week[name] || {}
      const info = statusInfo(rec.status)
      return {
        name,
        status: rec.status || 'not_started',
        notes: (rec.notes || '').trim(),
        statusLabel: info.label,
        statusCls: info.cls,
      }
    })
    return { label: wk, items, empty: !itemNames.length }
  })
  return { state: 'normal', retainWeeks, weeks }
}
