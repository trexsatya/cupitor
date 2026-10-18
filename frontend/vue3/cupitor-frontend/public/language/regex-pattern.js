// Syntax shared by subtitle matching and highlighting. Regex escapes and
// character classes must survive phrase/alternative handling unchanged.
const ATOMS = /\\[\s\S]|\[(?:\\[\s\S]|[^\]\\])*\]/g
const SPACES = /\\[\s\S]|\[(?:\\[\s\S]|[^\]\\])*\]| +/g

export function splitRegexAlternatives(pattern) {
  const text = String(pattern || ''), tokens = []
  let start = 0, inClass = false, depth = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\\') { i++; continue }
    if (inClass) { if (ch === ']') inClass = false; continue }
    if (ch === '[') inClass = true
    else if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    else if (ch === '|' && depth === 0) {
      tokens.push(text.slice(start, i)); start = i + 1
    }
  }
  tokens.push(text.slice(start))
  return tokens
}

export function hasRegexSyntax(pattern) {
  return /[\\^$.*+?()[\]{}|]/.test(String(pattern || ''))
}

export function isTypedRegex(pattern) {
  const text = String(pattern || '')
  // These are vocabulary expansion/hint conventions, prepared by that path.
  return !text.includes('<*') && !/\((?:ngt|ngn|sl-pl|pl)\)/.test(text) && hasRegexSyntax(text)
}

export function hasPhraseWhitespace(pattern) {
  return /\s/.test(String(pattern || '').replace(ATOMS, ''))
}

export function relaxRegexSpaces(pattern) {
  return String(pattern || '').replace(SPACES, part => part[0] === ' ' ? '\\s+' : part)
}

export function compileRegex(pattern, flags = 'i') {
  const plainFlags = flags.replace(/u/g, '')
  try { return new RegExp(pattern, plainFlags + 'u') }
  catch (error) {
    // An invalid property escape must not silently become a literal p/P match.
    if (/\\[pP]\{/.test(pattern)) throw error
    return new RegExp(pattern, plainFlags)
  }
}
