import {
  hasPracticeLogEntry, practiceLogMeasure, practiceWeekDates,
  PRACTICE_LOG_DEFAULT_ITEMS, PRACTICE_LOG_DEFAULT_RETAIN, PRACTICE_LOG_STATUSES,
} from '../practice-log.js'

export function statusInfo(value) {
  return PRACTICE_LOG_STATUSES.find(status => status.value === value) || PRACTICE_LOG_STATUSES[0]
}

function projectItem(name, record) {
  const info = statusInfo(record.status)
  return {
    name, goal: typeof record.goal === 'string' ? record.goal : '',
    notes: typeof record.notes === 'string' ? record.notes.trim() : '',
    status: info.value, statusLabel: info.label, statusCls: info.cls,
    measure: practiceLogMeasure(record),
  }
}

export function buildPracticeLogPlanVM(customItems, weekRecord, weekLabel, isNext = false) {
  const entries = Object.entries(weekRecord || {}).filter(([, record]) => hasPracticeLogEntry(record))
  const planned = new Map(entries)
  const names = [...new Set([...(customItems || []), ...planned.keys()])]
  const items = names.filter(name => planned.has(name)).map(name => ({
    ...projectItem(name, planned.get(name)),
    removable: (customItems || []).includes(name) && !PRACTICE_LOG_DEFAULT_ITEMS.includes(name),
  }))
  return {
    weekLabel, dates: practiceWeekDates(weekLabel), isNext, items,
    done: items.filter(item => item.status === 'done').length,
    available: names.filter(name => !planned.has(name)),
  }
}

export function buildPracticeLogHistoryVM(data, currentWeek = '') {
  const retainWeeks = Math.max(1, parseInt(data?.historyRetainWeeks, 10) || PRACTICE_LOG_DEFAULT_RETAIN)
  const pastLabels = Object.keys(data?.weeks || {}).filter(label => !currentWeek || label < currentWeek)
  const weeks = pastLabels.sort().reverse().flatMap(label => {
    const items = Object.entries(data.weeks[label] || {})
      .filter(([, record]) => hasPracticeLogEntry(record))
      .map(([name, record]) => projectItem(name, record))
    return items.length ? [{
      label, dates: practiceWeekDates(label), items, done: items.filter(item => item.status === 'done').length,
    }] : []
  }).slice(0, retainWeeks)
  return { state: weeks.length ? 'normal' : 'empty', retainWeeks, weeks }
}
