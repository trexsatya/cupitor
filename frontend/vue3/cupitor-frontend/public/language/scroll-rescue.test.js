import { isMissedScroll } from './scroll-rescue.js'

describe('isMissedScroll', () => {
  const box = { before: 300, max: 1000 }
  test('a clear drag that left a box with room to move where it was is a miss', () => {
    expect(isMissedScroll({ ...box, dx: 4, dy: -160, after: 300 })).toBe(true)
    expect(isMissedScroll({ ...box, dx: 4, dy: 160, after: 300 })).toBe(true)
  })
  test('a drag that scrolled is not', () => {
    expect(isMissedScroll({ ...box, dx: 0, dy: -160, after: 460 })).toBe(false)
  })
  test('a box already at the end it was pushed towards is not', () => {
    expect(isMissedScroll({ dx: 0, dy: 160, before: 0, after: 0, max: 1000 })).toBe(false)
    expect(isMissedScroll({ dx: 0, dy: -160, before: 1000, after: 1000, max: 1000 })).toBe(false)
  })
  test('taps, short nudges and sideways swipes are not', () => {
    expect(isMissedScroll({ ...box, dx: 0, dy: -20, after: 300 })).toBe(false)
    expect(isMissedScroll({ ...box, dx: 200, dy: -60, after: 300 })).toBe(false)
  })
})
