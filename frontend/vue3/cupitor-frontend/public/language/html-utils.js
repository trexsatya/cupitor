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
export function decodeHtmlTags(text, encodings) {
  let out = String(text == null ? '' : text)
  Object.keys(encodings || {}).forEach(key => {
    const enc = encodings[key]
    out = out.replaceAll(enc.trim(), key)
  })
  return out
}
