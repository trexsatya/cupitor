// One vocabulary pipeline for ordinary findings and automatic/manual prefix
// search. Confidence controls ordering; an exact hit never suppresses families.
import { createWordFormMatcher, normalizeWord } from './word-forms.js'
import {
  stripBracketHints, stripExpansionMarkers, VOCAB_OVERLAP_STOP_WORDS,
  vocabPrefixOverlapDetail, isVocabularyStopWord
} from './vocab-search.js'
import { COMMON_PREFIXES } from './different-prefix.js'

const RANK = { exact: 4, token: 3, family: 2, compound: 1, prefix: 0 }
const termsOf = text => normalizeWord(stripExpansionMarkers(stripBracketHints(String(text || ''))))
  .split('|').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean)
const wordsOf = text => normalizeWord(text).match(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*/gu) || []
const containsPhrase = (phrase, query) => {
  const whole = wordsOf(phrase), wanted = wordsOf(query)
  return wanted.length > 0 && whole.some((_, i) => wanted.every((word, j) => whole[i + j] === word))
}

export function createVocabularyMatcher(vocabulary, {
  lang = 'sv', expandLine = line => line, expansions = {},
  hiddenCategories = new Set(['expansions', 'Expansions', '_expansions'])
} = {}) {
  const forms = createWordFormMatcher(lang, expansions)
  const prepared = new Map()
  const prepare = raw => {
    if (!prepared.has(raw)) {
      const phrases = termsOf(expandLine(raw))
      prepared.set(raw, { phrases, words: [...new Set(phrases.flatMap(wordsOf))] })
    }
    return prepared.get(raw)
  }
  const rows = []
  for (const [category, lines] of Object.entries(vocabulary || {})) {
    if (hiddenCategories.has(category) || !Array.isArray(lines)) continue
    for (const line of lines) {
      if (typeof line !== 'string') continue
      rows.push({ line, category, index: rows.length, ...prepare(line) })
    }
  }
  const known = new Set(rows.flatMap(row => row.words).filter(w => w.length >= 3 && !VOCAB_OVERLAP_STOP_WORDS.has(w)))
  const knownByForm = new Map()
  for (const word of known) {
    for (const form of forms.forms(word)) {
      if (form.length < 3) continue
      if (!knownByForm.has(form)) knownByForm.set(form, new Set())
      knownByForm.get(form).add(word)
    }
  }
  const derivationalPrefixes = new Set(COMMON_PREFIXES.sv)
  const recognized = word => !isVocabularyStopWord(word) && [...forms.forms(word)].some(form => knownByForm.has(form))
  const compoundCache = new Map()
  const coverageCache = new Map()
  const supportedCoverage = parts => parts.reduce((n, part) => {
    if (!coverageCache.has(part)) {
      // A whole vocabulary word or its normalized form is stronger evidence
      // than merely sharing an inferred root with a longer vocabulary word.
      coverageCache.set(part, [...forms.forms(part)].some(form => known.has(form)) ? part.length : 0)
    }
    return n + coverageCache.get(part)
  }, 0)
  const bestSplit = candidates => candidates.sort((a, b) => supportedCoverage(b) - supportedCoverage(a) || a.length - b.length)[0] || []
  // Unlike the old greedy fragment scan, every character must be accounted
  // for by known constituents. A known/inflected right half is allowed, but
  // a derivational prefix such as över- is not a compound word by itself.
  function compoundParts(word) {
    if (word.length < 6 || word.length > 64) return []
    if (compoundCache.has(word)) return compoundCache.get(word)
    const candidates = []
    for (let i = 3; i <= word.length - 3; i++) {
      const left = word.slice(0, i)
      if (!recognized(left) || [...forms.forms(left)].some(f => derivationalPrefixes.has(f))) continue
      for (const right of [word.slice(i), word[i] === 's' ? word.slice(i + 1) : '']) {
        if (right.length < 3) continue
        if (recognized(right)) candidates.push([left, right])
        const rest = compoundParts(right)
        if (rest.length) candidates.push([left, ...rest])
      }
    }
    // Compare complete segmentations by how much vocabulary-backed text they
    // preserve, then prefer fewer pieces when the evidence is tied. Choosing
    // the first split, or always choosing two pieces, can promote inferred
    // root fragments over complete words. Memoizing each suffix bounds the
    // search without imposing an arbitrary limit on the number of parts.
    const result = bestSplit(candidates)
    compoundCache.set(word, result)
    return result
  }
  function constituents(word) {
    const normalizedBases = [...forms.forms(word)].filter(form => form !== word && known.has(form))
    // A recognized ending belongs to its base word before it can be mistaken
    // for a separate constituent (sprakande -> spraka, not sprak + ande).
    if (normalizedBases.length && !normalizedBases.some(base => compoundParts(base).length)) return []
    // Inflected/derived words already recognized as a whole must not be
    // reinterpreted as unrelated fragments (översittarens -> rensa, ens).
    if (!known.has(word) && recognized(word)) {
      const bases = new Set([...forms.forms(word)].flatMap(form => [...(knownByForm.get(form) || [])]))
      // Inflecting a known compound must not hide the same constituents that
      // are shown for its base. An ordinary word family still blocks the
      // unrelated suffix-fragment fallback below.
      if (![...bases].some(base => compoundParts(base).length)) return []
    }
    const complete = compoundParts(word)
    if (complete.length) return complete
    if (known.has(word)) return []
    // An unfamiliar modifier can still precede a known compound head.
    // Keep the longest complete head, never a nested two-letter suffix.
    for (let i = 3; i <= word.length - 3; i++) {
      const head = word.slice(i)
      if (recognized(head)) return [head]
    }
    return []
  }

  function matchPrepared(row, queryTerms, compounds) {
    for (const term of queryTerms) {
      if (row.phrases.includes(term) || (/\s/.test(term) && row.phrases.some(p => containsPhrase(p, term)))) {
        return { kind: 'exact', matched: term }
      }
    }
    const singles = queryTerms.filter(t => t.length >= 3 && !/\s/.test(t) && !VOCAB_OVERLAP_STOP_WORDS.has(t))
    for (const term of singles) if (row.words.includes(term)) return { kind: 'token', matched: term }
    for (const term of singles) {
      const word = row.words.find(w => !VOCAB_OVERLAP_STOP_WORDS.has(w) && forms.related(w, term))
      if (word) return { kind: 'family', matched: word }
    }
    for (const term of compounds) {
      const word = row.words.find(w => !VOCAB_OVERLAP_STOP_WORDS.has(w) && forms.related(w, term))
      if (word) return { kind: 'compound', matched: word, constituent: term }
    }
    return null
  }
  // Filter alternatives before the exact branch too. A useful alternative
  // does not give a common-word-only alternative permission to match.
  const queryTerms = query => termsOf(query).filter(term => !isVocabularyStopWord(term))
  const matchLine = (line, query) => matchPrepared(prepare(line), queryTerms(query), [])
  const search = (query, { includePrefix = false } = {}) => {
    const terms = queryTerms(query)
    if (!terms.length) return []
    const compounds = lang === 'sv'
      ? [...new Set(terms.filter(t => !/\s/.test(t)).flatMap(t => constituents(t)))]
        .filter(t => !terms.includes(t))
      : []
    const matches = []
    for (const row of rows) {
      let detail = matchPrepared(row, terms, compounds)
      if (!detail && includePrefix) {
        const overlap = vocabPrefixOverlapDetail(row.line, terms.join('|'), lang)
        if (overlap.len >= 3) detail = { ...overlap, kind: 'prefix' }
      }
      if (detail) matches.push({ ...row, ...detail, rank: RANK[detail.kind] })
    }
    return matches.sort((a, b) => b.rank - a.rank || (b.len || 0) - (a.len || 0) || a.index - b.index)
  }
  return { rows, search, matchLine }
}
