// DOM emitter + reader for the "Review pending SRT edits" dialog. The
// renderer emits the rows with data-file / data-line attributes so the
// dialog's action buttons (Discard, Push) can read back which rows are
// checked plus any in-dialog textarea tweaks.
//
// Two halves:
//   - renderSrtEditsReviewList(vm, mountEl)
//   - collectSrtEditsByCheckbox(mountEl, checked)
// They share the row shape ('.srt-review-row[data-file][data-line]').

// Replace `mountEl`'s contents with the file-grouped review rows.
export function renderSrtEditsReviewList(vm, mountEl) {
  if (!mountEl) return
  while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild)

  if (!vm || vm.state === 'empty') {
    const div = document.createElement('div')
    div.className = 'srt-review-empty'
    div.textContent = 'No pending edits.'
    mountEl.appendChild(div)
    return
  }

  vm.groups.forEach(group => {
    const groupDiv = document.createElement('div')
    groupDiv.className = 'srt-review-file'

    const head = document.createElement('div')
    head.className = 'srt-review-file-head'
    head.title = group.filePath
    head.textContent = group.headLabel
    groupDiv.appendChild(head)

    group.lines.forEach(line => {
      const row = document.createElement('div')
      row.className = 'srt-review-row'
      row.setAttribute('data-file', group.filePath)
      row.setAttribute('data-line', line.lineIndex)

      const label = document.createElement('label')
      label.className = 'srt-review-keep-wrap'

      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.className = 'srt-review-keep'
      checkbox.checked = true

      const meta = document.createElement('span')
      meta.className = 'srt-review-meta'
      meta.appendChild(document.createTextNode(`#${line.lineIndex} `))
      const age = document.createElement('span')
      age.className = 'srt-review-age'
      age.textContent = line.ageLabel
      meta.appendChild(age)

      label.appendChild(checkbox)
      label.appendChild(meta)

      const textarea = document.createElement('textarea')
      textarea.className = 'srt-review-text'
      textarea.rows = 2
      textarea.value = line.newText

      row.appendChild(label)
      row.appendChild(textarea)
      groupDiv.appendChild(row)
    })

    mountEl.appendChild(groupDiv)
  })
}

// Read back the rows whose checkbox is in the given state, returning
// (filePath, lineIndex, newText) tuples. `newText` comes from the live
// textarea so the user's in-dialog tweaks are picked up.
export function collectSrtEditsByCheckbox(mountEl, checked) {
  if (!mountEl) return []
  const out = []
  mountEl.querySelectorAll('.srt-review-row').forEach(row => {
    const cb = row.querySelector('.srt-review-keep')
    if (!cb || cb.checked !== !!checked) return
    const textarea = row.querySelector('.srt-review-text')
    out.push({
      filePath: row.getAttribute('data-file'),
      lineIndex: row.getAttribute('data-line'),
      newText: String(textarea ? textarea.value : ''),
    })
  })
  return out
}
