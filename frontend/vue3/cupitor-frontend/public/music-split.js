// public/music-split.js
// Split a MusicXML string that packs several pieces into one score (e.g. a book of etudes) into
// standalone per-piece MusicXML strings. Pure and DOM-based (DOMParser / XMLSerializer) so it runs
// unchanged in the browser and under jsdom in tests; no coupling to the app's store or renderer.
//
// How pieces are delimited: notation software (MuseScore) restarts measure numbering to 1 (or a 0
// pickup) at each section break. So a measure whose printed number drops to <= the previous one
// begins a new piece. The catch is that clef/key/time/divisions are only re-stated when they change:
// a later piece often inherits the clef declared pages earlier. We therefore carry the running
// attribute state forward and inject whatever a piece's opening <attributes> is missing, so every
// split piece is a valid standalone score.

// Canonical child order of <attributes> (MusicXML DTD). We keep injected elements in this order so
// strict parsers/renderers stay happy.
const ATTR_ORDER = ['footnote', 'level', 'divisions', 'key', 'time', 'staves', 'part-symbol',
  'instruments', 'clef', 'staff-details', 'transpose', 'directive', 'measure-style'];
const CARRY_SINGLE = ['divisions', 'key', 'time', 'staves', 'transpose']; // one each; clef handled per-number

// Start indices (into a part's measure list) of each piece. A new piece begins at index 0 and
// wherever a measure's number is <= the previous measure's number. Non-numeric numbers (NaN) are
// treated as continuations.
export function detectPieceBoundaries(numbers) {
  const starts = [];
  for (let i = 0; i < numbers.length; i++) {
    if (i === 0) { starts.push(0); continue; }
    const cur = numbers[i];
    const prev = numbers[i - 1];
    if (!Number.isNaN(cur) && !Number.isNaN(prev) && cur <= prev) starts.push(i);
  }
  return starts;
}

// How many pieces `xmlString` packs, without building a DOM — a cheap check for whether the "split"
// action even applies (used to decide whether to show the split control). Scans <measure number="…">
// attributes and counts numbering resets. Returns 0 when there are no measures (e.g. note-text).
export function countPieces(xmlString) {
  const numbers = [];
  const re = /<measure\b[^>]*\bnumber="([^"]*)"/g;
  let m;
  while ((m = re.exec(String(xmlString || '')))) numbers.push(parseInt(m[1], 10));
  return detectPieceBoundaries(numbers).length;
}

function text(node) { return node ? (node.textContent || '').trim() : ''; }

// A sensible default title prefix from a file name or title: drop music extensions, then take the
// segment after the last " - " / "_-_" / " — " separator — for a book named
// "12_Etudes_-_Ferdinand_Sor_op._6" that's the composer/opus "Ferdinand_Sor_op._6". No separator →
// the whole (extension-stripped) name.
export function defaultTitlePrefix(name) {
  let base = String(name || '').trim();
  while (/\.(xml|musicxml|mxl|mscz|txt)$/i.test(base)) base = base.replace(/\.(xml|musicxml|mxl|mscz|txt)$/i, '');
  const parts = base.split(/\s-\s|_-_|\s—\s/).map((s) => s.trim()).filter(Boolean);
  return (parts.length ? parts[parts.length - 1] : base).trim();
}

// Compose one piece's title from a prefix, running number, and (optional) tempo word.
export function pieceTitle(prefix, index, tempo) {
  const p = String(prefix || '').trim() || 'Piece';
  return `${p} — No. ${index}${tempo ? ` (${tempo})` : ''}`;
}

// Collapse whitespace and drop a single trailing period ("Allegro moderato." → "Allegro moderato").
function cleanTempo(s) { return (s || '').replace(/\s+/g, ' ').trim().replace(/\.$/, ''); }

// Place `node` among `parent`'s children according to ATTR_ORDER (append if it sorts last).
function insertInOrder(parent, node) {
  const idx = ATTR_ORDER.indexOf(node.nodeName);
  for (const kid of [...parent.children]) {
    if (ATTR_ORDER.indexOf(kid.nodeName) > idx) { parent.insertBefore(node, kid); return; }
  }
  parent.appendChild(node);
}

// The attribute elements in effect just BEFORE measure index `sIdx`, scanning that part's measures
// in document order. Clefs are keyed by their `number` (staff) so multi-staff scores carry each.
// Values are references into the ORIGINAL document (imported into the output doc when injected).
function runningStateBefore(measures, sIdx) {
  const state = { clefs: new Map() };
  for (let i = 0; i < sIdx; i++) {
    for (const attrs of measures[i].getElementsByTagName('attributes')) {
      for (const child of [...attrs.children]) {
        if (child.nodeName === 'clef') state.clefs.set(child.getAttribute('number') || '1', child);
        else if (CARRY_SINGLE.includes(child.nodeName)) state[child.nodeName] = child;
      }
    }
  }
  return state;
}

// Ensure the piece's first measure declares everything a standalone score needs, injecting from the
// carried `running` state only what the measure's own <attributes> doesn't already have.
function fillFirstMeasureAttributes(measureEl, running, outDoc) {
  let attrs = measureEl.getElementsByTagName('attributes')[0];
  if (!attrs) {
    attrs = outDoc.createElement('attributes');
    const print = measureEl.getElementsByTagName('print')[0];
    if (print) measureEl.insertBefore(attrs, print.nextSibling);
    else measureEl.insertBefore(attrs, measureEl.firstChild);
  }
  const hasChild = (tag) => [...attrs.children].some((c) => c.nodeName === tag);
  CARRY_SINGLE.forEach((tag) => {
    if (!hasChild(tag) && running[tag]) insertInOrder(attrs, outDoc.importNode(running[tag], true));
  });
  const haveClef = new Set([...attrs.children]
    .filter((c) => c.nodeName === 'clef').map((c) => c.getAttribute('number') || '1'));
  running.clefs.forEach((clef, num) => {
    if (!haveClef.has(num)) insertInOrder(attrs, outDoc.importNode(clef, true));
  });
}

function serialize(doc) {
  const body = new XMLSerializer().serializeToString(doc);
  return body.startsWith('<?xml') ? body : `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}

// Build the standalone source for one piece: clone the whole document, keep only this piece's
// measures in every part (with carried attributes on the first), retitle, and drop page credits.
function buildPieceSource(originalDoc, parts, range, title) {
  const runningPerPart = parts.map((part) =>
    runningStateBefore([...part.getElementsByTagName('measure')], range.start));

  const outDoc = originalDoc.cloneNode(true);
  const outParts = [...outDoc.getElementsByTagName('part')];
  outParts.forEach((part, pi) => {
    const measures = [...part.getElementsByTagName('measure')];
    measures.forEach((m, i) => { if (i < range.start || i >= range.end) part.removeChild(m); });
    const first = part.getElementsByTagName('measure')[0];
    if (first) fillFirstMeasureAttributes(first, runningPerPart[pi], outDoc);
  });

  // Retitle: the collection work-title on every page reads wrong for a single piece; use the piece
  // title, and remove <credit> (book cover / page decorations).
  const workTitle = outDoc.getElementsByTagName('work-title')[0];
  if (workTitle) workTitle.textContent = title;
  const moveTitle = outDoc.getElementsByTagName('movement-title')[0];
  if (moveTitle) moveTitle.textContent = title;
  [...outDoc.getElementsByTagName('credit')].forEach((c) => c.parentNode.removeChild(c));

  return serialize(outDoc);
}

// Split `xmlString` into per-piece sources. Returns { collectionTitle, pieces } where each piece is
// { index, title, tempo, measureStart, measureEnd, measureCount, source }. `measureStart/End` are
// 1-based positions in the original document order. `fallbackTitle` names pieces when the file has
// no work/movement title (e.g. the uploaded file name, or the piece being manually split). An
// explicit `prefix` overrides both (the split dialog passes the user's editable prefix here).
export function splitMusicXmlPieces(xmlString, { fallbackTitle = '', prefix = '' } = {}) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid MusicXML');

  const parts = [...doc.getElementsByTagName('part')];
  if (!parts.length) throw new Error('No <part> in MusicXML');

  const measures = [...parts[0].getElementsByTagName('measure')];
  const numbers = measures.map((m) => parseInt(m.getAttribute('number'), 10));
  const starts = detectPieceBoundaries(numbers);

  const collectionTitle = text(doc.getElementsByTagName('work-title')[0])
    || text(doc.getElementsByTagName('movement-title')[0]) || '';
  const resolvedPrefix = prefix || collectionTitle || fallbackTitle || 'Piece';

  // Single piece — return it as-is (no forced "No. 1").
  if (starts.length <= 1) {
    return {
      collectionTitle,
      pieces: [{
        index: 1, title: resolvedPrefix, tempo: '',
        measureStart: 1, measureEnd: measures.length, measureCount: measures.length,
        source: xmlString,
      }],
    };
  }

  const pieces = starts.map((start, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : measures.length;
    const range = { start, end };
    // Tempo: first bold <words> in the piece's opening measure(s) (a pickup can push it to the 2nd).
    let tempo = '';
    for (let i = start; i < Math.min(end, start + 2) && !tempo; i++) {
      const bold = [...measures[i].getElementsByTagName('words')]
        .find((w) => (w.getAttribute('font-weight') || '') === 'bold' && text(w));
      if (bold) tempo = cleanTempo(text(bold));
    }
    const n = k + 1;
    const title = pieceTitle(resolvedPrefix, n, tempo);
    return {
      index: n, title, tempo,
      measureStart: start + 1, measureEnd: end, measureCount: end - start,
      source: buildPieceSource(doc, parts, range, title),
    };
  });

  return { collectionTitle, pieces };
}
