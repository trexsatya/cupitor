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
  test('counts alternatives separately, preserving familiar rarity rules', () => {
    const result = planCollection([{ line: 'gäller|saknas', category: 'Words' }], subs, 2);
    expect(result).toMatchObject([{ line: 'saknas', count: 0, missing: 2 }]);
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
