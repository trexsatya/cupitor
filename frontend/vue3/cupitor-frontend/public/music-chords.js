// public/music-chords.js
// Chord guessing ported from the original analysis pipeline (music-analysis.js's
// guessChordsForMeasure / matchingChords): rank a measure's notes into onset "steps" by
// horizontal position, slide a 2-step window, and flag a chord only when ALL of its tones
// are present — tracking exactly which notes formed it (so the UI can highlight them).
// Pure + unit-tested; the DOM extraction that feeds it lives in the renderer glue.
import { allChords } from './music-reference-data.js';

// Group notes by their onset `step`, returning the groups in ascending step order.
function groupByStep(notes) {
  const m = new Map();
  for (const n of notes) { if (!m.has(n.step)) m.set(n.step, []); m.get(n.step).push(n); }
  return [...m.keys()].sort((a, b) => a - b).map((k) => m.get(k));
}

// Pure: chords from `chordsToScan` whose every tone appears among `notes` (matched by .name).
// Returns [{ name, notes: <the notes that are chord tones>, chordTones }].
export function matchingChords(notes, chordsToScan = allChords) {
  const names = notes.map((n) => n.name);
  const matches = [];
  Object.keys(chordsToScan).forEach((name) => {
    const tones = chordsToScan[name].notes;
    if (tones && tones.length && tones.every((t) => names.includes(t))) {
      matches.push({ name, notes: notes.filter((n) => tones.includes(n.name)), chordTones: tones });
    }
  });
  return matches;
}

// Pure: chords found within one measure's notes. Each note is { name, left, ... }; `left`
// (x-position) ranks notes into onset steps. Slides a 2-step window (matching the original).
export function guessChordsForMeasure(notes, chordsToScan = allChords) {
  if (!notes || !notes.length) return [];
  const xs = [...new Set(notes.map((n) => n.left))].sort((a, b) => a - b);
  notes.forEach((n) => { n.step = xs.indexOf(n.left); });
  const steps = groupByStep(notes);
  const out = [];
  let start = 0, scanned = [];
  while (start < steps.length) {
    scanned = scanned.concat(steps.slice(start, start + 2).flat());
    const matches = matchingChords(scanned, chordsToScan);
    if (matches.length) { out.push({ range: [start, start + 2], notes: scanned, chords: matches }); scanned = []; }
    start += 1;
  }
  return out;
}

// Pure: flat, per-measure de-duplicated chord list. `notesByMeasure` maps a measure number
// to its notes. Returns [{ measure, name, notes }] — `notes` are the contributing note
// objects (which carry whatever ref the caller attached, e.g. a notehead element).
export function guessChords(notesByMeasure, chordsToScan = allChords) {
  const result = [];
  Object.keys(notesByMeasure).forEach((mk) => {
    const measure = Number(mk);
    const seen = new Set();
    guessChordsForMeasure(notesByMeasure[mk], chordsToScan).forEach((g) => {
      g.chords.forEach((c) => {
        if (seen.has(c.name)) return;
        seen.add(c.name);
        result.push({ measure, name: c.name, notes: c.notes });
      });
    });
  });
  return result;
}
