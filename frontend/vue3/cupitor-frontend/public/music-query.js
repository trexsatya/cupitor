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

// ---------- chord decomposition ----------

// Base triad quality per chordPattern key (see music-reference-data.js chordPatterns).
const QUALITY_BY_CPK = {
  'maj': 'maj', 'min': 'min', 'aug': 'aug', 'dim': 'dim', 'dim7': 'dim',
  'sus4': 'maj', '7Sus4': 'maj',
  'min+9': 'min', 'maj+9': 'maj',
  '6': 'maj', 'min6': 'min', '6+9': 'maj', 'min6+9': 'min',
  '7': 'maj', 'maj7': 'maj', 'min7': 'min', 'minMaj7': 'min',
  '9': 'maj', 'maj9': 'maj', 'min9': 'min'
};

// Extension tokens beyond the base triad, per chordPattern key. Canonical tokens only.
const EXT_BY_CPK = {
  'maj': [], 'min': [], 'aug': [], 'dim': [],
  'dim7': ['7'], 'sus4': ['sus4'], '7Sus4': ['7', 'sus4'],
  'min+9': ['add9'], 'maj+9': ['add9'],
  '6': ['6'], 'min6': ['6'], '6+9': ['6', 'add9'], 'min6+9': ['6', 'add9'],
  '7': ['7'], 'maj7': ['maj7'], 'min7': ['7'], 'minMaj7': ['maj7'],
  '9': ['7', '9'], 'maj9': ['maj7', '9'], 'min9': ['7', '9']
};

const EXT_ALIASES = {
  '+9': 'add9', 'add9': 'add9', '9add': 'add9',
  'M7': 'maj7', 'maj7': 'maj7',
  'dom7': '7', '7': '7', 'b7': '7',
  '6': '6', 'sus4': 'sus4', 'sus': 'sus4', '9': '9'
};

export function normExtToken(token) {
  const t = String(token).trim();
  return EXT_ALIASES[t] || t;
}

// Note: a few verbose pattern keys normalise to the same symbol — e.g. both '9' and
// 'maj9' become "<root>9" via normaliseChordName. First-write-wins keeps the dominant
// reading ({'7','9'}); 'maj9' is not separately retrievable. This is fine because M1's
// chord inference normalises identically, so query and index symbols stay consistent.

// Build a lookup: normalised symbol -> {rootPc, quality, ext:Set}. Done once.
const CHORD_TABLE = (() => {
  const table = new Map();
  Object.keys(allChords).forEach(key => {
    const root = allChords[key].root;
    const cpk = key.slice(root.length);
    const quality = QUALITY_BY_CPK[cpk];
    if (!quality) return;
    const rootPc = pitchClass(root);
    if (rootPc === undefined) return;
    const sym = normaliseChordName(key);
    if (!table.has(sym)) table.set(sym, { rootPc, quality, ext: new Set(EXT_BY_CPK[cpk] || []) });
  });
  return table;
})();

export function decomposeChord(symbol) {
  const sym = String(symbol).trim();
  if (CHORD_TABLE.has(sym)) {
    const e = CHORD_TABLE.get(sym);
    return { rootPc: e.rootPc, quality: e.quality, ext: new Set(e.ext) };
  }
  // Fallback: root + simple quality marker; extensions best-effort empty.
  const m = /^([A-G][#b]?)(.*)$/.exec(sym);
  if (!m) return null;
  const rootPc = pitchClass(m[1]);
  if (rootPc === undefined) return null;
  const suffix = m[2];
  // Query input may arrive in verbose spelling (e.g. "Cdim", "Caug") as well as the
  // canonical "Co"/"C+"; handle both. (Real index symbols are always CHORD_TABLE keys,
  // so this fallback is effectively a query-side safety net.)
  let quality = 'maj';
  if (suffix.startsWith('o') || suffix.startsWith('dim')) quality = 'dim';
  else if (suffix.startsWith('+') || suffix.startsWith('aug')) quality = 'aug';
  else if (suffix.startsWith('m') && !suffix.startsWith('maj') && !suffix.startsWith('M')) quality = 'min';
  return { rootPc, quality, ext: new Set() };
}
