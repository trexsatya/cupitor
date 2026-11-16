// Record load before jQuery's ready callback wires the toolbar.
const pageLoadedAt = new Promise(resolve => {
  const record = () => resolve(performance.now())
  if (document.readyState === 'complete') record()
  else window.addEventListener('load', record, { once: true })
})

// Keep the same toolbar controls, IDs, and handlers in both layouts.
export function wireMobileSearch() {
  const mobile = window.matchMedia('(max-width: 999px)')
  const tools = document.getElementById('mobileSearchTools')
  const help = document.getElementById('searchHelp')
  const pageActions = document.getElementById('mobilePageActions')
  const options = document.getElementById('mobileSearchOptions')
  const placements = [
    ['searchSourceChips', document.getElementById('mobileSearchSources')],
    ['headerAddToVocabBtn', document.getElementById('mobileStudyActions')],
    ['vocabularyEditOption', document.getElementById('mobileStudyActions')],
    ['cupPageFindToggle', pageActions, 'Find on page', pageActions.firstElementChild],
    ['vocabularyLanguages', options],
    ['searchVocabularyMenu', options],
    ['toggleMainControl', options, 'Toggle search controls'],
    ['toggleResultContainer', options, 'Toggle results'],
    ['toggleMediaPanelBtn', pageActions, 'Media'],
    ['toggleMediaContainer', pageActions, 'Toggle video'],
    ['toggleSettingsPanelBtn', document.getElementById('mobileSettingsAction'), 'Settings'],
  ].map(([id, target, label, before]) => {
    const control = document.getElementById(id)
    const anchor = document.createComment(id)
    control.before(anchor)
    if (label) {
      const text = document.createElement('span')
      text.className = 'mobile-action-label'
      text.textContent = label
      control.append(text)
    }
    return { control, target, anchor, before }
  })

  function updateLayout() {
    if (!mobile.matches && tools.open) tools.close()
    for (const { control, target, anchor, before } of placements) {
      if (mobile.matches) target.insertBefore(control, before || null)
      else anchor.after(control)
    }
    document.getElementById('searchVocabularyMenu').style.display = 'none'
    document.getElementById('searchVocabularyByPrefixBtn').setAttribute('aria-expanded', 'false')
    document.querySelectorAll('#vocabularyResult .search-related').forEach(group => { group.open = !mobile.matches })
  }
  mobile.addEventListener('change', updateLayout)
  updateLayout()

  for (const [dialog, openerId] of [[tools, 'mobileSearchToolsBtn'], [help, 'searchHelpBtn']]) {
    const opener = document.getElementById(openerId)
    opener.addEventListener('click', () => {
      if (!dialog.open) dialog.showModal()
    })
    dialog.querySelector('[data-search-close]').addEventListener('click', () => dialog.close())
    dialog.addEventListener('click', e => {
      if (e.target !== dialog) return
      const box = dialog.getBoundingClientRect()
      if (e.clientX < box.left || e.clientX > box.right ||
          e.clientY < box.top || e.clientY > box.bottom) dialog.close()
    })
  }

  tools.addEventListener('click', e => {
    const action = e.target.closest('button')
    if (!action || action.disabled || action.hasAttribute('data-search-close')) return
    // End the native modal before an action opens another dialog or moves focus.
    tools.close()
    document.getElementById('mobileSearchToolsBtn').focus({ preventScroll: true })
  }, true)

  wireVocabularyPicker()
  watchSearchKeyboard(mobile)
  const nav = document.getElementById('mobileSearchNav')
  pageLoadedAt.then(loadedAt => {
    const delay = Math.max(0, 10000 - (performance.now() - loadedAt))
    setTimeout(() => nav.classList.add('search-nav-icons-only'), delay)
  })
  new ResizeObserver(() => {
    const height = nav.getBoundingClientRect().height
    if (height) document.documentElement.style.setProperty('--mobile-search-nav-height', `${height}px`)
  }).observe(nav)
  nav.addEventListener('click', e => {
    const action = e.target.closest('[data-search-action]')
    if (action) document.getElementById(action.dataset.searchAction).click()
  })
  document.getElementById('mobileSearchHome').addEventListener('click', e => {
    if (e.detail === 0) document.getElementById('searchText').focus()
    else window.scrollTo(0, 0)
  })
}

function wireVocabularyPicker() {
  const select = document.getElementById('searchedWords')
  const row = select.closest('.lang-select-with-toggle')
  window.jQuery(select)
    .on('select2:opening.mobileSearch', () => row.classList.add('vocabulary-picker-open'))
    .on('select2:close.mobileSearch', () => row.classList.remove('vocabulary-picker-open'))
    .on('select2:open.mobileSearch', () => {
      const dropdown = document.getElementById('select2-searchedWords-results')?.closest('.select2-dropdown')
      dropdown?.classList.add('search-vocabulary-dropdown')
      const search = dropdown?.querySelector('.select2-search__field')
      search?.setAttribute('placeholder', 'Search vocabulary')
      search?.setAttribute('aria-label', 'Search vocabulary')
    })
}

// WebViews can resize the layout viewport for the keyboard. Browsers may
// resize only the visual viewport, so listen to both and account for zoom.
function watchSearchKeyboard(mobile) {
  const touch = window.matchMedia('(pointer: coarse)')
  const viewport = window.visualViewport
  const height = () => viewport ? viewport.height * viewport.scale : window.innerHeight
  let previousWidth = window.innerWidth
  let restingHeight = height()

  function update() {
    const field = document.activeElement
    const editing = mobile.matches && touch.matches && field?.matches(
      'textarea:not([readonly]), [contenteditable]:not([contenteditable="false"]), ' +
      'input:not([readonly]):is([type="text"], [type="search"], [type="url"], [type="email"], ' +
      '[type="tel"], [type="password"], [type="number"], :not([type]))'
    )
    const visibleHeight = height()
    if (previousWidth !== window.innerWidth || !editing || visibleHeight > restingHeight) {
      previousWidth = window.innerWidth
      restingHeight = visibleHeight
    }
    // Minor browser chrome changes should not hide the search navigation.
    document.body.classList.toggle('search-keyboard-open', !!editing && restingHeight - visibleHeight >= 100)
  }

  document.addEventListener('focusin', update)
  document.addEventListener('focusout', () => requestAnimationFrame(update))
  window.addEventListener('resize', update)
  viewport?.addEventListener('resize', update)
}
