// public/music-chords.test.js
import { matchingChords, guessChordsForMeasure, guessChords } from './music-chords.js';

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

describe('integration with the real chord dictionary', () => {
  test('a C/E/G triad yields a chord whose tones are exactly C,E,G', () => {
    const ms = matchingChords([{ name: 'C' }, { name: 'E' }, { name: 'G' }]);
    expect(ms.some((m) => m.chordTones.slice().sort().join() === 'C,E,G')).toBe(true);
  });
});
