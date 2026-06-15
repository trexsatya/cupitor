// Per-language suffix rules used by guessStems(). Each entry is
// [suffix, replacements]: if the input word ends in `suffix` and stripping
// it leaves at least 3 chars, each `replacement` is appended to produce a
// candidate stem. Rules are tried top-down and the first matching suffix
// wins (longer/more-specific rules come first within each language).
//
// Examples:
//   "förvärvat" + Swedish 'at' → 'a'  → "förvärva"
//   "knassiga"  + Swedish 'a'  → ''   → "knassig"
//   "running"   + English 'ing'→ ''/'e'→ "runn" / "runne" (loose, no orthography)
//   "casas"     + Spanish 'as' → 'a'  → "casa"
export const STEM_RULES = {
  sv: [
    ['ningarna', ['']],
    ['ningar', ['']],
    ['ningen', ['']],
    ['ning', ['']],
    ['ande', ['a']],
    ['ende', ['a']],
    ['arna', ['a', '']],
    ['erna', ['']],
    ['orna', ['a']],
    ['ades', ['a']],
    ['ade', ['a']],
    ['ats', ['a']],
    ['at', ['a']],
    // Past participle: "förvärvad" → "förvärva" (group 1/4) or root "förvärv".
    ['ad', ['a', '']],
    ['ång', ['å']],
    ['else', ['a']],
    ['elser', ['a']],
    // Group-3 supinum ("köpit" → "köpa") and past participle "köpt" → "köpa".
    ['it', ['a']],
    ['arn', ['are']],
    ['ar', ['a', '']],
    ['na', ['en', 'et']],
    ['or', ['a']],
    ['er', ['', 'a']],
    ['en', ['']],
    ['et', ['']],
    ['de', ['']],
    ['te', ['']],
    ['ts', ['']],
    ['s', ['']],
    ['et', ['en']],
    ['en', ['et']],
    ['t', ['a', 'd', '']], // "köpt" → "köpa" or root "köp"; "förvärvat" → "förvärva" or root "förvärv".
    ['a', ['']],           // edge case: "knassiga" → "knassig" or root "knass".
  ],
  es: [
    ['iendo', ['er', 'ir']],
    ['yendo', ['er', 'ir']],
    ['ando', ['ar']],
    ['ieron', ['er', 'ir']],
    ['aron', ['ar']],
    ['aban', ['ar']],
    ['aba', ['ar']],
    ['amos', ['ar']],
    ['emos', ['er']],
    ['imos', ['ir']],
    ['aste', ['ar']],
    ['iste', ['er', 'ir']],
    ['ado', ['ar']],
    ['ido', ['er', 'ir']],
    ['ías', ['er', 'ir']],
    ['ía', ['er', 'ir']],
    ['es', ['']],
    ['as', ['a']],
    ['os', ['o']],
    ['s', ['']],
  ],
  en: [
    ['ational', ['ate']],
    ['tional', ['tion']],
    ['ization', ['ize']],
    ['ations', ['ate']],
    ['ation', ['ate', '']],
    ['ments', ['ment']],
    ['ment', ['']],
    ['ness', ['']],
    ['ously', ['ous']],
    ['fully', ['ful']],
    ['sses', ['ss']],
    ['ies', ['y']],
    ['ied', ['y']],
    ['ying', ['y']],
    ['ing', ['', 'e']],
    ['edly', ['', 'e']],
    ['ed', ['', 'e']],
    ['ly', ['']],
    ['est', ['', 'e']],
    ['er', ['', 'e']],
    ['es', ['e', '']],
    ['s', ['']],
  ],
}

// Generate possible stems of `word` for the given language code.
// Returns [] when the word is too short or no rule matches. Duplicates and
// the input word itself are filtered out.
export function guessStems(word, lang) {
  if (!word) return []
  const w = word.toLowerCase().trim()
  if (w.length < 4) return []
  const langRules = STEM_RULES[lang]
  if (!langRules) return []
  const stems = []
  for (const [suffix, repls] of langRules) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
      const base = w.slice(0, w.length - suffix.length)
      for (const r of repls) {
        const s = base + r
        if (s !== w) stems.push(s)
      }
      break
    }
  }
  // Deduplicate while preserving first-seen order (matters for tests).
  const seen = new Set()
  const out = []
  for (const s of stems) {
    if (!seen.has(s)) { seen.add(s); out.push(s) }
  }
  return out
}
