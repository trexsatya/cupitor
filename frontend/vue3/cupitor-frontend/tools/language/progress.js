// Chunking + resumability for the "Manage" CLI steps. A step's work is a list of
// unit keys (rare words, or video ids); a progress file records which are done.
// Each run processes "the next N pending" and appends to the done set, so the
// step is resumable across many invocations.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function toSet(doneKeys) {
  return doneKeys instanceof Set ? doneKeys : new Set(doneKeys || []);
}

// Next `size` keys from `allKeys` not present in `doneKeys` (order preserved).
// size <= 0 means "all pending".
export function selectChunk(allKeys, doneKeys, size) {
  const done = toSet(doneKeys);
  const pending = (allKeys || []).filter((k) => !done.has(k));
  return size && size > 0 ? pending.slice(0, size) : pending;
}

export function progressSummary(allKeys, doneKeys) {
  const done = toSet(doneKeys);
  const all = allKeys || [];
  const doneCount = all.filter((k) => done.has(k)).length;
  return { total: all.length, done: doneCount, pending: all.length - doneCount };
}

// --- thin JSON persistence -------------------------------------------------

export function loadProgress(path) {
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    return { doneKeys: Array.isArray(data.doneKeys) ? data.doneKeys : [], ...data };
  } catch (e) {
    return { doneKeys: [] };
  }
}

export function saveProgress(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}

// Mark keys done in a progress file (idempotent, deduped).
export function markDone(path, keys) {
  const state = loadProgress(path);
  const set = new Set(state.doneKeys);
  (Array.isArray(keys) ? keys : [keys]).forEach((k) => set.add(k));
  state.doneKeys = [...set];
  saveProgress(path, state);
  return state;
}
