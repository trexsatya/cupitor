// public/play-session.js
// A playback session: a scene played against a clock (the narration's audio
// when there is one), with cues at absolute times, captions, chapters,
// project functions (define) and hooks (use). See
// reusable_animation_runtime_handoff.md, sections 3–5.
//
// The page's own player state is the one state: pausing goes through
// env.pausePlayback / env.resumePlayback (which freeze animations and
// waits), and those announce the change with a 'playpause' event on the
// window; the session pauses or plays the audio from that event. So the
// toolbar, the Space key and session.pause() all do the same thing.
//
// One operation owns the scene at a time: a rebuild (seek, prepare) or a run
// (play). Starting another, stopping or disposing cancels it; a cancelled
// operation makes no further change after its current await. Cues start at
// their times and may overlap; a cue still running when a new rebuild
// starts is given a moment to finish before the scene is reset.
//
// Recording (play({record})): see play-recorder.js. The recorder starts
// before the narration, pauses with the page (so a pause is not in the
// film), and stop() gives the film; 'recordingready' announces it however
// the run ended. Seeking is refused while recording.
//
// env (default: the page's globals): pausePlayback, resumePlayback, playNow,
// playTimeout, setTimeout, caption, enterPlayMode, exitPlayMode,
// requestAnimationFrame, cancelAnimationFrame, addEventListener,
// removeEventListener, URL, createAudio().

import { createRecorder, audioGraph, downloadBlob } from './play-recorder.js';

export const STATES = ['idle', 'ready', 'playing', 'paused', 'ended', 'stopped', 'error'];
const HOOKS = ['beforeCue', 'afterCue', 'onReset', 'onSeek', 'onStateChange', 'exportFrame', 'rasterize', 'formatCaption'];
// A cue starting later than `late` seconds after its time is reported as
// late; one further behind than `catchUp` is played at once (immediate).
// `settle`: seconds a cancelled cue gets to finish before a rebuild resets the scene.
const DEFAULTS = { late: 0.25, catchUp: 1.5, settle: 1 };

export function createPlaybackSession({ scene = null, env = globalThis, options = {} } = {}) {
  const opts = { ...DEFAULTS, ...options };
  const listeners = new Map();
  const functions = new Map();
  const hooks = [];
  let state = 'idle';
  let timeline = { reset: null, preload: null, cues: [], captions: [], chapters: [] };
  let preloaded = false;
  let audio = null, ownedUrl = null, audioOwned = false, loading = 0, pendingLoad = null;
  let audioRecordable = true; // false: narration from a site without CORS (plays, but a recording would be silent)
  let current = null;       // the operation that owns the scene: {abort, forPlay, next}
  let run = null;           // that operation while it plays (or is paused)
  const inflight = new Set(); // cue promises not yet settled
  let shownCaption;         // the caption on screen (undefined: unknown)
  let captionText = null;   // its text as shown (after formatCaption)
  let rec = null;           // the recorder while recording
  let finishing = null;     // the film being finished
  let recording = null;     // the last film: {blob, filename, partial}
  let audit = [];
  let frame = null;
  let clockBase = 0, clockStart = 0, clockRunning = false; // the clock without audio
  let inPlayMode = false, listening = false;
  let disposed = false;

  // ---- events ----
  const emit = (type, detail) => (listeners.get(type) || []).slice().forEach(fn => {
    try { fn(detail); } catch (e) { if (type !== 'error') emit('error', { stage: `listener:${type}`, error: e }); }
  });
  const on = (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
    return () => listeners.set(type, (listeners.get(type) || []).filter(f => f !== fn));
  };

  // ---- hooks ----
  // Each hook runs in registration order; one that throws is reported with its name and stage.
  async function callHooks(stage, ...args) {
    for (const h of hooks.slice()) {
      if (typeof h[stage] !== 'function') continue;
      try { await h[stage](...args); } catch (error) { emit('error', { stage, hook: h.name, error }); }
    }
  }
  // formatCaption is synchronous: it returns the caption to show.
  function formatCaption(c) {
    let out = c;
    for (const h of hooks) {
      if (typeof h.formatCaption !== 'function') continue;
      try {
        const next = h.formatCaption(out);
        if (next && typeof next.then === 'function') throw new Error('formatCaption must return a caption, not a promise');
        out = next || out;
      } catch (error) { emit('error', { stage: 'formatCaption', hook: h.name, error }); }
    }
    return out;
  }

  // onStateChange hooks are not waited for.
  function setState(next) {
    if (next === state) return;
    const from = state;
    state = next;
    emit('statechange', { from, to: next });
    callHooks('onStateChange', from, next);
  }

  // ---- operations ----
  function begin(forPlay = false) {
    cancel();
    current = { abort: new AbortController(), forPlay };
    return current;
  }
  function cancel() {
    if (current) current.abort.abort();
    current = null;
  }
  const alive = op => op === current && !disposed;
  // Keeps a cue's promise until it settles, so a rebuild can wait for it.
  function track(value) {
    const p = Promise.resolve(value);
    inflight.add(p);
    p.then(() => inflight.delete(p), () => inflight.delete(p));
    return p;
  }
  function settle() {
    if (!inflight.size) return null;
    const timer = env.setTimeout || setTimeout;
    return Promise.race([Promise.allSettled([...inflight]), new Promise(resolve => timer(resolve, opts.settle * 1000))]);
  }

  // ---- the clock (seconds) ----
  const now = () => (audio ? audio.currentTime : clockBase + (clockRunning ? (env.playNow() - clockStart) / 1000 : 0));
  function setClock(t) {
    if (audio) audio.currentTime = t;
    else { clockBase = t; clockStart = env.playNow(); }
  }
  const duration = () => {
    if (audio && Number.isFinite(audio.duration)) return audio.duration;
    const ends = [...timeline.cues.map(c => c.at), ...timeline.captions.map(c => c.end)];
    return ends.length ? Math.max(...ends) : 0;
  };

  // ---- page pause state -> audio ----
  const onPlayPause = e => {
    if (!run) return;
    if (e.detail && e.detail.paused) {
      if (audio) audio.pause();
      if (rec) rec.pause();
      if (state === 'playing') setState('paused');
    } else if (state === 'paused') {
      const r = run;
      if (rec) rec.resume();
      if (audio) audio.play().catch(error => { if (run === r && state === 'playing' && error.name !== 'AbortError') fail('audio', error); });
      setState('playing');
    }
  };
  const onPageStop = () => { if (run || (current && current.forPlay)) stop(); };
  function listen(yes) {
    if (yes === listening || !env.addEventListener) return;
    listening = yes;
    const how = yes ? 'addEventListener' : 'removeEventListener';
    env[how]('playpause', onPlayPause);
    env[how]('playstop', onPageStop);
  }

  function fail(stage, error, extra) {
    emit('error', { stage, error, ...extra });
    halt({ partial: true });
    clearCaption();
    setState('error');
  }

  // ---- captions ----
  function clearCaption() { captionText = null; env.caption(null); }
  function showCaptionAt(t) {
    const c = timeline.captions.find(x => x.start <= t && t < x.end) || null;
    if (c === shownCaption) return;
    shownCaption = c;
    if (!c) { captionText = null; env.caption(null); return; }
    const f = formatCaption({ ...c });
    captionText = f.text;
    env.caption(f.text, { id: f.id });
  }

  // While playing: time and captions follow the clock every frame.
  function tick() {
    frame = null;
    if (!run) return;
    const t = now();
    try { showCaptionAt(t); } catch (error) { emit('error', { stage: 'caption', error }); }
    emit('timechange', { time: t });
    frame = env.requestAnimationFrame(tick);
  }

  // ---- registered functions ----
  function define(name, fn, { replace = false } = {}) {
    if (typeof name !== 'string' || !name) throw new Error('define: a name is required');
    const def = typeof fn === 'function' ? { run: fn } : fn;
    if (!def || typeof def.run !== 'function') throw new Error(`define: "${name}" needs a run function`);
    if (functions.has(name) && !replace) throw new Error(`define: "${name}" is already defined (pass {replace: true} to replace it)`);
    functions.set(name, def);
    return () => { if (functions.get(name) === def) functions.delete(name); };
  }
  function contextFor(op, extra) {
    const ctx = {
      immediate: false, signal: op.abort.signal, session: api, time: now,
      call: (name, args) => {
        const def = functions.get(name);
        if (!def) throw new Error(`"${name}" is not a defined function (session.define it)`);
        return def.run(args, ctx);
      },
      ...extra
    };
    return ctx;
  }

  // ---- timeline ----
  const going = () => state === 'playing' || state === 'paused';
  function setTimeline(t) {
    if (disposed) throw new Error('setTimeline: the session is disposed');
    if (run || going()) throw new Error('setTimeline: stop playback first');
    const cues = (t.cues || []).map((c, i) => {
      if (typeof c.apply !== 'function') throw new Error(`cue ${c.id || i + 1}: apply must be a function`);
      if (!(Number.isFinite(c.at) && c.at >= 0)) throw new Error(`cue ${c.id || i + 1}: at must be seconds from the start`);
      const lead = c.lead == null ? 0 : c.lead;
      if (!(Number.isFinite(lead) && lead >= 0)) throw new Error(`cue ${c.id || i + 1}: lead must be seconds, 0 or more`);
      return { id: c.id || `cue${i + 1}`, at: c.at, lead, apply: c.apply, order: i };
    });
    // In time order (by effective start), ties kept in the order given.
    cues.sort((a, b) => (a.at - a.lead) - (b.at - b.lead) || a.order - b.order);
    const captions = (t.captions || []).map((c, i) => {
      if (!(c.end > c.start)) throw new Error(`caption ${c.id || i + 1}: end must be after start`);
      return { id: c.id || `caption${i + 1}`, start: c.start, end: c.end, text: String(c.text) };
    }).sort((a, b) => a.start - b.start);
    cancel(); // a rebuild of the old timeline
    timeline = { reset: t.reset || null, preload: t.preload || null, cues, captions, chapters: (t.chapters || []).slice().sort((a, b) => a.at - b.at) };
    preloaded = false;
    if (shownCaption) env.caption(null);
    shownCaption = undefined;
    setState('idle');
  }

  // ---- audio ----
  async function loadAudio(source) {
    if (disposed) throw new Error('loadAudio: the session is disposed');
    if (run || going()) throw new Error('loadAudio: stop playback first');
    const id = ++loading;
    releaseAudio();
    if (source == null) return { duration: duration() };
    let a;
    if (typeof source === 'object' && typeof source.play === 'function') { a = source; audioOwned = false; }
    else {
      a = env.createAudio ? env.createAudio() : new env.Audio();
      audioOwned = true;
      a.preload = 'auto';
      // Without CORS, narration from another site would be silent in the audio graph a recording uses.
      if (typeof source === 'string') { a.crossOrigin = 'anonymous'; a.src = source; }
      else { ownedUrl = env.URL.createObjectURL(source); a.src = ownedUrl; }
    }
    audio = a;
    audioRecordable = true;
    const loaded = () => (a.readyState >= 1 ? null : new Promise((resolve, reject) => {
      const ok = () => { done(); resolve(); }, bad = () => { done(); reject(new Error('the audio could not be loaded')); };
      const done = () => { pendingLoad = null; a.removeEventListener('loadedmetadata', ok); a.removeEventListener('error', bad); };
      // A later load, or disposing, ends this one.
      pendingLoad = () => { done(); reject(Object.assign(new Error('loadAudio: replaced by a later load'), { replaced: true })); };
      a.addEventListener('loadedmetadata', ok);
      a.addEventListener('error', bad);
    }));
    try {
      try { await loaded(); }
      catch (error) {
        // A server that does not allow CORS refuses the request made with it: load it
        // without, so it still plays (a recording then cannot take its sound).
        if (error.replaced || id !== loading || typeof source !== 'string' || !a.crossOrigin) throw error;
        a.crossOrigin = null;
        if (a.removeAttribute) a.removeAttribute('crossorigin');
        a.src = source;
        await loaded();
        audioRecordable = false;
      }
    } catch (error) {
      if (id === loading) releaseAudio();
      throw error;
    }
    if (id !== loading) throw new Error('loadAudio: replaced by a later load');
    a.addEventListener('ended', onAudioEnded);
    return { duration: duration() };
  }
  function releaseAudio() {
    if (pendingLoad) pendingLoad();
    if (!audio) return;
    const a = audio;
    audio = null;
    a.removeEventListener && a.removeEventListener('ended', onAudioEnded);
    if (audioOwned) {
      try { a.pause(); } catch (_) {}
      if (a.removeAttribute) { a.removeAttribute('src'); if (a.load) a.load(); } else a.src = '';
    }
    if (ownedUrl) { env.URL.revokeObjectURL(ownedUrl); ownedUrl = null; }
  }
  function onAudioEnded() { if (run) finish(); }

  // ---- rebuilding ----
  // Puts the scene as it is at time t: reset, then every cue starting at or
  // before t, at once and in order. A cue that fails is reported, not skipped silently.
  // Returns {aborted: true} when the operation was cancelled meanwhile.
  async function reconstruct(t, op, { notify = true, captions = true } = {}) {
    const gone = { aborted: true, problems: [] };
    const waiting = settle();
    if (waiting) await waiting;
    if (!alive(op)) return gone;
    const signal = op.abort.signal;
    if (timeline.reset) await timeline.reset({ signal });
    if (!alive(op)) return gone;
    await callHooks('onReset', { signal });
    const problems = [];
    for (const cue of timeline.cues) {
      if (cue.at - cue.lead > t) break;
      if (!alive(op)) return gone;
      try { await track(cue.apply(contextFor(op, { immediate: true, cue }))); }
      catch (error) { if (!alive(op)) return gone; problems.push({ cue: cue.id, error }); emit('error', { stage: 'reconstruct', cue: cue.id, error }); }
    }
    if (!alive(op)) return gone;
    if (notify) await callHooks('onSeek', t, { signal });
    if (!alive(op)) return gone;
    setClock(t);
    // A server that does not allow byte ranges leaves the audio unable to seek:
    // once the browser has tried, it is back at 0.
    const a = audio;
    if (a && t > 0.5) {
      if (a.seeking) {
        const timer = env.setTimeout || setTimeout;
        await new Promise(resolve => { const done = () => { a.removeEventListener('seeked', done); resolve(); }; a.addEventListener('seeked', done); timer(done, 1500); });
        if (!alive(op)) return gone;
      }
      if (Math.abs(a.currentTime - t) > 0.5) {
        const error = new Error(`the narration cannot be moved to ${t} s (its server does not allow seeking, or it is shorter)`);
        problems.push({ cue: 'narration', error });
        emit('error', { stage: 'seek', error });
      }
    }
    if (captions) { shownCaption = undefined; showCaptionAt(t); }
    emit('timechange', { time: t });
    const next = timeline.cues.findIndex(c => c.at - c.lead > t);
    return { problems, next: next < 0 ? timeline.cues.length : next };
  }

  async function prepare() {
    if (disposed) throw new Error('prepare: the session is disposed');
    if (run || going()) throw new Error('prepare: stop playback first');
    const op = begin();
    try {
      if (timeline.preload && !preloaded) { await timeline.preload({ signal: op.abort.signal }); if (!alive(op)) return; preloaded = true; }
      const rebuilt = await reconstruct(0, op, { notify: false, captions: false });
      if (!rebuilt.aborted && shownCaption) { shownCaption = null; env.caption(null); } // 9: no caption left from before
      if (rebuilt.aborted) return;
      current = null;
      if (state === 'idle') setState('ready');
    } catch (error) {
      if (!alive(op)) return;
      current = null;
      fail('prepare', error);
      throw error;
    }
  }

  // ---- playing ----
  // Starts paused when the page is paused.
  // record: true or options (play-recorder.js RECORD_DEFAULTS); call it from
  // the user's click, so the audio can start.
  async function play({ from = 0, record = null } = {}) {
    if (disposed) throw new Error('play: the session is disposed');
    if (run) throw new Error('play: already playing');
    if (pendingLoad) throw new Error('play: the audio is still loading');
    if (!(Number.isFinite(from) && from >= 0)) throw new Error('play: from must be seconds, 0 or more');
    if (record && env.playRate && env.playRate() !== 1) throw new Error('play: recording needs normal speed (1×)');
    if (record && audio && record.audio !== false && !audioRecordable) {
      throw new Error('play: the narration comes from a site that does not allow recording its sound (no CORS); serve it from this site, or record without it (record.audio false)');
    }
    if (record && audio && record.audio !== false) {
      // Still inside the click: the audio graph may only start from a user action.
      let g;
      try { g = audioGraph(env, audio); } catch (error) { throw new Error(`play: the narration cannot be recorded here (${error.message})`); }
      if (g.context.state === 'suspended') Promise.resolve(g.context.resume()).catch(error => emit('error', { stage: 'audio', error }));
    }
    return start(from, from > 0, record);
  }
  // Play mode is on from the start, so the page's Escape stops a run still being rebuilt.
  async function start(from, notify, record = null) {
    const op = begin(true);
    finishing = null; // stop() gives this run's film, not an earlier one
    listen(true);
    if (!inPlayMode) { env.enterPlayMode && env.enterPlayMode(); inPlayMode = true; }
    // Cancelled before it ran (a stop, or a seek or prepare that took over).
    const abandoned = () => {
      if (!run && !(current && current.forPlay)) leavePlayMode();
      return { problems: [], aborted: true };
    };
    let stage = 'preload';
    let r = null; // this run's recorder (set as the session's once it runs)
    try {
      if (timeline.preload && !preloaded) { await timeline.preload({ signal: op.abort.signal }); if (!alive(op)) return abandoned(); preloaded = true; }
      stage = 'reconstruct';
      const rebuilt = await reconstruct(from, op, { notify });
      if (rebuilt.aborted) return abandoned();
      if (record) {
        stage = 'record';
        r = createRecorder({
          env, options: record === true ? {} : record,
          canvases: ((record && record.canvases) || [env.pc, env.oc]).filter(Boolean),
          caption: () => captionText, hooks: () => hooks, audio, time: now,
          onError: error => { if (rec === r) failRecording(error); }
        });
        await r.prepare();
        if (!alive(op)) { r.finish({ discard: true }); return abandoned(); }
        await r.start();
        if (!alive(op)) { r.finish({ discard: true }); return abandoned(); }
        if (r.error) throw r.error; // a first frame that failed
        rec = r;
      }
      op.next = rebuilt.next;
      op.problems = rebuilt.problems;
      op.running = new Set();
      run = op;
      audit = [];
      if (duration() > 0 && from >= duration()) { finish(); return { problems: op.problems }; }
      const paused = !!env._playPaused;
      if (paused && rec) rec.pause();
      if (!audio) { setClock(from); clockRunning = true; }
      setState(paused ? 'paused' : 'playing');
      tick();
      schedule(op);
      stage = 'audio';
      if (audio && !paused) await audio.play();
      return { problems: op.problems };
    } catch (error) {
      if (r && rec !== r) r.finish({ discard: true });
      // Our own stop or pause interrupting audio.play() is not a failure.
      if (!alive(op)) return run ? { problems: op.problems || [] } : abandoned();
      if (stage === 'record') { failRecording(error); throw error; }
      if ((stage === 'audio' && (state === 'paused' || error.name === 'AbortError'))) return { problems: op.problems || [] };
      fail(stage, error);
      throw error;
    }
  }

  // Starts each cue at its time (cues may overlap); one far behind is played at once.
  async function schedule(op) {
    while (alive(op) && op.next < timeline.cues.length) {
      const cue = timeline.cues[op.next];
      const start = cue.at - cue.lead;
      while (alive(op) && now() < start) await wait(Math.min(50, Math.max(5, (start - now()) * 1000)));
      if (!alive(op)) return;
      op.next += 1;
      const behind = now() - start;
      const ctx = contextFor(op, { immediate: behind > opts.catchUp, cue });
      await callHooks('beforeCue', cue, ctx);
      if (!alive(op)) return;
      runCue(op, cue, ctx, start, behind);
    }
    // Without audio, the end is the last caption or cue.
    if (alive(op) && !audio) {
      while (alive(op) && now() < duration()) await wait(50);
      if (op.running.size) await Promise.allSettled([...op.running]);
      if (alive(op)) finish();
    }
  }
  async function runCue(op, cue, ctx, start, behind) {
    const begun = now();
    let error = null;
    // Kept per run, so the end without audio can wait for it.
    const p = (async () => {
      try { await track(cue.apply(ctx)); } catch (e) { error = e; }
      if (!alive(op)) return;
      if (error) emit('error', { stage: 'cue', cue: cue.id, error });
      const timing = { cue: cue.id, target: start, begun, finished: now(), late: behind > opts.late, caughtUp: ctx.immediate };
      if (error) timing.error = String((error && error.message) || error);
      audit.push(timing);
      emit('cue', timing);
      await callHooks('afterCue', cue, ctx, timing);
    })();
    op.running.add(p);
    await p;
    op.running.delete(p);
  }
  const wait = ms => new Promise(resolve => env.playTimeout(resolve, ms));

  function finish() {
    halt({ partial: false, tail: 300 });
    clearCaption();
    emit('timechange', { time: now() });
    setState('ended');
    emit('ended', { audit: audit.slice() });
  }

  // Stops what is running: cues, frames, audio. `keep` (a seek that carries
  // on) leaves the page's play mode and pause as they are.
  // A recording is finished with it: whole (`partial` false) only when the
  // narration came to its end; `discard` keeps no film.
  function halt({ keep = false, partial = true, discard = false, tail = 0 } = {}) {
    cancel();
    run = null;
    if (frame != null) { env.cancelAnimationFrame(frame); frame = null; }
    if (!audio && clockRunning) { clockBase = now(); clockRunning = false; }
    if (audio) { try { audio.pause(); } catch (_) {} }
    if (rec) finishRecording({ partial, discard, tail });
    if (!keep) leavePlayMode();
  }
  // Ends the recorder; a film (or what there is of it) is announced.
  function finishRecording({ partial, discard, tail }) {
    const r = rec;
    rec = null;
    finishing = r.finish({ discard, tail }).then(blob => {
      if (!blob) return null;
      recording = { blob, filename: r.filename, partial };
      emit('recordingready', { recording: blob, filename: r.filename, partial });
      return blob;
    });
    return finishing;
  }
  function failRecording(error) {
    fail(error.stage || 'record', error, error.hook ? { hook: error.hook } : undefined);
  }
  function leavePlayMode() {
    listen(false);
    if (inPlayMode) {
      inPlayMode = false;
      if (env._playPaused) env.resumePlayback && env.resumePlayback(); // the page is not left frozen
      env.exitPlayMode && env.exitPlayMode();
    }
  }

  function pause() { if (state === 'playing') env.pausePlayback(); }
  async function resume() { if (state === 'paused') env.resumePlayback(); }

  // Gives the film of the run (also after it ended by itself); discard: true keeps none.
  async function stop({ discard = false } = {}) {
    if (run || going() || (current && current.forPlay)) {
      halt({ discard });
      clearCaption();
      setState('stopped');
    } else cancel();
    const film = finishing ? await finishing : null;
    return { recording: film, audit: audit.slice() };
  }

  async function seek(t) {
    if (disposed) throw new Error('seek: the session is disposed');
    if (!(Number.isFinite(t) && t >= 0)) throw new Error('seek: time must be seconds, 0 or more');
    if (rec) throw new Error('seek: not while recording (stop first)');
    const at = Math.min(t, duration() || t);
    // Playing or paused carries on (or stays paused) from the new time; otherwise it is only shown there.
    if (going()) {
      halt({ keep: true });
      return start(at, true);
    }
    const op = begin();
    try {
      const rebuilt = await reconstruct(at, op);
      if (rebuilt.aborted) return { problems: [], aborted: true };
      current = null;
      if (state === 'idle') setState('ready');
      return { problems: rebuilt.problems };
    } catch (error) {
      if (!alive(op)) return { problems: [], aborted: true };
      current = null;
      fail('seek', error);
      throw error;
    }
  }

  function use(h) {
    if (!h || typeof h !== 'object') throw new Error('use: give an object of hooks');
    const unknown = Object.keys(h).filter(k => k !== 'name' && !HOOKS.includes(k));
    if (unknown.length) throw new Error(`use: unknown hook${unknown.length > 1 ? 's' : ''} ${unknown.join(', ')} (one of ${HOOKS.join(', ')})`);
    const entry = { name: h.name || `hook${hooks.length + 1}`, ...h };
    hooks.push(entry);
    return () => { const i = hooks.indexOf(entry); if (i >= 0) hooks.splice(i, 1); };
  }

  // The chapter playing at time t (the last one starting at or before it), or null.
  function chapterAt(t) {
    let found = null;
    for (const c of timeline.chapters) if (c.at <= t) found = c;
    return found;
  }
  // Goes to a chapter by id or by number (0 is the first); playing carries on from there.
  async function seekChapter(which) {
    const c = typeof which === 'number' ? timeline.chapters[which] : timeline.chapters.find(x => x.id === which);
    if (!c) throw new Error(`seekChapter: no chapter ${JSON.stringify(which)}`);
    return seek(c.at);
  }

  async function dispose() {
    if (disposed) return;
    await stop();
    emit('dispose');
    cancel();
    disposed = true;
    listen(false);
    loading += 1;
    releaseAudio();
    listeners.clear();
    hooks.length = 0;
    functions.clear();
  }

  const api = {
    scene,
    get state() { return state; },
    get time() { return now(); },
    get duration() { return duration(); },
    get audit() { return audit.slice(); },
    get chapters() { return timeline.chapters.slice(); },
    get recording() { return recording; },
    get isRecording() { return !!rec; },
    get disposed() { return disposed; },
    chapterAt, seekChapter,
    // Saves the last film as a file.
    download(filename) {
      if (!recording) throw new Error('download: nothing has been recorded');
      downloadBlob(env.document, recording.blob, filename || recording.filename);
    },
    hooks: () => hooks.map(h => h.name),
    on, define, use, loadAudio, setTimeline, prepare, play, pause, resume, stop, seek, dispose,
    // A defined function called from a script line (not a cue): stopping the session aborts it.
    call: (name, args) => contextFor(run || { abort: new AbortController() }).call(name, args)
  };
  return api;
}
