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

const PITCH_STEP_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function pitchToMidi(noteEl) {
  const p = noteEl.querySelector('pitch');
  if (!p) return null;
  const stepEl = p.querySelector('step');
  const octEl = p.querySelector('octave');
  if (!stepEl || !octEl) return null;
  const step = stepEl.textContent.trim().toUpperCase();
  const octave = parseInt(octEl.textContent, 10);
  if (!(step in PITCH_STEP_SEMITONES) || Number.isNaN(octave)) return null;
  const alterEl = p.querySelector('alter');
  const alter = alterEl ? (parseInt(alterEl.textContent, 10) || 0) : 0;
  const midi = 12 * (octave + 1) + PITCH_STEP_SEMITONES[step] + alter; // C4 → 60
  return (midi < 0 || midi > 127) ? null : midi; // drop out-of-MIDI-range notes
}

// Tie types on a note: prefer the sounded <tie>, fall back to the notational <tied>.
function tieTypesOf(noteEl) {
  const types = [];
  noteEl.querySelectorAll('tie').forEach((t) => { const v = t.getAttribute('type'); if (v) types.push(v); });
  if (!types.length) noteEl.querySelectorAll('tied').forEach((t) => { const v = t.getAttribute('type'); if (v) types.push(v); });
  return types;
}

// Pure: is this note one of the suppressed ones? Match on (measure, midi) with a small epsilon
// on the onset beat (floats). `set` is [{measure, midi, beats}] in piece-start quarter beats —
// the same scale as a schedule/raw event's `beats`.
export function isSuppressed(event, set) {
  if (!event || !set || !set.length) return false;
  const EPS = 1e-6;
  for (const s of set) {
    // Match on (midi, beats) only — NOT measure. An absolute onset (piece-start quarter beats) lies
    // in exactly one measure, so (midi, beats) uniquely identifies the note. We deliberately ignore
    // `measure`: the renderer numbers measures sequentially (pickup = 1) while the player reads the
    // XML `number` attribute (pickup often "0"), so requiring measure-equality would miss pickup-bar
    // notes. `measure` is still carried in the stored identity for readability/debugging.
    if (s.midi === event.midi && Math.abs(s.beats - event.beats) < EPS) return true;
  }
  return false;
}

// Pure: rewrite the output onset (`t`, in beats) of `kept` events for tag skip-playback —
// preserving rhythm within a run but removing the empty stretches between runs. `kept` is the
// notes to play (each {beats: absolute onset, durBeats, …}, sorted by onset); `others` is the
// untagged notes' onsets. Walking kept A→B: a same-onset note (chord) shares A's slot; a
// contiguous/rest-only gap is preserved; a gap that spans an untagged note onset collapses to a
// `breathBeats` breath. Originals are preserved (incl. absolute `beats` for cursor sync); only `t`
// is added. The first kept note anchors the timeline at t=0.
export function compressKeptEvents(kept, others, breathBeats = 1) {
  const EPS = 1e-6;
  const out = [];
  let shift = 0;   // beats removed so far; output onset = beats − shift
  for (let i = 0; i < kept.length; i++) {
    const e = kept[i];
    if (i === 0) { shift = e.beats; out.push({ ...e, t: 0 }); continue; }
    const prev = kept[i - 1];
    if (Math.abs(e.beats - prev.beats) < EPS) { out.push({ ...e, t: e.beats - shift }); continue; }
    const prevEnd = prev.beats + prev.durBeats;
    const gap = e.beats - prevEnd;
    if (gap > EPS) {
      // An untagged onset in [prevEnd, e.beats) is "in between" material to skip. Use >= prevEnd so a
      // note starting exactly where the previous kept note ends counts; < e.beats excludes a chord
      // sibling simultaneous with the next kept note.
      const spansUntagged = (others || []).some((o) => o.beats >= prevEnd - EPS && o.beats < e.beats - EPS);
      if (spansUntagged) shift += gap - breathBeats;   // collapse the skipped span to a breath
    }
    out.push({ ...e, t: e.beats - shift });
  }
  return out;
}

// Pure: build a time-accurate, polyphonic schedule from a MusicXML string. Reads every
// part/voice with ABSOLUTE onsets, honoring <divisions>, <duration> (authoritative — bakes
// in dotted values), <chord/> (stacked at the same onset), <rest> (advances time, no note),
// <backup>/<forward> (voice alignment), and ties (a tie-stop extends the prior same-pitch
// note). Returns [{midi,time,duration}] in seconds, restricted to [fromMeasure,toMeasure]
// and re-zeroed so the segment starts at t=0. Returns [] for empty/unparseable input.
export function buildScheduleFromMusicXml(xmlString, opts = {}) {
  if (!xmlString || typeof xmlString !== 'string') return [];
  let doc;
  try { doc = new DOMParser().parseFromString(xmlString, 'application/xml'); }
  catch (_) { return []; }
  if (!doc || doc.getElementsByTagName('parsererror').length) return [];

  const bpm = (opts.tempo && opts.tempo > 0) ? opts.tempo : 90;
  const spb = 60 / bpm; // seconds per quarter-note beat
  const from = (opts.fromMeasure == null) ? -Infinity : opts.fromMeasure;
  const to = (opts.toMeasure == null) ? Infinity : opts.toMeasure;
  // Optional note-accurate window: keep only onsets within [fromBeat, toBeat] (quarter-note beats
  // from the piece start). Lets the chord window start/end mid-measure, narrower than the measure
  // filter above. Both filters apply (AND); the beat range is a subset of its measure range.
  const fromBeat = (opts.fromBeat == null) ? -Infinity : opts.fromBeat;
  const toBeat = (opts.toBeat == null) ? Infinity : opts.toBeat;

  const events = []; // { midi, beats (onset), durBeats, measure }
  const parts = doc.getElementsByTagName('part');
  for (let pi = 0; pi < parts.length; pi++) {
    let divisions = 1;        // current <divisions> for this part (quarter = `divisions` ticks)
    let cursor = 0;           // running onset in beats from the part start
    let lastOnset = 0;        // onset of the previous non-chord note (the chord anchor)
    const openTies = new Map(); // `${voice}:${midi}` → event object awaiting its tie-stop
    const measures = parts[pi].getElementsByTagName('measure');
    for (let mi = 0; mi < measures.length; mi++) {
      const measure = measures[mi];
      const parsedNum = parseInt(measure.getAttribute('number'), 10);
      const mNum = Number.isNaN(parsedNum) ? (mi + 1) : parsedNum;
      const kids = measure.children;
      for (let ci = 0; ci < kids.length; ci++) {
        const el = kids[ci];
        const tag = el.tagName;
        if (tag === 'attributes') {
          const d = el.querySelector('divisions');
          if (d) { const dv = parseInt(d.textContent, 10); if (dv > 0) divisions = dv; }
        } else if (tag === 'backup') {
          const d = parseInt((el.querySelector('duration') || {}).textContent, 10);
          if (!Number.isNaN(d)) cursor -= d / divisions;
        } else if (tag === 'forward') {
          const d = parseInt((el.querySelector('duration') || {}).textContent, 10);
          if (!Number.isNaN(d)) cursor += d / divisions;
        } else if (tag === 'note') {
          const durEl = el.querySelector('duration');
          const durDiv = durEl ? parseInt(durEl.textContent, 10) : 0;
          const durBeats = (durDiv > 0 ? durDiv : 0) / divisions;
          const isChord = !!el.querySelector('chord');
          const isRest = !!el.querySelector('rest');
          const voice = ((el.querySelector('voice') || {}).textContent) || '1';

          if (isRest) { cursor += durBeats; lastOnset = cursor; continue; }

          const midi = pitchToMidi(el);
          if (midi == null) { if (!isChord) { cursor += durBeats; lastOnset = cursor; } continue; }
          if (durBeats <= 0) continue; // grace note: no duration, occupies no time

          const onset = isChord ? lastOnset : cursor;
          const tieTypes = tieTypesOf(el);
          const hasStop = tieTypes.indexOf('stop') !== -1;
          const hasStart = tieTypes.indexOf('start') !== -1;
          const key = voice + ':' + midi;

          if (hasStop && openTies.has(key)) {
            openTies.get(key).durBeats += durBeats;     // extend the held note
            if (!hasStart) openTies.delete(key);
            if (!isChord) { cursor += durBeats; lastOnset = onset; }
            continue;                                    // no new note for a tie continuation
          }

          const ev = { midi, beats: onset, durBeats, measure: mNum };
          events.push(ev);
          if (hasStart) openTies.set(key, ev);
          if (!isChord) { cursor += durBeats; lastOnset = onset; }
        }
      }
    }
  }

  const EPS = 1e-6;
  const muted = (opts.mutedNotes && opts.mutedNotes.length) ? opts.mutedNotes : null;
  // Tag skip-playback: keep only these notes and compress the gaps between tagged runs.
  const keep = (opts.keepNotes && opts.keepNotes.length) ? opts.keepNotes : null;
  const breathBeats = (typeof opts.breathBeats === 'number' && opts.breathBeats >= 0) ? opts.breathBeats : 1;
  const ranged = events
    .filter((e) => e.measure >= from && e.measure <= to)
    .filter((e) => e.beats >= fromBeat - EPS && e.beats <= toBeat + EPS);
  // `beat` = ABSOLUTE onset in quarter-beats from the piece start. Unlike `time` (re-zeroed below so
  // the segment starts at 0s), `beat` is preserved so the OSMD cursor — whose iterator timestamps
  // are also absolute — can be driven to each note's true position, stepping over rests (and, in
  // skip-playback, jumping ahead over skipped material) instead of advancing one entry per note.
  const out = keep
    ? compressKeptEvents(
        ranged.filter((e) => isSuppressed(e, keep)).sort((a, b) => a.beats - b.beats),
        ranged.filter((e) => !isSuppressed(e, keep)),
        breathBeats,
      ).map((c) => ({ midi: c.midi, time: c.t * spb, duration: c.durBeats * spb, beat: c.beats }))
    : ranged.map((e) => {
        const item = { midi: e.midi, time: e.beats * spb, duration: e.durBeats * spb, beat: e.beats };
        if (muted && isSuppressed(e, muted)) item.muted = true;   // silenced note: keep its slot, skip the synth
        return item;
      });
  out.sort((a, b) => a.time - b.time); // stable: chord/aligned notes keep emission order
  if (out.length) {
    const t0 = out[0].time;
    for (const e of out) { e.time = Number((e.time - t0).toFixed(6)); e.duration = Number(e.duration.toFixed(6)); }
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

// Pure: map a (free-text) instrument name to a playback voice category.
export function instrumentVoiceKey(name) {
  const s = String(name || '').toLowerCase();
  if (/piano|keyboard|harpsichord|clav/.test(s)) return 'piano';
  if (/guitar|pluck|lute|harp|mandolin|banjo/.test(s)) return 'guitar';
  if (/violin|viola|cello|bass|string|fiddle/.test(s)) return 'strings';
  if (/organ|accordion|harmonium/.test(s)) return 'organ';
  return 'synth';
}

// Public CDN of General MIDI soundfont samples (the gleitz MIDI.js / FluidR3_GM set).
export const SOUNDFONT_BASE = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/';
// Sparse samples every minor third (C/Eb/Gb/A) across the central range; Tone.Sampler
// pitch-shifts between them. These exact files exist for all the instruments we map to.
const SOUNDFONT_NOTES = ['C3', 'Eb3', 'Gb3', 'A3', 'C4', 'Eb4', 'Gb4', 'A4', 'C5'];
// FluidR3_GM filenames spell black keys as FLATS (Gb4), not sharps (Fs4/F#4).
const SHARP_TO_FLAT = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
function soundfontNoteFile(note) {
  const m = /^([A-G]#?)(-?\d+)$/.exec(note);
  return m ? (SHARP_TO_FLAT[m[1]] || m[1]) + m[2] : note;
}

// Pure: map a playback-voice category to a General MIDI instrument (soundfont folder name).
export function gmInstrumentForVoice(category) {
  switch (category) {
    case 'guitar':  return 'acoustic_guitar_nylon';
    case 'strings': return 'string_ensemble_1';
    case 'organ':   return 'church_organ';
    case 'piano':
    case 'synth':
    default:        return 'acoustic_grand_piano';
  }
}

// Pure: build the { note: url } sample map for Tone.Sampler from the FluidR3_GM soundfont.
// Keys are Tone-parseable pitches ('F#4'); the CDN filenames spell sharps with 's' ('Fs4').
export function soundfontSampleMap(instrument, { baseUrl = SOUNDFONT_BASE, format = 'mp3', notes = SOUNDFONT_NOTES } = {}) {
  const dir = `${baseUrl}${instrument}-${format}/`;
  const map = {};
  for (const n of notes) map[n] = `${dir}${soundfontNoteFile(n)}.${format}`;
  return map;
}

// Browser glue: drive Tone.js from a buildSchedule() result and follow with the OSMD cursor.
// opts.Tone defaults to the global Tone (vendored UMD). opts.getCursor returns the OSMD
// cursor (or null) lazily so the player isn't coupled to a specific renderer instance.
export function createMusicPlayer({ Tone, getCursor } = {}) {
  const T = Tone || (typeof globalThis !== 'undefined' ? globalThis.Tone : undefined);
  if (!T) throw new Error('Tone.js is not available');
  // Fallback timbres (no samples) — used offline or if the soundfont can't load. All are
  // PolySynth-based so chords and overlapping voices sound (guitar gets a short plucky
  // envelope; the monophonic PluckSynth can't play polyphony).
  function makeSynthVoice(category) {
    switch (category) {
      case 'guitar': {
        const g = new T.PolySynth(T.Synth).toDestination();
        g.set({ envelope: { attack: 0.005, decay: 0.4, sustain: 0, release: 0.4 } });
        return g;
      }
      case 'strings': return new T.PolySynth(T.AMSynth).toDestination();
      case 'organ':   return new T.PolySynth(T.FMSynth).toDestination();
      case 'piano':
      case 'synth':
      default:        return new T.PolySynth(T.Synth).toDestination();
    }
  }
  // Sampled (SoundFont) voice for realistic timbre; falls back to the synth on load error
  // (offline / blocked / 404) so playback always works.
  function makeVoice(category) {
    const urls = soundfontSampleMap(gmInstrumentForVoice(category));
    try {
      return new T.Sampler({
        urls,
        onerror: () => {
          try { if (synth && synth.dispose) synth.dispose(); } catch (_) {}
          synth = makeSynthVoice(category);
        },
      }).toDestination();
    } catch (_) {
      return makeSynthVoice(category);
    }
  }
  let synth = makeVoice('synth');
  let part = null;
  let schedule = [];
  let loop = false;
  let stopId = null;   // Tone.Transport.scheduleOnce id for the boundary stop
  let cursorStartStep = 0;   // distinct onsets to skip so the cursor homes to the window's start

  // The OSMD cursor's current onset in quarter-beats (absolute from piece start), or null when the
  // iterator/timestamp isn't reachable. RealValue is in whole notes → ×4 for quarter beats.
  function cursorBeat(cursor) {
    try {
      const t = cursor && cursor.iterator && cursor.iterator.currentTimeStamp;
      return (t && typeof t.RealValue === 'number') ? t.RealValue * 4 : null;
    } catch (_) { return null; }
  }
  function cursorEnded(cursor) {
    try { return !!(cursor && cursor.iterator && cursor.iterator.EndReached); } catch (_) { return false; }
  }
  // Step the cursor FORWARD until it reaches `beat` (absolute quarter-beats), skipping rest and
  // chord-internal entries. Forward-only and step-guarded, so it can't loop or move backward; a
  // no-op when already at/past the target. This is what keeps the cursor synced through rests:
  // the audio schedule has no rest events, so one note may sit several cursor entries ahead.
  function advanceCursorToBeat(cursor, beat) {
    if (cursor == null || beat == null) return;
    let guard = 0;
    while (guard++ < 5000) {
      const cb = cursorBeat(cursor);
      if (cb == null || cb >= beat - 1e-6 || cursorEnded(cursor)) break;
      cursor.next();
    }
  }

  // Home the OSMD cursor to the start of what we're playing: reset to the sheet start, then advance
  // to the first scheduled note's absolute beat (skipping any leading rests). Falls back to the old
  // cursorStartStep stepping when the schedule carries no beats (the note-text builder).
  function homeCursor(cursor) {
    if (!cursor) return;
    try {
      cursor.reset();
      const firstBeat = schedule.length ? schedule[0].beat : null;
      // Beat-driven homing when both the schedule carries beats AND the cursor exposes a readable
      // timestamp; otherwise fall back to the old onset-count stepping (note-text / older OSMD).
      if (firstBeat != null && cursorBeat(cursor) != null) advanceCursorToBeat(cursor, firstBeat);
      else for (let i = 0; i < cursorStartStep; i++) cursor.next();
      cursor.show();
    } catch (_) {}
  }

  // Stop at an explicit transport time 0: calling part.stop() bare resolves to "now", which
  // after a Transport.stop() can be a tiny negative float that Tone rejects (RangeError).
  function disposePart() {
    if (!part) return;
    try { part.stop(0); } catch (_) {}
    try { part.dispose(); } catch (_) {}
    part = null;
  }
  function clearStopTimer() {
    if (stopId !== null) { try { T.Transport.clear(stopId); } catch (_) {} stopId = null; }
  }

  function buildPart() {
    disposePart();
    const cursor = getCursor && getCursor();
    homeCursor(cursor);
    // Advance the OSMD cursor once per distinct onset (not per note) so chords and overlapping
    // voices don't over-step it. The earliest onset re-homes the cursor (reset) instead of
    // advancing — so it lands on the first note and, crucially, snaps back to the start on
    // every loop pass instead of staying parked at the end.
    const seenTimes = new Set();
    const firstTime = schedule.length ? schedule[0].time : 0;
    const events = schedule.map((e) => {
      const step = !seenTimes.has(e.time);
      seenTimes.add(e.time);
      return [e.time, { ...e, _step: step, _first: e.time === firstTime }];
    });
    part = new T.Part((time, ev) => {
      if (!ev.muted) synth.triggerAttackRelease(T.Frequency(ev.midi, 'midi').toNote(), ev.duration, time);
      if (cursor && ev._step) T.Draw.schedule(() => {
        try {
          if (ev._first) homeCursor(cursor);
          else if (ev.beat != null && cursorBeat(cursor) != null) advanceCursorToBeat(cursor, ev.beat);   // skip rests between notes
          else cursor.next();                                                                             // no beats / no timestamp: old stepping
        } catch (_) {}
      }, time);
    }, events);
    part.loop = false;   // looping is driven by the Transport (reliable) — see play()/setLoop
    return part;
  }

  // Configure the Transport's loop window to the segment, or disable it. Looping the Transport
  // re-fires the Part's events on every pass (Part.loop alone proved unreliable in-browser).
  function applyLoop() {
    const end = scheduleEnd(schedule);
    if (loop && end > 0) {
      T.Transport.loopStart = 0;
      T.Transport.loopEnd = end;
      T.Transport.loop = true;
    } else {
      T.Transport.loop = false;
    }
  }

  // When called from a Transport-scheduled callback (the boundary stop), `atTime` is the
  // callback's scheduling time; use it for the Transport/Part stop so Tone keeps sample-accurate
  // timing (and doesn't warn about scheduling with a stale "now"). Bare calls (user actions) stop
  // immediately.
  function stop(atTime) {
    clearStopTimer();
    T.Transport.loop = false;   // clear the loop window so a later non-loop play isn't left looping
    if (typeof atTime === 'number') {
      T.Transport.stop(atTime);
      if (part) { try { part.stop(atTime); } catch (_) {} }
    } else {
      T.Transport.stop();
      if (part) { try { part.stop(0); } catch (_) {} }
    }
    const c = getCursor && getCursor();
    if (c) { try { c.reset(); c.hide(); } catch (_) {} }
  }

  return {
    setSchedule(s, opts = {}) { schedule = s || []; cursorStartStep = opts.cursorStartStep || 0; buildPart(); },
    setLoop(on) {
      loop = !!on;
      applyLoop();
      if (loop) {
        clearStopTimer();   // a pending one-shot boundary stop would kill the loop
      } else if (T.Transport.state === 'started') {
        // turned off mid-playback: still end at the segment boundary
        const end = scheduleEnd(schedule);
        if (end > 0) { clearStopTimer(); stopId = T.Transport.scheduleOnce((time) => stop(time), end); }
      }
    },
    setInstrument(category) {
      const next = makeVoice(category);
      if (synth && synth.dispose) synth.dispose();
      synth = next;   // the Part callback closes over `synth`, so the new voice is used immediately
    },
    async play() {
      await T.start();
      // Wait for sampled-instrument buffers (resolves even if a load errored → synth fallback).
      try { if (T.loaded) await T.loaded(); } catch (_) {}
      if (!part) buildPart();
      clearStopTimer();
      T.Transport.stop();   // reset position to 0 so part.start(0)'s events are in the future
      applyLoop();
      T.Transport.start();
      part.start(0);
      if (!loop) {
        const end = scheduleEnd(schedule);
        if (end > 0) stopId = T.Transport.scheduleOnce((time) => stop(time), end);
      }
    },
    pause() { T.Transport.pause(); },
    resume() { T.Transport.start(); },   // continue from the paused position (no reset to 0)
    // Sound a short sequence immediately, independent of the Transport and OSMD cursor — used by the
    // fretboard "play step" button. `events` is [{midi, time, duration}] in seconds relative to now;
    // notes sharing a `time` stack into a chord, later ones play in sequence. No-op for an empty set.
    async playSequence(events) {
      const list = (events || []).filter((e) => e && typeof e.midi === 'number');
      if (!list.length) return;
      await T.start();
      try { if (T.loaded) await T.loaded(); } catch (_) {}   // wait for sampled buffers (synth fallback still resolves)
      const now = T.now();
      list.forEach((e) => {
        try { synth.triggerAttackRelease(T.Frequency(e.midi, 'midi').toNote(), e.duration || 0.4, now + (e.time || 0)); } catch (_) {}
      });
    },
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
    getCurrentTime() { return (ready && player && player.getCurrentTime) ? player.getCurrentTime() : 0; },
    isReady() { return ready; },
    get raw() { return player; },
  };
}
