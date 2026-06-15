// In-memory ring buffer for console.* output. Used by the in-app Log
// Viewer so a mobile user can see what would otherwise only be visible
// in DevTools.
//
// Each entry is `{ t: number, level: string, msg: string }`. Messages
// are pre-serialised so the buffer holds no live references to the
// arguments — important for retained Error objects and DOM nodes.

export const LOG_BUFFER_MAX = 500

// Stringify one console.* argument for storage. Errors get their stack
// (or name+message) so the trace survives across re-renders. Strings
// pass through unchanged; everything else round-trips through
// JSON.stringify with a String() fallback for cyclic objects.
export function serializeLogArg(a) {
  if (a instanceof Error) return a.stack || (a.name + ': ' + a.message)
  if (typeof a === 'string') return a
  try { return JSON.stringify(a) } catch (_) { return String(a) }
}

// Append `entry` to `buffer`, trimming the head so length stays ≤ max.
// Mutates `buffer` in place and returns it for chaining.
export function pushLog(buffer, entry, max = LOG_BUFFER_MAX) {
  buffer.push(entry)
  if (buffer.length > max) {
    buffer.splice(0, buffer.length - max)
  }
  return buffer
}

// Install a console-tap on `consoleObj` that mirrors every log/info/warn/
// error/debug call into `buffer`. Returns an uninstaller that restores
// the original methods. `nowFn` (defaults to Date.now) lets tests pin
// timestamps; `levels` lets callers narrow the patched set.
export function installConsoleTap(buffer, consoleObj, opts = {}) {
  const levels = opts.levels || ['log', 'info', 'warn', 'error', 'debug']
  const max = opts.max || LOG_BUFFER_MAX
  const now = opts.now || (() => Date.now())
  const originals = {}
  levels.forEach(level => {
    const orig = consoleObj[level] ? consoleObj[level].bind(consoleObj) : null
    originals[level] = consoleObj[level]
    consoleObj[level] = function (...args) {
      try {
        pushLog(buffer, {
          t: now(),
          level,
          msg: args.map(serializeLogArg).join(' '),
        }, max)
      } catch (_) {}
      if (orig) orig(...args)
    }
  })
  return function uninstall() {
    levels.forEach(level => { consoleObj[level] = originals[level] })
  }
}

// Build a log entry for an uncaught error event. Pulled out as its own
// helper so the window.error / unhandledrejection listeners share the
// same shape.
export function makeWindowErrorEntry(e, now = Date.now) {
  return {
    t: now(),
    level: 'error',
    msg: '[window.error] ' + (e.message || e.type) +
      (e.filename ? ` @ ${e.filename}:${e.lineno}:${e.colno}` : '') +
      (e.error && e.error.stack ? '\n' + e.error.stack : ''),
  }
}

export function makeUnhandledRejectionEntry(e, now = Date.now) {
  const r = e && e.reason
  return {
    t: now(),
    level: 'error',
    msg: '[unhandledrejection] ' + (r && r.stack ? r.stack : serializeLogArg(r)),
  }
}
