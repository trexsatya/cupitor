// DOM emitter for the Rare Words dialog. Three small renderers — list,
// pager, category dropdown — each taking a plain DOM mount node and
// the relevant VM slice. Click behaviour is injected as callbacks so
// the renderers stay free of app state.

// Render the list body (or an empty-state message) into `mountEl`.
// `onItemClick(line)` fires when the user clicks a rare-word button.
export function renderRareWordsList(vm, mountEl, onItemClick) {
  if (!mountEl) return
  while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild)

  if (vm.state === 'empty') {
    const div = document.createElement('div')
    div.className = 'rare-words-empty'
    div.textContent = 'Nothing to show yet — set a threshold and click Scan.'
    mountEl.appendChild(div)
    return
  }
  if (vm.state === 'no-matches') {
    const div = document.createElement('div')
    div.className = 'rare-words-empty'
    div.textContent = 'No matches in this category.'
    mountEl.appendChild(div)
    return
  }

  ;(vm.rows || []).forEach(row => {
    if (row.kind === 'header') {
      const hdr = document.createElement('div')
      hdr.className = 'rare-words-cat-hdr'
      hdr.textContent = row.category
      mountEl.appendChild(hdr)
      return
    }
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'rare-word-item'
    btn.title = `${row.line} — ${row.count} match(es) · ${row.category}`
    const textSpan = document.createElement('span')
    textSpan.className = 'rare-word-text'
    textSpan.textContent = row.line
    const countSpan = document.createElement('span')
    countSpan.className = 'rare-word-count'
    countSpan.textContent = String(row.count)
    btn.appendChild(textSpan)
    btn.appendChild(countSpan)
    btn.addEventListener('click', () => { if (onItemClick) onItemClick(row.line) })
    mountEl.appendChild(btn)
  })
}

// Render the prev/info/next pager controls. No-op when pages <= 1 — the
// caller clears the mount and we leave it empty. Click handlers are
// wrapped with stopPropagation so an outside-click document handler
// doesn't see them as "outside the dialog" and close it.
export function renderRareWordsPager(vm, mountEl, { onPrev, onNext } = {}) {
  if (!mountEl) return
  while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild)
  if (!vm || vm.pages <= 1) return

  const prev = document.createElement('button')
  prev.type = 'button'
  prev.className = 'lang-tool-btn'
  prev.textContent = '‹ Prev'
  prev.disabled = vm.page === 0
  prev.addEventListener('click', e => {
    e.stopPropagation()
    if (onPrev) onPrev()
  })

  const info = document.createElement('span')
  info.className = 'rare-words-pageinfo'
  info.textContent = `Page ${vm.page + 1} / ${vm.pages}`

  const next = document.createElement('button')
  next.type = 'button'
  next.className = 'lang-tool-btn'
  next.textContent = 'Next ›'
  next.disabled = vm.page >= vm.pages - 1
  next.addEventListener('click', e => {
    e.stopPropagation()
    if (onNext) onNext()
  })

  mountEl.appendChild(prev)
  mountEl.appendChild(info)
  mountEl.appendChild(next)
}

// Render the category <select>'s <option> children. Takes the pre-built
// option list from `buildCategoryOptions` and the <select> element. The
// caller restores the previous selection after this returns.
export function renderRareWordsCategorySelect(options, selectEl) {
  if (!selectEl) return
  while (selectEl.firstChild) selectEl.removeChild(selectEl.firstChild)
  ;(options || []).forEach(({ value, label }) => {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = label
    selectEl.appendChild(opt)
  })
}
