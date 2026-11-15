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
    ['cupPageFindToggle', pageActions, 'Find on page', pageActions.firstElementChild],
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

  const nav = document.getElementById('mobileSearchNav')
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
