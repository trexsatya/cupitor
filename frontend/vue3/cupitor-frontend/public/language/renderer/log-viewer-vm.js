// View-model for the Log Viewer dialog. Pure functions only: given the
// log buffer (the `[{t, level, msg}, ...]` array from log-buffer.js) and
// the current filter inputs, produce the rendered row set / clipboard
// text / formatted timestamps. No DOM, no jQuery, no globals.
//
// The DOM emitter lives next door in log-viewer-render.js; the
// open/close dialog shim stays in language.js.

// Lower number = higher severity. `'all'` (the default filter) bypasses
// the severity gate entirely. Unknown levels fall back to 99 (less
// severe than every named level) so a stray entry never disappears.
export const LOG_LEVEL_ORDER = { error: 0, warn: 1, info: 2, log: 3, debug: 4 }

// Apply the active filters and return the rows that should be rendered.
//   buffer  — full log buffer (the array, not necessarily windowed)
//   level   — 'all' | 'error' | 'warn' | 'info' | 'log' | 'debug'.
//             Picks the named threshold and INCLUDES everything more
//             severe (lower order number). Unknown levels behave as 'all'.
//   query   — substring filter applied to e.msg, case-insensitive.
export function filterLogs(buffer, { level = 'all', query = '' } = {}) {
  const list = Array.isArray(buffer) ? buffer : []
  const minOrd = level === 'all' || !(level in LOG_LEVEL_ORDER) ? 99 : LOG_LEVEL_ORDER[level]
  const q = String(query || '').toLowerCase()
  return list.filter(e => {
    if (!e) return false
    const ord = LOG_LEVEL_ORDER[e.level] != null ? LOG_LEVEL_ORDER[e.level] : 99
    if (level !== 'all' && level in LOG_LEVEL_ORDER && ord > minOrd) return false
    if (q && !String(e.msg || '').toLowerCase().includes(q)) return false
    return true
  })
}

// Format a millisecond timestamp as "HH:MM:SS.mmm" UTC — matches the
// substring slice that the original inline render used.
export function formatLogTimestamp(t) {
  return new Date(t).toISOString().substring(11, 23)
}

// Build the "copy to clipboard" representation: one ISO-timestamped line
// per entry. Includes the full level + message even when the on-screen
// filter would have hidden them, on the theory that the user copies in
// order to paste somewhere they can grep themselves.
export function formatLogsAsText(buffer) {
  return (Array.isArray(buffer) ? buffer : []).map(e =>
    `${new Date(e.t).toISOString()} [${e.level}] ${e.msg}`
  ).join('\n')
}
