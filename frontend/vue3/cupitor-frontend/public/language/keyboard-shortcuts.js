export const KEYBOARD_SHORTCUTS = [
  { scope: 'General', keys: ['V'], label: 'Add a vocabulary item (main page)' },
  { scope: 'General', keys: ['L'], label: 'Open playlists (main page)' },
  { scope: 'General', keys: ['M'], label: 'Minimize / restore the active Player or Practice view' },
  { scope: 'General', keys: ['P'], label: 'Switch between Player and Practice (when visible)' },
  { scope: 'Search', keys: ['Ctrl/Cmd + F'], label: 'Find visible text on this page' },
  { scope: 'Search', keys: ['Enter', 'Shift + Enter'], label: 'Next / previous on-page Find match (when Find is open)' },
  { scope: 'Search', keys: ['Ctrl/Cmd + G', 'Shift + Ctrl/Cmd + G'], label: 'Next / previous on-page Find match' },
  { scope: 'Search', keys: ['F3', 'Shift + F3'], label: 'Next / previous on-page Find match' },
  { scope: 'Search', keys: ['/'], label: 'Focus and select the search field' },
  { scope: 'Search', keys: ['Enter'], label: 'Run the search from the search field' },
  { scope: 'Search', keys: ['Alt + Shift + ←', 'Alt + Shift + →'], label: 'Previous / next search in history (desktop)' },
  { scope: 'Search', keys: ['Esc'], label: 'Close Find, search history, or search options when open' },
  { scope: 'Practice', keys: ['/'], label: 'Search the current word (minimize Practice)' },
  { scope: 'Practice', keys: ['←', 'K'], label: 'Previous card' },
  { scope: 'Practice', keys: ['→', 'J'], label: 'Next card' },
  { scope: 'Practice', keys: ['Space'], label: 'Play or pause the clip / recording' },
  { scope: 'Practice', keys: ['F', 'R'], label: 'Flip / reveal the card' },
  { scope: 'Practice', keys: ['E'], label: 'Edit this card (editable manual cards only)' },
  { scope: 'Practice', keys: ['I'], label: 'Show / hide details for this card' },
  { scope: 'Practice', keys: ['D'], label: 'Switch language direction' },
  { scope: 'Practice', keys: ['S'], label: 'Cycle the configured playback speeds' },
  { scope: 'Practice', keys: ['Esc'], label: 'Close Practice' },
  { scope: 'Player', keys: ['←', '→'], label: 'Previous / next item' },
  { scope: 'Player', keys: ['Space'], label: 'Play or pause playback' },
  { scope: 'Player', keys: ['Esc'], label: 'Stop playback' },
  { scope: 'Player', keys: ['↑', '↓'], label: 'Resize the media pane when the divider is focused' },
  { scope: 'Player', keys: ['Home'], label: 'Reset the media pane size when the divider is focused' },
  { scope: 'Word maps', keys: ['Enter', 'Space'], label: 'Select the focused node. Enter on an already selected node edits it in Edit mode.' },
  { scope: 'Word maps', keys: ['N'], label: 'Add a node in Edit mode' },
  { scope: 'Word maps', keys: ['C'], label: 'Start or cancel a connection in Edit mode' },
  { scope: 'Word maps', keys: ['E', 'F2'], label: 'Edit the selected node' },
  { scope: 'Word maps', keys: ['Ctrl/Cmd + Enter'], label: 'Apply node text while editing' },
  { scope: 'Word maps', keys: ['Delete', 'Backspace'], label: 'Delete the selection in Edit mode' },
  { scope: 'Word maps', keys: ['Arrow keys', 'Shift + arrow keys'], label: 'Move selected nodes in Edit mode. Hold Shift for larger steps.' },
  { scope: 'Word maps', keys: ['Ctrl/Cmd + C', 'Ctrl/Cmd + V'], label: 'Copy / paste the selection in Edit mode' },
  { scope: 'Word maps', keys: ['Ctrl/Cmd + Z'], label: 'Undo a map edit' },
  { scope: 'Word maps', keys: ['Ctrl/Cmd + Shift + Z', 'Ctrl/Cmd + Y'], label: 'Redo a map edit' },
  { scope: 'Word maps', keys: ['Esc'], label: 'Cancel inline editing or a connection, close a menu, or leave fullscreen' },
  { scope: 'Rich card editor', keys: ['Ctrl/Cmd + B'], label: 'Bold' },
  { scope: 'Rich card editor', keys: ['Ctrl/Cmd + I'], label: 'Italic' },
  { scope: 'Rich card editor', keys: ['Ctrl/Cmd + U'], label: 'Underline' },
  { scope: 'Rich card editor', keys: ['Ctrl/Cmd + Shift + X'], label: 'Strikethrough' },
  { scope: 'Rich card editor', keys: ['Ctrl/Cmd + Z', 'Ctrl/Cmd + Shift + Z'], label: 'Undo / redo' },
  { scope: 'Rich card editor', keys: ['Enter'], label: 'Insert the image when its URL field is focused' },
  { scope: 'Subtitle editor', keys: ['Ctrl/Cmd + Enter'], label: 'Save the inline subtitle edit' },
  { scope: 'Subtitle editor', keys: ['Esc'], label: 'Cancel the inline subtitle edit' },
  { scope: 'Picture viewer', keys: ['Esc'], label: 'Close the picture viewer' },
  { scope: 'Desktop app browser', keys: ['Ctrl/Cmd + L'], label: 'Focus the address bar' },
  { scope: 'Desktop app browser', keys: ['Ctrl/Cmd + R'], label: 'Reload the page' },
  { scope: 'Desktop app browser', keys: ['Ctrl/Cmd + D'], label: 'Bookmark the current page' },
  { scope: 'Desktop app browser', keys: ['Ctrl/Cmd + B'], label: 'Open Bookmarks' },
  { scope: 'Desktop app browser', keys: ['Ctrl/Cmd + ,'], label: 'Open Tools' }
]

export function keyboardShortcut(event, {
  practice = false, studyActive = false, studyVisible = false,
  playerVisible = false, editAvailable = false,
  typing = false, searchFocused = false, dialogOpen = false, buttonFocused = false, searchAvailable = true
} = {}) {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 ||
      event.ctrlKey || event.altKey || event.metaKey || dialogOpen) return null
  const key = String(event.key || '').toLowerCase()
  // Match the typed character: some layouts need Shift+7 to produce '/'.
  // A question mark remains ordinary text, with no reference-dialog shortcut.
  // Slash is reserved in the main search field too: select its query rather
  // than inserting "/". Other inputs and editors retain ordinary typing.
  if (key === '/') {
    // The main search can retain focus behind Practice. Route that slash to
    // the visible card while preserving normal typing in actual editors.
    if (practice) return (typing && !searchFocused) || event.repeat ? null : 'practice-search'
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
