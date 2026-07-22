import { allChords, chordByAnyName } from './music-reference-data.js';

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
