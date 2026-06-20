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

// Pick the single best match for a window: the chord that explains the most notes, breaking
// ties toward the simpler (fewer-tone) chord. Without this every subset/superset that fits a
// scale-rich window is emitted, flooding the result.
function pickBestChord(matches) {
  return matches.slice().sort((a, b) =>
    (b.notes.length - a.notes.length) || (a.chordTones.length - b.chordTones.length)
  )[0];
}

// Pure: chords found within one measure's notes. Each note is { name, left, ... }; `left`
// (x-position) ranks notes into onset steps. Slides a 2-step window (matching the original)
// and records only the single best chord per matched window.
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
    if (matches.length) {
      const best = pickBestChord(matches);
      out.push({ range: [start, start + 2], notes: best.notes, chords: [best] });
      scanned = [];
    }
    start += 1;
  }
  return out;
}

// Pure: flat, per-measure chord list, ranked + capped. `notesByMeasure` maps a measure number
// to its notes. For each measure we keep each distinct chord once (with its richest set of
// contributing notes) and return only the best `maxPerMeasure` by coverage — without the cap a
// scale-like measure matches most of the diatonic family and floods the UI with chips.
// Returns [{ measure, name, notes }]; `notes` are the contributing note objects (which carry
// whatever ref the caller attached, e.g. a notehead element, for highlighting).
export function guessChords(notesByMeasure, chordsToScan = allChords, { maxPerMeasure = 3 } = {}) {
  const result = [];
  Object.keys(notesByMeasure).forEach((mk) => {
    const measure = Number(mk);
    const byName = new Map();
    guessChordsForMeasure(notesByMeasure[mk], chordsToScan).forEach((g) => {
      g.chords.forEach((c) => {
        const prev = byName.get(c.name);
        if (!prev || c.notes.length > prev.notes.length) byName.set(c.name, c);
      });
    });
    [...byName.values()]
      .sort((a, b) => (b.notes.length - a.notes.length) || (a.chordTones.length - b.chordTones.length))
      .slice(0, maxPerMeasure)
      .forEach((c) => result.push({ measure, name: c.name, notes: c.notes }));
  });
  return result;
}
