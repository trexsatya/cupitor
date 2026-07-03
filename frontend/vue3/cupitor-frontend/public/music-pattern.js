// public/music-pattern.js
// Pure pattern matcher for tag search: given one tag's notes located in the rendered note stream,
// find OTHER occurrences of the same pattern. The pattern preserves gap structure — the number of
// intervening (untagged) notes between consecutive tagged notes is part of the template — so a
// match reproduces both the pitch/duration relations AND the spacing. No DOM; arrays only.

const EPS = 1e-6;

// Diatonic collections (semitone offsets from the tonic). Minor = natural minor.
export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Krumhansl-Schmuckler key profiles (tonal hierarchy), index 0 = tonic.
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Monotonic diatonic degree index of a MIDI pitch under (tonicPc, scaleSemis): `7*oct + countBelow`,
// where oct/within come from `midi − tonicPc` and countBelow = scale tones ≤ within. In-scale notes
// get integer degrees whose differences are diatonic steps; out-of-scale notes snap to the degree
// just below. Null midi → null. Note: differences are invariant to the tonic chosen within the same
// collection, so only the scale set affects matching.
export function degreeIndex(midi, tonicPc, scaleSemis) {
  if (midi == null) return null;
  const n = midi - tonicPc;
  const oct = Math.floor(n / 12);
  const within = n - 12 * oct;            // 0..11
  let countBelow = 0;
  for (const s of scaleSemis) if (s <= within) countBelow++;
  return 7 * oct + countBelow;
}

// Map an array of midis to diatonic degree indices (null entries preserved).
export function degreeSequence(midis, tonicPc, scaleSemis) {
  return (midis || []).map((m) => degreeIndex(m, tonicPc, scaleSemis));
}

// Human key name, e.g. keyLabel(4,'minor') → 'E minor'.
export function keyLabel(tonicPc, mode) { return `${PC_NAMES[((tonicPc % 12) + 12) % 12]} ${mode}`; }

function pearson(a, b) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return (da > 0 && db > 0) ? num / Math.sqrt(da * db) : -Infinity;
}

// Best-fit key for a 12-bin pitch-class histogram → { tonicPc, mode }. Correlates the histogram
// with the major/minor Krumhansl profiles rotated to each of the 12 tonics; highest wins.
export function guessKey(pcCounts) {
  const counts = (pcCounts && pcCounts.length === 12) ? pcCounts : new Array(12).fill(0);
  let best = { tonicPc: 0, mode: 'major' };
  let bestScore = -Infinity;
  for (let t = 0; t < 12; t++) {
    for (const [mode, profile] of [['major', MAJOR_PROFILE], ['minor', MINOR_PROFILE]]) {
      const rotated = counts.map((_, pc) => profile[(((pc - t) % 12) + 12) % 12]);
      const score = pearson(counts, rotated);
      if (score > bestScore) { bestScore = score; best = { tonicPc: t, mode }; }
    }
  }
  return best;
}

// Build a slide-able template from one tag's ascending stream indices. `midis`/`durs` are the full
// stream's per-note arrays. `offsets` encode the gap structure (indices relative to the first
// tagged note); `intervals` are Δsemitones between consecutive tagged notes; `durations` are the
// tagged notes' own durations (quarter-beats).
export function extractTemplate(taggedIdx, midis, durs) {
  const idx = (taggedIdx || []).slice().sort((a, b) => a - b);
  const start = idx.length ? idx[0] : 0;
  const offsets = idx.map((i) => i - start);
  const intervals = [];
  for (let j = 1; j < idx.length; j++) intervals.push(midis[idx[j]] - midis[idx[j - 1]]);
  const durations = idx.map((i) => durs[i]);
  return { start, offsets, intervals, durations };
}

// Slide the template over the stream and return every match (excluding the original at
// `template.start`). Each match is the list of stream indices at the tagged positions
// (`offsets.map((o) => s + o)`); the wildcard notes in between are not returned. O(n·k).
// `mode` ∈ 'intervals' | 'duration' | 'both'. `durationStrict` true → exact note types; false →
// proportional (scale-invariant, so augmentation/diminution matches).
export function findMatches(midis, durs, template, { mode = 'intervals', durationStrict = true } = {}) {
  const { offsets, intervals, durations, start } = template;
  const k = offsets.length;
  if (k < 2) return [];               // a single note has no interval and any duration matches
  const span = offsets[k - 1];
  const n = midis.length;
  const wantInt = mode === 'intervals' || mode === 'both';
  const wantDur = mode === 'duration' || mode === 'both';
  const out = [];
  for (let s = 0; s + span < n; s++) {
    if (s === start) continue;        // the original occurrence
    if (wantInt && !intervalsMatch(midis, offsets, intervals, s)) continue;
    if (wantDur && !durationsMatch(durs, offsets, durations, s, durationStrict)) continue;
    out.push(offsets.map((o) => s + o));
  }
  return out;
}

// 12-bin pitch-class histogram of a midi list (nulls skipped) — the input to guessKey.
export function pcHistogram(midis) {
  const counts = new Array(12).fill(0);
  (midis || []).forEach((m) => { if (m != null) counts[((m % 12) + 12) % 12]++; });
  return counts;
}

// The pitch sequence a match runs on: raw midis (chromatic) or diatonic degree indices under
// `key` ({tonicPc,mode}), guessed from `midis` when `key` is null. Duration-only matching
// (`wantInt` false) always uses raw midis. Returns { pitchSeq, key } (key null unless diatonic).
export function pitchSequence(midis, { intervalBasis = 'chromatic', wantInt = true, key = null } = {}) {
  if (intervalBasis !== 'diatonic' || !wantInt) return { pitchSeq: midis, key: null };
  const k = key || guessKey(pcHistogram(midis));
  const scale = k.mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
  return { pitchSeq: degreeSequence(midis, k.tonicPc, scale), key: k };
}

// Melodic pattern search. `findMatches` counts the intervening stream notes between tagged notes
// as part of the template, so two things break a melodically-identical recurrence: (1) notes from
// another voice/staff interleaved between melody notes, and (2) chord tones stacked on a melody
// note's onset. We remove both by reducing the stream to a monophonic melodic line before matching:
//   • scope to the voice(s) the tag lives in (drops other voices/staves), then
//   • collapse each onset to its TOP note (highest midi) — the melody — so chords become one step.
// Gap structure is still honored WITHIN that melodic line (skipped onsets stay part of the shape).
// `stream` = reading-order notes with {midi, durBeats, voice, onset}; `tagIdx` = the tag's note
// indices in `stream`. Tag notes map to the melodic step at their onset (the tag's own notes are
// assumed to be the melody, i.e. the top note at each onset). Returns stream-index lists
// { originalIdx, matches } (matches excludes the original) + the resolved `key`.
export function findScopedMatches(stream, tagIdx, { mode = 'intervals', durationStrict = true, intervalBasis = 'chromatic', key = null } = {}) {
  const idx = (tagIdx || []).slice().sort((a, b) => a - b);
  if (idx.length < 2) return { originalIdx: idx, matches: [], key: null };
  const voices = new Set(idx.map((i) => stream[i] && stream[i].voice));
  // Top note per onset within the tag's voice(s). Each melody entry keeps the full-stream index of
  // the note it represents, so matches map back to real noteheads.
  const byOnset = new Map();
  stream.forEach((n, i) => {
    if (!n || n.midi == null || !voices.has(n.voice)) return;
    const cur = byOnset.get(n.onset);
    if (!cur || n.midi > cur.midi) byOnset.set(n.onset, { pos: i, midi: n.midi, durBeats: n.durBeats, onset: n.onset });
  });
  const melody = [...byOnset.values()].sort((a, b) => a.onset - b.onset);
  const melodyMidis = melody.map((e) => e.midi);
  const melodyDurs = melody.map((e) => e.durBeats);
  const wantInt = mode === 'intervals' || mode === 'both';
  const { pitchSeq, key: usedKey } = pitchSequence(melodyMidis, { intervalBasis, wantInt, key });
  const tagOnsets = new Set(idx.map((i) => stream[i].onset));
  const tagPos = [];
  melody.forEach((e, mi) => { if (tagOnsets.has(e.onset)) tagPos.push(mi); });
  if (tagPos.length < 2) return { originalIdx: tagPos.map((mi) => melody[mi].pos), matches: [], key: usedKey };
  const template = extractTemplate(tagPos, pitchSeq, melodyDurs);
  const matches = findMatches(pitchSeq, melodyDurs, template, { mode, durationStrict });
  return {
    originalIdx: tagPos.map((mi) => melody[mi].pos),
    matches: matches.map((m) => m.map((mi) => melody[mi].pos)),
    key: usedKey,
  };
}

// Transposition-invariant: every consecutive Δsemitones at the offset positions equals the template.
function intervalsMatch(midis, offsets, intervals, s) {
  for (let j = 0; j < intervals.length; j++) {
    if (midis[s + offsets[j + 1]] - midis[s + offsets[j]] !== intervals[j]) return false;
  }
  return true;
}

// Exact: each tagged-position duration equals the template's. Proportional: the ratio to the first
// matched note equals the template's ratio — i.e. dur[pos] * durations[0] ≈ durations[j] * dur[pos0].
function durationsMatch(durs, offsets, durations, s, strict) {
  if (strict) {
    for (let j = 0; j < durations.length; j++) {
      if (Math.abs(durs[s + offsets[j]] - durations[j]) > EPS) return false;
    }
    return true;
  }
  const d0 = durs[s + offsets[0]];
  const t0 = durations[0];
  for (let j = 0; j < durations.length; j++) {
    if (Math.abs(durs[s + offsets[j]] * t0 - durations[j] * d0) > EPS) return false;
  }
  return true;
}
