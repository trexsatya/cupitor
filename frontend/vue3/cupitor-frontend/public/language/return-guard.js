// Keeps a paused YouTube player paused when the app comes back to the front.
//
// Android pauses a page's video when the app goes to the background and plays
// it again when the app returns. That restart is blind to what the page did in
// between: a clip that ended, or was paused, while the app was away starts up
// again on return. So: follow the player's state while the page is hidden,
// and if it was not playing just before the page came back, pause it should
// it start within a short window after the page is shown. That includes a
// video Android itself paused on the way out: coming back never starts
// playback. Playback that carried on in the background (screen locked,
// headset) is left alone.
//
// Once it has caught a start, the guard keeps pausing for a moment (a pause
// sent while buffering can be dropped), then stands down — so a tap on the
// player's own play button afterwards is not fought.
//
// Anything that asks for playback on purpose — the page calling playVideo, a
// tap, a key, a tap inside the player (which takes focus from the page) —
// calls cancel() and the guard stands down.

const PLAYING = 1
const BUFFERING = 3
const isRunning = s => s === PLAYING || s === BUFFERING

export function createReturnGuard({
  getState,
  pause,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = id => clearTimeout(id),
  windowMs = 3000,
  holdMs = 1000,
  pollMs = 150,
}) {
  let hidden = false
  let wasRunning = true
  let until = 0
  let timer = null

  let caughtAt = 0
  const stop = () => {
    until = 0
    caughtAt = 0
    if (timer != null) { clearTimer(timer); timer = null }
  }
  const tick = () => {
    timer = null
    if (!until) return
    let st = null
    try { st = getState() } catch (_) {}
    if (isRunning(st)) {
      if (!caughtAt) caughtAt = now()
      try { pause() } catch (_) {}
    }
    // Waiting for a start ends with the window; a caught one is held a little
    // longer, since a pause sent while the player buffers can be dropped.
    if (caughtAt ? now() - caughtAt > holdMs : now() > until) { stop(); return }
    timer = setTimer(tick, pollMs)
  }

  return {
    onHidden() {
      stop()
      hidden = true
      let st = null
      try { st = getState() } catch (_) {}
      wasRunning = isRunning(st)
    },
    onStateChange(state) {
      if (hidden) wasRunning = isRunning(state)
    },
    onVisible() {
      if (!hidden) return
      hidden = false
      if (wasRunning) return
      until = now() + windowMs
      tick()
    },
    cancel: stop,
    get armed() { return !!until },
  }
}
