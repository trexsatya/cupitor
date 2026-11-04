import { cleanSrtForMatch, relaxSpaces } from './search-text.js'
import { splitRegexAlternatives } from './regex-pattern.js'
import { srtToJson } from './srt-parser.js'

// The index is only a candidate filter. Its version covers normalization,
// parser views and token boundaries; a mismatch always uses the full scan.
export const SUBTITLE_INDEX_VERSION = 1
const environment=String(globalThis.navigator?.userAgent||'unknown')+'|'+new Intl.Segmenter().resolvedOptions().locale
export const SUBTITLE_INDEX_ENVIRONMENT=(()=>{let hash=2166136261;for(const character of environment)hash=Math.imul(hash^character.codePointAt(0),16777619);return (hash>>>0).toString(16)})()
export const POSTING_SHARD_SIZE = 128
export const MAX_INDEX_TERMS = 16384
const foldedCharacters = new Map()
const wordCharacters = /[A-Za-z0-9_À-ÖØ-öø-ÿ]+/g
const wordQuery = /^[A-Za-z0-9_À-ÖØ-öø-ÿ]{3,128}$/u
const pause = () => new Promise(resolve => setTimeout(resolve, 0))

function foldCharacter(character) {
  if (foldedCharacters.has(character)) return foldedCharacters.get(character)
  const upper = character.toUpperCase()
  // Single-character case closure also handles long s, Kelvin sign, Greek
  // symbol variants and final sigma. Do not expand ß into two s characters.
  const value = [...upper].length === 1 ? upper.toLowerCase() : character.toLowerCase()
  if (foldedCharacters.size >= 4096) foldedCharacters.clear()
  foldedCharacters.set(character, value)
  return value
}
export const foldSearchText = text => [...String(text)].map(foldCharacter).join('')
export const postingTerm = (kind, language, term) => `${SUBTITLE_INDEX_VERSION}:${kind}:${language}:${term}`
export function literalTrigrams(text) {
  const result = new Set(), window = []
  for (const character of foldSearchText(text)) {
    window.push(character)
    if (window.length > 3) window.shift()
    if (window.length === 3) result.add(window.join(''))
  }
  return [...result]
}

// Index both file-inclusion text and the exact parsed cue view used by the
// matcher. Cue-only anchors, removed caption tags and multiline text must not
// disappear merely because the flattened SRT view differs.
export async function buildSubtitleFeatures(document, {maxTerms = MAX_INDEX_TERMS, yieldToUI = pause, check = () => {}} = {}) {
  const terms = new Set(), segmenter = new Intl.Segmenter([], {granularity:'word'})
  let processed = 0, wordComplete = true
  const add = term => { terms.add(term); return terms.size <= maxTerms }
  async function grams(text, language) {
    const window = []
    for (const original of text) {
      for (const character of foldCharacter(original)) {
        window.push(character)
        if (window.length > 3) window.shift()
        if (window.length === 3 && !add(postingTerm('g', language, window.join('')))) return false
      }
      if (++processed % 32768 === 0) { check(); await yieldToUI() }
    }
    return true
  }
  for (const language of ['sv','en']) {
    check()
    const raw = document[language]
    if (!raw) continue
    if (!await grams(cleanSrtForMatch(raw), language)) return {terms:[],complete:false,wordComplete:false}
    for (const cue of srtToJson(raw)) {
      if (!await grams(cue.text, language)) return {terms:[],complete:false,wordComplete:false}
      // Oversized cues still get substring indexing. Exact-word candidates
      // fall back to scanning instead of retaining an enormous token.
      if (cue.text.length > 65536) { wordComplete = false; continue }
      const tokens = new Set()
      for (const {segment} of segmenter.segment(cue.text)) if (segment.trim().length <= 128) tokens.add(segment.trim())
      for (const match of cue.text.matchAll(wordCharacters)) if (match[0].length <= 128) tokens.add(match[0])
      for (const token of tokens) if (token && !add(postingTerm('w', language, foldSearchText(token)))) return {terms:[],complete:false,wordComplete:false}
    }
  }
  check()
  return {terms:[...terms],complete:true,wordComplete}
}

function quantifier(pattern, offset) {
  const rest = pattern.slice(offset)
  const simple = rest[0]
  let length = 0, minimum = 1, fixed = true
  if (simple === '*' || simple === '?' || simple === '+') {
    length = 1; minimum = simple === '+' ? 1 : 0; fixed = false
  } else {
    const match = rest.match(/^\{(\d+)(?:,(\d*)?)?\}/)
    if (match) { length=match[0].length; minimum=Number(match[1]); fixed=!match[0].includes(',') || match[2] === match[1] }
  }
  if (length && rest[length] === '?') length++
  return {length, minimum, fixed}
}

// Deliberately conservative regex subset. Unsupported groups, backreferences
// or legacy non-Unicode patterns use a full scan. Literal runs separated by
// wildcards/classes give necessary conditions, never sufficient matches.
function requiredRuns(branch) {
  const runs = []; let run = ''
  const flush = () => { if (run) runs.push(run); run = '' }
  for (let i=0; i<branch.length;) {
    const start = i, character = branch[i++]
    let literal = null, zeroWidth = false
    if (character === '(' || character === ')') return null
    if (character === '[') {
      let closed = false
      while (i < branch.length) {
        if (branch[i] === '\\') { i += 2; continue }
        if (branch[i++] === ']') { closed=true; break }
      }
      if (!closed) return null
    } else if (character === '\\') {
      const escape = branch[i++]
      if (!escape || /[1-9k]/.test(escape)) return null
      if ('nrtfv'.includes(escape)) literal = {n:'\n',r:'\r',t:'\t',f:'\f',v:'\v'}[escape]
      else if (escape === 'x' || escape === 'u') {
        const match = branch.slice(i).match(escape === 'x' ? /^[0-9a-fA-F]{2}/ : /^(?:\{[0-9a-fA-F]+\}|[0-9a-fA-F]{4})/)
        if (!match) return null
        const code = Number.parseInt(match[0].replace(/[{}]/g,''),16)
        if (code > 0x10ffff) return null
        literal=String.fromCodePoint(code); i+=match[0].length
      } else if (escape === 'p' || escape === 'P') {
        const match=branch.slice(i).match(/^\{[^}]+\}/)
        if (!match) return null
        i+=match[0].length
      } else if ('dDsSwWbB'.includes(escape)) { zeroWidth=escape==='b'||escape==='B' }
      else if (escape === '0' && !/\d/.test(branch[i] || '')) literal='\0'
      else if ('^$\\.*+?()[]{}|/'.includes(escape)) literal=escape
      else return null
    } else if (character === '^' || character === '$') zeroWidth=true
    else if (character === '.') { /* arbitrary character */ }
    else if ('*+?{}'.includes(character)) return null
    else {
      const code=branch.codePointAt(start)
      literal=String.fromCodePoint(code); i=start+literal.length
    }
    const repeat = zeroWidth ? {length:0,minimum:1,fixed:true} : quantifier(branch,i)
    i+=repeat.length
    if (literal !== null && repeat.minimum > 0) {
      // Taking one mandatory repetition is enough to narrow candidates.
      run+=literal
      if (repeat.length && !(repeat.fixed && repeat.minimum === 1)) flush()
    } else flush()
  }
  flush(); return runs
}

export function planSubtitleCandidates(query, {language=null, exactWordsOnly=false, regexMode=false} = {}) {
  if (exactWordsOnly && !regexMode && language && wordQuery.test(query))
    return {kind:'word',clauses:[[postingTerm('w',language,foldSearchText(query))]]}
  const pattern=relaxSpaces(String(query))
  if (pattern.length > 4096) return null
  try { new RegExp(pattern,'iu') } catch (_) { return null }
  const branches=splitRegexAlternatives(pattern)
  if (branches.length > 16) return null
  const perBranch=Math.min(8,Math.floor(64/branches.length)), clauses=[]
  for (const branch of branches) {
    const runs=requiredRuns(branch)
    if (!runs) return null
    const grams=[...new Set(runs.flatMap(literalTrigrams))]
    if (!grams.length) return null
    const selected=grams.length <= perBranch ? grams : Array.from({length:perBranch},(_,i)=>grams[Math.floor(i*(grams.length-1)/(perBranch-1))])
    const languages=language ? [language] : ['sv','en']
    for (const track of languages) clauses.push(selected.map(gram=>postingTerm('g',track,gram)))
  }
  return {kind:'trigram',clauses}
}

export function indexCovers(info, plan) {
  return info && info.indexVersion === SUBTITLE_INDEX_VERSION && info.indexEnvironment === SUBTITLE_INDEX_ENVIRONMENT && info.indexGeneration === (info.generation || 0)
    && info.indexComplete && (plan.kind !== 'word' || info.wordComplete)
}
