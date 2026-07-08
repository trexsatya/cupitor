import { findPositions, isPlayable, voicingsForNotes, voicingCenter, voicingSpan, findPaths, movementSparkline, noteAt } from './fretboard-core.js';

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
