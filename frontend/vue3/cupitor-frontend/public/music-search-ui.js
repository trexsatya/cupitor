// public/music-search-ui.js
// Pure helpers: turn the search UI's state into music-query.js query JSON, and format a
// result row. The DOM lives in music.html; these are unit-tested.

// Base-quality → chord-symbol suffix (matches normaliseChordName conventions).
const QUALITY_SUFFIX = { maj: '', min: 'm', dim: 'dim', aug: 'aug' };

const cap = (v) => (Number.isFinite(v) && v > 0) ? Math.floor(v) : undefined;

// chips: [{ root, quality, extensions:[...] }] → chord query JSON for runQuery.
export function buildChordQuery(chips, opts = {}) {
  return {
    type: 'chord',
    chords: (chips || []).map(c => ({
      chord: `${c.root}${QUALITY_SUFFIX[c.quality] || ''}`,
      extensions_allowed: Array.isArray(c.extensions) ? c.extensions.slice() : [],
    })),
    strict_extensions: opts.strict_extensions === true,
    max_gap: Number.isFinite(opts.max_gap) ? opts.max_gap : 0,
    transpose_invariant: opts.transpose_invariant === true,
    max_results: cap(opts.max_results),
  };
}

// tokens: array of note strings / '.' → melody query JSON for runQuery.
export function buildMelodyQuery(tokens, opts = {}) {
  return {
    type: 'melody',
    notes: (tokens || []).slice(),
    search_by_interval: opts.search_by_interval === true,
    pitch_tolerance: Number.isFinite(opts.pitch_tolerance) ? opts.pitch_tolerance : 0,
    max_results: cap(opts.max_results),
  };
}

// One-line human summary of a result for the results list.
export function matchSummary(result) {
  const m = result && result.match;
  if (!m) return '';
  const score = typeof result.score === 'number' ? ` · score ${result.score.toFixed(2)}` : '';
  if (m.kind === 'chord') return `chords: ${(m.symbols || []).join(' ')}${score}`;
  const n = m.range[1] - m.range[0] + 1;
  return `${n} note${n === 1 ? '' : 's'} matched${score}`;
}
