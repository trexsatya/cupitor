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
export function buildVocabEntry({ pieceId, system, measureRange, measureOffset = 0, youtube = null,
                                  startSeconds = null, endSeconds = null, chords = [], note = '',
                                  snapshot = null, category = 'uncategorized', createdAt = null,
                                  suppressed = [] }) {
  const [measureStart, measureEnd] = measureRange;
  const id = `${pieceId}_${measureStart}_${measureEnd}`.replace(/\s+/g, '_');
  return {
    id, category, pieceId, system, measureStart, measureEnd,
    measureOffset,          // pickup/anacrusis shift: printed number = measureStart − measureOffset
    youtube, startSeconds, endSeconds,
    chords: chords || [],   // manually-picked best-match chord names (multi-select)
    note: note || '',       // free-text annotation for the segment
    snapshot: snapshot || { pitches: [], chords: [] },
    suppressed: suppressed || [],   // notes silenced for chord practice: [{measure, midi, beats}]
    createdAt,
  };
}

// Pure: add or replace a vocab entry by id, returning a new array.
export function upsertVocab(vocab, entry) {
  const out = (vocab || []).filter(e => e.id !== entry.id);
  out.push(entry);
  return out;
}

// Pure: group vocab entries by category (sorted), preserving each group's entry order.
export function groupVocabByCategory(vocab) {
  const byCat = new Map();
  for (const e of (vocab || [])) {
    const cat = e.category || 'uncategorized';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(e);
  }
  return Array.from(byCat.keys()).sort().map(category => ({ category, entries: byCat.get(category) }));
}

// Integration: load the per-system vocabulary, merging the local cache over the remote
// vocab.json so locally-captured entries survive reload even when their push failed (or
// hasn't propagated). Local wins on id collisions; remote-only entries are kept. Tolerates
// an unreachable remote and a missing/erroring store. `store` is optional (back-compat).
export async function loadVocab(system, store) {
  let remote = [];
  try { const res = await fetch(`${getMusicResourceUrl(system)}/vocab.json`); if (res.ok) remote = await res.json(); }
  catch (_) { remote = []; }
  if (!store || !store.getVocab) return remote;
  let local = [];
  try { local = (await store.getVocab(system)) || []; } catch (_) { local = []; }
  let merged = remote;
  for (const e of local) merged = upsertVocab(merged, e);
  return merged;
}

// Integration: persist the full vocab array. Writes the local store FIRST (so captures
// survive reload regardless of the push), then pushes vocab.json. Never rethrows either
// failure. `store` is optional (back-compat); reports {pushed, pushError, localError}.
export async function saveVocabAndPush({ system, vocab, store, committer }) {
  let localError = null;
  if (store && store.putVocab) {
    try { await store.putVocab(system, vocab); } catch (e) { localError = e.message; }
  }
  const files = [{ path: `db/music/${system}/vocab.json`, getContent: () => JSON.stringify(vocab, null, 2) }];
  let pushed = false, pushError = null;
  try { await committer(files); pushed = true; }
  catch (e) { pushError = e.message; }
  return { pushed, pushError, localError };
}
