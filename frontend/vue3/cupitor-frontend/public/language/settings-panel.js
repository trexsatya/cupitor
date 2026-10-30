// Rehome the existing controls, retaining IDs, listeners and bridge visibility.
// The same DOM is reused every time Settings opens.
export function organizeSettingsPanel(panel) {
  if (!panel || panel.dataset.organized) return
  panel.dataset.organized = '1'
  const original = panel.firstElementChild
  const shell = document.createElement('div')
  shell.className = 'settings-shell'
  const nav = document.createElement('nav')
  nav.className = 'settings-nav'
  nav.setAttribute('aria-label', 'Settings sections')
  const mobileLabel = document.createElement('label')
  mobileLabel.className = 'settings-section-picker'
  mobileLabel.textContent = 'Section'
  const select = document.createElement('select')
  select.setAttribute('aria-label', 'Settings section')
  mobileLabel.append(select)
  const content = document.createElement('div')
  content.className = 'settings-content'
  shell.append(nav, mobileLabel, content)
  panel.prepend(shell)
  const sections = new Map()
  const choose = key => {
    for (const [id, entry] of sections) {
      entry.section.hidden = id !== key
      entry.button.setAttribute('aria-current', id === key ? 'page' : 'false')
    }
    select.value = key
  }
  for (const [key, title, hint] of [
    ['tools', 'Tools', 'Vocabulary, recordings and subtitle maintenance.'],
    ['search', 'Search', 'Results, context and vocabulary searches.'],
    ['playback', 'Playback', 'Timing and media for playlist playback.'],
    ['practice', 'Practice', 'Your practice plan and study reminders.'],
    ['data', 'Data & account', 'Account, synchronization and diagnostics.']
  ]) {
    const button = document.createElement('button')
    button.type = 'button'; button.textContent = title
    button.dataset.settingsSection = key
    const section = document.createElement('section')
    section.id = 'settings-section-' + key
    button.setAttribute('aria-controls', section.id)
    const heading = document.createElement('h2'); heading.textContent = title
    const intro = document.createElement('p'); intro.className = 'settings-intro'; intro.textContent = hint
    section.append(heading, intro)
    nav.append(button); content.append(section)
    select.add(new Option(title, key))
    sections.set(key, { section, button })
    button.addEventListener('click', () => choose(key))
  }
  select.addEventListener('change', () => choose(select.value))
  const section = key => sections.get(key).section
  const advanced = new Map()
  const advancedSection = key => {
    if (!advanced.has(key)) {
      const details = document.createElement('details')
      const summary = document.createElement('summary'); summary.textContent = 'Advanced'
      details.append(summary); section(key).append(details); advanced.set(key, details)
    }
    return advanced.get(key)
  }
  const control = (key, id, title, description, more = false) => {
    const input = panel.querySelector('#' + id)
    if (!input) return
    const old = input.closest('.lang-panel-label')
    const row = document.createElement('div'); row.className = 'settings-row'
    const label = document.createElement('label'); label.htmlFor = id
    const name = document.createElement('span'); name.textContent = title
    const help = document.createElement('small'); help.textContent = description
    label.append(name, help)
    const widget = input.closest('.checkbox-wrapper-22') || input
    row.append(label, widget)
    ;(more ? advancedSection(key) : section(key)).append(row)
    old?.remove()
  }
  const controls = [
    ['search', 'numberOfFindingsToShow', 'Results per match', 'How many subtitle examples to show.'],
    ['search', 'numberOfSimilarFindings', 'Similar results', 'Maximum results for Search Similar.'],
    ['search', 'numberOfPrefixFindings', 'Prefix results', 'Extra rows stay available in Different prefixes.'],
    ['search', 'contextLinesBefore', 'Context before', 'Subtitle lines before the matched line.'],
    ['search', 'contextLinesAfter', 'Context after', 'Subtitle lines after the matched line.'],
    ['search', 'toggleClearTextOnClickCheckbox', 'Clear on click', 'Clear the search text when clicked.'],
    ['search', 'toggleAutoPrefixSearchCheckbox', 'Automatic prefix search', 'Search vocabulary with every text search.'],
    ['search', 'toggleAutoLibrarySearchCheckbox', 'Automatic book search', 'Also search your library in the Cupitor app.'],
    ['search', 'clipGapThresholdSec', 'Subtitle gap (seconds)', 'Stop extending clips across larger gaps.', true],
    ['search', 'clipMaxDurationSec', 'Maximum clip (seconds)', 'Limit automatically built practice clips.', true],
    ['search', 'minWordsAround', 'Words around a match', 'Context for automatic random captures.', true],
    ['playback', 'recPlayGapSeconds', 'Between cards (seconds)', 'Time to read and recall before the next card.'],
    ['playback', 'recPlaySrcTgtGapSeconds', 'Source → target (seconds)', 'Leave empty to use the gap between cards.'],
    ['playback', 'recPlayYouTubeClipSeconds', 'Untimed YouTube clip (seconds)', 'Used when a link has no end timestamp.'],
    ['playback', 'recManualPlaybackMode', 'Cards with a link and recordings', 'Choose which media to play when a card has both.'],
    ['practice', 'practiceRevealMode', 'Answer reveal', 'How the answer appears during Practice.']
  ]
  controls.forEach(args => control(...args))
  const actions = (key, ids) => {
    const box = document.createElement('div'); box.className = 'settings-actions'
    ids.forEach(id => { const el = panel.querySelector('#' + id); if (el) box.append(el) })
    section(key).append(box)
  }
  actions('search', ['searchChannelsBtn'])
  actions('playback', ['openMusicPanel'])
  actions('practice', ['practiceLogSettingsBtn', 'notifBellWrap', 'notifSettingsBtn', 'studyCallsBtn'])
  const shortcuts = panel.querySelector('.keyboard-shortcuts-btn')
  if (shortcuts) section('search').append(shortcuts)
  actions('tools', ['addToVocabBtn', 'saveStarredLinesBtn', 'reviewCapturedBtn'])
  const recording = panel.querySelector('#recStartBtn')?.closest('.lang-panel-label')
  if (recording) { recording.classList.add('settings-recording'); section('tools').append(recording) }
  const maintenance = document.createElement('div'); maintenance.className = 'settings-actions'
  panel.querySelectorAll('#manageMenu .manage-item').forEach(button => maintenance.append(button))
  section('tools').append(maintenance)
  const searches = panel.querySelector('#searchesControl')
  if (searches) section('search').append(searches)
  const footer = panel.querySelector('#settingsFooter')
  if (footer) section('data').append(footer)
  // Retain any controls added by older bundles or integrations.
  original.querySelector('.manage-wrap')?.remove()
  original.className = 'settings-extra'
  section('tools').append(original)
  const done = document.createElement('div'); done.className = 'settings-done'
  const button = document.createElement('button'); button.type = 'button'; button.className = 'lang-tool-btn'; button.textContent = 'Done'
  button.addEventListener('click', () => window.jQuery(panel).dialog('close'))
  done.append(button); panel.append(done)
  choose('search')
}
