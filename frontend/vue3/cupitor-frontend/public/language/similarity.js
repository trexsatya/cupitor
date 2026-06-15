// Pure similarity-search helpers extracted from language.js. Used by
// "find similar-looking words in the vocabulary" — phonetic key + small
// edit distance + compound-overlap detection. Language-aware where it
// makes a difference (Swedish sj/tj/k sounds, Spanish ll/v/c, etc.).

export const SIMILARITY_VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y', 'å', 'ä', 'ö'])

export function isVowel(ch) {
  return SIMILARITY_VOWELS.has((ch || '').toLowerCase())
}

// Compare two equal-length strings: returns {count, allVowel, allConsonant}
// where flags are true only when ALL differing positions are of that class.
// allVowel/allConsonant are false when count === 0 (no differences).
export function classifyCharDiffs(a, b) {
  let count = 0, allVowel = true, allConsonant = true
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue
    count++
    const aV = isVowel(a[i]), bV = isVowel(b[i])
    if (!aV || !bV) allVowel = false
    if (aV || bV) allConsonant = false
  }
  return { count, allVowel: allVowel && count > 0, allConsonant: allConsonant && count > 0 }
}

// Standard Levenshtein, two-row rolling implementation.
export function levenshtein(a, b) {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = new Array(n + 1)
  let curr = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    const tmp = prev; prev = curr; curr = tmp
  }
  return prev[n]
}

// Map a word to a coarse phonetic key for the given language. Two words are
// candidate homophones (in this app's sense) when they reduce to the same
// key. Rules are intentionally conservative — false positives only show up
// in the most prominent tier 0, so the substitutions stick to spellings
// that genuinely overlap in pronunciation.
export function phoneticKey(word, lang) {
  if (!word) return ''
  let w = word.toLowerCase()
  try { w = w.normalize('NFC') } catch (_) {}

  if (lang === 'sv') {
    // /ɧ/ family — sj-sound. Order matters: longer patterns first.
    w = w.replace(/skj|stj|ssj|sch/g, 'Ç')
    w = w.replace(/sj/g, 'Ç')
    w = w.replace(/sk(?=[eiyäö])/g, 'Ç')
    // /ɕ/ family — tj-sound.
    w = w.replace(/tj|kj/g, 'C')
    w = w.replace(/k(?=[eiyäö])/g, 'C')
    // /j/ family — silent-letter onsets, soft g, plain j.
    w = w.replace(/gj|hj|lj|dj/g, 'J')
    w = w.replace(/g(?=[eiyäö])/g, 'J')
    w = w.replace(/j/g, 'J')
    // c before front vowels = /s/, otherwise = /k/.
    w = w.replace(/c(?=[eiyäö])/g, 's')
    w = w.replace(/c/g, 'k')
    // Misc.
    w = w.replace(/w/g, 'v')
    w = w.replace(/ng/g, 'N')
    w = w.replace(/ck/g, 'k')
    w = w.replace(/qu/g, 'kv')
    w = w.replace(/x/g, 'ks')
    w = w.replace(/z/g, 's')
  } else if (lang === 'en') {
    w = w.replace(/ph/g, 'f')
    w = w.replace(/^(kn|gn|pn|wr)/g, m => m[1])  // silent leading letter
    w = w.replace(/ck/g, 'k')
    w = w.replace(/qu/g, 'kw')
    w = w.replace(/c(?=[eiy])/g, 's')
    w = w.replace(/c/g, 'k')
    w = w.replace(/^x/g, 'z')
    w = w.replace(/x/g, 'ks')
  } else if (lang === 'es') {
    w = w.replace(/ll/g, 'y')
    w = w.replace(/h/g, '')
    w = w.replace(/v/g, 'b')
    w = w.replace(/qu(?=[ei])/g, 'k')
    w = w.replace(/qu/g, 'kw')
    w = w.replace(/c(?=[ei])/g, 's')
    w = w.replace(/z/g, 's')
    w = w.replace(/c/g, 'k')
    w = w.replace(/g(?=[ei])/g, 'x')
    w = w.replace(/j/g, 'x')
  }
  return w
}

// Compound match: shorter word appears at the start or end of the longer
// one. Minimum 4-char shorter avoids spurious 2/3-letter substring noise
// ("is" inside dozens of unrelated words). Returns the length gap so the
// caller can rank tight compounds above sprawling ones; 0 means no match.
export function compoundOverlap(a, b) {
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length < 4 || longer.length === shorter.length) return 0
  if (longer.startsWith(shorter) || longer.endsWith(shorter)) {
    return longer.length - shorter.length
  }
  return 0
}

// Tier 0: phonetic key match (language-aware homophone).
// Tier 1: same length, exactly one differing char that's vowel-vs-vowel,
//         OR compound match (e.g. "gnista" ⊂ "livsgnista").
// Tier 2: same length, exactly one differing char that's consonant-vs-consonant.
// Tier 3: edit distance ≤ 2 (and > 0). Returns null if not similar enough.
export function scoreSimilarity(searchWord, candidate, lang) {
  if (!searchWord || !candidate || searchWord === candidate) return null
  const sk = phoneticKey(searchWord, lang)
  const ck = phoneticKey(candidate, lang)
  if (sk && sk === ck) return { tier: 0, distance: 0 }
  if (searchWord.length === candidate.length) {
    const diff = classifyCharDiffs(searchWord, candidate)
    if (diff.count === 1 && diff.allVowel) return { tier: 1, distance: 1 }
    if (diff.count === 1 && diff.allConsonant) return { tier: 2, distance: 1 }
  }
  const gap = compoundOverlap(searchWord, candidate)
  if (gap > 0) return { tier: 1, distance: gap }
  const d = levenshtein(searchWord, candidate)
  if (d > 0 && d <= 2) return { tier: 3, distance: d }
  return null
}
