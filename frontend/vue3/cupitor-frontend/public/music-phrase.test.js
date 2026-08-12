import {
  addPhrase, removePhrase, setPhraseTag, removeTagFromPhrases,
  togglePhraseNote, phraseNotes, addedNotes, droppedNotes, phraseColor, PHRASE_PALETTE,
  phraseRange, setPhraseRange, renameTagInPhrases, renamePhrase, phraseByName,
} from './music-phrase.js';

describe('addPhrase', () => {
  test('adds with next palette color; rejects blank and duplicate names', () => {
    let { phrases, added } = addPhrase([], 'Verse');
    expect(added).toBe(true);
    expect(phrases).toEqual([{ name: 'Verse', color: PHRASE_PALETTE[0], from: null, to: null, tags: [], add: [], drop: [] }]);

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

// A click says "this note is wrong"; where the note sits says which way. This is the whole editing
// gesture, so it is pinned here rather than left to the browser.
describe('togglePhraseNote', () => {
  const bars = () => [{ name: 'P', color: '#000', from: 4, to: 8, tags: [], add: [], drop: [] }];

  test('a note INSIDE the bars is taken out, and clicking it again puts it back', () => {
    const n = { measure: 5, midi: 64, beats: 4 };
    let phrases = togglePhraseNote(bars(), 'P', n);
    expect(phrases[0].drop).toEqual([n]);
    expect(phrases[0].add).toEqual([]);
    phrases = togglePhraseNote(phrases, 'P', { measure: 5, midi: 64, beats: 4 });   // same identity
    expect(phrases[0].drop).toEqual([]);
  });

  test('a note OUTSIDE the bars is brought in, and clicking it again removes it', () => {
    const pickup = { measure: 3, midi: 60, beats: 0 };   // the bar before
    let phrases = togglePhraseNote(bars(), 'P', pickup);
    expect(phrases[0].add).toEqual([pickup]);
    expect(phrases[0].drop).toEqual([]);
    phrases = togglePhraseNote(phrases, 'P', { measure: 3, midi: 60, beats: 0 });
    expect(phrases[0].add).toEqual([]);
  });

  test('a note is never both added and dropped', () => {
    // Moving the bars can leave an added note sitting inside them; the next click has to resolve that
    // into one list, not leave the phrase saying two contradictory things about the same note.
    const n = { measure: 5, midi: 64, beats: 4 };
    const stale = [{ name: 'P', from: 4, to: 8, add: [n], drop: [{ ...n }] }];
    const next = togglePhraseNote(stale, 'P', n)[0];
    expect(next.add).toEqual([]);
    expect(next.drop).toEqual([]);
  });

  test('a phrase saved with its notes under `notes` is read and rewritten as `add`', () => {
    const old = [{ name: 'P', notes: [{ measure: 5, midi: 60, beats: 0 }] }];
    const next = togglePhraseNote(old, 'P', { measure: 9, midi: 67, beats: 12 })[0];
    expect(next.notes).toBeUndefined();
    expect(next.add.map((n) => n.midi)).toEqual([60, 67]);
  });

  test('the wrong phrase is left alone', () => {
    const list = bars();
    expect(togglePhraseNote(list, 'other', { measure: 5, midi: 64, beats: 4 })[0]).toBe(list[0]);
  });
});

describe('phraseNotes', () => {
  const inBars = [
    { measure: 4, midi: 60, beats: 0 },
    { measure: 4, midi: 64, beats: 1 },
    { measure: 5, midi: 67, beats: 4 },
  ];

  test('the bars, less what is dropped, plus what is added — in onset order', () => {
    const phrase = {
      name: 'P', from: 4, to: 5,
      drop: [{ measure: 4, midi: 64, beats: 1 }],
      add: [{ measure: 3, midi: 55, beats: -2 }, { measure: 6, midi: 72, beats: 8 }],
    };
    expect(phraseNotes(phrase, inBars)).toEqual([
      { measure: 3, midi: 55, beats: -2 },   // a pickup from the bar before
      { measure: 4, midi: 60, beats: 0 },
      { measure: 5, midi: 67, beats: 4 },
      { measure: 6, midi: 72, beats: 8 },    // a resolution in the bar after
    ]);
  });

  test('with no exceptions it is simply the bars', () => {
    expect(phraseNotes({ name: 'P', from: 4, to: 5 }, inBars)).toEqual(inBars);
  });

  test('an added note already in the bars is not counted twice, and a dropped one stays out', () => {
    const phrase = { from: 4, to: 5, add: [{ measure: 4, midi: 60, beats: 0 }], drop: [{ measure: 4, midi: 60, beats: 0 }] };
    expect(phraseNotes(phrase, inBars).map((n) => n.midi)).toEqual([64, 67]);   // drop wins over add
    expect(phraseNotes({ from: 4, to: 5, add: [{ measure: 4, midi: 60, beats: 0 }] }, inBars)).toHaveLength(3);
  });

  test('notes without a pitch are not notes; a null phrase has nothing', () => {
    expect(phraseNotes({ add: [{ measure: 1, midi: null, beats: 0 }] }, [])).toEqual([]);
    expect(phraseNotes(null, inBars)).toEqual([]);
  });
});

describe('addedNotes / droppedNotes', () => {
  test('`notes` is read as `add`, and a missing list is empty rather than absent', () => {
    expect(addedNotes({ notes: [{ midi: 60 }] })).toEqual([{ midi: 60 }]);
    expect(addedNotes({ add: [{ midi: 62 }], notes: [{ midi: 60 }] })).toEqual([{ midi: 62 }]);   // add wins
    expect(addedNotes({})).toEqual([]);
    expect(droppedNotes({})).toEqual([]);
    expect(droppedNotes(null)).toEqual([]);
  });
});

// The bars are the phrase's shape. The old shape (member tags + painted notes) still has to resolve to
// one, or every phrase anyone saved would go dead.
describe('phrase ranges', () => {
  test('a phrase is added over the bars it was given', () => {
    const { phrases } = addPhrase([], 'Verse', null, 9, 16);
    expect(phrases[0]).toMatchObject({ name: 'Verse', from: 9, to: 16 });
    expect(phraseRange(phrases[0])).toEqual([9, 16]);
  });

  test('bars given backwards are put in order', () => {
    const { phrases } = addPhrase([], 'Verse', null, 16, 9);
    expect(phraseRange(phrases[0])).toEqual([9, 16]);
  });

  test('no bars means no range — NOT bar zero', () => {
    // Number(null) and Number('') are both 0, so the careless version made this "m0–m0".
    expect(addPhrase([], 'a').phrases[0]).toMatchObject({ from: null, to: null });
    expect(addPhrase([], 'b', null, '', '').phrases[0]).toMatchObject({ from: null, to: null });
    expect(phraseRange({ name: 'a', from: null, to: null })).toBeNull();
  });

  test('a phrase saved under the old model reports the span of its notes', () => {
    const legacy = { name: 'old', color: '#000', tags: ['m'], notes: [{ measure: 5, midi: 60, beats: 0 }, { measure: 8, midi: 62, beats: 1 }] };
    expect(phraseRange(legacy)).toEqual([5, 8]);
  });

  test('an explicit range wins over the notes it was built from', () => {
    const both = { name: 'x', from: 20, to: 24, notes: [{ measure: 5 }, { measure: 8 }] };
    expect(phraseRange(both)).toEqual([20, 24]);
  });

  test('setPhraseRange moves one phrase and leaves the others alone', () => {
    const list = [{ name: 'a', from: 1, to: 4 }, { name: 'b', from: 5, to: 8 }];
    const next = setPhraseRange(list, 'b', 9, 16);
    expect(next.map((p) => [p.from, p.to])).toEqual([[1, 4], [9, 16]]);
  });

  test('clearing a range empties it rather than guessing', () => {
    const next = setPhraseRange([{ name: 'a', from: 1, to: 4 }], 'a', '', '');
    expect(next[0]).toMatchObject({ from: null, to: null });
  });

  test('phraseRange of nothing is null', () => {
    expect(phraseRange(null)).toBeNull();
    expect(phraseRange({ name: 'a' })).toBeNull();
  });
});

describe('renamePhrase', () => {
  const list = () => [
    { name: 'A', color: '#0d6efd', from: 4, to: 8, drop: [{ measure: 5, midi: 60, beats: 4 }], add: [] },
    { name: 'B', color: '#d63384', from: 9, to: 16 },
  ];

  test('the phrase keeps everything but its name', () => {
    const next = renamePhrase(list(), 'A', 'Chorus');
    expect(next[0]).toEqual({ name: 'Chorus', color: '#0d6efd', from: 4, to: 8,
      drop: [{ measure: 5, midi: 60, beats: 4 }], add: [] });
    expect(next[1]).toEqual({ name: 'B', color: '#d63384', from: 9, to: 16 });
  });

  test('refused — and detectably so — for a name already in use', () => {
    // The same array back is the refusal: two phrases under one name would be indistinguishable
    // wherever the name is the handle, and one of them would silently win.
    const before = list();
    expect(renamePhrase(before, 'A', 'B')).toBe(before);
    expect(renamePhrase(before, 'A', '  B  ')).toBe(before);   // trimmed before the check
  });

  test('nothing to do is nothing done', () => {
    const before = list();
    expect(renamePhrase(before, 'A', '   ')).toBe(before);     // blank
    expect(renamePhrase(before, 'A', 'A')).toBe(before);       // unchanged
    expect(renamePhrase(before, 'nope', 'C')).toBe(before);    // no such phrase
    expect(renamePhrase(null, 'A', 'C')).toEqual([]);
  });
});

// A name is matched exactly, never case-folded. It has to be: the detected families are A, B, C…, so
// folding case would make a hand-named "b" collide with family B, and a piece can reasonably hold both
// "intro" and "Intro". Pinned here because a "helpful" case-insensitive compare is an easy thing to add.
describe('phrase names are case-sensitive', () => {
  test('"a" and "A" are two different phrases', () => {
    let { phrases, added } = addPhrase([], 'A', null, 1, 4);
    ({ phrases, added } = addPhrase(phrases, 'a', null, 5, 8));
    expect(added).toBe(true);
    expect(phrases.map((p) => p.name)).toEqual(['A', 'a']);
    expect(phraseByName(phrases, 'a')).toMatchObject({ from: 5, to: 8 });
    expect(phraseByName(phrases, 'A')).toMatchObject({ from: 1, to: 4 });
  });

  test('renaming to a differently-cased name is allowed, and hits only its own phrase', () => {
    const list = [{ name: 'A', from: 1, to: 4 }, { name: 'B', from: 5, to: 8 }];
    expect(renamePhrase(list, 'B', 'a').map((p) => p.name)).toEqual(['A', 'a']);
    expect(renamePhrase(list, 'a', 'C')).toBe(list);   // no phrase called "a" — "A" is not it
  });

  test('setPhraseRange, removePhrase and togglePhraseNote all match exactly', () => {
    const list = [{ name: 'A', from: 1, to: 4, add: [], drop: [] }, { name: 'a', from: 5, to: 8, add: [], drop: [] }];
    expect(setPhraseRange(list, 'a', 9, 12).map((p) => [p.name, p.from, p.to])).toEqual([['A', 1, 4], ['a', 9, 12]]);
    expect(removePhrase(list, 'a').map((p) => p.name)).toEqual(['A']);
    const n = { measure: 6, midi: 60, beats: 0 };
    const next = togglePhraseNote(list, 'a', n);
    expect(next[0].drop).toEqual([]);        // "A" untouched
    expect(next[1].drop).toEqual([n]);       // inside "a"'s bars
  });
});

describe('renameTagInPhrases', () => {
  test('a renamed tag stays a member of the phrases that listed it', () => {
    const phrases = [{ name: 'A', tags: ['x', 'y'] }, { name: 'B', tags: ['y'] }];
    expect(renameTagInPhrases(phrases, 'x', 'X!')).toEqual([{ name: 'A', tags: ['X!', 'y'] }, { name: 'B', tags: ['y'] }]);
  });

  test('a phrase that listed BOTH names ends up listing the new one once', () => {
    expect(renameTagInPhrases([{ name: 'A', tags: ['x', 'X!'] }], 'x', 'X!')).toEqual([{ name: 'A', tags: ['X!'] }]);
  });

  test('a blank or unchanged name leaves everything alone', () => {
    const phrases = [{ name: 'A', tags: ['x'] }];
    expect(renameTagInPhrases(phrases, 'x', '  ')).toBe(phrases);
    expect(renameTagInPhrases(phrases, 'x', 'x')).toBe(phrases);
  });
});
