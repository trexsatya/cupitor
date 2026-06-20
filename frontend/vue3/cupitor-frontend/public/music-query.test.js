import { parseQuery, validateQuery } from './music-query.js';
import { decomposeChord, normExtToken } from './music-query.js';

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
