// public/music-index.test.js
import { encodeNoteText, primaryVoice } from './music-encoding.js';
import { fnv1a, buildIndexEntry, splitTiers, getSystemFromUrl, getMusicResourceUrl } from './music-index.js';

const txt = 'G4# D5# D5 C5#\nB4 C5# B4 A4# G4#';

describe('index assembly', () => {
  test('fnv1a is stable and changes with input', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'));
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
    expect(typeof fnv1a('abc')).toBe('string');
  });

  test('primaryVoice returns the voice with the most notes', () => {
    const doc = encodeNoteText(txt, { id: 'jethalal_bgm', key: 'G#m' });
    expect(primaryVoice(doc).pitch.length).toBe(9);
  });

  test('buildIndexEntry: metadata + packed search fields + pointer + hash', () => {
    const doc = encodeNoteText(txt, { id: 'jethalal_bgm', title: 'Jethalal BGM', system: 'western', key: 'G#m' });
    const entry = buildIndexEntry(doc, txt);
    expect(entry.id).toBe('jethalal_bgm');
    expect(entry.system).toBe('western');
    expect(entry.format).toBe('note-text');
    expect(entry.noteCount).toBe(9);
    expect(entry.voiceCount).toBe(1);
    expect(entry.channels).toEqual(['pitch', 'interval', 'sargam']);
    expect(entry.search.contour).toBe('7,-1,-1,-2,2,-2,-1,-2');
    expect(entry.detailPath).toBe('details/jethalal_bgm.json');
    expect(entry.contentHash).toBe(fnv1a(txt));
  });

  test('splitTiers: detail carries voices + inline source', () => {
    const doc = encodeNoteText(txt, { id: 'jethalal_bgm', key: 'G#m' });
    const { entry, detail } = splitTiers(doc, txt);
    expect(entry.id).toBe('jethalal_bgm');
    expect(detail.format).toBe('note-text');
    expect(detail.source).toBe(txt);
    expect(detail.voices[0].pitch.length).toBe(9);
  });
});

describe('system routing (mirrors ?lang=)', () => {
  test('defaults to western when ?system is absent', () => {
    expect(getSystemFromUrl('https://x/music.html').name).toBe('western');
  });
  test('reads ?system=sargam', () => {
    expect(getSystemFromUrl('https://x/music.html?system=sargam').name).toBe('sargam');
  });
  test('resource url points at db/music/<system> on gh-pages', () => {
    expect(getMusicResourceUrl('western'))
      .toBe('https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/music/western');
    expect(getMusicResourceUrl('sargam'))
      .toBe('https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/music/sargam');
  });
});
