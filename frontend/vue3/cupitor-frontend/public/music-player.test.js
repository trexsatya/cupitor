// public/music-player.test.js
import { buildSchedule, NOTE_TYPE_BEATS, parseYouTubeId } from './music-player.js';

// Primary voice = the one with the most notes. midi=pitch, duration=<type> string|null, measureIndex 1-based.
function voice(pitch, duration, measureIndex) {
  return [{ pitch, interval: [], sargam: [], duration, chordSymbol: [], lyric: [], measureIndex }];
}

describe('buildSchedule', () => {
  test('maps note types to cumulative times + durations at the given tempo', () => {
    // 120 BPM → 0.5s per quarter beat. quarter(1b)=0.5s, eighth(0.5b)=0.25s, half(2b)=1.0s
    const v = voice([60, 62, 64], ['quarter', 'eighth', 'half'], [1, 1, 1]);
    const s = buildSchedule(v, { tempo: 120 });
    expect(s).toEqual([
      { midi: 60, time: 0,    duration: 0.5 },
      { midi: 62, time: 0.5,  duration: 0.25 },
      { midi: 64, time: 0.75, duration: 1.0 },
    ]);
  });

  test('null/unknown durations default to a quarter beat (note-text pieces)', () => {
    const v = voice([60, 62], [null, 'bogus'], [1, 1]);
    const s = buildSchedule(v, { tempo: 60 }); // 1s per quarter
    expect(s).toEqual([
      { midi: 60, time: 0, duration: 1 },
      { midi: 62, time: 1, duration: 1 },
    ]);
  });

  test('segment filter keeps only notes in [fromMeasure,toMeasure] and re-zeros the start to 0', () => {
    const v = voice([60, 62, 64, 65], ['quarter', 'quarter', 'quarter', 'quarter'], [1, 2, 2, 3]);
    const s = buildSchedule(v, { tempo: 60, fromMeasure: 2, toMeasure: 2 });
    expect(s).toEqual([
      { midi: 62, time: 0, duration: 1 },
      { midi: 64, time: 1, duration: 1 },
    ]);
  });

  test('null/zero tempo falls back to 90 BPM; empty voices → []', () => {
    const v = voice([60], ['quarter'], [1]);
    const s = buildSchedule(v, { tempo: null });
    expect(s[0].duration).toBeCloseTo(60 / 90, 5);
    expect(buildSchedule([], {})).toEqual([]);
    expect(buildSchedule(null, {})).toEqual([]);
  });

  test('picks the voice with the most notes', () => {
    const voices = [
      { pitch: [60], duration: ['quarter'], measureIndex: [1], interval: [], sargam: [], chordSymbol: [], lyric: [] },
      { pitch: [62, 64, 65], duration: ['quarter', 'quarter', 'quarter'], measureIndex: [1, 1, 1], interval: [], sargam: [], chordSymbol: [], lyric: [] },
    ];
    const s = buildSchedule(voices, { tempo: 60 });
    expect(s.map(e => e.midi)).toEqual([62, 64, 65]);
  });
});

describe('parseYouTubeId', () => {
  test('extracts the 11-char id from common URL shapes', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=xyz')).toBe('dQw4w9WgXcQ');
  });

  test('returns null for non-YouTube or id-less input', () => {
    expect(parseYouTubeId('https://example.com/video')).toBeNull();
    expect(parseYouTubeId('')).toBeNull();
    expect(parseYouTubeId(null)).toBeNull();
  });
});
