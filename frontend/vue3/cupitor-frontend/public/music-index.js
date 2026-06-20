// public/music-index.js
import { primaryVoice, packContour, encodeNoteText, encodeMusicXml, inferChords } from './music-encoding.js';

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

export function buildIndexEntry(doc, source) {
  const v = primaryVoice(doc);
  const noteCount = doc.voices.reduce((n, vv) => n + vv.pitch.length, 0);
  const chords = [];
  doc.voices.forEach(vv => vv.chordSymbol.forEach(c => { if (c && chords[chords.length - 1] !== c) chords.push(c); }));
  return {
    id: doc.meta.id,
    title: doc.meta.title,
    system: doc.meta.system,
    format: doc.meta.format,
    sourceUrl: doc.meta.sourceUrl,
    youtube: doc.meta.youtube,
    key: doc.meta.key,
    time: doc.meta.time,
    tempo: doc.meta.tempo,
    instrument: doc.meta.instrument,
    voiceCount: doc.voices.length,
    noteCount,
    channels: channelsOf(doc),
    search: {
      contour: packContour(v.interval),
      pitchClasses: v.pitch.map(m => PC_NAMES[((m % 12) + 12) % 12]).join(' '),
      sargam: v.sargam.filter(Boolean).join(' '),
      chords: chords.join(' ')
    },
    detailPath: `details/${doc.meta.id}.json`,
    contentHash: fnv1a(source),
    updatedAt: null   // stamped by the caller (Date is unavailable in some contexts)
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

// Merge the remote index with the local store for the Manager's initial render.
export async function loadLibrary(system, store) {
  const remote = await loadIndex(system).catch(() => []);
  const local = await store.getEntries(system).catch(() => []);
  return mergeLocalRemote(remote, local);
}
