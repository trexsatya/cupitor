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
    if (!q.notes.every(n => n === '.' || pitchClass(n) !== undefined)) return { ok: false, error: 'unrecognised note token' };
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

// ---------- chord matching ----------

const mod12 = n => ((n % 12) + 12) % 12;

// Does query chord q match piece chord p, given anchor (null for the first match)?
function chordMatchesAt(q, p, query, anchor) {
  if (!q || !p) return false;
  if (q.quality !== p.quality) return false;
  if (query.transpose_invariant) {
    if (anchor) {
      const want = mod12(q.rootPc - anchor.qRoot);
      const got = mod12(p.rootPc - anchor.pRoot);
      if (want !== got) return false;
    }
  } else if (q.rootPc !== p.rootPc) {
    return false;
  }
  if (query.strict_extensions) {
    const allowed = q.allowed; // Set of canonical tokens
    for (const e of p.ext) if (!allowed.has(e)) return false;
  }
  return true;
}

// Recursive constrained sub-sequence search. Returns array of matched indices, or null.
function matchSeq(qDec, pieceDec, query, qi, prevIdx, anchor) {
  if (qi === qDec.length) return [];
  const from = prevIdx + 1;
  const to = (qi === 0) ? pieceDec.length - 1 : Math.min(pieceDec.length - 1, prevIdx + 1 + (query.max_gap || 0));
  for (let j = from; j <= to; j++) {
    const p = pieceDec[j];
    if (chordMatchesAt(qDec[qi], p, query, qi === 0 ? null : anchor)) {
      const nextAnchor = anchor || { qRoot: qDec[qi].rootPc, pRoot: p.rootPc };
      const tail = matchSeq(qDec, pieceDec, query, qi + 1, j, nextAnchor);
      if (tail) return [j, ...tail];
    }
  }
  return null;
}

// Note: M1's index collapses consecutive identical chords in `search.chords`, so an
// adjacent-duplicate query like [C, C] never matches contiguously (max_gap=0) against
// real index data — it only matches when a different chord sits between (max_gap>=1).
export function matchChordQuery(query, pieceChordsStr) {
  const pieceSyms = (pieceChordsStr || '').split(/\s+/).filter(Boolean);
  if (pieceSyms.length === 0) return null;
  const pieceDec = pieceSyms.map(decomposeChord);
  const qDec = query.chords.map(c => {
    const d = decomposeChord(c.chord);
    return d && { ...d, allowed: new Set((c.extensions_allowed || []).map(normExtToken)) };
  });
  if (qDec.some(d => !d)) return null;
  const indices = matchSeq(qDec, pieceDec, query, 0, -1, null);
  if (!indices) return null;
  return {
    start: indices[0],
    end: indices[indices.length - 1],
    indices,
    symbols: indices.map(i => pieceSyms[i])
  };
}


// ---------- melody: pitch-class matching ----------

// Index compact spelling ("Cs"=1 ...) -> pitch class number.
const COMPACT_PC = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 };

export function parseMelodyTokens(notes) {
  return notes.map(n => (n === '.' ? null : pitchClass(n)));
}

function pitchClassesToNumbers(pcStr) {
  return (pcStr || '').split(/\s+/).filter(Boolean).map(t => COMPACT_PC[t]);
}

export function matchMelodyPitchClasses(notes, pitchClassesStr) {
  const q = parseMelodyTokens(notes);
  const seq = pitchClassesToNumbers(pitchClassesStr);
  const len = q.length;
  for (let start = 0; start + len <= seq.length; start++) {
    let ok = true;
    for (let i = 0; i < len; i++) {
      if (q[i] === null) continue;                                                // wildcard
      if (q[i] === undefined || seq[start + i] !== q[i]) { ok = false; break; }   // unknown token never matches
    }
    if (ok) return { start, end: start + len - 1 };
  }
  return null;
}


// ---------- melody: interval (transposition-invariant) matching ----------

// Build query intervals with a "free" flag. notes -> [{value, free}].
// "." makes any interval touching it free (value ignored).
// KNOWN LIMITATION: query intervals are pitch-class deltas (0-11), so an octave-crossing
// leap in the contour (e.g. +16) won't match a small query interval like +4. Fine for M2.
function queryIntervals(notes) {
  const pcs = notes.map(n => (n === '.' ? null : pitchClass(n)));
  const out = [];
  for (let i = 1; i < pcs.length; i++) {
    const a = pcs[i - 1], b = pcs[i];
    if (a === null || b === null) out.push({ value: 0, free: true });
    else out.push({ value: b - a, free: false });   // pitch-class delta is fine for contour shape
  }
  return out;
}

const within = (a, b, tol) => Math.abs(a - b) <= tol;

export function matchMelodyIntervals(notes, contour, opts = {}) {
  if (notes.length < 2) return null;       // need at least one interval; single notes use pc mode
  const tol = opts.pitch_tolerance || 0;
  const q = queryIntervals(notes);
  const k = q.length;                       // intervals to match
  for (let start = 0; start + k <= contour.length; start++) {
    let ok = true;
    for (let i = 0; i < k; i++) {
      if (q[i].free) continue;
      if (!within(contour[start + i], q[i].value, tol)) { ok = false; break; }
    }
    if (ok) return { start, end: start + k };  // note window spans k+1 notes: [start, start+k]
  }
  return null;
}
