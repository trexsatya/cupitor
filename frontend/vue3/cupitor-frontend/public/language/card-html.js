// HTML in manual cards.
//
// A card's Source / Target may be written as HTML. The text is stored as
// typed; this module decides how it is shown and what its plain words are.
//
// Shown through an allowlist rebuilt from a parse — never by filtering the
// string with patterns, which is how `<img onerror>` and friends get through.
// It matters here more than in most places: a card's text also arrives from
// captured subtitles and from sentences picked off arbitrary web pages, and is
// synced between devices, so it is not only ever what the person typed.
//
// Plain text — for search, translation, notifications and one-line previews —
// is the words with the markup taken off.

const INLINE = ['b', 'strong', 'i', 'em', 'u', 's', 'small', 'sub', 'sup',
  'code', 'kbd', 'mark', 'span', 'br', 'font', 'a', 'img']
const BLOCK = ['p', 'div', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th']
const ALLOWED = new Set([...INLINE, ...BLOCK])
const BLOCK_SET = new Set(BLOCK)
// Elements whose content is code or a whole other document, not words.
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template',
  'noscript', 'svg', 'math', 'frame', 'frameset', 'link', 'meta', 'base', 'form'])

const TAG_RE = new RegExp(`<\\/?(${[...ALLOWED].join('|')})(\\s[^<>]*)?\\/?>`, 'i')
const BLOCK_RE = new RegExp(`<\\/?(${BLOCK.join('|')})(\\s[^<>]*)?\\/?>`, 'i')

// Whether the text is meant as HTML: it uses at least one tag we know. A "<3"
// or "a < b" does not, and stays plain text shown as written.
export function isCardHtml(text) {
  return TAG_RE.test(String(text == null ? '' : text))
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

// A style that cannot fetch or run anything.
// Backslash escapes are refused outright: CSS reads `\75rl(` as `url(`.
// A fixed/sticky box could cover the app's own controls.
function safeStyle(v) {
  return /\\|url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|position\s*:\s*(fixed|sticky)/i.test(v) ? null : v
}
function safeHref(v) {
  return /^(https?:|mailto:)/i.test(String(v).trim()) ? String(v).trim() : null
}
function safeSrc(v) {
  const s = String(v).trim()
  return /^https?:/i.test(s) || /^data:image\/(png|jpe?g|gif|webp);/i.test(s) ? s : null
}

const ATTRS = {
  // No `class`: it would let a card borrow the app's own styling.
  '*': { style: safeStyle, title: v => v },
  a: { href: safeHref },
  img: { src: safeSrc, alt: v => v, width: v => (/^\d{1,4}%?$/.test(v) ? v : null), height: v => (/^\d{1,4}%?$/.test(v) ? v : null) },
  font: { color: v => (/^[#\w(),.\s%-]{1,40}$/.test(v) ? v : null) },
  td: { colspan: v => (/^\d{1,2}$/.test(v) ? v : null), rowspan: v => (/^\d{1,2}$/.test(v) ? v : null) },
  th: { colspan: v => (/^\d{1,2}$/.test(v) ? v : null), rowspan: v => (/^\d{1,2}$/.test(v) ? v : null) },
}

function parse(src) {
  try {
    const doc = new DOMParser().parseFromString(`<body>${src}</body>`, 'text/html')
    return doc && doc.body
  } catch (_) {
    return null
  }
}

function copy(node, breaks) {
  if (node.nodeType === 3) {
    const t = esc(node.nodeValue)
    return breaks ? t.replace(/\r?\n/g, '<br>') : t
  }
  if (node.nodeType !== 1) return ''
  const tag = node.tagName.toLowerCase()
  if (DROP.has(tag)) return ''
  if (!ALLOWED.has(tag)) return kids(node, breaks)
  if (tag === 'br') return '<br>'
  if (tag === 'hr') return '<hr>'
  let attrs = ''
  let hasHref = false
  for (const at of node.attributes) {
    const name = at.name.toLowerCase()
    const check = (ATTRS[tag] && ATTRS[tag][name]) || ATTRS['*'][name]
    if (!check) continue
    const v = check(at.value)
    if (v == null) continue
    if (name === 'href') hasHref = true
    attrs += ` ${name}="${esc(v)}"`
  }
  // A link leaves the app rather than replacing it.
  if (tag === 'a' && hasHref) attrs += ' target="_blank" rel="noopener noreferrer"'
  if (tag === 'img') return attrs.includes(' src=') ? `<img${attrs}>` : ''
  return `<${tag}${attrs}>${kids(node, breaks)}</${tag}>`
}

function kids(node, breaks) {
  let out = ''
  node.childNodes.forEach(n => { out += copy(n, breaks) })
  return out
}

// What to put in the page for this text: `{ html, isHtml }`. Plain text comes
// back escaped with its line breaks as they were — the card views show it
// with pre-wrap, as they always have. HTML comes back cleaned; its line breaks
// become <br> so a captured block of subtitle rows keeps its rows, unless it
// is laid out with block tags, where a line break is just source formatting.
export function cardHtml(text) {
  const src = String(text == null ? '' : text)
  if (!isCardHtml(src)) return { html: esc(src), isHtml: false }
  const body = parse(src)
  if (!body) return { html: esc(src), isHtml: false }
  return { html: kids(body, !BLOCK_RE.test(src)), isHtml: true }
}

function words(node, out) {
  if (node.nodeType === 3) { out.push(node.nodeValue); return }
  if (node.nodeType !== 1) return
  const tag = node.tagName.toLowerCase()
  if (DROP.has(tag)) return
  if (tag === 'br') { out.push('\n'); return }
  if (tag === 'img') { if (node.getAttribute('alt')) out.push(node.getAttribute('alt')); return }
  const block = BLOCK_SET.has(tag)
  if (block) out.push('\n')
  node.childNodes.forEach(n => words(n, out))
  if (block) out.push('\n')
}

// The card's words without markup, one line per line as it would be read.
// Plain text comes back untouched.
export function cardPlainText(text) {
  const src = String(text == null ? '' : text)
  if (!isCardHtml(src)) return src
  const body = parse(src)
  if (!body) return src
  const out = []
  body.childNodes.forEach(n => words(n, out))
  return out.join('')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}
