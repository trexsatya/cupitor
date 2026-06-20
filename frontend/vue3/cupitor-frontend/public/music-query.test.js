import { parseQuery, validateQuery } from './music-query.js';
import { decomposeChord, normExtToken } from './music-query.js';
import { matchChordQuery } from './music-query.js';
import { parseMelodyTokens, matchMelodyPitchClasses } from './music-query.js';
import { matchMelodyIntervals } from './music-query.js';
import { runQuery } from './music-query.js';
import { findIntervalMatches } from './music_search.js';
import { intervalsOf } from './music-encoding.js';

describe('validateQuery', () => {
  test('rejects unknown type', () => {
    expect(validateQuery({ type: 'rhythm' }).ok).toBe(false);
  });
  test('chord query needs a non-empty chords array', () => {
    expect(validateQuery({ type: 'chord', chords: [] }).ok).toBe(false);
    expect(validateQuery({ type: 'chord', chords: [{ chord: 'C' }] }).ok).toBe(true);
  });
  test('melody query needs a non-empty notes array', () => {
    expect(validateQuery({ type: 'melody', notes: [] }).ok).toBe(false);
    expect(validateQuery({ type: 'melody', notes: ['C', '.', 'E'] }).ok).toBe(true);
  });
  test('rejects null / non-object input', () => {
    expect(validateQuery(null).ok).toBe(false);
    expect(validateQuery(42).ok).toBe(false);
    expect(validateQuery('chord').ok).toBe(false);
  });
  test('rejects melody queries with unrecognised note tokens', () => {
    expect(validateQuery({ type: 'melody', notes: ['H'] }).ok).toBe(false);
    expect(validateQuery({ type: 'melody', notes: ['C', '.', 'E'] }).ok).toBe(true);
  });
});

describe('parseQuery', () => {
  test('parses a JSON string and fills chord defaults', () => {
    const q = parseQuery('{"type":"chord","chords":[{"chord":"C"}]}');
    expect(q.type).toBe('chord');
    expect(q.strict_extensions).toBe(false);
    expect(q.max_gap).toBe(0);
    expect(q.transpose_invariant).toBe(false);
  });
  test('fills melody defaults', () => {
    const q = parseQuery({ type: 'melody', notes: ['C', 'E', 'G'] });
    expect(q.search_by_interval).toBe(false);
    expect(q.pitch_tolerance).toBe(0);
    expect(q.allow_passing).toBe(true);
    expect(q.allow_repetition).toBe(true);
  });
  test('preserves explicit knob values', () => {
    const q = parseQuery({ type: 'chord', chords: [{ chord: 'G', extensions_allowed: ['7'] }], strict_extensions: true, max_gap: 2 });
    expect(q.strict_extensions).toBe(true);
    expect(q.max_gap).toBe(2);
    expect(q.chords[0].extensions_allowed).toEqual(['7']);
  });
  test('throws on an invalid query', () => {
    expect(() => parseQuery({ type: 'chord', chords: [] })).toThrow();
  });
  test('normalises max_results: keeps a positive integer, drops garbage', () => {
    expect(parseQuery({ type: 'chord', chords: [{ chord: 'C' }], max_results: 5 }).max_results).toBe(5);
    expect(parseQuery({ type: 'chord', chords: [{ chord: 'C' }], max_results: 2.7 }).max_results).toBe(2);
    expect(parseQuery({ type: 'chord', chords: [{ chord: 'C' }], max_results: 'all' }).max_results).toBeUndefined();
    expect(parseQuery({ type: 'chord', chords: [{ chord: 'C' }], max_results: -1 }).max_results).toBeUndefined();
    expect(parseQuery({ type: 'chord', chords: [{ chord: 'C' }] }).max_results).toBeUndefined();
  });
  test('coerces a non-array extensions_allowed to []', () => {
    const q = parseQuery({ type: 'chord', chords: [{ chord: 'G', extensions_allowed: '7' }] });
    expect(q.chords[0].extensions_allowed).toEqual([]);
  });
});

describe('decomposeChord', () => {
  const pc = { C: 0, G: 7, A: 9 };
  test('plain major triad', () => {
    const d = decomposeChord('C');
    expect(d.rootPc).toBe(pc.C);
    expect(d.quality).toBe('maj');
    expect([...d.ext]).toEqual([]);
  });
  test('minor triad spelled with m', () => {
    const d = decomposeChord('Am');
    expect(d.rootPc).toBe(pc.A);
    expect(d.quality).toBe('min');
  });
  test('dominant seventh', () => {
    const d = decomposeChord('G7');
    expect(d.rootPc).toBe(pc.G);
    expect(d.quality).toBe('maj');
    expect(d.ext.has('7')).toBe(true);
  });
  test('major seventh normalises to M7', () => {
    const d = decomposeChord('CM7');
    expect(d.quality).toBe('maj');
    expect(d.ext.has('maj7')).toBe(true);
  });
  test('diminished spelled with o', () => {
    expect(decomposeChord('Co').quality).toBe('dim');
  });
  test('augmented spelled with +', () => {
    expect(decomposeChord('C+').quality).toBe('aug');
  });
  test('sharp root parses', () => {
    expect(decomposeChord('F#m').rootPc).toBe(pitchClassOf('F#'));
  });
  test('unknown symbol falls back to root + quality', () => {
    const d = decomposeChord('Dm13');
    expect(d.rootPc).toBe(pitchClassOf('D'));
    expect(d.quality).toBe('min');
  });
  test('full extension set for a dominant ninth', () => {
    expect([...decomposeChord('C9').ext].sort()).toEqual(['7', '9']);
  });
  test('add9 chord ext aligns with the +9 query alias', () => {
    const ext = decomposeChord('C+9').ext;   // maj add9 normalises to "C+9"
    expect([...ext]).toEqual(['add9']);
    expect(ext.has(normExtToken('+9'))).toBe(true);   // query '+9' -> 'add9' matches piece ext
  });
  test('fallback infers dim/aug from verbose query spelling', () => {
    expect(decomposeChord('Cdim').quality).toBe('dim');
    expect(decomposeChord('Caug').quality).toBe('aug');
    expect(decomposeChord('Gdim7').quality).toBe('dim');
  });
});

function pitchClassOf(name) {
  const map = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  return map[name];
}

describe('normExtToken', () => {
  test('aliases map to canonical tokens', () => {
    expect(normExtToken('+9')).toBe('add9');
    expect(normExtToken('add9')).toBe('add9');
    expect(normExtToken('M7')).toBe('maj7');
    expect(normExtToken('maj7')).toBe('maj7');
    expect(normExtToken('dom7')).toBe('7');
    expect(normExtToken('7')).toBe('7');
  });
});

const Q = (chords, extra = {}) => ({ type: 'chord', chords, strict_extensions: false, max_gap: 0, transpose_invariant: false, ...extra });

describe('matchChordQuery', () => {
  test('contiguous match returns the chord range', () => {
    const m = matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }]), 'Am C G F');
    expect(m).not.toBeNull();
    expect(m.symbols).toEqual(['C', 'G']);
    expect(m.start).toBe(1);
    expect(m.end).toBe(2);
  });
  test('no contiguous match when chords are separated and max_gap=0', () => {
    expect(matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }]), 'C Am G')).toBeNull();
  });
  test('max_gap allows intervening chords', () => {
    const m = matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }], { max_gap: 1 }), 'C Am G');
    expect(m).not.toBeNull();
    expect(m.start).toBe(0);
    expect(m.end).toBe(2);
  });
  test('extension tolerated by default: query C matches piece CM7', () => {
    expect(matchChordQuery(Q([{ chord: 'C' }]), 'CM7 G')).not.toBeNull();
  });
  test('strict_extensions rejects unlisted extension', () => {
    const strict = Q([{ chord: 'C', extensions_allowed: [] }], { strict_extensions: true });
    expect(matchChordQuery(strict, 'CM7 G')).toBeNull();           // CM7 has maj7, not allowed
    expect(matchChordQuery(strict, 'C G')).not.toBeNull();         // plain triad ok
  });
  test('strict_extensions accepts a listed extension', () => {
    const strict = Q([{ chord: 'G', extensions_allowed: ['7'] }], { strict_extensions: true });
    expect(matchChordQuery(strict, 'C G7')).not.toBeNull();
  });
  test('quality must match: query Am does not match piece A', () => {
    expect(matchChordQuery(Q([{ chord: 'Am' }]), 'A C')).toBeNull();
  });
  test('transpose_invariant matches the same shape in another key', () => {
    // C -> G is +7; D -> A is also +7, same qualities (maj, maj)
    const m = matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }], { transpose_invariant: true }), 'D A E');
    expect(m).not.toBeNull();
    expect(m.symbols).toEqual(['D', 'A']);
  });
  test('transpose_invariant rejects a different shape', () => {
    // query interval C->G is +7; piece D->F is +3, no match
    expect(matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }], { transpose_invariant: true }), 'D F')).toBeNull();
  });
  test('empty piece chords -> null', () => {
    expect(matchChordQuery(Q([{ chord: 'C' }]), '')).toBeNull();
  });
  test('backtracks past an early false start', () => {
    // first C (idx 0) cannot reach G adjacently; second C (idx 2) can
    const m = matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }]), 'C Am C G');
    expect(m).not.toBeNull();
    expect(m.start).toBe(2);
    expect(m.end).toBe(3);
  });
  test('max_gap=2 allows two intervening chords', () => {
    const two = 'C Am Dm G';   // two chords between C and G
    expect(matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }], { max_gap: 1 }), two)).toBeNull();
    const m = matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }], { max_gap: 2 }), two);
    expect(m).not.toBeNull();
    expect(m.start).toBe(0);
    expect(m.end).toBe(3);
  });
  test('transpose_invariant re-anchors after a false start', () => {
    // query shape C->G->C (interval +7 then back). Piece "F D A D": F is a false start,
    // re-anchors on D and matches D A D.
    const m = matchChordQuery(Q([{ chord: 'C' }, { chord: 'G' }, { chord: 'C' }], { transpose_invariant: true }), 'F D A D');
    expect(m).not.toBeNull();
    expect(m.symbols).toEqual(['D', 'A', 'D']);
    expect(m.start).toBe(1);
  });
  test('adjacent-duplicate query reflects index collapse', () => {
    expect(matchChordQuery(Q([{ chord: 'C' }, { chord: 'C' }]), 'C G')).toBeNull();          // collapsed away
    const m = matchChordQuery(Q([{ chord: 'C' }, { chord: 'C' }], { max_gap: 1 }), 'C Am C'); // C ... C
    expect(m).not.toBeNull();
    expect(m.start).toBe(0);
    expect(m.end).toBe(2);
  });
});

describe('parseMelodyTokens', () => {
  test('maps note names to pitch classes and "." to null', () => {
    expect(parseMelodyTokens(['C', '.', 'E', 'G'])).toEqual([0, null, 4, 7]);
  });
  test('handles sharps and flats equivalently', () => {
    expect(parseMelodyTokens(['C#', 'Db'])).toEqual([1, 1]);
  });
});

describe('matchMelodyPitchClasses', () => {
  const piece = 'C D E F G';   // pcs 0 2 4 5 7
  test('exact contiguous window', () => {
    const m = matchMelodyPitchClasses(['D', 'E', 'F'], piece);
    expect(m).toEqual({ start: 1, end: 3 });
  });
  test('wildcard skips a position', () => {
    const m = matchMelodyPitchClasses(['C', '.', 'E'], piece);
    expect(m).toEqual({ start: 0, end: 2 });
  });
  test('octave-agnostic across compact spelling', () => {
    // "Cs" in the index == C#/Db query
    const m = matchMelodyPitchClasses(['C#'], 'C Cs D');
    expect(m).toEqual({ start: 1, end: 1 });
  });
  test('no match returns null', () => {
    expect(matchMelodyPitchClasses(['G', 'G'], piece)).toBeNull();
  });
  test('returns the earliest match', () => {
    const m = matchMelodyPitchClasses(['C'], 'C D C');
    expect(m).toEqual({ start: 0, end: 0 });
  });
  test('unknown query token never matches', () => {
    expect(matchMelodyPitchClasses(['H'], 'C D')).toBeNull();
  });
  test('all-wildcard query matches the first window of its length', () => {
    expect(matchMelodyPitchClasses(['.', '.'], 'C D E')).toEqual({ start: 0, end: 1 });
  });
  test('query longer than the piece returns null', () => {
    expect(matchMelodyPitchClasses(['C', 'D', 'E', 'F'], 'C D')).toBeNull();
  });
  test('flat query spelling matches compact sharp spelling (Db -> Cs)', () => {
    expect(matchMelodyPitchClasses(['Db'], 'C Cs D')).toEqual({ start: 1, end: 1 });
  });
});

describe('matchMelodyIntervals', () => {
  // piece: C D E C  (midi 60 62 64 60) -> intervals [2, 2, -4]
  const contour = intervalsOf([60, 62, 64, 60]); // [2,2,-4]
  test('matches an ascending whole-tone pair regardless of key', () => {
    // query G A (intervals [2]) -> should match the C->D and D->E steps
    const m = matchMelodyIntervals(['G', 'A'], contour, { pitch_tolerance: 0 });
    expect(m).toEqual({ start: 0, end: 1 });
  });
  test('matches a 3-note ascending shape', () => {
    const m = matchMelodyIntervals(['C', 'D', 'E'], contour, { pitch_tolerance: 0 });
    expect(m).toEqual({ start: 0, end: 2 });
  });
  test('wildcard frees the second interval', () => {
    // query C . E : first interval = +2 (C->.), but "." frees both touching intervals
    const m = matchMelodyIntervals(['C', '.', 'C'], contour, { pitch_tolerance: 0 });
    expect(m).not.toBeNull();
  });
  test('pitch_tolerance widens the interval', () => {
    // query asking +3 won't match +2 exactly, but tolerance 1 makes it match
    expect(matchMelodyIntervals(['C', 'Eb'], contour, { pitch_tolerance: 0 })).toBeNull();
    expect(matchMelodyIntervals(['C', 'Eb'], contour, { pitch_tolerance: 1 })).not.toBeNull();
  });
  test('no match returns null', () => {
    expect(matchMelodyIntervals(['C', 'F#'], contour, { pitch_tolerance: 0 })).toBeNull(); // +6 absent
  });
  test('agrees with findIntervalMatches on a no-wildcard, zero-tolerance case', () => {
    const melodyPitches = [60, 62, 64, 60];
    const queryPitches = [67, 69, 71]; // G A B -> intervals [2,2]
    const ref = findIntervalMatches(melodyPitches, queryPitches);
    const mine = matchMelodyIntervals(['G', 'A', 'B'], intervalsOf(melodyPitches), { pitch_tolerance: 0 });
    // both find the C-D-E window at note index 0
    expect(ref.length > 0).toBe(true);
    expect(mine).toEqual({ start: 0, end: 2 });
  });
  test('single-note query returns null (interval mode needs >= 2 notes)', () => {
    expect(matchMelodyIntervals(['C'], contour, { pitch_tolerance: 0 })).toBeNull();
  });
  test('unrecognised token in interval mode returns null', () => {
    expect(matchMelodyIntervals(['C', 'Q'], contour, { pitch_tolerance: 0 })).toBeNull();
  });
  test('matches an interval at the very end of the contour', () => {
    // query E C -> interval -4, which is the LAST contour interval [2,2,-4]
    expect(matchMelodyIntervals(['E', 'C'], contour, { pitch_tolerance: 0 })).toEqual({ start: 2, end: 3 });
  });
  test('octave-crossing leap is not matched (pitch-class delta limitation)', () => {
    // query C E = +4 (pc delta); a +16 leap in the contour will not match
    expect(matchMelodyIntervals(['C', 'E'], [16], { pitch_tolerance: 0 })).toBeNull();
  });
  test('negative tolerance matches nothing', () => {
    expect(matchMelodyIntervals(['C', 'D'], contour, { pitch_tolerance: -1 })).toBeNull();
  });
});

const entry = (id, search) => ({ id, system: 'western', search });

describe('runQuery', () => {
  const entries = [
    entry('alpha', { chords: 'C G Am F', pitchClasses: 'C E G', contour: '4,3' }),
    entry('beta',  { chords: 'Dm G7 C', pitchClasses: 'D F A', contour: '3,4' })
  ];

  test('chord query returns matching pieces with chord ranges', () => {
    const res = runQuery({ type: 'chord', chords: [{ chord: 'C' }, { chord: 'G' }] }, entries);
    expect(res.map(r => r.pieceId)).toEqual(['alpha']);
    expect(res[0].match.kind).toBe('chord');
    expect(res[0].match.range).toEqual([0, 1]);
    expect(res[0].match.symbols).toEqual(['C', 'G']);
    expect(res[0].score).toBeCloseTo(1.0);
  });

  test('melody pitch-class query (octave-agnostic)', () => {
    const res = runQuery({ type: 'melody', notes: ['C', 'E', 'G'] }, entries);
    expect(res.map(r => r.pieceId)).toEqual(['alpha']);
    expect(res[0].match.kind).toBe('note');
    expect(res[0].match.range).toEqual([0, 2]);
  });

  test('melody interval query is transposition-invariant', () => {
    // shape +4,+3 (major then minor third) appears in alpha (C E G)
    const res = runQuery({ type: 'melody', notes: ['C', 'E', 'G'], search_by_interval: true }, entries);
    expect(res.map(r => r.pieceId)).toContain('alpha');
  });

  test('max_results caps output', () => {
    const many = [entry('a', { chords: 'C G' }), entry('b', { chords: 'C G' })];
    const res = runQuery({ type: 'chord', chords: [{ chord: 'C' }, { chord: 'G' }], max_results: 1 }, many);
    expect(res.length).toBe(1);
  });

  test('throws on invalid query', () => {
    expect(() => runQuery({ type: 'chord', chords: [] }, entries)).toThrow();
  });

  test('no matches returns empty array', () => {
    expect(runQuery({ type: 'chord', chords: [{ chord: 'F#' }] }, entries)).toEqual([]);
  });
});
