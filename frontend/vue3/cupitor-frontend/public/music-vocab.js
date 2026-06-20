// public/music-vocab.js
// Segment capture → per-system vocabulary (db/music/<system>/vocab.json). Pure builders
// (snapshot, entry, upsert) are unit-tested; load/save are integration over fetch + GitHub.
import { primaryVoice } from './music-encoding.js';
import { getMusicResourceUrl } from './music-index.js';

// Pure: pitches (MIDI) and collapsed chord symbols from the primary voice within a
// 1-based inclusive measure range.
export function buildSnapshot(detail, measureRange) {
  const v = primaryVoice({ voices: (detail && detail.voices) || [] });
  const [from, to] = measureRange || [];
  const pitches = [];
  const chords = [];
  for (let i = 0; i < v.pitch.length; i++) {
    const m = v.measureIndex[i];
    if (m < from || m > to) continue;
    pitches.push(v.pitch[i]);
    const c = v.chordSymbol[i];
    if (c && chords[chords.length - 1] !== c) chords.push(c);
  }
  return { pitches, chords };
}

// Pure: build a categorized vocab entry. id follows M1 (pieceId + measure range, spaces→_).
export function buildVocabEntry({ pieceId, system, measureRange, youtube = null, startSeconds = null,
                                  snapshot = null, category = 'uncategorized', createdAt = null }) {
  const [measureStart, measureEnd] = measureRange;
  const id = `${pieceId}_${measureStart}_${measureEnd}`.replace(/\s+/g, '_');
  return {
    id, category, pieceId, system, measureStart, measureEnd,
    youtube, startSeconds,
    snapshot: snapshot || { pitches: [], chords: [] },
    createdAt,
  };
}
