// Pure span builder used by the search-result line highlighter
// (`highlightedText` in language.js). Given a text and a |-alternation
// pattern, returns a sorted, merged list of {start, end} spans that should
// be wrapped in <span class="highlight">…</span>.
//
// The algorithm mirrors `_highlightWordHtml` (Player/Practice) but with
// two search-result-specific rules:
//   • each match expands outward to the enclosing whitespace boundary, so
//     a stem hit like "design" still covers the whole "designing"
//   • multi-word phrases have priority over their constituent single
//     words — if any phrase matches, ONLY phrase spans are emitted, so
//     the "x y z|x|y|z" pattern doesn't light up the whole phrase AND
//     every standalone letter.
//
// Pure: no DOM, no globals, no HTML emission. The caller composes the HTML.

// Escaped characters and whole character classes are regex atoms: their
// spaces and pipes belong to the expression, not to phrase/term splitting.
const REGEX_ATOMS = /\\[\s\S]|\[(?:\\[\s\S]|[^\]\\])*\]/g
const PHRASE_SPACES = /\\[\s\S]|\[(?:\\[\s\S]|[^\]\\])*\]| +/g

function splitAlternatives(pattern) {
  const tokens = []
  let start = 0, inClass = false, depth = 0
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '\\') { i++; continue }
    if (inClass) { if (ch === ']') inClass = false; continue }
    if (ch === '[') inClass = true
    else if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    else if (ch === '|' && depth === 0) {
      tokens.push(pattern.slice(start, i))
      start = i + 1
    }
  }
  tokens.push(pattern.slice(start))
  return tokens.map(t => t.trim()).filter(t => t && tryRe(t, 'gi'))
}

function isPhrase(token) {
  return /\s/.test(token.replace(REGEX_ATOMS, ''))
}

function relaxPhraseSpaces(token) {
  return token.replace(PHRASE_SPACES, part => part[0] === ' ' ? '\\s+' : part)
}

function tryRe(src, flags) {
  try { return new RegExp(src, flags) } catch (_) { return null }
}
function tryBoundedRe(src) {
  try { return new RegExp(`(?<![\\p{L}\\p{N}])(?:${src})(?![\\p{L}\\p{N}])`, 'giu') }
  catch (_) { return tryRe(src, 'gi') }
}

function collect(re, text) {
  const spans = []
  if (!re) return spans
  re.lastIndex = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue }
    let x = m.index
    while (x > 0 && text[x - 1] !== ' ' && text[x - 1] !== '\n') x--
    let y = m.index + m[0].length
    while (y < text.length && text[y] !== ' ' && text[y] !== '\n') y++
    spans.push({ start: x, end: y })
    if (m.index === re.lastIndex) re.lastIndex++
  }
  return spans
}

function mergeSpans(spans) {
  spans.sort((a, b) => a.start - b.start)
  const merged = []
  for (const sp of spans) {
    const last = merged[merged.length - 1]
    if (last && sp.start <= last.end) last.end = Math.max(last.end, sp.end)
    else merged.push({ ...sp })
  }
  return merged
}

// Build the [{start, end}] spans for `text` against the |-alternation
// `pattern` (regex source — already escaped/expanded by the caller).
//
// Returns [] when no match is found OR when the pattern has no usable
// tokens — caller treats this as "nothing to highlight".
export function buildHighlightSpans(text, pattern) {
  const tokens = splitAlternatives(String(pattern || ''))
  if (!tokens.length) return []

  const multiWord  = tokens.filter(isPhrase)
  const singleWord = tokens.filter(t => !isPhrase(t))

  // 1) Multi-word phrases first. Internal spaces relax to \s+.
  let spans = multiWord.length
    ? collect(tryRe(multiWord.map(relaxPhraseSpaces).join('|'), 'gi'), text)
    : []

  // 2) Fall back to single-word matches when no phrase was found:
  //    • singleWord alts — UNBOUNDED so stems still highlight derived forms
  //    • sub-words split from multi-word phrases — BOUNDED via Unicode
  //      lookaround so short tokens like "i" don't light up inside "vi"
  if (!spans.length) {
    if (singleWord.length) {
      spans = spans.concat(collect(tryRe(singleWord.join('|'), 'gi'), text))
    }
    const subFromMulti = multiWord
      // Only plain phrases can fall back to individual words. Splitting a
      // regex such as "foo [^ ]+ bar" can turn its fragments into a new regex.
      .filter(t => !/[\\^$.*+?()[\]{}]/.test(t))
      .flatMap(t => t.split(/\s+/))
      .map(s => s.trim())
      .filter(Boolean)
    if (subFromMulti.length) {
      spans = spans.concat(collect(tryBoundedRe(subFromMulti.join('|')), text))
    }
  }
  if (!spans.length) return []
  return mergeSpans(spans)
}

// Slice the text into `[{ kind: 'plain'|'match', text }]` chunks using the
// VM-computed spans. Convenient when the caller needs to map both halves
// (e.g. wrap matches with <span class="highlight"> and run a wiki-link
// transformer over plain segments).
export function sliceByHighlightSpans(text, spans) {
  if (!Array.isArray(spans) || !spans.length) {
    return text ? [{ kind: 'plain', text }] : []
  }
  const out = []
  let last = 0
  for (const sp of spans) {
    if (sp.start > last) out.push({ kind: 'plain', text: text.slice(last, sp.start) })
    out.push({ kind: 'match', text: text.slice(sp.start, sp.end) })
    last = sp.end
  }
  if (last < text.length) out.push({ kind: 'plain', text: text.slice(last) })
  return out
}
