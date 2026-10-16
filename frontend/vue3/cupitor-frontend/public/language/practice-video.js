// A card prepares a clip; only a deliberate Play action starts it. Request
// identities let navigation, playback and closing cancel a pending ready wait.
export function createPracticeVideoCues({ getPlayer, isReady, isActive, waitUntil }) {
  let latest = 0
  let mutedPlayer = null
  let wasMuted = false
  const releaseMute = () => {
    const player = mutedPlayer
    mutedPlayer = null
    if (player && !wasMuted) { try { player.unMute() } catch (_) {} }
  }
  const mute = () => {
    const player = getPlayer()
    if (!player || typeof player.isMuted !== 'function' || typeof player.mute !== 'function') return
    if (mutedPlayer !== player) {
      releaseMute()
      wasMuted = player.isMuted()
      mutedPlayer = player
    }
    player.mute()
  }
  const isCurrent = token => token === latest && isActive()
  const invalidate = () => {
    latest++
    // Iframe commands are asynchronous. Silence before pause/cue, so a
    // buffered frame from the previous card cannot sound during navigation.
    try { mute() } catch (_) {}
    try { getPlayer()?.pauseVideo() } catch (_) {}
    return latest
  }
  const beginPlayback = token => {
    if (!isCurrent(token)) return false
    releaseMute()
    return true
  }
  const cue = async (id, start, token) => {
    if (!isCurrent(token)) return false
    if (!isReady()) await waitUntil(() => !isCurrent(token) || isReady())
    if (!isCurrent(token)) return false
    // loadVideoById autoplays. Seeking and pausing afterwards always leaves
    // an audible gap; cueVideoById prepares the start position while silent.
    const player = getPlayer()
    try { mute() } catch (_) {}
    player.cueVideoById({ videoId: id, startSeconds: Number(start) || 0 })
    // Restore the user's sound setting only after the iframe acknowledges
    // the silent cue. A superseded cue must never unmute the next card.
    if (mutedPlayer && typeof player.getPlayerState === 'function') {
      const isCued = () => {
        try { return player.getPlayerState() === 5 && player.getVideoData()?.video_id === id }
        catch (_) { return false }
      }
      const deadline = Date.now() + 5000
      await waitUntil(() => !isCurrent(token) || isCued() || Date.now() >= deadline)
      if (!isCurrent(token) || !isCued()) return false
    }
    if (!isCurrent(token)) return false
    releaseMute()
    return true
  }
  return { invalidate, isCurrent, cue, beginPlayback, releaseMute }
}
