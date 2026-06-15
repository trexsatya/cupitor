// DOM emitter for the Practice Log dialog. Two top-level renderers, one
// per tab. Both take a plain mount node and a callbacks bag — the
// wrapper in language.js owns state mutation + persistence.
//
// Plan tab callbacks:
//   onStatusChange(itemName, newStatusValue)
//   onNotesChange(itemName, newNotes)
//   onRemoveItem(itemName)

import { PRACTICE_LOG_STATUSES } from '../practice-log.js'

// Render the active week's Plan list. `weekLabelEl` (optional) lets the
// caller pass a separate node where "Week 2026-W24" is placed; pass null
// to skip the label update.
export function renderPracticeLogPlan(vm, mountEl, callbacks = {}, weekLabelEl = null) {
  if (weekLabelEl) weekLabelEl.textContent = `Week ${vm.weekLabel}`
  if (!mountEl) return
  while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild)

  ;(vm.items || []).forEach(item => {
    const row = document.createElement('div')
    row.className = 'practice-log-item'
    row.setAttribute('data-item-name', item.name)

    const nameDiv = document.createElement('div')
    nameDiv.className = 'practice-log-item-name'
    nameDiv.textContent = item.name
    row.appendChild(nameDiv)

    const select = document.createElement('select')
    select.className = 'practice-log-item-status'
    PRACTICE_LOG_STATUSES.forEach(s => {
      const opt = document.createElement('option')
      opt.value = s.value
      opt.textContent = s.label
      if (s.value === item.status) opt.selected = true
      select.appendChild(opt)
    })
    select.addEventListener('change', () => {
      if (callbacks.onStatusChange) callbacks.onStatusChange(item.name, select.value)
    })
    row.appendChild(select)

    const notes = document.createElement('textarea')
    notes.className = 'practice-log-item-notes'
    notes.placeholder = 'Notes (resources, time spent, what worked)…'
    notes.value = item.notes
    notes.addEventListener('input', () => {
      if (callbacks.onNotesChange) callbacks.onNotesChange(item.name, notes.value)
    })
    row.appendChild(notes)

    if (!item.isDefault) {
      const rm = document.createElement('button')
      rm.type = 'button'
      rm.className = 'practice-log-item-remove'
      rm.title = 'Remove this custom item'
      rm.textContent = '×'
      rm.addEventListener('click', () => {
        if (callbacks.onRemoveItem) callbacks.onRemoveItem(item.name)
      })
      row.appendChild(rm)
    } else {
      // Empty placeholder keeps the row's grid column alignment stable.
      row.appendChild(document.createElement('div'))
    }

    mountEl.appendChild(row)
  })
}

// Render the History tab into `mountEl`. Notes are collapsed by default
// behind a 💬 toggle button so the list stays compact.
export function renderPracticeLogHistory(vm, mountEl) {
  if (!mountEl) return
  while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild)

  if (!vm || vm.state === 'empty') {
    const div = document.createElement('div')
    div.style.color = '#888'
    div.style.fontSize = '0.85em'
    div.textContent = 'No history yet — set a plan for the current or next week and it will show up here.'
    mountEl.appendChild(div)
    return
  }

  vm.weeks.forEach(week => {
    const w = document.createElement('div')
    w.className = 'practice-log-history-week'

    const hdr = document.createElement('div')
    hdr.className = 'practice-log-history-week-header'
    hdr.textContent = `Week ${week.label}`
    w.appendChild(hdr)

    if (week.empty) {
      const empty = document.createElement('div')
      empty.className = 'practice-log-history-item'
      empty.style.color = '#aaa'
      empty.textContent = '(no items)'
      w.appendChild(empty)
    } else {
      week.items.forEach(it => {
        const row = document.createElement('div')
        row.className = 'practice-log-history-item'

        const status = document.createElement('span')
        status.className = `pl-status ${it.statusCls}`
        status.textContent = it.statusLabel
        row.appendChild(status)

        const name = document.createElement('span')
        name.textContent = ' · ' + it.name
        row.appendChild(name)

        if (it.notes) {
          const toggle = document.createElement('button')
          toggle.type = 'button'
          toggle.className = 'practice-log-notes-toggle'
          toggle.title = 'Show notes'
          toggle.textContent = '💬'

          const notesDiv = document.createElement('div')
          notesDiv.className = 'practice-log-history-notes'
          notesDiv.style.display = 'none'
          notesDiv.textContent = it.notes

          toggle.addEventListener('click', e => {
            e.preventDefault()
            const showing = notesDiv.style.display !== 'none'
            notesDiv.style.display = showing ? 'none' : ''
            toggle.title = showing ? 'Show notes' : 'Hide notes'
          })

          row.appendChild(toggle)
          row.appendChild(notesDiv)
        }

        w.appendChild(row)
      })
    }

    mountEl.appendChild(w)
  })
}
