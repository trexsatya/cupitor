// public/music-render.js
// Rendering for the music study app: pure measure-mapping helpers (TDD) +
// a thin OSMD wrapper (injectable factory) for whole-piece / segment rendering.
import { primaryVoice } from './music-encoding.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Readable, deterministic palette for coloring voices in the rendered sheet.
const VOICE_COLORS = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#17becf'];
const DEFAULT_NOTE_COLOR = '#000000';
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
  let totalMeasures = 0;
  let colorVoices = false;
  let noteNames = false;
  let chordsOn = false;
  let loadedDetail = null;   // kept so the chord overlay can read collapsedChordSpans

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

  // First rendered notehead element within a graphical measure (or null) — anchor for chords.
  function firstNoteheadOf(measure) {
    for (const se of (measure && measure.staffEntries) || []) {
      for (const gve of (se.graphicalVoiceEntries || [])) {
        for (const gnote of (gve.notes || [])) {
          const vf = gnote.vfnote;
          const el = vf && vf[0] && vf[0].attrs && vf[0].attrs.el;
          if (el && el.querySelectorAll) { const h = el.querySelectorAll('.vf-notehead'); if (h[0]) return h[0]; }
        }
      }
    }
    return null;
  }

  // Overlay the (possibly inferred) chord symbol above the first notehead of each chord
  // span's start measure. Rebuilt every render; no-op without a rendered graphic / DOM.
  function applyChords() {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.chord-layer').forEach((n) => n.remove());
    if (!chordsOn) return;
    const measureList = osmd.graphic && osmd.graphic.measureList;
    const svg = container.querySelector('svg');
    if (!measureList || !measureList.forEach || !svg) return;
    const symbolByMeasure = {};
    collapsedChordSpans(loadedDetail || { voices: [] }).forEach((s) => {
      if (symbolByMeasure[s.measureStart] == null) symbolByMeasure[s.measureStart] = s.symbol;
    });
    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('class', 'chord-layer');
    const labeled = new Set();
    measureList.forEach((measures) => {
      (measures || []).forEach((measure) => {
        const sm = measure && measure.parentSourceMeasure;
        const num = sm && sm.MeasureNumber;
        if (num == null || labeled.has(num) || !symbolByMeasure[num]) return;
        const head = firstNoteheadOf(measure);
        if (!head || !head.getBBox) return;
        labeled.add(num);
        const b = head.getBBox();
        const t = document.createElementNS(SVG_NS, 'text');
        t.setAttribute('x', b.x);
        t.setAttribute('y', b.y - 12);            // above the staff
        t.setAttribute('font-size', '10');
        t.setAttribute('font-weight', '600');
        t.setAttribute('fill', '#1565c0');
        t.textContent = symbolByMeasure[num];
        layer.appendChild(t);
      });
    });
    svg.appendChild(layer);
  }

  // One render pass: apply model colors, render, then (re)build overlays.
  function redraw() {
    applyVoiceColors();
    osmd.render();
    applyNoteNames();
    applyChords();
  }

  function setZoom(factor) { osmd.Zoom = factor; redraw(); }

  return {
    osmd,
    async loadDetail(detail) {
      if (!detail || detail.format !== 'musicxml' || !detail.source) {
        return { ok: false, reason: 'not-musicxml' };
      }
      loadedDetail = detail;
      await osmd.load(detail.source);
      totalMeasures = (osmd.Sheet && osmd.Sheet.SourceMeasures && osmd.Sheet.SourceMeasures.length) || 0;
      redraw();
      return { ok: true, totalMeasures };
    },
    showFull() {
      osmd.setOptions({ drawFromMeasureNumber: 1, drawUpToMeasureNumber: totalMeasures || Number.MAX_SAFE_INTEGER });
      redraw();
    },
    showSegment(measureRange) {
      osmd.setOptions({ drawFromMeasureNumber: measureRange[0], drawUpToMeasureNumber: measureRange[1] });
      redraw();
    },
    setZoom,
    setVoiceColors(on) { colorVoices = !!on; redraw(); },
    setNoteNames(on) { noteNames = !!on; redraw(); },
    setChords(on) { chordsOn = !!on; redraw(); },
    applyResponsiveZoom(viewportWidth) { setZoom(responsiveZoom(viewportWidth)); }
  };
}
