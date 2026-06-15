// DOM emitter for the captured-subtitles review dialog. Emits one
// `.captured-item` per buffer entry with a "checking…" status, then the
// caller resolves status asynchronously and calls `applyCapturedRowStatus`
// on each row when the response arrives.
//
// Buttons use `data-action="preview" | "push" | "delete"` so callers can
// wire delegated click handlers without rebinding per row.

import { buildCapturedRowVM, pushButtonLabel } from './captured-review-vm.js'

// Replace `mountEl`'s contents with one row per buffer entry. Empty
// buffer → a single-paragraph empty-state placeholder.
export function renderCapturedReviewList(buffer, mountEl) {
  if (!mountEl) return
  while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild)

  if (!Array.isArray(buffer) || buffer.length === 0) {
    const p = document.createElement('p')
    p.textContent = 'No captured subtitles pending.'
    mountEl.appendChild(p)
    return
  }

  buffer.forEach(item => mountEl.appendChild(_buildRow(buildCapturedRowVM(item))))
}

// Update a row's status block after the SRT existence check resolves.
//   state: 'modify' | 'new' | 'error'
//   entryName: index.json entry name (for 'modify')
//
// 'modify' also updates the Push button label to "Push (merge)" to reflect
// what the action will actually do.
export function applyCapturedRowStatus(rowEl, state, entryName) {
  if (!rowEl) return
  const status = rowEl.querySelector('[data-role="srt-status"]')
  if (!status) return
  // Always clear prior content with textContent first.
  while (status.firstChild) status.removeChild(status.firstChild)
  rowEl.setAttribute('data-srt-state', state || '')

  if (state === 'modify') {
    const main = document.createElement('span')
    main.style.color = '#a60'
    main.style.fontWeight = 'bold'
    main.textContent = 'modifying existing SRT'
    const aux = document.createElement('span')
    aux.style.color = '#777'
    aux.textContent = entryName ? ` (${entryName})` : ''
    status.appendChild(main)
    status.appendChild(aux)
    const pushBtn = rowEl.querySelector('button[data-action="push"]')
    if (pushBtn) pushBtn.textContent = pushButtonLabel('modify')
    return
  }
  if (state === 'new') {
    const main = document.createElement('span')
    main.style.color = '#070'
    main.style.fontWeight = 'bold'
    main.textContent = 'new SRT'
    status.appendChild(main)
    return
  }
  // 'error' / unknown
  const main = document.createElement('span')
  main.style.color = '#a00'
  main.textContent = 'status unknown'
  status.appendChild(main)
}

// Build a single .captured-item row using safe DOM APIs (no innerHTML).
function _buildRow(vm) {
  const row = document.createElement('div')
  row.className = 'captured-item'
  row.setAttribute('data-id', vm.id)
  row.style.border = '1px solid #ccc'
  row.style.borderRadius = '4px'
  row.style.padding = '8px'
  row.style.marginBottom = '8px'

  const titleDiv = document.createElement('div')
  titleDiv.style.fontWeight = 'bold'
  titleDiv.textContent = vm.title
  row.appendChild(titleDiv)

  const metaDiv = document.createElement('div')
  metaDiv.style.fontSize = '12px'
  metaDiv.style.color = '#555'
  metaDiv.appendChild(document.createTextNode(
    `${vm.videoId} · ${vm.sourceLang}→${vm.targetLang} · ${vm.srcLineCount} src / ${vm.tgtLineCount} tgt lines · `
  ))
  const status = document.createElement('span')
  status.setAttribute('data-role', 'srt-status')
  status.style.color = '#888'
  status.textContent = 'checking…'
  metaDiv.appendChild(status)
  row.appendChild(metaDiv)

  if (vm.query) {
    const queryDiv = document.createElement('div')
    queryDiv.style.fontSize = '12px'
    queryDiv.appendChild(document.createTextNode('query: '))
    const code = document.createElement('code')
    code.textContent = vm.query
    queryDiv.appendChild(code)
    queryDiv.appendChild(document.createTextNode(' @' + vm.matchIndex))
    row.appendChild(queryDiv)
  }

  const btnRow = document.createElement('div')
  btnRow.style.marginTop = '4px'
  for (const [action, label, color] of [
    ['preview', 'Preview SRT', ''],
    ['push',    pushButtonLabel(),     ''],
    ['delete',  'Delete',       '#a00'],
  ]) {
    const btn = document.createElement('button')
    btn.setAttribute('data-action', action)
    btn.className = 'cap-btn'
    btn.textContent = label
    if (color) btn.style.color = color
    btnRow.appendChild(btn)
  }
  row.appendChild(btnRow)

  const preview = document.createElement('pre')
  preview.setAttribute('data-role', 'preview')
  preview.style.display = 'none'
  preview.style.maxHeight = '240px'
  preview.style.overflow = 'auto'
  preview.style.background = '#f7f7f7'
  preview.style.padding = '6px'
  preview.style.fontSize = '11px'
  preview.style.whiteSpace = 'pre-wrap'
  row.appendChild(preview)

  return row
}
