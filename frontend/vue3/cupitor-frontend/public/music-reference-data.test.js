import { allChords, chordByAnyName } from './music-reference-data.js';

const pc = name => {
  const m = /^([A-G])([#b]*)$/.exec(name);
  return (({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + [...m[2]].reduce((n, c) => n + (c === '#' ? 1 : -1), 0)) % 12 + 12) % 12;
};

test.each(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'Db', 'Eb', 'Gb', 'Ab', 'Bb'])('%s chord intervals remain correct across enharmonic spellings', root => {
  for (const [quality, intervals] of Object.entries({ maj: [0, 4, 7], min: [0, 3, 7], dim7: [0, 3, 6, 9], '7b9': [0, 4, 7, 10, 1] })) {
    expect(allChords[root + quality].notes.map(pc)).toEqual(intervals.map(i => (pc(root) + i) % 12));
  }
});

describe('chordByAnyName (resolve a search-normalised OR raw chord name to its allChords entry)', () => {
  test('resolves normalised major/minor/dim names (as search.chords stores them)', () => {
    expect(chordByAnyName('C')).toEqual({ key: 'Cmaj', root: 'C', notes: ['C', 'E', 'G'] });
    expect(chordByAnyName('Am')).toEqual({ key: 'Amin', root: 'A', notes: ['A', 'C', 'E'] });
    expect(chordByAnyName('Bo')).toEqual({ key: 'Bdim', root: 'B', notes: ['B', 'D', 'F'] });
  });

  test('resolves a raw allChords key unchanged', () => {
    expect(chordByAnyName('C7')).toEqual({ key: 'C7', ...allChords['C7'] });
    expect(chordByAnyName('Cmaj').key).toBe('Cmaj');
  });

  test('unknown or empty names return null', () => {
    expect(chordByAnyName('NotAChord')).toBeNull();
    expect(chordByAnyName('')).toBeNull();
    expect(chordByAnyName(null)).toBeNull();
  });
});
