// public/music-richtext.js
// A practice script's words are the teaching, so they are allowed a little markup: <b>, <i>, colour,
// a line break. This turns that text into HTML that is safe to assign, keeping an allowlist of tags and
// dropping everything else — while keeping the dropped tag's TEXT, so a typo costs you the emphasis and
// not the sentence.
//
// Rebuilt through the DOM rather than filtered with a regex. Sanitising HTML by pattern is the classic
// way to ship a hole: `<img src=x onerror=…>`, `<scr<script>ipt>`, an unclosed quote. Parsing first and
// then copying only what is recognised inverts that — anything the allowlist does not name cannot
// survive, because it is never written back.

// Tags a script may use. Deliberately small and inline-only: a step's prose is one line over the sheet,
// so block layout (tables, divs, headings) has nowhere to go, and none of it earns the risk.
export const ALLOWED_TAGS = new Set([
  'b', 'strong', 'i', 'em', 'u', 's', 'small', 'sub', 'sup',
  'code', 'kbd', 'mark', 'span', 'br',
]);

// `style` is the point of the feature — "play this <span style="color:#c00">softly</span>" — and `class`
// lets a script lean on the app's own styling. Everything else goes, which is what keeps event handlers
// (onerror, onclick…) and URL-bearing attributes (src, href, formaction) out by construction rather
// than by blocklist.
export const ALLOWED_ATTRS = new Set(['style', 'class']);

// A style value that cannot fetch or execute. `url(...)` reaches the network, and the older IE
// `expression(...)` ran script; both are refused outright rather than picked apart.
function safeStyle(value) {
  const v = String(value || '');
  return /url\s*\(|expression\s*\(|javascript:/i.test(v) ? null : v;
}

// `text` → HTML string safe to assign to innerHTML. Plain text comes back escaped, so a script that
// mentions `a < b` still reads as written.
export function safeHtml(text) {
  const src = String(text == null ? '' : text);
  if (!src) return '';
  // No markup at all is the common case — escape and skip the parse entirely.
  if (src.indexOf('<') < 0) return escapeText(src);
  let doc;
  try { doc = new DOMParser().parseFromString(`<body>${src}</body>`, 'text/html'); } catch (_) { return escapeText(src); }
  if (!doc || !doc.body) return escapeText(src);
  return copyChildren(doc.body);
}

function escapeText(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function copyChildren(parent) {
  let out = '';
  parent.childNodes.forEach((node) => { out += copyNode(node); });
  return out;
}

function copyNode(node) {
  if (node.nodeType === 3) return escapeText(node.nodeValue);          // text
  if (node.nodeType !== 1) return '';                                  // comment / anything else: gone
  const tag = node.tagName.toLowerCase();
  // An unknown tag contributes its children only: <div>keep this</div> keeps the words. A <script> or
  // <style> body is NOT text to keep — it is code, so the element and everything in it is dropped.
  if (!ALLOWED_TAGS.has(tag)) {
    return (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed')
      ? '' : copyChildren(node);
  }
  if (tag === 'br') return '<br>';
  let attrs = '';
  for (const at of node.attributes) {
    const name = at.name.toLowerCase();
    if (!ALLOWED_ATTRS.has(name)) continue;
    const value = name === 'style' ? safeStyle(at.value) : String(at.value);
    if (value == null) continue;
    attrs += ` ${name}="${escapeText(value)}"`;
  }
  return `<${tag}${attrs}>${copyChildren(node)}</${tag}>`;
}
