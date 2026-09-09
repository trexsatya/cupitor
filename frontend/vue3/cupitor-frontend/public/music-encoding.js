// public/music-encoding.js
import { getScale, allChords, normaliseChordName, durationTypeToNumber } from './music-reference-data.js';
import { extractPitchesFromText } from './music_search.js';
import { MusicXml } from './musicxml.js';
import { bestChords } from './music-chords.js';
import { detectKey, MAJOR_BY_FIFTHS } from './music-key.js';

const BASE_PC = {
  "C":0,"C#":1,"Db":1,"D":2,"D#":3,"Eb":3,"E":4,"E#":5,"Fb":4,
  "F":5,"F#":6,"Gb":6,"G":7,"G#":8,"Ab":8,"A":9,"A#":10,"Bb":10,
  "B":11,"B#":0,"Cb":11
};

const SARGAM = ["Sa","Re","Ga","Ma","Pa","Dha","Ni"];

// Per-note onset (in divisions) within one measure, from its ordered timed events. Follows MusicXML
// timing: a plain note advances the cursor by its duration; a <chord/> note stacks on the previous
// note (same onset, no advance); <backup>/<forward> move the cursor (so multiple voices in one
// measure align on a shared timeline). Notes that share an onset are a vertical stack — the evidence
// the chord detector uses to name the harmony. `events` are {type:'note'|'backup'|'forward',
// duration, chord?}; returns one onset per 'note' event, in order.
export function computeOnsets(events) {
  const onsets = [];
  let cursor = 0, lastOnset = 0, sawNote = false;
  for (const e of (events || [])) {
    if (e.type === 'backup') { cursor -= (e.duration || 0); continue; }
    if (e.type === 'forward') { cursor += (e.duration || 0); continue; }
    // note
    if (e.chord && sawNote) {
      onsets.push(lastOnset);            // stacked on the previous note; cursor unchanged
    } else {
      lastOnset = cursor;
      onsets.push(cursor);
      cursor += (e.duration || 0);
      sawNote = true;
    }
  }
  return onsets;
}

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
  let scale;
  try { scale = getScale(keyName); } catch (_) { return null; }
  if (!Array.isArray(scale)) return null;
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
export function midiToName(midi) { return NOTE_NAMES[((midi % 12) + 12) % 12]; }

// Normalize tokens like "G4#" or "G4b" -> "G#4" / "Gb4" so extractPitchesFromText can parse them.
function normalizeNoteText(txt) {
  return txt.replace(/(?<![A-Za-z#b])([A-Ga-g])(\d+)([#b])(?![A-Za-z\d])/g, '$1$3$2');
}

export function encodeNoteText(txt, meta = {}) {
  const lines = extractPitchesFromText(normalizeNoteText(txt), { defaultOctave: 4 }); // MIDI[] per note line, or string for non-note lines
  const pitch = [], measureIndex = [], name = [], onset = [];
  let measure = 0;
  for (const line of lines) {
    if (Array.isArray(line) && line.length) {
      measure += 1; // treat each note line as a "measure" for context
      // note-text is a monophonic sequence: distinct onsets (index in the line), no vertical stacks.
      line.forEach((m, i) => { pitch.push(m); measureIndex.push(measure); name.push(midiToName(m)); onset.push(i); });
    }
  }
  const key = meta.key || 'C';
  const voice = {
    pitch,
    name,
    onset,
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

export function encodeMusicXml(xmlString, meta = {}) {
  const mx = new MusicXml().loadXml(xmlString);
  const measures = mx.toArray();                  // [[{name,octave,type,dot,voice,tie}, ...], ...]

  const $xml = mx.xml;
  const fifthsText = $xml.find('fifths').first().text();
  const hasSignature = fifthsText != null && String(fifthsText).trim() !== '';
  const fifths = hasSignature ? (parseInt(fifthsText, 10) || 0) : null;
  const beats = $xml.find('time > beats').first().text();
  const beatType = $xml.find('time > beat-type').first().text();
  const time = (beats && beatType) ? `${beats}/${beatType}` : null;
  const instrument = $xml.find('instrument-name').first().text() ||
                     $xml.find('part-name').first().text() || null;
  const tempoAttr = $xml.find('sound[tempo]').first().attr('tempo');
  const tempo = (tempoAttr != null && tempoAttr !== '' && !Number.isNaN(parseFloat(tempoAttr)))
    ? parseFloat(tempoAttr)
    : null;

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

  // Per-note onset (divisions) within each measure — lets the chord detector see vertical stacks
  // (notes sharing an onset) across voices. Walk each measure's timed children in document order;
  // the onsets line up 1:1 with toArray's per-measure notes (both are the <note> children in order).
  const onsetsByMeasure = $xml.find('measure').toArray().map((el) => {
    const events = [];
    $(el).children().each(function () {
      const tag = (this.nodeName || '').toLowerCase();
      if (tag === 'note') {
        events.push({ type: 'note', chord: $(this).children('chord').length > 0,
          duration: parseInt($(this).children('duration').text(), 10) || 0 });
      } else if (tag === 'backup' || tag === 'forward') {
        events.push({ type: tag, duration: parseInt($(this).children('duration').text(), 10) || 0 });
      }
    });
    return computeOnsets(events);
  });

  // Build per-voice streams over sounded notes (rests dropped).
  const voicesMap = {};
  let soundedOrder = 0;
  measures.forEach((notes, mIdx) => {
    const measureNumber = mIdx + 1;
    const onsets = onsetsByMeasure[mIdx] || [];
    notes.forEach((n, ni) => {
      if (!n.name || n.name.trim() === '' || Number.isNaN(n.octave)) return; // rest
      const realMidi = nameToMidi(n.name, n.octave);
      if (realMidi === null) return;
      const vKey = n.voice || '1';
      const v = (voicesMap[vKey] = voicesMap[vKey] || { pitch:[], name:[], onset:[], duration:[], lyric:[], chordSymbol:[], measureIndex:[] });
      v.pitch.push(realMidi);
      v.name.push(n.name);                          // spelled (C#, Bb) — chord matching is name-based
      v.onset.push(onsets[ni] != null ? onsets[ni] : 0);
      v.duration.push(n.type || null);
      v.lyric.push(lyricByNoteOrder[soundedOrder] || null);
      v.chordSymbol.push(harmonyByMeasure[measureNumber] || null);
      v.measureIndex.push(measureNumber);
      soundedOrder += 1;
    });
  });

  // Key: the signature narrows it to two (relative major / minor), the cadences pick one — and a
  // missing or bare-0 signature can be overruled by the pitch content (see music-key.js). Done here,
  // after the notes are built, because the decision needs them. `keyDetail` carries the WHY (and the
  // caveats) so the UI can show what the reading rests on instead of a bare letter.
  const keyNotes = [];
  Object.keys(voicesMap).forEach((k) => {
    const v = voicesMap[k];
    v.pitch.forEach((midi, i) => keyNotes.push({
      midi, measure: v.measureIndex[i], onset: v.onset[i],
      // Whole-note fractions ('quarter' → 0.25); an unwritten type counts as a quarter, so a note with
      // no duration weighs the same as an ordinary one rather than four times as much.
      durBeats: durationTypeToNumber(v.duration[i]) || 0.25,
    }));
  });
  const keyDetail = detectKey(keyNotes, { fifths, hasSignature });
  const key = keyDetail.key || MAJOR_BY_FIFTHS[String(fifths || 0)] || 'C';

  const voices = Object.keys(voicesMap).map(k => {
    const v = voicesMap[k];
    return {
      pitch: v.pitch,
      name: v.name,
      onset: v.onset,
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
      key, keyDetail, time, tempo, instrument
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
  // Use the SAME chord engine the on-sheet overlay uses (music-chords.js: stack-aware via note
  // onsets, key-aware), so a searched chord matches what the sheet shows. Its picked chord (an
  // allChords key) is run through normaliseChordName so search.chords keeps the search naming the
  // query matcher understands. Notes carry spelled `name` (for enharmonic-correct matching) + `onset`
  // (as `left`, so notes sounding together form a stack → the bass roots the chord).
  const key = (doc.meta && doc.meta.key) || null;
  const notesByMeasure = {};
  doc.voices.forEach(v => (v.pitch || []).forEach((midi, i) => {
    const meas = v.measureIndex[i];
    const nm = v.name ? v.name[i] : midiToName(midi);
    (notesByMeasure[meas] = notesByMeasure[meas] || []).push({ name: nm, midi, left: v.onset ? v.onset[i] : i });
  }));
  const chordByMeasure = {};
  Object.keys(notesByMeasure).forEach(meas => {
    const best = bestChords(notesByMeasure[meas], allChords, { key, limit: 1 })[0];
    chordByMeasure[meas] = best ? normaliseChordName(best.name) : null;
  });
  doc.voices.forEach(v => v.pitch.forEach((m, i) => {
    if (v.chordSymbol[i] == null) v.chordSymbol[i] = chordByMeasure[v.measureIndex[i]] || null;
  }));
  return doc;
}

// The piece's harmony as ONE measure-ordered list of {symbol, measureStart, measureEnd} spans,
// deduped over consecutive identical symbols. This is the canonical chord sequence the chord
// search indexes (search.chords) AND the segment resolver reconstructs — sharing this one
// function keeps them provably identical.
//
// Why not simply concatenate each voice's chords: inferChords fills every voice with the same
// per-measure progression, so concatenating N voices repeats the progression N times and places a
// high-measure span (end of one voice) immediately before a low-measure span (start of the next).
// That non-monotonic seam both (a) lets a search match leak across two unrelated voices and (b)
// makes segment resolution's MIN-start/MAX-end covering range explode to the whole piece. Ordering
// by measure and taking one representative chord per measure removes both failure modes.
//
// Representative chord per measure = the first non-null chordSymbol found scanning voices in order
// (voice 0 = primary/melody wins), which prefers a real notated harmony over an inferred fill.
export function canonicalChordSpans(voices) {
  const byMeasure = new Map();   // measure -> symbol (first voice to supply one wins)
  (voices || []).forEach(v => {
    (v.chordSymbol || []).forEach((c, i) => {
      if (!c) return;
      const meas = v.measureIndex[i];
      if (!byMeasure.has(meas)) byMeasure.set(meas, c);
    });
  });
  const spans = [];
  for (const meas of [...byMeasure.keys()].sort((a, b) => a - b)) {
    const symbol = byMeasure.get(meas);
    const last = spans[spans.length - 1];
    if (last && last.symbol === symbol) last.measureEnd = meas;
    else spans.push({ symbol, measureStart: meas, measureEnd: meas });
  }
  return spans;
}
