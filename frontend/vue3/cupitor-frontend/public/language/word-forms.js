// Vocabulary morphology is deliberately separate from subtitle fallback.
// Apply each stage once: genitive -> inflection -> derivation -> spelling.
// Recursively stripping every possible suffix loses meaningful consonants
// (matt / mat, släppa / släpa) and invents unrelated short roots.
import { guessStems } from './stemming.js'

export const normalizeWord = word => String(word || '').normalize('NFC').toLowerCase().trim()

const SV_INFLECTIONS = [
  ['arna', ['', 'a']], ['erna', ['']], ['orna', ['a']], ['aren', ['are']],
  ['ades', ['a', '']], ['ade', ['a', '']], ['ats', ['a', '']],
  ['aste', ['']], ['ast', ['']], ['at', ['a', '']], ['ad', ['a', '']],
  ['eln', ['el']], ['ern', ['er']], ['an', ['a', '']],
  ['ar', ['a', '']], ['or', ['a']], ['er', ['', 'a']],
  ['en', ['']], ['et', ['']], ['na', ['', 'en', 'et']],
  // -de can be a verb ending or a d-final adjective followed by -e.
  // Keep both readings: hörde -> hör, värde -> värd.
  ['de', ['', 'd']], ['te', ['']], ['t', ['']]
]
const SV_DERIVATIONS = [
  ['ande', ['a', '']], ['ende', ['a', '']], ['ning', ['', 'a']],
  ['else', ['', 'a']], ['are', ['']], ['eri', ['']], ['het', ['']],
  ['skap', ['']], ['ig', ['']], ['a', ['']]
]
const META_EXPANSIONS = new Set(['ngn', 'ngt', 'sig', 'sin', 'plats', 'ae', 'as', 'en', 'na', 'öta'])

function stripOnce(word, rules) {
  for (const [suffix, replacements] of rules) {
    if (!word.endsWith(suffix) || word.length - suffix.length < 3) continue
    if (suffix === 't' && word.endsWith('tt')) return []
    const base = word.slice(0, -suffix.length)
    return replacements.map(r => base + r)
  }
  return []
}

export function vocabularyForms(word, lang) {
  const w = normalizeWord(word)
  if (!w) return []
  if (!/^[\p{L}\p{M}]+$/u.test(w)) return [w]
  if (lang !== 'sv') return [...new Set([w, ...guessStems(w, lang)])]
  const seeds = new Set([w])
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) seeds.add(w.slice(0, -1))
  const inflections = new Set(seeds)
  for (const seed of seeds) for (const form of stripOnce(seed, SV_INFLECTIONS)) inflections.add(form)
  const forms = new Set(inflections)
  for (const form of inflections) for (const stem of stripOnce(form, SV_DERIVATIONS)) forms.add(stem)
  for (const form of [...forms]) {
    // hagel/hagl, fönster/fönstr, vatten/vattn, gammal/gaml.
    let reduced = form.replace(/([bcdfghjklmnpqrstvwxz])e([lnr])$/u, '$1$2')
    if (reduced === form) reduced = form.replace(/([mn])\1a([lnr])$/u, '$1$1$2')
    if (reduced === form || reduced.length < 3) continue
    forms.add(reduced)
    // Only undo doubling next to the consonant exposed by vowel deletion.
    // Never turn arbitrary doubled consonants into single ones.
    forms.add(reduced.replace(/([mn])\1(?=[lnr]$)/u, '$1'))
  }
  // Swedish past participles ending in -dd/-dda: beströdd(a) -> beströ.
  // This is deliberately limited to vowel-final stems so unrelated doubled
  // consonants elsewhere are not collapsed.
  for (const form of [...forms]) {
    const participle = form.match(/^(.{2,}[aeiouyåäö])dd$/u)
    if (participle && participle[1].length >= 3) forms.add(participle[1])
  }
  return [...forms]
}

// Per-index cache, including explicit lexical families from the user's
// expansion map. Placeholder/pronoun expansions are not lexical families.
export function createWordFormMatcher(lang, expansions = {}) {
  const aliases = new Map()
  if (lang === 'sv') {
    for (const [key, values] of Object.entries(expansions)) {
      const lemma = normalizeWord(key)
      if (lemma.length < 2 || META_EXPANSIONS.has(lemma) || !Array.isArray(values)) continue
      for (const value of [lemma, ...values]) {
        const form = normalizeWord(value)
        if (!/^[\p{L}\p{M}]{2,}$/u.test(form)) continue
        if (!aliases.has(form)) aliases.set(form, new Set())
        aliases.get(form).add('@' + lemma)
      }
    }
  }
  const cache = new Map()
  const forms = word => {
    const w = normalizeWord(word)
    if (!cache.has(w)) cache.set(w, new Set([...vocabularyForms(w, lang), ...(aliases.get(w) || [])]))
    return cache.get(w)
  }
  const related = (a, b) => {
    a = normalizeWord(a); b = normalizeWord(b)
    if (!a || !b) return false
    if (a === b) return true
    const right = forms(b)
    return [...forms(a)].some(form => (form.startsWith('@') || form.length >= 3) && right.has(form))
  }
  return { forms, related }
}
