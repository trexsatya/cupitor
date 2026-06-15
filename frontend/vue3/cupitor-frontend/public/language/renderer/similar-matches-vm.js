// Pure VM helpers for the Similar Matches + Different Prefix dialogs.
// Just the label/class mapping and the header-text shaping — the actual
// DOM rendering still happens in language.js because it's tangled with
// `_buildVocabLine`, the accordion delegate, and click handlers that
// reach into app state. Those will move out in their own slice once
// `_buildVocabLine` is itself extracted.
//
// What lives here:
//   * tier → human label, css class
//   * "≈ X ↔ Y (label) — N line(s)" header builder for similar groups
//   * different-prefix dialog header text builder

import { scoreSimilarity } from '../similarity.js'   // re-exported as convenience

// `tier` is the 0-3 scale returned by ./similarity.js#scoreSimilarity.
// 0 = phonetic / homophone, 1 = vowel diff OR compound, 2 = consonant
// diff, 3 = edit distance (1 or 2). `distance` is the edit distance for
// tier 3, ignored otherwise.
export function tierLabel(tier, distance) {
  if (tier === 0) return 'homophone'
  if (tier === 1) return 'vowel diff'
  if (tier === 2) return 'consonant diff'
  return `edit dist ${distance}`
}

export function tierClass(tier, distance) {
  if (tier === 0) return 'similar-tier-0'
  if (tier === 1) return 'similar-tier-1'
  if (tier === 2) return 'similar-tier-2'
  return `similar-tier-3-d${distance}`
}

// Header text for a candidate-grouped block: "≈ <candidate> ↔ <searchWord>
// (<tierLabel>) — N line(s)". Returns a plain object so the renderer can
// decide how to mark up the candidate (the original code wraps it in
// <b>).
export function similarGroupHeader(group) {
  const { bestMatch, lines, candidate } = group
  return {
    candidate,
    searchWord: bestMatch.searchWord,
    label: tierLabel(bestMatch.tier, bestMatch.distance),
    lineCount: lines.length,
    plural: lines.length === 1 ? '' : 's',
    tierClass: tierClass(bestMatch.tier, bestMatch.distance),
  }
}

// Header text for a per-line similar match (collapsible or not): the
// "[Category] ≈ <candidate> ↔ <searchWord> (<tierLabel>)" bit.
export function similarSegmentHeader({ category, candidate, searchWord, tier, distance }) {
  return {
    category: category || '?',
    candidate,
    searchWord,
    label: tierLabel(tier, distance),
    tierClass: tierClass(tier, distance),
  }
}

// Header text for the Different-Prefix dialog: stem + original prefix
// (if any) + the typed search. Returns plain text fields the renderer
// composes into HTML.
export function diffPrefixHeader({ stem, origPrefix, searchText }) {
  return {
    stem: stem || '?',
    origPrefix: origPrefix || '',
    searchText: searchText || '',
  }
}

// Badge text for a different-prefix result row: "(för-)" for prefix
// matches, "(suffix overlap)" otherwise. Always includes the category
// in brackets before the badge.
export function diffPrefixRowBadge({ kind, prefix, category }) {
  return {
    category: category || '?',
    badge: kind === 'prefix' ? `(${prefix}-)` : '(suffix overlap)',
  }
}

// Re-export so the renderer can ask "is this candidate similar to that
// search?" without a separate import line.
export { scoreSimilarity }
