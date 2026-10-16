export const KEYBOARD_SHORTCUTS = [
  { scope: 'General', keys: ['?'], label: 'Show keyboard shortcuts' },
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
  practice = false, typing = false, searchFocused = false, dialogOpen = false, buttonFocused = false, searchAvailable = true
} = {}) {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 ||
      event.ctrlKey || event.altKey || event.metaKey || dialogOpen) return null
  const key = String(event.key || '').toLowerCase()
  // Slash is reserved in the main search field too: select its query rather
  // than inserting "/". Other inputs and editors retain ordinary typing.
  if (key === '/') {
    if (practice) return typing || event.repeat ? null : 'practice-search'
    if (searchAvailable && (!typing || searchFocused)) return 'search'
  }
  if (typing) return null
  if (key === '?' && !event.repeat) return 'help'
  if (!practice) return null
  if (key === 'arrowleft' || key === 'k') return 'previous'
  if (key === 'arrowright' || key === 'j') return 'next'
  if (event.repeat) return null
  if (key === ' ' && !buttonFocused) return 'play'
  return { r: 'reveal', d: 'direction', s: 'speed', escape: 'close' }[key] || null
}
