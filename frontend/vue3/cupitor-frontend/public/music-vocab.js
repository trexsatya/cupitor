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
                                  suppressed = [], variationXml = null, variationLabel = '',
                                  variationVoiceIds = null }) {
  const [measureStart, measureEnd] = measureRange;
  const id = `${pieceId}_${measureStart}_${measureEnd}`.replace(/\s+/g, '_');
  const entry = {
    id, category, pieceId, system, measureStart, measureEnd,
    measureOffset,          // pickup/anacrusis shift: printed number = measureStart − measureOffset
    youtube, startSeconds, endSeconds,
    chords: chords || [],   // manually-picked best-match chord names (multi-select)
    note: note || '',       // free-text annotation for the segment
    snapshot: snapshot || { pitches: [], chords: [] },
    suppressed: suppressed || [],   // notes silenced for chord practice: [{measure, midi, beats}]
    createdAt,
  };
  // A saved *variation* carries its own embellished MusicXML so re-opening replays the exact
  // variation (grace/shuffle/counter-line), not the plain source passage. These keys are absent
  // on normal entries, keeping their stored shape unchanged.
  if (variationXml) {
    entry.variationXml = variationXml;
    entry.variationLabel = variationLabel || '';
    if (variationVoiceIds) entry.variationVoiceIds = variationVoiceIds;
  }
  return entry;
}

// Pure: add or replace a vocab entry by id, returning a new array.
export function upsertVocab(vocab, entry) {
  const out = (vocab || []).filter(e => e.id !== entry.id);
  out.push(entry);
  return out;
}

// Pure: a vocab id not already used in `vocab`. Returns `baseId` when free, else appends the
// smallest `_N` (N≥2) that's unused. Lets "Add as a new item" create a genuine second entry for a
// passage that already has one (ids are derived from pieceId+measureRange, so an unchanged range
// would otherwise collide and silently replace).
export function uniqueVocabId(vocab, baseId) {
  const ids = new Set((vocab || []).map(e => e.id));
  if (!ids.has(baseId)) return baseId;
  let n = 2;
  while (ids.has(`${baseId}_${n}`)) n++;
  return `${baseId}_${n}`;
}

// ── Reverting local edits ────────────────────────────────────────────────────────────────────
// The library is shared through GitHub, so "local" means edited here but not pushed yet. These let
// the UI show which vocab items differ from the published vocab.json, and put one back.
// Deep-compares by JSON: entries are plain data (no functions, no cycles) built by buildVocabEntry.
const sameEntry = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function vocabById(list) { return new Map((list || []).map((e) => [e.id, e])); }

// 'new' — the server has never seen this item; 'changed' — it exists there but differs;
// 'same' — identical to the published copy.
export function vocabItemStatus(entry, remote) {
  if (!entry) return 'same';
  const r = (remote instanceof Map ? remote : vocabById(remote)).get(entry.id);
  if (!r) return 'new';
  return sameEntry(entry, r) ? 'same' : 'changed';
}

// Put the server's copy of one item back — or drop the item when the server has never seen it (there
// is nothing to revert TO). Returns { vocab, action } with action 'restored' | 'removed' | 'none';
// order is preserved for a restore so the list doesn't jump under the user.
export function revertVocabEntry(local, remote, id) {
  const list = local || [];
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return { vocab: list, action: 'none' };
  const r = vocabById(remote).get(id);
  if (!r) return { vocab: list.filter((e) => e.id !== id), action: 'removed' };
  const next = list.slice();
  next[idx] = r;
  return { vocab: next, action: 'restored' };
}

// Is the local vocab now identical to the published one? Order-insensitive (the file is a bag of
// items keyed by id) — used to clear the "unpushed" flag once the last local edit is reverted.
export function vocabMatchesRemote(local, remote) {
  const a = vocabById(local);
  const b = vocabById(remote);
  if (a.size !== b.size) return false;
  for (const [id, entry] of a) { if (!b.has(id) || !sameEntry(entry, b.get(id))) return false; }
  return true;
}

// Integration: the PUBLISHED vocabulary for a system, with no local overlay — the baseline a revert
// restores from. [] when the file is missing or unreachable (offline: nothing to revert to).
export async function loadRemoteVocab(system) {
  try {
    const res = await fetch(`${getMusicResourceUrl(system)}/vocab.json`);
    return res.ok ? await res.json() : [];
  } catch (_) { return []; }
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
  const remote = await loadRemoteVocab(system);
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
