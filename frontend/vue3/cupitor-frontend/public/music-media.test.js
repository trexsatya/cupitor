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
