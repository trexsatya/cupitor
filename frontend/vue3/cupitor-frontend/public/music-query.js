// public/music-query.js
// Pure client-side search engine over the M1 Tier-1 index (search.* fields).
// No DOM, no fetch — all inputs are plain data.
import { pitchClass, intervalsOf, unpackContour } from './music-encoding.js';
import { allChords, normaliseChordName } from './music-reference-data.js';

// ---------- query parse / validate ----------

export function validateQuery(q) {
  if (!q || typeof q !== 'object') return { ok: false, error: 'query must be an object' };
  if (q.type === 'chord') {
    if (!Array.isArray(q.chords) || q.chords.length === 0) return { ok: false, error: 'chord query needs a non-empty chords array' };
    if (!q.chords.every(c => c && typeof c.chord === 'string' && c.chord.length)) return { ok: false, error: 'each chord needs a "chord" string' };
    return { ok: true };
  }
  if (q.type === 'melody') {
    if (!Array.isArray(q.notes) || q.notes.length === 0) return { ok: false, error: 'melody query needs a non-empty notes array' };
    if (!q.notes.every(n => typeof n === 'string' && n.length)) return { ok: false, error: 'each note must be a string' };
    return { ok: true };
  }
  return { ok: false, error: `unknown query type: ${q.type}` };
}

export function parseQuery(input) {
  const raw = typeof input === 'string' ? JSON.parse(input) : input;
  const v = validateQuery(raw);
  if (!v.ok) throw new Error(v.error);
  if (raw.type === 'chord') {
    return {
      type: 'chord',
      chords: raw.chords.map(c => ({ chord: c.chord, extensions_allowed: Array.isArray(c.extensions_allowed) ? c.extensions_allowed : [] })),
      strict_extensions: raw.strict_extensions === true,
      max_gap: Number.isFinite(raw.max_gap) ? raw.max_gap : 0,
      transpose_invariant: raw.transpose_invariant === true,
      max_results: (Number.isFinite(raw.max_results) && raw.max_results > 0) ? Math.floor(raw.max_results) : undefined
    };
  }
  return {
    type: 'melody',
    notes: raw.notes.slice(),
    search_by_interval: raw.search_by_interval === true,
    pitch_tolerance: Number.isFinite(raw.pitch_tolerance) ? raw.pitch_tolerance : 0,
    allow_passing: raw.allow_passing !== false,
    allow_repetition: raw.allow_repetition !== false,
    max_results: raw.max_results
  };
}
