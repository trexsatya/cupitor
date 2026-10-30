// Mobile Spotify can play an Audio() element that was never attached to the
// DOM, and can omit its desktop seek bar entirely. Observe the public media
// interfaces as Spotify uses them; retain its original methods and handlers.
(function () {
  const shared = window.__cupShared || (window.__cupShared = {});
  function getBridge() {
    if (window.__cupSpotifyPlaybackBridge) return window.__cupSpotifyPlaybackBridge;
    const bridge = {
      media: [], handlers: Object.create(null), position: null,
      playbackState: 'none', keyProvider: null,
    };
    window.__cupSpotifyPlaybackBridge = bridge;
    function remember(media) {
      if (!media || bridge.media.includes(media)) return;
      bridge.media.push(media);
      if (bridge.media.length > 8) bridge.media.shift();
    }
    bridge.remember = remember;
    const proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
    if (proto) {
      for (const name of ['play', 'pause', 'load']) {
        const original = proto[name];
        if (typeof original !== 'function') continue;
        try {
          proto[name] = function (...args) {
            remember(this);
            return original.apply(this, args);
          };
        } catch (_) { /* Some engines expose non-writable media methods. */ }
      }
    }
    function elapsedPosition() {
      const p = bridge.position;
      if (!p) return null;
      const elapsed = bridge.playbackState === 'playing' ? (Date.now() - p.updatedAt) / 1000 : 0;
      return Math.max(0, Math.min(p.duration, p.position + elapsed * p.playbackRate));
    }
    function playbackChanged(next) {
      if (next === bridge.playbackState) return;
      const position = elapsedPosition();
      if (bridge.position && position != null) {
        bridge.position.position = position;
        bridge.position.updatedAt = Date.now();
      }
      bridge.playbackState = next;
    }
    let session;
    try { session = navigator.mediaSession; } catch (_) {}
    bridge.session = session;
    if (session) {
      bridge.playbackState = session.playbackState || 'none';
      try {
        const original = session.setActionHandler;
        if (typeof original === 'function') session.setActionHandler = function (action, handler) {
          const result = original.call(this, action, handler);
          bridge.handlers[action] = typeof handler === 'function' ? handler : null;
          return result;
        };
      } catch (_) {}
      try {
        const original = session.setPositionState;
        if (typeof original === 'function') session.setPositionState = function (state) {
          const result = original.apply(this, arguments);
          bridge.playbackState = session.playbackState || 'none';
          bridge.position = state && state.duration > 0 && Number.isFinite(state.position ?? 0)
            ? {duration: state.duration, position: state.position ?? 0,
              playbackRate: state.playbackRate || 1, updatedAt: Date.now(),
              key: bridge.keyProvider ? bridge.keyProvider() : ''}
            : null;
          return result;
        };
      } catch (_) {}
      // Anchor the clock when paused, rather than snapping back to the last
      // position Spotify reported or extrapolating through a long pause.
      try {
        let owner = session, descriptor;
        while (owner && !descriptor) {
          descriptor = Object.getOwnPropertyDescriptor(owner, 'playbackState');
          owner = Object.getPrototypeOf(owner);
        }
        if (descriptor && descriptor.get && descriptor.set) {
          Object.defineProperty(session, 'playbackState', {
            configurable: true,
            get() { return descriptor.get.call(this); },
            set(value) {
              descriptor.set.call(this, value);
              playbackChanged(value);
            },
          });
        }
      } catch (_) {}
    }
    bridge.readPosition = () => {
      if (session) playbackChanged(session.playbackState || 'none');
      const position = elapsedPosition();
      return bridge.position && position != null ? {...bridge.position, position} : null;
    };
    return bridge;
  }
  shared.getSpotifyPlaybackBridge = getBridge;
  // Runs before DOM readiness, before Spotify creates or starts its player.
  if (location.hostname === 'open.spotify.com') getBridge();
})();
