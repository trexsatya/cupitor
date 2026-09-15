// Pure HTML-string highlight helpers extracted from language.js.
//
//   highlightWordInLine(text, word)
//     Wrap every (case-insensitive, whole-word) occurrence of `word` in
//     `text` with a bold-blue <b>. Caller must have already HTML-escaped
//     `text` because the regex preserves whatever it finds.
//
//   highlightSearchInVocabLine(rawText, searchText, opts)
//     Render a vocab line (raw, possibly pipe-separated) with the portion
//     of each |-segment that prefix-or-suffix overlaps with the search
//     wrapped in <mark class="vocab-hl">. Walks each segment and each
//     whitespace-separated word inside it so multi-word entries (e.g. "Rik
//     som ett troll") can highlight a single token. `opts.exactPrefix`
//     flips to strict mode: only highlight when a search part is FULLY a
//     prefix-or-suffix of the segment (used by the Different-prefixes
//     dialog so candidates like "förråt" don't grab "förrå" of "förråd").
//     `opts.stripBracketHints(text) -> text` removes "(sl-pl)", "(ngt)",
//     etc. — defaults to identity. Pass language.js's `removeHintsInBrackets`
//     for production behaviour.
//
//   highlightStemInPrefixMatch(rawText, candidate, stem, opts)
//     Render a vocab line, marking only the `stem` slice of each segment
//     that fully starts with `candidate` (= newPrefix + stem). Used by
//     the Different-prefixes dialog so the user-typed stem is what reads
//     as the match in matched segments like "förråta" / "förrått".
//     `opts.stripBracketHints` same contract as above.

import { SEPARATOR_PIPE, stripExpansionMarkers, stripExpansionMarkersWithMap } from './vocab-search.js'

// HTML escape matching lodash `_.escape` (&<>"' → entities).
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function highlightWordInLine(text, word) {
  if (!word) return text
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // \b doesn't behave nicely with Unicode (Swedish å/ä/ö); use lookarounds
  // around \p{L} so a candidate "växa" only highlights the whole word, not
  // a substring inside e.g. "växande". Falls back to plain match if the
  // engine doesn't support it.
  let re
  try {
    re = new RegExp(`(?<![\\p{L}])(${escaped})(?![\\p{L}])`, 'giu')
  } catch (_) {
    re = new RegExp(`(${escaped})`, 'gi')
  }
  return text.replace(re, '<b style="color:#1565c0">$1</b>')
}

function _resolveStripper(opts) {
  return typeof opts.stripBracketHints === 'function' ? opts.stripBracketHints : (s => s)
}

export function highlightSearchInVocabLine(rawText, searchText, opts = {}) {
  const exactPrefix = opts.exactPrefix === true
  const stripBracketHints = _resolveStripper(opts)
  if (!rawText) return ''
  if (!searchText) return escapeHtml(rawText).replaceAll(SEPARATOR_PIPE, ' | ')
  const searchParts = String(searchText).toLowerCase()
    .split(SEPARATOR_PIPE).map(s => s.trim()).filter(s => s.length >= 3)
  if (!searchParts.length) return escapeHtml(rawText).replaceAll(SEPARATOR_PIPE, ' | ')

  const segments = String(rawText).split(SEPARATOR_PIPE)
  const html = segments.map(seg => {
    // Work against a marker-free view of the segment ("för<*se" → "förse"),
    // keeping `markMap` so the final offsets land back on the raw text. The
    // matchers join across `<*` too, so without this every line they newly
    // surface would render with nothing marked.
    const { text: segNoMark, map: markMap } = stripExpansionMarkersWithMap(seg)
    let stripped
    try { stripped = stripExpansionMarkers(stripBracketHints(seg.toLowerCase())).trim() }
    catch (_) { stripped = segNoMark.toLowerCase().trim() }
    if (stripped.length < 2) return escapeHtml(seg)
    const segLower = segNoMark.toLowerCase()

    // Candidate tokens: the whole stripped segment, plus each whitespace-
    // separated word inside it (so multi-word lines like "Rik som ett troll"
    // can match the single token "troll").
    const candidates = []
    const fullIdx = segLower.indexOf(stripped)
    if (fullIdx >= 0) candidates.push({ token: stripped, idx: fullIdx })
    if (/\s/.test(stripped)) {
      let cursor = 0
      for (const w of stripped.split(/\s+/)) {
        if (w.length < 2) continue
        const wIdx = segLower.indexOf(w, cursor)
        if (wIdx < 0) continue
        candidates.push({ token: w, idx: wIdx })
        cursor = wIdx + w.length
      }
    }

    // Pick the longest prefix-OR-suffix overlap across all (token, search)
    // pairs. Default mode accepts when:
    //   • overlap >= 3, OR
    //   • overlap === token.length  (whole token matched — covers tiny
    //     full-token hits like "åt" matching "gråt" via its 2-char suffix;
    //     a 2-char overlap that's only PART of a longer token is noise).
    // exactPrefix mode further requires overlap === bestSearch.length.
    let bestLen = 0
    let bestKind = null
    let bestSearch = null
    let bestToken = null
    let bestTokenIdx = -1
    for (const { token, idx: tokIdx } of candidates) {
      for (const s of searchParts) {
        const lenP = Math.min(token.length, s.length)
        let lcp = 0
        while (lcp < lenP && token.charCodeAt(lcp) === s.charCodeAt(lcp)) lcp++
        if (lcp > bestLen) {
          bestLen = lcp; bestKind = 'prefix'; bestSearch = s
          bestToken = token; bestTokenIdx = tokIdx
        }
        let lcs = 0
        while (lcs < lenP && token.charCodeAt(token.length - 1 - lcs) === s.charCodeAt(s.length - 1 - lcs)) lcs++
        if (lcs > bestLen) {
          bestLen = lcs; bestKind = 'suffix'; bestSearch = s
          bestToken = token; bestTokenIdx = tokIdx
        }
      }
    }
    if (bestLen < 2) return escapeHtml(seg)
    const isFullToken = bestToken && bestLen === bestToken.length
    const isFullSearch = bestSearch && bestLen === bestSearch.length
    if (exactPrefix) {
      if (!isFullSearch) return escapeHtml(seg)
    } else {
      if (bestLen < 3 && !isFullToken) return escapeHtml(seg)
    }

    const markStart = bestKind === 'prefix' ? bestTokenIdx : bestTokenIdx + bestToken.length - bestLen
    const markEnd = markStart + bestLen
    // Back to raw-text offsets. A span that straddles a marker swallows it,
    // which is right: the marker is part of how that word is written.
    const rawStart = markMap[markStart]
    const rawEnd = markMap[markEnd - 1] + 1
    if (rawStart === undefined || !(rawEnd > rawStart)) return escapeHtml(seg)
    return escapeHtml(seg.slice(0, rawStart)) +
           '<mark class="vocab-hl">' + escapeHtml(seg.slice(rawStart, rawEnd)) + '</mark>' +
           escapeHtml(seg.slice(rawEnd))
  })
  return html.join(' | ')
}

export function highlightStemInPrefixMatch(rawText, candidate, stem, opts = {}) {
  const stripBracketHints = _resolveStripper(opts)
  if (!rawText) return ''
  if (!candidate || !stem) return escapeHtml(rawText).replaceAll(SEPARATOR_PIPE, ' | ')
  const candLower = String(candidate).toLowerCase()
  const stemLen = stem.length
  const stemOffsetInCand = candidate.length - stemLen
  if (stemOffsetInCand < 0) return escapeHtml(rawText).replaceAll(SEPARATOR_PIPE, ' | ')
  const segments = String(rawText).split(SEPARATOR_PIPE)
  const html = segments.map(seg => {
    // Same marker-free view + position map as highlightSearchInVocabLine —
    // the Different-prefixes dialog matches "förtränga" against "för<*tränga".
    const { text: segNoMark, map: markMap } = stripExpansionMarkersWithMap(seg)
    let stripped
    try { stripped = stripExpansionMarkers(stripBracketHints(seg.toLowerCase())).trim() }
    catch (_) { stripped = segNoMark.toLowerCase().trim() }
    if (!stripped.startsWith(candLower)) return escapeHtml(seg)
    const segLower = segNoMark.toLowerCase()
    const candIdx = segLower.indexOf(candLower)
    if (candIdx < 0) return escapeHtml(seg)
    const stemIdx = candIdx + stemOffsetInCand
    const rawStart = markMap[stemIdx]
    const rawEnd = markMap[stemIdx + stemLen - 1] + 1
    if (rawStart === undefined || !(rawEnd > rawStart)) return escapeHtml(seg)
    return escapeHtml(seg.slice(0, rawStart)) +
           '<mark class="vocab-hl">' + escapeHtml(seg.slice(rawStart, rawEnd)) + '</mark>' +
           escapeHtml(seg.slice(rawEnd))
  })
  return html.join(' | ')
}
