// A card prepares a clip; only a deliberate Play action starts it. Request
// identities let navigation, playback and closing cancel a pending ready wait.
export function createPracticeVideoCues({ getPlayer, isReady, isActive, waitUntil }) {
  let latest = 0
  const isCurrent = token => token === latest && isActive()
  const invalidate = () => {
    latest++
    try { getPlayer()?.pauseVideo() } catch (_) {}
    return latest
  }
  const cue = async (id, start, token) => {
    if (!isCurrent(token)) return false
    if (!isReady()) await waitUntil(() => !isCurrent(token) || isReady())
    if (!isCurrent(token)) return false
    // loadVideoById autoplays. Seeking and pausing afterwards always leaves
    // an audible gap; cueVideoById prepares the start position while silent.
    getPlayer().cueVideoById({ videoId: id, startSeconds: Number(start) || 0 })
    return true
  }
  return { invalidate, isCurrent, cue }
}
