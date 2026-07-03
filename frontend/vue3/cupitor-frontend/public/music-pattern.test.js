// public/music-pattern.test.js
import { extractTemplate, findMatches, degreeIndex, degreeSequence, guessKey, keyLabel, MAJOR_SCALE, MINOR_SCALE, findScopedMatches } from './music-pattern.js';

// MIDI helper: C4=60. E4=64,F#4=66,G4=67, C4=60,D4=62.
describe('degreeIndex (diatonic scale-degree index)', () => {
  const Em = { tonicPc: 4, scale: MINOR_SCALE };   // E natural minor: E F# G A B C D
  test('in-scale notes get integer degrees whose diffs are diatonic steps', () => {
    // E,G,F# in Em → degrees 1,3,2 (steps +2 then -1).
    const e = degreeIndex(64, Em.tonicPc, Em.scale);
    const g = degreeIndex(67, Em.tonicPc, Em.scale);
    const fs = degreeIndex(66, Em.tonicPc, Em.scale);
    expect([g - e, fs - g]).toEqual([2, -1]);
  });
  test('C-E-D under Em yields the same diatonic step pattern as E-G-F#', () => {
    const c = degreeIndex(60, Em.tonicPc, Em.scale);
    const e = degreeIndex(64, Em.tonicPc, Em.scale);
    const d = degreeIndex(62, Em.tonicPc, Em.scale);
    expect([e - c, d - e]).toEqual([2, -1]);
  });
  test('out-of-scale (chromatic) note snaps to the degree just below', () => {
    // D#5 (75) is not in Em; D (74) and E (76) bracket it. countBelow → same degree as D.
    expect(degreeIndex(75, Em.tonicPc, Em.scale)).toBe(degreeIndex(74, Em.tonicPc, Em.scale));
  });
  test('null midi → null', () => {
    expect(degreeIndex(null, Em.tonicPc, Em.scale)).toBeNull();
  });
});

describe('degreeSequence', () => {
  test('maps an array of midis to diatonic degree indices', () => {
    const seq = degreeSequence([64, 67, 66], 4, MINOR_SCALE);
    expect([seq[1] - seq[0], seq[2] - seq[1]]).toEqual([2, -1]);
  });
});

describe('guessKey', () => {
  test('a C-major-ish histogram is detected as C major', () => {
    // Heavy on C/E/G and the diatonic set, none of the chromatic notes.
    const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    [0, 2, 4, 5, 7, 9, 11].forEach((pc, i) => { counts[pc] = [6, 2, 4, 2, 5, 2, 1][i]; });
    expect(guessKey(counts)).toEqual({ tonicPc: 0, mode: 'major' });
  });
  test('an A-minor-ish histogram is detected as A minor', () => {
    const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    // A natural minor = A B C D E F G (pcs 9,11,0,2,4,5,7), tonic A heavy.
    [[9, 6], [0, 4], [4, 5], [2, 2], [7, 2], [11, 2], [5, 1]].forEach(([pc, n]) => { counts[pc] = n; });
    expect(guessKey(counts)).toEqual({ tonicPc: 9, mode: 'minor' });
  });
});

describe('keyLabel', () => {
  test('formats tonic + mode', () => {
    expect(keyLabel(4, 'minor')).toBe('E minor');
    expect(keyLabel(0, 'major')).toBe('C major');
    expect(keyLabel(6, 'major')).toBe('F# major');
  });
});

describe('findMatches — diatonic vs chromatic basis', () => {
  test('E-G-F# matches C-E-D on the diatonic basis but NOT the chromatic basis', () => {
    // stream: E G F#  (tagged 0,1,2)  then C E D (3,4,5)
    const midis = [64, 67, 66, 60, 64, 62];
    const durs = midis.map(() => 1);
    // chromatic: intervals [+3,-1]; C-E-D is [+4,-2] → no match.
    const tChr = extractTemplate([0, 1, 2], midis, durs);
    expect(findMatches(midis, durs, tChr, { mode: 'intervals' })).toEqual([]);
    // diatonic (Em): both are [+2,-1] → C-E-D matches.
    const deg = degreeSequence(midis, 4, MINOR_SCALE);
    const tDia = extractTemplate([0, 1, 2], deg, durs);
    expect(findMatches(deg, durs, tDia, { mode: 'intervals' })).toEqual([[3, 4, 5]]);
  });
});

describe('extractTemplate', () => {
  test('offsets capture the gap structure; intervals + durations from the tagged notes', () => {
    // stream:        idx 0    1    2    3    4    5
    const midis = [60, 99, 99, 64, 99, 67];   // 99 = untagged filler
    const durs  = [1,  0.5, 0.5, 2,  1,  1];
    // tag notes at stream indices 0, 3, 5 → C, E, G with two/one filler between.
    const t = extractTemplate([0, 3, 5], midis, durs);
    expect(t).toEqual({
      start: 0,
      offsets: [0, 3, 5],     // n1 then 2 fillers then n2 then 1 filler then n3
      intervals: [4, 3],      // 64-60, 67-64
      durations: [1, 2, 1],
    });
  });
});

describe('findMatches — intervals', () => {
  test('finds a transposed recurrence that preserves the gap spacing', () => {
    // template from indices 0,3,5: intervals [4,3], offsets [0,3,5].
    const midis = [60, 0, 0, 64, 0, 67,   /* recurrence transposed +2 at 6,9,11 */ 62, 0, 0, 66, 0, 69];
    const durs  = midis.map(() => 1);
    const t = extractTemplate([0, 3, 5], midis, durs);
    const m = findMatches(midis, durs, t, { mode: 'intervals' });
    expect(m).toEqual([[6, 9, 11]]);   // original (start 0) excluded
  });

  test('rejects a hit with the wrong number of intervening notes (gap structure differs)', () => {
    // Same pitches/intervals but the recurrence is CONTIGUOUS (offsets 0,1,2) → not the [0,3,5] shape.
    const midis = [60, 0, 0, 64, 0, 67,   62, 66, 69];
    const durs  = midis.map(() => 1);
    const t = extractTemplate([0, 3, 5], midis, durs);
    expect(findMatches(midis, durs, t, { mode: 'intervals' })).toEqual([]);
  });

  test('excludes the original occurrence (start index)', () => {
    const midis = [60, 0, 0, 64, 0, 67];
    const durs  = midis.map(() => 1);
    const t = extractTemplate([0, 3, 5], midis, durs);
    expect(findMatches(midis, durs, t, { mode: 'intervals' })).toEqual([]);
  });
});

describe('findMatches — duration', () => {
  const midis = [60, 0, 62,   71, 0, 73];   // pitches irrelevant to duration-only
  // template indices 0,2: durations [1, 2], offsets [0, 2]. Recurrence at 3,5.
  test('exact rejects an augmentation (durations doubled)', () => {
    const durs = [1, 9, 2,   2, 9, 4];   // recurrence durations 2,4 = 2× → exact should reject
    const t = extractTemplate([0, 2], midis, durs);
    expect(findMatches(midis, durs, t, { mode: 'duration', durationStrict: true })).toEqual([]);
  });

  test('proportional accepts an augmentation (same ratio)', () => {
    const durs = [1, 9, 2,   2, 9, 4];   // 1:2 == 2:4
    const t = extractTemplate([0, 2], midis, durs);
    expect(findMatches(midis, durs, t, { mode: 'duration', durationStrict: false })).toEqual([[3, 5]]);
  });

  test('exact accepts an identical-duration recurrence', () => {
    const durs = [1, 9, 2,   1, 9, 2];
    const t = extractTemplate([0, 2], midis, durs);
    expect(findMatches(midis, durs, t, { mode: 'duration', durationStrict: true })).toEqual([[3, 5]]);
  });
});

describe('findMatches — both', () => {
  test('requires intervals AND durations to match', () => {
    // template 0,2: interval [+4], durations [1,2]. Candidate A (6,8) matches both; B (9,11)
    // has the right interval but wrong durations → only A is returned.
    const midis = [60, 0, 64,   0, 0, 0,   72, 0, 76,   80, 0, 84];
    const durs  = [1,  9, 2,    9, 9, 9,   1,  9, 2,     1,  9, 1];
    const t = extractTemplate([0, 2], midis, durs);
    expect(findMatches(midis, durs, t, { mode: 'both', durationStrict: true })).toEqual([[6, 8]]);
  });
});

describe('findScopedMatches — melodic (top-note-per-onset) matching', () => {
  // Single-voice stream (as in a piano lead sheet) where chord tones share a melody note's onset.
  // Melody: E4 D4 C4 D4  …then… B3 A3 G3 A3 (same contour, down a 4th). The 4th melody note and the
  // recurrence's 4th note are the TOP of chords of DIFFERENT sizes, and chord tones are listed
  // before the melody note — so the flat gap structure differs but the top-note melody is identical.
  const N = (midi, onset, extra = {}) => ({ midi, durBeats: 1, voice: 0, onset, ...extra });
  const stream = [
    N(64, 0),                       // 0   E4  melody
    N(62, 1),                       // 1   D4
    N(60, 2),                       // 2   C4
    N(55, 3), N(48, 3), N(62, 3),   // 3,4,5   chord @3: tones 55,48 then melody-top D4=62
    N(72, 4),                       // 6   unrelated later melody note
    N(59, 5),                       // 7   B3  melody
    N(57, 6),                       // 8   A3
    N(55, 7),                       // 9   G3
    N(52, 8), N(57, 8),             // 10,11   chord @8: tone 52 then melody-top A3=57 (smaller chord)
  ];
  const tagIdx = [0, 1, 2, 5];      // E D C (top-of-chord) D — the melody notes

  test('raw findMatches on the flat stream MISSES it (chord tones break the gap structure)', () => {
    const midis = stream.map((n) => n.midi);
    const durs = stream.map((n) => n.durBeats);
    const t = extractTemplate(tagIdx, midis, durs);
    expect(findMatches(midis, durs, t, { mode: 'intervals' })).toEqual([]);
  });

  test('melodic matching finds B-A-G-A on the chromatic basis (chords collapse to their top note)', () => {
    const r = findScopedMatches(stream, tagIdx, { mode: 'intervals', intervalBasis: 'chromatic' });
    expect(r.matches).toEqual([[7, 8, 9, 11]]);   // stream indices of B A G A (top note)
    expect(r.originalIdx).toEqual([0, 1, 2, 5]);
  });

  test('melodic matching finds B-A-G-A on the diatonic basis (E minor)', () => {
    const r = findScopedMatches(stream, tagIdx,
      { mode: 'intervals', intervalBasis: 'diatonic', key: { tonicPc: 4, mode: 'minor' } });
    expect(r.matches).toEqual([[7, 8, 9, 11]]);
    expect(r.key).toEqual({ tonicPc: 4, mode: 'minor' });
  });

  test('fewer than 2 tagged notes → no matches', () => {
    expect(findScopedMatches(stream, [2], { mode: 'intervals' })).toEqual({ originalIdx: [2], matches: [], key: null });
  });
});

describe('findMatches — guards', () => {
  test('a pattern shorter than 2 notes yields no matches', () => {
    const midis = [60, 62, 64];
    const durs = [1, 1, 1];
    const t = extractTemplate([1], midis, durs);
    expect(findMatches(midis, durs, t, { mode: 'intervals' })).toEqual([]);
  });
});
