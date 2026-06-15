// Pure data model for the weekly practice-log feature. No DOM, no
// localStorage, no fetch — just shapes + transformations. The storage /
// network / DOM wiring stays in language.js around `_loadPracticeLogLocal`,
// `_savePracticeLogLocal`, `_fetchPracticeLogRemote`, etc.

export const PRACTICE_LOG_DEFAULT_ITEMS = ['Reading', 'Writing', 'Listening', 'Speaking', 'Vocabulary', 'Grammar']

export const PRACTICE_LOG_STATUSES = [
  { value: 'not_started', label: 'Not started', cls: 'pl-status-notstarted' },
  { value: 'in_progress', label: 'In progress', cls: 'pl-status-progress' },
  { value: 'done',        label: 'Done',        cls: 'pl-status-done' },
  { value: 'skipped',     label: 'Skipped',     cls: 'pl-status-skipped' },
]

export const PRACTICE_LOG_DEFAULT_RETAIN = 100

export function defaultPracticeLog() {
  return {
    customItems: PRACTICE_LOG_DEFAULT_ITEMS.slice(),
    weeks: {},
    historyRetainWeeks: PRACTICE_LOG_DEFAULT_RETAIN,
  }
}

// Coerce a raw object (e.g. from JSON.parse or fetch) into the canonical
// practice-log shape. Returns null if `j` isn't a usable object so the
// caller can fall back to defaults / abandon a remote response.
export function normalizePracticeLog(j) {
  if (!j || typeof j !== 'object') return null
  if (!Array.isArray(j.customItems) || !j.customItems.length) {
    j.customItems = PRACTICE_LOG_DEFAULT_ITEMS.slice()
  }
  if (!j.weeks || typeof j.weeks !== 'object') j.weeks = {}
  if (!Number.isFinite(j.historyRetainWeeks) || j.historyRetainWeeks < 1) {
    j.historyRetainWeeks = PRACTICE_LOG_DEFAULT_RETAIN
  }
  return j
}

// ISO 8601 week label (e.g. "2026-W24") for an arbitrary Date. Week starts
// Monday — same convention Sweden uses, so the user can compare against
// any printed Swedish calendar.
export function isoWeekLabel(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

// Date shifted by `days` (positive or negative).
export function addDays(date, days) {
  const d = new Date(date.getTime())
  d.setDate(d.getDate() + days)
  return d
}

// Drop weeks older than the retention horizon (keep the most-recent N by
// ISO label, which sorts chronologically). Always keeps `currentLabel`
// and `nextLabel` even if N is tiny — those are the actively edited rows.
// Mutates `data` in-place and returns it.
export function prunePracticeLogWeeks(data, currentLabel, nextLabel) {
  const N = Math.max(1, parseInt(data.historyRetainWeeks, 10) || PRACTICE_LOG_DEFAULT_RETAIN)
  const keep = new Set(Object.keys(data.weeks).sort().slice(-N))
  if (currentLabel) keep.add(currentLabel)
  if (nextLabel) keep.add(nextLabel)
  Object.keys(data.weeks).forEach(wk => { if (!keep.has(wk)) delete data.weeks[wk] })
  return data
}

// Backfill `weekLabel` so every item in `data.customItems` has at least a
// default { status, notes } record. Mutates `data.weeks[weekLabel]` and
// returns it.
export function ensurePracticeLogWeek(data, weekLabel) {
  if (!data.weeks[weekLabel]) data.weeks[weekLabel] = {}
  data.customItems.forEach(it => {
    if (!data.weeks[weekLabel][it]) data.weeks[weekLabel][it] = { status: 'not_started', notes: '' }
  })
  return data.weeks[weekLabel]
}

// "Does `weekLabel` have any item still on its default not_started status?"
// Items missing from the week record are implicitly not_started, so a week
// that's never been touched also returns true. Used to surface a reminder
// while there's still anything left to plan/log for the week.
export function weekHasUntouchedItem(data, weekLabel) {
  const items = (data && data.customItems) || PRACTICE_LOG_DEFAULT_ITEMS
  const week = (data && data.weeks && data.weeks[weekLabel]) || {}
  return items.some(name => {
    const it = week[name]
    return !it || !it.status || it.status === 'not_started'
  })
}

// Three-way-ish merge: union of remote and local. customItems is unioned
// in remote-first order so a previously added custom item doesn't get
// reordered by another device. Per-item: prefer whichever side has actual
// content (non-default status OR non-empty notes); when both do, local
// wins (that's the device the user just edited on).
export function mergePracticeLog(remote, local) {
  if (!remote) return local
  if (!local)  return remote
  const out = {
    customItems: [],
    weeks: {},
    historyRetainWeeks: Math.max(
      parseInt(remote.historyRetainWeeks, 10) || PRACTICE_LOG_DEFAULT_RETAIN,
      parseInt(local.historyRetainWeeks,  10) || PRACTICE_LOG_DEFAULT_RETAIN
    )
  }
  const seen = new Set()
  ;[remote.customItems, local.customItems].forEach(list => {
    if (!Array.isArray(list)) return
    list.forEach(n => { if (n && !seen.has(n)) { seen.add(n); out.customItems.push(n) } })
  })
  const weekKeys = new Set([...Object.keys(remote.weeks || {}), ...Object.keys(local.weeks || {})])
  weekKeys.forEach(wk => {
    const r = (remote.weeks && remote.weeks[wk]) || {}
    const l = (local.weeks  && local.weeks[wk])  || {}
    const merged = {}
    const itemKeys = new Set([...Object.keys(r), ...Object.keys(l)])
    itemKeys.forEach(it => {
      const rv = r[it] || {}, lv = l[it] || {}
      const lvHas = (lv.status && lv.status !== 'not_started') || (lv.notes && lv.notes.trim())
      const rvHas = (rv.status && rv.status !== 'not_started') || (rv.notes && rv.notes.trim())
      merged[it] = lvHas ? { status: lv.status || 'not_started', notes: lv.notes || '' }
                  : rvHas ? { status: rv.status || 'not_started', notes: rv.notes || '' }
                          : { status: 'not_started', notes: '' }
    })
    out.weeks[wk] = merged
  })
  return out
}
