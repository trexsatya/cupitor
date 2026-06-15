// Different-prefix matching: given a typed word (e.g. "bevara"), strip the
// leading derivational prefix to a stem ("vara"), then look across the
// vocabulary for words formed by attaching a *different* prefix to the same
// stem ("förvara", "anvara", …). Pure / DI'd version — the heavy
// dependency (vocabSuffixOverlapLen for the weak-overlap fallback) is
// passed in, and the caller supplies the line list.

import { SEPARATOR_PIPE } from './vocab-search.js'

// Derivational prefixes per language. Sorted longest-first by _stripPrefix
// so stripping picks `under-` before `un-`, `genom-` before `ge-`, etc.
export const COMMON_PREFIXES = {
  sv: ['tillbaka', 'genom', 'efter', 'under', 'över', 'fram', 'före', 'kvar', 'fast', 'sam', 'för', 'upp', 'miss', 'till', 'mot', 'ned', 'an', 'om', 'be', 'er', 'bi', 'av', 'ut', 'in', 'på', 'å'],
  en: ['under', 'over', 'after', 'fore', 'with', 'pre', 'pro', 'sub', 'super', 'mis', 'mid', 'dis', 'non', 'out', 'off', 'in', 're', 'un', 'de', 'be'],
  es: ['contra', 'extra', 'inter', 'entre', 'sobre', 'bajo', 'des', 'pre', 'sub', 'sin', 'con', 'mal', 're', 'in'],
}

// Strip the longest matching prefix from `word` using the supplied list.
// `prefixList` must be sorted longest-first (the caller does that). Requires
// the residual stem to be ≥ 3 chars — we don't want "bevis" reduced to "vis"
// or "be" reduced to "".
export function _stripPrefix(word, prefixList) {
  for (const p of prefixList) {
    if (word.length - p.length >= 3 && word.startsWith(p)) {
      return { prefix: p, stem: word.substring(p.length) }
    }
  }
  return { prefix: '', stem: word }
}

// Core logic for the Different-prefixes dialog. `lines` is the flat list of
// non-hidden vocab lines; `lineCategory` is parallel (same length, category
// per line). `suffixOverlap` is the function used for the weak-overlap (b)
// pass (caller wires this to vocab-search's vocabSuffixOverlapLen).
//
// Returns { stem, origPrefix, results: [{ kind, prefix?, candidate?, lineIdx, category }] }.
export function findDifferentPrefixMatches(searchText, lang, lines, lineCategory, suffixOverlap) {
  const lc = (searchText || '').toLowerCase().trim()
  if (!lc) return { stem: '', origPrefix: '', results: [] }
  const prefixes = (COMMON_PREFIXES[lang] || COMMON_PREFIXES.sv)
    .slice().sort((a, b) => b.length - a.length)
  const { prefix: origPrefix, stem } = _stripPrefix(lc, prefixes)
  if (!stem || stem.length < 3) return { stem, origPrefix, results: [] }

  const seen = new Set()
  const results = []
  // (a) Different-prefix-same-stem matches.
  for (const p of prefixes) {
    if (p === origPrefix) continue
    const candidate = p + stem
    if (candidate.length < 4) continue
    lines.forEach((vocabLine, idx) => {
      if (seen.has(idx)) return
      if (typeof vocabLine !== 'string') return
      const parts = vocabLine.split(SEPARATOR_PIPE).map(s => s.toLowerCase().trim())
        .filter(s => s.length >= candidate.length)
      if (parts.some(part => part.startsWith(candidate))) {
        seen.add(idx)
        results.push({ kind: 'prefix', prefix: p, candidate, lineIdx: idx, category: lineCategory[idx] || '?' })
      }
    })
  }
  // (b) Weak overlap matches — pipe-segments that share a 2-char full-segment
  // suffix with the search (e.g. "äta|åt|ätit" hitting "gråt" via the bare
  // "åt" segment). Filtered from the main panel as noise but useful here.
  if (typeof suffixOverlap === 'function') {
    lines.forEach((vocabLine, idx) => {
      if (seen.has(idx)) return
      if (typeof vocabLine !== 'string') return
      if (suffixOverlap(vocabLine, lc) === 2) {
        seen.add(idx)
        results.push({ kind: 'overlap', lineIdx: idx, category: lineCategory[idx] || '?' })
      }
    })
  }
  return { stem, origPrefix, results }
}
