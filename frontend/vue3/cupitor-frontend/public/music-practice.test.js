import {
  weekStart, weekLabel, makeField, makeEntry, upsertEntry, removeEntry, sortEntries,
  mergeFieldName, statusMeta, PRACTICE_STATUSES,
} from './music-practice.js';

describe('weekStart', () => {
  // Jan 5, 2026 is a Monday (Jan 1, 2026 = Thursday).
  test('a Monday maps to itself', () => {
    expect(weekStart(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  test('a midweek day maps back to its Monday', () => {
    expect(weekStart(new Date(2026, 0, 8))).toBe('2026-01-05');   // Thursday
  });
  test('Sunday belongs to the week that began the preceding Monday', () => {
    expect(weekStart(new Date(2026, 0, 11))).toBe('2026-01-05');  // Sunday
    expect(weekStart(new Date(2026, 0, 12))).toBe('2026-01-12');  // next Monday
  });
});

describe('weekLabel', () => {
  test('formats a friendly month/day/year label', () => {
    expect(weekLabel('2026-01-05')).toBe('Week of Jan 5, 2026');
    expect(weekLabel('2026-07-06')).toBe('Week of Jul 6, 2026');
  });
  test('empty/malformed input yields an empty label', () => {
    expect(weekLabel('')).toBe('');
    expect(weekLabel('nonsense')).toBe('');
  });
});

describe('makeField', () => {
  test('trims name, stringifies value, defaults an unknown status to planned', () => {
    expect(makeField({ name: '  Tempo ', value: 120, status: 'bogus' }))
      .toEqual({ name: 'Tempo', value: '120', status: 'planned' });
  });
  test('keeps a valid status', () => {
    expect(makeField({ name: 'x', status: 'done' }).status).toBe('done');
  });
});

describe('makeEntry', () => {
  test('defaults every field and normalises custom fields, dropping nameless ones', () => {
    const e = makeEntry({ id: '1', week: '2026-01-05',
      custom: [{ name: 'Tempo', value: 120, status: 'in-progress' }, { name: '', value: 'x' }] });
    expect(e.status).toBe('planned');
    expect(e.pieceId).toBeNull();
    expect(e.custom).toEqual([{ name: 'Tempo', value: '120', status: 'in-progress' }]);
  });
});

describe('upsertEntry / removeEntry', () => {
  test('inserts a new entry', () => {
    const out = upsertEntry([{ id: 'a' }], { id: 'b', goal: 'x' });
    expect(out.map((e) => e.id)).toEqual(['a', 'b']);
  });
  test('replaces an existing entry by id without moving it', () => {
    const out = upsertEntry([{ id: 'a', goal: 'old' }, { id: 'b' }], { id: 'a', goal: 'new' });
    expect(out[0]).toEqual({ id: 'a', goal: 'new' });
    expect(out).toHaveLength(2);
  });
  test('remove drops the matching id', () => {
    expect(removeEntry([{ id: 'a' }, { id: 'b' }], 'a').map((e) => e.id)).toEqual(['b']);
  });
});

describe('sortEntries', () => {
  test('newest week first, then most-recently updated', () => {
    const sorted = sortEntries([
      { id: '1', week: '2026-01-05', updatedAt: '2026-01-06' },
      { id: '2', week: '2026-01-12', updatedAt: '2026-01-13' },
      { id: '3', week: '2026-01-12', updatedAt: '2026-01-14' },
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['3', '2', '1']);
  });
});

describe('mergeFieldName', () => {
  test('adds a new name', () => {
    expect(mergeFieldName(['Tempo'], 'Metronome')).toEqual({ fields: ['Tempo', 'Metronome'], added: true, name: 'Metronome' });
  });
  test('does not duplicate an existing name (case-insensitive), trims input', () => {
    expect(mergeFieldName(['Tempo'], '  tempo ')).toEqual({ fields: ['Tempo'], added: false, name: 'tempo' });
  });
  test('ignores an empty name', () => {
    expect(mergeFieldName(['Tempo'], '   ')).toEqual({ fields: ['Tempo'], added: false, name: '' });
  });
});

describe('statusMeta', () => {
  test('returns the matching status, falling back to the first', () => {
    expect(statusMeta('done').label).toBe('Done');
    expect(statusMeta('nope')).toBe(PRACTICE_STATUSES[0]);
  });
});
