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
  const playbackLog = [];
  let droppedLogEvents = 0, lastPlaybackLogAt = -Infinity, lastPlaybackLogState = '';
  function log(event, details = {}) {
    const range = active && rangeOf(active);
    playbackLog.push({at: new Date().toISOString(), elapsedMs: now(), event,
      cardId: active?.item?.id || null, mode: active?.mode || null,
      episodeId: range?.id || null, segment: active?.index ?? null,
      start: range?.start ?? null, end: range?.end ?? null,
      desiredPaused: active?.desiredPaused ?? null,
      pendingSeek: active?.pendingSeek ?? null, ...details});
    if (playbackLog.length > 2000) {
      droppedLogEvents += playbackLog.length - 2000;
      playbackLog.splice(0, playbackLog.length - 2000);
    }
  }
  function logPlayback(state) {
    const key = JSON.stringify([state.isPaused, state.isBuffering, state.playingURI,
      active?.index, active?.pendingSeek, active?.complete]);
    if (key === lastPlaybackLogState && now() - lastPlaybackLogAt < 1000) return;
    lastPlaybackLogState = key; lastPlaybackLogAt = now();
    const numeric = value => value == null || !Number.isFinite(Number(value)) ? null : Number(value);
    log('playback', {position: numeric(state.position), duration: numeric(state.duration),
      isPaused: !!state.isPaused, isBuffering: !!state.isBuffering,
      playingURI: spotifyEpisode(state.playingURI)?.uri || null});
  }
  function getPlaybackLog() {
    return {version: 1, playerVersion: '20261020-spotify-integer-seek',
      exportedAt: new Date().toISOString(), userAgent: win.navigator?.userAgent || '',
      droppedEvents: droppedLogEvents, events: playbackLog.map(entry => ({...entry}))};
  }
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
  function pauseController() {if (controller) log('command:pause'); try {controller?.pause();} catch (_) {}}
  function settle(session, error, result = false) {
    if (session.settled) return;
    session.settled = true;
    if (error) session.reject(error); else session.resolve(result);
  }
  function fail(session, error) {
    if (!current(session)) return;
    log('error', {message: error.message});
    session.complete = true; session.paused = true; pauseController();
    message(error.message); onStatus(error.message); settle(session, error);
  }
  function stop({hide = true} = {}) {
    const previous = active;
    if (previous) log('stop');
    active = null;
    pauseController();
    if (timer != null) win.clearInterval(timer);
    timer = null;
    if (previous) settle(previous, null);
    if (hide) doc.body.classList.remove('study-spotify');
    const button = doc.querySelector('#practiceMode .practice-play');
    if (button) {button.textContent = '▶'; button.setAttribute('aria-label', 'Play clip');}
  }
  function commandPlay(session, {retry = false} = {}) {
    if (!current(session) || !ready || (session.pendingSeek && !session.initializing && !session.seekAttempts) || session.buffering ||
        session.desiredPaused || session.isPaused() || session.complete || !isForeground()) return;
    if (retry && session.resumeAttempts >= 3) return;
    session.resumeAttempts = retry ? session.resumeAttempts + 1 : 1;
    session.resumePending = true; session.recovering = true; session.commandAt = now();
    // Activate loadEntity(startAt) with Play once. After activation, Play may
    // restart the episode, so subsequent seek/buffering recovery uses Resume.
    const method = session.initializing && typeof controller.play === 'function' ? 'play'
      : typeof controller.resume === 'function' ? 'resume' : 'play';
    log('command:' + method, {attempt: session.resumeAttempts});
    try {controller[method]();} catch (error) {fail(session, error);}
  }
  function setPaused(session, paused) {
    session.desiredPaused = paused; session.userPaused = paused;
    log('intent', {paused});
    session.resumeAttempts = 0;
    if (paused) {
      session.resumePending = false; session.commandAt = now(); pauseController();
    } else commandPlay(session);
  }
  function requestSeek(session) {
    session.lastSeekAt = now(); session.seekAttempts++;
    // Spotify documents seek() in whole seconds. Floor preserves the beginning
    // of a fractional cue, at the cost of less than one second of lead-in.
    const seconds = Math.floor(session.seekTarget);
    log('command:seek', {seconds, requestedSeconds: session.seekTarget, attempt: session.seekAttempts});
    try {
      controller.seek(seconds);
      // An already-paused iframe can hold its position notifications until it
      // resumes. Seek must be posted first, but waiting for its acknowledgement
      // before Resume can deadlock every card after the first.
      if (session.pendingSeek) commandPlay(session);
    } catch (error) {fail(session, error);}
  }
  function seekTo(session, target) {
    if (!current(session) || !ready || session.complete) return;
    // Own the temporary pause before issuing commands: callbacks may be synchronous.
    session.pendingSeek = true; session.initializing = false;
    session.recovering = true; session.resumePending = false;
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
    session.initializing = session.loadedForRange;
    if (session.loadedForRange) {
      loadedUri = range.uri; ready = false;
      try {
        const load = controller.loadEntity || controller.loadUri;
        log('command:load', {uri: range.uri, startAt: range.start});
        load.call(controller, range.uri, false, range.start);
      } catch (error) {fail(session, error);}
    } else if (ready) seekStart(session);
    paint(session);
  }
  function atEnd(session, estimated = false) {
    if (!current(session) || session.complete) return;
    log('clip-end', {estimated});
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
    logPlayback(state);
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
      log('external-play'); session.onExternalPause(false);
    }

    if (session.pendingSeek) {
      // Updates can arrive after playback has advanced beyond the exact target.
      // Accept a nearby position inside the clip, not a buffering placeholder or
      // the far-away clock left over from the preceding passage.
      const ahead = reportedPaused ? 1 : Math.max(1.5, (now() - session.seekAt) / 1000 + 0.25);
      if (!session.buffering && position >= Math.floor(session.seekTarget) - 0.25 &&
          position <= session.seekTarget + ahead && position < range.end) {
        session.pendingSeek = false; session.initializing = false; session.position = position; session.positionAt = now();
        session.lastProgressAt = now(); session.paused = reportedPaused;
        if (!reportedPaused) {
          session.everPlayed = true;
          session.recovering = position <= session.seekTarget + 0.01;
          session.resumePending = session.recovering && !session.desiredPaused;
          if (session.desiredPaused) pauseController();
        } else if (!session.desiredPaused) commandPlay(session);
        else session.recovering = false;
        paint(session);
      } else if (session.initializing) {
        // loadEntity(startAt) owns initial activation. An idle iframe may have no
        // audio list yet, so Pause/Seek can fail before the first real Play.
        // Correct a wrong clock only once Spotify reports actual playback.
        if (!reportedPaused && !session.buffering) seekTo(session, session.seekTarget);
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
        position >= Math.floor(range.start) - 0.25 && position < range.end &&
        now() - session.commandAt > 300 && !session.desiredPaused) {
      session.desiredPaused = true; session.userPaused = true;
      log('external-pause'); session.onExternalPause(true);
    }
    if (position >= range.end) {
      if (session.everPlayed || !reportedPaused) {session.position = position; atEnd(session);}
      else seekStart(session);
      return;
    }
    // A whole-second seek can legitimately land just before the SRT start.
    // Accept that short lead-in rather than pause/seek back on every update.
    if (!session.buffering && position < Math.floor(range.start) - 0.25) {seekStart(session); return;}

    const progressed = !reportedPaused && !session.buffering &&
      Number.isFinite(session.position) && position > session.position + 0.01;
    if (progressed) {
      session.lastProgressAt = now(); session.recovering = false;
      session.resumePending = false; session.resumeAttempts = 0;
    }
    session.position = position; session.positionAt = now(); session.paused = reportedPaused;
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
          value.addListener('ready', () => {
            ready = true; log('ready');
            if (active?.pendingSeek) {
              if (active.initializing) commandPlay(active);
              else seekTo(active, active.seekTarget);
            } else if (!active) pauseController();
          });
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
    // Spotify can report progress only about once a second. Stop between those
    // reports using its latest playing position, while the observation is fresh.
    // Pauses, buffering and unconfirmed seeks never consume this interval.
    const sincePosition = now() - session.positionAt;
    if (!session.pendingSeek && !session.paused && !session.buffering &&
        !session.desiredPaused && Number.isFinite(session.position) &&
        sincePosition >= 0 && sincePosition <= 1500 &&
        session.position + sincePosition / 1000 >= rangeOf(session).end) {
      atEnd(session, true); return;
    }
    if (session.recovering && !session.pendingSeek && !session.buffering && session.paused &&
        !session.desiredPaused && now() - session.commandAt >= 1000) commandPlay(session, {retry: true});
    if (session.pendingSeek && !session.initializing && ready && !session.buffering &&
        session.seekAttempts < 3 && now() - session.lastSeekAt >= 1500) requestSeek(session);
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
      desiredPaused: !autoplay, userPaused: false, position: NaN, positionAt: NaN, duration: NaN, buffering: false, everPlayed: false,
      recovering: false, resumePending: false, resumeAttempts: 0, seekAttempts: 0, seekTarget: segments[0].start, loadedForRange: false, initializing: false,
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
    log('cue', {segments: segments.length});
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
  return {cue, playCard, togglePractice, stop, getPlaybackLog, show: () => {
    if (!active || !current(active)) return;
    show(); holder.querySelector('iframe')?.focus();
  },
    get media() {return active?.media || null;}};
}
