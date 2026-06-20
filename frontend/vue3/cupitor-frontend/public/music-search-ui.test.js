// public/music-search-ui.test.js
import { buildChordQuery, buildMelodyQuery, matchSummary } from './music-search-ui.js';

describe('buildChordQuery', () => {
  test('maps chips (root+quality+extensions) to chord query JSON with opts', () => {
    const q = buildChordQuery(
      [{ root: 'C', quality: 'maj', extensions: ['add9'] }, { root: 'A', quality: 'min', extensions: [] }],
      { strict_extensions: true, max_gap: 2, transpose_invariant: true, max_results: 10 }
    );
    expect(q).toEqual({
      type: 'chord',
      chords: [{ chord: 'C', extensions_allowed: ['add9'] }, { chord: 'Am', extensions_allowed: [] }],
      strict_extensions: true, max_gap: 2, transpose_invariant: true, max_results: 10,
    });
  });

  test('quality suffixes + defaults (no opts → contiguous, lenient, no transpose, no cap)', () => {
    const q = buildChordQuery([{ root: 'G', quality: 'dim', extensions: [] }, { root: 'F', quality: 'aug', extensions: [] }]);
    expect(q.chords.map(c => c.chord)).toEqual(['Gdim', 'Faug']);
    expect(q.strict_extensions).toBe(false);
    expect(q.max_gap).toBe(0);
    expect(q.transpose_invariant).toBe(false);
    expect(q.max_results).toBeUndefined();
  });
});

describe('buildMelodyQuery', () => {
  test('passes tokens through with interval/tolerance/max_results opts', () => {
    const q = buildMelodyQuery(['C', '.', 'E', 'G'], { search_by_interval: true, pitch_tolerance: 1, max_results: 5 });
    expect(q).toEqual({ type: 'melody', notes: ['C', '.', 'E', 'G'], search_by_interval: true, pitch_tolerance: 1, max_results: 5 });
  });
  test('defaults: literal pitch-class match, zero tolerance, no cap', () => {
    const q = buildMelodyQuery(['C', 'E']);
    expect(q).toEqual({ type: 'melody', notes: ['C', 'E'], search_by_interval: false, pitch_tolerance: 0, max_results: undefined });
  });
});

describe('matchSummary', () => {
  test('chord result summarises matched symbols + score', () => {
    const s = matchSummary({ score: 0.8, match: { kind: 'chord', range: [0, 1], symbols: ['C', 'G7'] } });
    expect(s).toContain('C G7');
    expect(s).toContain('0.80');
  });
  test('note result summarises matched count + score', () => {
    const s = matchSummary({ score: 1, match: { kind: 'note', range: [2, 6] } });
    expect(s).toContain('5 notes');
    expect(s).toContain('1.00');
  });
});
