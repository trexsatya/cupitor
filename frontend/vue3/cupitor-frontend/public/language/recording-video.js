// One bounded attempt spans metadata, iframe readiness, loading, seeking and
// playback. In particular, BUFFERING is not permission to wait indefinitely.
export const VIDEO_RECOVERY_MS = 20000

export function createRecordingVideoAttempt({ videoId, isCurrent, isPaused = () => false, now = Date.now,
  setTimer = setTimeout, clearTimer = clearTimeout, timeoutMs = VIDEO_RECOVERY_MS }) {
  let ended = null, timer = null, lastProgress = now(), lastCheck = now(), lastSample = now(), lastTime = null, played = false, requested = false, recovering = false
  let finishWait
  const finished = new Promise(resolve => { finishWait = resolve })
  const finish = (kind, code) => {
    if (ended) return
    ended = Object.assign(new Error(kind === 'timeout' ? 'Video did not make progress within 20 seconds' : kind), { kind, code })
    if (timer != null) clearTimer(timer)
    timer = null
    finishWait(ended)
  }
  const active = () => !ended && isCurrent()
  const tick = () => {
    if (!isCurrent()) { finish('cancelled'); return }
    const time = now()
    if (isPaused()) { lastProgress += time - lastCheck; lastTime = null }
    lastCheck = time
    if (now() - lastProgress >= timeoutMs) { finish('timeout'); return }
    timer = setTimer(tick, 100)
  }
  timer = setTimer(tick, 100)
  return {
    videoId,
    active,
    get requested() { return requested },
    get played() { return played },
    get recovering() { return recovering },
    request() { requested = true },
    noteError() { recovering = true; lastTime = null },
    cancel() { finish('cancelled') },
    fail(kind = 'unavailable', code) { finish(kind, code) },
    // An initial seek landing is not playback. Require two increasing samples
    // from the requested video while it reports PLAYING, not a stale timestamp
    // from a previous clip, a paused error screen or a seek in progress.
    observe(time, state, loadedId) {
      if (!active() || isPaused() || state !== 1 || loadedId !== videoId || !Number.isFinite(time)) { lastTime = null; return }
      const maxStep = Math.max(2, (now() - lastSample) / 1000 * 4 + 1)
      if (lastTime != null && time > lastTime + 0.05 && time - lastTime <= maxStep) {
        played = true
        recovering = false
        lastProgress = now()
      }
      lastTime = time
      lastSample = now()
    },
    wait(operation) {
      return Promise.race([Promise.resolve(operation), finished.then(reason => { throw reason })]).then(value => {
        if (!active()) { finish('cancelled'); throw ended }
        return value
      })
    },
    dispose() { finish('cancelled') },
  }
}
