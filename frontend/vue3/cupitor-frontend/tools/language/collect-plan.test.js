import { planCollection, selectedCollectionWords } from './collect-plan.js';

describe('collection plan', () => {
  const subs = [
    { videoId: 'one11111111', sv: 'Nu gäller det.', en: '' },
    { videoId: 'two22222222', sv: 'En helt annan mening.', en: '' },
    { videoId: 'tri33333333', sv: 'Det gäller fortfarande.', en: '' },
  ];
  test('selects only terms below the requested number of separate videos', () => {
    const result = planCollection([
      { line: 'gäller', category: 'Test' },
      { line: 'annan', category: 'Test' },
    ], subs, 2);
    expect(result).toMatchObject([{ line: 'annan', count: 1, missing: 1 }]);
  });
  test('recognizes the missing number and ids already covering a term', () => {
    const result = planCollection([{ line: 'gäller' }], subs, 3);
    expect(result[0]).toMatchObject({
      count: 2, missing: 1, existingVideoIds: ['one11111111', 'tri33333333'],
    });
  });
  test('does not count duplicate subtitle bases from the same video twice', () => {
    const duplicates = [
      { videoId: 'one11111111', sv: 'Det gäller.' },
      { videoId: 'one11111111', sv: 'Nu gäller det också.' },
    ];
    expect(planCollection([{ line: 'gäller' }], duplicates, 2)[0])
      .toMatchObject({ count: 1, missing: 1, existingVideoIds: ['one11111111'] });
  });
  test('Swedish coverage does not count English-only translated mentions', () => {
    const captions = [
      { videoId: 'abc12345678', sv: 'Det är helt annorlunda.', en: 'She says förargas.' },
    ];
    const x = planCollection([{ line: 'förargas' }], captions, 2, { sourceLang: 'sv' });
    expect(x[0]).toMatchObject({ count: 0, missing: 2, existingVideoIds: [] });
    const y = planCollection([{ line: 'förargas' }], captions, 2, { sourceLang: 'en' });
    expect(y[0]).toMatchObject({ count: 1, missing: 1 });
  });
  test('counts alternatives separately, preserving familiar rarity rules', () => {
    const result = planCollection([{ line: 'gäller|saknas', category: 'Words' }], subs, 2);
    expect(result).toMatchObject([{ line: 'saknas', count: 0, missing: 2 }]);
  });
  test('allows explicitly selected two-letter words without changing bulk rarity defaults', () => {
    const entry = [{ line: 'gå' }];
    const s = [{ videoId: 'abc12345678', sv: 'Jag vill gå hem.' }];
    expect(planCollection(entry, s, 2)).toEqual([]);
    expect(planCollection(entry, s, 2, { minAltLen: 2 })[0])
      .toMatchObject({ line: 'gå', count: 1, missing: 1 });
  });
  test('rejects non-positive, non-integer thresholds', () => {
    expect(() => planCollection([], [], 0)).toThrow('positive integer');
    expect(() => planCollection([], [], 1.5)).toThrow('positive integer');
  });
});

test('word selection combines inline and file lists without splitting comma-bearing file lines', () => {
  expect(selectedCollectionWords(['gäller', 'gå'], '# comment\nsvår, men möjlig\ngäller\n'))
    .toEqual(['gäller', 'gå', 'svår, men möjlig']);
});
