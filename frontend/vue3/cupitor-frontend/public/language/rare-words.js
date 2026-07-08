// Pure core of the "rare words" scan (see scanRareWords in language.js): given
// vocabulary lines + cleaned subtitle texts, find the lines that occur in fewer
// than `threshold` subtitle files. Shared by the browser app and the Node CLI.
// No DOM — subtitle cleaning and expansion are supplied by the caller.
import { SEPARATOR_PIPE } from "./vocab-search.js";
import { relaxSpaces } from "./search-text.js";

const MIN_LINE_LEN = 3;
const MIN_ALT_LEN = 3;
const MIN_SIG_LEN = 3;

// The `|`-separated alternatives of an expanded line, filtered to those long
// enough to matter. Shared by the regex builder and the pre-filter so both see
// the exact same alternative set.
function strippedAlternatives(expanded, minAltLen = MIN_ALT_LEN) {
  return String(expanded || "")
    .split(SEPARATOR_PIPE)
    .filter((p) => p.trim().length >= minAltLen);
}

// Flatten a parsed vocabulary object into unique {line, category} entries.
// Dedupes by (trimmed) line keeping the first category seen; drops lines shorter
// than `minLineLen` (single/double-char function words bring no signal).
export function flattenVocabEntries(vocabulary, minLineLen = MIN_LINE_LEN) {
  const seen = new Map();
  Object.entries(vocabulary || {}).forEach(([cat, lines]) => {
    if (!Array.isArray(lines)) return;
    lines.forEach((line) => {
      const l = (line || "").trim();
      if (l.length < minLineLen) return;
      if (!seen.has(l)) seen.set(l, cat);
    });
  });
  return Array.from(seen.entries()).map(([line, category]) => ({ line, category }));
}

// Compile the match regex for one (already expanded) vocab line. Alternatives
// shorter than `minAltLen` are dropped first so short forms ("lev", "se") don't
// swallow the line by matching as substrings of unrelated words. The pattern is
// anchored with Unicode letter/number boundary lookarounds (so "fanatisk" does
// not match "fanatiskt"); falls back to an unanchored regex if /u compilation
// fails. Returns null when nothing survives the length filter.
export function buildRareWordRegex(expanded, { minAltLen = MIN_ALT_LEN } = {}) {
  const alts = strippedAlternatives(expanded, minAltLen);
  if (!alts.length) return null;
  const relaxed = relaxSpaces(alts.join(SEPARATOR_PIPE));
  try {
    return new RegExp("(?<![\\p{L}\\p{N}])(?:" + relaxed + ")(?![\\p{L}\\p{N}])", "iu");
  } catch (eU) {
    try {
      return new RegExp(relaxed, "i");
    } catch (e2) {
      return null;
    }
  }
}

// Build a cheap substring pre-filter for the (expensive) match regex. Each
// alternative contributes its longest letter/number run as a "signature" — a
// literal that MUST appear for that alternative to match (letters are never made
// optional: `*` only follows `.`/`]`, spaces become `\s+`). A subtitle can only
// match the alternation if it contains at least one signature, so testing
// `sub.includes(sig)` first lets us skip the regex for subtitles that can't hit.
// Returns null (no safe/selective filter) when any surviving alternative lacks a
// run >= minSigLen — then callers must run the regex unconditionally.
export function buildRareWordPrefilter(expanded, { minAltLen = MIN_ALT_LEN, minSigLen = MIN_SIG_LEN } = {}) {
  const alts = strippedAlternatives(expanded, minAltLen);
  if (!alts.length) return null;
  const sigs = [];
  for (const alt of alts) {
    const runs = alt.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    let longest = "";
    for (const r of runs) if (r.length > longest.length) longest = r;
    if (longest.length < minSigLen) return null; // unfilterable alternative
    sigs.push(longest);
  }
  return sigs.length ? sigs : null;
}

// True if any signature appears in the (already lowercased) sv/en text.
export function prefilterHit(svLower, enLower, sigs) {
  for (const sig of sigs) {
    if ((svLower && svLower.includes(sig)) || (enLower && enLower.includes(sig))) return true;
  }
  return false;
}

// Count how many subtitle files (each { svLo, enLo, sv, en }) the compiled regex
// hits, short-circuiting at `threshold` since anything >= threshold isn't rare.
function countMatchingFiles(re, sigs, lo, threshold) {
  let count = 0;
  for (const sub of lo) {
    if (sigs && !prefilterHit(sub.svLo, sub.enLo, sigs)) continue; // cheap skip
    if ((sub.sv && re.test(sub.sv)) || (sub.en && re.test(sub.en))) {
      count++;
      if (count >= threshold) break; // can't be "fewer than threshold" any more
    }
  }
  return count;
}

// Lowercase each subtitle once for the substring pre-filter (the regex itself is
// case-insensitive and still runs on the original text).
function lowercaseSubs(subs) {
  return (subs || []).map((s) => ({
    sv: s.sv,
    en: s.en,
    svLo: (s.sv || "").toLowerCase(),
    enLo: (s.en || "").toLowerCase(),
  }));
}

// Find vocab entries occurring in fewer than `threshold` subtitle files.
// `subs` is an array of { sv, en } cleaned strings (a word counts as present if
// it appears in either column). `opts.expand(line, langCode)` expands a vocab
// line before matching; if omitted the line is used verbatim.
//
// Default mode judges rarity per whole line (the union of its `|`-alternatives):
// returns [{ line, category, count }]. With `opts.perAlternative`, each expanded
// alternative is judged on its own — so a rare idiom bundled with common synonyms
// isn't masked — returning [{ line, category, count, expanded }] where line and
// expanded are the alternative itself (deduped across lines, first category wins).
// Either way, sorted by count asc then line.
export function findRareWords(entries, subs, threshold, opts = {}) {
  const { expand, langCode, perAlternative = false } = opts;
  const lo = lowercaseSubs(subs);
  if (perAlternative) return findRareAlternatives(entries, lo, threshold, expand, langCode);

  const found = [];
  for (const entry of entries) {
    const { line, category } = entry;
    let re;
    let expanded;
    try {
      expanded = expand ? expand(line, langCode) : line;
      re = buildRareWordRegex(expanded);
    } catch (e) {
      re = null;
    }
    if (!re) continue;
    const sigs = buildRareWordPrefilter(expanded);
    const count = countMatchingFiles(re, sigs, lo, threshold);
    if (count < threshold) found.push({ line, category, count });
  }
  found.sort((a, b) => a.count - b.count || a.line.localeCompare(b.line));
  return found;
}

// Collect every expanded `|`-alternative across all vocab lines, deduped (first
// category wins). Returns [{ alt, category }]. Shared by per-alternative rarity
// and the srt-prune command (both treat one alternative as one dictionary item).
export function expandedAlternatives(entries, { expand, langCode } = {}) {
  const catOf = new Map(); // alternative -> category
  for (const entry of entries || []) {
    let expanded;
    try {
      expanded = expand ? expand(entry.line, langCode) : entry.line;
    } catch (e) {
      continue;
    }
    for (const alt of strippedAlternatives(expanded)) {
      const a = alt.trim();
      if (!catOf.has(a)) catOf.set(a, entry.category);
    }
  }
  return [...catOf].map(([alt, category]) => ({ alt, category }));
}

// Per-alternative rarity: judge each expanded alternative individually.
function findRareAlternatives(entries, lo, threshold, expand, langCode) {
  const found = [];
  for (const { alt, category } of expandedAlternatives(entries, { expand, langCode })) {
    let re;
    try {
      re = buildRareWordRegex(alt);
    } catch (e) {
      re = null;
    }
    if (!re) continue;
    const sigs = buildRareWordPrefilter(alt);
    const count = countMatchingFiles(re, sigs, lo, threshold);
    if (count < threshold) found.push({ line: alt, category, count, expanded: alt });
  }
  found.sort((a, b) => a.count - b.count || a.line.localeCompare(b.line));
  return found;
}
