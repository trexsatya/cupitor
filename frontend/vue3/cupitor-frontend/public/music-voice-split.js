// public/music-voice-split.js
//
// Split a single polyphonic voice into a melody line and a bass line by a pitch heuristic, so the
// Variations panel can embellish the melody over an untouched bass (and so contrapuntal has a
// melody to write against). Pure classifier + a MusicXML realizer.

import { writeVoice } from './music-embellish-xml.js';

// Pitch extremes per beat: in each beat the single lowest-MIDI note → bass, every other note →
// melody. A one-note beat → melody only (bass rests). `notes` carry a pre-computed `beat`.
export function classifyBassMelody(notes) {
  const byBeat = new Map();
  (notes || []).forEach((n) => {
    const arr = byBeat.get(n.beat) || []; arr.push(n); byBeat.set(n.beat, arr);
  });
  const melody = []; const bass = [];
  for (const arr of byBeat.values()) {
    if (arr.length === 1) { melody.push(arr[0]); continue; }
    let lowest = arr[0];
    arr.forEach((n) => { if (n.midi < lowest.midi) lowest = n; });
    arr.forEach((n) => { (n === lowest ? bass : melody).push(n); });
  }
  melody.sort((a, b) => a.onsetDivs - b.onsetDivs);
  bass.sort((a, b) => a.onsetDivs - b.onsetDivs);
  return { melody, bass };
}

const STEP_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midiOfPitchEl(p) {
  const step = p.querySelector('step').textContent.trim();
  const oct = parseInt(p.querySelector('octave').textContent, 10);
  const alt = p.querySelector('alter') ? parseInt(p.querySelector('alter').textContent, 10) : 0;
  return 12 * (oct + 1) + (STEP_PC[step] ?? 0) + alt;
}
function nameOfPitchEl(p) {
  const step = p.querySelector('step').textContent.trim();
  const alt = p.querySelector('alter') ? parseInt(p.querySelector('alter').textContent, 10) : 0;
  const acc = alt === 2 ? '##' : alt === 1 ? '#' : alt === -1 ? 'b' : alt === -2 ? 'bb' : '';
  return step + acc;
}

// True when the segment has at most one distinct <voice>.
export function isSingleVoice(xml) {
  const doc = typeof xml === 'string' ? new DOMParser().parseFromString(xml, 'application/xml') : xml;
  const ids = new Set(Array.from(doc.querySelectorAll('note voice')).map((v) => v.textContent.trim()));
  return ids.size <= 1;
}

// Re-partition a single-voice segment into voice "1" = melody, voice "2" = bass (pitch extremes per
// beat). Rebuilds each measure's note content via writeVoice; durations preserved, engraving
// simplified. Returns a new MusicXML string. Multi-voice input is returned unchanged.
export function splitSingleVoice(xml) {
  const doc = typeof xml === 'string' ? new DOMParser().parseFromString(xml, 'application/xml') : xml;
  if (!isSingleVoice(doc)) return typeof xml === 'string' ? xml : new XMLSerializer().serializeToString(doc);
  const divEl = doc.querySelector('divisions');
  const dpq = (divEl && parseInt(divEl.textContent, 10)) || 1;

  const melodyByMeasure = {}; const bassByMeasure = {};
  doc.querySelectorAll('measure').forEach((m) => {
    const num = parseInt(m.getAttribute('number'), 10);
    let onset = 0; let total = 0; let lastOnset = 0;
    const notes = [];
    Array.from(m.querySelectorAll('note')).forEach((n) => {
      const isChord = !!n.querySelector('chord');
      const dur = parseInt((n.querySelector('duration') || {}).textContent, 10) || 0;
      const p = n.querySelector('pitch');
      const noteOnset = isChord ? lastOnset : onset;
      if (p) notes.push({ midi: midiOfPitchEl(p), name: nameOfPitchEl(p),
        onsetDivs: noteOnset, durDivs: dur, beat: Math.floor(noteOnset / dpq) });
      if (!isChord) { lastOnset = onset; onset += dur; total += dur; }
    });
    const { melody, bass } = classifyBassMelody(notes);
    const toSpec = (n) => ({ onsetDivs: n.onsetDivs, durDivs: n.durDivs, midi: n.midi, name: n.name });
    melodyByMeasure[num] = { divs: total, notes: melody.map(toSpec) };
    bassByMeasure[num] = { divs: total, notes: bass.map(toSpec) };
    // Empty the measure's performance content (keep <attributes>).
    Array.from(m.querySelectorAll('note, backup, forward')).forEach((e) => e.remove());
  });

  writeVoice(doc, { voiceId: '1', notesByMeasure: melodyByMeasure });
  writeVoice(doc, { voiceId: '2', notesByMeasure: bassByMeasure });
  return new XMLSerializer().serializeToString(doc);
}
