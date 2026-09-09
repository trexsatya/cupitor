// public/music-vocab.test.js
import { buildSnapshot, buildVocabEntry, upsertVocab, uniqueVocabId, groupVocabByCategory } from './music-vocab.js';

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
      pieceId: 'chopin op9', system: 'western', measureRange: [5, 8], measureOffset: 1,
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
      measureOffset: 1,
      youtube: 'https://youtu.be/abc',
      startSeconds: 42.5,
      endSeconds: 55.0,
      chords: ['Cmaj', 'Am'],
      note: 'tricky run',
      snapshot: { pitches: [60, 62], chords: ['C'] },
      suppressed: [],
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
    expect(entry.measureOffset).toBe(0);   // no pickup shift unless provided
    expect(entry.id).toBe('p_1_1');
  });

  test('stores a provided suppressed-notes list', () => {
    const entry = buildVocabEntry({
      pieceId: 'p', system: 'western', measureRange: [1, 1], createdAt: '2026-06-22',
      suppressed: [{ measure: 1, midi: 60, beats: 0 }, { measure: 1, midi: 64, beats: 1 }],
    });
    expect(entry.suppressed).toEqual([{ measure: 1, midi: 60, beats: 0 }, { measure: 1, midi: 64, beats: 1 }]);
  });

  test('defaults suppressed to an empty array', () => {
    const entry = buildVocabEntry({ pieceId: 'p', system: 'sargam', measureRange: [1, 1], createdAt: '2026-06-22' });
    expect(entry.suppressed).toEqual([]);
  });

  test('a saved variation carries its embellished XML, label, and fretboard voice ids', () => {
    const entry = buildVocabEntry({
      pieceId: 'p', system: 'western', measureRange: [3, 4], createdAt: '2026-07-15',
      variationXml: '<score-partwise/>', variationLabel: 'Bluesy — Var 2', variationVoiceIds: ['1', '2'],
    });
    expect(entry.variationXml).toBe('<score-partwise/>');
    expect(entry.variationLabel).toBe('Bluesy — Var 2');
    expect(entry.variationVoiceIds).toEqual(['1', '2']);
  });

  test('a normal entry has NO variation-* keys (unchanged, backward-compatible shape)', () => {
    const entry = buildVocabEntry({ pieceId: 'p', system: 'western', measureRange: [1, 1], createdAt: '2026-07-15' });
    expect('variationXml' in entry).toBe(false);
    expect('variationLabel' in entry).toBe(false);
    expect('variationVoiceIds' in entry).toBe(false);
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

describe('uniqueVocabId', () => {
  test('returns the base id when free; appends the smallest unused _N on collision', () => {
    const vocab = [{ id: 'P_5_8' }, { id: 'P_5_8_2' }];
    expect(uniqueVocabId(vocab, 'P_1_4')).toBe('P_1_4');   // free → unchanged
    expect(uniqueVocabId(vocab, 'P_5_8')).toBe('P_5_8_3');  // _2 taken → next free is _3
    expect(uniqueVocabId([], 'P_5_8')).toBe('P_5_8');
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

import { vocabItemStatus, revertVocabEntry, vocabMatchesRemote, loadRemoteVocab } from './music-vocab.js';

// Reverting local edits: the library is shared through GitHub, so a local item may be new, changed,
// or identical to the published vocab.json — and reverting means taking the published copy back.
describe('reverting a vocab item', () => {
  const remote = [{ id: 'a', note: 'server' }, { id: 'b', note: 'same' }];
  const local = [{ id: 'a', note: 'mine' }, { id: 'b', note: 'same' }, { id: 'c', note: 'brand new' }];

  test('each item knows whether it is new, changed, or already published', () => {
    expect(vocabItemStatus(local[0], remote)).toBe('changed');
    expect(vocabItemStatus(local[1], remote)).toBe('same');
    expect(vocabItemStatus(local[2], remote)).toBe('new');
    expect(vocabItemStatus(local[0], new Map(remote.map((e) => [e.id, e])))).toBe('changed');   // Map accepted
  });

  test('reverting a CHANGED item puts the server copy back, in place', () => {
    const { vocab, action } = revertVocabEntry(local, remote, 'a');
    expect(action).toBe('restored');
    expect(vocab.map((e) => e.id)).toEqual(['a', 'b', 'c']);   // order held
    expect(vocab[0]).toEqual({ id: 'a', note: 'server' });
    expect(local[0].note).toBe('mine');                        // input untouched
  });

  test('reverting a NEW item removes it — there is nothing on the server to go back to', () => {
    const { vocab, action } = revertVocabEntry(local, remote, 'c');
    expect(action).toBe('removed');
    expect(vocab.map((e) => e.id)).toEqual(['a', 'b']);
  });

  test('an unknown id changes nothing', () => {
    expect(revertVocabEntry(local, remote, 'zzz')).toEqual({ vocab: local, action: 'none' });
  });

  test('vocabMatchesRemote tells the UI when the last local edit is gone', () => {
    expect(vocabMatchesRemote(local, remote)).toBe(false);
    const step1 = revertVocabEntry(local, remote, 'a').vocab;
    expect(vocabMatchesRemote(step1, remote)).toBe(false);          // 'c' is still local-only
    const step2 = revertVocabEntry(step1, remote, 'c').vocab;
    expect(vocabMatchesRemote(step2, remote)).toBe(true);           // back to the published set
    expect(vocabMatchesRemote([], [])).toBe(true);
  });
});

describe('loadRemoteVocab', () => {
  test('returns the published list, and [] when it cannot be reached', async () => {
    global.fetch = async () => ({ ok: true, json: async () => [{ id: 'r' }] });
    expect(await loadRemoteVocab('western')).toEqual([{ id: 'r' }]);
    global.fetch = async () => ({ ok: false });
    expect(await loadRemoteVocab('western')).toEqual([]);
    global.fetch = async () => { throw new Error('offline'); };
    expect(await loadRemoteVocab('western')).toEqual([]);
  });
});
