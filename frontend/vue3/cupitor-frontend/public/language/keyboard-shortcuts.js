export const KEYBOARD_SHORTCUTS = [
  { scope: 'General', keys: ['Shift + /', '?'], label: 'Show keyboard shortcuts' },
  { scope: 'General', keys: ['V'], label: 'Add a vocabulary item (main page)' },
  { scope: 'General', keys: ['L'], label: 'Open playlists (main page)' },
  { scope: 'General', keys: ['M'], label: 'Minimize / restore the active Player or Practice view' },
  { scope: 'General', keys: ['P'], label: 'Switch between Player and Practice (when visible)' },
  { scope: 'Search', keys: ['/'], label: 'Focus and select the search field' },
  { scope: 'Practice', keys: ['/'], label: 'Search the current word (minimize Practice)' },
  { scope: 'Practice', keys: ['←', 'K'], label: 'Previous card' },
  { scope: 'Practice', keys: ['→', 'J'], label: 'Next card' },
  { scope: 'Practice', keys: ['Space'], label: 'Play or pause the clip / recording' },
  { scope: 'Practice', keys: ['F', 'R'], label: 'Flip / reveal the card' },
  { scope: 'Practice', keys: ['E'], label: 'Edit this card (editable manual cards only)' },
  { scope: 'Practice', keys: ['I'], label: 'Show / hide details for this card' },
  { scope: 'Practice', keys: ['D'], label: 'Switch language direction' },
  { scope: 'Practice', keys: ['S'], label: 'Cycle the configured playback speeds' },
  { scope: 'Practice', keys: ['Esc'], label: 'Close Practice' }
]

export function keyboardShortcut(event, {
  practice = false, studyActive = false, studyVisible = false,
  playerVisible = false, editAvailable = false,
  typing = false, searchFocused = false, dialogOpen = false, buttonFocused = false, searchAvailable = true
} = {}) {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 ||
      event.ctrlKey || event.altKey || event.metaKey || dialogOpen) return null
  const key = String(event.key || '').toLowerCase()
  // Shift+/ produces "?" on most layouts, but some browsers report
  // "/" with shiftKey still set. Keep the existing bare ? shortcut too.
  if ((key === '?' || (key === '/' && event.shiftKey)) && !typing && !event.repeat) return 'help'
  // Slash is reserved in the main search field too: select its query rather
  // than inserting "/". Other inputs and editors retain ordinary typing.
  if (key === '/') {
    if (practice) return typing || event.repeat ? null : 'practice-search'
    if (searchAvailable && (!typing || searchFocused)) return 'search'
  }
  if (typing) return null
  if (event.repeat) {
    // Previous / next cards may repeat, but opening dialogs or minimizing
    // a study view must never repeat while the key remains pressed.
    if (key === 'm' || key === 'v' || key === 'l' || key === 'e' || key === 'i' || key === 'p') return null
  }
  if (key === 'm' && (practice || studyActive)) return 'study-toggle'
  if (key === 'p' && (practice || playerVisible)) return 'switch-study-view'
  if (!practice && !studyVisible) {
    if (key === 'v') return 'add-vocabulary'
    if (key === 'l') return 'playlists'
  }
  if (!practice) return null
  if (key === 'e' && editAvailable) return 'edit-practice-card'
  if (key === 'i') return 'practice-details'
  if (key === 'arrowleft' || key === 'k') return 'previous'
  if (key === 'arrowright' || key === 'j') return 'next'
  if (event.repeat) return null
  if (key === ' ' && !buttonFocused) return 'play'
  return { f: 'reveal', r: 'reveal', d: 'direction', s: 'speed', escape: 'close' }[key] || null
}

// Prefer the view currently on top. When both are parked, restore the last
// one minimized; neither shortcut closes or creates a study session.
export function studyShortcutView({
  practiceActive = false, practiceMinimized = false,
  playerActive = false, playerMinimized = false, lastMinimized = null
} = {}) {
  if (practiceActive && !practiceMinimized) return 'minimize-practice'
  if (playerActive && !playerMinimized) return 'minimize-player'
  if (lastMinimized === 'player' && playerActive) return 'restore-player'
  if (lastMinimized === 'practice' && practiceActive) return 'restore-practice'
  if (practiceActive) return 'restore-practice'
  if (playerActive) return 'restore-player'
  return null
}
