// Pure search-text helpers extracted from language.js. No DOM, no
// lodash, no window globals — callers that need to read window.searchText
// / window.allSubtitles pass them in as arguments. Lodash equivalents
// (`_.trim`, `_.uniq`, `_.includes`, `_.sortBy`, `_.remove`) are inlined
// as native JS so the module stays standalone.

import { SEPARATOR_PIPE } from './vocab-search.js'

// Split a paragraph into sentence-strings using Intl.Segmenter. Filters
// out fragments shorter than 2 chars (lone punctuation / whitespace
// remnants from upstream cleanup).
export function splitSentences(text) {
  const segmentor = new Intl.Segmenter([], { granularity: 'sentence' })
  const segmentedText = segmentor.segment(text)
  return Array.from(segmentedText, ({ segment }) => segment).filter(it => it.trim().length > 1)
}

// Chunk `text` into pieces no longer than `maxChars` by greedily appending
// whole sentences to the current chunk until the next sentence would push
// it over the limit. Each chunk ends with a trailing space.
//
// Note: walks the Intl.Segmenter output where `type === 'Sentence'` — the
// segmenter returns each sentence as a SegmentData with .raw set to the
// original substring. Other segment kinds (whitespace, separators) are
// skipped automatically.
export function chunkifySentence(text, maxChars) {
  const res = []
  let current = ''
  const sentences = splitSentences(text).filter(it => it.type === 'Sentence')
  for (let i = 0; i < sentences.length; i++) {
    const w = sentences[i].raw
    if (current.length + w.length >= maxChars) {
      res.push(current)
      current = w + ' '
    } else {
      current += (w + ' ')
    }
  }
  res.push(current)
  return res
}

// Tokenise `text` into Intl.Segmenter words. Filters out bare `|` tokens
// (the project's pipe-separator) so downstream callers can treat the list
// as pure content tokens.
export function getWords(text) {
  const segmentor = new Intl.Segmenter([], { granularity: 'word' })
  const segmentedText = segmentor.segment(text)
  return Array.from(segmentedText, ({ segment }) => segment).filter(it => it.trim() !== '|')
}

// Substitute the project's two pronoun macros in a user-supplied regex:
//   *ngn → (jag|du|han|hon|ni|de|vi|dom)   subject pronouns
//   *sig → (mig|dig|honom|henne|er|sig)    reflexive pronouns
export function expandRegex(txt) {
  txt = txt.replaceAll('*ngn', '(jag|du|han|hon|ni|de|vi|dom)')
  txt = txt.replaceAll('*sig', '(mig|dig|honom|henne|er|sig)')
  return txt
}

// Word characters for the boundary lookarounds: ASCII word chars PLUS the
// Latin-1 letters (À-Ö, Ø-ö, ø-ÿ — excludes the × and ÷ signs). Crucially this
// includes Swedish å/ä/ö and other accents, so a match can't straddle them:
// "vits" must not match inside "vitså", nor "fors" inside "töksfors". We spell
// the class out (rather than \p{L}) so it works WITHOUT the /u flag — callers
// compile with just "i", and adding /u would reject their hand-written regex.
const WORD_CHAR = 'A-Za-z0-9_À-ÖØ-öø-ÿ'

// Wrap a search pattern in regex word boundaries so a multi-word phrase
// like "ta efter" doesn't match inside "tänkta efter" / "leta efter", and a
// single word doesn't match inside a longer (possibly accented) word. Uses
// letter-class lookarounds rather than \b because Swedish å/ä/ö are non-\w in
// JS — \b would put a boundary inside a Swedish word. Patterns the user
// explicitly padded with whitespace (their convention for literal-space
// prefix/suffix matching) are left alone.
export function withWordBoundaries(pattern) {
  if (!pattern) return pattern
  if (/^\s|\s$/.test(pattern)) return pattern
  return `(?<![${WORD_CHAR}])(?:${pattern})(?![${WORD_CHAR}])`
}

// Treat any run of literal spaces in a user-supplied pattern as `\s+`, so
// the search is whitespace-insensitive — "a b", "a  b" and "a\nb" all
// match the user's "a b" query.
export function relaxSpaces(pattern) {
  return String(pattern || '').replace(/ +/g, '\\s+')
}

// Heuristic: does `text` look like a regex (contain '.', '*', or '?')?
// Cheap pre-filter so the search pipeline knows when to compile a regex
// vs do plain string contains.
export function isRegExp(text) {
  if (!text) return false
  return ['.', '*', '?'].some(it => text.includes(it))
}

// Slice a window of size `2*size+1` centered on the entry with the given
// `index` field. Returns [] when no element matches. Each returned
// element is wrapped in {item, index: positionInOriginalList}.
export function getSurrounding(index, list, size = 5) {
  const wrapped = list.map((item, i) => ({ item, index: i }))
  const idx = wrapped.findIndex(it => it.index === index)
  if (idx < 0) return []
  return wrapped.slice(Math.max(0, idx - size), Math.min(wrapped.length, idx + (size + 1)))
}

// Strip the SRT-specific scaffolding (entry numbers, time-arrow lines)
// before running text-match heuristics — so a search like "subtitle"
// doesn't accidentally hit "00:00:01,500 --> 00:00:03,000". Returns the
// flattened body text as a single whitespace-collapsed line.
export function cleanSrtForMatch(rawSrt) {
  if (!rawSrt) return ''
  return rawSrt
    .replace(/^\d+\s*$/gm, '')
    .replace(/^\d\d:\d\d:\d\d[,.]\d{3} --> \d\d:\d\d:\d\d[,.]\d{3}.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Parse a `|`-separated user search into deduped, bracket-hint-stripped
// terms with original leading/trailing whitespace preserved (the user's
// convention for literal-space prefix/suffix matching). `searchText` is
// expected to be a string — caller resolves a falsy value to '' itself.
// `stripBracketHints(s) -> s` is the only DI dep; pass language.js's
// `removeHintsInBrackets` for production behaviour. Defaults to identity.
export function getSearchedTerms(searchText, stripBracketHints = (s => s)) {
  if (!searchText) return []
  const trimPipe = (s) => {
    let start = 0, end = s.length
    while (start < end && s[start] === SEPARATOR_PIPE) start++
    while (end > start && s[end - 1] === SEPARATOR_PIPE) end--
    return s.slice(start, end)
  }
  const raw = trimPipe(String(searchText).toLowerCase())
  const terms = raw
    .split(SEPARATOR_PIPE)
    .filter(it => it.trim().length > 0)
    .map(stripBracketHints)
    .map(it => {
      const leftSpace = it.startsWith(' '), rightSpace = it.endsWith(' ')
      const w = it.trim()
      return (leftSpace ? ' ' : '') + w + (rightSpace ? ' ' : '')
    })
    .filter(Boolean)
  return [...new Set(terms)]
}

// Re-order `words` so the live search term goes first, then exact-term
// matches from getSearchedTerms, then prefix/suffix-related words sorted
// shortest-first, then everything else. Used to rank result-grouping
// headings so the most-on-target group sits at the top.
//
// MUTATES `words`. Returns a deduped ordered array.
export function getWordsOrdered(words, searchText, stripBracketHints = (s => s)) {
  let ordered = [searchText]
  const removeFrom = (arr, pred) => {
    const removed = []
    for (let i = arr.length - 1; i >= 0; i--) {
      if (pred(arr[i])) { removed.unshift(arr[i]); arr.splice(i, 1) }
    }
    return removed
  }

  removeFrom(words, it => it === searchText)

  const searched = getSearchedTerms(searchText, stripBracketHints)
  searched.forEach(w => {
    if (removeFrom(words, it => it.trim() === w.trim()).length) {
      ordered.push(w.trim())
    }
  })

  const relatedWords = (predicate) => {
    let found = words.filter(predicate)
    if (found.length) {
      found = found.slice().sort((a, b) => a.length - b.length)
      ordered = ordered.concat(found)
      removeFrom(words, it => found.includes(it))
    }
  }

  searched.forEach(w => {
    relatedWords(it => it.trim().startsWith(w.trim()))
    relatedWords(it => it.trim().endsWith(w.trim()))
  })

  words.filter(it => !ordered.includes(it)).forEach(it => ordered.push(it))
  return [...new Set(ordered)]
}

// Substring scan across an arbitrary subtitle map. `allSubtitles` is the
// raw `window.allSubtitles` object (keys: link/url; values: per-language
// subtitle records). Returns the matching values from the `key` column
// (defaults to 'sv').
export function searchSubtitleText(allSubtitles, text, key = 'sv') {
  return Object.values(allSubtitles || {})
    .map(it => it && it[key])
    .filter(it => typeof it === 'string' && it.includes(text))
}

// Project subtitle search results down to the selected-language subs,
// dropping rows that didn't match in that language. `selectedLang` is
// 'sv' | 'en'.
export function filterByLanguage(searchResults, selectedLang) {
  return (searchResults || []).map(it => {
    if (selectedLang === 'sv' && it.sv_match) return it.sv_subs
    if (selectedLang === 'en' && it.en_match) return it.en_subs
    return null
  }).filter(Boolean)
}

// Strict word-level match: does `search` appear as a whole token in the
// vocab line? Tokens are extracted by Intl.Segmenter; multi-word search
// phrases (containing a space) fall back to a case-insensitive substring
// check against the raw vocab line so canned phrases like "göra susen"
// still match a multi-word expression. Tolerant to garbage input — any
// exception is swallowed and returns false.
export function wordIsExactInVocabularyLine(vocabLine, search, strict=false) {
  try {
    // A vocab line is a set of `|`-separated PHRASES — each often multi-word
    // like "göra susen" — optionally carrying bracket hints ("(do something)",
    // or inline "stor(t)"). The phrases are the matching unit, NOT word-tokens:
    // splitting into words (the old getWords approach) let a component word of a
    // multi-word phrase falsely match ("susen" hitting "göra susen"), and a
    // superword swallow a shorter one. Callers with the expansion map pass the
    // line through expandWords first so inflected forms are covered too.
    const stripHints = (str) => {
      let r = String(str)
      while (/\([^()]*\)/.test(r)) r = r.replace(/\([^()]*\)/, '')
      return r
    }
    const phrases = String(vocabLine == null ? '' : vocabLine)
      .split(SEPARATOR_PIPE)
      .map(p => stripHints(p).trim().toLowerCase())
      .filter(Boolean)
    if (!phrases.length) return false
    const s = (search || '').toLowerCase().trim()
    if (!s) return false
    const terms = s.split(SEPARATOR_PIPE).map(t => t.trim()).filter(Boolean)
    for (const t of terms) {
      if (phrases.includes(t)) return true                          // exact phrase
      // Non-strict recall: a MULTI-WORD search term may substring-match inside a
      // phrase (e.g. "göra susen" inside the phrase "att göra susen igen"). A
      // bare single word never substring-matches — that's the whole point.
      if (!strict && t.indexOf(' ') > 0 && phrases.some(p => p.includes(t))) return true
    }
    return false
  } catch (_) {
    return false
  }
}

// Decide how a "search this word" action (the Player / Practice 🔎 button)
// should reflect `word` in the vocabulary picker. `options` are the candidate
// picker entries, each `{ text, category }` where `text` is a possibly
// `|`-separated vocab line like "sven|svenner|…" and `category` is that line's
// vocabulary category (or null/unknown). `category` (3rd arg) is the CONTEXT
// category to prefer — e.g. the category of the playlist being played.
//
// Returns { index, showAll }:
//   • index >= 0  → select that single option (narrows the search to that line)
//   • showAll:true (index -1) → don't narrow; leave the broad phrase search
//     showing every matching line.
//
// Rules:
//   • No exact whole-word match → fall back to the first whole-word-contains
//     option, then the first substring match (so a word still anchors on
//     something); index -1 only if nothing matches at all.
//   • Exactly one exact match → select it (so "sven" selects "sven|svenner|…"
//     and NOT the superword "körsven|…" that merely contains it).
//   • More than one exact match → disambiguate by the context category:
//       – context category given AND exactly one exact match is in it → select
//         that one.
//       – otherwise (no context category, it matches none, or it matches
//         several) → showAll — don't filter to an arbitrary first match.
export function pickVocabOptionForWord(word, options, category = null) {
  const w = (word == null ? '' : String(word)).trim()
  if (!w) return { index: -1, showAll: false }
  const opts = Array.isArray(options) ? options : []
  const textOf = o => (o && typeof o.text === 'string') ? o.text : null

  const exactIdxs = []
  opts.forEach((o, i) => { const t = textOf(o); if (t != null && wordIsExactInVocabularyLine(t, w, true)) exactIdxs.push(i) })

  if (exactIdxs.length === 0) {
    const containsIdx = opts.findIndex(o => { const t = textOf(o); return t != null && wordIsExactInVocabularyLine(t, w, false) })
    if (containsIdx >= 0) return { index: containsIdx, showAll: false }
    const wl = w.toLowerCase()
    const subIdx = opts.findIndex(o => { const t = textOf(o); return t != null && t.toLowerCase().includes(wl) })
    return { index: subIdx, showAll: false }
  }
  if (exactIdxs.length === 1) return { index: exactIdxs[0], showAll: false }

  // Multiple exact matches — try to narrow by the context category.
  const cat = category == null ? '' : String(category)
  if (cat) {
    const inCat = exactIdxs.filter(i => opts[i] && opts[i].category === cat)
    if (inCat.length === 1) return { index: inCat[0], showAll: false }
  }
  return { index: -1, showAll: true }
}

// Does ANY `|`-segment of any line in `allWords` contain `word` as an exact
// (case-insensitive) word? Multi-word segments are split on whitespace.
// Bracket hints inside segments are stripped via `stripBracketHints` (DI).
// Used to gate weak (overlap < 3) prefix matches: shown only when there's
// a strong anchor.
export function vocabHasExactWord(allWords, word, stripBracketHints = (s => s)) {
  if (!word) return false
  const w = word.toLowerCase().trim()
  if (!w) return false
  return (allWords || []).some(line => {
    if (typeof line !== 'string') return false
    return line.toLowerCase().split(SEPARATOR_PIPE).some(p => {
      let s
      try { s = stripBracketHints(p).trim() } catch (_) { s = p.trim() }
      if (!s) return false
      if (s === w) return true
      return s.split(/\s+/).includes(w)
    })
  })
}
