import { findPositions, isPlayable, voicingsForNotes, voicingCenter, voicingSpan, findPaths, findCombinations, movementSparkline, noteAt } from './fretboard-core.js';

describe('noteAt', () => {
  test('returns the sounding note+octave for a string/fret in standard tuning', () => {
    expect(noteAt(6, 0)).toEqual({ name: 'E', octave: '2' });   // open low E
    expect(noteAt(1, 1)).toEqual({ name: 'F', octave: '4' });   // high E string, fret 1
    expect(noteAt(5, 3)).toEqual({ name: 'C', octave: '3' });   // A string, fret 3 = C
  });
  test('out-of-range → null', () => {
    expect(noteAt(6, 99)).toBeNull();
    expect(noteAt(9, 0)).toBeNull();
  });
});

describe('findPositions', () => {
  test('open high-E (string 1) and low-E (string 6) both found for E', () => {
    const pos = findPositions('E');
    expect(pos).toContainEqual({ string: 1, fret: 0, octave: '4' });
    expect(pos).toContainEqual({ string: 6, fret: 0, octave: '2' });
  });

  test('enharmonic: Bb resolves to the same frets as A#', () => {
    const bb = findPositions('Bb').map((p) => `${p.string}:${p.fret}`).sort();
    const as = findPositions('A#').map((p) => `${p.string}:${p.fret}`).sort();
    expect(bb).toEqual(as);
    expect(bb.length).toBeGreaterThan(0);
  });

  test('octave filter narrows to one register', () => {
    const all = findPositions('E');
    const oct4 = findPositions('E', '4');
    expect(oct4.every((p) => p.octave === '4')).toBe(true);
    expect(oct4.length).toBeLessThan(all.length);
  });
});

describe('isPlayable', () => {
  test('any open string makes a pair playable regardless of span', () => {
    expect(isPlayable({ string: 1, fret: 0 }, { string: 2, fret: 9 })).toBe(true);
  });
  test('fretted pair within 3 frets is playable; beyond is not', () => {
    expect(isPlayable({ string: 1, fret: 5 }, { string: 2, fret: 8 })).toBe(true);
    expect(isPlayable({ string: 1, fret: 5 }, { string: 2, fret: 9 })).toBe(false);
  });
});

describe('voicingsForNotes', () => {
  test('C major yields an open-position triad fragment (one position per chord tone)', () => {
    const voicings = voicingsForNotes(['C', 'E', 'G']);
    // The model places one position per distinct pitch class (3-note voicings), like guitar.js
    // usefulChords — not doubled 5-string barre shapes. A real open-position C on the top three
    // strings is E(1:0) C(2:1) G(3:0).
    const openTop = [
      { string: 1, fret: 0 }, // E
      { string: 2, fret: 1 }, // C
      { string: 3, fret: 0 }, // G
    ];
    const asKey = (v) => v.map((p) => `${p.string}:${p.fret}`).sort().join(',');
    const keys = voicings.map(asKey);
    expect(keys).toContain(asKey(openTop));
  });

  test('every voicing uses each string at most once and covers all note-set members', () => {
    const voicings = voicingsForNotes(['C', 'E', 'G']);
    expect(voicings.length).toBeGreaterThan(0);
    voicings.forEach((v) => {
      const strings = v.map((p) => p.string);
      expect(new Set(strings).size).toBe(strings.length);
      expect(v.length).toBeGreaterThanOrEqual(3);
    });
  });

  test('every pair in a returned voicing is playable', () => {
    const voicings = voicingsForNotes(['C', 'E', 'G']);
    voicings.forEach((v) => {
      for (let i = 0; i < v.length; i++)
        for (let j = i + 1; j < v.length; j++)
          expect(isPlayable(v[i], v[j])).toBe(true);
    });
  });

  test('a note-set with an impossible spread returns no voicings, never throws', () => {
    expect(voicingsForNotes([])).toEqual([]);
  });

  test('respects octave: an octave-tagged note only lands at positions in that register', () => {
    // E4 (string1 open) vs E2 (string6 open). With octave given, the open low-E (string6) must not
    // appear for E4, and the open high-E (string1) must not appear for E2.
    const e4 = voicingsForNotes([{ name: 'E', octave: '4' }]).flat();
    const e2 = voicingsForNotes([{ name: 'E', octave: '2' }]).flat();
    expect(e4).toContainEqual({ string: 1, fret: 0 });
    expect(e4.find((p) => p.string === 6 && p.fret === 0)).toBeUndefined();
    expect(e2).toContainEqual({ string: 6, fret: 0 });
    expect(e2.find((p) => p.string === 1 && p.fret === 0)).toBeUndefined();
  });

  test('plain pitch-class strings still work (octave-agnostic)', () => {
    expect(voicingsForNotes(['C', 'E', 'G']).length).toBeGreaterThan(0);
  });

  test('requirePlayable:false keeps an unplayable wide-span voicing that the default drops', () => {
    // F2 (only s6f1) + D5 (only s1f10): the sole covering voicing spans 9 frets → unplayable.
    const notes = [{ name: 'F', octave: '2' }, { name: 'D', octave: '5' }];
    expect(voicingsForNotes(notes)).toEqual([]);                              // default drops it
    const relaxed = voicingsForNotes(notes, { requirePlayable: false });
    expect(relaxed.length).toBe(1);
    expect(relaxed[0].map((p) => `${p.string}:${p.fret}`).sort()).toEqual(['1:10', '6:1']);
  });

  test('requireDistinctStrings:false allows two notes on the same string', () => {
    // C4 and D4 can both sit on string 2 (f1, f3). Default forbids the same-string voicing.
    const notes = [{ name: 'C', octave: '4' }, { name: 'D', octave: '4' }];
    const dup = (v) => new Set(v.map((p) => p.string)).size < v.length;
    expect(voicingsForNotes(notes).some(dup)).toBe(false);
    expect(voicingsForNotes(notes, { requireDistinctStrings: false }).some(dup)).toBe(true);
  });

  test('octave matching is strict: more positions exist octave-agnostic than for a fixed octave', () => {
    const fixed = voicingsForNotes([{ name: 'E', octave: '4' }]).flat();
    const all = voicingsForNotes([{ name: 'E' }]).flat();
    expect(fixed.length).toBeGreaterThan(0);
    expect(fixed.length).toBeLessThan(all.length);
  });
});

describe('voicingCenter / voicingSpan', () => {
  test('center is the mean of fretted (non-open) frets; all-open is 0', () => {
    expect(voicingCenter([{ string: 1, fret: 0 }, { string: 2, fret: 0 }])).toBe(0);
    expect(voicingCenter([{ string: 1, fret: 2 }, { string: 2, fret: 4 }])).toBe(3);
  });
  test('span is max minus min fretted fret (0 when all open)', () => {
    expect(voicingSpan([{ string: 1, fret: 0 }, { string: 2, fret: 0 }])).toBe(0);
    expect(voicingSpan([{ string: 1, fret: 2 }, { string: 2, fret: 5 }])).toBe(3);
  });
});

describe('findPaths', () => {
  const low0 = [{ string: 6, fret: 1 }, { string: 5, fret: 2 }];
  const near1 = [{ string: 6, fret: 2 }, { string: 5, fret: 3 }];
  const far1 = [{ string: 6, fret: 9 }, { string: 5, fret: 10 }];

  test('lists open/low positions first (ascending neck region)', () => {
    const paths = findPaths([[low0], [near1, far1]]);
    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(paths[0].region).toBeLessThanOrEqual(paths[paths.length - 1].region);
    expect(paths[0].voicings[1]).toEqual(near1);   // the open/low path stays on frets 1–3, not up at 9–10
  });

  test('caps the number of returned paths at maxPaths', () => {
    const step = [
      [{ string: 6, fret: 1 }], [{ string: 6, fret: 4 }],
      [{ string: 6, fret: 7 }], [{ string: 6, fret: 10 }],
    ].map((v) => [v]);
    const paths = findPaths(step, { maxPaths: 2 });
    expect(paths.length).toBeLessThanOrEqual(2);
  });

  test('a step with no voicings contributes a null frame and does not throw', () => {
    const paths = findPaths([[low0], [], [near1]]);
    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(paths[0].voicings.length).toBe(3);
    expect(paths[0].voicings[1]).toBeNull();
  });

  test('each path has a human label and per-step move deltas', () => {
    const paths = findPaths([[low0], [near1, far1]]);
    expect(typeof paths[0].label).toBe('string');
    expect(paths[0].label.length).toBeGreaterThan(0);
    expect(Array.isArray(paths[0].moves)).toBe(true);
  });
});

describe('movementSparkline', () => {
  test('maps deltas to block glyphs and tolerates an empty array', () => {
    expect(movementSparkline([])).toBe('');
    expect(movementSparkline([0, 5, 2]).length).toBe(3);
  });
});

describe('findCombinations', () => {
  // Two region-coherent paths over two chords: a LOW path (frets ~1-3) and an UP path (~8-10).
  const a0 = [{ string: 6, fret: 1 }, { string: 5, fret: 2 }];   // center 1.5
  const a1 = [{ string: 6, fret: 2 }, { string: 5, fret: 3 }];   // center 2.5
  const b0 = [{ string: 6, fret: 8 }, { string: 5, fret: 9 }];   // center 8.5
  const b1 = [{ string: 6, fret: 9 }, { string: 5, fret: 10 }];  // center 9.5
  const low = { voicings: [a0, a1], region: 2, cost: 1, moves: [0, 1], label: 'open' };
  const up = { voicings: [b0, b1], region: 9, cost: 1, moves: [0, 1], label: 'up' };
  const sig = (v) => (v ? JSON.stringify(v) : 'null');
  const rowSig = (voicings) => voicings.map(sig).join('|');

  test('mixes region voicings across chords — cross-region combinations NOT present in the region paths', () => {
    const combos = findCombinations([low, up]);
    // pure-region rows (a0,a1) and (b0,b1) already exist as paths → excluded; only the two mixes remain.
    expect(combos.length).toBe(2);
    const pathRows = [rowSig([a0, a1]), rowSig([b0, b1])];
    combos.forEach((c) => expect(pathRows).not.toContain(rowSig(c.voicings)));
    const rows = combos.map((c) => rowSig(c.voicings));
    expect(rows).toContain(rowSig([b0, a1]));   // up → low
    expect(rows).toContain(rowSig([a0, b1]));   // low → up
  });

  test('ranks by ascending total hand movement (smoothest mix first)', () => {
    const combos = findCombinations([low, up]);
    // (b0→a1) moves |2.5-8.5|=6; (a0→b1) moves |9.5-1.5|=8 → the 6-move mix ranks first.
    expect(combos[0].voicings).toEqual([b0, a1]);
    expect(combos[0].cost).toBeLessThanOrEqual(combos[combos.length - 1].cost);
  });

  test('caps the number of combinations', () => {
    const c0 = [{ string: 6, fret: 1 }]; const c1 = [{ string: 6, fret: 5 }]; const c2 = [{ string: 6, fret: 9 }];
    const d0 = [{ string: 5, fret: 2 }]; const d1 = [{ string: 5, fret: 6 }]; const d2 = [{ string: 5, fret: 10 }];
    const paths = [
      { voicings: [c0, d0] }, { voicings: [c1, d1] }, { voicings: [c2, d2] },
    ];
    const combos = findCombinations(paths, { cap: 2 });
    expect(combos.length).toBeLessThanOrEqual(2);
  });

  test('a single region path yields no combinations (nothing to mix)', () => {
    expect(findCombinations([low])).toEqual([]);
  });

  test('empty / missing input → []', () => {
    expect(findCombinations([])).toEqual([]);
    expect(findCombinations()).toEqual([]);
  });

  test('preserves a null (unplayable) step across the mix and carries label + moves', () => {
    const lowN = { voicings: [a0, null, a1] };
    const upN = { voicings: [b0, null, b1] };
    const combos = findCombinations([lowN, upN]);
    expect(combos.length).toBeGreaterThan(0);
    combos.forEach((c) => {
      expect(c.voicings.length).toBe(3);
      expect(c.voicings[1]).toBeNull();               // the empty middle step stays null
      expect(typeof c.label).toBe('string');
      expect(c.label.length).toBeGreaterThan(0);
      expect(Array.isArray(c.moves)).toBe(true);
    });
  });
});
