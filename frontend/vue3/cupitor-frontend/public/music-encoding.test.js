// public/music-encoding.test.js
import { nameToMidi, intervalsOf, toSargam, packContour, unpackContour, encodeNoteText } from './music-encoding.js';

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

describe('encodeNoteText', () => {
  const txt = 'G4# D5# D5 C5#\nB4 C5# B4 A4# G4#';

  test('builds one voice with pitch/interval/sargam; rhythm+lyric+chord null', () => {
    const doc = encodeNoteText(txt, { id: 'jethalal_bgm', title: 'Jethalal BGM', system: 'western', key: 'G#m' });
    expect(doc.meta.format).toBe('note-text');
    expect(doc.meta.id).toBe('jethalal_bgm');
    expect(doc.voices).toHaveLength(1);
    const v = doc.voices[0];
    expect(v.pitch).toEqual([68, 75, 74, 73, 71, 73, 71, 70, 68]);
    expect(v.interval).toEqual([7, -1, -1, -2, 2, -2, -1, -2]);
    expect(v.duration.every(d => d === null)).toBe(true);
    expect(v.lyric.every(l => l === null)).toBe(true);
    expect(v.chordSymbol.every(c => c === null)).toBe(true);
    expect(v.sargam).toHaveLength(v.pitch.length);
    expect(v.measureIndex).toHaveLength(v.pitch.length);
  });
});
