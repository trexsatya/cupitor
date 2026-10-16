import { keyboardShortcut } from './keyboard-shortcuts.js'

test.each([
  ['ArrowLeft', 'previous'], ['K', 'previous'], ['ArrowRight', 'next'], ['j', 'next'],
  [' ', 'play'], ['r', 'reveal'], ['d', 'direction'], ['s', 'speed'], ['Escape', 'close'], ['?', 'help']
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
test('help is available in both views and main search retains other typing keys', () => {
  expect(keyboardShortcut({ key: '?' })).toBe('help')
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
