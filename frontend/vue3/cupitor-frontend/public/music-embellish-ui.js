// public/music-embellish-ui.js
//
// Pure glue between the music-embellish engine/XML builder and the Variations UI.
// These helpers are shared by BOTH music.html and the integration test so the UI and the
// test enforce ONE implementation of the index-alignment contract (engine note-list ↔ XML
// builder addressable note-list). No DOM mutation, no UI state — parsing + array shaping only.

import { NOTE_TYPE_BEATS } from './music-player.js';
import { isSingleVoice } from './music-voice-split.js';

// Natural pitch class of each note letter (for deriving MIDI from a <pitch> element).
const STEP_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Beats for an unknown/absent note-type string (a quarter), matching music-player's DEFAULT_BEATS.
const DEFAULT_BEATS = 1;

// chordByMeasure map from collapsedChordSpans output: every measure in a span's
// [measureStart, measureEnd] (sequential) maps to that span's chord symbol.
export function buildChordByMeasure(spans) {
  const map = {};
  (spans || []).forEach((s) => {
    for (let m = s.measureStart; m <= s.measureEnd; m++) map[m] = s.symbol;
  });
  return map;
}

// The engine's voiceNotes for one voice over a sequential measure range [from, to].
//
// CRITICAL collapse rule: the XML builder addresses notes skipping <chord/>-stacked notes, so the
// engine's list must also be ONE note per onset. Notes sharing a (measure, onset) are a vertical
// stack; keep only the FIRST of each group in document order so the two lists index-align.
export function buildVoiceNotes(voice, from, to, chordByMeasure = {}) {
  const out = [];
  const seen = new Set();
  const n = (voice && voice.pitch) ? voice.pitch.length : 0;
  for (let i = 0; i < n; i += 1) {
    const measure = voice.measureIndex[i];
    if (measure < from || measure > to) continue;
    const onset = voice.onset[i];
    const key = `${measure}:${onset}`;
    if (seen.has(key)) continue;   // collapse the chord stack — first note of the (measure,onset) wins
    seen.add(key);
    out.push({
      name: voice.name[i],
      midi: voice.pitch[i],
      onset,
      // The encoder stores duration as a note-TYPE string ('quarter','eighth',…). Convert to
      // numeric BEATS (quarter=1) so the engine's beat-based guards (anticipation/appoggiatura)
      // compare real numbers, not NaN.
      duration: NOTE_TYPE_BEATS[voice.duration[i]] ?? DEFAULT_BEATS,
      measure,
      chord: chordByMeasure[measure] || null,
    });
  }
  return out;
}

// Distinct <voice> text values in document (first-encounter) order, or ['1'] when the source has
// no <voice> elements. Building block for orderedVoiceIds.
export function distinctVoiceIdsInOrder(sourceXml) {
  const doc = new DOMParser().parseFromString(sourceXml, 'application/xml');
  const seen = [];
  Array.from(doc.querySelectorAll('note voice')).forEach((v) => {
    const t = v.textContent.trim();
    if (t && !seen.includes(t)) seen.push(t);
  });
  return seen.length ? seen : ['1'];
}

// The voice ids in the SAME order as the encoder's `Object.keys(voicesMap)`, so that
// orderedVoiceIds(source)[vIdx] lines up with detail.voices[vIdx].
//
// The encoder inserts each distinct `n.voice || '1'` as an object key in first-encounter order,
// then reads `Object.keys` — and JS iterates integer-like keys ascending-numeric FIRST, then the
// remaining string keys in insertion order. Document first-encounter order (distinctVoiceIdsInOrder)
// can disagree with that (e.g. voice "2" notated before voice "1"), which would silently map the
// engine's notes onto the wrong <voice>. Reproduce Object.keys exactly by re-keying a fresh object.
export function orderedVoiceIds(sourceXml) {
  const distinct = distinctVoiceIdsInOrder(sourceXml);
  const ordered = Object.keys(distinct.reduce((o, id) => { o[id] = 1; return o; }, {}));
  return ordered.length ? ordered : ['1'];
}

// The voice-picker entries for the current source. Multi-voice → one entry per real voice. Single
// voice → two synthetic entries backed by splitSingleVoice: Melody (voice 1) + Bass (voice 2).
export function voicePickerEntries(sourceXml, voiceIds) {
  if (isSingleVoice(sourceXml)) {
    return [
      { label: 'Melody (auto-split)', voiceId: '1', split: true },
      { label: 'Bass (auto-split)', voiceId: '2', split: true },
    ];
  }
  return (voiceIds || []).map((id, i) => ({ label: `Voice ${i + 1}`, voiceId: id, split: false }));
}

// MIDI number of a MusicXML <pitch> element (octave+1)*12 + step pc + alter.
function midiFromPitchEl(pitchEl) {
  const stepEl = pitchEl.querySelector('step');
  const octEl = pitchEl.querySelector('octave');
  if (!stepEl || !octEl) return null;
  const step = stepEl.textContent.trim();
  const alterEl = pitchEl.querySelector('alter');
  const alter = alterEl ? parseInt(alterEl.textContent, 10) : 0;
  const octave = parseInt(octEl.textContent, 10);
  return (octave + 1) * 12 + (STEP_PC[step] || 0) + alter;
}

// The XML builder's addressable notes for a voice: playable <note>s in document order, skipping
// <rest> and <chord>-stacked notes, filtered to voiceId (unless the doc has no <voice> elements).
// Returns their MIDI pitches — used for the alignment guard and the test's independent cross-check.
export function addressableMidis(segmentXml, voiceId) {
  const doc = new DOMParser().parseFromString(segmentXml, 'application/xml');
  const all = Array.from(doc.querySelectorAll('note'));
  const hasVoices = all.some((n) => n.querySelector('voice'));
  const out = [];
  all.forEach((n) => {
    if (n.querySelector('rest')) return;
    if (n.querySelector('chord')) return;
    if (hasVoices && voiceId != null) {
      const v = n.querySelector('voice');
      if (!v || v.textContent.trim() !== String(voiceId)) return;
    }
    const p = n.querySelector('pitch');
    if (!p) return;
    out.push(midiFromPitchEl(p));
  });
  return out;
}

// Fretboard steps for a variation's embellished voice: ONE step per BEAT (quarter-note pulse), each
// { name, notes: [{ name, octave }] } holding the voice's notes whose onset falls in that beat — so
// an embellished beat shows its original note together with the notes added to decorate it, and the
// transport advances beat-by-beat (the pulse), not per individual note. Beat = floor(onset /
// divisions), onset being the sum of preceding same-voice non-<chord/> durations in the measure
// (mirrors coloredNoteMarks). Grouping also bounds voicingsForNotes to a beat's worth of notes,
// avoiding the whole-voice cartesian blow-up (~10^16 combos) that OOMed the page. ADDED notes are
// ringed by the panel via their MIDI. Skips <rest>/<chord/>.
export function variationFretSteps(varXml, voiceId) {
  const doc = typeof varXml === 'string' ? new DOMParser().parseFromString(varXml, 'application/xml') : varXml;
  const ids = Array.isArray(voiceId) ? voiceId.map(String) : [String(voiceId)];
  const divEl = doc.querySelector('divisions');
  const divisions = (divEl && parseInt(divEl.textContent, 10)) || 1;   // divisions per quarter (a beat)
  const beats = new Map();   // "measure:beat" → { measure, beat, notes: [], events: [] }
  let baseBeat = 0;          // absolute quarter-beats at the start of the current measure (segment-relative)
  doc.querySelectorAll('measure').forEach((mEl) => {
    const measure = parseInt(mEl.getAttribute('number'), 10);
    let measureDivs = 0;     // longest voice in this measure = its length, to advance baseBeat
    ids.forEach((id) => {
      let onset = 0;   // divisions elapsed for THIS voice within the measure
      Array.from(mEl.querySelectorAll('note')).forEach((n) => {
        const v = n.querySelector('voice');
        // when a note carries a <voice>, require a match; a note with none matches any id
        // (preserves the old "no voice tags at all → everything matches" behavior)
        if (v && v.textContent.trim() !== id) return;   // other voices don't advance this voice's clock
        const isChord = !!n.querySelector('chord');
        const dur = parseInt((n.querySelector('duration') || {}).textContent, 10) || 0;
        const pitch = n.querySelector('pitch');
        if (!isChord && pitch) {
          const beat = Math.floor(onset / divisions);
          const k = `${measure}:${beat}`;
          const grp = beats.get(k) || { measure, beat, notes: [], events: [] };
          const step = pitch.querySelector('step').textContent.trim();
          const octave = parseInt(pitch.querySelector('octave').textContent, 10);
          const alterEl = pitch.querySelector('alter');
          const alter = alterEl ? parseInt(alterEl.textContent, 10) : 0;
          const acc = alter === 2 ? '##' : alter === 1 ? '#' : alter === -1 ? 'b' : alter === -2 ? 'bb' : '';
          grp.notes.push({ name: step + acc, octave });
          // Playable event for the fretboard's "Play Step" (hooks.playSequence expects {midi, beat,
          // durBeats}). `beat` is the note's ABSOLUTE onset in quarter-beats from the segment start,
          // so the page can also drive the sheet cursor to the step. playSequence subtracts the step's
          // own min, so sub-beat embellishments still sequence within the pulse.
          grp.events.push({ midi: midiFromPitchEl(pitch), beat: baseBeat + onset / divisions, durBeats: dur / divisions });
          beats.set(k, grp);
        }
        if (!isChord) onset += dur;              // notes + rests advance; chord-stacked notes don't
      });
      if (onset > measureDivs) measureDivs = onset;   // measure length = its longest voice
    });
    baseBeat += measureDivs / divisions;              // next measure starts after this one
  });
  return [...beats.values()]
    .sort((a, b) => (a.measure - b.measure) || (a.beat - b.beat))
    .filter((s) => s.notes.length)
    .map((s) => ({ name: `m${s.measure} b${s.beat + 1}`, notes: s.notes, events: s.events }));
}

// Per-note beat entries { midi, measure, beat, onsetDivs, durDivs } for one voice over [from,to]
// (inclusive, by <measure number>). Skips <rest>/<chord/>. Beat = floor(onset/divisions), onset
// tracked per-voice within the measure. Used as the contrapuntal melody input.
export function buildBeatNotes(sourceXml, voiceId, from, to) {
  const doc = new DOMParser().parseFromString(sourceXml, 'application/xml');
  const divEl = doc.querySelector('divisions');
  const divisions = (divEl && parseInt(divEl.textContent, 10)) || 1;
  const out = [];
  doc.querySelectorAll('measure').forEach((mEl) => {
    const measure = parseInt(mEl.getAttribute('number'), 10);
    if (measure < from || measure > to) return;
    let onset = 0;
    Array.from(mEl.querySelectorAll('note')).forEach((n) => {
      const v = n.querySelector('voice');
      if (v && v.textContent.trim() !== String(voiceId)) return;
      const isChord = !!n.querySelector('chord');
      const dur = parseInt((n.querySelector('duration') || {}).textContent, 10) || 0;
      const p = n.querySelector('pitch');
      if (!isChord && p) {
        const step = p.querySelector('step').textContent.trim();
        const oct = parseInt(p.querySelector('octave').textContent, 10);
        const alt = p.querySelector('alter') ? parseInt(p.querySelector('alter').textContent, 10) : 0;
        out.push({ midi: 12 * (oct + 1) + (STEP_PC[step] ?? 0) + alt, measure,
          beat: Math.floor(onset / divisions), onsetDivs: onset, durDivs: dur });
      }
      if (!isChord) onset += dur;
    });
  });
  return out;
}

// Shape a counter-line (from generateCounterLines) into writeVoice's notesByMeasure form, reading
// each measure's total divisions so the new voice spans it fully. Divs is the MAX over voices of each
// voice's non-chord duration sum — all voices span the same measure length, so the max equals the
// true measure divisions and never double-counts on a multi-voice (e.g. melody+bass split) segment.
export function counterLineToNotesByMeasure(line, segmentXml) {
  const doc = new DOMParser().parseFromString(segmentXml, 'application/xml');
  const divsByMeasure = {};
  doc.querySelectorAll('measure').forEach((m) => {
    const num = parseInt(m.getAttribute('number'), 10);
    const byVoice = {};   // voiceId → summed non-chord durations
    Array.from(m.querySelectorAll('note')).forEach((n) => {
      if (n.querySelector('chord')) return;
      const v = n.querySelector('voice');
      const id = v ? v.textContent.trim() : '1';
      const dur = parseInt((n.querySelector('duration') || {}).textContent, 10) || 0;
      byVoice[id] = (byVoice[id] || 0) + dur;
    });
    const sums = Object.values(byVoice);
    divsByMeasure[num] = sums.length ? Math.max(...sums) : 0;
  });
  const nbm = {};
  (line.notes || []).forEach((cn) => {
    const arr = (nbm[cn.measure] = nbm[cn.measure] || { divs: divsByMeasure[cn.measure] || 0, notes: [] });
    arr.notes.push({ onsetDivs: cn.onsetDivs, durDivs: cn.durDivs, midi: cn.midi });
  });
  return nbm;
}
