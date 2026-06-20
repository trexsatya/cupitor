// public/music-vocab.test.js
import { buildSnapshot, buildVocabEntry, upsertVocab, groupVocabByCategory } from './music-vocab.js';

function detailWith(pitch, chordSymbol, measureIndex) {
  return { meta: { id: 'p' }, format: 'musicxml', source: '<x/>',
           voices: [{ pitch, interval: [], sargam: [], duration: [], chordSymbol, lyric: [], measureIndex }] };
}

describe('buildSnapshot', () => {
  test('collects primary-voice pitches in the measure range and collapses consecutive chords', () => {
    const d = detailWith(
      [60, 62, 64, 65, 67],
      ['C', 'C', 'G', 'G', null],
      [1, 2, 2, 3, 4]
    );
    const snap = buildSnapshot(d, [2, 3]);
    expect(snap.pitches).toEqual([62, 64, 65]);
    expect(snap.chords).toEqual(['C', 'G']);
  });

  test('empty range / no voices → empty snapshot', () => {
    expect(buildSnapshot(detailWith([60], ['C'], [1]), [5, 6])).toEqual({ pitches: [], chords: [] });
    expect(buildSnapshot({ voices: [] }, [1, 2])).toEqual({ pitches: [], chords: [] });
  });
});

describe('buildVocabEntry', () => {
  test('assembles a categorized entry with id = pieceId_start_end and the given fields', () => {
    const entry = buildVocabEntry({
      pieceId: 'chopin op9', system: 'western', measureRange: [5, 8],
      youtube: 'https://youtu.be/abc', startSeconds: 42.5, endSeconds: 55.0, chords: ['Cmaj', 'Am'],
      note: 'tricky run', snapshot: { pitches: [60, 62], chords: ['C'] }, category: 'cadences', createdAt: '2026-06-20',
    });
    expect(entry).toEqual({
      id: 'chopin_op9_5_8',
      category: 'cadences',
      pieceId: 'chopin op9',
      system: 'western',
      measureStart: 5,
      measureEnd: 8,
      youtube: 'https://youtu.be/abc',
      startSeconds: 42.5,
      endSeconds: 55.0,
      chords: ['Cmaj', 'Am'],
      note: 'tricky run',
      snapshot: { pitches: [60, 62], chords: ['C'] },
      createdAt: '2026-06-20',
    });
  });

  test('defaults: category=uncategorized, youtube/startSeconds null, empty snapshot', () => {
    const entry = buildVocabEntry({ pieceId: 'p', system: 'sargam', measureRange: [1, 1], createdAt: '2026-06-20' });
    expect(entry.category).toBe('uncategorized');
    expect(entry.youtube).toBeNull();
    expect(entry.startSeconds).toBeNull();
    expect(entry.endSeconds).toBeNull();
    expect(entry.chords).toEqual([]);
    expect(entry.note).toBe('');
    expect(entry.snapshot).toEqual({ pitches: [], chords: [] });
    expect(entry.id).toBe('p_1_1');
  });
});

import { saveVocabAndPush } from './music-vocab.js';

describe('upsertVocab', () => {
  test('appends a new entry and replaces an existing one by id', () => {
    const a = { id: 'x_1_2', category: 'a' };
    const b = { id: 'y_1_1', category: 'b' };
    const list1 = upsertVocab([a], b);
    expect(list1.map(e => e.id)).toEqual(['x_1_2', 'y_1_1']);
    const list2 = upsertVocab(list1, { id: 'x_1_2', category: 'updated' });
    expect(list2.find(e => e.id === 'x_1_2').category).toBe('updated');
    expect(list2).toHaveLength(2);
  });
});

describe('saveVocabAndPush', () => {
  test('pushes vocab.json with the full array; returns pushed:true', async () => {
    let files = null;
    const committer = async (f) => { files = f; };
    const vocab = [{ id: 'x_1_2', category: 'a' }];
    const res = await saveVocabAndPush({ system: 'western', vocab, committer });
    expect(res.pushed).toBe(true);
    expect(files[0].path).toBe('db/music/western/vocab.json');
    expect(JSON.parse(await files[0].getContent(null))).toEqual(vocab);
  });

  test('push failure: pushed:false + pushError, no rethrow', async () => {
    const committer = async () => { throw new Error('offline'); };
    const res = await saveVocabAndPush({ system: 'western', vocab: [], committer });
    expect(res.pushed).toBe(false);
    expect(res.pushError).toBe('offline');
  });

  test('writes the local store before pushing, so a failed push still persists the vocab', async () => {
    let saved = null;
    const store = { putVocab: async (_sys, v) => { saved = v; } };
    const committer = async () => { throw new Error('offline'); };
    const vocab = [{ id: 'x_1_2', category: 'a' }];
    const res = await saveVocabAndPush({ system: 'western', vocab, store, committer });
    expect(saved).toEqual(vocab);       // persisted locally despite the push failing
    expect(res.pushed).toBe(false);
    expect(res.localError).toBeNull();
  });
});

import { loadVocab } from './music-vocab.js';

describe('loadVocab', () => {
  const okFetch = (data) => async () => ({ ok: true, json: async () => data });

  test('merges local cache over remote so local additions survive (local wins on id)', async () => {
    global.fetch = okFetch([{ id: 'r1', category: 'remote' }, { id: 'shared', category: 'remote' }]);
    const store = { getVocab: async () => [{ id: 'local1', category: 'mine' }, { id: 'shared', category: 'mine' }] };
    const merged = await loadVocab('western', store);
    expect(merged.find(e => e.id === 'r1').category).toBe('remote');   // remote-only kept
    expect(merged.find(e => e.id === 'local1').category).toBe('mine'); // local-only kept
    expect(merged.find(e => e.id === 'shared').category).toBe('mine'); // local wins
    expect(merged).toHaveLength(3);
  });

  test('tolerates an unreachable remote and a missing store', async () => {
    global.fetch = async () => { throw new Error('network'); };
    expect(await loadVocab('western')).toEqual([]);                    // no store, fetch fails → []
    const store = { getVocab: async () => [{ id: 'local1' }] };
    expect(await loadVocab('western', store)).toEqual([{ id: 'local1' }]);
  });
});

describe('groupVocabByCategory', () => {
  test('groups by category, sorts categories, preserves entry order', () => {
    const vocab = [
      { id: 'a', category: 'licks' }, { id: 'b', category: 'cadences' },
      { id: 'c', category: 'licks' }, { id: 'd' },  // no category → uncategorized
    ];
    const groups = groupVocabByCategory(vocab);
    expect(groups.map(g => g.category)).toEqual(['cadences', 'licks', 'uncategorized']);
    expect(groups.find(g => g.category === 'licks').entries.map(e => e.id)).toEqual(['a', 'c']);
    expect(groups.find(g => g.category === 'uncategorized').entries.map(e => e.id)).toEqual(['d']);
  });
  test('empty / missing input → []', () => {
    expect(groupVocabByCategory([])).toEqual([]);
    expect(groupVocabByCategory(null)).toEqual([]);
  });
});
