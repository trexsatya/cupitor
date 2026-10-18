// Pure span builder used by the search-result line highlighter
// (`highlightedText` in language.js). Given a text and a |-alternation
// pattern, returns a sorted, merged list of {start, end} spans that should
// be wrapped in <span class="highlight">…</span>.
//
// The algorithm mirrors `_highlightWordHtml` (Player/Practice) but with
// two search-result-specific rules:
//   • plain stem matches expand to the enclosing whitespace boundary, so
//     "design" still covers "designing"; regexes keep their exact spans
//   • multi-word phrases have priority over their constituent single
//     words — if any phrase matches, ONLY phrase spans are emitted, so
//     the "x y z|x|y|z" pattern doesn't light up the whole phrase AND
//     every standalone letter.
//
// Pure: no DOM, no globals, no HTML emission. The caller composes the HTML.

import { compileRegex, splitRegexAlternatives, hasPhraseWhitespace, relaxRegexSpaces, hasRegexSyntax } from '../regex-pattern.js'

function tryRe(src, flags) {
  try { return compileRegex(src, flags) } catch (_) { return null }
}
function tryBoundedRe(src) {
  try { return new RegExp(`(?<![\\p{L}\\p{N}])(?:${src})(?![\\p{L}\\p{N}])`, 'giu') }
  catch (_) { return tryRe(src, 'gi') }
}

function collect(re, text, expandWord = true) {
  const spans = []
  if (!re) return spans
  re.lastIndex = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex += re.unicode && text.codePointAt(re.lastIndex) > 0xFFFF ? 2 : 1
      continue
    }
    let x = m.index
    while (expandWord && x > 0 && !/\s/.test(text[x - 1])) x--
    let y = m.index + m[0].length
    while (expandWord && y < text.length && !/\s/.test(text[y])) y++
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
export function buildHighlightSpans(text, pattern, regexMode = false) {
  // Keep the complete expression: splitting alternatives would change capture
  // numbering, alternation precedence and which branches are highlighted.
  if (regexMode) return mergeSpans(collect(tryRe(relaxRegexSpaces(pattern), 'gi'), text, false))
  const tokens = splitRegexAlternatives(pattern).map(t => t.trim()).filter(t => t && tryRe(t, 'gi'))
  if (!tokens.length) return []

  const multiWord  = tokens.filter(hasPhraseWhitespace)
  const singleWord = tokens.filter(t => !hasPhraseWhitespace(t))

  // 1) Multi-word phrases first. Internal spaces relax to \s+.
  let spans = multiWord.length
    ? multiWord.flatMap(t => collect(tryRe(relaxRegexSpaces(t), 'gi'), text, !hasRegexSyntax(t)))
    : []

  // 2) Fall back to single-word matches when no phrase was found:
  //    • singleWord alts — UNBOUNDED so stems still highlight derived forms
  //    • sub-words split from multi-word phrases — BOUNDED via Unicode
  //      lookaround so short tokens like "i" don't light up inside "vi"
  if (!spans.length) {
    if (singleWord.length) {
      spans = spans.concat(singleWord.flatMap(t => collect(tryRe(t, 'gi'), text, !hasRegexSyntax(t))))
    }
    const subFromMulti = multiWord
      // Only plain phrases can fall back to individual words. Splitting a
      // regex such as "foo [^ ]+ bar" can turn its fragments into a new regex.
      .filter(t => !hasRegexSyntax(t))
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
