// public/music-encoding.js
import { getScale, allChords, normaliseChordName } from './music-reference-data.js';
import { extractPitchesFromText } from './music_search.js';
import { MusicXml } from './musicxml.js';

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

// Map key-signature fifths (sharps +, flats -) to a major key name.
const FIFTHS_TO_KEY = { '-7':'Cb','-6':'Gb','-5':'Db','-4':'Ab','-3':'Eb','-2':'Bb','-1':'F',
  '0':'C','1':'G','2':'D','3':'A','4':'E','5':'B','6':'F#','7':'C#' };

export function encodeMusicXml(xmlString, meta = {}) {
  const mx = new MusicXml().loadXml(xmlString);
  const measures = mx.toArray();                  // [[{name,octave,type,dot,voice,tie}, ...], ...]

  const $xml = mx.xml;
  const fifths = $xml.find('fifths').first().text();
  const key = FIFTHS_TO_KEY[String(parseInt(fifths || '0', 10))] || 'C';
  const beats = $xml.find('time > beats').first().text();
  const beatType = $xml.find('time > beat-type').first().text();
  const time = (beats && beatType) ? `${beats}/${beatType}` : null;
  const instrument = $xml.find('instrument-name').first().text() ||
                     $xml.find('part-name').first().text() || null;

  // Harmony per measure (M1: explicit <harmony> only). Index by measure number.
  const harmonyByMeasure = {};
  $xml.find('measure').each(function () {
    const num = parseInt($(this).attr('number'), 10);
    const h = $(this).find('harmony root root-step').first().text();
    if (h) {
      const kind = $(this).find('harmony kind').first().text();
      harmonyByMeasure[num] = h + (kind === 'minor' ? 'm' : '');
    }
  });
  // Lyrics per note, in document order (aligned to sounded notes below).
  const lyricByNoteOrder = [];
  $xml.find('part > measure > note').each(function () {
    const hasPitch = $(this).find('pitch').length > 0;
    if (hasPitch) lyricByNoteOrder.push($(this).find('lyric text').first().text() || null);
  });

  // Build per-voice streams over sounded notes (rests dropped).
  const voicesMap = {};
  let soundedOrder = 0;
  measures.forEach((notes, mIdx) => {
    const measureNumber = mIdx + 1;
    notes.forEach(n => {
      if (!n.name || n.name.trim() === '' || Number.isNaN(n.octave)) return; // rest
      const realMidi = nameToMidi(n.name, n.octave);
      if (realMidi === null) return;
      const vKey = n.voice || '1';
      const v = (voicesMap[vKey] = voicesMap[vKey] || { pitch:[], duration:[], lyric:[], chordSymbol:[], measureIndex:[] });
      v.pitch.push(realMidi);
      v.duration.push(n.type || null);
      v.lyric.push(lyricByNoteOrder[soundedOrder] || null);
      v.chordSymbol.push(harmonyByMeasure[measureNumber] || null);
      v.measureIndex.push(measureNumber);
      soundedOrder += 1;
    });
  });

  const voices = Object.keys(voicesMap).map(k => {
    const v = voicesMap[k];
    return {
      pitch: v.pitch,
      interval: intervalsOf(v.pitch),
      sargam: v.pitch.map(m => toSargam(midiToName(m), key)),
      duration: v.duration,
      chordSymbol: v.chordSymbol,
      lyric: v.lyric,
      measureIndex: v.measureIndex
    };
  });

  return {
    meta: {
      id: meta.id || null, title: meta.title || meta.id || null,
      system: meta.system || 'western', format: 'musicxml',
      sourceUrl: meta.sourceUrl || null, youtube: meta.youtube || null,
      key, time, tempo: null, instrument
    },
    voices: voices.length ? voices : [{ pitch:[],interval:[],sargam:[],duration:[],chordSymbol:[],lyric:[],measureIndex:[] }]
  };
}

// Build chord candidates (pitch-class sets) once. Triads and larger only.
const CHORD_CANDIDATES = (() => {
  const seen = new Set(), out = [];
  Object.keys(allChords).forEach(key => {
    const c = allChords[key];
    const rootPc = pitchClass(c.root);
    if (rootPc === undefined) return;
    const tonePcs = new Set(c.notes.map(pitchClass).filter(pc => pc !== undefined));
    if (tonePcs.size < 3) return;
    const symbol = normaliseChordName(key);
    const sig = rootPc + ':' + [...tonePcs].sort((a, b) => a - b).join(',') + ':' + symbol;
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push({ symbol, rootPc, tonePcs });
  });
  return out;
})();

function matchChord(pcSet) {
  let best = null, bestScore = -Infinity;
  for (const c of CHORD_CANDIDATES) {
    if (!pcSet.has(c.rootPc)) continue;
    let present = 0; c.tonePcs.forEach(t => { if (pcSet.has(t)) present++; });
    if (present < 3) continue;
    let extra = 0; pcSet.forEach(p => { if (!c.tonePcs.has(p)) extra++; });
    const score = present * 2 - extra - (c.tonePcs.size - present);
    const better = score > bestScore || (score === bestScore && best &&
      (c.tonePcs.size < best.tonePcs.size ||
       (c.tonePcs.size === best.tonePcs.size && c.symbol.localeCompare(best.symbol) < 0)));
    if (better) { best = c; bestScore = score; }
  }
  return best ? best.symbol : null;
}

export function primaryVoice(doc) {
  if (!doc.voices || !doc.voices.length) return { pitch:[],interval:[],sargam:[],duration:[],chordSymbol:[],lyric:[],measureIndex:[] };
  return doc.voices.reduce((best, v) => (v.pitch.length > best.pitch.length ? v : best), doc.voices[0]);
}

// Fills only null chordSymbol slots with the inferred chord for that note's measure.
export function inferChords(doc) {
  const pcByMeasure = {};
  doc.voices.forEach(v => v.pitch.forEach((m, i) => {
    const meas = v.measureIndex[i];
    (pcByMeasure[meas] = pcByMeasure[meas] || new Set()).add(((m % 12) + 12) % 12);
  }));
  const chordByMeasure = {};
  Object.keys(pcByMeasure).forEach(meas => { chordByMeasure[meas] = matchChord(pcByMeasure[meas]); });
  doc.voices.forEach(v => v.pitch.forEach((m, i) => {
    if (v.chordSymbol[i] == null) v.chordSymbol[i] = chordByMeasure[v.measureIndex[i]] || null;
  }));
  return doc;
}
