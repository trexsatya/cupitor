import { keyboardShortcut, studyShortcutView, KEYBOARD_SHORTCUTS } from './keyboard-shortcuts.js'

test.each([
  ['ArrowLeft', 'previous'], ['K', 'previous'], ['ArrowRight', 'next'], ['j', 'next'],
  [' ', 'play'], ['r', 'reveal'], ['f', 'reveal'], ['d', 'direction'], ['s', 'speed'], ['Escape', 'close']
])('Practice key %s performs %s', (key, action) => {
  expect(keyboardShortcut({ key }, { practice: true })).toBe(action)
})
test('slash focuses search or clicks the Practice search button', () => {
  expect(keyboardShortcut({ key: '/' })).toBe('search')
  expect(keyboardShortcut({ key: '/' }, { practice: true })).toBe('practice-search')
  expect(keyboardShortcut({ key: '/' }, { practice: true, searchAvailable: false })).toBe('practice-search')
  expect(keyboardShortcut({ key: '/' }, { typing: true, searchFocused: true })).toBe('search')
  expect(keyboardShortcut({ key: '/', repeat: true }, { typing: true, searchFocused: true })).toBe('search')
  expect(keyboardShortcut({ key: '/' }, { searchAvailable: false })).toBeNull()
})
test('question mark no longer opens help and main search retains other typing keys', () => {
  expect(keyboardShortcut({ key: '?' })).toBeNull()
  expect(keyboardShortcut({ key: '?' }, { typing: true, searchFocused: true })).toBeNull()
  expect(keyboardShortcut({ key: 'r' })).toBeNull()
})
test.each(['ctrlKey', 'altKey', 'metaKey', 'isComposing', 'defaultPrevented'])(
  '%s preserves browser, editor and IME behavior', flag => {
    for (const key of ['j', '/']) expect(keyboardShortcut({ key, [flag]: true }, { practice: true })).toBeNull()
  }
)
test('typing, composition and open dialogs cannot change cards or open help', () => {
  for (const key of ['ArrowRight', 'r', ' ', '?', '/']) {
    expect(keyboardShortcut({ key }, { practice: true, typing: true })).toBeNull()
    expect(keyboardShortcut({ key }, { practice: true, dialogOpen: true })).toBeNull()
  }
  expect(keyboardShortcut({ key: 'j', keyCode: 229 }, { practice: true })).toBeNull()
})
test('focused buttons keep native Space behavior; toggles do not repeat when held', () => {
  expect(keyboardShortcut({ key: ' ' }, { practice: true, buttonFocused: true })).toBeNull()
  expect(keyboardShortcut({ key: 'r', repeat: true }, { practice: true })).toBeNull()
  expect(keyboardShortcut({ key: '?', repeat: true })).toBeNull()
  expect(keyboardShortcut({ key: '/', repeat: true })).toBe('search')
  expect(keyboardShortcut({ key: '/', repeat: true }, { practice: true })).toBeNull()
  expect(keyboardShortcut({ key: 'ArrowRight', repeat: true }, { practice: true })).toBe('next')
})

test('main-page shortcuts open the existing vocabulary and playlist dialogs', () => {
  expect(keyboardShortcut({ key: 'v' })).toBe('add-vocabulary')
  expect(keyboardShortcut({ key: 'L' })).toBe('playlists')
  expect(keyboardShortcut({ key: 'v' }, { practice: true, studyVisible: true })).toBeNull()
  expect(keyboardShortcut({ key: 'l' }, { studyActive: true, studyVisible: true })).toBeNull()
  // The main page is usable again when a study view is parked.
  expect(keyboardShortcut({ key: 'l' }, { studyActive: true, studyVisible: false })).toBe('playlists')
})

test('M toggles any existing Player or Practice view, never creates one', () => {
  expect(keyboardShortcut({ key: 'm' })).toBeNull()
  expect(keyboardShortcut({ key: 'm' }, { practice: true, studyActive: true, studyVisible: true })).toBe('study-toggle')
  expect(keyboardShortcut({ key: 'M' }, { studyActive: true, studyVisible: false })).toBe('study-toggle')
})

test('Shift + / and question mark are ordinary keys and not help shortcuts', () => {
  for (const practice of [false, true]) {
    expect(keyboardShortcut({ key: '?', shiftKey: true }, { practice })).toBeNull()
    expect(keyboardShortcut({ key: '?' }, { practice })).toBeNull()
    expect(keyboardShortcut({ key: '/', shiftKey: true }, { practice })).toBeNull()
  }
  expect(keyboardShortcut({ key: '/', shiftKey: false })).toBe('search')
  expect(KEYBOARD_SHORTCUTS.filter(x => x.scope === 'General').map(x => x.keys[0])).toEqual(
    expect.arrayContaining(['V', 'L', 'M'])
  )
  expect(KEYBOARD_SHORTCUTS.some(x => x.keys.includes('Shift + /') || x.keys.includes('?'))).toBe(false)
})

test('new shortcuts respect typing, open dialogs and OS shortcuts', () => {
  for (const key of ['v', 'l', 'm', '?']) {
    expect(keyboardShortcut({ key }, { typing: true, studyActive: true })).toBeNull()
    expect(keyboardShortcut({ key }, { dialogOpen: true, studyActive: true })).toBeNull()
    expect(keyboardShortcut({ key, ctrlKey: true }, { studyActive: true })).toBeNull()
    expect(keyboardShortcut({ key, metaKey: true }, { studyActive: true })).toBeNull()
    expect(keyboardShortcut({ key, altKey: true }, { studyActive: true })).toBeNull()
    expect(keyboardShortcut({ key, repeat: true }, { studyActive: true })).toBeNull()
  }
  expect(keyboardShortcut({ key: '/', shiftKey: true }, { typing: true })).toBeNull()
})

test('M minimizes the visible study view and restores the last parked view', () => {
  expect(studyShortcutView()).toBeNull()
  expect(studyShortcutView({ practiceActive: true })).toBe('minimize-practice')
  expect(studyShortcutView({ playerActive: true })).toBe('minimize-player')
  expect(studyShortcutView({ practiceActive: true, practiceMinimized: true })).toBe('restore-practice')
  expect(studyShortcutView({ playerActive: true, playerMinimized: true })).toBe('restore-player')
  expect(studyShortcutView({
    practiceActive: true, practiceMinimized: true,
    playerActive: true, playerMinimized: false,
  })).toBe('minimize-player')
  expect(studyShortcutView({
    practiceActive: true, practiceMinimized: false,
    playerActive: true, playerMinimized: false,
  })).toBe('minimize-practice')
  expect(studyShortcutView({
    practiceActive: true, practiceMinimized: true,
    playerActive: true, playerMinimized: true,
    lastMinimized: 'player',
  })).toBe('restore-player')
  expect(studyShortcutView({
    practiceActive: true, practiceMinimized: true,
    playerActive: true, playerMinimized: true,
    lastMinimized: 'practice',
  })).toBe('restore-practice')
})

test('E edits only the current editable manual Practice card', () => {
  expect(keyboardShortcut({ key: 'e' }, { practice: true, editAvailable: true })).toBe('edit-practice-card')
  expect(keyboardShortcut({ key: 'E' }, { practice: true, editAvailable: false })).toBeNull()
  expect(keyboardShortcut({ key: 'e' }, { studyActive: true, studyVisible: false, editAvailable: true })).toBeNull()
  expect(keyboardShortcut({ key: 'e' }, { playerVisible: true, editAvailable: true })).toBeNull()
  expect(KEYBOARD_SHORTCUTS.find(x => x.keys.includes('E')).label).toMatch(/editable manual/)
})

test('I toggles Practice information; P switches the visible study mode', () => {
  expect(keyboardShortcut({ key: 'i' }, { practice: true })).toBe('practice-details')
  expect(keyboardShortcut({ key: 'i' })).toBeNull()
  expect(keyboardShortcut({ key: 'p' }, { practice: true })).toBe('switch-study-view')
  expect(keyboardShortcut({ key: 'p' }, { playerVisible: true, studyVisible: true })).toBe('switch-study-view')
  expect(keyboardShortcut({ key: 'p' }, { studyActive: true, studyVisible: false })).toBeNull()
  expect(keyboardShortcut({ key: 'p' })).toBeNull()
  expect(KEYBOARD_SHORTCUTS.find(x => x.keys.includes('P')).label).toMatch(/Player and Practice/)
})

test('E/I/P cannot steal focus from text editing, dialogs, system keys or hold repeat', () => {
  for (const key of ['e', 'i', 'p']) {
    const opts = { practice: true, playerVisible: true, editAvailable: true }
    expect(keyboardShortcut({ key, repeat: true }, opts)).toBeNull()
    expect(keyboardShortcut({ key }, { ...opts, typing: true })).toBeNull()
    expect(keyboardShortcut({ key }, { ...opts, dialogOpen: true })).toBeNull()
    expect(keyboardShortcut({ key, isComposing: true }, opts)).toBeNull()
    for (const mod of ['ctrlKey', 'altKey', 'metaKey']) {
      expect(keyboardShortcut({ key, [mod]: true }, opts)).toBeNull()
    }
  }
})

test('F is an alias for R; flip keys do not fire during text selection or editing', () => {
  expect(keyboardShortcut({ key: 'F' }, { practice: true })).toBe('reveal')
  expect(keyboardShortcut({ key: 'r' }, { practice: true })).toBe('reveal')
  expect(keyboardShortcut({ key: 'f' }, { practice: true, typing: true })).toBeNull()
  expect(keyboardShortcut({ key: 'f' }, { practice: true, dialogOpen: true })).toBeNull()
  expect(keyboardShortcut({ key: 'f', repeat: true }, { practice: true })).toBeNull()
  expect(KEYBOARD_SHORTCUTS.find(x => x.keys.includes('F')).label).toMatch(/flip/i)
})
