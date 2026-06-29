import { buildTrail, cycleIndex } from './fretboard-panel.js';

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
