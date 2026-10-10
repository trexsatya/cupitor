import { zoomAbout, clampView } from './image-viewer.js'

describe('zoomAbout', () => {
  test('the point zoomed about stays where it was on screen', () => {
    const v = zoomAbout({ scale: 1, x: 0, y: 0 }, 2, 100, -40)
    // screen position of picture point p is x + p*scale; p under (100,-40) was (100,-40)
    expect(v.scale).toBe(2)
    expect(v.x + 100 * 2).toBe(100)
    expect(v.y + -40 * 2).toBe(-40)
  })
  test('zoom stops at its limits', () => {
    expect(zoomAbout({ scale: 6, x: 0, y: 0 }, 4, 0, 0).scale).toBe(8)
    expect(zoomAbout({ scale: 1.5, x: 0, y: 0 }, 0.1, 0, 0)).toEqual({ scale: 1, x: 0, y: 0 })
  })
})

describe('clampView', () => {
  test('a zoomed picture cannot be dragged past its edge', () => {
    // 400px wide picture at 2× on a 400px screen: 200px of slack each side
    expect(clampView({ scale: 2, x: 500, y: -500 }, 400, 300, 400, 800)).toEqual({ scale: 2, x: 200, y: 0 })
  })
  test('at fitted size it stays centred', () => {
    expect(clampView({ scale: 1, x: 30, y: 30 }, 400, 300, 400, 800)).toEqual({ scale: 1, x: 0, y: 0 })
  })
})
