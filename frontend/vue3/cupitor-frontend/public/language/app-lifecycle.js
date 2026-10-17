// A foreground-only clock: background time is excluded even when Android
// suspends JavaScript and delivers no timer ticks until the app returns.
export function createAppLifecycleClock(target, { now = () => Date.now() } = {}) {
  let foreground = true, elapsed = 0, lastWall = now()
  const read = () => {
    const wall = now()
    if (foreground) elapsed += Math.max(0, wall - lastWall)
    lastWall = wall
    return elapsed
  }
  const onLifecycle = ({ detail }) => {
    if (typeof detail?.isForeground !== 'boolean') return
    read()
    foreground = detail.isForeground
  }
  target.addEventListener('cupitorAppLifecycle', onLifecycle)
  // Register first: the bridge may answer synchronously, including when the
  // page starts in the background. An absent/older host is a normal browser.
  try { target.AppLifecycleBridge?.postMessage('getState') } catch (_) {}
  return {
    now: read,
    isForeground: () => foreground,
    dispose: () => target.removeEventListener('cupitorAppLifecycle', onLifecycle),
  }
}
