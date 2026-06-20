// public/music-player.js
// Playback: a pure schedule builder over the encoded primary voice, plus thin
// browser wrappers over Tone.js (MIDI) and the YouTube IFrame API. Only the pure
// functions are unit-tested; the audio/video wrappers are browser-verified.
import { primaryVoice } from './music-encoding.js';

// Note <type> → beats, where a quarter note = 1 beat (matches quarter-note BPM tempo).
export const NOTE_TYPE_BEATS = {
  breve: 8, whole: 4, half: 2, quarter: 1, eighth: 0.5,
  '16th': 0.25, '32nd': 0.125, '64th': 0.0625, '128th': 0.03125,
};
const DEFAULT_BEATS = 1; // quarter, used when duration is null/unknown (e.g. note-text)

// Pure: turn the primary voice into [{ midi, time, duration }] (seconds), optionally
// restricted to a measure range and re-zeroed so the segment starts at t=0.
export function buildSchedule(voices, opts = {}) {
  const v = primaryVoice({ voices: voices || [] });
  const bpm = (opts.tempo && opts.tempo > 0) ? opts.tempo : 90;
  const spb = 60 / bpm;
  const from = (opts.fromMeasure == null) ? -Infinity : opts.fromMeasure;
  const to = (opts.toMeasure == null) ? Infinity : opts.toMeasure;
  const out = [];
  let t = 0;
  for (let i = 0; i < v.pitch.length; i++) {
    const beats = NOTE_TYPE_BEATS[v.duration[i]] ?? DEFAULT_BEATS;
    const dur = beats * spb;
    const m = v.measureIndex[i];
    if (m >= from && m <= to) out.push({ midi: v.pitch[i], time: t, duration: dur });
    t += dur;
  }
  if (out.length) {
    const t0 = out[0].time;
    for (const e of out) e.time = Number((e.time - t0).toFixed(6));
  }
  return out;
}

// Pure: end time (seconds) of a buildSchedule() result — last event's end, or 0 if empty.
export function scheduleEnd(schedule) {
  if (!schedule || !schedule.length) return 0;
  const last = schedule[schedule.length - 1];
  return Number(((last.time || 0) + (last.duration || 0)).toFixed(6));
}

// Pure: extract a YouTube video id from watch / youtu.be / embed / music URLs. Null if none.
export function parseYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  let m = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  m = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  m = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return null;
}

// Pure: map a (free-text) instrument name to a playback voice category.
export function instrumentVoiceKey(name) {
  const s = String(name || '').toLowerCase();
  if (/piano|keyboard|harpsichord|clav/.test(s)) return 'piano';
  if (/guitar|pluck|lute|harp|mandolin|banjo/.test(s)) return 'guitar';
  if (/violin|viola|cello|bass|string|fiddle/.test(s)) return 'strings';
  if (/organ|accordion|harmonium/.test(s)) return 'organ';
  return 'synth';
}

// Browser glue: drive Tone.js from a buildSchedule() result and follow with the OSMD cursor.
// opts.Tone defaults to the global Tone (vendored UMD). opts.getCursor returns the OSMD
// cursor (or null) lazily so the player isn't coupled to a specific renderer instance.
export function createMusicPlayer({ Tone, getCursor } = {}) {
  const T = Tone || (typeof globalThis !== 'undefined' ? globalThis.Tone : undefined);
  if (!T) throw new Error('Tone.js is not available');
  // Distinct timbres per category using standard Tone voices (no samples). Guitar uses
  // the monophonic PluckSynth — fine for the melodic primary voice we schedule.
  function makeVoice(category) {
    switch (category) {
      case 'guitar':  return new T.PluckSynth().toDestination();
      case 'strings': return new T.PolySynth(T.AMSynth).toDestination();
      case 'organ':   return new T.PolySynth(T.FMSynth).toDestination();
      case 'piano':
      case 'synth':
      default:        return new T.PolySynth(T.Synth).toDestination();
    }
  }
  let synth = makeVoice('synth');
  let part = null;
  let schedule = [];
  let loop = false;
  let stopId = null;   // Tone.Transport.scheduleOnce id for the boundary stop

  function disposePart() { if (part) { part.stop(); part.dispose(); part = null; } }
  function clearStopTimer() {
    if (stopId !== null) { try { T.Transport.clear(stopId); } catch (_) {} stopId = null; }
  }

  function buildPart() {
    disposePart();
    const cursor = getCursor && getCursor();
    if (cursor) { try { cursor.reset(); cursor.show(); } catch (_) {} }
    part = new T.Part((time, ev) => {
      synth.triggerAttackRelease(T.Frequency(ev.midi, 'midi').toNote(), ev.duration, time);
      if (cursor) T.Draw.schedule(() => { try { cursor.next(); } catch (_) {} }, time);
    }, schedule.map(e => [e.time, e]));
    part.loop = loop;
    part.loopStart = 0;
    part.loopEnd = scheduleEnd(schedule);
    return part;
  }

  function stop() {
    clearStopTimer();
    T.Transport.stop();
    if (part) part.stop();
    const c = getCursor && getCursor();
    if (c) { try { c.reset(); c.hide(); } catch (_) {} }
  }

  return {
    setSchedule(s) { schedule = s || []; buildPart(); },
    setLoop(on) { loop = !!on; if (part) part.loop = loop; },
    setInstrument(category) {
      const next = makeVoice(category);
      if (synth && synth.dispose) synth.dispose();
      synth = next;   // the Part callback closes over `synth`, so the new voice is used immediately
    },
    async play() {
      await T.start();
      if (!part) buildPart();
      clearStopTimer();
      T.Transport.stop();   // reset position to 0 so part.start(0)'s events are in the future
      T.Transport.start();
      part.start(0);
      if (!loop) {
        const end = scheduleEnd(schedule);
        if (end > 0) stopId = T.Transport.scheduleOnce(() => stop(), end);
      }
    },
    pause() { T.Transport.pause(); },
    stop,
  };
}

// Browser glue: control a linked YouTube video via the IFrame API. `container` is an
// element or element id. opts.YT defaults to the global YT (loaded via iframe_api).
export function createYouTubeController(container, { YT, onReady } = {}) {
  const Y = YT || (typeof globalThis !== 'undefined' ? globalThis.YT : undefined);
  let player = null;
  let ready = false;
  const pending = [];
  const run = (fn) => { if (ready && player) fn(); else pending.push(fn); };
  const flush = () => { while (pending.length) { try { pending.shift()(); } catch (_) {} } };
  return {
    // First call constructs the player (methods exist only after onReady, so play/seek are
    // queued until then); later calls swap the video via loadVideoById (loads + plays).
    load(videoId, startSeconds) {
      if (!Y || !Y.Player) throw new Error('YouTube IFrame API not loaded');
      const start = Math.floor(startSeconds || 0);
      if (player && typeof player.loadVideoById === 'function') {
        player.loadVideoById({ videoId, startSeconds: start });
        return;
      }
      ready = false;
      player = new Y.Player(container, {
        videoId,
        playerVars: { start },
        events: { onReady: () => { ready = true; if (onReady) { try { onReady(); } catch (_) {} } flush(); } },
      });
    },
    play() { run(() => player.playVideo()); },
    pause() { run(() => player.pauseVideo()); },
    seekTo(seconds) { run(() => player.seekTo(seconds, true)); },
    getDuration() { return (ready && player && player.getDuration) ? player.getDuration() : 0; },
    isReady() { return ready; },
    get raw() { return player; },
  };
}
