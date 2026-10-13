import { createPlaybackSession } from './play-session.js';

// A page and an audio track on jest's clock: the audio's position moves
// while it plays; pausing the page announces it, as fabric.play.js does.
function fakePage() {
  const target = new EventTarget();
  let pausedAt = 0, pausedTotal = 0;
  const env = {
    _playPaused: false,
    playNow: () => (env._playPaused ? pausedAt : Date.now()) - pausedTotal,
    playTimeout: (fn, ms) => setTimeout(fn, ms),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    pausePlayback() {
      if (env._playPaused) return;
      env._playPaused = true; pausedAt = Date.now();
      target.dispatchEvent(new CustomEvent('playpause', { detail: { paused: true } }));
    },
    resumePlayback() {
      if (!env._playPaused) return;
      env._playPaused = false; pausedTotal += Date.now() - pausedAt;
      target.dispatchEvent(new CustomEvent('playpause', { detail: { paused: false } }));
    },
    captions: [],
    caption: jest.fn(text => { env.captions.push(text); return Promise.resolve(); }),
    enterPlayMode: jest.fn(), exitPlayMode: jest.fn(),
    requestAnimationFrame: fn => setTimeout(fn, 16), cancelAnimationFrame: id => clearTimeout(id),
    addEventListener: (...a) => target.addEventListener(...a), removeEventListener: (...a) => target.removeEventListener(...a),
    dispatch: type => target.dispatchEvent(new CustomEvent(type)),
    URL: { createObjectURL: () => 'blob:narration', revokeObjectURL: jest.fn() },
    createAudio: () => (env.audio = fakeAudio(20))
  };
  return env;
}

function fakeAudio(duration) {
  const t = new EventTarget();
  let pos = 0, since = null;
  const a = {
    duration, readyState: 1, src: '',
    get currentTime() { return Math.min(duration, pos + (since == null ? 0 : (Date.now() - since) / 1000)); },
    set currentTime(v) { pos = v; if (since != null) since = Date.now(); },
    get playing() { return since != null; },
    play: jest.fn(() => { if (since == null) since = Date.now(); return Promise.resolve(); }),
    pause: jest.fn(() => { if (since != null) { pos = a.currentTime; since = null; } }),
    _t: t,
    addEventListener: (...x) => t.addEventListener(...x), removeEventListener: (...x) => t.removeEventListener(...x),
    removeAttribute: () => { a.src = ''; },
    load: jest.fn(),
    end: () => t.dispatchEvent(new Event('ended')),
    dispatchError: () => t.dispatchEvent(new Event('error'))
  };
  return a;
}

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
// Moves jest's clock on, letting promises settle between steps.
async function advance(ms) {
  for (let left = ms; left > 0; left -= 10) { jest.advanceTimersByTime(Math.min(10, left)); await flush(); }
}

async function session(timeline, env = fakePage()) {
  const s = createPlaybackSession({ env });
  await s.loadAudio(new Blob(['x']));
  s.setTimeline(timeline);
  return { s, env };
}

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(0); });
afterEach(() => { jest.useRealTimers(); });

test('cues run at their absolute times against the audio (lead starts one early); captions follow the audio; the audio ending ends it', async () => {
  const ran = [];
  const { s, env } = await session({
    cues: [
      { id: 'two', at: 2, apply: () => { ran.push(['two', s.time]); } },
      { id: 'one', at: 1, apply: () => { ran.push(['one', s.time]); } },
      { id: 'early', at: 3, lead: 0.5, apply: () => { ran.push(['early', s.time]); } }
    ],
    captions: [{ start: 0.5, end: 1.5, text: 'First line.' }, { start: 2, end: 3, text: 'Second.' }]
  });
  const states = []; s.on('statechange', e => states.push(e.to));
  await s.play();
  expect(env.enterPlayMode).toHaveBeenCalled();
  await advance(3200);
  expect(ran.map(r => r[0])).toEqual(['one', 'two', 'early']);
  ran.forEach(([, at], i) => expect(Math.abs(at - [1, 2, 2.5][i])).toBeLessThan(0.06));
  expect(env.captions).toEqual([null, 'First line.', null, 'Second.', null]);
  expect(s.audit.map(a => a.cue)).toEqual(['one', 'two', 'early']);
  expect(s.audit.some(a => a.late)).toBe(false);
  const ended = jest.fn(); s.on('ended', ended);
  env.audio.end();
  expect(ended).toHaveBeenCalled();
  expect(states).toEqual(['playing', 'ended']);
  expect(env.exitPlayMode).toHaveBeenCalled();
});

test('the page\'s pause (toolbar, Space) pauses the audio and the cues together; resume carries on', async () => {
  const ran = jest.fn();
  const { s, env } = await session({ cues: [{ id: 'c', at: 2, apply: ran }] });
  await s.play();
  await advance(1000);
  env.pausePlayback(); // what the toolbar button and Space do
  expect(s.state).toBe('paused');
  expect(env.audio.playing).toBe(false);
  await advance(5000);
  expect(ran).not.toHaveBeenCalled();
  expect(Math.abs(s.time - 1)).toBeLessThan(0.05);
  s.resume();
  expect(s.state).toBe('playing');
  await advance(1100);
  expect(ran).toHaveBeenCalledTimes(1);
  // session.pause() is the same path.
  s.pause();
  expect(env._playPaused).toBe(true);
  expect(s.state).toBe('paused');
});

test('without audio the page\'s pausable clock keeps time, and the end is the last caption', async () => {
  const env = fakePage();
  const s = createPlaybackSession({ env });
  const ran = jest.fn();
  s.setTimeline({ cues: [{ at: 1, apply: ran }], captions: [{ start: 0, end: 2, text: 'Only line.' }] });
  const ended = jest.fn(); s.on('ended', ended);
  await s.play();
  await advance(500);
  env.pausePlayback();
  expect(s.state).toBe('paused');
  await advance(3000);
  expect(ran).not.toHaveBeenCalled();
  env.resumePlayback();
  await advance(1600);
  expect(ran).toHaveBeenCalled();
  expect(ended).toHaveBeenCalled();
});

test('defined functions: animated when played, the same end state when reached by seeking; an unknown one is reported by name; stop aborts', async () => {
  const scene = {};
  const env = fakePage();
  const s = createPlaybackSession({ env });
  await s.loadAudio(new Blob(['x']));
  let aborted = false;
  s.define('cone', {
    run: async ({ span }, { immediate, signal }) => {
      if (!immediate) {
        await new Promise((resolve, reject) => { const t = setTimeout(resolve, 400); signal.addEventListener('abort', () => { clearTimeout(t); aborted = true; reject(new Error('aborted')); }); });
      }
      scene.cone = span;
    }
  });
  expect(() => s.define('cone', () => {})).toThrow(/already defined/);
  s.setTimeline({
    reset: () => { delete scene.cone; delete scene.ghost; },
    cues: [
      { id: 'cone', at: 1, apply: ctx => ctx.call('cone', { span: 30 }) },
      { id: 'ghost', at: 2, apply: ctx => ctx.call('ghost') }
    ]
  });
  const errors = []; s.on('error', e => errors.push(e));
  await s.play();
  await advance(1600);
  const played = { ...scene };
  await s.stop();
  // Reached by seeking instead: the same end state, and the unknown function named.
  const report = await s.seek(2.5);
  expect(scene).toEqual(played);
  expect(report.problems.map(p => p.cue)).toEqual(['ghost']);
  expect(String(report.problems[0].error.message)).toMatch(/"ghost" is not a defined function/);
  // Stopped in the middle of its animation: aborted, and nothing changes afterwards.
  await s.seek(0);
  await s.play({ from: 0.9 });
  await advance(200);
  await s.stop();
  expect(aborted).toBe(true);
  await advance(1000);
  expect(scene.cone).toBeUndefined();
});

test('hooks run in order, can be removed, and one that throws is named without stopping playback; formatCaption changes the caption', async () => {
  const calls = [];
  const { s, env } = await session({ cues: [{ id: 'a', at: 0.5, apply: () => {} }, { id: 'b', at: 1, apply: () => {} }], captions: [{ start: 0, end: 2, text: 'hello' }] });
  s.use({ name: 'first', beforeCue: c => calls.push(`first:${c.id}`) });
  const remove = s.use({ name: 'second', beforeCue: c => calls.push(`second:${c.id}`) });
  s.use({ name: 'broken', afterCue: () => { throw new Error('boom'); } });
  s.use({ name: 'shout', formatCaption: c => ({ ...c, text: c.text.toUpperCase() }) });
  expect(() => s.use({ befoerCue: () => {} })).toThrow(/unknown hook befoerCue/);
  const errors = []; s.on('error', e => errors.push(e));
  await s.play();
  await advance(700);
  remove();
  await advance(600);
  expect(calls).toEqual(['first:a', 'second:a', 'first:b']);
  expect(errors.filter(e => e.hook === 'broken').map(e => e.stage)).toEqual(['afterCue', 'afterCue']);
  expect(s.audit.map(a => a.cue)).toEqual(['a', 'b']);
  expect(env.captions).toContain('HELLO');
});

test('cues start at their times and may overlap; one far behind is played at once and marked; a little late is only reported', async () => {
  const begun = [];
  const { s, env } = await session({
    cues: [
      { id: 'long', at: 0.2, apply: () => { begun.push('long'); return new Promise(r => setTimeout(r, 2000)); } },
      { id: 'next', at: 0.5, apply: () => { begun.push(['next', s.time]); } },
      { id: 'missed', at: 1, apply: ctx => { s.missedImmediate = ctx.immediate; } },
      { id: 'slightly', at: 2.6, apply: () => {} }
    ]
  });
  await s.play();
  await advance(700);
  expect(begun[1][0]).toBe('next'); // not held back by the long one
  expect(Math.abs(begun[1][1] - 0.5)).toBeLessThan(0.06);
  env.audio.currentTime = 3; // the page stalled: the clock jumped on
  await advance(100);
  const byId = Object.fromEntries(s.audit.map(a => [a.cue, a]));
  expect(byId.missed).toMatchObject({ late: true, caughtUp: true });
  expect(s.missedImmediate).toBe(true);
  expect(byId.slightly).toMatchObject({ late: true, caughtUp: false });
  expect(byId.next).toMatchObject({ late: false, caughtUp: false });
});

test('stopping while the scene is being rebuilt cancels it: play mode is on (so the page\'s Escape reaches it), nothing more is applied, it does not start playing', async () => {
  const applied = [];
  let release;
  const { s, env } = await session({
    reset: () => new Promise(r => { release = r; }),
    cues: [{ id: 'a', at: 0, apply: () => applied.push('a') }]
  });
  const playing = s.play({ from: 1 });
  await flush();
  expect(env.enterPlayMode).toHaveBeenCalled(); // Escape only acts in play mode
  env.dispatch('playstop'); // Escape
  expect(s.state).toBe('stopped');
  release();
  await playing;
  expect(applied).toEqual([]);
  expect(s.state).toBe('stopped');
  expect(env.audio.playing).toBe(false);
  expect(env.exitPlayMode).toHaveBeenCalled();
});

test('two seeks at once: the later one wins and the earlier one changes nothing after it', async () => {
  const scene = [];
  const releases = [];
  const { s } = await session({
    reset: () => { scene.length = 0; return new Promise(r => releases.push(r)); },
    cues: [1, 2, 3].map(at => ({ id: `c${at}`, at, apply: () => scene.push(at) }))
  });
  const first = s.seek(3.5);
  await flush();
  const second = s.seek(1.5);
  await flush();
  releases.forEach(r => r());
  expect((await first).aborted).toBe(true);
  await second;
  expect(scene).toEqual([1]);
  expect(s.state).toBe('ready');
  await advance(1000);
  expect(s.time).toBe(1.5); // the clock stands still while not playing
});

test('a cue that is slow to stop gets to finish before the scene is reset for a seek', async () => {
  const log = [];
  const { s } = await session({
    reset: () => log.push('reset'),
    cues: [{ id: 'slow', at: 0.1, apply: () => new Promise(r => setTimeout(() => { log.push('slow done'); r(); }, 300)) }] // ignores the signal
  });
  await s.play();
  await advance(200);
  log.length = 0;
  await s.stop();
  const seeking = s.seek(0);
  await advance(400);
  await seeking;
  expect(log).toEqual(['slow done', 'reset']);
});

test('seeking while paused stays paused (the audio never starts); a seek to the end ends it', async () => {
  const { s, env } = await session({ cues: [{ id: 'c', at: 5, apply: () => {} }] });
  await s.play();
  await advance(300);
  s.pause();
  env.audio.play.mockClear();
  await s.seek(4);
  expect(s.state).toBe('paused');
  expect(env._playPaused).toBe(true);
  expect(env.audio.play).not.toHaveBeenCalled();
  expect(env.exitPlayMode).not.toHaveBeenCalled();
  expect(s.time).toBe(4);
  s.resume();
  expect(s.state).toBe('playing');
  const ended = jest.fn(); s.on('ended', ended);
  await s.seek(99);
  expect(ended).toHaveBeenCalled();
  expect(s.state).toBe('ended');
  expect(env._playPaused).toBe(false);
});

test('a stop while the audio is starting is not an error, and play does not turn it back on', async () => {
  const { s, env } = await session({ cues: [] });
  let reject;
  env.audio.play.mockImplementationOnce(() => new Promise((_, r) => { reject = r; }));
  const errors = []; s.on('error', e => errors.push(e));
  const states = []; s.on('statechange', e => states.push(e.to));
  const playing = s.play();
  await flush();
  await s.stop();
  reject(Object.assign(new Error('interrupted'), { name: 'AbortError' }));
  await playing;
  await advance(100);
  expect(states).toEqual(['playing', 'stopped']);
  expect(errors).toEqual([]);
});

test('without audio the end waits for the last cue\'s animation to finish', async () => {
  const env = fakePage();
  const s = createPlaybackSession({ env });
  let done = false;
  s.setTimeline({ cues: [{ id: 'last', at: 1, apply: () => new Promise(r => setTimeout(() => { done = true; r(); }, 2000)) }] });
  const ended = jest.fn(); s.on('ended', ended);
  await s.play();
  await advance(1500);
  expect(ended).not.toHaveBeenCalled();
  await advance(1600);
  expect(done).toBe(true);
  expect(ended.mock.calls[0][0].audit.map(a => a.cue)).toEqual(['last']);
});

test('a later load ends one still loading; play waits for no load', async () => {
  const env = fakePage();
  env.createAudio = () => { const a = fakeAudio(5); a.readyState = 0; return (env.audio = a); };
  const s = createPlaybackSession({ env });
  const first = s.loadAudio(new Blob(['a']));
  await expect(s.play()).rejects.toThrow(/still loading/);
  s.loadAudio(null);
  await expect(first).rejects.toThrow(/replaced by a later load/);
});

test('seek(0) while playing tells onSeek; a cancelled seek whose reset rejects on abort is not an error', async () => {
  const seeks = [];
  const { s } = await session({ reset: ({ signal }) => new Promise((resolve, reject) => { if (s && s.slowReset) signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))); else resolve(); }), cues: [] });
  s.use({ onSeek: t => seeks.push(t) });
  await s.play();
  await advance(300);
  await s.seek(0);
  expect(seeks).toEqual([0]);
  await s.stop();
  s.slowReset = true;
  const errors = []; s.on('error', e => errors.push(e));
  const first = s.seek(2);
  await flush();
  s.slowReset = false;
  const second = s.seek(1);
  expect(await first).toMatchObject({ aborted: true });
  await second;
  expect(errors).toEqual([]);
  expect(s.state).toBe('stopped');
});

test('the page already paused when play starts: the session starts paused', async () => {
  const { s, env } = await session({ cues: [{ id: 'c', at: 0.5, apply: jest.fn() }] });
  env.pausePlayback();
  await s.play();
  expect(s.state).toBe('paused');
  expect(env.audio.playing).toBe(false);
  env.resumePlayback();
  expect(s.state).toBe('playing');
  expect(env.audio.playing).toBe(true);
});

test('prepare refuses while playing; a new timeline is preloaded again', async () => {
  const preload = jest.fn();
  const { s } = await session({ preload, cues: [] });
  await s.prepare();
  s.setTimeline({ preload, cues: [] });
  await s.play();
  expect(preload).toHaveBeenCalledTimes(2);
  await expect(s.prepare()).rejects.toThrow(/stop playback first/);
  expect(s.state).toBe('playing');
});

test('audio that cannot be loaded is released', async () => {
  const env = fakePage();
  env.createAudio = () => { const a = fakeAudio(5); a.readyState = 0; setTimeout(() => a.dispatchError(), 10); return (env.audio = a); };
  const s = createPlaybackSession({ env });
  const loading = s.loadAudio(new Blob(['x']));
  await advance(20);
  await expect(loading).rejects.toThrow(/could not be loaded/);
  expect(env.URL.revokeObjectURL).toHaveBeenCalled();
  expect(s.duration).toBe(0);
});

test('the page\'s Stop (Escape) stops the session; dispose is safe twice and releases what it made', async () => {
  const { s, env } = await session({ cues: [{ at: 5, apply: () => {} }] });
  await s.play();
  await advance(200);
  env.dispatch('playstop');
  expect(s.state).toBe('stopped');
  expect(env.audio.playing).toBe(false);
  await s.dispose();
  await s.dispose();
  expect(env.URL.revokeObjectURL).toHaveBeenCalledWith('blob:narration');
  await expect(s.play()).rejects.toThrow(/disposed/);
  expect(env.audio.load).toHaveBeenCalled();
  env.pausePlayback(); // no longer listened to
  expect(s.state).toBe('stopped');
});

test('narration that cannot seek (a server without byte ranges) is reported, not left silently at 0', async () => {
  const env = fakePage();
  // As a browser does: the new position at once, then back to 0 once it finds it cannot seek.
  env.createAudio = () => {
    const a = fakeAudio(20);
    let pos = 0;
    Object.defineProperty(a, 'currentTime', { get: () => pos, set: v => { pos = v; a.seeking = true; setTimeout(() => { pos = 0; a.seeking = false; a.dispatchEvent(new Event('seeked')); }, 10); } });
    a.dispatchEvent = e => a._t.dispatchEvent(e);
    return (env.audio = a);
  };
  const s = createPlaybackSession({ env });
  await s.loadAudio('narration.mp3');
  s.setTimeline({ cues: [] });
  const seeking = s.seek(5);
  await advance(30);
  const { problems } = await seeking;
  expect(problems.map(p => p.cue)).toEqual(['narration']);
  expect(String(problems[0].error.message)).toMatch(/cannot be moved to 5 s/);
});

test('narration from a site without CORS still plays (loaded again without it); recording it is refused by name', async () => {
  const env = fakePage();
  env.createAudio = () => {
    const a = fakeAudio(20);
    a.readyState = 0;
    let src = '';
    Object.defineProperty(a, 'src', { get: () => src, set: v => { src = v; setTimeout(() => { if (a.crossOrigin) a._t.dispatchEvent(new Event('error')); else { a.readyState = 1; a._t.dispatchEvent(new Event('loadedmetadata')); } }, 5); } });
    return (env.audio = a);
  };
  const s = createPlaybackSession({ env });
  const loading = s.loadAudio('https://elsewhere.example/talk.mp3');
  await advance(30);
  await loading;
  expect(env.audio.crossOrigin).toBeNull();
  s.setTimeline({ cues: [] });
  await expect(s.play({ record: true })).rejects.toThrow(/does not allow recording its sound/);
  expect(s.state).toBe('idle');
});

test('chapters: the one playing at a time, and seeking to one by id or number', async () => {
  const { s } = await session({ cues: [], chapters: [{ id: 'b', at: 4, title: 'B' }, { id: 'a', at: 0, title: 'A' }] });
  expect(s.chapterAt(3).id).toBe('a');
  expect(s.chapterAt(4).id).toBe('b');
  await s.seekChapter('b');
  expect(s.time).toBe(4);
  await s.seekChapter(0);
  expect(s.time).toBe(0);
  await expect(s.seekChapter('nope')).rejects.toThrow(/no chapter "nope"/);
});
