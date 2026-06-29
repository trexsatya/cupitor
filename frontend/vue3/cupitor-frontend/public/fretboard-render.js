// public/fretboard-render.js
// Draws a horizontal guitar neck into a passed <svg>. Nut on the left, high-E string on top.
// Stateless and idempotent: clears the svg and redraws on every call. No globals.
const SVG_NS = 'http://www.w3.org/2000/svg';

const NUM_FRETS = 12;          // drawn fret columns (1..12); fret 0 = the open column left of the nut
const STRING_COUNT = 6;
const PAD_LEFT = 44;           // room for the open column + string labels
const PAD_TOP = 16;
const FRET_W = 38;             // px per fret
const STRING_GAP = 26;         // px between strings
const DOT_R = 9;
const MIN_OPACITY = 0.16;
const FADE_STEP = 0.28;        // opacity lost per step of age
const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E']; // top→bottom = string 1..6

function el(tag, attrs) {
  const n = document.createElementNS(SVG_NS, tag);
  Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
  return n;
}

// A label as an HTML <div> inside an SVG <foreignObject>, NOT an SVG <text>: on Android/Blink the
// glyph layout of an SVG <text> collapses after a web font loads, so the labels vanish. HTML text
// doesn't have that bug. `anchor`/`vAlign` place the box; `y` is the text baseline (or centre when
// vAlign === 'middle', for a number centred in a dot). Mirrors svgHtmlLabel in music-render.js.
function htmlLabel({ x, y, fontSize, anchor = 'start', vAlign = 'baseline', css = '', text }) {
  const fo = document.createElementNS(SVG_NS, 'foreignObject');
  const w = 60, h = Math.ceil(fontSize * 1.7);
  fo.setAttribute('x', anchor === 'middle' ? x - w / 2 : x);
  fo.setAttribute('y', vAlign === 'middle' ? y - h / 2 : y - fontSize);
  fo.setAttribute('width', w);
  fo.setAttribute('height', h);
  fo.setAttribute('overflow', 'visible');
  const div = document.createElement('div');
  div.textContent = text;
  div.setAttribute('style',
    `font:${fontSize}px monospace;line-height:${h}px;white-space:nowrap;`
    + (anchor === 'middle' ? 'text-align:center;' : '') + css);
  fo.appendChild(div);
  return fo;
}

// y for a 1-based string number (1 = high-E at top).
function stringY(string) { return PAD_TOP + (string - 1) * STRING_GAP; }
// x-center for a fret: fret 0 sits in the open column left of the nut; fret N centers in its cell.
function fretX(fret) { return fret === 0 ? PAD_LEFT - 22 : PAD_LEFT + (fret - 0.5) * FRET_W; }

export function renderFretboard(svgEl, { trail = [] } = {}) {
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  const width = PAD_LEFT + NUM_FRETS * FRET_W + 12;
  const height = PAD_TOP + (STRING_COUNT - 1) * STRING_GAP + PAD_TOP;
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svgEl.setAttribute('width', width);
  svgEl.setAttribute('height', height);

  // Fretboard background.
  svgEl.appendChild(el('rect', { x: PAD_LEFT, y: PAD_TOP - 6, width: NUM_FRETS * FRET_W,
    height: (STRING_COUNT - 1) * STRING_GAP + 12, fill: '#f3ead7', stroke: '#cbb994' }));

  // Nut (thick) + fret lines.
  for (let f = 0; f <= NUM_FRETS; f++) {
    const x = PAD_LEFT + f * FRET_W;
    svgEl.appendChild(el('line', { x1: x, y1: PAD_TOP - 6, x2: x, y2: PAD_TOP - 6 + (STRING_COUNT - 1) * STRING_GAP + 12,
      stroke: f === 0 ? '#6b5836' : '#cbb994', 'stroke-width': f === 0 ? 4 : 1, class: 'fb-fret' }));
  }

  // Strings + labels.
  for (let s = 1; s <= STRING_COUNT; s++) {
    const y = stringY(s);
    svgEl.appendChild(el('line', { x1: PAD_LEFT, y1: y, x2: PAD_LEFT + NUM_FRETS * FRET_W, y2: y,
      stroke: '#b9a886', 'stroke-width': 1, class: 'fb-string' }));
    svgEl.appendChild(htmlLabel({ x: 4, y: y + 4, fontSize: 11, css: 'color:#6b5836;', text: STRING_LABELS[s - 1] }));
  }

  // Fret-number axis.
  for (let f = 1; f <= NUM_FRETS; f++) {
    svgEl.appendChild(htmlLabel({ x: fretX(f), y: height - 2, fontSize: 9, anchor: 'middle', css: 'color:#999;', text: '' + f }));
  }

  // Dots, oldest first so the current step paints on top.
  [...trail].sort((a, b) => b.age - a.age).forEach((entry) => {
    if (!entry.voicing) return;
    const opacity = Math.max(MIN_OPACITY, 1 - entry.age * FADE_STEP);
    entry.voicing.forEach((p) => {
      const cx = fretX(p.fret);
      const cy = stringY(p.string);
      svgEl.appendChild(el('circle', { cx, cy, r: DOT_R, fill: '#1565c0', opacity,
        'data-age': entry.age, class: 'fb-dot' }));
      const num = htmlLabel({ x: cx, y: cy, fontSize: 9, anchor: 'middle', vAlign: 'middle',
        css: `color:#fff;font-weight:700;opacity:${opacity};`, text: '' + p.fret });
      num.setAttribute('class', 'fb-dot-label');
      svgEl.appendChild(num);
    });
  });
}
