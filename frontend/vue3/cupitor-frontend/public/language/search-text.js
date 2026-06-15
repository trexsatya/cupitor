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

// Wrap a search pattern in regex word boundaries so a multi-word phrase
// like "ta efter" doesn't match inside "tänkta efter" / "leta efter".
// Uses lookarounds (\w on either side) rather than \b because Swedish
// letters like å/ä/ö are non-\w in JS — \b would put a boundary inside a
// Swedish word and cause spurious mismatches there too. Patterns the
// user explicitly padded with whitespace (their convention for
// literal-space prefix/suffix matching) are left alone.
export function withWordBoundaries(pattern) {
  if (!pattern) return pattern
  if (/^\s|\s$/.test(pattern)) return pattern
  return `(?<!\\w)(?:${pattern})(?!\\w)`
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
export function wordIsExactInVocabularyLine(vocabLine, search) {
  try {
    const vocabLineLower = (vocabLine || '').toLowerCase()
    const vocabWords = getWords(vocabLine)
      .filter(it => it.trim().length > 2)
      .map(it => it.toLowerCase().trim())
    const s = (search || '').toLowerCase().trim()
    if (!s) return false
    if (vocabWords.includes(s)) return true
    const terms = s.split(SEPARATOR_PIPE).map(t => t.trim()).filter(Boolean)
    for (const t of terms) {
      if (t.indexOf(' ') > 0) {
        if (vocabLineLower.includes(t)) return true
      } else if (vocabWords.includes(t)) {
        return true
      }
    }
    return false
  } catch (_) {
    return false
  }
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
