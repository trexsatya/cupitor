import { isPracticeTouchGesture, isPracticeTouchDoubleTap } from './practice-gestures.js'

test('swipe navigation only starts for touch, not desktop text selection', () => {
  expect(isPracticeTouchGesture({ pointerType: 'touch' })).toBe(true)
  for (const pointerType of ['mouse', 'pen', '', undefined]) {
    expect(isPracticeTouchGesture({ pointerType })).toBe(false)
  }
})

test('double click selects text on desktop; touch double-tap can reveal', () => {
  expect(isPracticeTouchDoubleTap({ pointerType: 'mouse' }, true)).toBe(false)
  expect(isPracticeTouchDoubleTap({ pointerType: 'pen' }, true)).toBe(false)
  expect(isPracticeTouchDoubleTap({ pointerType: 'touch' }, false)).toBe(true)
  expect(isPracticeTouchDoubleTap({ pointerType: '' }, false)).toBe(false)
  expect(isPracticeTouchDoubleTap({ sourceCapabilities: { firesTouchEvents: true } }, true)).toBe(true)
  expect(isPracticeTouchDoubleTap({ sourceCapabilities: { firesTouchEvents: false } }, true)).toBe(false)
})
