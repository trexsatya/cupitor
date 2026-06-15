// Pure vocabulary search helpers — extracted from language.js so the
// prefix-overlap matching, stop-word filtering and compound decomposition
// can be unit-tested without pulling in jQuery / DOM / window globals.
//
// The functions here have no side effects: they take strings (or sets) in
// and return strings/numbers/arrays. Callers in language.js wrap them with
// the live window.vocabulary cache.

export const SEPARATOR_PIPE = '|'

// Swedish stop-words that show up so often inside multi-word vocab segments
// that letting them anchor a prefix or suffix match would turn every search
// ending in "-et"/"-en" into a 100-hit dump.
export const commonWordsToIgnore = [
  'den', 'det', 'är', 'och', 'att', 'i', 'en', 'jag', 'hon', 'som', 'han', 'på', 'den', 'med', 'var', 'sig', 'för', 'så',
  'var', 'vart', 'vem', 'vilken', 'vilka', 'åt', 'heller', 'eller', 'när', 'in', 'inne', 'up', 'uppe', 'ner', 'nere',
  'här', 'där', 'var', 'dit', 'där', 'ditt', 'mitt', 'sitt', 'vårt', 'vem', 'vad', 'vilken', 'vilket', 'vilka', 'någon',
  'något', 'några', 'ingen', 'inget', 'inga', 'både', 'all', 'allt', 'alla', 'många', 'mycket', 'lite', 'få', 'färre',
  'flera', 'mest', 'minst', 'någon', 'något', 'några', 'ingen', 'inget', 'inga', 'både', 'all', 'allt', 'alla', 'många',
  'dig', 'mig', 'oss', 'er', 'dem', 'honom', 'henne'
]

// Common stop-words + bare inflectional clitics that should never anchor a
// prefix/suffix overlap. Includes possessives & demonstratives.
export const VOCAB_OVERLAP_STOP_WORDS = new Set([
  ...commonWordsToIgnore.map(w => w.toLowerCase()),
  'et', 'ett', 'en', 'arna', 'erna', 'orna', 'are', 'ade', 'ar', 'or', 'er',
  'av', 'om', 'och', 'att',
  'sin', 'sitt', 'sina', 'din', 'dina', 'min', 'mina', 'vår', 'våra', 'era',
  'ert', 'denna', 'detta', 'dessa', 'samma', 'andra', 'samt'
])

// Common Swedish noun/verb inflectional + derivational suffixes used both
// when checking whether a search word is "just an inflection of a known
// word" and when probing compound boundaries ("huset" = hus + et).
export const VOCAB_COMPOUND_SUFFIXES = [
  'ningarna', 'ningar', 'ningen', 'ning', 'else', 'heten', 'het',
  'arna', 'erna', 'orna', 'ande', 'ende', 'ade', 'ats', 'at',
  'et', 'en', 'ar', 'or', 'er', 'na', 'ad', 'as', 'a', 's', ''
]

// Strip parenthesised hints from a vocab segment (e.g. "stoft(-et)" → "stoft",
// "fruga(slang)" → "fruga"). The version in language.js does extra regex-
// pattern substitutions used by the search engine; for the prefix-overlap
// pipeline the simple paren-removal is enough.
export function stripBracketHints(txt) {
  if (typeof txt !== 'string') return ''
  let s = txt.replaceAll('(sl-pl)', '').replaceAll('(pl)', '')
  while (s.indexOf('(') >= 0) {
    const m = s.match(/\([^()]*\)/)
    if (!m) { s = s.replace(/[()]/g, ''); break }
    s = s.slice(0, m.index) + s.slice(m.index + m[0].length)
  }
  return s
}

function _splitSearchParts(searchText) {
  const stRaw = (searchText || '').toLowerCase().trim()
  if (!stRaw) return []
  return stRaw.split(SEPARATOR_PIPE).map(s => s.trim())
    .filter(s => s.length >= 3 && !VOCAB_OVERLAP_STOP_WORDS.has(s))
}

function _splitVocabParts(vocabLine) {
  return vocabLine.split(SEPARATOR_PIPE)
    .map(p => p.toLowerCase().trim())
    .map(p => { try { return stripBracketHints(p).trim() } catch (_) { return p } })
    .filter(p => p.length >= 2)
}

// Per-segment tokenisation: include the whole segment plus each ≥2-char word
// inside multi-word segments (so "rik som ett troll" can hit "troll").
function _tokensForSegment(p) {
  const tokens = []
  if (!VOCAB_OVERLAP_STOP_WORDS.has(p)) tokens.push(p)
  if (/\s/.test(p)) {
    for (const w of p.split(/\s+/)) {
      if (w.length >= 2 && !VOCAB_OVERLAP_STOP_WORDS.has(w)) tokens.push(w)
    }
  }
  return tokens
}

// Longest common prefix between any per-word vocab token and any search
// part, with "near-containment": the shorter must be consumed by the longer
// with at most 1 char of divergence. Returns the LCP length (>= 3 is a
// strong match).
export function vocabPrefixOverlapLen(vocabLine, searchText) {
  const searchParts = _splitSearchParts(searchText)
  if (searchParts.length === 0) return 0
  const vocabParts = _splitVocabParts(vocabLine)
  let max = 0
  for (const p of vocabParts) {
    const tokens = _tokensForSegment(p)
    for (const s of searchParts) {
      for (const t of tokens) {
        const lim = Math.min(t.length, s.length)
        const needed = Math.max(1, lim - 1)
        let lcp = 0
        while (lcp < lim && t.charCodeAt(lcp) === s.charCodeAt(lcp)) lcp++
        if (lcp >= needed && lcp > max) max = lcp
      }
    }
  }
  return max
}

// Like vocabPrefixOverlapLen but also reports which search part won and the
// actual common-prefix substring. The matched substring is what the UI
// groups under, so a token "stor" matching "stoft" with LCP=3 ends up in
// the "sto" group instead of the "stoft" group.
export function vocabPrefixOverlapDetail(vocabLine, searchText) {
  const searchParts = _splitSearchParts(searchText)
  if (searchParts.length === 0) return { len: 0, bestPart: '', matched: '' }
  const vocabParts = _splitVocabParts(vocabLine)
  let bestLen = 0
  let bestPart = ''
  let bestToken = ''
  for (const p of vocabParts) {
    const tokens = _tokensForSegment(p)
    for (const s of searchParts) {
      for (const t of tokens) {
        const lim = Math.min(t.length, s.length)
        const needed = Math.max(1, lim - 1)
        let lcp = 0
        while (lcp < lim && t.charCodeAt(lcp) === s.charCodeAt(lcp)) lcp++
        if (lcp >= needed && lcp > bestLen) {
          bestLen = lcp; bestPart = s; bestToken = t
        }
      }
    }
  }
  const matched = bestLen > 0 ? bestToken.slice(0, bestLen) : ''
  return { len: bestLen, bestPart, matched }
}

// Longest common suffix — only used by the Different-prefixes dialog's weak-
// overlap fallback. Requires the vocab segment to be entirely the suffix of
// the search (so a 3-char "bet" with only 2 chars in common with "trollguldet"
// is rejected, but the bare 2-char "åt" inside "äta|åt|ätit" still surfaces
// for "gråt").
export function vocabSuffixOverlapLen(vocabLine, searchText) {
  const searchParts = _splitSearchParts(searchText)
  if (searchParts.length === 0) return 0
  // Vocab parts here are NOT stop-word filtered — see "åt" comment above.
  const vocabParts = vocabLine.split(SEPARATOR_PIPE)
    .map(p => p.toLowerCase().trim())
    .map(p => { try { return stripBracketHints(p).trim() } catch (_) { return p } })
    .filter(p => p.length >= 2)
  let max = 0
  for (const p of vocabParts) {
    for (const s of searchParts) {
      const lim = Math.min(p.length, s.length)
      let lcs = 0
      while (lcs < lim && p.charCodeAt(p.length - 1 - lcs) === s.charCodeAt(s.length - 1 - lcs)) lcs++
      if (lcs === p.length && lcs > max) max = lcs
    }
  }
  return max
}

// Build the set of every ≥3-char non-stop word that appears in any vocab
// line of a non-hidden category. Used as the lexicon for compound splits.
export function buildKnownWordSet(vocabulary, hiddenCategories) {
  const set = new Set()
  const hidden = hiddenCategories || new Set()
  for (const [cat, lines] of Object.entries(vocabulary || {})) {
    if (!Array.isArray(lines)) continue
    if (hidden.has(cat)) continue
    for (const line of lines) {
      if (typeof line !== 'string') continue
      for (const seg of line.split(SEPARATOR_PIPE)) {
        let stripped
        try { stripped = stripBracketHints(seg.toLowerCase()).trim() }
        catch (_) { stripped = seg.toLowerCase().trim() }
        if (!stripped) continue
        for (const w of stripped.split(/[\s,/<>*]+/)) {
          const t = w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')
          if (t.length >= 3 && !VOCAB_OVERLAP_STOP_WORDS.has(t)) set.add(t)
        }
      }
    }
  }
  return set
}

// Set of every length-≥4 prefix of every known word — so substrings like
// "promen" (a 6-char prefix of "promenera") count as a vocab presence even
// when "promen" itself isn't a standalone token.
export function buildPrefixSet(knownSet) {
  const set = new Set()
  for (const t of knownSet || []) {
    for (let k = 4; k <= t.length; k++) set.add(t.slice(0, k))
  }
  return set
}

// Decompose a (Swedish) compound word into morphemes that have a presence
// in the vocabulary. See language.js docstring for the full strategy. Pure
// version: takes the lexicons as parameters so it's directly testable.
export function vocabCompoundParts(word, knownSet, prefixSet) {
  if (!word || word.length < 6) return []
  const w = word.toLowerCase()
  const known = knownSet || new Set()
  const prefixes = prefixSet || new Set()
  if (known.has(w)) return []
  for (const sfx of VOCAB_COMPOUND_SUFFIXES) {
    if (!sfx) continue
    if (!w.endsWith(sfx)) continue
    const stem = w.slice(0, w.length - sfx.length)
    if (stem.length >= 3 && known.has(stem)) return []
  }
  const parts = []
  const seen = new Set()
  const N = w.length
  let i = 0
  while (i <= N - 3) {
    let bestSub = null
    let consumed = 0
    // (a)/(b) combined: longest l where w[i..i+l] is a known token, OR
    // strips down via a common suffix to a known token. (b) wins when the
    // bare substring isn't a token but the morpheme is — "huset" → "hus".
    for (let l = N - i; l >= 3; l--) {
      const sub = w.slice(i, i + l)
      if (sub === w) continue
      if (known.has(sub)) { bestSub = sub; consumed = l; break }
      let stripped = null
      for (const sfx of VOCAB_COMPOUND_SUFFIXES) {
        if (!sfx) continue
        if (!sub.endsWith(sfx)) continue
        const stem = sub.slice(0, sub.length - sfx.length)
        if (stem.length >= 3 && known.has(stem)) { stripped = stem; break }
      }
      if (stripped) { bestSub = stripped; consumed = l; break }
    }
    // (c) Prefix-of-known fallback — substrings like "promen" that aren't
    // themselves vocab tokens but lead into one ("promenera").
    if (!bestSub) {
      for (let l = N - i; l >= 4; l--) {
        const sub = w.slice(i, i + l)
        if (sub === w) continue
        if (prefixes.has(sub) && !VOCAB_OVERLAP_STOP_WORDS.has(sub)) {
          bestSub = sub
          consumed = l
          break
        }
      }
    }
    // Either a substantial morpheme (≥4 chars) OR a 3-char stem that gets
    // extended by an inflectional suffix to ≥5 chars total.
    const lenOk = bestSub && (bestSub.length >= 4 || consumed >= 5)
    if (lenOk && !VOCAB_OVERLAP_STOP_WORDS.has(bestSub)) {
      if (!seen.has(bestSub)) { parts.push(bestSub); seen.add(bestSub) }
      i += Math.max(consumed, 1)
    } else {
      i++
    }
  }
  return parts
}
