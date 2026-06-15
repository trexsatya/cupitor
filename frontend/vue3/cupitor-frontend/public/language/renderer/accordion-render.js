// Plain-DOM accordion wiring used by the search-results pane and the
// duplicate-SRTs dialog. Idempotent: each `.accordion` / `.l-accordion`
// gets its click handler attached exactly once (guarded by a data
// attribute), so calling renderAccordions twice on the same root won't
// double-fire handlers.
//
// Layout convention: an `.accordion` (or `.l-accordion`) element is a
// header; every following sibling up to the next accordion header (or
// `.accordion-end` marker) becomes its panel. If there's more than one
// sibling, they're collected into an auto-created `.autocreated-panel`
// wrapper so we can show/hide the whole block with `display: block/none`.

function isAccordion(el) {
  return el && el.classList && el.classList.contains('accordion')
}
function isAccordionEnd(el) {
  return el && el.classList && el.classList.contains('accordion-end')
}

function fixAccordionPanel(headerEl) {
  if (headerEl.hasAttribute('accordion-rendered')) return
  let cur = headerEl.nextElementSibling
  const siblings = []
  while (cur) {
    if (isAccordion(cur) || isAccordionEnd(cur)) break
    siblings.push(cur)
    cur = cur.nextElementSibling
  }
  if (siblings.length > 1) {
    const wrap = document.createElement('div')
    wrap.classList.add('autocreated-panel')
    siblings.forEach(s => wrap.appendChild(s))
    headerEl.insertAdjacentElement('afterend', wrap)
  }
  headerEl.setAttribute('accordion-rendered', 'true')
}

function getAccordionGroup(root) {
  const langGroup = root.getElementsByClassName('l-accordion')
  return langGroup.length ? langGroup : root.getElementsByClassName('accordion')
}

// Wire (or re-wire) every accordion under `root`. Adds alternating
// even/odd classes, ensures each header has a sibling-panel wrapper, and
// attaches a single-open click toggle. Finally, programmatically clicks
// the first result-bearing `.l-accordion` so the search lands on a panel
// that actually has matches.
export function renderAccordions(root) {
  root = root || document
  // Top-align table cells — search results lay out matches in a <table>.
  Array.from(root.getElementsByTagName('td')).forEach(td => {
    td.style.verticalAlign = 'top'
  })

  const group = getAccordionGroup(root)
  for (let i = 0; i < group.length; i++) {
    group[i].classList.add(i % 2 === 0 ? 'even' : 'odd')
    if (group[i].dataset.accordion_rendered === 'true') continue
    fixAccordionPanel(group[i])
    group[i].addEventListener('click', function () {
      // Single-open: collapse every other open panel in this group first.
      const peers = getAccordionGroup(root)
      for (const other of peers) {
        if (other === this) continue
        other.classList.remove('active')
        const op = other.nextElementSibling
        if (op && op.classList && op.classList.contains('autocreated-panel')) {
          op.style.display = 'none'
        }
      }
      this.classList.toggle('active')
      const panel = this.nextElementSibling
      if (panel && panel.style.display === 'block') {
        panel.style.display = 'none'
      } else if (panel) {
        panel.style.display = 'block'
      }
    })
  }

  // Auto-open the first useful result. l-accordion is the language-results
  // bucket; skip the "no-result" and "non-srt" buckets which we never
  // want to land on.
  const candidates = Array.from(root.getElementsByClassName('l-accordion'))
    .filter(it => !it.classList.contains('no-result') && !it.classList.contains('non-srt'))
  if (candidates.length) candidates[0].click()
}
