import { buildTrail, cycleIndex, commonPositions, stringArrows } from './fretboard-panel.js';

describe('stringArrows', () => {
  // A string (5) fret3 = C3, fret7 = E3. Voicing stacks both on string 5.
  const voicing = [{ string: 5, fret: 3 }, { string: 5, fret: 7 }];
  test('ascending sequence on one string → an "up" arrow (toward higher frets)', () => {
    const seq = [{ name: 'C', octave: '3' }, { name: 'E', octave: '3' }];
    expect(stringArrows(voicing, seq, true)).toEqual([{ string: 5, minFret: 3, maxFret: 7, dir: 'up' }]);
  });
  test('descending sequence → a "down" arrow', () => {
    const seq = [{ name: 'E', octave: '3' }, { name: 'C', octave: '3' }];
    expect(stringArrows(voicing, seq, true)).toEqual([{ string: 5, minFret: 3, maxFret: 7, dir: 'down' }]);
  });
  test('out-and-back (n1,n2,n1) → a bidirectional arrow', () => {
    const seq = [{ name: 'C', octave: '3' }, { name: 'E', octave: '3' }, { name: 'C', octave: '3' }];
    expect(stringArrows(voicing, seq, true)).toEqual([{ string: 5, minFret: 3, maxFret: 7, dir: 'bi' }]);
  });
  test('no movement (single note, or repeated same fret) → no arrow', () => {
    expect(stringArrows(voicing, [{ name: 'C', octave: '3' }], true)).toEqual([]);
    expect(stringArrows(voicing, [{ name: 'C', octave: '3' }, { name: 'C', octave: '3' }], true)).toEqual([]);
  });
  test('notes on different strings produce no arrow', () => {
    const v = [{ string: 5, fret: 3 }, { string: 4, fret: 2 }];   // C3 on s5, E3 on s4
    const seq = [{ name: 'C', octave: '3' }, { name: 'E', octave: '3' }];
    expect(stringArrows(v, seq, true)).toEqual([]);
  });
});

describe('commonPositions', () => {
  test('pitch-class match (matchOctave off): position whose note appears in the previous step', () => {
    // Voicing: low-E open (E2), A/fret3 (C3), D/fret2 (E3). Previous step has C & G (any octave).
    const voicing = [{ string: 6, fret: 0 }, { string: 5, fret: 3 }, { string: 4, fret: 2 }];
    const keys = commonPositions(voicing, [{ name: 'C' }, { name: 'G' }], false);
    expect([...keys]).toEqual(['5:3']);
  });
  test('enharmonic match counts (Db ≡ C#)', () => {
    const voicing = [{ string: 5, fret: 4 }];   // A string fret 4 = C#3
    expect([...commonPositions(voicing, [{ name: 'Db' }], false)]).toEqual(['5:4']);
  });
  test('matchOctave on: requires the same octave, not just pitch class', () => {
    // A/fret3 = C3. Previous step has C4 → NOT common when matching octave; common when not.
    const voicing = [{ string: 5, fret: 3 }];
    expect(commonPositions(voicing, [{ name: 'C', octave: '4' }], true).size).toBe(0);
    expect([...commonPositions(voicing, [{ name: 'C', octave: '3' }], true)]).toEqual(['5:3']);
    expect([...commonPositions(voicing, [{ name: 'C', octave: '4' }], false)]).toEqual(['5:3']);
  });
  test('no previous notes / empty voicing → empty set', () => {
    expect(commonPositions([{ string: 1, fret: 0 }], [], false).size).toBe(0);
    expect(commonPositions(null, [{ name: 'C' }], false).size).toBe(0);
  });
});

describe('cycleIndex', () => {
  test('wraps forward and backward', () => {
    expect(cycleIndex(0, 4, +1)).toBe(1);
    expect(cycleIndex(3, 4, +1)).toBe(0);
    expect(cycleIndex(0, 4, -1)).toBe(3);
  });
  test('count of 0 stays at 0', () => {
    expect(cycleIndex(0, 0, +1)).toBe(0);
  });
});

describe('buildTrail', () => {
  const path = { voicings: [['v0'], ['v1'], ['v2']] };       // one fake voicing per step
  const stepVoicings = [[['v0'], ['v0b']], [['v1'], ['v1b']], [['v2']]];

  test('includes steps 0..stepIdx with ages counting back from current', () => {
    const trail = buildTrail(path, stepVoicings, 2, new Map());
    expect(trail).toEqual([
      { voicing: ['v0'], age: 2 },
      { voicing: ['v1'], age: 1 },
      { voicing: ['v2'], age: 0 },
    ]);
  });

  test('a per-step override swaps that step voicing from stepVoicings', () => {
    const overrides = new Map([[1, 1]]); // step 1 → voicing index 1 (v1b)
    const trail = buildTrail(path, stepVoicings, 2, overrides);
    expect(trail[1]).toEqual({ voicing: ['v1b'], age: 1 });
  });

  test('stepIdx 0 yields a single current-step entry', () => {
    expect(buildTrail(path, stepVoicings, 0, new Map())).toEqual([{ voicing: ['v0'], age: 0 }]);
  });

  test('an out-of-range override index is ignored (keeps the path voicing)', () => {
    const overrides = new Map([[1, 9]]);
    const trail = buildTrail(path, stepVoicings, 2, overrides);
    expect(trail[1]).toEqual({ voicing: ['v1'], age: 1 });
  });
});
