// Present the IFrame API as the media clock consumed by the shared subtitle UI.
// Stop polling when the main-page player is minimized or a study view opens.
export function createYoutubeMediaAdapter(getPlayer, onSeek = () => {}) {
  const events = new EventTarget();
  let timer = null;
  let lastPaused;
  const media = {
    get currentTime() { return Number(getPlayer()?.getCurrentTime?.()) || 0; },
    set currentTime(time) { onSeek(time); getPlayer()?.seekTo?.(time, true); },
    get paused() { return ![1, 3].includes(getPlayer()?.getPlayerState?.()); },
    get playbackRate() { return getPlayer()?.getPlaybackRate?.() || 1; },
    set playbackRate(rate) { getPlayer()?.setPlaybackRate?.(rate); },
    get isConnected() { return !!timer; },
    play() { getPlayer()?.playVideo?.(); return Promise.resolve(); },
    pause() { getPlayer()?.pauseVideo?.(); },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    start() {
      if (timer) return;
      lastPaused = media.paused;
      timer = setInterval(() => {
        const paused = media.paused;
        if (paused !== lastPaused) {
          lastPaused = paused;
          events.dispatchEvent(new Event(paused ? 'pause' : 'play'));
        }
        events.dispatchEvent(new Event('timeupdate'));
      }, 100);
    },
    stop() { clearInterval(timer); timer = null; },
  };
  return media;
}
