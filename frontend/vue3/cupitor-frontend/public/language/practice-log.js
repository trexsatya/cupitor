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

export const PRACTICE_LOG_UNITS = [
  { value: '', label: 'No target unit', short: '%' },
  { value: 'pages', label: 'Pages', short: 'pages' },
  { value: 'minutes', label: 'Minutes', short: 'min' },
  { value: 'sessions', label: 'Sessions', short: 'sessions' },
]

export function hasPracticeLogEntry(record) {
  if (record?.deleted) return false
  return !!((typeof record?.goal === 'string' && record.goal.trim()) ||
    (typeof record?.notes === 'string' && record.notes.trim()) ||
    (record?.status && record.status !== 'not_started') || record?.progress > 0)
}

export function practiceLogMeasure(record = {}) {
  const unit = PRACTICE_LOG_UNITS.find(item => item.value === record.unit) || PRACTICE_LOG_UNITS[0]
  const target = Number.isSafeInteger(record.target) && record.target > 0 && unit.value ? record.target : null
  const progress = Number.isSafeInteger(record.progress) && record.progress >= 0
    ? Math.min(record.progress, target ? Number.MAX_SAFE_INTEGER : 100) : null
  const percent = progress === null ? (record.status === 'done' ? 100 : null)
    : target ? Math.min(100, 100 * (progress / target)) : progress
  return {
    unit: target ? unit.value : '', unitLabel: target ? unit.short : '%', target, progress, percent,
    label: progress === null ? '' : target ? `${progress} / ${target} ${unit.short}` : `${progress}%`,
  }
}

export function updatePracticeProgress(record, progress, { skip = false, updatedAt = Date.now() } = {}) {
  const { target } = practiceLogMeasure(record)
  const value = Math.min(target ? Number.MAX_SAFE_INTEGER : 100, Math.max(0, Math.round(progress)))
  if (!Number.isSafeInteger(value)) return record
  const status = skip ? 'skipped' : value >= (target || 100) ? 'done' : value > 0 ? 'in_progress' : 'not_started'
  return { ...record, progress: value, status, updatedAt }
}

export function updatePracticeGoal(record, { goal, unit, target }, updatedAt = Date.now()) {
  if (record.deleted) record = {}
  const previous = practiceLogMeasure(record)
  const { unit: nextUnit, target: nextTarget } = practiceLogMeasure({ unit, target })
  const next = { ...record, goal: goal.trim(), notes: '', unit: nextUnit, target: nextTarget, updatedAt }
  if (previous.unit !== nextUnit) return updatePracticeProgress(next, 0, { updatedAt })
  if (previous.progress !== null || !hasPracticeLogEntry(record)) {
    return updatePracticeProgress(next, previous.progress ?? 0, { skip: record.status === 'skipped', updatedAt })
  }
  return next
}

export function defaultPracticeLog() {
  return {
    customItems: PRACTICE_LOG_DEFAULT_ITEMS.slice(),
    weeks: {},
    weekNotes: {},
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
  if (!j.weekNotes || typeof j.weekNotes !== 'object' || Array.isArray(j.weekNotes)) j.weekNotes = {}
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

export function practiceLogWeekLabels(data) {
  return [...new Set([...Object.keys(data?.weeks || {}), ...Object.keys(data?.weekNotes || {})])]
}

export function practiceLogWeekNote(data, weekLabel) {
  const text = data?.weekNotes?.[weekLabel]?.text
  return typeof text === 'string' ? text.trim() : ''
}

// Drop weeks older than the retention horizon (keep the most-recent N by
// ISO label, which sorts chronologically). Always keeps `currentLabel`
// and `nextLabel` even if N is tiny — those are the actively edited rows.
// Mutates `data` in-place and returns it.
export function prunePracticeLogWeeks(data, currentLabel, nextLabel) {
  const N = Math.max(1, parseInt(data.historyRetainWeeks, 10) || PRACTICE_LOG_DEFAULT_RETAIN)
  const labels = practiceLogWeekLabels(data).sort()
  const oldest = labels.filter(label => (!currentLabel || label < currentLabel) &&
    (Object.hasOwn(data.weeks || {}, label) || practiceLogWeekNote(data, label))).at(-N)
  if (!oldest) return data
  for (const label of labels) {
    if (label < oldest && label !== nextLabel) {
      delete data.weeks?.[label]
      delete data.weekNotes?.[label]
    }
  }
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
// content for legacy records; new records use the most recent edit time.
export function mergePracticeLog(remote, local) {
  if (!remote) return local
  if (!local)  return remote
  const history = (remote.historyUpdatedAt || 0) > (local.historyUpdatedAt || 0) ? remote : local
  const out = {
    lastWeeklyUpdate: [remote.lastWeeklyUpdate, local.lastWeeklyUpdate].filter(Boolean).sort().at(-1),
    goals: { ...remote.goals },
    reminders: (remote.reminders?.updatedAt || 0) > (local.reminders?.updatedAt || 0)
      ? remote.reminders : local.reminders,
    customItems: [],
    weeks: {},
    historyRetainWeeks: history.historyUpdatedAt ? history.historyRetainWeeks : Math.max(
      parseInt(remote.historyRetainWeeks, 10) || PRACTICE_LOG_DEFAULT_RETAIN,
      parseInt(local.historyRetainWeeks,  10) || PRACTICE_LOG_DEFAULT_RETAIN
    )
  }
  for (const [id, goal] of Object.entries(local.goals || {})) {
    const other = out.goals[id]
    if (!other) {
      out.goals[id] = goal
      continue
    }
    const latest = (other.updatedAt || 0) > (goal.updatedAt || 0) ? other : goal
    const updates = new Map([...other.updates, ...goal.updates].map(update => [update.id, update]))
    out.goals[id] = { ...latest, updates: [...updates.values()].sort((a, b) => a.date.localeCompare(b.date)) }
  }
  if (history.historyUpdatedAt) out.historyUpdatedAt = history.historyUpdatedAt
  const activities = new Map(Object.entries(remote.activityEdits || {}))
  for (const [name, edit] of Object.entries(local.activityEdits || {})) {
    if ((edit.updatedAt || 0) >= (activities.get(name)?.updatedAt || 0)) activities.set(name, edit)
  }
  if (activities.size) out.activityEdits = Object.fromEntries(activities)
  out.customItems = [...new Set([...(remote.customItems || []), ...(local.customItems || [])])]
    .filter(name => name && activities.get(name)?.available !== false)
  for (const [name, edit] of activities) {
    if (edit.available && !out.customItems.includes(name)) out.customItems.push(name)
  }
  // A cleared note retains its edit time so an older copy cannot restore it.
  const weekNotes = new Map(Object.entries(remote.weekNotes || {}))
  for (const [week, note] of Object.entries(local.weekNotes || {})) {
    if ((note?.updatedAt || 0) >= (weekNotes.get(week)?.updatedAt || 0)) weekNotes.set(week, note)
  }
  out.weekNotes = Object.fromEntries(weekNotes)
  const weekKeys = new Set([...Object.keys(remote.weeks || {}), ...Object.keys(local.weeks || {})])
  weekKeys.forEach(wk => {
    const r = (remote.weeks && remote.weeks[wk]) || {}
    const l = (local.weeks  && local.weeks[wk])  || {}
    const merged = {}
    const itemKeys = new Set([...Object.keys(r), ...Object.keys(l)])
    itemKeys.forEach(it => {
      const rv = Object.hasOwn(r, it) ? r[it] || {} : {}
      const lv = Object.hasOwn(l, it) ? l[it] || {} : {}
      const latest = (lv.updatedAt || 0) >= (rv.updatedAt || 0) ? lv : rv
      const measured = latest.updatedAt ? latest : Object.hasOwn(lv, 'progress') ? lv
        : Object.hasOwn(rv, 'progress') ? rv : null
      if (measured) {
        Object.defineProperty(merged, it, { value: { ...measured }, enumerable: true, writable: true, configurable: true })
        return
      }
      const lvHas = (lv.status && lv.status !== 'not_started') || (lv.notes && lv.notes.trim())
      const rvHas = (rv.status && rv.status !== 'not_started') || (rv.notes && rv.notes.trim())
      const entry = lvHas ? { status: lv.status || 'not_started', notes: lv.notes || '' }
        : rvHas ? { status: rv.status || 'not_started', notes: rv.notes || '' }
          : { status: 'not_started', notes: '' }
      if (Object.hasOwn(lv, 'goal') || Object.hasOwn(rv, 'goal')) entry.goal = lv.goal ?? rv.goal
      Object.defineProperty(merged, it, { value: entry, enumerable: true, writable: true, configurable: true })
    })
    out.weeks[wk] = merged
  })
  if (!Object.keys(out.goals).length && !remote.goals && !local.goals) delete out.goals
  if (!out.lastWeeklyUpdate) delete out.lastWeeklyUpdate
  if (!out.reminders) delete out.reminders
  return out
}

export function practiceWeekDates(label) {
  const match = /^(\d{4})-W(\d{2})$/.exec(label)
  if (!match) return { week: label, year: '', range: label, fullRange: '' }
  const monday = new Date(Date.UTC(Number(match[1]), 0, 4))
  monday.setUTCDate(4 - ((monday.getUTCDay() + 6) % 7) + (Number(match[2]) - 1) * 7)
  const sunday = new Date(monday)
  sunday.setUTCDate(sunday.getUTCDate() + 6)
  const format = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const start = monday.getUTCMonth() === sunday.getUTCMonth() ? monday.getUTCDate() : format.format(monday)
  return {
    week: String(Number(match[2])), year: match[1],
    range: `${start}–${format.format(sunday)}`, fullRange: `${format.format(monday)} – ${format.format(sunday)}`,
  }
}

export function practiceWeekTitle(label) {
  const { fullRange } = practiceWeekDates(label)
  return fullRange ? `Week ${label} · ${fullRange}` : `Week ${label}`
}
