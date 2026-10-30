// YouTube's mobile frame keeps an aspect-ratio wrapper around a separately
// positioned video. Resize the complete player stack together, so the native
// video's inline centering offsets cannot move its picture behind that wrapper.
(function () {
  const shared = window.__cupShared || (window.__cupShared = {});
  shared.createYouTubeSplitLayout = function (getVideo) {
    const marker = 'cup-youtube-frame';
    const properties = ['--cup-youtube-top', '--cup-youtube-left', '--cup-youtube-width'];
    const style = document.createElement('style');
    style.id = 'cup-youtube-split-css';
    style.textContent = `
      body.cup-sub-split #player-container-id.${marker},
      body.cup-sub-split #movie_player.${marker},
      body.cup-sub-split .html5-video-player.${marker} {
        position: fixed !important;
        top: var(--cup-youtube-top) !important;
        left: var(--cup-youtube-left) !important;
        right: auto !important; bottom: auto !important;
        width: var(--cup-youtube-width) !important;
        height: max(1px, calc(var(--cup-vid-h) - var(--cup-youtube-top))) !important;
        max-height: max(1px, calc(var(--cup-vid-h) - var(--cup-youtube-top))) !important;
        min-height: 0 !important; padding: 0 !important;
        box-sizing: border-box !important; overflow: hidden !important;
        transition: none !important;
      }
      body.cup-sub-split .${marker} #player,
      body.cup-sub-split .${marker} #movie_player,
      body.cup-sub-split .${marker} .html5-video-player,
      body.cup-sub-split .${marker} .html5-video-container {
        position: absolute !important; inset: 0 !important;
        width: 100% !important; height: 100% !important;
        max-height: 100% !important; min-height: 0 !important;
        padding: 0 !important; aspect-ratio: auto !important;
        transition: none !important;
      }
      /* Mobile controls are siblings of #player. Keep their native wrapper
         unexpanded: an empty full-frame wrapper intercepts video taps even
         while the actual controls are hidden. Order the visible overlay over
         the media without raising the whole player over YouTube's popups. */
      body.cup-sub-split #player-container-id.${marker} #player {
        z-index: 0 !important;
      }
      body.cup-sub-split #player-container-id.${marker} #player-control-overlay {
        z-index: 1 !important;
      }
      body.cup-sub-split .${marker} .html5-video-container {
        transform: none !important;
      }
      body.cup-sub-split .${marker} video {
        position: absolute !important; inset: 0 !important;
        width: 100% !important; height: 100% !important;
        max-width: 100% !important; max-height: 100% !important;
        margin: 0 !important; transform: none !important;
        object-fit: contain !important;
        transition: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    let frame = null, viewport = '', fullscreen = null, updating = false;

    function release() {
      if (!frame) return false;
      frame.classList.remove(marker);
      for (const property of properties) frame.style.removeProperty(property);
      frame = null;
      viewport = '';
      return true;
    }

    function update() {
      if (updating) return;
      updating = true;
      try {
        const video = getVideo();
        const next = video && (video.closest('#player-container-id') ||
          video.closest('#movie_player, .html5-video-player'));
        if (!document.body.classList.contains('cup-sub-split') || !next) {
          // Let YouTube recompute its normal inline geometry after our fixed
          // frame is released. The guard prevents a recursive resize loop.
          if (release()) window.dispatchEvent(new Event('resize'));
          return;
        }
        const size = window.innerWidth + ':' + window.innerHeight;
        if (next !== frame || size !== viewport || fullscreen !== document.fullscreenElement) {
          release();
          const rect = next.getBoundingClientRect();
          if (!(rect.width > 0)) return;
          frame = next;
          viewport = size;
          fullscreen = document.fullscreenElement;
          frame.style.setProperty(properties[0], Math.max(0, rect.top) + 'px');
          frame.style.setProperty(properties[1], rect.left + 'px');
          frame.style.setProperty(properties[2], rect.width + 'px');
          frame.classList.add(marker);
        }
      } finally { updating = false; }
    }

    window.addEventListener('resize', update);
    document.addEventListener('fullscreenchange', update);
    return {
      update,
      dispose() {
        window.removeEventListener('resize', update);
        document.removeEventListener('fullscreenchange', update);
        if (release()) window.dispatchEvent(new Event('resize'));
        style.remove();
      },
    };
  };
})();
