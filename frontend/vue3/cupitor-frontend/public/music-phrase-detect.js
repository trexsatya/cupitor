// public/music-phrase-detect.js
//
// Automatic phrase detection — the counterpart to the hand-built phrases in music-phrase.js. Nothing
// is tagged first: the phrases are read off the score.
//
// The model of a phrase used here is the practical one a player carries: a piece is a chain of
// roughly equal spans (8 bars unless told otherwise), and the SAME span comes back later with small
// changes — a different cadence, an added ornament, a step up. So detection is two steps:
//
//   1. Cut the piece into `bars`-long segments. The cut has to land on the real phrase boundaries, and
//      an intro or pickup shifts them, so every offset 0…bars-1 is tried and the one that explains the
//      most repetition wins (see `scoreFamilies`). Whatever is left over at either end stays as a
//      short segment of its own rather than being dropped.
//   2. Group the segments into families by similarity, in order of appearance: the first ungrouped
//      segment seeds a family and every later segment close enough joins it. Families are named A, B,
//      C… so the returned list reads like a form analysis, and an occurrence that is not identical to
//      its family's first one is marked `varied` (shown with a prime: m9-16').
//
// Similarity deliberately ignores absolute pitch and looks at two things a listener would call "the
// same phrase":
//   • the melodic contour — successive intervals of the top-sounding line, so a phrase repeated a
//     third higher still matches;
//   • the rhythm — the same note-length/rest tokens the rhythm scanner uses.
// Both are compared by longest-common-subsequence, which is what makes "slight modification"
// tolerable: an extra ornament or a changed last note costs a little, not everything.
//
// No DOM. Takes the renderer's note stream ({measure, onset, durBeats, midi}, onsets and durations in
// quarter-beats — the same stream music-rhythm.js consumes) and returns plain data.

import { rhythmTokens, tokensKey } from './music-rhythm.js';

export const DEFAULT_PHRASE_BARS = 8;

// A note has to differ from its family's reference by less than this to count as "the same phrase".
// 0.62 was picked against real scores: it keeps a re-harmonised or re-ornamented return of a theme in
// the family while keeping a genuinely new section out.
export const DEFAULT_THRESHOLD = 0.62;

// Contour is weighted over rhythm: two different phrases in one piece usually share its rhythm, so
// rhythm alone would fuse them, while the melodic shape is what tells them apart.
const CONTOUR_WEIGHT = 0.6;
const RHYTHM_WEIGHT = 0.4;

// Below this an occurrence is a literal repeat; at or under it, a variation. Not 1 because rounding in
// the interval/rhythm quantisation can shave a hair off an identical span.
const EXACT = 0.995;

// A bar counts as "untouched" only when its notes and their lengths both match, so this sits far above
// the phrase-level threshold: at phrase level the question is "is this the same music?", here it is "is
// this bar unedited?", and any real edit has to answer no.
export const BAR_SAME = 0.995;

// Saturated hues used as translucent bands BEHIND the notes, so they must stay distinguishable at
// ~25% opacity. Deliberately not PHRASE_PALETTE: a detected family and a hand-built phrase of the
// same colour would read as the same thing.
export const DETECTED_SHADES = [
  '#1565c0', '#c62828', '#2e7d32', '#6a1b9a',
  '#ef6c00', '#00838f', '#ad1457', '#4527a0',
];

export function shadeColor(i) {
  const n = DETECTED_SHADES.length;
  return DETECTED_SHADES[((i % n) + n) % n];
}

// Family names in appearance order: A…Z, then AA, AB… (a piece with 27 distinct phrases is not a
// phrase analysis any more, but the names must stay unique regardless).
export function familyName(i) {
  let n = Math.max(0, i | 0), out = '';
  do { out = String.fromCharCode(65 + (n % 26)) + out; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return out;
}

// Lowest and highest measure carrying a note. Null for an empty stream — nothing to segment.
export function measureSpan(stream) {
  let first = Infinity, last = -Infinity;
  (stream || []).forEach((n) => {
    if (!n || n.measure == null) return;
    if (n.measure < first) first = n.measure;
    if (n.measure > last) last = n.measure;
  });
  return Number.isFinite(first) ? { first, last } : null;
}

// The top-sounding line of a bar range: the highest note at each distinct onset. A chord contributes
// only its top note, which is what carries the tune — and it keeps a chordal accompaniment from
// swamping the contour with inner-voice zig-zag.
export function topLine(stream, from, to) {
  const byOnset = new Map();
  (stream || []).forEach((n) => {
    if (!n || n.midi == null || n.measure == null) return;
    if (n.measure < from || n.measure > to) return;
    const key = Math.round((n.onset || 0) * 1000);
    const cur = byOnset.get(key);
    if (!cur || n.midi > cur.midi) byOnset.set(key, { onset: n.onset || 0, midi: n.midi, dur: n.durBeats });
  });
  return [...byOnset.values()].sort((a, b) => a.onset - b.onset);
}

// Successive intervals of a line, in semitones, clamped to one octave: past an octave the exact size
// stops mattering to the shape, and clamping lets a leap answered by a bigger leap still match.
export function contourSeq(line) {
  const out = [];
  for (let i = 1; i < (line || []).length; i += 1) {
    const d = line[i].midi - line[i - 1].midi;
    out.push(String(Math.max(-12, Math.min(12, d))));
  }
  return out;
}

// The line's rhythm as one token per note/rest — the rhythm scanner's own tokens, so "the same
// rhythm" means the same thing here as it does in the Rhythm panel.
export function rhythmSeq(line) {
  const toks = rhythmTokens((line || []).map((n) => ({ onset: n.onset, dur: n.dur })));
  return toks.map((t) => tokensKey([t]));
}

// What a segment is compared by: the whole span's contour + rhythm (what decides whether two segments
// are the same phrase), plus the SAME reading of each bar on its own. Per-bar signatures are what let
// `changedBars` say where a variation actually happens — the span-level sequences run straight through
// the bar lines and cannot tell you that. `bars` is measure-aligned: bars[i] is measure from+i.
export function segmentSignature(stream, from, to) {
  const line = topLine(stream, from, to);
  const bars = [];
  for (let m = from; m <= to; m += 1) {
    const bl = topLine(stream, m, m);
    bars.push({ measure: m, pitches: bl.map((n) => n.midi), rhythm: rhythmSeq(bl) });
  }
  return { contour: contourSeq(line), rhythm: rhythmSeq(line), notes: line.length, bars };
}

// Length of the longest common subsequence of two token arrays.
function lcsLength(a, b) {
  if (!a.length || !b.length) return 0;
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    const row = new Array(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1]);
    }
    prev = row;
  }
  return prev[b.length];
}

// 0…1 agreement of two token sequences: twice the common subsequence over the total length, so
// dropping or adding tokens costs in proportion to how much was changed. Two empty sequences (two
// silent spans) agree.
export function seqSimilarity(a, b) {
  const x = a || [], y = b || [];
  if (!x.length && !y.length) return 1;
  if (!x.length || !y.length) return 0;
  return (2 * lcsLength(x, y)) / (x.length + y.length);
}

// 0…1 likeness of two segments: contour first, rhythm second.
export function segmentSimilarity(a, b) {
  return CONTOUR_WEIGHT * seqSimilarity(a.contour, b.contour)
    + RHYTHM_WEIGHT * seqSimilarity(a.rhythm, b.rhythm);
}

// How far the whole of `occ` sits from `ref` in semitones — the shift under which the MOST of its bars
// come out unchanged. A return stated a third higher then gets one offset for the whole phrase, and the
// per-bar diff below does not report every bar as changed.
//
// Chosen by agreement rather than by averaging the bars' opening notes, which is what this used to do.
// Across the score corpus the average was routinely wrong: on a heavily rewritten return the opening
// notes scatter, so their median named a shift no bar actually agreed with, and bars were then flagged
// or spared essentially at random. Maximising agreement instead is exact when a real transposition
// exists and, when none does, at least keeps the reported set of changed bars as small as the music
// allows — it never claims a difference it could have explained.
//
// Candidates are 0 plus the shift each bar pair implies, so the search stays proportional to the phrase
// rather than sweeping a fixed pitch range. Ties go to the smallest shift, and 0 wins any tie with
// itself in it: an untransposed return must not be described as transposed.
export function transposeOffset(refSig, occSig) {
  const ref = (refSig && refSig.bars) || [];
  const occ = (occSig && occSig.bars) || [];
  const candidates = new Set([0]);
  occ.forEach((bar, i) => {
    const against = ref[i];
    if (!against || !against.pitches.length || !bar.pitches.length) return;
    candidates.add(bar.pitches[0] - against.pitches[0]);
  });
  let best = 0, bestHits = -1;
  [...candidates].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b).forEach((shift) => {
    let hits = 0;
    occ.forEach((bar, i) => {
      const against = ref[i];
      if (against && barSimilarity(against, bar, shift) >= BAR_SAME) hits += 1;
    });
    if (hits > bestHits) { bestHits = hits; best = shift; }   // strictly greater → the smallest shift wins a tie
  });
  return best;
}

// Which bars of `occ` are not the reference's bar in the same position — the measure numbers of the
// variation itself, so a caller can point at them on the page.
//
// Position, not alignment, is the right comparison: occurrences are fixed-length cuts of the same piece,
// so bar 3 of a return answers bar 3 of the phrase by construction. Aligning them instead would let one
// re-ornamented bar slide the rest of the phrase out of correspondence and report all of it as changed.
//
// Bars are compared by their PITCHES (shifted by the phrase's overall transposition) rather than by
// contour, which is what the family-level match uses. Contour cannot see a one-note bar at all — a bar
// holding a single note has no intervals, so a changed note in it would read as no change.
//
// Bars the reference doesn't have (a return longer than its own first statement — what happens when the
// leftover tail of the piece joins a family) count as changed: there is nothing there to be the same as.
export function changedBars(refSig, occSig, threshold = BAR_SAME) {
  const ref = (refSig && refSig.bars) || [];
  const occ = (occSig && occSig.bars) || [];
  const shift = transposeOffset(refSig, occSig);
  const out = [];
  occ.forEach((bar, i) => {
    const against = ref[i];
    if (!against) { out.push(bar.measure); return; }
    if (barSimilarity(against, bar, shift) < threshold) out.push(bar.measure);
  });
  return out;
}

function barSimilarity(refBar, occBar, shift = 0) {
  const refPitches = refBar.pitches.map((p) => String(p + shift));
  return CONTOUR_WEIGHT * seqSimilarity(refPitches, occBar.pitches.map(String))
    + RHYTHM_WEIGHT * seqSimilarity(refBar.rhythm, occBar.rhythm);
}

// Cut [first,last] into `bars`-long spans starting at first+offset. The leftovers before the first
// full span and after the last are kept as `partial` segments — an intro or a coda is still part of
// the piece, and hiding it would make the phrase map lie about what is where.
export function cutSegments(span, bars, offset) {
  const { first, last } = span;
  const width = Math.max(1, bars | 0);
  const out = [];
  const start = first + Math.max(0, offset | 0);
  if (start > first) out.push({ from: first, to: Math.min(start - 1, last), partial: true });
  for (let m = start; m <= last; m += width) {
    const to = Math.min(m + width - 1, last);
    out.push({ from: m, to, partial: (to - m + 1) < width });
  }
  return out.filter((s) => s.from <= s.to);
}

// Group segments into families, in order of appearance: the first ungrouped segment seeds a family and
// every later ungrouped segment similar enough joins it. Greedy and first-fit on purpose — it makes
// the earliest statement of a phrase its reference, which is how a form analysis is written.
export function groupSegments(segments, threshold = DEFAULT_THRESHOLD) {
  const taken = new Array(segments.length).fill(false);
  const families = [];
  segments.forEach((seed, i) => {
    if (taken[i]) return;
    taken[i] = true;
    // The seed IS the reference, so by definition nothing in it differs from the reference.
    const occurrences = [{ ...seed, similarity: 1, varied: false, changed: [] }];
    for (let j = i + 1; j < segments.length; j += 1) {
      if (taken[j]) continue;
      const sim = segmentSimilarity(seed.sig, segments[j].sig);
      if (sim < threshold) continue;
      taken[j] = true;
      occurrences.push({ ...segments[j], similarity: sim, varied: sim < EXACT,
        changed: sim < EXACT ? changedBars(seed.sig, segments[j].sig) : [] });
    }
    families.push({ occurrences });
  });
  return families;
}

// A wrong cut still finds matches — it slices every phrase in the same wrong place, so its pieces
// resemble each other in a weak, uniform way. Counting those the same as a real repeat lets the wrong
// cut win on volume, which is exactly what happened before this was tuned. So the score counts
// CONFIDENCE, not matches: a match is worth its bars scaled by how far past the threshold it got, so a
// 0.63 barely counts while a 0.90 nearly counts in full.
const PARTIAL_BAR_COST = 0.25;

// How much repetition a grouping explains, in bars. Only whole segments count — a leftover 2-bar
// stub is not a phrase, so its resemblance to anything says nothing about whether the cut is right —
// and every partial bar costs a little, which breaks ties toward the cut that wastes the least of the
// piece. This is what picks the offset in `detectPhrases`.
export function scoreFamilies(families, threshold = DEFAULT_THRESHOLD) {
  const room = Math.max(1e-6, 1 - threshold);
  let score = 0, partialBars = 0;
  families.forEach((f) => {
    const seed = f.occurrences[0];
    f.occurrences.forEach((o, i) => {
      if (o.partial) partialBars += (o.to - o.from + 1);
      if (i === 0 || o.partial || (seed && seed.partial)) return;
      score += (o.to - o.from + 1) * ((o.similarity - threshold) / room);
    });
  });
  return score - partialBars * PARTIAL_BAR_COST;
}

// Detect the phrases of a note stream.
//
//   stream  — [{measure, onset, durBeats, midi}], onsets/durations in quarter-beats
//   bars    — phrase length in bars (default 8)
//   offset  — force the cut to start `offset` bars in; omit to try every offset and keep the best
//   threshold — minimum similarity for two segments to be the same phrase
//
// Returns { bars, first, offset, phrases: [{ name, color, count, occurrences: [{from,to,similarity,
// varied, partial}], label, ranges }] } — `label` is ready for a select option, `ranges` for shading,
// and `first + offset` is the bar the first whole phrase starts on.
export function detectPhrases(stream, { bars = DEFAULT_PHRASE_BARS, offset = null, threshold = DEFAULT_THRESHOLD } = {}) {
  const span = measureSpan(stream);
  const width = Math.max(1, bars | 0);
  if (!span) return { bars: width, first: 0, offset: 0, phrases: [] };

  const sigCache = new Map();
  const sigOf = (from, to) => {
    const k = `${from}-${to}`;
    if (!sigCache.has(k)) sigCache.set(k, segmentSignature(stream, from, to));
    return sigCache.get(k);
  };

  // Only offsets that can move a boundary are worth trying, and never more than the piece is long.
  const total = span.last - span.first + 1;
  const offsets = offset != null ? [Math.max(0, offset | 0)]
    : Array.from({ length: Math.max(1, Math.min(width, total)) }, (_, i) => i);

  let best = null;
  offsets.forEach((off) => {
    const segments = cutSegments(span, width, off).map((s) => ({ ...s, sig: sigOf(s.from, s.to) }));
    const families = groupSegments(segments, threshold);
    const score = scoreFamilies(families, threshold);
    // Strictly greater keeps the smallest offset on a tie — the unshifted cut is the honest default.
    if (!best || score > best.score) best = { score, offset: off, families };
  });

  const phrases = best.families.map((f, i) => {
    const name = familyName(i);
    const occurrences = f.occurrences.map(({ from, to, similarity, varied, partial, changed }) =>
      ({ from, to, similarity, varied, partial, changed: changed || [] }));
    return {
      name,
      color: shadeColor(i),
      count: occurrences.length,
      occurrences,
      ranges: occurrences.map((o) => [o.from, o.to]),
      changedBars: occurrences.reduce((n, o) => n + o.changed.length, 0),
      label: phraseLabel(name, occurrences),
    };
  });
  return { bars: width, first: span.first, offset: best.offset, phrases };
}

// "A · 3x · m1-8, m17-24', m33-40'" — the count first (how often it comes back is the thing you scan
// for), then where, with a prime on every modified return. `printed` maps a sequential measure number
// to the number engraved on the page; omitted, the sequential number is shown.
export function phraseLabel(name, occurrences, printed = null) {
  const num = (m) => (printed ? printed(m) : m);
  const where = (occurrences || []).map((o) => {
    const span = o.from === o.to ? `m${num(o.from)}` : `m${num(o.from)}-${num(o.to)}`;
    return span + (o.varied ? '′' : '');
  }).join(', ');
  const times = (occurrences || []).length;
  return `${name} · ${times}× · ${where}`;
}

// Shading bands for one detected phrase: its reference occurrence solid-ish, its modified returns
// lighter, so a glance at the sheet separates "the phrase" from "the phrase, changed".
//
// Each band also carries a `badge` — B1, B2′, B3′ — because a phrase that returns on the very next bar
// makes two bands touch, and touching bands of the same colour read as one long span with no telling
// where one ended. The renderer draws each band as an inset block so a seam shows, and the badge names
// which return it is; between them the boundary is unambiguous even where a phrase breaks across
// systems. A family with a single occurrence needs no number, so it just gets its letter.
export function phraseBands(phrase) {
  if (!phrase) return [];
  const occ = phrase.occurrences || [];
  const out = [];
  occ.forEach((o, i) => {
    // `enabled: false` takes this occurrence off the sheet. Numbering still comes from its place in the
    // FULL list, so switching one off never renumbers the others — B3′ stays B3′ whatever else is showing.
    if (o.enabled === false) return;
    out.push({
      from: o.from, to: o.to, fill: phrase.color, opacity: o.varied ? 0.15 : 0.26,
      badge: `${phrase.name}${occ.length > 1 ? i + 1 : ''}${o.varied ? '′' : ''}`,
      // The bars inside this block that are not the reference's — outlined, so "this return is modified"
      // becomes "this return is modified HERE".
      changed: o.changed || [],
    });
  });
  return out;
}
