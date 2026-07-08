// public/fretboard-render.js
// Draws a horizontal guitar neck into a passed <svg>. Nut on the left, high-E string on top.
// Stateless and idempotent: clears the svg and redraws on every call. No globals.
import { noteAt } from './fretboard-core.js';

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

const COMMON_COLOR = '#e8820c';   // note held in common with the previous step
const ARROW_COLOR = '#5b2a86';    // movement direction when several notes share a string

// `labelMode` picks the text drawn inside each dot: 'fret' (the fret number) or 'note' (the note
// name sounding there). `label` is the current step's chord/step name, drawn as a title above the
// neck (empty → no title strip).
export function renderFretboard(svgEl, { trail = [], highlight = new Set(), arrows = [], labelMode = 'fret', label = '' } = {}) {
  while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

  const TITLE_H = label ? 24 : 0;   // headroom reserved for the chord-name title
  const width = PAD_LEFT + NUM_FRETS * FRET_W + 12;
  const height = TITLE_H + PAD_TOP + (STRING_COUNT - 1) * STRING_GAP + PAD_TOP;
  svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svgEl.setAttribute('width', width);
  svgEl.setAttribute('height', height);

  // Chord/step name for the current step, centered above the neck.
  if (label) {
    const title = htmlLabel({ x: width / 2, y: 18, fontSize: 15, anchor: 'middle',
      css: 'color:#1565c0;font-weight:700;', text: label });
    title.setAttribute('class', 'fb-title');
    svgEl.appendChild(title);
  }

  // The neck lives in a group shifted below the title strip so all the existing y-math (stringY,
  // PAD_TOP, height) stays as-is; only the group is translated.
  const g = el('g', TITLE_H ? { transform: `translate(0, ${TITLE_H})` } : {});
  svgEl.appendChild(g);

  // Fretboard background.
  g.appendChild(el('rect', { x: PAD_LEFT, y: PAD_TOP - 6, width: NUM_FRETS * FRET_W,
    height: (STRING_COUNT - 1) * STRING_GAP + 12, fill: '#f3ead7', stroke: '#cbb994' }));

  // Nut (thick) + fret lines.
  for (let f = 0; f <= NUM_FRETS; f++) {
    const x = PAD_LEFT + f * FRET_W;
    g.appendChild(el('line', { x1: x, y1: PAD_TOP - 6, x2: x, y2: PAD_TOP - 6 + (STRING_COUNT - 1) * STRING_GAP + 12,
      stroke: f === 0 ? '#6b5836' : '#cbb994', 'stroke-width': f === 0 ? 4 : 1, class: 'fb-fret' }));
  }

  // Strings + labels.
  for (let s = 1; s <= STRING_COUNT; s++) {
    const y = stringY(s);
    g.appendChild(el('line', { x1: PAD_LEFT, y1: y, x2: PAD_LEFT + NUM_FRETS * FRET_W, y2: y,
      stroke: '#b9a886', 'stroke-width': 1, class: 'fb-string' }));
    g.appendChild(htmlLabel({ x: 4, y: y + 4, fontSize: 11, css: 'color:#6b5836;', text: STRING_LABELS[s - 1] }));
  }

  // Fret-number axis.
  for (let f = 1; f <= NUM_FRETS; f++) {
    g.appendChild(htmlLabel({ x: fretX(f), y: (height - TITLE_H) - 2, fontSize: 9, anchor: 'middle', css: 'color:#999;', text: '' + f }));
  }

  // Dots, oldest first so the current step paints on top.
  [...trail].sort((a, b) => b.age - a.age).forEach((entry) => {
    if (!entry.voicing) return;
    const opacity = Math.max(MIN_OPACITY, 1 - entry.age * FADE_STEP);
    entry.voicing.forEach((p) => {
      const cx = fretX(p.fret);
      const cy = stringY(p.string);
      // Current-step notes held in common with the previous step are drawn in a distinct color
      // (with a ring) so the held/common note stands out while stepping.
      const isCommon = entry.age === 0 && highlight.has(`${p.string}:${p.fret}`);
      g.appendChild(el('circle', { cx, cy, r: DOT_R, fill: isCommon ? COMMON_COLOR : '#1565c0', opacity,
        ...(isCommon ? { stroke: '#7a3d00', 'stroke-width': 2 } : {}),
        'data-age': entry.age, class: isCommon ? 'fb-dot fb-dot-common' : 'fb-dot' }));
      const text = labelMode === 'note' ? ((noteAt(p.string, p.fret) || {}).name || '' + p.fret) : '' + p.fret;
      const num = htmlLabel({ x: cx, y: cy, fontSize: 9, anchor: 'middle', vAlign: 'middle',
        css: `color:#fff;font-weight:700;opacity:${opacity};`, text });
      num.setAttribute('class', 'fb-dot-label');
      g.appendChild(num);
    });
  });

  // Movement arrows: a horizontal arrow just above a string that carries several notes, spanning
  // its min→max fret. Head at the higher fret for 'up', lower for 'down', both ends for 'bi'.
  arrows.forEach((a) => {
    const y = stringY(a.string) - (DOT_R + 5);
    const x1 = fretX(a.minFret);
    const x2 = fretX(a.maxFret);
    // The `fb-arrow-line` + direction class drive the CSS flow/pulse animation (defined in the page).
    g.appendChild(el('line', { x1, y1: y, x2, y2: y, stroke: ARROW_COLOR, 'stroke-width': 2,
      class: `fb-arrow fb-arrow-line ${a.dir}` }));
    const head = (x, pointLeft) => {
      const d = 6;
      const pts = pointLeft ? `${x},${y} ${x + d},${y - 4} ${x + d},${y + 4}` : `${x},${y} ${x - d},${y - 4} ${x - d},${y + 4}`;
      g.appendChild(el('polygon', { points: pts, fill: ARROW_COLOR, class: 'fb-arrow fb-arrowhead' }));
    };
    if (a.dir === 'up' || a.dir === 'bi') head(x2, false);   // toward higher fret (right)
    if (a.dir === 'down' || a.dir === 'bi') head(x1, true);  // toward the nut (left)
  });
}
