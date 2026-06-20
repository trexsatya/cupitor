// public/music-render.js
// Rendering for the music study app: pure measure-mapping helpers (TDD) +
// a thin OSMD wrapper (injectable factory) for whole-piece / segment rendering.
import { primaryVoice } from './music-encoding.js';
import { guessChords, guessChordAreas } from './music-chords.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Readable, deterministic palette for coloring voices in the rendered sheet.
const VOICE_COLORS = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#17becf'];
const DEFAULT_NOTE_COLOR = '#000000';
const CHORD_HL_COLOR = '#ffcc00';   // notes of a clicked chord chip, highlighted in yellow
const DIM_CONNECTOR_COLOR = '#d6d6d6';   // faint grey for beams/stems/slurs so noteheads stand out
// Pure: a stable color for a 0-based voice index, cycling past the palette length.
export function voiceColor(index) {
  const n = VOICE_COLORS.length;
  const i = (((index | 0) % n) + n) % n;
  return VOICE_COLORS[i];
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Pure: MIDI number → English/scientific note name with sharps, e.g. 60 → 'C4'. '' for null/NaN.
export function noteName(midi) {
  if (midi == null || !Number.isFinite(midi)) return '';
  const m = Math.round(midi);
  const pc = ((m % 12) + 12) % 12;
  const octave = Math.floor(m / 12) - 1;
  return PITCH_NAMES[pc] + octave;
}

// Map a primary-voice note-index range to a 1-based [startMeasure, endMeasure].
export function measureRangeFromNoteRange(detail, noteRange) {
  if (!noteRange) return null;
  const v = primaryVoice(detail);
  const n = v.pitch.length;
  if (!n) return null;
  const lo = clamp(noteRange[0], 0, n - 1);
  const hi = clamp(noteRange[1], 0, n - 1);
  return [v.measureIndex[lo], v.measureIndex[hi]];
}

// Reconstruct the index's collapsed chord list with measure spans. Replicates
// buildIndexEntry's walk (all voices in order; push a non-empty chordSymbol only when
// it differs from the previously pushed one) so Phase-1 chord-range indices line up.
// Measure spans are best-effort: for multi-voice pieces buildIndexEntry concatenates
// voices, so a span may carry the measures of its first occurrence — adequate for
// locating the segment, and pinned to the index by a test.
export function collapsedChordSpans(detail) {
  const spans = [];
  (detail.voices || []).forEach(v => {
    (v.chordSymbol || []).forEach((c, i) => {
      if (!c) return;
      const meas = v.measureIndex[i];
      const last = spans[spans.length - 1];
      if (last && last.symbol === c) {
        if (meas > last.measureEnd) last.measureEnd = meas;
      } else {
        spans.push({ symbol: c, measureStart: meas, measureEnd: meas });
      }
    });
  });
  return spans;
}

// Convert a Phase-1 chord match range (indices into the collapsed chord list) to a
// non-inverted 1-based [startMeasure, endMeasure]. For multi-voice pieces the collapsed
// list spans several voices whose measures aren't globally monotonic, so we take the
// MIN start / MAX end across the matched spans — a valid covering range (never inverted).
// Single-voice pieces (the common case) collapse to the exact tight range.
export function measureRangeFromChordMatch(detail, chordRange) {
  const spans = collapsedChordSpans(detail);
  if (!spans.length || !chordRange) return null;
  const lo = clamp(chordRange[0], 0, spans.length - 1);
  const hi = clamp(chordRange[1], 0, spans.length - 1);
  let start = Infinity, end = -Infinity;
  for (let i = Math.min(lo, hi); i <= Math.max(lo, hi); i++) {
    if (spans[i].measureStart < start) start = spans[i].measureStart;
    if (spans[i].measureEnd > end) end = spans[i].measureEnd;
  }
  return [start, end];
}

// Map a query result's match to a 1-based measure range, dispatching on match.kind.
export function resolveMatchMeasures(detail, match) {
  if (!detail || !match) return null;
  if (match.kind === 'chord') return measureRangeFromChordMatch(detail, match.range);
  return measureRangeFromNoteRange(detail, match.range);
}

// OSMD zoom factor from viewport width: 1.0 at >= BASELINE px, scaling down to a 0.4 floor.
const ZOOM_BASELINE_PX = 900;
export function responsiveZoom(viewportWidth) {
  return clamp(viewportWidth / ZOOM_BASELINE_PX, 0.4, 1.0);
}

// Thin OSMD wrapper. opts.osmdFactory(container) lets tests inject a spy; in the browser
// it defaults to the global OpenSheetMusicDisplay. Visual output is browser-verified;
// this wrapper's method/argument contract is unit-tested via an injected fake.
export function createMusicRenderer(container, opts = {}) {
  const factory = opts.osmdFactory || ((c) => new opensheetmusicdisplay.OpenSheetMusicDisplay(c));
  const osmd = factory(container);
  osmd.setOptions({ backend: 'svg', drawingParameters: 'compacttight', drawTitle: false });
  const onAfterRender = opts.onAfterRender;   // called after each render (lets the UI rebuild chord chips)
  const onChordSelect = opts.onChordSelect;   // called on a user chord-label click with the selected names
  let totalMeasures = 0;
  let colorVoices = true;    // voices are colored by default; the UI checkbox starts checked
  let noteNames = false;
  let showChords = false;        // draw stacked chord-candidate labels above each chord area
  let dimConnectors = true;      // grey out beams/stems/slurs by default to cut visual noise
  const selectedChords = new Set();   // manually-picked best-match chord names (multi-select; persisted per vocab item)
  let measureHighlight = null;   // [from,to] of a captured vocab range to shade behind the notes
  let shownFrom = 1;             // 1-based first measure of the currently drawn window
  let shownTo = Number.MAX_SAFE_INTEGER;   // ...and the last (chords/highlight clip to this)

  // Push per-voice NoteheadColor onto the OSMD model so it survives re-renders.
  // No-op on a sheet without instruments (e.g. the test fake / before load).
  function applyVoiceColors() {
    const instruments = osmd.Sheet && osmd.Sheet.Instruments;
    if (!instruments || !instruments.forEach) return;
    let vi = 0;
    instruments.forEach((instr) => {
      (instr.Voices || []).forEach((voice) => {
        const color = colorVoices ? voiceColor(vi) : DEFAULT_NOTE_COLOR;
        (voice.VoiceEntries || []).forEach((ve) => {
          (ve.Notes || []).forEach((note) => { note.NoteheadColor = color; });
        });
        vi++;
      });
    });
  }

  // Overlay English/scientific note names on the rendered SVG. Removed + rebuilt on every
  // render. No-op when there's no DOM container / rendered graphic (test fakes, jsdom).
  // OSMD's Pitch.getHalfTone() + 12 is the MIDI number (C4 → 48 + 12 = 60).
  function applyNoteNames() {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.note-name-layer').forEach((n) => n.remove());
    if (!noteNames) return;
    const measureList = osmd.graphic && osmd.graphic.measureList;
    const svg = container.querySelector('svg');
    if (!measureList || !measureList.forEach || !svg) return;
    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('class', 'note-name-layer');
    measureList.forEach((measures) => {
      (measures || []).forEach((measure) => {
        ((measure && measure.staffEntries) || []).forEach((se) => {
          (se.graphicalVoiceEntries || []).forEach((gve) => {
            (gve.notes || []).forEach((gnote) => {
              const pitch = gnote.sourceNote && gnote.sourceNote.Pitch;
              if (!pitch || typeof pitch.getHalfTone !== 'function') return; // rest / no pitch
              const label = noteName(pitch.getHalfTone() + 12);
              if (!label) return;
              const vf = gnote.vfnote;
              const el = vf && vf[0] && vf[0].attrs && vf[0].attrs.el;
              if (!el || !el.querySelectorAll) return;
              const heads = el.querySelectorAll('.vf-notehead');
              const head = heads[gnote.vfnoteIndex || 0] || heads[0];
              if (!head || !head.getBBox) return;
              const b = head.getBBox();
              const t = document.createElementNS(SVG_NS, 'text');
              t.setAttribute('x', b.x + b.width / 2);
              t.setAttribute('y', b.y - 2);
              t.setAttribute('text-anchor', 'middle');
              t.setAttribute('font-size', '7');
              t.setAttribute('fill', '#444');
              t.textContent = label;
              layer.appendChild(t);
            });
          });
        });
      });
    });
    svg.appendChild(layer);
  }

  // A VexFlow key ("c#/4") → pitch-class name ("C#"), preserving the notated accidental so
  // it matches the key-spelled chord tones in allChords.
  function vexKeyToPitchClass(key) {
    if (!key || typeof key !== 'string') return null;
    const pc = key.split('/')[0];
    if (!pc) return null;
    // Uppercase the letter, keep the accidental, and drop VexFlow's explicit natural marker
    // ("cn" → "C") so the name matches the key-spelled tones in allChords.
    const name = (pc[0].toUpperCase() + pc.slice(1)).replace(/n/g, '');
    return name || null;
  }

  // Walk the rendered SVG → { measureNumber: [{ name, left, el }] }, where `el` is the
  // notehead group element (so chord chips can highlight the notes that formed them).
  function renderedNotesByMeasure() {
    const byMeasure = {};
    const measureList = osmd.graphic && osmd.graphic.measureList;
    if (!measureList || !measureList.forEach) return byMeasure;
    // measureList is [measureIndex][staffIndex]. Key by each measure's absolute number and keep
    // only the currently rendered window — OSMD's measureList can hold every measure even when
    // just a segment is drawn, so chords must be restricted to [shownFrom, shownTo].
    measureList.forEach((measures, a) => {
      const num = absoluteMeasureNumber(measures, a, measureList.length);
      if (num < shownFrom || num > shownTo) return;
      (measures || []).forEach((measure) => {
        ((measure.staffEntries) || []).forEach((se) => {
          (se.graphicalVoiceEntries || []).forEach((gve) => {
            (gve.notes || []).forEach((gnote) => {
              const vf = gnote.vfnote;
              const root = vf && vf[0] && vf[0].attrs && vf[0].attrs.el;
              if (!root || !root.querySelectorAll) return;
              const idx = gnote.vfnoteIndex || 0;
              const heads = root.querySelectorAll('.vf-notehead');
              const el = heads[idx] || heads[0];
              const name = vexKeyToPitchClass(vf[0].keys && vf[0].keys[idx]);
              if (!el || !name) return;
              const b = el.getBBox ? el.getBBox() : { x: 0 };
              (byMeasure[num] = byMeasure[num] || []).push({ name, left: b.x, el });
            });
          });
        });
      });
    });
    return byMeasure;
  }

  // Restore any notehead paths recolored by a previous chord highlight — both the fill
  // attribute and the inline style (OSMD's voice colors set the inline style, which wins).
  function clearHighlight() {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('path[data-chord-orig]').forEach((p) => {
      p.setAttribute('fill', p.getAttribute('data-chord-orig'));
      p.style.fill = p.getAttribute('data-chord-orig-style') || '';
      p.removeAttribute('data-chord-orig');
      p.removeAttribute('data-chord-orig-style');
    });
  }

  // Recolor (in yellow) the noteheads that formed a chord; replaces any prior highlight. Sets
  // both the fill attribute and the inline style so it wins over OSMD's voice-color style.
  function highlightChord(notes) {
    clearHighlight();
    (notes || []).forEach((nt) => {
      const el = nt && nt.el;
      if (!el || !el.querySelectorAll) return;
      el.querySelectorAll('path').forEach((p) => {
        if (!p.hasAttribute('data-chord-orig')) {
          p.setAttribute('data-chord-orig', p.getAttribute('fill') || '');
          p.setAttribute('data-chord-orig-style', p.style.fill || '');
        }
        p.setAttribute('fill', CHORD_HL_COLOR);
        p.style.fill = CHORD_HL_COLOR;
      });
    });
  }

  // Overlay stacked chord-candidate labels above each detected chord area. Each area shows its
  // best few chords (closest to the staff = best); clicking a label highlights that chord's
  // notes. Removed + rebuilt every render. No-op without a DOM svg (test fakes, jsdom).
  const CHORD_LAYER_CLASS = 'chord-area-layer';
  const MIN_LABEL_GAP = 30;        // min horizontal spacing between label columns (de-crowd)
  const MAX_LABELS_PER_AREA = 2;   // cap the vertical stack so labels don't pile up

  // svg-user-space anchor for an area's labels: its leftmost contributing notehead mapped
  // through the element's CTM, so labels line up even when OSMD applies a zoom/translate
  // transform (raw getBBox coords are in the notehead's local space, not the svg root's).
  function chordAnchorXY(area) {
    let anchor = null;
    area.chords.forEach((ch) => (ch.notes || []).forEach((n) => {
      if (n && n.el && (anchor === null || (n.left || 0) < (anchor.left || 0))) anchor = n;
    }));
    if (anchor && anchor.el && anchor.el.getBBox) {
      const b = anchor.el.getBBox();
      const m = anchor.el.getCTM && anchor.el.getCTM();
      if (m) return { x: m.a * b.x + m.c * b.y + m.e, y: m.b * b.x + m.d * b.y + m.f };
      return { x: b.x, y: b.y };
    }
    return { x: area.x, y: area.top };
  }

  function applyChordOverlay() {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.' + CHORD_LAYER_CLASS).forEach((n) => n.remove());
    if (!showChords) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    const byMeasure = renderedNotesByMeasure();
    const stream = [];
    Object.keys(byMeasure).forEach((m) => { stream.push(...byMeasure[m]); });
    const areas = guessChordAreas(stream, undefined, { maxPerArea: MAX_LABELS_PER_AREA });
    if (!areas.length) return;
    // Highlight the selected chords' notes regardless of which labels we end up drawing.
    let selectedNotes = [];
    areas.forEach((area) => area.chords.forEach((ch) => {
      if (selectedChords.has(ch.name)) selectedNotes = selectedNotes.concat(ch.notes);
    }));
    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('class', CHORD_LAYER_CLASS);
    // Lay out columns left→right, skipping any that would crowd the previous one.
    const cols = areas.map((area) => ({ area, ...chordAnchorXY(area) })).sort((a, b) => a.x - b.x);
    let lastX = -Infinity;
    cols.forEach(({ area, x, y }) => {
      if (x - lastX < MIN_LABEL_GAP) return;   // too close → skip to de-crowd
      lastX = x;
      area.chords.forEach((ch, k) => {
        const isSel = selectedChords.has(ch.name);
        const t = document.createElementNS(SVG_NS, 'text');
        t.setAttribute('x', x);
        t.setAttribute('y', y - 6 - k * 11);   // stack upward; best (k=0) nearest the notes
        t.setAttribute('font-size', isSel ? '11' : '9');
        t.setAttribute('font-weight', '700');
        t.setAttribute('fill', isSel ? '#c62828' : '#1565c0');
        t.setAttribute('text-decoration', isSel ? 'underline' : 'none');
        t.setAttribute('style', 'cursor:pointer');
        t.textContent = (isSel ? '✓ ' : '') + ch.name;
        t.addEventListener('click', () => {
          if (selectedChords.has(ch.name)) selectedChords.delete(ch.name); else selectedChords.add(ch.name);
          applyChordOverlay();
          if (onChordSelect) { try { onChordSelect([...selectedChords]); } catch (_) {} }
        });
        layer.appendChild(t);
      });
    });
    svg.appendChild(layer);
    if (selectedNotes.length) highlightChord(selectedNotes); else clearHighlight();
  }

  // Absolute 1-based measure number for the a-th measure in the rendered measureList. Trust
  // the source measure's MeasureNumber; otherwise infer from whether the whole piece or just
  // a window is drawn (measureList holds either all measures or only the drawn ones).
  function absoluteMeasureNumber(measures, a, listLength) {
    const sm = measures && measures[0] && measures[0].parentSourceMeasure;
    if (sm && Number.isFinite(sm.MeasureNumber)) return sm.MeasureNumber;
    const full = listLength === (totalMeasures || listLength);
    return full ? a + 1 : shownFrom + a;
  }

  // Shade the captured measure range behind the notes. One translucent rect per matching
  // measure, sized from its VexFlow stave geometry (the same coordinates OSMD renders into,
  // per getMeasurePosition in the original analysis code) — robust across line breaks and
  // partial/segment renders. Removed + rebuilt on every render. No-op without a DOM svg / range.
  const MEASURE_HL_CLASS = 'measure-hl-layer';
  function applyMeasureHighlight() {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.' + MEASURE_HL_CLASS).forEach((n) => n.remove());
    if (!measureHighlight) return;
    const svg = container.querySelector('svg');
    const measureList = osmd.graphic && osmd.graphic.measureList;
    if (!svg || !measureList || !measureList.length) return;
    const [from, to] = measureHighlight;
    measureList.forEach((measures, a) => {
      const abs = absoluteMeasureNumber(measures, a, measureList.length);
      if (abs < from || abs > to) return;
      // Union the staves of this measure (a grand staff spans several) into one box.
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, ok = false;
      (measures || []).forEach((measure) => {
        const st = measure && measure.stave;
        if (!st) return;
        const left = (st.x != null ? st.x : st.start_x);
        const width = (st.width != null ? st.width : ((st.end_x || 0) - (st.start_x || 0)));
        const top = st.y;
        const height = (st.height != null ? st.height : 48);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return;
        ok = true;
        if (left < x1) x1 = left;
        if (left + width > x2) x2 = left + width;
        if (top < y1) y1 = top;
        if (top + height > y2) y2 = top + height;
      });
      if (!ok) return;
      const padY = 8;
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', MEASURE_HL_CLASS);
      rect.setAttribute('x', x1);
      rect.setAttribute('y', y1 - padY);
      rect.setAttribute('width', x2 - x1);
      rect.setAttribute('height', (y2 - y1) + 2 * padY);
      rect.setAttribute('fill', '#ffe9a8');
      rect.setAttribute('opacity', '0.5');
      rect.setAttribute('pointer-events', 'none');
      svg.insertBefore(rect, svg.firstChild);   // first child → painted behind the notes
    });
  }

  // Grey out the beams/stems/slurs (VexFlow vf-* groups) so the noteheads stand out. Re-applied
  // after each render (osmd.render() repaints them black); a no-op when off / without a DOM svg.
  function applyDimConnectors() {
    if (!dimConnectors || !container || !container.querySelectorAll) return;
    // Beams/stems/slurs/ties + the numeric annotations (string numbers, fret-hand fingerings).
    const groups = '.vf-beam, .vf-stem, .vf-slur, .vf-tie, .vf-stavetie, .vf-stringnumber, .vf-frethandfinger, .vf-fingering';
    container.querySelectorAll(groups).forEach((g) => {
      // Recolor the group itself (in case the class sits on the text/shape) and its drawables.
      [g, ...g.querySelectorAll('path, rect, polygon, line, text, tspan, circle')].forEach((el) => {
        const stroke = el.getAttribute('stroke');
        const fill = el.getAttribute('fill');
        const strokes = stroke && stroke !== 'none';
        const fills = fill && fill !== 'none';
        if (strokes || (!strokes && !fills)) { el.setAttribute('stroke', DIM_CONNECTOR_COLOR); el.style.stroke = DIM_CONNECTOR_COLOR; }
        if (fills || (!strokes && !fills)) { el.setAttribute('fill', DIM_CONNECTOR_COLOR); el.style.fill = DIM_CONNECTOR_COLOR; }
      });
    });
  }

  // One render pass: apply model colors, render, dim connectors, then (re)build the note-name
  // overlay, the captured-measure shading, the chord-candidate overlay, and notify the UI.
  function redraw() {
    clearHighlight();
    applyVoiceColors();
    osmd.render();
    applyDimConnectors();
    applyNoteNames();
    applyMeasureHighlight();
    applyChordOverlay();
    if (onAfterRender) { try { onAfterRender(); } catch (_) {} }
  }

  function setZoom(factor) { osmd.Zoom = factor; redraw(); }

  return {
    osmd,
    async loadDetail(detail) {
      if (!detail || detail.format !== 'musicxml' || !detail.source) {
        return { ok: false, reason: 'not-musicxml' };
      }
      await osmd.load(detail.source);
      totalMeasures = (osmd.Sheet && osmd.Sheet.SourceMeasures && osmd.Sheet.SourceMeasures.length) || 0;
      shownFrom = 1; shownTo = totalMeasures || Number.MAX_SAFE_INTEGER;
      selectedChords.clear();   // a fresh piece carries no manual chord picks
      redraw();
      return { ok: true, totalMeasures };
    },
    showFull() {
      osmd.setOptions({ drawFromMeasureNumber: 1, drawUpToMeasureNumber: totalMeasures || Number.MAX_SAFE_INTEGER });
      shownFrom = 1; shownTo = totalMeasures || Number.MAX_SAFE_INTEGER;
      redraw();
    },
    showSegment(measureRange) {
      osmd.setOptions({ drawFromMeasureNumber: measureRange[0], drawUpToMeasureNumber: measureRange[1] });
      shownFrom = measureRange[0]; shownTo = measureRange[1];
      redraw();
    },
    setZoom,
    setVoiceColors(on) { colorVoices = !!on; redraw(); },
    setNoteNames(on) { noteNames = !!on; redraw(); },
    // Toggle the in-score chord-candidate overlay (stacked labels above each chord area).
    setShowChords(on) { showChords = !!on; redraw(); },
    // Toggle dimming of beams/stems/slurs (reduces visual noise; noteheads stay black).
    setDimConnectors(on) { dimConnectors = !!on; redraw(); },
    // The manually-picked best-match chord names — read at vocab-save time.
    getSelectedChords() { return [...selectedChords]; },
    // Pre-select chords by name (e.g. restoring a saved vocab item) and re-draw the overlay.
    setSelectedChords(names) { selectedChords.clear(); (names || []).forEach((n) => { if (n) selectedChords.add(n); }); applyChordOverlay(); },
    // Guessed chords for the currently-rendered measures: [{ measure, name, notes:[{el,...}] }].
    getGuessedChords() { return guessChords(renderedNotesByMeasure()); },
    highlightChord,
    clearHighlight,
    // Shade a captured measure range [from,to] behind the notes; persists across re-renders
    // (zoom / segment changes) until cleared. Used to mark a vocab item's original measures.
    highlightMeasures(range) { measureHighlight = (range && range.length === 2) ? [range[0], range[1]] : null; applyMeasureHighlight(); },
    clearMeasureHighlight() { measureHighlight = null; applyMeasureHighlight(); },
    applyResponsiveZoom(viewportWidth) { setZoom(responsiveZoom(viewportWidth)); }
  };
}
