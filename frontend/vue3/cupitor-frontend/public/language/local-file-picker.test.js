import {
  isLocalMediaFile,
  localMediaStem,
  localSubtitleRank,
  rankLocalSubtitles,
  matchingEnglishSubtitle,
} from './local-file-picker';

const f = name => ({name});

describe('local subtitle picker', () => {
  test('supports the same media types as the existing player', () => {
    expect(['x.mp3', 'x.wav', 'x.mp4'].every(isLocalMediaFile)).toBe(true);
    expect(isLocalMediaFile('x.srt')).toBe(false);
    expect(localMediaStem('x.MP3')).toBe('x');
  });

  test('puts x.srt first, then language-specific matches, then other files', () => {
    const files = ['unrelated.srt', 'x.en.srt', 'x.sv.srt', 'x.srt', 'x.fr.srt']
      .map(f);
    expect(rankLocalSubtitles('x.mp3', files, 'sv').map(x => x.file.name))
      .toEqual(['x.srt', 'x.sv.srt', 'x.en.srt', 'x.fr.srt', 'unrelated.srt']);
  });

  test('uses the current target language after the exact x.srt', () => {
    const files = ['x.sv.srt', 'x.es.srt', 'x.en.srt'].map(f);
    expect(rankLocalSubtitles('x.mp4', files, 'es').map(x => x.file.name))
      .toEqual(['x.es.srt', 'x.en.srt', 'x.sv.srt']);
  });

  test('compares case and Unicode normalization without fuzzy false positives', () => {
    expect(localSubtitleRank('Räksmörgås.MP3', 'Ra\u0308ksmo\u0308rga\u030as.SRT', 'sv'))
      .toBe(0);
    expect(localSubtitleRank('x.mp3', 'x-part2.srt')).toBe(4);
    expect(localSubtitleRank('x.mp3', 'x.en.txt')).toBe(null);
    expect(rankLocalSubtitles('x.mp3', ['readme.txt', 'x.SRT'].map(f)))
      .toHaveLength(1);
  });

  test('does not silently select unrelated files when no match exists', () => {
    const ranked = rankLocalSubtitles('x.mp3', ['a.srt', 'b.srt'].map(f));
    expect(ranked.every(x => x.rank === 4)).toBe(true);
  });

  test('only pairs an English SRT from the same media, not a different title', () => {
    const primary = f('x.srt');
    const english = f('x.en.srt');
    const other = f('y.en.srt');
    expect(matchingEnglishSubtitle('x.mp3', [other, primary, english], primary))
      .toBe(english);
    expect(matchingEnglishSubtitle('x.mp3', [other, primary], primary)).toBe(null);
    expect(matchingEnglishSubtitle('x.mp3', [english], english)).toBe(null);
  });
});
