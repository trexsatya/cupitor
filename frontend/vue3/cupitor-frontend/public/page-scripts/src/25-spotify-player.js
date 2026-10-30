// Spotify's audio can be hidden, replaced or playing on a Connect device.
// Adapt its visible player to the media-element interface used by the sidebar;
// no Spotify token or second player is needed.
(function () {
  const shared = window.__cupShared || (window.__cupShared = {});
  const playbackBridge = () => typeof shared.getSpotifyPlaybackBridge === 'function'
    ? shared.getSpotifyPlaybackBridge() : null;
  const playerRoot = () => document.querySelector(
    '[data-testid="now-playing-widget"], [data-testid="now-playing-bar"], .Root__now-playing-bar');
  function mediaUrl() {
    const root = playerRoot();
    const link = root && root.querySelector('a[href*="/track/"], a[href*="/episode/"]');
    const match = /\/(track|episode)\/([A-Za-z0-9]+)(?:[/?#]|$)/.exec(
      link ? link.getAttribute('href') : location.pathname);
    return match ? 'https://open.spotify.com/' + match[1] + '/' + match[2] : '';
  }
  const controls = () => document.querySelector('[data-testid="control-button-playpause"]:not(:disabled)');
  function progress() {
    const root = document.querySelector('[data-testid="playback-progressbar"]');
    if (!root) return null;
    if (root.matches('input, [role="slider"]')) return root;
    // A selector list uses DOM order, not selector priority: including the
    // wrapper in the same query always selected it before its real slider.
    return root.querySelector('input[type="range"]') || root.querySelector('[role="slider"]') ||
      root.querySelector('[data-testid="progress-bar"]') || root;
  }
  function clockSeconds(value) {
    if (!value || !/^\d+:\d{2}(?::\d{2})?$/.test(value)) return null;
    return value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  }
  function clock(selector) {
    const el = document.querySelector(selector);
    return clockSeconds(el && el.textContent.trim());
  }
  function accessibleDuration() {
    const text = progress()?.getAttribute('aria-valuetext') || '';
    const stamps = text.match(/\d+(?::\d{2}){1,2}/g) || [];
    return stamps.length === 2 ? clockSeconds(stamps[1]) : null;
  }
  function nativeMedia() {
    const bridge = playbackBridge();
    const candidates = [...new Set([...(bridge ? [...bridge.media].reverse() : []),
      ...document.querySelectorAll('audio, video')])];
    const hint = clock('[data-testid="playback-duration"]') || accessibleDuration();
    const usable = candidates.filter(media => Number.isFinite(media.currentTime) &&
      (media.readyState > 0 || media.currentTime > 0 || media.duration > 0) &&
      (!hint || !Number.isFinite(media.duration) || Math.abs(media.duration - hint) < 3));
    return usable.find(media => !media.paused && !media.ended) || usable[0] || null;
  }
  function sessionPosition() {
    const state = playbackBridge()?.readPosition();
    return state && (!state.key || state.key === mediaUrl()) ? state : null;
  }
  function observedPaused() {
    const media = nativeMedia();
    if (media) return media.paused;
    const state = playbackBridge()?.session?.playbackState;
    if (state === 'playing') return false;
    if (state === 'paused') return true;
    const button = controls();
    if (button) {
      const label = button.getAttribute('aria-label') || button.title || '';
      if (/pause|paus|pausa|暂停|一時停止|일시.*정지/i.test(label)) return false;
      if (/play|spela|reproducir|wiedergabe|lecture|riproduci|播放|再生|재생/i.test(label)) return true;
    }
    return nativeMedia()?.paused ?? true;
  }
  function createPlayer() {
    const bridge = playbackBridge();
    if (bridge) {
      bridge.keyProvider = mediaUrl;
      if (bridge.position && !bridge.position.key) bridge.position.key = mediaUrl();
    }
    const events = document.createDocumentFragment();
    let lastPaused = true;
    let pendingPause = null, pendingSeek = null;
    let boundKey = mediaUrl();
    let lastSource = '';
    function notifyPaused(paused) {
      if (paused === lastPaused) return;
      lastPaused = paused;
      events.dispatchEvent(new Event(paused ? 'pause' : 'play'));
    }
    function setPaused(paused) {
      if (player.paused === paused) return Promise.resolve();
      const button = controls(), media = nativeMedia();
      const action = paused ? 'pause' : 'play';
      const handler = bridge && bridge.handlers[action];
      if (!media && !handler && !button) return Promise.resolve();
      pendingPause = {value: paused, until: Date.now() + 1500};
      let result;
      if (media) result = paused ? media.pause() : media.play();
      else if (handler) result = handler({action});
      else button.click();
      // Deliver every programmatic pause/play, even a pause immediately
      // followed by replay. Polling only the final state would lose both.
      notifyPaused(paused);
      return result || Promise.resolve();
    }
    function rememberSeek(time) {
      pendingSeek = null;
      if (Math.abs(player.currentTime - time) > 1) pendingSeek = {time, until: Date.now() + 500};
    }
    const player = {
      get isConnected() { return !!controls() || !!nativeMedia() || !!sessionPosition(); },
      get duration() {
        const mediaDuration = nativeMedia()?.duration;
        return Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration :
          sessionPosition()?.duration || clock('[data-testid="playback-duration"]') || accessibleDuration() || 0;
      },
      get currentTime() {
        if (pendingSeek && Date.now() < pendingSeek.until) return pendingSeek.time;
        pendingSeek = null;
        const media = nativeMedia();
        if (media) return media.currentTime;
        const session = sessionPosition();
        if (session) return session.position;
        const bar = progress();
        if (bar && !bar.disabled && player.duration > 0) {
          const min = Number(bar.getAttribute('aria-valuemin') || bar.min || 0);
          const max = Number(bar.getAttribute('aria-valuemax') || bar.max || 100);
          const now = Number(bar.getAttribute('aria-valuenow') ?? bar.value);
          if (Number.isFinite(now) && max > min) return (now - min) / (max - min) * player.duration;
        }
        // SRT cue boundaries contain milliseconds. Reading the rounded text
        // first could miss an entire short cue between two displayed seconds.
        return clock('[data-testid="playback-position"]') ?? NaN;
      },
      set currentTime(time) { player.seekTo(time); },
      seekTo(time) {
        if (!Number.isFinite(time) || time < 0) return false;
        const duration = player.duration;
        const target = duration > 0 ? Math.min(duration, time) : time;
        const media = nativeMedia();
        if (media) {
          media.currentTime = target;
          rememberSeek(target);
          return true;
        }
        if (bridge && typeof bridge.handlers.seekto === 'function') {
          bridge.handlers.seekto({action: 'seekto', seekTime: target, fastSeek: false});
          rememberSeek(target);
          return true;
        }
        const delta = target - player.currentTime;
        const action = delta < 0 ? 'seekbackward' : 'seekforward';
        if (Number.isFinite(delta) && bridge && typeof bridge.handlers[action] === 'function') {
          bridge.handlers[action]({action, seekOffset: Math.abs(delta)});
          rememberSeek(target);
          return true;
        }
        const bar = progress();
        if (!bar || bar.disabled || !duration) return false;
        if (bar.tagName === 'INPUT') {
          const min = Number(bar.min || 0), max = Number(bar.max || 100);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(bar, String(min + target / duration * (max - min)));
          bar.dispatchEvent(new Event('input', {bubbles: true}));
          bar.dispatchEvent(new Event('change', {bubbles: true}));
          rememberSeek(target);
          return true;
        }
        const rect = bar.getBoundingClientRect();
        if (!rect.width) return false;
        const init = {bubbles: true, clientX: rect.left + rect.width * target / duration,
          clientY: rect.top + rect.height / 2, button: 0, view: window};
        // Spotify has used both pointer and mouse handlers for the seek bar.
        if (typeof PointerEvent === 'function') {
          bar.dispatchEvent(new PointerEvent('pointerdown', {...init, buttons: 1, pointerId: 1, pointerType: 'mouse'}));
          document.dispatchEvent(new PointerEvent('pointerup', {...init, pointerId: 1, pointerType: 'mouse'}));
        }
        bar.dispatchEvent(new MouseEvent('mousedown', {...init, buttons: 1}));
        document.dispatchEvent(new MouseEvent('mouseup', init));
        bar.dispatchEvent(new MouseEvent('click', init));
        rememberSeek(target);
        return true;
      },
      get canSeek() {
        return !!nativeMedia() || !!(bridge && (bridge.handlers.seekto ||
          (bridge.handlers.seekbackward && bridge.handlers.seekforward))) ||
          !!(progress() && !progress().disabled && player.duration > 0);
      },
      get statusMessage() {
        if (!Number.isFinite(player.currentTime)) return 'Spotify playback is not connected. Pause and resume the episode once to connect subtitles.';
        if (!player.canSeek) return 'Playback position detected, but seeking is not connected. Pause and resume Spotify once to connect its controls.';
        return '';
      },
      get paused() {
        const observed = observedPaused();
        if (pendingPause) {
          if (observed === pendingPause.value || Date.now() >= pendingPause.until) pendingPause = null;
          else return pendingPause.value;
        }
        return observed;
      },
      pause() { setPaused(true); },
      play() { return setPaused(false); },
      get playbackRate() { return nativeMedia()?.playbackRate || 1; },
      set playbackRate(rate) { const media = nativeMedia(); if (media) media.playbackRate = rate; },
      addEventListener: (...args) => events.addEventListener(...args),
      removeEventListener: (...args) => events.removeEventListener(...args),
      poll() {
        if (boundKey !== mediaUrl()) {
          boundKey = mediaUrl();
          pendingPause = null; pendingSeek = null;
          lastPaused = player.paused;
        }
        notifyPaused(player.paused);
        events.dispatchEvent(new Event('timeupdate'));
        const source = nativeMedia() ? 'audio/video' : sessionPosition() ? 'media-session' :
          progress() ? 'slider' : Number.isFinite(player.currentTime) ? 'clock-text' : 'unavailable';
        const diagnostic = source + ' seek=' + player.canSeek;
        if (diagnostic !== lastSource) { lastSource = diagnostic; console.log('[spotify] playback source=' + diagnostic); }
        const footer = document.querySelector('[data-testid="now-playing-bar"], .Root__now-playing-bar');
        const height = footer && footer.getBoundingClientRect().height;
        if (height > 0) document.body.style.setProperty('--cup-spotify-footer-h', height + 'px');
      },
    };
    lastPaused = player.paused;
    return player;
  }
  shared.spotifyMediaUrl = mediaUrl;
  shared.createSpotifyPlayer = createPlayer;
})();
