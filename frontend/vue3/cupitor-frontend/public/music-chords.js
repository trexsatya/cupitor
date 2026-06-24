// public/music-chords.js
// Chord guessing ported from the original analysis pipeline (music-analysis.js's
// guessChordsForMeasure / matchingChords): rank a measure's notes into onset "steps" by
// horizontal position, slide a 2-step window, and flag a chord only when ALL of its tones
// are present — tracking exactly which notes formed it (so the UI can highlight them).
// Pure + unit-tested; the DOM extraction that feeds it lives in the renderer glue.
import { allChords } from './music-reference-data.js';

// Pure: chord key → label for display. A plain major triad drops its "maj" (Gmaj → G);
// everything else is shown verbatim, so "maj7" stays "maj7" (Gmaj7), and dim/min/aug/7
// are untouched (Bdim, Em, G7). Only an exact trailing "maj" is stripped.
export function chordDisplayName(name) {
  if (!name) return name;
  return name.replace(/maj$/, '');
}

// Pure: every note in `notes` (one onset-ordered stream, e.g. a single system) that takes
// part in a COMPLETE occurrence of `chordName` — a tight run, starting on a chord tone and
// spanning at most `tones + slack` consecutive notes, in which every one of the chord's tones
// appears. The occurrence's chord-tone notes are collected (intruding non-chord notes skipped);
// an isolated tone with no nearby partners is excluded. Returns the de-duplicated note objects
// (same refs as input, in stream order), so the caller can highlight them. Used by the "Global"
// chord match: click a chord name → light up every place it occurs across the visible sheet.
export function chordOccurrenceNotes(notes, chordName, dict = allChords, { slack = 2 } = {}) {
  const tones = dict[chordName] && dict[chordName].notes;
  if (!tones || !tones.length || !notes || notes.length < tones.length) return [];
  const toneSet = new Set(tones);
  const sorted = notes.slice().sort((a, b) => a.left - b.left);
  const span = tones.length + slack;   // a complete occurrence spans at most this many notes
  const picked = new Set();
  for (let i = 0; i < sorted.length; i++) {
    if (!toneSet.has(sorted[i].name)) continue;   // a run can only start on a chord tone
    const seen = new Set();
    const idxs = [];
    for (let j = i; j < sorted.length && j < i + span; j++) {
      if (toneSet.has(sorted[j].name)) { seen.add(sorted[j].name); idxs.push(j); }
    }
    if (seen.size === toneSet.size) idxs.forEach((k) => picked.add(k));
  }
  return [...picked].sort((a, b) => a - b).map((k) => sorted[k]);
}

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

// Pitch-class numbers (enharmonics fold together) so chord roots/tones compare across spellings.
const PITCH_CLASS = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, 'E#': 5, Fb: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, 'B#': 0, Cb: 11 };
const pcOf = (name) => PITCH_CLASS[name];

// Pure: vertical-stack evidence in a note stream. Notes that share an onset (`left`) sound together
// — a real chord stack, much stronger harmonic evidence than notes that merely fall in a melodic
// window. Returns the pitch-classes (numbers) appearing in ANY stack, plus the bass (lowest-midi)
// pitch-class and note name of the PRIMARY stack (largest, ties → earliest). midi-less notes (the
// pure-unit-test inputs) → bassPC null, so ranking degrades to the original coverage order.
export function stackInfo(notes) {
  const byOnset = new Map();
  (notes || []).forEach((n) => { const k = n.left; if (!byOnset.has(k)) byOnset.set(k, []); byOnset.get(k).push(n); });
  const stacks = [];
  byOnset.forEach((ns, onset) => { if (ns.length >= 2) stacks.push({ onset: Number(onset), ns }); });
  const stackPCs = new Set();
  stacks.forEach((s) => s.ns.forEach((n) => { const p = pcOf(n.name); if (p != null) stackPCs.add(p); }));
  let bassPC = null, bassName = null;
  if (stacks.length) {
    stacks.sort((a, b) => (b.ns.length - a.ns.length) || (a.onset - b.onset));
    let low = null;
    stacks[0].ns.forEach((n) => { if (n.midi != null && (low == null || n.midi < low.midi)) low = n; });
    if (low) { bassPC = pcOf(low.name); bassName = low.name; }
  }
  return { hasStacks: stacks.length > 0, stackPCs, bassPC, bassName };
}

// Pure: rank candidate chords for a note stream, stack-aware. When the stream has vertical stacks,
// prefer (1) the chord whose ROOT is the stack's bass, (2) chords fully realized WITHIN the stacks,
// (3) the simpler (fewer-tone) chord, then (4) melodic coverage. With no stacks it falls back to the
// original order (coverage, then simplicity), so detection is unchanged where nothing sounds together.
export function rankMatches(matches, notes) {
  const st = stackInfo(notes);
  const rootIsBass = (m) => (st.bassPC != null && pcOf(m.chordTones[0]) === st.bassPC) ? 1 : 0;
  const fullInStack = (m) => m.chordTones.every((t) => st.stackPCs.has(pcOf(t))) ? 1 : 0;
  return matches.slice().sort((a, b) => {
    if (st.hasStacks) {
      const r = rootIsBass(b) - rootIsBass(a); if (r) return r;
      const f = fullInStack(b) - fullInStack(a); if (f) return f;
      const s = a.chordTones.length - b.chordTones.length; if (s) return s;   // prefer the simpler triad
    }
    return (b.notes.length - a.notes.length) || (a.chordTones.length - b.chordTones.length);
  });
}

// Diatonic triad quality of a root in a MAJOR key: I/IV/V major, ii/iii/vi minor, vii° diminished.
const MAJOR_DEGREE = { 0: 'maj', 2: 'min', 4: 'min', 5: 'maj', 7: 'maj', 9: 'min', 11: 'dim' };
function diatonicQuality(rootPc, keyPc) {
  if (rootPc == null || keyPc == null) return null;
  return MAJOR_DEGREE[((rootPc - keyPc) % 12 + 12) % 12] || null;
}

// Pure: name the chord implied by a BARE power chord — a primary stack that is exactly {root, fifth}
// (a perfect fifth, bass = root) with no third sounding. Its quality can't be matched (the third is
// absent), so it's taken from a third elsewhere in the measure (minor wins over major) or, failing
// that, from the key (diatonic triad on the root). Returns a match {name, notes, chordTones} from
// `dict`, or null when the stack isn't a bare power chord or no quality can be resolved.
function powerChordMatch(notes, dict, keyPc) {
  const st = stackInfo(notes);
  if (st.bassPC == null) return null;
  const root = st.bassPC;
  const others = [...st.stackPCs].filter((p) => p !== root);
  if (others.length !== 1 || ((others[0] - root + 12) % 12) !== 7) return null;   // not exactly root + perfect fifth
  const present = new Set((notes || []).map((n) => pcOf(n.name)));
  const qual = present.has((root + 3) % 12) ? 'min' : present.has((root + 4) % 12) ? 'maj' : diatonicQuality(root, keyPc);
  if (!qual) return null;
  const name = st.bassName + (qual === 'min' ? 'min' : qual === 'dim' ? 'dim' : 'maj');
  if (!dict[name]) return null;
  const tones = dict[name].notes;
  return { name, notes: (notes || []).filter((n) => tones.includes(n.name)), chordTones: tones };
}

// Pure: the best chords for a note set, stack-aware, with a key-resolved power-chord fallback when
// the top match's root isn't the stack bass (a bare power chord names a chord the matcher can't).
// Returns up to `limit` matches, best first.
export function bestChords(notes, dict = allChords, { key = null, limit = 3 } = {}) {
  const keyPc = key != null ? PITCH_CLASS[String(key).replace(/m(in)?$/i, '')] : null;
  const ranked = rankMatches(matchingChords(notes, dict), notes);
  const st = stackInfo(notes);
  const top = ranked[0];
  const topRootIsBass = top && st.bassPC != null && pcOf(top.chordTones[0]) === st.bassPC;
  if (!topRootIsBass) {
    const pc = powerChordMatch(notes, dict, keyPc);
    if (pc && !ranked.some((m) => m.name === pc.name)) return [pc, ...ranked].slice(0, limit);
  }
  return ranked.slice(0, limit);
}

// Pure: like bestChords, but a chord may be COMPLETED by tones just across the barline. Mostly a
// measure's harmony lives in its own notes (and is returned as-is), but sometimes the tone that
// finishes the chord sits late in the previous measure or early in the next. So: only when the
// measure's own top chord is NOT a full triad rooted on its stack bass do we retry with the
// `neighborNotes` mixed in — and we accept the completed reading ONLY if it stays rooted on the same
// bass. This is deliberately conservative: a wider, unconditional window flips solid measures (a
// passing melody note turns Bm→Bsus4), whereas same-bass completion only ever fills a gap.
export function bestChordsCompleting(ownNotes, neighborNotes, dict = allChords, { key = null, limit = 3 } = {}) {
  const own = bestChords(ownNotes, dict, { key, limit });
  const st = stackInfo(ownNotes);
  const top = own[0];
  const presentPc = new Set((ownNotes || []).map((n) => pcOf(n.name)));
  const topFull = top && st.bassPC != null && pcOf(top.chordTones[0]) === st.bassPC
    && top.chordTones.length >= 3 && top.chordTones.every((t) => presentPc.has(pcOf(t)));
  if (topFull || st.bassPC == null || !neighborNotes || !neighborNotes.length) return own;
  const completed = bestChords(ownNotes.concat(neighborNotes), dict, { key, limit });
  return (completed[0] && pcOf(completed[0].chordTones[0]) === st.bassPC) ? completed : own;
}

// Pick the single best match for a window — now stack-aware (see rankMatches): a vertical chord
// outranks a melodic coincidence. Without this every subset/superset that fits a scale-rich window
// is emitted, flooding the result.
function pickBestChord(matches, notes) {
  return rankMatches(matches, notes)[0];
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
      const best = pickBestChord(matches, scanned);
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
export function guessChords(notesByMeasure, chordsToScan = allChords, { maxPerMeasure = 3, key = null } = {}) {
  const result = [];
  Object.keys(notesByMeasure).forEach((mk) => {
    const measure = Number(mk);
    bestChords(notesByMeasure[mk] || [], chordsToScan, { key, limit: maxPerMeasure })
      .forEach((c) => result.push({ measure, name: c.name, notes: c.notes }));
  });
  return result;
}

// Pure: chord "areas" over a single note stream. Notes are { name, left, el? }. Slides an
// OVERLAPPING window that grows (from each onset, by x) until it spans `windowSize` DISTINCT
// pitch classes (octaves/repeats ignored); each window that matches contributes its chords. Consecutive overlapping windows merge into one area — so
// proximal candidates for the same place (n1,n2,n3→chord1 and n2,n3,n4→chord2) land together —
// while a window that matches nothing (a melodic gap) ends the current area. Per area the chords are
// chosen by bestChords (stack-aware + key-resolved power chord), so the label reflects the vertical
// harmony rather than a melodic coincidence. `key` (e.g. 'C') enables the power-chord fallback.
// Returns [{ x, top, chords: [{ name, notes, chordTones }] }] where x/top anchor the area (min left /
// min notehead top of its notes) for placing stacked labels in the score.
export function guessChordAreas(notes, chordsToScan = allChords, { windowSize = 4, maxPerArea = 3, key = null } = {}) {
  if (!notes || notes.length < 2) return [];
  const sorted = notes.slice().sort((a, b) => (a.left - b.left));
  const areas = [];
  let cur = null;   // { startIdx, endIdx, matches: [] }
  for (let i = 0; i + 1 < sorted.length; i++) {
    // Expand from i until the window spans `windowSize` DISTINCT pitch classes (octaves and
    // repeats don't count), so the window holds enough harmony to name a chord.
    const seen = new Set();
    let j = i;
    while (j < sorted.length) { seen.add(sorted[j].name); j++; if (seen.size >= windowSize) break; }
    const win = sorted.slice(i, j);
    const matches = matchingChords(win, chordsToScan);
    if (!matches.length) { if (cur) { areas.push(cur); cur = null; } continue; }
    if (cur && i <= cur.endIdx) {            // overlaps the current run → same area
      cur.endIdx = i + win.length - 1;
      cur.matches.push(...matches);
    } else {
      if (cur) areas.push(cur);
      cur = { startIdx: i, endIdx: i + win.length - 1, matches: matches.slice() };
    }
  }
  if (cur) areas.push(cur);

  const topOf = (n) => (n.el && n.el.getBBox ? n.el.getBBox().y : 0);
  return areas.map((area) => {
    const areaNotes = sorted.slice(area.startIdx, area.endIdx + 1);
    const x = Math.min(...areaNotes.map((n) => n.left));
    const top = Math.min(...areaNotes.map(topOf));
    const chords = bestChords(areaNotes, chordsToScan, { key, limit: maxPerArea })
      .map((m) => ({ name: m.name, notes: m.notes, chordTones: m.chordTones }));
    return { x, top, chords };
  }).filter((a) => a.chords.length);
}
