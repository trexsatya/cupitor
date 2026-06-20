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
