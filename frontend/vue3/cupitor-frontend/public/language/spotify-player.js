import {spotifyEpisode, spotifyClipSegments} from './spotify-clips.js';

// Load Spotify's public embed SDK once. No Web API token is stored; Spotify's
// own visible player handles playback and sign-in.
export function loadSpotifyEmbedApi(win, timeoutMs = 20000) {
  if (win.__cupSpotifyEmbedApi) return Promise.resolve(win.__cupSpotifyEmbedApi);
  if (win.__cupSpotifyEmbedApiPromise) return win.__cupSpotifyEmbedApiPromise;
  const promise = new Promise((resolve, reject) => {
    const previous = win.onSpotifyIframeApiReady;
    const script = win.document.createElement('script');
    const fail = () => {
      win.clearTimeout(timer); script.remove();
      if (win.onSpotifyIframeApiReady === ready) win.onSpotifyIframeApiReady = previous;
      reject(new Error('Spotify could not load. Check the connection and try again.'));
    };
    const ready = api => {
      win.clearTimeout(timer);
      win.__cupSpotifyEmbedApi = api;
      try {if (typeof previous === 'function') previous(api);} catch (_) {}
      resolve(api);
    };
    const timer = win.setTimeout(fail, timeoutMs);
    win.onSpotifyIframeApiReady = ready;
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true; script.onerror = fail;
    win.document.head.append(script);
  });
  win.__cupSpotifyEmbedApiPromise = promise;
  promise.catch(() => {
    if (win.__cupSpotifyEmbedApiPromise === promise) win.__cupSpotifyEmbedApiPromise = null;
  });
  return promise;
}

export function createSpotifyStudyPlayer({win = window, loadApi = () => loadSpotifyEmbedApi(win),
  isForeground = () => !win.document.hidden, now = () => Date.now(), onStatus = () => {}} = {}) {
  const doc = win.document;
  let active = null, controller = null, creating = null, ready = false, loadedUri = '';
  let holder = null, status = null, embedMount = null, timer = null;
  const stamp = value => {
    const minutes = Math.floor(value / 60), seconds = (value % 60).toFixed(2).padStart(5, '0');
    return minutes + ':' + seconds;
  };
  const current = session => active === session && session.isCurrent();
  const rangeOf = session => session.segments[session.index];
  function message(text) {if (status) status.textContent = text;}
  function paint(session) {
    if (!current(session)) return;
    const range = rangeOf(session);
    const state = session.complete ? ' · Clip finished' : session.pendingSeek ? ' · Seeking…' : session.buffering ? ' · Buffering…' : '';
    message(`Spotify · ${stamp(range.start)}–${stamp(range.end)}${state}`);
    if (session.mode === 'practice') {
      const button = doc.querySelector('#practiceMode .practice-play');
      if (button) {
        button.textContent = session.desiredPaused || session.complete ? '▶' : '❚❚';
        button.setAttribute('aria-label', session.complete ? 'Replay Spotify clip' : session.desiredPaused ? 'Play Spotify clip' : 'Pause Spotify clip');
      }
    }
  }
  function show() {
    if (!holder) {
      let container = doc.getElementById('mediaContainer');
      if (!container) {container = doc.createElement('div'); container.id = 'mediaContainer'; doc.body.append(container);}
      holder = doc.createElement('div'); holder.id = 'spotifyClipPlayer';
      const embed = doc.createElement('div'); embed.className = 'spotify-clip-embed';
      embedMount = doc.createElement('div'); embed.append(embedMount);
      status = doc.createElement('div'); status.className = 'spotify-clip-status'; status.setAttribute('role', 'status');
      holder.append(embed, status); container.append(holder);
    }
    doc.body.classList.add('study-spotify');
    try {win.ytPlayer?.pauseVideo();} catch (_) {}
  }
  function pauseController() {try {controller?.pause();} catch (_) {}}
  function settle(session, error, result = false) {
    if (session.settled) return;
    session.settled = true;
    if (error) session.reject(error); else session.resolve(result);
  }
  function fail(session, error) {
    if (!current(session)) return;
    session.complete = true; session.paused = true; pauseController();
    message(error.message); onStatus(error.message); settle(session, error);
  }
  function stop({hide = true} = {}) {
    const previous = active; active = null;
    pauseController();
    if (timer != null) win.clearInterval(timer);
    timer = null;
    if (previous) settle(previous, null);
    if (hide) doc.body.classList.remove('study-spotify');
    const button = doc.querySelector('#practiceMode .practice-play');
    if (button) {button.textContent = '▶'; button.setAttribute('aria-label', 'Play clip');}
  }
  function commandPlay(session, {retry = false} = {}) {
    if (!current(session) || !ready || session.pendingSeek || session.buffering ||
        session.desiredPaused || session.complete || !isForeground()) return;
    if (retry && session.resumeAttempts >= 3) return;
    session.resumeAttempts = retry ? session.resumeAttempts + 1 : 1;
    session.resumePending = true; session.recovering = true; session.commandAt = now();
    // Play can restart the loaded entity. Resume preserves the confirmed seek.
    try {(controller.resume || controller.play).call(controller);} catch (error) {fail(session, error);}
  }
  function setPaused(session, paused) {
    session.desiredPaused = paused; session.userPaused = paused;
    session.resumeAttempts = 0;
    if (paused) {
      session.resumePending = false; session.commandAt = now(); pauseController();
    } else commandPlay(session);
  }
  function requestSeek(session) {
    session.lastSeekAt = now(); session.seekAttempts++;
    try {controller.seek(session.seekTarget);} catch (error) {fail(session, error);}
  }
  function seekTo(session, target) {
    if (!current(session) || !ready || session.complete) return;
    // Own the temporary pause before issuing commands: callbacks may be synchronous.
    session.pendingSeek = true; session.recovering = true; session.resumePending = false;
    session.seekTarget = target; session.seekAt = now(); session.seekAttempts = 0;
    session.position = NaN; session.paused = true; session.resumeAttempts = 0;
    pauseController(); requestSeek(session); paint(session);
  }
  function seekStart(session) {seekTo(session, rangeOf(session).start);}
  function loadRange(session) {
    if (!current(session) || !controller) return;
    const range = rangeOf(session);
    session.pendingSeek = true; session.seekAt = now(); session.everPlayed = false;
    session.seekTarget = range.start; session.seekAttempts = 0;
    session.recovering = true; session.resumePending = false; session.resumeAttempts = 0;
    session.position = NaN; session.paused = true; session.complete = false;
    session.loadedForRange = loadedUri !== range.uri;
    if (session.loadedForRange) {
      loadedUri = range.uri; ready = false;
      pauseController();
      try {
        const load = controller.loadEntity || controller.loadUri;
        load.call(controller, range.uri, false, range.start);
      } catch (error) {fail(session, error);}
    } else if (ready) seekStart(session);
    paint(session);
  }
  function atEnd(session) {
    if (!current(session) || session.complete) return;
    if (session.index + 1 < session.segments.length) {
      session.index++; loadRange(session);
    } else {
      // Mark completion before Pause can report back to the playlist owner.
      session.complete = true; session.paused = true; session.resumePending = false;
      pauseController(); paint(session); settle(session, null, true);
    }
  }
  function playbackUpdate(event) {
    const session = active, state = event?.data || {};
    if (!session || !current(session)) {if (!state.isPaused) pauseController(); return;}
    const range = rangeOf(session);
    if (state.playingURI && spotifyEpisode(state.playingURI)?.id !== range.id) return;
    if (session.complete) {if (!state.isPaused) pauseController(); return;}
    if (state.position == null) return;
    const position = Number(state.position) / 1000;
    if (!Number.isFinite(position)) return;
    const wasPaused = session.paused, wasBuffering = session.buffering;
    const reportedPaused = !!state.isPaused;
    session.duration = Number(state.duration) / 1000;
    session.buffering = !!state.isBuffering;
    if (session.buffering && !wasBuffering) {
      session.recovering = true; session.resumePending = false; session.resumeAttempts = 0;
    }

    // A real embedded Play may activate the initial episode before its seek
    // acknowledgement. Explicit Pause, backgrounding and a paused queue still win.
    const mayAdoptPlay = !session.pendingSeek ||
      (session.loadedForRange && !session.userPaused && !session.isPaused());
    if (!reportedPaused && !session.buffering && session.desiredPaused &&
        mayAdoptPlay && !session.backgroundHeld && isForeground() &&
        (!session.userPaused || now() - session.commandAt > 300)) {
      session.desiredPaused = false; session.userPaused = false; session.resumeAttempts = 0;
      session.onExternalPause(false);
    }

    if (session.pendingSeek) {
      // Updates can arrive after playback has advanced beyond the exact target.
      // Accept a nearby position inside the clip, not a buffering placeholder or
      // the far-away clock left over from the preceding passage.
      const ahead = reportedPaused ? 1 : Math.max(1.5, (now() - session.seekAt) / 1000 + 0.25);
      if (!session.buffering && position >= session.seekTarget - 0.25 &&
          position <= session.seekTarget + ahead && position < range.end) {
        session.pendingSeek = false; session.position = position;
        session.lastProgressAt = now(); session.paused = reportedPaused;
        if (!reportedPaused) {
          session.everPlayed = true;
          session.recovering = position <= session.seekTarget + 0.01;
          session.resumePending = session.recovering && !session.desiredPaused;
          if (session.desiredPaused) pauseController();
        } else if (!session.desiredPaused) commandPlay(session);
        else session.recovering = false;
        paint(session);
      } else {
        if (!reportedPaused && !session.buffering) pauseController();
        if (ready && !session.buffering && session.seekAttempts < 3 &&
            now() - session.lastSeekAt > 750) requestSeek(session);
      }
      return;
    }

    // Buffering and acknowledgements of our seek/resume are transport state.
    // Only a stable, independent pause is a change to the listener's intent.
    if (reportedPaused && !session.buffering && !session.recovering &&
        !session.resumePending && session.everPlayed && !wasPaused &&
        position >= range.start - 0.25 && position < range.end &&
        now() - session.commandAt > 300 && !session.desiredPaused) {
      session.desiredPaused = true; session.userPaused = true;
      session.onExternalPause(true);
    }
    if (position >= range.end) {
      if (session.everPlayed || !reportedPaused) {session.position = position; atEnd(session);}
      else seekStart(session);
      return;
    }
    if (!session.buffering && position < range.start - 0.25) {seekStart(session); return;}

    const progressed = !reportedPaused && !session.buffering &&
      Number.isFinite(session.position) && position > session.position + 0.01;
    if (progressed) {
      session.lastProgressAt = now(); session.recovering = false;
      session.resumePending = false; session.resumeAttempts = 0;
    }
    session.position = position; session.paused = reportedPaused;
    if (!reportedPaused && !session.buffering) session.everPlayed = true;
    if (session.recovering && !session.resumePending && reportedPaused &&
        !session.buffering && !session.desiredPaused) commandPlay(session);
    if (session.mode === 'player') {
      const bar = doc.querySelector('#recPlayingBanner .rec-pb-bar');
      if (bar) bar.style.width = Math.max(0, Math.min(100, (position - range.start) / (range.end - range.start) * 100)) + '%';
    }
    paint(session);
  }
  async function ensureController() {
    if (controller) return controller;
    if (creating) return creating;
    creating = loadApi().then(api => new Promise((resolve, reject) => {
      try {
        // Load even the first episode through loadEntity(..., startAt). An
        // initial URI alone makes the iframe's first Play start from zero.
        api.createController(embedMount, {width: '100%', height: 152}, value => {
          controller = value; loadedUri = '';
          value.addListener('ready', () => {ready = true; if (active?.pendingSeek) seekTo(active, active.seekTarget); else if (!active) pauseController();});
          value.addListener('playback_update', playbackUpdate);
          value.addListener('error', event => {
            if (active) fail(active, new Error(event?.data?.message || 'This Spotify episode could not be played.'));
          });
          resolve(value);
        });
      } catch (error) {reject(error);}
    }));
    try {return await creating;} finally {creating = null;}
  }
  function tick(session) {
    if (!current(session)) {if (active === session) stop(); return;}
    if (session.complete) return;
    const paused = !!session.isPaused();
    if (!isForeground() || paused) {
      if (paused) session.backgroundHeld = false;
      else if (!session.desiredPaused) session.backgroundHeld = true;
      if (!session.desiredPaused) {session.desiredPaused = true; session.userPaused = paused; session.resumePending = false; session.commandAt = now(); pauseController();}
      session.seekAt = now(); session.lastProgressAt = now();
      return;
    }
    if (session.desiredPaused && (session.mode === 'player' || session.backgroundHeld)) {
      session.backgroundHeld = false; session.desiredPaused = false; session.userPaused = false; session.resumeAttempts = 0; commandPlay(session);
    }
    if (session.recovering && !session.pendingSeek && !session.buffering && session.paused &&
        !session.desiredPaused && now() - session.commandAt >= 1000) commandPlay(session, {retry: true});
    if (session.pendingSeek && now() - session.seekAt > 20000) {
      fail(session, new Error('Spotify could not reach the clip timestamp. Try Play in the Spotify player.'));
    } else if (session.everPlayed && !session.desiredPaused && now() - session.lastProgressAt > 20000) {
      fail(session, new Error('Spotify playback stopped making progress.'));
    } else if (!session.everPlayed && !session.pendingSeek && now() - session.commandAt > 2500 && !session.desiredPaused) {
      message('Tap Play in the Spotify player to start this clip.');
    }
  }
  function cue(item, {mode = 'practice', isCurrent = () => true, isPaused = () => false,
    onExternalPause = () => {}, autoplay = false} = {}) {
    const segments = spotifyClipSegments(item);
    stop({hide: !segments.length});
    if (!segments.length) return null;
    show(); message('Loading Spotify…');
    let resolve, reject;
    const done = new Promise((yes, no) => {resolve = yes; reject = no;});
    // Practice cues need no awaiting caller; they must not leave a rejected
    // promise behind if the listener opens a different card while loading.
    done.catch(() => {});
    const session = active = {item, mode, segments, index: 0, isCurrent, isPaused, onExternalPause,
      resolve, reject, done, settled: false, complete: false, paused: true, pendingSeek: true,
      desiredPaused: !autoplay, userPaused: false, position: NaN, duration: NaN, buffering: false, everPlayed: false,
      recovering: false, resumePending: false, resumeAttempts: 0, seekAttempts: 0, seekTarget: segments[0].start, loadedForRange: false,
      seekAt: now(), lastSeekAt: now(), commandAt: now(), lastProgressAt: now()};
    session.media = {
      get paused() {return session.paused;}, get ended() {return session.complete;},
      get duration() {return rangeOf(session).end;}, get currentTime() {return session.position;},
      set currentTime(time) {
        if (current(session) && Number.isFinite(time)) {
          if (time >= rangeOf(session).end) atEnd(session);
          else seekTo(session, Math.max(rangeOf(session).start, time));
        }
      },
      pause() {if (current(session)) setPaused(session, true);},
      play() {
        if (current(session) && !session.complete) setPaused(session, false);
        return Promise.resolve();
      },
      set src(value) {if (!value && active === session) stop();},
    };
    timer = win.setInterval(() => tick(session), 100);
    ensureController().then(() => {if (current(session)) loadRange(session);}).catch(error => fail(session, error));
    return session;
  }
  function playCard(item, options = {}) {
    const session = cue(item, {...options, mode: 'player', autoplay: true});
    options.onMedia?.(session?.media || null);
    return session ? session.done : Promise.resolve(false);
  }
  function togglePractice(item, options = {}) {
    let session = active;
    if (!session || session.item !== item || session.mode !== 'practice' || session.complete) {
      session = cue(item, {...options, mode: 'practice', autoplay: true});
    } else {
      setPaused(session, !session.desiredPaused);
    }
    if (session) paint(session);
  }
  return {cue, playCard, togglePractice, stop, show: () => {
    if (!active || !current(active)) return;
    show(); holder.querySelector('iframe')?.focus();
  },
    get media() {return active?.media || null;}};
}
