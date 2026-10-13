// HTML decoding / tag round-tripping. The escape helper is re-exported
// from ./highlight.js so the whole project has a single `escapeHtml`
// function (one less place for the encoding rules to drift).
//
// `decodeHtmlEntities` and `removeHtmlTags` rely on DOMParser — fine in
// the browser; jest+jsdom provides it for tests.

import { escapeHtml } from './highlight.js'
export { escapeHtml }

// Decode HTML entities (&amp;, &lt;, …) into their literal characters.
// Internally builds a throwaway HTML document so the browser's own parser
// handles every documented entity without us shipping a lookup table.
export function decodeHtmlEntities(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return doc.body.textContent
}

// Strip every HTML tag from `text` AND decode any entities in the
// remaining body — useful when normalising captured subtitle blobs that
// may contain stray `<i>` / `&amp;`.
export function removeHtmlTags(text) {
  return decodeHtmlEntities(String(text == null ? '' : text).replace(/<\/?[^>]+>/g, ''))
}

// Replace every tag in `text` with a fresh placeholder token so the body
// can be safely processed (e.g. word-splitting for wiki links) without
// the tags getting torn apart. Returns `[decodedText, encodings]` where
// `encodings` maps original tag → placeholder; call `decodeHtmlTags`
// with that map to restore. `uuidFn` defaults to a small inline generator
// (good enough for opacity; pass `data-structures.js`'s uuid in
// production for sturdier ids).
export function encodeHtmlTags(text, uuidFn) {
  const _uuid = uuidFn || (() => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2))
  const m = String(text == null ? '' : text).matchAll(/<[^<>]+>/g)
  const matches = []
  for (const it of m) {
    if (it && it.length > 0) matches.push(it[0])
  }
  const encodings = {}
  Array.from(new Set(matches)).forEach(it => {
    encodings[it] = ` _${_uuid().replaceAll('-', '_')}_ `
  })
  let working = String(text == null ? '' : text)
  Object.keys(encodings).forEach(key => {
    working = working.replaceAll(key, encodings[key])
  })
  return [decodeHtmlEntities(working), encodings]
}

// Inverse of `encodeHtmlTags`: restore every placeholder in `text` back
// to the original tag using the `encodings` map produced by the encoder.
// The placeholder is `trim()`-compared because intermediate processing
// may have collapsed the surrounding whitespace.
// `mapTag`, when given, turns each original tag into what is put back (e.g.
// safeSubtitleTag).
export function decodeHtmlTags(text, encodings, mapTag) {
  let out = String(text == null ? '' : text)
  Object.keys(encodings || {}).forEach(key => {
    const enc = encodings[key]
    out = out.replaceAll(enc.trim(), mapTag ? mapTag(key) : key)
  })
  return out
}

// ---- subtitle and library text from data files ----
// Subtitle files, index names, vocabulary and playlists can come from
// another user's repo, so none of their text may reach the page as markup.

// The plain text of a fragment, escaped for HTML. Entities show as their
// characters (SRT files use e.g. &#9654;) and any tags are dropped. Plain
// text (no '&' or '<') skips the parser. Whitespace at the ends is kept (the
// parser would drop the leading part).
export function subtitleText(s) {
  const str = String(s == null ? '' : s)
  if (!/[&<]/.test(str)) return escapeHtml(str)
  const [, lead, body, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(str)
  return escapeHtml(lead + decodeHtmlEntities(body) + trail)
}

// The formatting tags subtitle files use (<b>, <i>, <u>, <em>, <strong>,
// <br>, <font color>) rebuilt without anything else; every other tag is
// dropped.
const SUB_TAGS = ['b', 'i', 'u', 'em', 'strong', 'font']
export function safeSubtitleTag(tag) {
  const t = String(tag == null ? '' : tag)
  let m = /^<\s*\/\s*([a-z]+)\s*>$/i.exec(t)
  if (m) return SUB_TAGS.includes(m[1].toLowerCase()) ? `</${m[1].toLowerCase()}>` : ''
  if (/^<\s*br\s*\/?\s*>$/i.test(t)) return '<br>'
  m = /^<\s*([a-z]+)(\s[^<>]*)?\/?\s*>$/i.exec(t)
  if (!m) return ''
  const name = m[1].toLowerCase()
  if (!SUB_TAGS.includes(name)) return ''
  if (name !== 'font') return `<${name}>`
  const c = /\bcolor\s*=\s*["']?(#?[a-z0-9]+)["']?/i.exec(m[2] || '')
  return c ? `<font color="${c[1]}">` : '<font>'
}

// Subtitle text as safe HTML: formatting tags kept (safeSubtitleTag), the
// rest as escaped text.
export function safeSubtitleHtml(s) {
  return String(s == null ? '' : s).split(/(<[^<>]+>)/g)
    .map((part, i) => (i % 2 ? safeSubtitleTag(part) : subtitleText(part)))
    .join('')
}
