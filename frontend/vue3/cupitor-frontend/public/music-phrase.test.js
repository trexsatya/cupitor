import {
  addPhrase, removePhrase, setPhraseTag, removeTagFromPhrases,
  togglePhraseNote, resolvePhraseNoteIds, phraseColor, PHRASE_PALETTE,
} from './music-phrase.js';

describe('addPhrase', () => {
  test('adds with next palette color; rejects blank and duplicate names', () => {
    let { phrases, added } = addPhrase([], 'Verse');
    expect(added).toBe(true);
    expect(phrases).toEqual([{ name: 'Verse', color: PHRASE_PALETTE[0], tags: [], notes: [] }]);

    ({ phrases, added } = addPhrase(phrases, '  '));   // blank
    expect(added).toBe(false);
    expect(phrases).toHaveLength(1);

    ({ phrases, added } = addPhrase(phrases, 'Verse'));  // duplicate
    expect(added).toBe(false);
    expect(phrases).toHaveLength(1);

    ({ phrases } = addPhrase(phrases, 'Chorus'));
    expect(phrases[1].color).toBe(PHRASE_PALETTE[1]);   // second color
  });
});

describe('phraseColor', () => {
  test('cycles the palette and handles negative indices', () => {
    expect(phraseColor(0)).toBe(PHRASE_PALETTE[0]);
    expect(phraseColor(PHRASE_PALETTE.length)).toBe(PHRASE_PALETTE[0]);
    expect(phraseColor(-1)).toBe(PHRASE_PALETTE[PHRASE_PALETTE.length - 1]);
  });
});

describe('setPhraseTag / removeTagFromPhrases', () => {
  const base = [{ name: 'P', color: '#000', tags: ['T1'], notes: [] }];
  test('adds a member tag without duplicating; removes on off', () => {
    expect(setPhraseTag(base, 'P', 'T1', true)).toEqual(base);          // already present → unchanged
    expect(setPhraseTag(base, 'P', 'T2', true)[0].tags).toEqual(['T1', 'T2']);
    expect(setPhraseTag(base, 'P', 'T1', false)[0].tags).toEqual([]);
    expect(setPhraseTag(base, 'other', 'T2', true)).toEqual(base);      // wrong phrase → unchanged
  });
  test('removeTagFromPhrases drops the tag from every phrase', () => {
    const two = [{ name: 'A', tags: ['T1', 'T2'] }, { name: 'B', tags: ['T3'] }];
    expect(removeTagFromPhrases(two, 'T1')).toEqual([{ name: 'A', tags: ['T2'] }, { name: 'B', tags: ['T3'] }]);
  });
});

describe('togglePhraseNote', () => {
  const n = { measure: 2, midi: 64, beats: 4 };
  test('adds then removes the same extra note by identity', () => {
    let phrases = [{ name: 'P', color: '#000', tags: [], notes: [] }];
    phrases = togglePhraseNote(phrases, 'P', n);
    expect(phrases[0].notes).toEqual([n]);
    phrases = togglePhraseNote(phrases, 'P', { measure: 2, midi: 64, beats: 4 });   // same identity
    expect(phrases[0].notes).toEqual([]);
  });
});

describe('resolvePhraseNoteIds', () => {
  const assignments = [
    { name: 'T1', notes: [{ measure: 1, midi: 60, beats: 0 }, { measure: 2, midi: 64, beats: 4 }] },
    { name: 'T2', notes: [{ measure: 3, midi: 67, beats: 8 }] },
  ];
  test('unions member tags + extra notes, de-dupes, sorts by onset', () => {
    const phrase = {
      name: 'P', tags: ['T2', 'T1'],
      notes: [{ measure: 2, midi: 62, beats: 2 }, { measure: 2, midi: 64, beats: 4 }],  // last dupes a T1 note
    };
    expect(resolvePhraseNoteIds(phrase, assignments)).toEqual([
      { measure: 1, midi: 60, beats: 0 },
      { measure: 2, midi: 62, beats: 2 },
      { measure: 2, midi: 64, beats: 4 },
      { measure: 3, midi: 67, beats: 8 },
    ]);
  });
  test('unknown member tags and missing midi contribute nothing; null phrase → []', () => {
    const phrase = { name: 'P', tags: ['nope'], notes: [{ measure: 1, midi: null, beats: 0 }] };
    expect(resolvePhraseNoteIds(phrase, assignments)).toEqual([]);
    expect(resolvePhraseNoteIds(null, assignments)).toEqual([]);
  });
});
