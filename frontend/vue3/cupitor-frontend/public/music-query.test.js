import { parseQuery, validateQuery } from './music-query.js';

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
});
