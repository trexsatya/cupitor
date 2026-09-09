// public/music-index.js
import { primaryVoice, packContour, encodeNoteText, encodeMusicXml, inferChords, canonicalChordSpans } from './music-encoding.js';
import { countPieces } from './music-split.js';
import { detectKey } from './music-key.js';
import { durationTypeToNumber } from './music-reference-data.js';

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

function channelsOf(doc) {
  const v = primaryVoice(doc);
  const present = ['pitch', 'interval', 'sargam'];
  if (v.duration.some(d => d !== null)) present.push('duration');
  if (v.chordSymbol.some(c => c !== null)) present.push('chordSymbol');
  if (v.lyric.some(l => l !== null)) present.push('lyric');
  return present;
}

const PC_NAMES = ["C","Cs","D","Ds","E","F","Fs","G","Gs","A","As","B"];

// Every sounded note as detectKey input: {midi, measure, onset, durBeats}. Duration comes from the
// note TYPE ('quarter' → 0.25 of a whole), which is all the weighting needs — relative lengths; an
// unwritten type counts as a quarter (note-text pieces carry no durations at all).
function keyNotesOf(doc) {
  const out = [];
  (doc.voices || []).forEach((v) => (v.pitch || []).forEach((midi, i) => out.push({
    midi, measure: v.measureIndex ? v.measureIndex[i] : 0, onset: v.onset ? v.onset[i] : i,
    durBeats: (v.duration && durationTypeToNumber(v.duration[i])) || 0.25,
  })));
  return out;
}

export function buildIndexEntry(doc, source) {
  const v = primaryVoice(doc);
  const noteCount = doc.voices.reduce((n, vv) => n + vv.pitch.length, 0);
  // Tonal center: the notated signature narrowed to ONE of its two keys by the cadences (detectKey).
  // encodeMusicXml already did this work and left it in meta.keyDetail — reuse it so the library badge
  // and the open piece can never disagree; re-derive only for docs that carry no detail (note-text).
  const keyDetail = doc.meta.keyDetail || detectKey(keyNotesOf(doc), { fifths: null, hasSignature: false });
  const guessedKey = noteCount ? keyDetail.label : null;
  // Chord search indexes ONE measure-ordered progression (not each voice concatenated — that
  // repeated the progression per voice and produced cross-voice false matches; see canonicalChordSpans).
  const chords = canonicalChordSpans(doc.voices).map(s => s.symbol);
  return {
    id: doc.meta.id,
    title: doc.meta.title,
    system: doc.meta.system,
    format: doc.meta.format,
    sourceUrl: doc.meta.sourceUrl,
    youtube: doc.meta.youtube,
    key: doc.meta.key,
    guessedKey,
    // How much the key badge can be trusted, and why — a piece with no (or a contradicted) key
    // signature reads 'low'/'medium' so the list can mark it instead of asserting a key it guessed.
    keyConfidence: noteCount ? keyDetail.confidence : null,
    keyAmbiguous: noteCount ? !!keyDetail.ambiguous : null,
    time: doc.meta.time,
    tempo: doc.meta.tempo,
    instrument: doc.meta.instrument,
    voiceCount: doc.voices.length,
    noteCount,
    // How many pieces the source packs (>1 → offer to split it). MusicXML only; note-text is 1.
    pieceCount: doc.meta.format === 'musicxml' && source ? countPieces(source) : 1,
    channels: channelsOf(doc),
    search: {
      contour: packContour(v.interval),
      pitchClasses: v.pitch.map(m => PC_NAMES[((m % 12) + 12) % 12]).join(' '),
      sargam: v.sargam.filter(Boolean).join(' '),
      chords: chords.join(' ')
    },
    detailPath: `details/${doc.meta.id}.json`,
    contentHash: fnv1a(source),
    tags: [],         // user-assigned labels; preserved across rebuilds (see computeChanges)
    note: '',         // free-text practice note; user metadata, preserved across rebuilds too
    updatedAt: null   // stamped by the caller (Date is unavailable in some contexts)
  };
}

// Pure: keep only the entries that carry at least one of the active tags. An empty/absent
// active set means "no filter" → all entries. Used by the library list and the search input.
export function filterByTags(entries, activeTags) {
  const active = activeTags instanceof Set ? activeTags : new Set(activeTags || []);
  if (!active.size) return entries || [];
  return (entries || []).filter(e => (e.tags || []).some(t => active.has(t)));
}

// Pure: remove a piece from the library — drop its index entry AND every vocab entry that
// belongs to it (cascade). Returns fresh arrays; inputs are untouched.
export function removePieceFromLibrary(index, vocab, id) {
  return {
    index: (index || []).filter(e => e.id !== id),
    vocab: (vocab || []).filter(v => v.pieceId !== id),
  };
}

export function splitTiers(doc, source) {
  const entry = buildIndexEntry(doc, source);
  const detail = { meta: doc.meta, voices: doc.voices, format: doc.meta.format, source };
  return { entry, detail };
}

export function getSystemFromUrl(href) {
  const url = new URL(href || (typeof window !== 'undefined' ? window.location.href : 'https://x/'));
  let value = new URLSearchParams(url.search).get('system');
  if (value !== 'sargam') value = 'western';   // default western, mirrors lang default 'swedish'
  return { name: value };
}

export function getMusicResourceUrl(system) {
  const name = system || getSystemFromUrl().name;
  return `https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/music/${name}`;
}

export function mergeIndex(existing, entries) {
  const byId = new Map(existing.map(e => [e.id, e]));
  entries.forEach(e => byId.set(e.id, e));
  return Array.from(byId.values());
}

// Pure: overlay local store records onto the remote index for display.
// Local unpushed (synced:false) records override remote (they are newer) and are
// flagged in `unpushedIds`. Local synced records fill gaps the remote fetch missed.
export function mergeLocalRemote(remoteIndex = [], localRecords = []) {
  const byId = new Map((remoteIndex || []).map(e => [e.id, e]));
  const unpushedIds = new Set();
  for (const rec of (localRecords || [])) {
    const e = rec && rec.entry;
    if (!e) continue;
    if (rec.synced === false) {
      byId.set(e.id, e);
      unpushedIds.add(e.id);
    } else if (!byId.has(e.id)) {
      byId.set(e.id, e);
    }
  }
  return { index: Array.from(byId.values()), unpushedIds };
}

function encodePiece(piece) {
  const meta = { id: piece.id, title: piece.title, system: piece.system, key: piece.key,
                 sourceUrl: piece.sourceUrl, youtube: piece.youtube, instrument: piece.instrument };
  const doc = piece.format === 'musicxml'
    ? encodeMusicXml(piece.source, meta)
    : encodeNoteText(piece.source, meta);
  return inferChords(doc);   // fill chordSymbol (harmony tags already win — inferChords only fills nulls)
}

// Pure: encode + diff pieces against the current index. No network, no storage.
export function computeChanges({ system, pieces, currentIndex = [], force = false, updatedAt = null }) {
  const currentById = new Map(currentIndex.map(e => [e.id, e]));
  const changedPieces = [];   // [{ entry, detail }]
  const changed = [];
  for (const piece of pieces) {
    const doc = encodePiece(piece);
    doc.meta.system = system;
    const { entry, detail } = splitTiers(doc, piece.source);
    entry.updatedAt = updatedAt;
    const prev = currentById.get(entry.id);
    if (prev && prev.tags && prev.tags.length) entry.tags = prev.tags;   // tags are user metadata — survive rebuilds
    if (prev && prev.note) entry.note = prev.note;                       // …and so is the practice note
    if (!force && prev && prev.contentHash === entry.contentHash) continue; // unchanged
    changedPieces.push({ entry, detail });
    changed.push(entry.id);
  }
  const index = mergeIndex(currentIndex, changedPieces.map(p => p.entry));
  return { changed, changedPieces, index };
}

const NOOP_STORE = {
  async putPieces() {}, async markSynced() {},
  async getEntries() { return []; }, async getDetail() { return null; }, async getUnpushed() { return []; }
};

// committer: async (files:[{path, getContent(current)}]) => any   (wraps GitHubUtils.commitMultipleFiles)
// store: created via createMusicStore() (music-local-store.js); defaults to a no-op
//        so callers/tests that don't care about local persistence still work.
// Writes changed pieces to the local store BEFORE pushing, so a push failure never
// loses data. Never rethrows a push failure — reports it via { pushed:false, pushError }.
export async function rebuildAndPush({ system, pieces, currentIndex = [], committer, store = NOOP_STORE, force = false, updatedAt = null }) {
  const { changed, changedPieces, index } = computeChanges({ system, pieces, currentIndex, force, updatedAt });
  if (changed.length === 0) return { changed, index, pushed: false };

  let localError = null;
  try { await store.putPieces(system, changedPieces); }
  catch (e) { localError = e.message; }

  const files = [
    { path: `db/music/${system}/index.json`, getContent: () => JSON.stringify(index, null, 2) },
    ...changedPieces.map(({ entry, detail }) => ({
      path: `db/music/${system}/details/${entry.id}.json`,
      getContent: () => JSON.stringify(detail)
    }))
  ];

  let pushed = false, pushError = null;
  try { await committer(files); pushed = true; }
  catch (e) { pushError = e.message; }

  if (pushed) {
    try { await store.markSynced(system, changed); }
    catch (e) { if (!localError) localError = e.message; }
  }
  return { changed, index, pushed, pushError, localError };
}

export async function loadIndex(system) {
  const res = await fetch(`${getMusicResourceUrl(system)}/index.json`);
  if (!res.ok) return [];
  return res.json();
}

// Re-push pieces still sitting in the local store as synced:false. Pushes the full
// current index plus one detail file per unpushed piece. Never rethrows.
export async function retryPush({ system, currentIndex = [], committer, store }) {
  const unpushed = await store.getUnpushed(system);
  if (!unpushed.length) return { pushed: false, changed: [] };
  const files = [
    { path: `db/music/${system}/index.json`, getContent: () => JSON.stringify(currentIndex, null, 2) },
    ...unpushed.map(({ entry, detail }) => ({
      path: `db/music/${system}/details/${entry.id}.json`,
      getContent: () => JSON.stringify(detail)
    }))
  ];
  const ids = unpushed.map(u => u.entry.id);
  try {
    await committer(files);
    await store.markSynced(system, ids);
    return { pushed: true, changed: ids };
  } catch (e) {
    return { pushed: false, pushError: e.message, changed: [] };
  }
}

// The single manual-push entry point for the local-first model: commits everything pending in
// ONE batch commit — the full current index, one detail file per unpushed piece THAT HAS a local
// detail (tag-only / link-only edits carry no detail, so only index.json reflects them), and
// vocab.json when pushVocab. Marks all pending pieces synced on success. Never rethrows.
export async function pushPending({ system, currentIndex = [], vocab = [], pushVocab = false, tags = [], pushTags = false, committer, store }) {
  const unpushed = await store.getUnpushed(system);
  const files = [
    { path: `db/music/${system}/index.json`, getContent: () => JSON.stringify(currentIndex, null, 2) },
    ...unpushed.filter(u => u.detail != null).map(({ entry, detail }) => ({
      path: `db/music/${system}/details/${entry.id}.json`,
      getContent: () => JSON.stringify(detail)
    }))
  ];
  if (pushVocab) files.push({ path: `db/music/${system}/vocab.json`, getContent: () => JSON.stringify(vocab || [], null, 2) });
  if (pushTags) files.push({ path: `db/music/${system}/tags.json`, getContent: () => JSON.stringify(tags || [], null, 2) });
  const ids = unpushed.map(u => u.entry.id);
  try {
    await committer(files);
    await store.markSynced(system, ids);
    return { pushed: true, changed: ids };
  } catch (e) {
    return { pushed: false, pushError: e.message, changed: [] };
  }
}

// Merge the remote index with the local store for the Manager's initial render.
export async function loadLibrary(system, store) {
  const remote = await loadIndex(system).catch(() => []);
  const local = await store.getEntries(system).catch(() => []);
  return mergeLocalRemote(remote, local);
}
