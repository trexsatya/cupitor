// public/music-encoding.js
import { getScale } from './music-reference-data.js';
import { extractPitchesFromText } from './music_search.js';

const BASE_PC = {
  "C":0,"C#":1,"Db":1,"D":2,"D#":3,"Eb":3,"E":4,"E#":5,"Fb":4,
  "F":5,"F#":6,"Gb":6,"G":7,"G#":8,"Ab":8,"A":9,"A#":10,"Bb":10,
  "B":11,"B#":0,"Cb":11
};

const SARGAM = ["Sa","Re","Ga","Ma","Pa","Dha","Ni"];

export function pitchClass(name) {
  return BASE_PC[name];
}

export function nameToMidi(name, octave) {
  const pc = BASE_PC[name];
  if (pc === undefined || octave === undefined || octave === '' || Number.isNaN(octave)) return null;
  return 12 * (parseInt(octave, 10) + 1) + pc;
}

export function intervalsOf(pitches) {
  const out = [];
  for (let i = 1; i < pitches.length; i++) out.push(pitches[i] - pitches[i - 1]);
  return out;
}

export function toSargam(name, keyName) {
  const pc = BASE_PC[name];
  if (pc === undefined) return null;
  const scale = getScale(keyName);            // e.g. ["C","D","E","F","G","A","B"]
  const idx = scale.findIndex(n => BASE_PC[n] === pc);
  return idx === -1 ? null : SARGAM[idx];
}

// Comma-separated signed integers. Compact, lossless, trivially decodable.
// (A byte-packing scheme is a later optimization; correctness first.)
export function packContour(intervals) {
  return intervals.join(',');
}

export function unpackContour(str) {
  if (!str) return [];
  return str.split(',').map(s => parseInt(s, 10));
}

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function midiToName(midi) { return NOTE_NAMES[((midi % 12) + 12) % 12]; }

// Normalize tokens like "G4#" or "G4b" -> "G#4" / "Gb4" so extractPitchesFromText can parse them.
function normalizeNoteText(txt) {
  return txt.replace(/(?<![A-Za-z#b])([A-Ga-g])(\d+)([#b])(?![A-Za-z\d])/g, '$1$3$2');
}

export function encodeNoteText(txt, meta = {}) {
  const lines = extractPitchesFromText(normalizeNoteText(txt), { defaultOctave: 4 }); // MIDI[] per note line, or string for non-note lines
  const pitch = [], measureIndex = [];
  let measure = 0;
  for (const line of lines) {
    if (Array.isArray(line) && line.length) {
      measure += 1; // treat each note line as a "measure" for context
      for (const m of line) { pitch.push(m); measureIndex.push(measure); }
    }
  }
  const key = meta.key || 'C';
  const voice = {
    pitch,
    interval: intervalsOf(pitch),
    sargam: pitch.map(m => toSargam(midiToName(m), key)),
    duration: pitch.map(() => null),
    chordSymbol: pitch.map(() => null),
    lyric: pitch.map(() => null),
    measureIndex
  };
  return {
    meta: {
      id: meta.id || null, title: meta.title || meta.id || null,
      system: meta.system || 'western', format: 'note-text',
      sourceUrl: meta.sourceUrl || null, youtube: meta.youtube || null,
      key, time: null, tempo: null, instrument: meta.instrument || null
    },
    voices: [voice]
  };
}
