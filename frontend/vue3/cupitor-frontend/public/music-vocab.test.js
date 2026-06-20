// public/music-vocab.test.js
import { buildSnapshot, buildVocabEntry, upsertVocab } from './music-vocab.js';

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
      youtube: 'https://youtu.be/abc', startSeconds: 42.5,
      snapshot: { pitches: [60, 62], chords: ['C'] }, category: 'cadences', createdAt: '2026-06-20',
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
      snapshot: { pitches: [60, 62], chords: ['C'] },
      createdAt: '2026-06-20',
    });
  });

  test('defaults: category=uncategorized, youtube/startSeconds null, empty snapshot', () => {
    const entry = buildVocabEntry({ pieceId: 'p', system: 'sargam', measureRange: [1, 1], createdAt: '2026-06-20' });
    expect(entry.category).toBe('uncategorized');
    expect(entry.youtube).toBeNull();
    expect(entry.startSeconds).toBeNull();
    expect(entry.snapshot).toEqual({ pitches: [], chords: [] });
    expect(entry.id).toBe('p_1_1');
  });
});
