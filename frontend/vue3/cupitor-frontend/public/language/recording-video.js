// One bounded attempt spans metadata, iframe readiness, loading, seeking and
// playback. In particular, BUFFERING is not permission to wait indefinitely.
export const VIDEO_RECOVERY_MS = 20000

// Player must not treat an ignored seek as success. Require two settled
// samples from the requested video; retry while loading, then let the caller
// reload at startSeconds within the attempt's shared recovery budget.
export function confirmRecordingSeek({ player, videoId, start, requirePlaying = false,
  isCurrent, isForeground = () => true, now = () => Date.now(),
  setTimer = setTimeout, clearTimer = clearTimeout, timeoutMs = 3000 }) {
  const target = Number(start)
  return new Promise((resolve, reject) => {
    let timer, settled = 0, lastSeek = -Infinity
    const began = now()
    const finish = (error, success = false) => {
      clearTimer(timer)
      if (error) reject(error)
      else resolve(success)
    }
    const tick = () => {
      if (!isCurrent()) return finish(null)
      if (!isForeground()) { timer = setTimer(tick, 100); return }
      if (!Number.isFinite(target) || target < 0) {
        return finish(Object.assign(new Error('Invalid clip timestamp'), { kind: 'invalid-clip' }))
      }
      if (now() - began >= timeoutMs) {
        return finish(Object.assign(new Error('Could not seek to the clip timestamp'), { kind: 'seek-failed' }))
      }
      // Always issue the command before trusting a cached timestamp, including
      // when adjacent clips share the same video and start time.
      if (now() - lastSeek >= 1000) {
        lastSeek = now()
        settled = 0
        try { player.seekTo(target, true) } catch (_) {}
        // Some embeds acknowledge a load in PAUSED/CUED rather than
        // autoplaying. Start them while preparation is still muted, then
        // verify the actual position before the caller restores sound.
        try {
          if (requirePlaying && player.getVideoData()?.video_id === videoId &&
            [0, 2, 5].includes(player.getPlayerState())) player.playVideo()
        } catch (_) {}
      }
      let landed = false
      try {
        const state = player.getPlayerState()
        const time = player.getCurrentTime()
        landed = player.getVideoData()?.video_id === videoId && Number.isFinite(time) &&
          Math.abs(time - target) <= 0.5 &&
          (requirePlaying ? state === 1 : [1, 2, 5].includes(state))
      } catch (_) {}
      settled = landed ? settled + 1 : 0
      if (settled >= 2) return finish(null, true)
      timer = setTimer(tick, 100)
    }
    tick()
  })
}

export function createRecordingVideoAttempt({ videoId, isCurrent, isPaused = () => false, now = Date.now,
  setTimer = setTimeout, clearTimer = clearTimeout, timeoutMs = VIDEO_RECOVERY_MS }) {
  let ended = null, timer = null, lastProgress = now(), lastCheck = now(), lastSample = now(), lastTime = null, played = false, requested = false, recovering = false
  let finishWait
  let mutedPlayer = null, wasMuted = true
  const releaseMute = (pause = false) => {
    const player = mutedPlayer
    mutedPlayer = null
    if (!player) return
    // Cancelling or failing a load must pause before restoring sound.
    if (pause) { try { player.pauseVideo() } catch (_) {} }
    if (!wasMuted) { try { player.unMute() } catch (_) {} }
  }
  const finished = new Promise(resolve => { finishWait = resolve })
  const finish = (kind, code) => {
    if (ended) return
    ended = Object.assign(new Error(kind === 'timeout' ? 'Video did not make progress within 20 seconds' : kind), { kind, code })
    if (timer != null) clearTimer(timer)
    timer = null
    releaseMute(true)
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
    preparePlayer(player) {
      if (!active() || !player || typeof player.isMuted !== 'function' || typeof player.mute !== 'function') return
      try {
        if (mutedPlayer !== player) {
          releaseMute(true)
          wasMuted = player.isMuted()
          mutedPlayer = player
        }
        player.mute()
      } catch (_) {}
    },
    releaseMute() { if (active()) releaseMute() },
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
