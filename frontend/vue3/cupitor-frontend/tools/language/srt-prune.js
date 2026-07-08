// Pure helpers for the `prune` command: identify full-video transcripts (which
// eat disk) and decide which are safe to delete — a transcript is safe when every
// dictionary item (expanded alternative) it contains also appears in some OTHER
// srt (typically the small snippet you already captured from it).
import {
  buildRareWordRegex,
  buildRareWordPrefilter,
  prefilterHit,
} from "../../public/language/rare-words.js";
import { parseSrtEntries, entriesToSrtText, srtTimeToSeconds } from "../../public/language/srt-parser.js";

// Total duration an srt covers: last entry's end minus first entry's start, in
// seconds. null when the file has no timestamps.
export function srtSpanSeconds(srtText) {
  const s = String(srtText || "");
  const toSec = (t) => {
    const m = t.match(/(\d\d):(\d\d):(\d\d)[,.](\d+)/);
    return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + Number("0." + m[4]) : null;
  };
  const starts = [...s.matchAll(/^(\d\d:\d\d:\d\d[,.]\d+)\s*-->/gm)].map((m) => toSec(m[1]));
  const ends = [...s.matchAll(/-->\s*(\d\d:\d\d:\d\d[,.]\d+)/g)].map((m) => toSec(m[1]));
  if (!starts.length || !ends.length) return null;
  return Math.max(...ends) - Math.min(...starts);
}

// A "full-video transcript" (removal candidate) spans more than `minSpanSec` of
// video. Captured snippets span only their few context lines (~seconds), so this
// cleanly separates them from full transcripts.
export function isFullSrt(srtText, { minSpanSec = 60 } = {}) {
  const span = srtSpanSeconds(srtText);
  return span !== null && span > minSpanSec;
}

// For each item { key, expanded }, find up to `maxOwners` srts (by name) whose sv
// or en text contains it. Returns Map(key -> ownerName[]). Early-stops per item at
// maxOwners (we only need to tell apart 1 vs 2 vs "many").
export function scanItemOwners(items, srtDocs, { maxOwners = 3 } = {}) {
  const docs = (srtDocs || []).map((d) => ({
    name: d.name,
    sv: d.sv,
    en: d.en,
    svLo: (d.sv || "").toLowerCase(),
    enLo: (d.en || "").toLowerCase(),
  }));
  const owners = new Map();
  for (const item of items || []) {
    let re;
    try {
      re = buildRareWordRegex(item.expanded);
    } catch (e) {
      re = null;
    }
    if (!re) continue;
    const sigs = buildRareWordPrefilter(item.expanded);
    const found = [];
    for (const d of docs) {
      if (sigs && !prefilterHit(d.svLo, d.enLo, sigs)) continue; // cheap skip
      if ((d.sv && re.test(d.sv)) || (d.en && re.test(d.en))) {
        found.push(d.name);
        if (found.length >= maxOwners) break;
      }
    }
    if (found.length) owners.set(item.key, found);
  }
  return owners;
}

// srts that are the SOLE owner of at least one item — removing one drops that
// item's only surviving copy, so it can't be removed.
export function uniqueOwnerSrts(itemOwners) {
  const set = new Set();
  for (const names of itemOwners.values()) if (names.length === 1) set.add(names[0]);
  return set;
}

// For items that appear in NO snippet but in >= 1 full transcript, map the item
// to the transcripts containing it. Items covered by a snippet (or absent from all
// transcripts) are omitted — only the returned items need a window preserved in
// some transcript so nothing vanishes from the corpus.
export function scanUncoveredOwners(items, snippetDocs, transcriptDocs) {
  const prep = (docs) =>
    (docs || []).map((d) => ({
      name: d.name,
      sv: d.sv,
      en: d.en,
      svLo: (d.sv || "").toLowerCase(),
      enLo: (d.en || "").toLowerCase(),
    }));
  const snips = prep(snippetDocs);
  const trans = prep(transcriptDocs);
  const out = new Map();
  for (const item of items || []) {
    let re;
    try {
      re = buildRareWordRegex(item.expanded);
    } catch (e) {
      re = null;
    }
    if (!re) continue;
    const sigs = buildRareWordPrefilter(item.expanded);
    const hit = (d) =>
      (!sigs || prefilterHit(d.svLo, d.enLo, sigs)) &&
      ((d.sv && re.test(d.sv)) || (d.en && re.test(d.en)));
    if (snips.some(hit)) continue; // already safe in a snippet
    const owners = [];
    for (const d of trans) if (hit(d)) owners.push(d.name);
    if (owners.length) out.set(item.key, owners);
  }
  return out;
}

// --- shrinking a transcript to windows around chosen items ------------------

// Merge overlapping/adjacent { start, end } second-ranges into a minimal set.
export function mergeRanges(ranges) {
  const sorted = [...(ranges || [])].sort((a, b) => a.start - b.start);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ start: r.start, end: r.end });
  }
  return out;
}

// Second-ranges to keep: a ±window (in entries) around matches of any regex.
// Entry texts are joined (whitespace-normalized) so a phrase spanning adjacent
// entries still matches; each match offset is mapped back to its entry. Merged.
// With `firstPerRegex`, only the FIRST match of each regex keeps a window — one
// example per dictionary item is enough for coverage, so recurring words don't
// bloat the shrunk file.
export function srtKeepRanges(text, regexes, { before = 4, after = 4, firstPerRegex = false } = {}) {
  const entries = parseSrtEntries(text);
  if (!entries.length || !regexes || !regexes.length) return [];
  let joined = "";
  const spans = [];
  entries.forEach((e, i) => {
    const start = joined.length;
    joined += String(e.text || "").replace(/\s+/g, " ");
    spans.push({ i, start, end: joined.length });
    joined += " "; // separator between entries
  });
  const entryAt = (off) => {
    for (const s of spans) if (off >= s.start && off < s.end) return s.i;
    for (let k = spans.length - 1; k >= 0; k--) if (off >= spans[k].start) return spans[k].i;
    return 0;
  };
  const ranges = [];
  for (const re of regexes) {
    const g = re.global ? re : new RegExp(re.source, re.flags + "g");
    g.lastIndex = 0;
    let m;
    while ((m = g.exec(joined)) !== null) {
      const idx = entryAt(m.index);
      const lo = Math.max(0, idx - before);
      const hi = Math.min(entries.length - 1, idx + after);
      ranges.push({ start: srtTimeToSeconds(entries[lo].start), end: srtTimeToSeconds(entries[hi].end) });
      if (m.index === g.lastIndex) g.lastIndex++; // guard against zero-width loops
      if (firstPerRegex) break; // one window per item is enough for coverage
    }
  }
  return mergeRanges(ranges);
}

// Rewrite an srt keeping only entries overlapping any of `ranges` (renumbered).
// Empty ranges -> "" (nothing worth keeping).
export function applyRanges(text, ranges) {
  if (!ranges || !ranges.length) return "";
  const kept = parseSrtEntries(text).filter((e) => {
    const s = srtTimeToSeconds(e.start);
    const en = srtTimeToSeconds(e.end);
    return ranges.some((r) => s < r.end && en > r.start);
  });
  return kept.length ? entriesToSrtText(kept) : "";
}

// Assign each item to transcripts so every item is covered at least once, using
// as few transcripts as possible (greedy set cover: repeatedly take the transcript
// covering the most still-uncovered items). itemOwners: Map(item -> ownerName[]).
// Returns Map(ownerName -> item[]) — the windows each surviving transcript keeps.
export function greedyCover(itemOwners) {
  const ownerItems = new Map();
  for (const [item, owners] of itemOwners) {
    for (const o of owners || []) {
      if (!ownerItems.has(o)) ownerItems.set(o, new Set());
      ownerItems.get(o).add(item);
    }
  }
  const covered = new Set();
  const assignment = new Map();
  const total = itemOwners.size;
  while (covered.size < total) {
    let best = null;
    let bestItems = null;
    for (const [owner, items] of ownerItems) {
      const fresh = [...items].filter((it) => !covered.has(it));
      if (!bestItems || fresh.length > bestItems.length) {
        best = owner;
        bestItems = fresh;
      }
    }
    if (!best || !bestItems.length) break; // remaining items have no owner
    assignment.set(best, bestItems);
    for (const it of bestItems) covered.add(it);
  }
  return assignment;
}

// Greedily pick which candidates can actually be deleted without losing any item.
// Removing a candidate is allowed only if every item it owns (with fewer than
// maxOwners owners — "abundant" items never constrain) still has another owner
// that hasn't been removed. This is safe even when two candidates are the only
// two owners of an item: the second is kept. Returns { removable, kept }.
export function greedyRemovable(candidateNames, itemOwners, { maxOwners = 3 } = {}) {
  const srtItems = new Map(); // name -> [ownerName[] of a constraining item]
  for (const names of itemOwners.values()) {
    if (names.length >= maxOwners) continue; // abundant → no constraint
    for (const n of names) {
      if (!srtItems.has(n)) srtItems.set(n, []);
      srtItems.get(n).push(names);
    }
  }
  const removed = new Set();
  const removable = [];
  const kept = [];
  for (const name of candidateNames) {
    const constraints = srtItems.get(name) || [];
    const orphans = constraints.some(
      (names) => !names.some((o) => o !== name && !removed.has(o))
    );
    if (orphans) kept.push(name);
    else {
      removed.add(name);
      removable.push(name);
    }
  }
  return { removable, kept };
}
