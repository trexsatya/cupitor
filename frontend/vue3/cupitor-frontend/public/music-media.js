// public/music-media.js
// Media-linking: attach a YouTube URL to a piece, and guess a segment's start time
// in the linked video by duration-weighted proportion. Pure guess/patch fns are
// unit-tested; the push is integration glue over the offline-first store + committer.
import { primaryVoice } from './music-encoding.js';
import { NOTE_TYPE_BEATS } from './music-player.js';
import { mergeIndex } from './music-index.js';

const DEFAULT_BEATS = 1; // quarter, used when duration is null/unknown

// Pure: estimate where `measureRange` (1-based [start,end]) begins in a media file of
// `mediaSeconds`, as (note-beats before the segment ÷ total note-beats) × mediaSeconds.
export function guessSegmentStart(detail, measureRange, mediaSeconds) {
  if (!detail || !measureRange || !mediaSeconds) return 0;
  const v = primaryVoice({ voices: detail.voices || [] });
  const start = measureRange[0];
  let total = 0, before = 0;
  for (let i = 0; i < v.pitch.length; i++) {
    const beats = NOTE_TYPE_BEATS[v.duration[i]] ?? DEFAULT_BEATS;
    total += beats;
    if (v.measureIndex[i] < start) before += beats;
  }
  return total > 0 ? (before / total) * mediaSeconds : 0;
}
