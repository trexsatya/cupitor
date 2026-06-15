// DOM emitter for the Log Viewer body. Takes the pre-filtered row list
// from log-viewer-vm.js plus a plain DOM mount node (NOT a jQuery
// wrapped one — language.js's thin shim unwraps with `[0]`). Uses
// only standard DOM APIs so this stays framework-agnostic and trivial
// to swap for a Vue template later.

import { formatLogTimestamp } from './log-viewer-vm.js'

// Replace the contents of `mountEl` with one `<span class="log-line">`
// per row, then auto-scroll to the bottom (newest entries are most
// relevant). Each row uses textContent — never innerHTML — so a log
// message containing markup can't escape its container.
//
// No-op when mountEl is falsy so the caller can blindly look up
// '#logViewerBody' without guarding.
export function renderLogViewerBody(rows, mountEl) {
  if (!mountEl) return
  while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild)
  ;(rows || []).forEach(e => {
    if (!e) return
    const line = document.createElement('span')
    line.className = 'log-line'
    line.setAttribute('data-level', e.level)

    const tsSpan = document.createElement('span')
    tsSpan.className = 'log-ts'
    tsSpan.textContent = formatLogTimestamp(e.t)

    const lvSpan = document.createElement('span')
    lvSpan.className = 'log-level'
    lvSpan.textContent = e.level

    const msgSpan = document.createElement('span')
    msgSpan.className = 'log-msg'
    msgSpan.textContent = e.msg

    line.appendChild(tsSpan)
    line.appendChild(lvSpan)
    line.appendChild(msgSpan)
    mountEl.appendChild(line)
  })
  mountEl.scrollTop = mountEl.scrollHeight
}
