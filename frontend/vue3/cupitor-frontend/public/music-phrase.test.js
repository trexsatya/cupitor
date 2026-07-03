import {
  addPhrase, removePhrase, togglePhraseNote, resolvePhraseNoteIds, phraseColor, PHRASE_PALETTE,
} from './music-phrase.js';

describe('addPhrase', () => {
  test('adds with next palette color; rejects blank and duplicate names', () => {
    let { phrases, added } = addPhrase([], 'Verse');
    expect(added).toBe(true);
    expect(phrases).toEqual([{ name: 'Verse', color: PHRASE_PALETTE[0], notes: [] }]);

    ({ phrases, added } = addPhrase(phrases, '  '));   // blank
    expect(added).toBe(false);
    expect(phrases).toHaveLength(1);

    ({ phrases, added } = addPhrase(phrases, 'Verse'));  // duplicate
    expect(added).toBe(false);
    expect(phrases).toHaveLength(1);

    ({ phrases } = addPhrase(phrases, 'Chorus'));
    expect(phrases[1].color).toBe(PHRASE_PALETTE[1]);   // second color
  });
  test('trims the name and honors an explicit color', () => {
    const { phrases } = addPhrase([], '  Bridge  ', '#123456');
    expect(phrases[0]).toMatchObject({ name: 'Bridge', color: '#123456', notes: [] });
  });
});

describe('phraseColor', () => {
  test('cycles the palette and handles negative indices', () => {
    expect(phraseColor(0)).toBe(PHRASE_PALETTE[0]);
    expect(phraseColor(PHRASE_PALETTE.length)).toBe(PHRASE_PALETTE[0]);
    expect(phraseColor(-1)).toBe(PHRASE_PALETTE[PHRASE_PALETTE.length - 1]);
  });
});

describe('removePhrase', () => {
  test('drops the named phrase, leaves others', () => {
    const two = [{ name: 'A', notes: [] }, { name: 'B', notes: [] }];
    expect(removePhrase(two, 'A')).toEqual([{ name: 'B', notes: [] }]);
  });
});

describe('togglePhraseNote', () => {
  const n = { measure: 2, midi: 64, beats: 4 };
  test('adds then removes the same note by identity', () => {
    let phrases = [{ name: 'P', color: '#000', notes: [] }];
    phrases = togglePhraseNote(phrases, 'P', n);
    expect(phrases[0].notes).toEqual([n]);
    phrases = togglePhraseNote(phrases, 'P', { measure: 2, midi: 64, beats: 4 });   // same identity
    expect(phrases[0].notes).toEqual([]);
  });
  test('leaves other phrases untouched', () => {
    const phrases = [{ name: 'P', notes: [] }, { name: 'Q', notes: [n] }];
    expect(togglePhraseNote(phrases, 'P', n)).toEqual([{ name: 'P', notes: [n] }, { name: 'Q', notes: [n] }]);
  });
});

describe('resolvePhraseNoteIds', () => {
  test('de-dupes and sorts by onset; drops missing midi; null phrase → []', () => {
    const phrase = {
      name: 'P',
      notes: [
        { measure: 3, midi: 67, beats: 8 },
        { measure: 1, midi: 60, beats: 0 },
        { measure: 2, midi: 62, beats: 2 },
        { measure: 3, midi: 67, beats: 8 },   // duplicate
        { measure: 1, midi: null, beats: 1 }, // no midi → dropped
      ],
    };
    expect(resolvePhraseNoteIds(phrase)).toEqual([
      { measure: 1, midi: 60, beats: 0 },
      { measure: 2, midi: 62, beats: 2 },
      { measure: 3, midi: 67, beats: 8 },
    ]);
    expect(resolvePhraseNoteIds(null)).toEqual([]);
  });
});
