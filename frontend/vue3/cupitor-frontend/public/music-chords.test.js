// public/music-chords.test.js
import { matchingChords, guessChordsForMeasure, guessChords, guessChordAreas, chordDisplayName, chordOccurrenceNotes,
  stackInfo, rankMatches, bestChords, bestChordsCompleting } from './music-chords.js';

describe('stackInfo (vertical-stack evidence)', () => {
  // notes sharing `left` sound together (a real chord stack); bass = lowest midi of the primary stack.
  test('detects a stack by shared onset and reads its bass; no stacks when all onsets differ', () => {
    const stacked = [{ name: 'G', left: 0, midi: 55 }, { name: 'B', left: 0, midi: 59 }, { name: 'D', left: 0, midi: 62 }];
    const si = stackInfo(stacked);
    expect(si.hasStacks).toBe(true);
    expect(si.bassName).toBe('G');                 // lowest midi
    expect([...si.stackPCs].sort((a, b) => a - b)).toEqual([2, 7, 11]); // D,G,B pitch-classes
    const melodic = [{ name: 'C', left: 0, midi: 60 }, { name: 'E', left: 1, midi: 64 }];
    expect(stackInfo(melodic).hasStacks).toBe(false);
  });
  test('without midi the bass is null (ranking then degrades to coverage)', () => {
    expect(stackInfo([{ name: 'C', left: 0 }, { name: 'E', left: 0 }]).bassPC).toBe(null);
  });
});

describe('rankMatches (stack-aware ordering)', () => {
  const dict = { Gmaj: { notes: ['G', 'B', 'D'] }, Gsus4: { notes: ['G', 'C', 'D'] } };
  test('a chord fully realised in the stack outranks one completed by a melodic note', () => {
    // G,B,D sound together (stack); C is a passing melody note → Gsus4 should NOT win over Gmaj.
    const notes = [{ name: 'G', left: 0, midi: 55 }, { name: 'B', left: 0, midi: 59 },
      { name: 'D', left: 0, midi: 62 }, { name: 'C', left: 1, midi: 60 }];
    expect(rankMatches(matchingChords(notes, dict), notes)[0].name).toBe('Gmaj');
  });
});

describe('bestChords (stack-aware + key-resolved power chord)', () => {
  test('a bare power chord (root+fifth, no third) is named from the key', () => {
    // A + E sounding together, no third anywhere. In key C, A is the vi degree → A minor.
    const notes = [{ name: 'A', left: 0, midi: 57 }, { name: 'E', left: 0, midi: 64 }];
    expect(bestChords(notes, undefined, { key: 'C' })[0].name).toBe('Amin');
    expect(bestChords(notes, undefined, { key: null })).toEqual([]);  // no third, no key → nothing to name
  });
});

describe('bestChordsCompleting (chord finished across a barline)', () => {
  const dict = { Gmaj: { notes: ['G', 'B', 'D'] } };
  test('a same-bass chord is completed by a neighbour tone when the measure alone cannot', () => {
    const own = [{ name: 'G', left: 0, midi: 55 }, { name: 'B', left: 0, midi: 59 }]; // G,B — no D in-measure
    const neighbor = [{ name: 'D', left: 9, midi: 62 }];                              // D arrives next measure
    expect(bestChordsCompleting(own, neighbor, dict, {})[0].name).toBe('Gmaj');
  });
  test('a complete in-measure chord is NOT altered by neighbours', () => {
    const own = [{ name: 'G', left: 0, midi: 55 }, { name: 'B', left: 0, midi: 59 }, { name: 'D', left: 0, midi: 62 }];
    const neighbor = [{ name: 'C', left: 9, midi: 60 }, { name: 'F', left: 10, midi: 65 }];
    expect(bestChordsCompleting(own, neighbor, dict, {})[0].name).toBe('Gmaj');
  });
});

describe('chordDisplayName', () => {
  test('plain major triad drops "maj" (Gmaj → G), accidentals kept', () => {
    expect(chordDisplayName('Gmaj')).toBe('G');
    expect(chordDisplayName('Cmaj')).toBe('C');
    expect(chordDisplayName('F#maj')).toBe('F#');
    expect(chordDisplayName('Ebmaj')).toBe('Eb');
  });
  test('non-plain-major qualities are unchanged', () => {
    expect(chordDisplayName('Gmaj7')).toBe('Gmaj7');   // major 7th: "maj" is meaningful
    expect(chordDisplayName('Bdim')).toBe('Bdim');
    expect(chordDisplayName('Em')).toBe('Em');
    expect(chordDisplayName('G7')).toBe('G7');
    expect(chordDisplayName('Gmaj+9')).toBe('Gmaj+9');
  });
  test('null/empty pass through', () => {
    expect(chordDisplayName('')).toBe('');
    expect(chordDisplayName(null)).toBe(null);
  });
});

describe('chordOccurrenceNotes (complete occurrences across a stream)', () => {
  const DICT = { Cmaj: { notes: ['C', 'E', 'G'] }, G7: { notes: ['G', 'B', 'D', 'F'] } };
  const nn = (name, left) => ({ name, left });

  test('a complete triad → its three notes', () => {
    const out = chordOccurrenceNotes([nn('C', 0), nn('E', 1), nn('G', 2)], 'Cmaj', DICT);
    expect(out.map((x) => x.name)).toEqual(['C', 'E', 'G']);
  });
  test('a missing tone → no occurrence', () => {
    expect(chordOccurrenceNotes([nn('C', 0), nn('E', 1)], 'Cmaj', DICT)).toEqual([]);
  });
  test('intruding non-chord notes within the span are skipped, tones kept', () => {
    const out = chordOccurrenceNotes([nn('C', 0), nn('E', 1), nn('X', 2), nn('G', 3)], 'Cmaj', DICT);
    expect(out.map((x) => x.name)).toEqual(['C', 'E', 'G']);
  });
  test('an isolated chord tone too far from the others is excluded', () => {
    const notes = [nn('C', 0), nn('X', 1), nn('Y', 2), nn('Z', 3), nn('E', 4), nn('G', 5)];
    expect(chordOccurrenceNotes(notes, 'Cmaj', DICT)).toEqual([]);
  });
  test('two separate occurrences both light up', () => {
    const notes = [nn('C', 0), nn('E', 1), nn('G', 2), nn('A', 3), nn('A', 4), nn('A', 5),
                   nn('C', 6), nn('E', 7), nn('G', 8)];
    expect(chordOccurrenceNotes(notes, 'Cmaj', DICT).map((x) => x.name)).toEqual(['C', 'E', 'G', 'C', 'E', 'G']);
  });
  test('unknown chord / empty input → []', () => {
    expect(chordOccurrenceNotes([nn('C', 0)], 'Zzz', DICT)).toEqual([]);
    expect(chordOccurrenceNotes([], 'Cmaj', DICT)).toEqual([]);
  });
});

const DICT = {
  Cmaj: { notes: ['C', 'E', 'G'] },
  Am:   { notes: ['A', 'C', 'E'] },
  G7:   { notes: ['G', 'B', 'D', 'F'] },
};
const n = (name, left) => ({ name, left });

describe('matchingChords', () => {
  test('matches only chords whose every tone is present, with the contributing notes', () => {
    const ms = matchingChords([n('C', 0), n('E', 1), n('G', 2)], DICT);
    expect(ms.map((m) => m.name)).toEqual(['Cmaj']);
    expect(ms[0].notes.map((x) => x.name)).toEqual(['C', 'E', 'G']);
  });
  test('a missing tone means no match (G7 needs B and D and F)', () => {
    expect(matchingChords([n('G', 0), n('B', 1)], DICT)).toEqual([]);
  });
  test('extra notes are fine; only the chord tones are returned as contributing notes', () => {
    const ms = matchingChords([n('A', 0), n('C', 1), n('E', 2), n('D', 3)], DICT);
    expect(ms.map((m) => m.name)).toEqual(['Am']);
    expect(ms[0].notes.map((x) => x.name)).toEqual(['A', 'C', 'E']);
  });
});

describe('guessChordsForMeasure', () => {
  test('finds a chord across an onset window and records its notes', () => {
    // C and E and G stacked at one onset (same left), then a passing D.
    const notes = [n('C', 10), n('E', 10), n('G', 10), n('D', 30)];
    const found = guessChordsForMeasure(notes, DICT);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].chords.map((c) => c.name)).toContain('Cmaj');
  });
  test('empty input → []', () => {
    expect(guessChordsForMeasure([], DICT)).toEqual([]);
    expect(guessChordsForMeasure(null, DICT)).toEqual([]);
  });
});

describe('guessChords (flat, per-measure, de-duplicated)', () => {
  test('returns {measure,name,notes}; dedupes repeats within a measure', () => {
    const byMeasure = {
      1: [n('C', 10), n('E', 10), n('G', 10), n('C', 40), n('E', 40), n('G', 40)],
      2: [n('A', 10), n('C', 10), n('E', 10)],
    };
    const out = guessChords(byMeasure, DICT);
    const m1 = out.filter((c) => c.measure === 1).map((c) => c.name);
    const m2 = out.filter((c) => c.measure === 2).map((c) => c.name);
    expect(m1).toEqual(['Cmaj']);        // both C/E/G groups collapse to one Cmaj chip
    expect(m2).toEqual(['Am']);
    expect(out[0].notes.length).toBeGreaterThanOrEqual(3); // contributing notes preserved for highlighting
  });

  test('a scale-rich measure is capped, not flooded with every diatonic chord', () => {
    // A full diatonic scale spread across onsets matches most of the diatonic chord family;
    // the per-measure cap must keep the chip count sane (real dictionary).
    const byMeasure = { 1: ['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((name, i) => n(name, i * 10)) };
    const out = guessChords(byMeasure);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(3);
  });
});

describe('guessChordAreas (overlapping windows → proximal areas, best N per area)', () => {
  test('overlapping windows in one proximal run merge into a single area', () => {
    const notes = [n('C', 10), n('E', 10), n('G', 10), n('B', 40)];
    const areas = guessChordAreas(notes, DICT, { windowSize: 4, maxPerArea: 3 });
    expect(areas.length).toBe(1);
    expect(areas[0].chords.map((c) => c.name)).toContain('Cmaj');
    expect(areas[0].x).toBe(10);
  });
  test('a melodic gap between chord clusters yields separate areas', () => {
    const notes = [n('C', 10), n('E', 10), n('G', 10), n('D', 20), n('F', 22), n('A', 40), n('C', 40), n('E', 40)];
    const areas = guessChordAreas(notes, DICT, { windowSize: 4 });
    expect(areas.length).toBe(2);
    expect(areas[0].chords[0].name).toBe('Cmaj');
    expect(areas[1].chords[0].name).toBe('Am');
  });
  test('empty / single-note input → []', () => {
    expect(guessChordAreas([], DICT)).toEqual([]);
    expect(guessChordAreas([n('C', 0)], DICT)).toEqual([]);
  });
});

describe('integration with the real chord dictionary', () => {
  test('a C/E/G triad yields a chord whose tones are exactly C,E,G', () => {
    const ms = matchingChords([{ name: 'C' }, { name: 'E' }, { name: 'G' }]);
    expect(ms.some((m) => m.chordTones.slice().sort().join() === 'C,E,G')).toBe(true);
  });
});
