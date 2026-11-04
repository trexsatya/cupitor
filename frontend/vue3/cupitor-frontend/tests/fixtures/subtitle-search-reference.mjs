// Shared reference/fallback/worker semantics. Normalization and attribution
// are independent of the DOM, account state and rendering.
import { getWords, withWordBoundaries, relaxSpaces as _relaxSpaces, getSearchedTerms, isRegExp, cleanSrtForMatch } from '../../public/language/search-text.js'
import { compileRegex, splitRegexAlternatives, hasPhraseWhitespace } from '../../public/language/regex-pattern.js'
import { srtToJson } from '../../public/language/srt-parser.js'
const SEPARATOR_PIPE = '|'
const computeIfAbsent = (map,key,create) => Object.hasOwn(map,key) ? map[key] : (Object.defineProperty(map,key,{value:create(key),writable:true,enumerable:true,configurable:true}),map[key])
class MatchResult { constructor(word,line,url,source) { Object.assign(this,{word,line,url,source}) } }

export const SUBTITLE_NORMALIZATION_VERSION = 1
export function prepareSearchDocument(document) {
  return { ...document, svClean:cleanSrtForMatch(document.sv), enClean:cleanSrtForMatch(document.en), version:SUBTITLE_NORMALIZATION_VERSION }
}
export function matchSearchDocument(document, query, {regexMode=false, suffix='.sv.srt'}={}) {
  const re=compileRegex(_relaxSpaces(query),'i')
  let svMatch=!!(document.sv && re.test(document.svClean)),enMatch=!!(document.en && re.test(document.enClean))
  if(regexMode) {
    if(!svMatch&&document.sv)svMatch=srtToJson(document.sv).some(line=>re.test(line.text.trimEnd()))
    if(!enMatch&&document.en)enMatch=srtToJson(document.en).some(line=>re.test(line.text.trimEnd()))
  }
  if(!svMatch&&!enMatch)return null
  const subs=(key,extension)=>({data:srtToJson(document[key]).map(line=>regexMode?{...line,text:line.text.trimEnd()}:line),path:document.id+extension,url:document.id,source:document.source,fetchedFrom:document.fetchedFrom})
  return {source:document.source,url:document.id,sv_match:svMatch,en_match:enMatch,sv_subs:subs('sv',suffix),en_subs:subs('en','.en.srt')}
}

export async function attributeSubtitleMatches(list, search, { regexMode = false, exactWordsOnly = false, check = () => {}, yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0)) } = {}) {
  if (regexMode) {
    // The new regex contract attributes literal matched spans, preserving
    // trailing-space requirements instead of falling back to trimmed queries.
    const out = {}
    const re = compileRegex(_relaxSpaces(search), 'gi')
    for (const item of list) {
      check()
      for (const line of item.data) {
        for (const match of line.text.matchAll(re)) {
          const word = match[0].trim().toLowerCase()
          if (!word) continue
          computeIfAbsent(out, word, () => []).push(new MatchResult(word, line, item.url, item.source))
        }
      }
    }
    return out
  }
  let wordToItemsMap = {}
  let searchText = search
  const transformedSearchText = search
  const bounded = pattern => regexMode ? pattern : withWordBoundaries(pattern)

  const isNotTooShort = w => w.trim().length > 2
  const ITEM_CHUNK = 25

  const transformedRe = compileRegex(_relaxSpaces(transformedSearchText), "i")
  // English does not compound or inflect the way the studied language does, so
  // a loose match there lands on a different word almost every time: "thin"
  // answered with think, thing and nothing, each dragging its own unrelated
  // subtitles in behind it. Whole words only is what an English search means.
  //
  // The studied language keeps the loose match, and needs it — "hus" genuinely
  // belongs with huset and husrannsakan. The explicit leading/trailing-space
  // conventions below stay in both languages: those are a deliberate gesture
  // for "words ending in…", not an accident of substring matching.
  // Per-word matching test: alternatives like " ber ", " be ", " bad " (the
  // user's convention for forcing word-boundary semantics) can never match a
  // bare segmented word like "ber" because the literal spaces have to be in
  // the test string. Build a parallel regex with each alternative trimmed so
  // those individual words still produce per-word accordions. The whole-line
  // regex below keeps the spaced form for phrase-level matching.
  const perWordRe = compileRegex(
    '^(?:' +
    splitRegexAlternatives(transformedSearchText)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .join(SEPARATOR_PIPE) +
    ')$',
    "i"
  )

  // Multi-word phrase terms (e.g. expansion of "<*göra susen" produces
  // "göra susen|gör susen|gjorde susen|gjort susen"). The per-word filter
  // above can't match these (segmenter gives single words), and the
  // combined whole-pipe key would later be filtered out at render. So we
  // tag each phrase term independently here.
  const phraseTerms = (regexMode ? [] : splitRegexAlternatives(transformedSearchText))
    .map(s => s.trim())
    .filter(s => s.length > 1 && hasPhraseWhitespace(s))
  const phraseRes = phraseTerms.map(t => ({ term: t, re: compileRegex(_relaxSpaces(bounded(t)), "i") }))

  for (let start = 0; start < list.length; start += ITEM_CHUNK) {
    check()
    const end = Math.min(start + ITEM_CHUNK, list.length)
    for (let ix = start; ix < end; ix++) {
      const item = list[ix]
      const lines = item.data;
      for (const line of lines) {
        check()
        // Fast-skip lines that can't contain a match. getWords() runs
        // Intl.Segmenter on every line, which is the single most expensive
        // step in this loop — for a search that file-matches in 180 SRTs
        // with ~100 lines each, the bulk of the 18k segmentations are on
        // lines that never had a chance of matching. Every downstream
        // matcher (perWordRe, bounded(searchText), phraseRes)
        // is strictly more restrictive than transformedRe, so if
        // transformedRe doesn't match this line, none of them can either.
        // Skipping here lets the loop finish in a small fraction of the
        // old wall-clock budget, so the timeout below never fires under
        // realistic search loads. (Was hitting the 20s ceiling and
        // returning before reaching files later in the iteration order —
        // user-visible symptom: a search for a rare word that genuinely
        // appears in some file but the file doesn't show up because the
        // loop bailed before processing it.)
        if (!transformedRe.test(line.text)) continue
        const words = getWords(line.text, search).map(it => it.trim().toLowerCase())
        const endsWith = word => isNotTooShort(transformedSearchText) && transformedSearchText.endsWith(" ") && !transformedSearchText.startsWith(" ") && word.endsWith(transformedSearchText.trim());
        const startsWith = word => isNotTooShort(transformedSearchText) && transformedSearchText.startsWith(" ") && !transformedSearchText.endsWith(" ") && word.startsWith(transformedSearchText.trim());
        words.filter(word => word.match(perWordRe)
                || (!exactWordsOnly && word.match(transformedRe))
                || endsWith(word) || startsWith(word))
            .forEach(word => {
              wordToItemsMap[word] = computeIfAbsent(wordToItemsMap, word, it => []).concat(new MatchResult(word, line, item.url, item.source))
            })
        // Whole search text as a word
        const word = searchText.trim()
        if (hasPhraseWhitespace(word) && compileRegex(_relaxSpaces(bounded(word)), "i").test(line.text)) {
          wordToItemsMap[word] = computeIfAbsent(wordToItemsMap, word, it => []).concat(new MatchResult(word, line, item.url, item.source))
        }
        // Per-phrase terms (so each expansion of "<*göra susen" gets its
        // own accordion key, instead of all collapsing into the whole-pipe
        // key that populateSRTFindings drops).
        for (const { term, re } of phraseRes) {
          if (re.test(line.text)) {
            wordToItemsMap[term] = computeIfAbsent(wordToItemsMap, term, it => []).concat(new MatchResult(term, line, item.url, item.source))
          }
        }
      }
      // Cross-line phrase match: catch phrases like "a b" where "a" sits
      // at the end of line N and "b" at the start of line N+1. The regex
      // already treats spaces as \s+ (via _relaxSpaces), so joining with a
      // newline preserves intent. Only register when neither line alone
      // matched, so we don't double-count the easy single-line case.
      const wholeWord = searchText.trim()
      const wholeRe = hasPhraseWhitespace(wholeWord)
          ? compileRegex(_relaxSpaces(bounded(wholeWord)), "i")
          : null
      for (let i = 0; i + 1 < lines.length; i++) {
        const a = lines[i], b = lines[i + 1]
        if (!a || !b || !a.text || !b.text) continue
        const combined = a.text + '\n' + b.text
        for (const { term, re } of phraseRes) {
          if (re.test(combined) && !re.test(a.text) && !re.test(b.text)) {
            wordToItemsMap[term] = computeIfAbsent(wordToItemsMap, term, it => []).concat(new MatchResult(term, a, item.url, item.source))
          }
        }
        if (wholeRe && wholeRe.test(combined) && !wholeRe.test(a.text) && !wholeRe.test(b.text)) {
          wordToItemsMap[wholeWord] = computeIfAbsent(wordToItemsMap, wholeWord, it => []).concat(new MatchResult(wholeWord, a, item.url, item.source))
        }
      }
    }
    await yieldToUI()
  }

  if (wordToItemsMap[searchText.trim()] === undefined) {
    wordToItemsMap[searchText] = []
  }

  const wordToItemsMap2 = {}
  if (isNotTooShort(searchText)) {
    searchText = searchText.trim()
  }

  const searchRe = compileRegex(_relaxSpaces(bounded(searchText)), "i")
  for (let start = 0; start < list.length; start += ITEM_CHUNK) {
    check()
    const end = Math.min(start + ITEM_CHUNK, list.length)
    for (let ix = start; ix < end; ix++) {
      const item = list[ix]
      const lines = item.data;
      for (const line of lines) {
        const matches = line.text.match(searchRe)
        const alreadyIncludedInResults = it => it.toLowerCase().indexOf(searchText.toLowerCase()) >= 0
            && (wordToItemsMap[it] || []).length > 0;

        if (matches && !Object.keys(wordToItemsMap).some(alreadyIncludedInResults)) {
          const matchedPart = matches[0].toLowerCase()
          wordToItemsMap2[matchedPart] = computeIfAbsent(wordToItemsMap2, matchedPart, it => []).concat(new MatchResult(matchedPart, line, item.url, item.source))
        }
      }
    }
    await yieldToUI()
  }

  if (!wordToItemsMap[searchText.trim()] || wordToItemsMap[searchText.trim()].length === 0) {
    wordToItemsMap = Object.assign(wordToItemsMap, wordToItemsMap2)
  }

  // A subtitle can contain several matching words. Each word must keep its
  // own findings: assigning the line only to the longest heading makes a
  // broad search like "för.*" falsely report no hits for the other words.
  // groupAndArrangeResults removes duplicate cards within each group later.

  if (!regexMode) getSearchedTerms(transformedSearchText).forEach(it => {
    if (!wordToItemsMap[it] && !isRegExp(it)) {
      wordToItemsMap[it] = []
    }
  })

  return wordToItemsMap;
}
