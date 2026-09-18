// DOM emitter + reader for the "Review pending SRT edits" dialog. The
// renderer emits the rows with data-file / data-line attributes so the
// dialog's action buttons (Discard, Push) can read back which rows are
// checked plus any in-dialog textarea tweaks.
//
// Two halves:
//   - renderSrtEditsReviewList(vm, mountEl)
//   - collectSrtEditsByCheckbox(mountEl, checked)
// They share the row shape ('.srt-review-row[data-file][data-line]').
//
// Each file group also carries its own checkbox in the header, so a whole
// file's edits can be taken or left in one click. setSrtEditsGroupChecked and
// syncSrtEditsGroupBoxes keep that header box and its rows agreeing.

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
    // The whole header is the label, so tapping the file name takes or leaves
    // every edit in that file — the row-by-row boxes stay available below.
    const headLabel = document.createElement('label')
    headLabel.className = 'srt-review-file-keep-wrap'
    const headBox = document.createElement('input')
    headBox.type = 'checkbox'
    headBox.className = 'srt-review-file-keep'
    headBox.checked = true
    const headName = document.createElement('span')
    headName.className = 'srt-review-file-name'
    headName.textContent = group.headLabel
    headLabel.appendChild(headBox)
    headLabel.appendChild(headName)
    head.appendChild(headLabel)
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

  syncSrtEditsGroupBoxes(mountEl)
}

// Tick or untick every edit in one file group.
export function setSrtEditsGroupChecked(groupEl, checked) {
  if (!groupEl) return
  groupEl.querySelectorAll('.srt-review-keep').forEach(cb => { cb.checked = !!checked })
}

// Bring every header box back in line with its rows: ticked when the whole
// file is taken, clear when none of it is, indeterminate in between. A group
// with no rows left reads as unticked rather than as "all of nothing".
export function syncSrtEditsGroupBoxes(mountEl) {
  if (!mountEl) return
  mountEl.querySelectorAll('.srt-review-file').forEach(groupEl => {
    const head = groupEl.querySelector('.srt-review-file-keep')
    if (!head) return
    const rows = groupEl.querySelectorAll('.srt-review-keep')
    const checked = Array.prototype.filter.call(rows, cb => cb.checked).length
    head.checked = rows.length > 0 && checked === rows.length
    head.indeterminate = checked > 0 && checked < rows.length
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
