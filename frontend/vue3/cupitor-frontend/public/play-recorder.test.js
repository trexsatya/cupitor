import { createPlaybackSession } from './play-session.js';
import { wrapCaption } from './play-recorder.js';

// The page, its scene canvas, the narration, Web Audio and MediaRecorder, on jest's clock.
function world() {
  const log = [];
  const target = new EventTarget();
  let pausedAt = 0, pausedTotal = 0;
  const outputs = [];
  const tracks = [];
  const track = kind => { const t = { kind, stop: jest.fn() }; tracks.push(t); return t; };
  const sources = [];
  const context = {
    state: 'suspended', destination: { name: 'speakers' },
    resume: jest.fn(() => { context.state = 'running'; }),
    createMediaElementSource: () => { const s = { connect: jest.fn(), disconnect: jest.fn() }; sources.push(s); return s; },
    createMediaStreamDestination: () => ({ stream: { getAudioTracks: () => [track('audio')] } })
  };
  class FakeRecorder extends EventTarget {
    static isTypeSupported(t) { return t.startsWith('video/webm'); }
    constructor(stream, opts) { super(); this.stream = stream; this.mimeType = opts && opts.mimeType; this.state = 'inactive'; env.recorders.push(this); }
    // Like Chrome: with an audio track, 'start' waits for data that is slow to come.
    start() { this.state = 'recording'; log.push('recorder starts'); if (!this.stream.getTracks().some(t => t.kind === 'audio')) setTimeout(() => this.dispatchEvent(new Event('start')), 0); }
    pause() { this.state = 'paused'; }
    resume() { this.state = 'recording'; }
    stop() {
      const e = new Event('dataavailable'); e.data = new Blob(['film']);
      this.dispatchEvent(e);
      this.state = 'inactive';
      setTimeout(() => this.dispatchEvent(new Event('stop')), 0);
    }
  }
  const env = {
    document, recorders: [], log, tracks, sources, context, outputs,
    _playPaused: false,
    playNow: () => (env._playPaused ? pausedAt : Date.now()) - pausedTotal,
    playTimeout: (fn, ms) => setTimeout(fn, ms),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    playRate: () => env.rate || 1,
    pausePlayback() { if (env._playPaused) return; env._playPaused = true; pausedAt = Date.now(); target.dispatchEvent(new CustomEvent('playpause', { detail: { paused: true } })); },
    resumePlayback() { if (!env._playPaused) return; env._playPaused = false; pausedTotal += Date.now() - pausedAt; target.dispatchEvent(new CustomEvent('playpause', { detail: { paused: false } })); },
    caption: () => Promise.resolve(),
    enterPlayMode() {}, exitPlayMode() {},
    frames: 0,
    requestAnimationFrame: fn => { env.frames += 1; return setTimeout(() => { env.frames -= 1; fn(Date.now()); }, 16); },
    cancelAnimationFrame: id => { clearTimeout(id); env.frames -= 1; },
    addEventListener: (...a) => target.addEventListener(...a), removeEventListener: (...a) => target.removeEventListener(...a),
    URL: { createObjectURL: () => 'blob:narration', revokeObjectURL() {} },
    createAudio: () => (env.audio = fakeAudio(20, log)),
    audioContext: context,
    MediaRecorder: FakeRecorder,
    MediaStream: class { constructor(t) { this.t = t; } getTracks() { return this.t; } },
    createCanvas: (w, h) => { const c = fakeCanvas(w, h); c.captureStream = () => ({ getVideoTracks: () => [track('video')] }); outputs.push(c); return c; },
    // The preview canvas: 1000×500 CSS pixels drawn at twice the resolution.
    pc: { lowerCanvasEl: { width: 2000, height: 1000, clientWidth: 1000, clientHeight: 500, getBoundingClientRect: () => ({ left: 0, top: 0 }) }, getObjects: () => env.objects || [] }
  };
  return env;
}

function fakeCanvas(width, height) {
  const calls = [];
  const ctx = new Proxy({ calls, measureText: s => ({ width: s.length * 10 }) }, {
    get(t, k) {
      if (k in t) return t[k];
      // Like a real canvas: drawing a cross-origin image taints it for good; reading it then fails.
      if (k === 'drawImage') return (el, ...a) => { if (el && el.tainted) t.tainted = true; calls.push(['drawImage', el, ...a]); };
      if (k === 'getImageData') return () => { if (t.tainted) throw Object.assign(new Error('tainted'), { name: 'SecurityError' }); return {}; };
      return (...a) => calls.push([k, ...a]);
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  return { width, height, getContext: () => ctx, calls };
}

function fakeAudio(duration, log) {
  const t = new EventTarget();
  let pos = 0, since = null;
  const a = {
    duration, readyState: 1, src: '',
    get currentTime() { return Math.min(duration, pos + (since == null ? 0 : (Date.now() - since) / 1000)); },
    set currentTime(v) { pos = v; if (since != null) since = Date.now(); },
    play: jest.fn(() => { log.push('audio starts'); if (since == null) since = Date.now(); return Promise.resolve(); }),
    pause: () => { if (since != null) { pos = a.currentTime; since = null; } },
    addEventListener: (...x) => t.addEventListener(...x), removeEventListener: (...x) => t.removeEventListener(...x),
    removeAttribute() {}, load() {},
    end: () => t.dispatchEvent(new Event('ended'))
  };
  return a;
}

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
async function advance(ms) { for (let left = ms; left > 0; left -= 10) { jest.advanceTimersByTime(Math.min(10, left)); await flush(); } }
// play() waits for the recorder's 'start', which comes on the clock.
async function started(promise) { await advance(320); return promise; }

async function session(timeline, env = world()) {
  const s = createPlaybackSession({ env });
  await s.loadAudio(new Blob(['x']));
  s.setTimeline(timeline);
  return { s, env };
}

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(0); document.body.innerHTML = ''; });
afterEach(() => { jest.useRealTimers(); });

test('records the scene and the captions with the narration: the recorder runs before the audio starts, the scene is copied from backing pixels into the layout above the caption band, and stop gives the film and lets go of the tracks', async () => {
  const { s, env } = await session({ cues: [], captions: [{ start: 0, end: 2, text: 'Hello there' }] });
  const ready = []; s.on('recordingready', e => ready.push(e));
  await started(s.play({ record: { filename: 'film.webm' } }));
  expect(env.log).toEqual(['recorder starts', 'audio starts']);
  expect(env.context.resume).toHaveBeenCalled();
  const rec = env.recorders[0];
  expect(rec.mimeType).toBe('video/webm;codecs=vp9,opus');
  expect(rec.stream.getTracks().map(t => t.kind)).toEqual(['video', 'audio']);
  await advance(100);
  const out = env.outputs.find(c => c.width === 1920);
  // 1000×500 into 1920×(1080 − 130 band): scale 1.9, centred.
  const draw = out.calls.filter(c => c[0] === 'drawImage').pop();
  expect(draw.slice(1)).toEqual([env.pc.lowerCanvasEl, 0, 0, 2000, 1000, 10, 0, 1900, 950]);
  expect(out.calls.some(c => c[0] === 'fillText' && c[1] === 'Hello there')).toBe(true);
  const stopping = s.stop();
  await advance(20);
  const { recording } = await stopping;
  expect(recording).toBeInstanceOf(Blob);
  expect(env.tracks.every(t => t.stop.mock.calls.length === 1)).toBe(true);
  expect(ready).toEqual([{ recording, filename: 'film.webm', partial: true }]); // stopped before the narration's end
  expect(env.sources[0].disconnect).toHaveBeenCalled(); // from the recording, not the speakers
  expect(env.frames).toBe(0);
});

test('a pause pauses the recorder too; seeking and other speeds are refused while recording, before anything moves', async () => {
  const reset = jest.fn();
  const { s, env } = await session({ reset, cues: [] });
  env.rate = 2;
  await expect(s.play({ record: true })).rejects.toThrow(/normal speed/);
  expect(env.recorders).toHaveLength(0);
  env.rate = 1;
  await started(s.play({ record: true }));
  const rec = env.recorders[0];
  env.pausePlayback();
  expect(rec.state).toBe('paused');
  env.resumePlayback();
  expect(rec.state).toBe('recording');
  reset.mockClear();
  await expect(s.seek(5)).rejects.toThrow(/not while recording/);
  expect(reset).not.toHaveBeenCalled();
  expect(s.state).toBe('playing');
});

test('an exportFrame hook that throws stops the recording, names the hook, and offers what was recorded', async () => {
  const { s, env } = await session({ cues: [] });
  let broken = false;
  s.use({ name: 'badge', exportFrame: () => { if (broken) throw new Error('no badge'); } });
  const errors = []; s.on('error', e => errors.push(e));
  const ready = []; s.on('recordingready', e => ready.push(e));
  await started(s.play({ record: true }));
  await advance(100);
  broken = true;
  await advance(100);
  expect(errors.map(e => [e.stage, e.hook])).toEqual([['exportFrame', 'badge']]);
  expect(s.state).toBe('error');
  expect(ready[0].partial).toBe(true);
  expect(s.recording.blob).toBe(ready[0].recording);
  expect(env.audio.currentTime).toBeLessThan(0.3); // the narration stopped too
});

test('a visible DOM layer that nothing can draw is refused before anything plays; a rasterize hook makes it recordable and it is drawn where it is', async () => {
  document.body.innerHTML = '<div id="textillateContainer"><span>typed text</span></div>';
  const span = document.querySelector('span');
  span.getBoundingClientRect = () => ({ left: 100, top: 50, width: 200, height: 40 });
  const { s, env } = await session({ cues: [] });
  await expect(s.play({ record: true })).rejects.toThrow(/cannot draw.*typed text/);
  expect(env.audio.play).not.toHaveBeenCalled();
  expect(s.state).toBe('error');
  const bitmap = { name: 'typed text bitmap' };
  s.use({ name: 'text', rasterize: layer => (layer.element === span ? bitmap : null) });
  await started(s.play({ record: true }));
  await advance(50);
  const out = env.outputs.find(c => c.width === 1920);
  const drawn = out.calls.filter(c => c[0] === 'drawImage' && c[1] === bitmap).pop();
  expect(drawn.slice(2)).toEqual([10 + 100 * 1.9, 50 * 1.9, 200 * 1.9, 40 * 1.9]);
});

test('an image from another site is named before recording', async () => {
  const { s, env } = await session({ cues: [] });
  env.objects = [{ uid: 'river', getElement: () => ({ tainted: true }) }, { uid: 'tree', getElement: () => ({}) }];
  const play = s.play({ record: true });
  await expect(play).rejects.toThrow(/another site/);
  await play.catch(e => expect(e.tainted).toEqual(['river'])); // the clean one after it is not blamed
});

test('without narration the recorder\'s start event is waited for, and the film has no audio track', async () => {
  const env = world();
  const s = createPlaybackSession({ env });
  s.setTimeline({ cues: [], captions: [{ start: 0, end: 1, text: 'quiet' }] });
  const playing = s.play({ record: true });
  await advance(20);
  await playing;
  expect(env.recorders[0].mimeType).toBe('video/webm;codecs=vp9');
  expect(env.recorders[0].stream.getTracks().map(t => t.kind)).toEqual(['video']);
});

test('recording twice: one audio source for the narration, the speakers stay connected, nothing left running', async () => {
  const { s, env } = await session({ cues: [] });
  for (let i = 0; i < 2; i++) {
    await started(s.play({ record: { monitor: false } }));
    await advance(50);
    const stopping = s.stop(); await advance(20); await stopping;
  }
  expect(env.sources).toHaveLength(1);
  const src = env.sources[0];
  // Taken off the speakers while recording without monitoring, and put back each time.
  const toSpeakers = src.connect.mock.calls.filter(c => c[0] === env.context.destination).length;
  const offSpeakers = src.disconnect.mock.calls.filter(c => c[0] === env.context.destination).length;
  expect(toSpeakers - offSpeakers).toBe(1);
  expect(env.frames).toBe(0);
  expect(env.recorders.every(r => r.state === 'inactive')).toBe(true);
});

test('captions keep their line breaks and wrap at spaces', () => {
  const measure = s => s.length;
  expect(wrapCaption(measure, 'one two three\nfour', 8)).toEqual(['one two', 'three', 'four']);
  expect(wrapCaption(measure, 'åäö-långtord kort', 5)).toEqual(['åäö-l', 'ångto', 'rd', 'kort']); // a word too long for a line is broken
  expect(wrapCaption(measure, '没有空格的句子', 3)).toEqual(['没有空', '格的句', '子']);
  expect(wrapCaption(measure, 'a\r\nb', 9)).toEqual(['a', 'b']);
});

test('only a narration that played to its end gives a whole film; a stop with discard keeps none', async () => {
  const { s, env } = await session({ cues: [] });
  const ready = []; s.on('recordingready', e => ready.push(e));
  await started(s.play({ record: true }));
  env.audio.end();
  await advance(400); // a short tail keeps the last frame and sound
  expect(ready.map(e => e.partial)).toEqual([false]);
  const { recording } = await s.stop(); // after it ended: still this run's film
  expect(recording).toBe(ready[0].recording);
  await started(s.play({ record: true }));
  const stopping = s.stop({ discard: true }); await advance(20);
  expect((await stopping).recording).toBeNull();
  expect(ready).toHaveLength(1);
  expect(s.recording.blob).toBe(ready[0].recording); // the earlier film is kept
});

test('Record pressed again while the first is starting: the first recorder is let go, the second records', async () => {
  const { s, env } = await session({ cues: [] });
  const first = s.play({ record: true });
  await flush();
  const second = s.play({ record: true });
  await advance(320);
  expect(await first).toMatchObject({ aborted: true });
  await second;
  expect(s.state).toBe('playing');
  const stopping = s.stop(); await advance(20);
  expect((await stopping).recording).toBeInstanceOf(Blob);
  expect(env.recorders.every(r => r.state === 'inactive')).toBe(true);
  expect(env.tracks.every(t => t.stop.mock.calls.length === 1)).toBe(true);
  expect(env.frames).toBe(0);
});

test('a recorder that stops itself with an error still gives its last data', async () => {
  const { s, env } = await session({ cues: [] });
  const ready = []; s.on('recordingready', e => ready.push(e));
  const errors = []; s.on('error', e => errors.push(e));
  await started(s.play({ record: true }));
  const rec = env.recorders[0];
  // As browsers do: 'error' with the recorder already inactive, then the last data, then 'stop'.
  rec.state = 'inactive';
  rec.dispatchEvent(new Event('error'));
  const last = new Event('dataavailable'); last.data = new Blob(['the last second']);
  setTimeout(() => { rec.dispatchEvent(last); rec.dispatchEvent(new Event('stop')); }, 50);
  await advance(100);
  expect(errors.map(e => e.stage)).toEqual(['recorder']);
  expect(ready[0].partial).toBe(true);
  expect(ready[0].recording.size).toBe('the last second'.length);
});

test('a hook that fails on the very first frame is named, and play is refused', async () => {
  const { s } = await session({ cues: [] });
  s.use({ name: 'stamp', exportFrame: () => { throw 'no stamp'; } }); // not even an Error
  const errors = []; s.on('error', e => errors.push(e));
  const play = s.play({ record: true });
  await advance(320);
  await expect(play).rejects.toThrow('no stamp');
  expect(errors.map(e => [e.stage, e.hook])).toEqual([['exportFrame', 'stamp']]);
});

test('typed text that appears while recording, with no hook to draw it, stops the recording instead of being left out', async () => {
  document.body.innerHTML = '<div id="textillateContainer"></div>';
  const { s } = await session({ cues: [] });
  const errors = []; s.on('error', e => errors.push(e));
  await started(s.play({ record: true }));
  const span = document.createElement('span');
  span.textContent = 'late words';
  span.getBoundingClientRect = () => ({ left: 0, top: 0, width: 80, height: 20 });
  document.getElementById('textillateContainer').appendChild(span);
  await advance(400);
  expect(errors.map(e => e.stage)).toEqual(['layers']);
  expect(String(errors[0].error.message)).toMatch(/late words/);
  expect(s.state).toBe('error');
});
