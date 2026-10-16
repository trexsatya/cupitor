// Scrolling for when the WebView's own touch scrolling stops.
//
// In the app on Android the study page sometimes stops scrolling until the
// app is restarted: the touches still reach the page and nothing prevents
// them, the browser even treats them as a scroll, but nothing moves. That is
// the WebView's scroll machinery stuck, not the page, so the page cannot
// unstick it — but it can move itself. Setting scrollTop is a different path
// from the stuck one.
//
// Nothing changes until it has to: a clear vertical drag over something that
// had room to scroll, and did not, is a miss; two misses in a row and the page
// drives touch scrolling itself from then on. Where scrolling works, drags
// move things and there are no misses.

import { gestureAxis, createScrollVelocity } from './scroll-gesture.js'

export const MIN_DRAG_PX = 40
export const MISSES_TO_ENGAGE = 2

// Whether a finished drag should have scrolled `top` and did not. `dy` is the
// finger's travel (down is positive, which scrolls up); `max` is how far the
// box could scroll; `before` / `after` its scrollTop at the start and a moment
// after the finger lifted.
export function isMissedScroll({ dx, dy, before, after, max }) {
  if (Math.abs(dy) < MIN_DRAG_PX || Math.abs(dx) > Math.abs(dy)) return false
  const roomThatWay = dy < 0 ? before < max - 1 : before > 1
  return roomThatWay && Math.abs(after - before) < 2
}

// Text editing, the rich editor and the picture viewer handle their own
// gestures, and a box already scrolled by its own handler is left to it. A
// drag on a dialog's title bar, a handle or a slider moves that, not a list —
// counted as a scroll that failed, it would switch this on for nothing.
const LEAVE_ALONE = 'input, textarea, select, audio, video, [contenteditable=""], [contenteditable="true"], ' +
  '.ck, .img-viewer, .wv-fakescroll-inner, .ui-dialog-titlebar, .ui-draggable-handle, .ui-resizable-handle, ' +
  '.ui-slider, .ui-sortable-handle'

function rootScroller() {
  return document.scrollingElement || document.documentElement
}

function canScrollY(el) {
  if (el === rootScroller() || el === document.body || el === document.documentElement) {
    const se = rootScroller()
    const oy = getComputedStyle(document.documentElement).overflowY
    const by = document.body ? getComputedStyle(document.body).overflowY : ''
    if (oy === 'hidden' || oy === 'clip' || by === 'hidden' || by === 'clip') return false
    return se.scrollHeight > se.clientHeight + 1
  }
  const oy = getComputedStyle(el).overflowY
  return (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 1
}

// The box a vertical drag from `el` would scroll: the nearest that can, or,
// once the direction is known, the nearest that can still go that way — the
// way the browser hands a scroll on to the box outside when one is at its end.
// A drag inside something pinned to the screen (a dialog, Practice, the
// playing view) scrolls inside it or not at all: the page behind is not its
// to move, and a pinned box that blocks the hand-on would make the page look
// stuck when it is not.
function scrollerFor(el, dir) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const isRoot = n === document.body || n === document.documentElement
    const box = isRoot ? rootScroller() : n
    if (!canScrollY(isRoot ? box : n)) {
      if (isRoot) break
      if (getComputedStyle(n).position === 'fixed') return null
      continue
    }
    if (!dir) return box
    const max = box.scrollHeight - box.clientHeight
    if (dir > 0 ? box.scrollTop > 0 : box.scrollTop < max - 1) return box
    if (isRoot) break
    if (getComputedStyle(n).position === 'fixed') return null
  }
  return canScrollY(rootScroller()) ? rootScroller() : null
}

export function installScrollRescue({ log = (m) => console.log(m) } = {}) {
  if (window.__scrollRescue) return window.__scrollRescue
  const st = { engaged: false, misses: 0 }
  window.__scrollRescue = st
  let g = null          // the gesture in progress
  let momentum = null
  const stopMomentum = () => { if (momentum) { cancelAnimationFrame(momentum); momentum = null } }

  document.addEventListener('touchstart', e => {
    stopMomentum()
    g = null
    if (!e.touches || e.touches.length !== 1) return
    const t = e.touches[0]
    const target = e.target && e.target.closest ? e.target : null
    if (!target || target.closest(LEAVE_ALONE)) return
    const box = scrollerFor(target, 0)
    if (!box) return
    const motion = createScrollVelocity()
    motion.reset(t.clientY, e.timeStamp)
    g = { target, x0: t.clientX, y0: t.clientY, y: t.clientY, motion,
      box, top0: box.scrollTop, axis: null, prevented: false }
  }, { passive: true })

  // Bubble phase: a handler of the page's own that takes the drag (a swipe,
  // the fake scroller) has already said so by the time this runs. Passive
  // until it is needed: a listener that may block makes the browser wait for
  // the page at the start of every drag, scrolling or not.
  let blocking = false
  const onMove = e => {
    if (!g || !e.touches || e.touches.length !== 1) { g = null; return }
    if (e.defaultPrevented) { g.prevented = true; return }
    const t = e.touches[0]
    if (!g.axis) {
      g.axis = gestureAxis(t.clientX - g.x0, t.clientY - g.y0, true)
      if (!g.axis) return
      if (st.engaged && g.axis === 'y') {
        // Now the direction is known, pick the box that can go that way.
        g.box = scrollerFor(g.target, t.clientY - g.y0) || g.box
        g.top0 = g.box.scrollTop
        g.y0 = t.clientY
      }
    }
    if (!st.engaged || g.axis !== 'y') return
    g.motion.record(t.clientY, e.timeStamp)
    g.y = t.clientY
    g.box.scrollTop = g.top0 - (t.clientY - g.y0)
    if (e.cancelable) e.preventDefault()
  }
  document.addEventListener('touchmove', onMove, { passive: true })
  const block = () => {
    if (blocking) return
    blocking = true
    document.removeEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
  }

  const end = e => {
    if (!g) return
    const done = g
    g = null
    if (done.prevented || done.axis !== 'y') return
    if (st.engaged) {
      // Whether the page's own scrolling worked, said once, so the next
      // report shows it.
      if (st.reportNext) {
        st.reportNext = false
        log(`[scroll-rescue] first page-driven drag ${Math.abs(done.box.scrollTop - done.top0) >= 1 ? 'moved' : 'did NOT move'} ` +
          `${done.box.id ? '#' + done.box.id : done.box.tagName.toLowerCase()}`)
      }
      // A little glide, so a flick does not stop dead under the finger.
      let v = -done.motion.velocity(e.timeStamp) * 16
      const box = done.box
      const step = () => {
        if (Math.abs(v) < 0.5) { momentum = null; return }
        const before = box.scrollTop
        box.scrollTop += v
        if (box.scrollTop === before) { momentum = null; return }
        v *= 0.94
        momentum = requestAnimationFrame(step)
      }
      if (Math.abs(v) >= 0.5) momentum = requestAnimationFrame(step)
      return
    }
    const t = (e.changedTouches && e.changedTouches[0]) || { clientX: done.x0, clientY: done.y }
    const dx = t.clientX - done.x0, dy = t.clientY - done.y0
    const box = done.box
    const max = box.scrollHeight - box.clientHeight
    // The browser's own scroll can trail the finger; judge once it has settled.
    setTimeout(() => {
      if (st.engaged) return
      const missed = isMissedScroll({ dx, dy, before: done.top0, after: box.scrollTop, max })
      if (!missed) { st.misses = 0; return }
      st.misses++
      if (st.misses < MISSES_TO_ENGAGE) return
      st.engaged = true
      block()
      st.reportNext = true
      log(`[scroll-rescue] touch scrolling stopped moving ${box.id ? '#' + box.id : box.tagName.toLowerCase()}; ` +
        'the page scrolls it from now on')
    }, 150)
  }
  document.addEventListener('touchend', end, { passive: true })
  document.addEventListener('touchcancel', () => { g = null }, { passive: true })
  return st
}
