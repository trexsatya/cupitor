// public/music-encoding.test.js
import { nameToMidi, intervalsOf, toSargam, packContour, unpackContour } from './music-encoding.js';

describe('pitch helpers', () => {
  test('nameToMidi: C4 = 60, A4 = 69, C#5 = 73', () => {
    expect(nameToMidi('C', 4)).toBe(60);
    expect(nameToMidi('A', 4)).toBe(69);
    expect(nameToMidi('C#', 5)).toBe(73);
    expect(nameToMidi('Db', 5)).toBe(73); // enharmonic
  });

  test('intervalsOf: deltas between consecutive MIDI numbers', () => {
    expect(intervalsOf([60, 67, 66, 65])).toEqual([7, -1, -1]);
    expect(intervalsOf([60])).toEqual([]);
    expect(intervalsOf([])).toEqual([]);
  });

  test('toSargam: degree in key by pitch-class, null for chromatic', () => {
    // Key of C major: C->Sa, D->Re, E->Ga, F->Ma, G->Pa, A->Dha, B->Ni
    expect(toSargam('C', 'C')).toBe('Sa');
    expect(toSargam('G', 'C')).toBe('Pa');
    expect(toSargam('Gb', 'C')).toBe(null);   // chromatic in C major
    // Minor key uses its own scale; A minor: A->Sa
    expect(toSargam('A', 'Am')).toBe('Sa');
  });
});

describe('contour packing', () => {
  test('round-trips intervals through a compact string', () => {
    const intervals = [7, -1, -1, 0, 12, -12];
    const packed = packContour(intervals);
    expect(typeof packed).toBe('string');
    expect(unpackContour(packed)).toEqual(intervals);
  });

  test('empty intervals -> empty string -> empty array', () => {
    expect(packContour([])).toBe('');
    expect(unpackContour('')).toEqual([]);
  });
});
