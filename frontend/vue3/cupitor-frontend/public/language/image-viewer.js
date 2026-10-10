// Full-screen picture viewer for the pictures in a card. The page turns
// browser zoom off (user-scalable=no), so a picture in a card could not be
// looked at any closer than the card shows it.
//
// Pinch or wheel to zoom about the fingers / pointer, drag to move around,
// double-tap to zoom in and back out. ✕, Escape, or a tap beside an unzoomed
// picture closes it.

const MIN_SCALE = 1
const MAX_SCALE = 8
const DOUBLE_TAP_SCALE = 2.5

// The view after zooming by `factor` about a point (cx, cy) — measured from
// the viewer's centre — so that point stays under the fingers. `view` is
// { scale, x, y }: the picture, fitted to the screen, scaled by `scale` and
// moved by (x, y) from the centre.
export function zoomAbout(view, factor, cx, cy, min = MIN_SCALE, max = MAX_SCALE) {
  const scale = Math.min(max, Math.max(min, view.scale * factor))
  const k = scale / view.scale
  return { scale, x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k }
}

// Keep the picture over the screen: it cannot be dragged past its own edge,
// and at its fitted size it stays centred. `fitW` × `fitH` is the picture's
// size at scale 1; `viewW` × `viewH` the screen.
export function clampView(view, fitW, fitH, viewW, viewH) {
  const mx = Math.max(0, (fitW * view.scale - viewW) / 2)
  const my = Math.max(0, (fitH * view.scale - viewH) / 2)
  return {
    scale: view.scale,
    x: Math.min(mx, Math.max(-mx, view.x)) || 0,
    y: Math.min(my, Math.max(-my, view.y)) || 0,
  }
}

let _open = null

export function closeImageViewer() {
  if (!_open) return
  const o = _open
  _open = null
  window.removeEventListener('keydown', o.onKey, true)
  window.removeEventListener('resize', o.onResize)
  o.root.remove()
}

export function openImageViewer(src, alt) {
  closeImageViewer()
  const root = document.createElement('div')
  root.className = 'img-viewer'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-label', 'Picture')
  const img = document.createElement('img')
  img.className = 'img-viewer-img'
  img.alt = alt || ''
  img.draggable = false
  img.src = src
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'img-viewer-close'
  close.setAttribute('aria-label', 'Close')
  close.textContent = '✕'
  root.append(img, close)
  document.body.appendChild(root)

  let view = { scale: 1, x: 0, y: 0 }
  const box = () => root.getBoundingClientRect()
  // Point relative to the viewer's centre.
  const rel = (px, py) => { const b = box(); return [px - b.left - b.width / 2, py - b.top - b.height / 2] }
  const apply = () => {
    const b = box()
    view = clampView(view, img.offsetWidth, img.offsetHeight, b.width, b.height)
    img.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`
    root.classList.toggle('zoomed', view.scale > 1.001)
  }
  const zoomTo = (factor, px, py) => { const [cx, cy] = rel(px, py); view = zoomAbout(view, factor, cx, cy); apply() }
  const toggleZoom = (px, py) => {
    if (view.scale > 1.001) { view = { scale: 1, x: 0, y: 0 }; apply() } else zoomTo(DOUBLE_TAP_SCALE, px, py)
  }

  // Pointers down: id -> { x, y }. One pans, two pinch.
  const pts = new Map()
  let pinch = null      // { dist, view, mid }
  let pan = null        // { x, y, view }
  let moved = false
  let lastTap = 0
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1 }
  const mid = () => { const [a, b] = [...pts.values()]; return [(a.x + b.x) / 2, (a.y + b.y) / 2] }

  root.addEventListener('pointerdown', e => {
    if (e.target === close) return
    e.preventDefault()
    try { root.setPointerCapture(e.pointerId) } catch (_) {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.size === 1) { pan = { x: e.clientX, y: e.clientY, view }; moved = false }
    if (pts.size === 2) { pinch = { dist: dist(), view, mid: mid() }; pan = null; moved = true }
  })
  root.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch && pts.size >= 2) {
      const [mx, my] = mid()
      const [cx, cy] = rel(...pinch.mid)
      // Zoom about where the pinch started, then follow the fingers' midpoint.
      view = zoomAbout(pinch.view, dist() / pinch.dist, cx, cy)
      view = { ...view, x: view.x + (mx - pinch.mid[0]), y: view.y + (my - pinch.mid[1]) }
      apply()
    } else if (pan) {
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true
      if (moved && pan.view.scale > 1.001) { view = { ...pan.view, x: pan.view.x + dx, y: pan.view.y + dy }; apply() }
    }
  })
  const up = e => {
    if (!pts.has(e.pointerId)) return
    pts.delete(e.pointerId)
    if (pts.size < 2) pinch = null
    // Still two or more down: measure again from the fingers now in play, so
    // the view does not jump to a different pair's spread.
    else pinch = { dist: dist(), view, mid: mid() }
    if (pts.size === 1) { const [p] = pts.values(); pan = { x: p.x, y: p.y, view } }
    if (pts.size) return
    pan = null
    if (moved || e.type === 'pointercancel') return
    // A tap: twice in quick succession zooms; once beside an unzoomed picture closes.
    const now = Date.now()
    if (now - lastTap < 300) { lastTap = 0; toggleZoom(e.clientX, e.clientY); return }
    lastTap = now
    // By position, not e.target: with the pointer captured, every event
    // reports the backdrop as its target.
    const r = img.getBoundingClientRect()
    const onPicture = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    if (!onPicture && view.scale <= 1.001) setTimeout(() => { if (lastTap === now) closeImageViewer() }, 300)
  }
  root.addEventListener('pointerup', up)
  root.addEventListener('pointercancel', up)
  root.addEventListener('wheel', e => {
    e.preventDefault()
    // Firefox counts a mouse wheel in lines (or pages), not pixels.
    const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1)
    // A trackpad pinch arrives as a wheel with ctrlKey and small deltas.
    zoomTo(Math.exp(-px * (e.ctrlKey ? 0.01 : 0.002)), e.clientX, e.clientY)
  }, { passive: false })
  close.addEventListener('click', e => { e.stopPropagation(); closeImageViewer() })
  // Caught before the page's own keys, and none reach them while the picture
  // is up: Escape closes the picture, not Practice, and the arrows or Space
  // must not change the card or the playback hidden behind it.
  const onKey = e => {
    e.stopImmediatePropagation()
    if (e.key === 'Escape') { e.preventDefault(); closeImageViewer() }
  }
  window.addEventListener('keydown', onKey, true)
  // A rotation changes the screen the picture was fitted and clamped to.
  const onResize = () => apply()
  window.addEventListener('resize', onResize)
  img.addEventListener('load', apply)
  _open = { root, onKey, onResize }
  apply()
  return root
}
