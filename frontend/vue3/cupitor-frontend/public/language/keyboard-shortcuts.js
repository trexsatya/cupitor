export const KEYBOARD_SHORTCUTS = [
  { scope: 'General', keys: ['Shift + /', '?'], label: 'Show keyboard shortcuts' },
  { scope: 'General', keys: ['V'], label: 'Add a vocabulary item (main page)' },
  { scope: 'General', keys: ['L'], label: 'Open playlists (main page)' },
  { scope: 'General', keys: ['M'], label: 'Minimize / restore the active Player or Practice view' },
  { scope: 'Search', keys: ['/'], label: 'Focus and select the search field' },
  { scope: 'Practice', keys: ['/'], label: 'Search the current word (minimize Practice)' },
  { scope: 'Practice', keys: ['←', 'K'], label: 'Previous card' },
  { scope: 'Practice', keys: ['→', 'J'], label: 'Next card' },
  { scope: 'Practice', keys: ['Space'], label: 'Play or pause the clip / recording' },
  { scope: 'Practice', keys: ['R'], label: 'Reveal or flip the answer' },
  { scope: 'Practice', keys: ['D'], label: 'Switch language direction' },
  { scope: 'Practice', keys: ['S'], label: 'Cycle the configured playback speeds' },
  { scope: 'Practice', keys: ['Esc'], label: 'Close Practice' }
]

export function keyboardShortcut(event, {
  practice = false, studyActive = false, studyVisible = false,
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
    if (key === 'm' || key === 'v' || key === 'l') return null
  }
  if (key === 'm' && (practice || studyActive)) return 'study-toggle'
  if (!practice && !studyVisible) {
    if (key === 'v') return 'add-vocabulary'
    if (key === 'l') return 'playlists'
  }
  if (!practice) return null
  if (key === 'arrowleft' || key === 'k') return 'previous'
  if (key === 'arrowright' || key === 'j') return 'next'
  if (event.repeat) return null
  if (key === ' ' && !buttonFocused) return 'play'
  return { r: 'reveal', d: 'direction', s: 'speed', escape: 'close' }[key] || null
}
