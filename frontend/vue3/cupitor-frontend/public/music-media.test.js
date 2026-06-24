// public/music-media.test.js
import { guessSegmentStart, applyYouTubeLink } from './music-media.js';

// detail.voices: index-aligned arrays. duration = <type> string|null, measureIndex 1-based.
function detailWith(pitch, duration, measureIndex) {
  return { meta: { id: 'p', youtube: null }, format: 'musicxml', source: '<x/>',
           voices: [{ pitch, interval: [], sargam: [], duration, chordSymbol: [], lyric: [], measureIndex }] };
}

describe('guessSegmentStart', () => {
  test('duration-weighted: start ∝ (beats before segment / total beats) × mediaSeconds', () => {
    const d = detailWith([60, 62, 64, 65], ['quarter', 'quarter', 'quarter', 'quarter'], [1, 2, 3, 4]);
    expect(guessSegmentStart(d, [3, 4], 100)).toBeCloseTo(50, 5);
  });

  test('weights by note type, not note count', () => {
    const d = detailWith([60, 62, 64], ['half', 'quarter', 'quarter'], [1, 2, 3]);
    expect(guessSegmentStart(d, [2, 3], 80)).toBeCloseTo(40, 5);
  });

  test('segment starting at measure 1 → 0; null durations counted as a quarter each', () => {
    const d = detailWith([60, 62], [null, null], [1, 2]);
    expect(guessSegmentStart(d, [1, 2], 120)).toBe(0);
    expect(guessSegmentStart(d, [2, 2], 120)).toBeCloseTo(60, 5);
  });

  test('zero total duration or zero media → 0', () => {
    const empty = { voices: [{ pitch: [], duration: [], measureIndex: [], interval: [], sargam: [], chordSymbol: [], lyric: [] }] };
    expect(guessSegmentStart(empty, [1, 1], 100)).toBe(0);
    const d = detailWith([60], ['quarter'], [1]);
    expect(guessSegmentStart(d, [1, 1], 0)).toBe(0);
  });
});

describe('applyYouTubeLink', () => {
  test('sets youtube on both the entry and the detail meta, without mutating inputs', () => {
    const entry = { id: 'p', title: 'P', youtube: null };
    const detail = { meta: { id: 'p', youtube: null, title: 'P' }, voices: [], format: 'musicxml', source: '<x/>' };
    const url = 'https://youtu.be/dQw4w9WgXcQ';
    const out = applyYouTubeLink(entry, detail, url);
    expect(out.entry.youtube).toBe(url);
    expect(out.detail.meta.youtube).toBe(url);
    expect(entry.youtube).toBeNull();
    expect(detail.meta.youtube).toBeNull();
    expect(out.entry.title).toBe('P');
    expect(out.detail.meta.title).toBe('P');
    expect(out.detail.source).toBe('<x/>');
  });
});

import { linkYouTubeAndPush } from './music-media.js';

describe('linkYouTubeAndPush', () => {
  function fakeStore(detail) {
    const calls = { put: [], synced: [] };
    return {
      calls,
      async getDetail() { return detail; },
      async putPieces(system, items) { calls.put.push({ system, items }); },
      async markSynced(system, ids) { calls.synced.push({ system, ids }); },
    };
  }
  const detail = { meta: { id: 'p', youtube: null }, voices: [], format: 'musicxml', source: '<x/>' };
  const currentIndex = [{ id: 'p', title: 'P', youtube: null }, { id: 'other', title: 'O' }];
  const url = 'https://youtu.be/dQw4w9WgXcQ';

  test('patches both tiers, pushes index.json + the detail, writes local + marks synced on success', async () => {
    let pushed = null;
    const committer = async (files) => { pushed = files; };
    const store = fakeStore(detail);
    const res = await linkYouTubeAndPush({ system: 'western', id: 'p', url, currentIndex, store, committer });
    expect(res.pushed).toBe(true);
    expect(res.index.find(e => e.id === 'p').youtube).toBe(url);
    expect(res.index.find(e => e.id === 'other').youtube).toBeUndefined();
    const paths = pushed.map(f => f.path);
    expect(paths).toContain('db/music/western/index.json');
    expect(paths).toContain('db/music/western/details/p.json');
    const savedDetail = JSON.parse(await pushed.find(f => f.path === 'db/music/western/details/p.json').getContent(null));
    expect(savedDetail.meta.youtube).toBe(url);
    expect(store.calls.put[0].items[0].entry.youtube).toBe(url);
    expect(store.calls.synced[0].ids).toEqual(['p']);
  });

  test('push failure: pushed:false + pushError, no rethrow, not marked synced (local copy kept)', async () => {
    const store = fakeStore(detail);
    const committer = async () => { throw new Error('offline'); };
    const res = await linkYouTubeAndPush({ system: 'western', id: 'p', url, currentIndex, store, committer });
    expect(res.pushed).toBe(false);
    expect(res.pushError).toBe('offline');
    expect(store.calls.put.length).toBe(1);
    expect(store.calls.synced).toEqual([]);
  });
});

import { linkYouTubeLocal } from './music-media.js';

describe('linkYouTubeLocal (no push)', () => {
  function fakeStore(detail) {
    const calls = { put: [] };
    return { calls, async getDetail() { return detail; }, async putPieces(system, items) { calls.put.push({ system, items }); } };
  }
  const detail = { meta: { id: 'p', youtube: null }, voices: [], format: 'musicxml', source: '<x/>' };
  const currentIndex = [{ id: 'p', title: 'P', youtube: null }];
  const url = 'https://youtu.be/dQw4w9WgXcQ';

  test('patches both tiers + writes local, no committer/push', async () => {
    const store = fakeStore(detail);
    const res = await linkYouTubeLocal({ system: 'western', id: 'p', url, currentIndex, store });
    expect(res.error).toBeUndefined();
    expect(res.index.find(e => e.id === 'p').youtube).toBe(url);
    expect(store.calls.put[0].items[0].detail.meta.youtube).toBe(url);
    expect(store.calls.put[0].items[0].entry.youtube).toBe(url);
  });

  test('missing detail → error, no local write', async () => {
    const store = fakeStore(null);
    const res = await linkYouTubeLocal({ system: 'western', id: 'p', url, currentIndex, store });
    expect(res.error).toBe('detail not found');
    expect(store.calls.put.length).toBe(0);
  });
});
