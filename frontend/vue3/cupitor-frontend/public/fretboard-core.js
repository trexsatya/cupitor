// public/fretboard-core.js
// Pure guitar-fretboard math. Ported from public/guitar.js (defaultSet, findNoteOnFretboard,
// usefulChords, isPlayable) with all jQuery/DOM removed so it can be unit-tested in isolation.
import { equalNotes } from './music-reference-data.js';
import { cartesian, uniqueByJsonRepresentation } from './data-structures.js';

// Every pair is playable? (data-structures' combinations() depends on a lodash global, so we
// check pairwise directly here to keep this module dependency-light and test-friendly.)
function allPairs(arr, ok) {
  for (let i = 0; i < arr.length; i++)
    for (let j = i + 1; j < arr.length; j++)
      if (!ok(arr[i], arr[j])) return false;
  return true;
}

// Standard EADGBE tuning. Keys are 1-based string numbers, 1 = high-E … 6 = low-E.
// `notes[string][fret]` = note name; `octaves[string][fret]` = octave. Copied from guitar.js defaultSet.
export const STANDARD_TUNING = {
  notes: {
    6: ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E'],
    5: ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A'],
    4: ['D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D'],
    3: ['G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G'],
    2: ['B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    1: ['E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E'],
  },
  octaves: {
    6: ['2', '2', '2', '2', '2', '2', '2', '2', '3', '3', '3', '3', '3'],
    5: ['2', '2', '2', '3', '3', '3', '3', '3', '3', '3', '3', '3', '3'],
    4: ['3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '4', '4', '4'],
    3: ['3', '3', '3', '3', '3', '4', '4', '4', '4', '4', '4', '4', '4'],
    2: ['3', '4', '4', '4', '4', '4', '4', '4', '4', '4', '4', '4', '4'],
    1: ['4', '4', '4', '4', '4', '4', '4', '4', '5', '5', '5', '5', '5'],
  },
};

const STRINGS = [1, 2, 3, 4, 5, 6];

// Every {string, fret, octave} where the pitch class `noteName` appears (frets 0..12).
// If `octave` is given, restrict to that register. Enharmonic via equalNotes.
export function findPositions(noteName, octave) {
  const out = [];
  STRINGS.forEach((string) => {
    const frets = STANDARD_TUNING.notes[string];
    for (let fret = 0; fret < frets.length; fret++) {
      const oct = STANDARD_TUNING.octaves[string][fret];
      if (equalNotes(frets[fret], noteName) && (octave == null || oct === '' + octave)) {
        out.push({ string, fret, octave: oct });
      }
    }
  });
  return out;
}

// A pair of positions is playable if either is an open string, or the fretted span is <= 3.
export function isPlayable(a, b) {
  if (a.fret === 0 || b.fret === 0) return true;
  return Math.abs(a.fret - b.fret) <= 3;
}

// Accept either a pitch-class string ("C#") or an object { name, octave }. With an octave the
// position lookup is restricted to that exact register so dots land at the actual sounding pitch;
// without one (plain string) the note resolves to any register.
function normNote(n) { return typeof n === 'string' ? { name: n, octave: undefined } : (n || {}); }

// All playable voicings for a note-set. Each note resolves to one position; every string is used
// at most once, every pair is playable, and every note that has any reachable position is covered.
// `notes` is an array of { name, octave } (or plain pitch-class strings). Octave matching is strict:
// an octave-tagged note out of guitar range contributes no positions and is dropped (we never
// relocate it to the wrong register). De-duplicated.
export function voicingsForNotes(notes) {
  const perNote = (notes || [])
    .map(normNote)
    .map((n) => findPositions(n.name, n.octave))
    .filter((arr) => arr.length > 0);
  if (!perNote.length) return [];
  return cartesian(...perNote)
    .filter((combo) => allPairs(combo, isPlayable))
    .filter((combo) => {
      const strings = combo.map((p) => p.string);
      return new Set(strings).size === strings.length;
    })
    .filter((combo) => combo.length >= perNote.length)
    .map((combo) => combo.map((p) => ({ string: p.string, fret: p.fret })))
    .filter(uniqueByJsonRepresentation);
}

// Mean fret of the fretted (non-open) positions; 0 when all open. Used as the "hand position".
export function voicingCenter(voicing) {
  const fretted = voicing.filter((p) => p.fret > 0).map((p) => p.fret);
  if (!fretted.length) return 0;
  return fretted.reduce((a, b) => a + b, 0) / fretted.length;
}

// Span of the fretted positions (max - min fret); 0 when all open.
export function voicingSpan(voicing) {
  const fretted = voicing.filter((p) => p.fret > 0).map((p) => p.fret);
  if (!fretted.length) return 0;
  return Math.max(...fretted) - Math.min(...fretted);
}

const SPARK_GLYPHS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

// Render per-step movement deltas as a compact block sparkline (one glyph per move).
export function movementSparkline(moves) {
  return (moves || []).map((m) => SPARK_GLYPHS[Math.min(SPARK_GLYPHS.length - 1, Math.round(m))]).join('');
}

// "Open position" conventionally spans the first four frets (open strings + frets 1–4), so a path
// whose mean fret sits there is the open option — even if a chord or two needs light fretting.
function pathLabel(region) {
  if (region <= 4) return `open position (frets 0–${Math.max(2, region)})`;
  if (region <= 7) return `mid neck ~fret ${region}`;
  return `up the neck ~fret ${region}`;
}

// Neck regions to seed distinct "ways to play". Each anchor biases a beam search toward that
// fret zone, so we surface an open/low option, a couple of mid-neck barre options, and an
// up-the-neck option — instead of only the single globally-cheapest path (which always clusters
// near open position and collapsed to one entry).
const ANCHORS = [0, 3, 5, 7, 9, 12];

// One coherent path anchored near `anchor`: beam search scoring each step by hand movement plus
// the voicing's distance from the anchor. Returns the best beam (or null for an empty sequence).
function bestPathNearAnchor(stepVoicings, anchor, beamWidth, anchorWeight) {
  let beams = [{ voicings: [], cost: 0, scored: 0, lastCenter: null, moves: [] }];
  for (const voicings of stepVoicings) {
    const options = voicings.length ? voicings : [null];
    const next = [];
    for (const beam of beams) {
      for (const v of options) {
        const center = v ? voicingCenter(v) : beam.lastCenter;
        const move = (v && beam.lastCenter != null) ? Math.abs(center - beam.lastCenter) : 0;
        const anchorPen = v ? Math.abs(center - anchor) * anchorWeight : 0;
        next.push({
          voicings: [...beam.voicings, v],
          cost: beam.cost + move,                       // displayed/ranked by true movement only
          scored: beam.scored + move + anchorPen,       // region-biased score that drives the search
          lastCenter: center,
          moves: [...beam.moves, move],
        });
      }
    }
    next.sort((a, b) => a.scored - b.scored);
    beams = next.slice(0, beamWidth);
  }
  return beams[0] || null;
}

// Up to `maxPaths` distinct ways to play the whole sequence. Each anchor yields one region-coherent
// path; we dedupe by rounded mean neck region and rank what remains by ascending total movement.
// An empty step contributes a `null` voicing (no playable shape) and 0 move cost.
export function findPaths(stepVoicings, { beamWidth = 8, maxPaths = 5, anchorWeight = 2 } = {}) {
  const seen = new Set();
  const out = [];
  for (const anchor of ANCHORS) {
    const beam = bestPathNearAnchor(stepVoicings, anchor, beamWidth, anchorWeight);
    if (!beam) continue;
    const centers = beam.voicings.filter(Boolean).map(voicingCenter);
    const region = centers.length ? Math.round(centers.reduce((a, b) => a + b, 0) / centers.length) : 0;
    if (seen.has(region)) continue;
    seen.add(region);
    out.push({ voicings: beam.voicings, cost: beam.cost, moves: beam.moves, label: pathLabel(region) });
  }
  out.sort((a, b) => a.cost - b.cost);
  return out.slice(0, maxPaths);
}
