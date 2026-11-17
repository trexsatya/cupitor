import { fromSeconds } from '../time-format.js'

export function subtitleTimestampButton({ start, stop }, onSeek) {
  if (!onSeek || !Number.isFinite(start) || !Number.isFinite(stop) || start < 0 || stop <= start) return null
  const label = time => {
    const ms = Math.round(time * 1000)
    const fraction = ms % 1000
    return fromSeconds(ms / 1000) + (fraction ? '.' + String(fraction).padStart(3, '0') : '')
  }
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'study-srt-timestamp'
  button.textContent = '[' + label(start) + '-' + label(stop) + ']'
  button.title = 'Play this subtitle line'
  button.addEventListener('click', event => {
    event.stopPropagation()
    onSeek({ start, stop })
  })
  return button
}

// DOM emitter for the playing-subtitles list and the now-playing banner
// per-item text updates. The banner's static skeleton + one-shot click
// wiring (gap stepper) stays in language.js — this module only handles
// the per-render updates the banner needs to do on every item.

// Render the playing-subtitles list into `mountEl`. Each row gets a
// `data-line-i` attribute so the live-playhead refresh can find the row
// for the new active index without rebuilding everything.
//
// `vm` shape comes from buildPlayingSubsVM. Handles all three states:
//   'no-primary' → "Subtitles unavailable" placeholder
//   'no-match'   → "Matched line not found" placeholder
//   'ok'         → full row list
export function renderPlayingSubsList(vm, mountEl, onSeek) {
  if (!mountEl) return
  while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild)

  if (!vm || vm.state === 'no-primary') {
    const err = document.createElement('div')
    err.className = 'rec-ps-err'
    err.textContent = 'Subtitles unavailable for this video.'
    mountEl.appendChild(err)
    return
  }
  if (vm.state === 'no-match') {
    const err = document.createElement('div')
    err.className = 'rec-ps-err'
    err.textContent = 'Matched line not found in subtitle file.'
    mountEl.appendChild(err)
    return
  }

  const list = document.createElement('div')
  list.className = 'rec-ps-list'
  vm.rows.forEach(row => {
    const $row = document.createElement('div')
    $row.className = 'rec-ps-row'
    $row.setAttribute('data-line-i', String(row.i))
    if (row.active) $row.classList.add('rec-ps-active')

    const main = document.createElement('div')
    main.className = 'rec-ps-main'
    if (row.mainLanguage) {
      main.lang = row.mainLanguage
      main.dataset.subtitleLanguage = row.mainLanguage.toUpperCase()
    }
    if (row.highlightHtml) {
      // Trusted: highlightWordHtml HTML-escapes its input and emits only
      // <mark> wrappers, so this is safe.
      main.innerHTML = row.highlightHtml
    } else {
      main.textContent = row.mainText
    }
    const timestamp = subtitleTimestampButton(row, onSeek)
    if (timestamp) main.prepend(timestamp, ' ')
    $row.appendChild(main)

    if (row.secText) {
      const sec = document.createElement('div')
      sec.className = 'rec-ps-sec'
      if (row.secLanguage) {
        sec.lang = row.secLanguage
        sec.dataset.subtitleLanguage = row.secLanguage.toUpperCase()
      }
      sec.textContent = row.secText
      $row.appendChild(sec)
    }

    list.appendChild($row)
  })
  mountEl.appendChild(list)
}

// Update the now-playing banner's mutable fields from the VM. The
// caller has already built the static skeleton (top row + details
// container) and wired the gap stepper buttons.
//
// `mountEl` is the #recPlayingBanner element. `wordEl` is the (separate)
// big-word display — optional; pass null to skip the update.
export function updatePlayingBanner(vm, mountEl, wordEl) {
  if (mountEl) {
    const setText = (sel, value) => {
      const el = mountEl.querySelector(sel)
      if (el) el.textContent = value
    }
    setText('.rec-pb-count', vm.progressText)
    setText('.rec-pb-head', vm.headText)
    setText('.rec-pb-meta', vm.metaText)
    setText('.rec-pb-gap-val', vm.gapLabel)
    const bar = mountEl.querySelector('.rec-pb-bar')
    if (bar) bar.style.width = '0%'
  }
  if (wordEl) wordEl.textContent = vm.word
}
