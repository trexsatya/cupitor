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

// Browser glue: drive Tone.js from a buildSchedule() result and follow with the OSMD cursor.
// opts.Tone defaults to the global Tone (vendored UMD). opts.getCursor returns the OSMD
// cursor (or null) lazily so the player isn't coupled to a specific renderer instance.
export function createMusicPlayer({ Tone, getCursor } = {}) {
  const T = Tone || (typeof globalThis !== 'undefined' ? globalThis.Tone : undefined);
  if (!T) throw new Error('Tone.js is not available');
  const synth = new T.PolySynth(T.Synth).toDestination();
  let part = null;
  let schedule = [];

  function disposePart() { if (part) { part.stop(); part.dispose(); part = null; } }

  function buildPart() {
    disposePart();
    const cursor = getCursor && getCursor();
    if (cursor) { try { cursor.reset(); cursor.show(); } catch (_) {} }
    part = new T.Part((time, ev) => {
      synth.triggerAttackRelease(T.Frequency(ev.midi, 'midi').toNote(), ev.duration, time);
      if (cursor) T.Draw.schedule(() => { try { cursor.next(); } catch (_) {} }, time);
    }, schedule.map(e => [e.time, e]));
    const last = schedule[schedule.length - 1];
    part.loopEnd = last ? last.time + last.duration : 0;
    return part;
  }

  return {
    synth,
    setSchedule(s) { schedule = s || []; buildPart(); },
    setLoop(on) { if (part) part.loop = !!on; },
    async play() {
      await T.start();
      if (!part) buildPart();
      T.Transport.start();
      part.start(0);
    },
    pause() { T.Transport.pause(); },
    stop() {
      T.Transport.stop();
      if (part) part.stop();
      const c = getCursor && getCursor();
      if (c) { try { c.reset(); c.hide(); } catch (_) {} }
    },
  };
}
