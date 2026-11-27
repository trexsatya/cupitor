// Beat numbers in time-signature units, independent of tempo and playback.
const EPS = 1e-6;
const rounded = n => Math.round(n * 1e6) / 1e6;

// Accent the notated meter, independent of a manually renamed counter. For
// asymmetric meters, only the unambiguous downbeat is assumed.
export function beatStrength(number, numerator, denominator) {
  if (Math.abs(number - Math.round(number)) > EPS) return 'weak';
  if (number === 1) return 'downbeat';
  const compound = numerator > 3 && numerator % 3 === 0 && (denominator === 8 || denominator === 16);
  if ((compound && (number - 1) % 3 === 0) || (numerator === 4 && number === 3)) return 'strong';
  return 'weak';
}

// `duration` and `beat` are quarter-note beats. Only the opening short bar is
// right-aligned to the meter: a one-quarter pickup in 4/4 starts on count 4.
export function measureBeatCounters({ measure, numerator = 4, denominator = 4, duration, pickup = false }) {
  if (!(numerator > 0 && denominator > 0 && duration > 0)) return [];
  const unit = 4 / denominator;
  const shift = pickup ? Math.max(0, numerator * unit - duration) : 0;
  const first = shift / unit;
  const slots = [];
  // Include an off-beat pickup's starting count (e.g. 4.5 for an eighth pickup).
  if (Math.abs(first - Math.round(first)) > EPS) slots.push(first);
  for (let k = Math.ceil(first - EPS); k * unit - shift < duration - EPS && slots.length < 128; k++) slots.push(k);
  return slots.map(k => ({
    key: `${measure}:${rounded(k + 1)}`, measure,
    number: rounded(k + 1), label: String(rounded(k + 1)), beat: rounded(k * unit - shift),
    strength: beatStrength(rounded(k + 1), numerator, denominator),
  }));
}

// Respect engraving's unequal spacing: interpolate between actual timed staff
// entries, rather than dividing the whole bar into equal pixel widths.
export function beatX(beat, anchors) {
  const points = anchors.filter(p => Number.isFinite(p.beat) && Number.isFinite(p.x)).sort((a, b) => a.beat - b.beat);
  if (!points.length) return null;
  if (beat <= points[0].beat + EPS) return points[0].x;
  for (let i = 1; i < points.length; i++) {
    if (beat <= points[i].beat + EPS) {
      const a = points[i - 1], b = points[i];
      return b.beat - a.beat < EPS ? b.x : a.x + (b.x - a.x) * (beat - a.beat) / (b.beat - a.beat);
    }
  }
  return points[points.length - 1].x;
}

export function copyBeatCounterEdits(edits) {
  const out = {};
  Object.keys(edits || {}).forEach(key => {
    const e = edits[key];
    if (!e || typeof e !== 'object') return;
    const v = {};
    if (typeof e.label === 'string') v.label = e.label.slice(0, 32);
    ['dx', 'dy'].forEach(k => { if (Number.isFinite(e[k])) v[k] = Math.max(-2000, Math.min(2000, e[k])); });
    if (e.hidden) v.hidden = true;
    if (Object.keys(v).length) out[key] = v;
  });
  return out;
}

// VexFlow's stave/note coordinates and OSMD's SVG viewBox share pixel units.
// Every SVG page gets its own layer; staves sharing a bar get ONE count row.
export function beatCounterLayout(osmd, container, { from = 1, to = Infinity } = {}) {
  const pages = [...container.querySelectorAll('svg')];
  const sources = (osmd.Sheet && osmd.Sheet.SourceMeasures) || [];
  const list = (osmd.graphic && osmd.graphic.measureList) || [];
  const rows = [];
  const lineBottoms = new Map();
  const sourceNumbers = new Map(sources.map((s, i) => [s, i + 1]));
  list.forEach((staves, index) => {
    const first = (staves || []).find(Boolean);
    if (!first) return;
    const source = first.parentSourceMeasure || sources[index];
    // OSMD numbers a pickup as 0. Storage and draw-range options use sequential
    // bar indices, so never use SourceMeasure.MeasureNumber as the edit key.
    const measure = sourceNumbers.get(source);
    if (!source || !Number.isFinite(measure) || measure < from || measure > to) return;
    const duration = source.Duration && source.Duration.RealValue * 4;
    const ts = source.ActiveTimeSignature;
    const counters = measureBeatCounters({ measure, duration,
      numerator: ts ? ts.Numerator : 4, denominator: ts ? ts.Denominator : 4,
      pickup: source === sources[0] });
    if (!counters.length) return;
    const anchors = new Map();
    let svg = null, bottom = -Infinity, staffBottom = -Infinity, start = Infinity, end = -Infinity;
    (staves || []).filter(Boolean).forEach(m => {
      const stave = m.getVFStave ? m.getVFStave() : m.stave;
      if (!stave) return;
      let connected = false;
      (m.staffEntries || []).forEach(entry => {
        const beat = entry.relInMeasureTimestamp && entry.relInMeasureTimestamp.RealValue * 4;
        (entry.graphicalVoiceEntries || []).forEach(voice => {
          if (voice.parentVoiceEntry && voice.parentVoiceEntry.IsGrace) return;
          (voice.notes || []).forEach(note => {
            if (note.sourceNote && note.sourceNote.IsGraceNote) return;
            const vf = note.vfnote && note.vfnote[0];
            const el = vf && vf.attrs && vf.attrs.el;
            if (!el || el.isConnected === false || !container.contains(el)) return;
            connected = true; svg = el.ownerSVGElement;
            // A whole-bar rest is centered, not a timed beat-zero anchor.
            if (note.sourceNote && (note.sourceNote.IsWholeMeasureRest
              || (typeof note.sourceNote.isWholeRest === 'function' && note.sourceNote.isWholeRest()))) return;
            if (!Number.isFinite(beat)) return;
            const heads = el.querySelectorAll('.vf-notehead');
            const head = heads[note.vfnoteIndex || 0] || heads[0];
            if (!head || !head.getBBox) return;
            let b; try { b = head.getBBox(); } catch (_) { return; }
            const x = b.x + b.width / 2;
            if (Number.isFinite(x) && b.width > 0) anchors.set(beat, Math.min(anchors.has(beat) ? anchors.get(beat) : Infinity, x));
          });
        });
      });
      if (!connected) return;
      start = Math.min(start, stave.getNoteStartX() + 5);
      end = Math.max(end, stave.getNoteEndX() - 5);
      bottom = Math.max(bottom, stave.getBottomLineY());
      staffBottom = Math.max(staffBottom, stave.getBottomLineY());
      // Keep counts below lyrics, low notes, and other engraved material.
      const box = m.PositionAndShape;
      if (box && box.AbsolutePosition && Number.isFinite(box.BorderBottom)) {
        bottom = Math.max(bottom, (box.AbsolutePosition.y + box.BorderBottom) * 10);
      }
    });
    if (!svg || !pages.includes(svg) || !Number.isFinite(bottom) || !(end > start)) return;
    if (!anchors.has(0)) anchors.set(0, start);
    anchors.set(duration, end);
    const points = [...anchors].map(([beat, x]) => ({ beat, x }));
    const line = `${pages.indexOf(svg)}:${Math.round(staffBottom * 100)}`;
    lineBottoms.set(line, Math.max(lineBottoms.get(line) || -Infinity, bottom));
    counters.forEach(c => rows.push({ ...c, svg, line, x: beatX(c.beat, points) }));
  });
  return rows.map(row => ({ ...row, y: lineBottoms.get(row.line) + 18 }));
}
