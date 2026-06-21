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

// Pure: inclusive slice of an ordered note list between two reading-order indices, with the
// endpoints normalized (swapped if reversed) and clamped to the array bounds. [] for empty input.
export function notesInWindow(ordered, startOrder, endOrder) {
  if (!ordered || !ordered.length) return [];
  let a = startOrder == null ? 0 : startOrder;
  let b = endOrder == null ? ordered.length - 1 : endOrder;
  if (a > b) { const t = a; a = b; b = t; }
  a = clamp(a, 0, ordered.length - 1);
  b = clamp(b, 0, ordered.length - 1);
  return ordered.slice(a, b + 1);
}

// Pure: resolve a {measure, idx} anchor to a position in an ordered reading-order list of
// {measure, idx}. Exact match wins; otherwise the nearest note by measure distance, then idx
// distance — so a window survives re-renders that scroll/zoom the anchored measures out/in.
// Returns 0 for an empty list or a null anchor.
export function clampAnchorIndex(list, anchor) {
  if (!list || !list.length || !anchor) return 0;
  let best = 0, bestKey = Infinity;
  for (let i = 0; i < list.length; i++) {
    if (list[i].measure === anchor.measure && list[i].idx === anchor.idx) return i;
    const key = Math.abs(list[i].measure - anchor.measure) * 100000 + Math.abs(list[i].idx - anchor.idx);
    if (key < bestKey) { bestKey = key; best = i; }
  }
  return best;
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
  const onWindowChange = opts.onWindowChange; // called with { chords, measureRange } when the chord window moves
  let totalMeasures = 0;
  let colorVoices = true;    // voices are colored by default; the UI checkbox starts checked
  let noteNames = false;
  let showChords = false;        // draw stacked chord-candidate labels above each chord area
  let dimConnectors = true;      // grey out beams/stems/slurs by default to cut visual noise
  const selectedChords = new Set();   // manually-picked best-match chord names (multi-select; persisted per vocab item)
  let measureHighlight = null;   // [from,to] of a captured vocab range to shade behind the notes
  let shownFrom = 1;             // 1-based first measure of the currently drawn window
  let shownTo = Number.MAX_SAFE_INTEGER;   // ...and the last (chords/highlight clip to this)
  // Draggable selection window over the staff. start/end are stable {measure, idx} anchors so the
  // window re-resolves to the right notes after re-renders (zoom/segment). Inactive by default.
  const chordWindow = { active: false, start: null, end: null };

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
    // measureList is [measureIndex][staffIndex]. Key by each measure's absolute number. We do NOT
    // clip to [shownFrom, shownTo]: OSMD's measureList can hold undrawn measures, but their note
    // elements are detached and dropped by the isConnected guard below — so the result is exactly
    // the rendered notes. An explicit measure-number clip here used to wrongly drop the leftmost
    // rendered measure when OSMD's numbering was offset from shownFrom (e.g. a pickup measure),
    // misaligning the chord window from what's drawn.
    measureList.forEach((measures, a) => {
      const num = absoluteMeasureNumber(measures, a, measureList.length);
      (measures || []).forEach((measure) => {
        ((measure.staffEntries) || []).forEach((se) => {
          const onsetBeats = staffEntryOnsetBeats(se);   // shared by all notes in this staff entry
          (se.graphicalVoiceEntries || []).forEach((gve) => {
            (gve.notes || []).forEach((gnote) => {
              const vf = gnote.vfnote;
              const root = vf && vf[0] && vf[0].attrs && vf[0].attrs.el;
              if (!root || !root.querySelectorAll) return;
              const idx = gnote.vfnoteIndex || 0;
              const heads = root.querySelectorAll('.vf-notehead');
              const el = heads[idx] || heads[0];
              const name = vexKeyToPitchClass(vf[0].keys && vf[0].keys[idx]);
              // Skip notes whose notehead isn't actually in the rendered SVG: OSMD's measureList
              // can hold measures outside the drawn window, and their elements are detached
              // (getBBox → 0). Those phantom notes otherwise anchor chord labels at x=0.
              if (!el || !name || el.isConnected === false) return;
              const b = el.getBBox ? el.getBBox() : { x: 0 };
              // `measure`/`idx` are the note's stable musical key (absolute measure + position
              // within it), used to re-anchor the draggable chord window across re-renders.
              const arr = (byMeasure[num] = byMeasure[num] || []);
              arr.push({ name, left: b.x, el, measure: num, idx: arr.length, onsetBeats });
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
      if (m) {
        const map = (px, py) => ({ x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f });
        return { x: map(b.x, b.y).x, top: map(b.x, b.y).y, bottom: map(b.x, b.y + b.height).y };
      }
      return { x: b.x, top: b.y, bottom: b.y + b.height };
    }
    return { x: area.x, top: area.top, bottom: area.top };
  }

  // Top/bottom of the rendered staff lines in svg-user space (falls back to the notehead
  // extent), so chord labels can sit on even rows above/below the staff rather than per-note.
  function systemBounds() {
    const staves = container.querySelectorAll('.vf-stave');
    const els = staves.length ? staves : container.querySelectorAll('.vf-notehead');
    let top = Infinity, bottom = -Infinity;
    els.forEach((el) => {
      if (!el.getBBox) return;
      const b = el.getBBox();
      const m = el.getCTM && el.getCTM();
      const ty = m ? (m.b * b.x + m.d * b.y + m.f) : b.y;
      const by = m ? (m.b * b.x + m.d * (b.y + b.height) + m.f) : (b.y + b.height);
      if (ty < top) top = ty;
      if (by > bottom) bottom = by;
    });
    return top === Infinity ? null : { top, bottom };
  }

  // Map an element's local bbox to {left,right,top,bottom} in svg-user space (via getCTM, so
  // OSMD's zoom/translate is respected). Returns null when the element can't be measured.
  function elBox(el) {
    if (!el || !el.getBBox) return null;
    const b = el.getBBox();
    const m = el.getCTM && el.getCTM();
    const map = (px, py) => (m ? { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f } : { x: px, y: py });
    const p1 = map(b.x, b.y), p2 = map(b.x + b.width, b.y + b.height);
    return { left: Math.min(p1.x, p2.x), right: Math.max(p1.x, p2.x), top: Math.min(p1.y, p2.y), bottom: Math.max(p1.y, p2.y) };
  }
  // Just the vertical extent — used to group notes/labels into staff systems.
  function elBand(el) { const b = elBox(el); return b ? { top: b.top, bottom: b.bottom } : null; }

  // Onset of a graphical staff entry in quarter-note beats from the piece start, read from OSMD's
  // source timestamps (RealValue is in whole notes → ×4 for quarter beats). null when unavailable,
  // in which case window playback falls back from note-accurate to measure-granular.
  function staffEntryOnsetBeats(se) {
    try { if (se && se.getAbsoluteTimestamp) { const t = se.getAbsoluteTimestamp(); if (t && typeof t.RealValue === 'number') return t.RealValue * 4; } } catch (_) {}
    try {
      const sse = se && (se.sourceStaffEntry || se.parentStaffEntry);
      const t = sse && (sse.AbsoluteTimestamp || (sse.getAbsoluteTimestamp && sse.getAbsoluteTimestamp()));
      if (t && typeof t.RealValue === 'number') return t.RealValue * 4;
    } catch (_) {}
    return null;
  }

  // Per-system [{top,bottom}] in svg-user space (one per rendered staff line), so a label can be
  // placed relative to the note's OWN system instead of the global extent across all systems.
  // Prefers .vf-stave; this OSMD/VexFlow build emits no .vf-stave (staff lines are bare paths),
  // so fall back to clustering rendered noteheads — a large vertical gap between consecutive
  // (sorted) notehead centers marks the break between one wrapped system and the next.
  const SYSTEM_GAP = 60;   // min vertical whitespace (svg units) separating two systems
  function staffBoxes() {
    const staveEls = container.querySelectorAll('.vf-stave');
    if (staveEls.length) {
      const out = [];
      staveEls.forEach((el) => { const band = elBand(el); if (band) out.push(band); });
      return out.sort((a, b) => a.top - b.top);
    }
    const mids = [];
    container.querySelectorAll('.vf-notehead').forEach((el) => {
      const band = elBand(el);
      if (band) mids.push({ ...band, mid: (band.top + band.bottom) / 2 });
    });
    if (!mids.length) return [];
    mids.sort((a, b) => a.mid - b.mid);
    const out = [];
    let cur = { top: mids[0].top, bottom: mids[0].bottom, last: mids[0].mid };
    for (let i = 1; i < mids.length; i++) {
      if (mids[i].mid - cur.last > SYSTEM_GAP) {
        out.push({ top: cur.top, bottom: cur.bottom });
        cur = { top: mids[i].top, bottom: mids[i].bottom, last: mids[i].mid };
      } else {
        cur.top = Math.min(cur.top, mids[i].top);
        cur.bottom = Math.max(cur.bottom, mids[i].bottom);
        cur.last = mids[i].mid;
      }
    }
    out.push({ top: cur.top, bottom: cur.bottom });
    return out.sort((a, b) => a.top - b.top);
  }

  // Index of the staff whose vertical band contains (or is nearest to) y.
  function nearestStaffIdx(boxes, y) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < boxes.length; i++) {
      const s = boxes[i];
      const d = (y >= s.top && y <= s.bottom) ? 0 : Math.min(Math.abs(y - s.top), Math.abs(y - s.bottom));
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function applyChordOverlay() {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.' + CHORD_LAYER_CLASS).forEach((n) => n.remove());
    if (!showChords) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    // Group rendered notes by system (wrapped line) BEFORE detecting chords. guessChordAreas
    // slides a window by x, but x RESETS on each wrapped line — a global x-sort would conflate
    // notes from different lines that share an x-column into bogus chords. Within one system x
    // is onset order, so we detect per system and place each system's labels against its own band.
    const bands = staffBoxes();                 // [{top,bottom}] per system, sorted top→bottom
    const fallback = systemBounds();            // global extent when no notehead bands are found
    const byMeasure = renderedNotesByMeasure();
    const allNotes = [];
    Object.keys(byMeasure).forEach((m) => allNotes.push(...byMeasure[m]));
    const groups = Array.from({ length: Math.max(1, bands.length) }, () => []);
    allNotes.forEach((n) => {
      let idx = 0;
      if (bands.length) { const b = elBand(n.el); if (b) idx = nearestStaffIdx(bands, (b.top + b.bottom) / 2); }
      groups[idx].push(n);
    });

    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('class', CHORD_LAYER_CLASS);
    let selectedNotes = [];

    groups.forEach((notes, bandIdx) => {
      if (notes.length < 2) return;
      const areas = guessChordAreas(notes, undefined, { maxPerArea: MAX_LABELS_PER_AREA });
      if (!areas.length) return;
      // Highlight selected chords' notes regardless of whether their label survives de-crowding.
      areas.forEach((area) => area.chords.forEach((ch) => {
        if (selectedChords.has(ch.name)) selectedNotes = selectedNotes.concat(ch.notes);
      }));
      const band = bands[bandIdx] || fallback || { top: 0, bottom: 0 };
      const aboveY = band.top - 8, belowY = band.bottom + 16;
      const cols = areas.map((area) => ({ area, x: chordAnchorXY(area).x })).sort((a, b) => a.x - b.x);
      const lastX = new Map();   // side (0=above,1=below) → last placed x, to de-crowd each row
      let placed = 0;
      cols.forEach(({ area, x }) => {
        const side = placed % 2;            // alternate above/below within this system
        const prev = lastX.has(side) ? lastX.get(side) : -Infinity;
        if (x - prev < MIN_LABEL_GAP) return;   // too close on this row → skip
        lastX.set(side, x);
        placed += 1;
        area.chords.forEach((ch, k) => {
          const isSel = selectedChords.has(ch.name);
          const t = document.createElementNS(SVG_NS, 'text');
          t.setAttribute('x', x);
          t.setAttribute('y', side === 0 ? (aboveY - k * 11) : (belowY + k * 11));
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
    // Beams/stems/flags/slurs/ties + connecting lines + the numeric annotations (string
    // numbers, fret-hand fingerings). This OSMD/VexFlow build draws flags as .vf-flag, slurs as
    // .vf-curve, and gliss/connector lines as .vf-line — all initially black, so include them.
    const groups = '.vf-beam, .vf-stem, .vf-flag, .vf-slur, .vf-curve, .vf-tie, .vf-stavetie, .vf-line, .vf-stringnumber, .vf-frethandfinger, .vf-fingering, .vf-text';
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

  // ── Draggable chord window ────────────────────────────────────────────────────────────────
  const WINDOW_LAYER_CLASS = 'chord-window-layer';
  const WINDOW_FILL = '#bcdcff';        // translucent selection band (distinct from #ffe9a8 capture)
  const WINDOW_HANDLE = '#1565c0';      // grab-handle color

  function mkSvg(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    return el;
  }

  // Rendered notes in reading/time order (measure → within-measure idx), each tagged with its
  // svg-space box, system band index, and global order. The source of truth for the window.
  function orderedRenderedNotes() {
    const byMeasure = renderedNotesByMeasure();
    const bands = staffBoxes();
    const out = [];
    Object.keys(byMeasure).map(Number).sort((p, q) => p - q).forEach((measure) => {
      byMeasure[measure].forEach((n) => {
        const box = elBox(n.el) || { left: n.left || 0, right: n.left || 0, top: 0, bottom: 0 };
        const mid = (box.top + box.bottom) / 2;
        const band = bands.length ? nearestStaffIdx(bands, mid) : 0;
        out.push({ name: n.name, el: n.el, measure: n.measure, idx: n.idx, order: out.length, band,
          onsetBeats: n.onsetBeats, left: box.left, right: box.right, top: box.top, bottom: box.bottom });
      });
    });
    return out;
  }

  // svg-user-space point for a client (mouse) coordinate.
  function svgPoint(svg, clientX, clientY) {
    const m = svg.getScreenCTM && svg.getScreenCTM();
    if (!m || !m.inverse) return { x: clientX, y: clientY };
    const inv = m.inverse();
    return { x: inv.a * clientX + inv.c * clientY + inv.e, y: inv.b * clientX + inv.d * clientY + inv.f };
  }

  // Nearest rendered note to an svg-space point: first pick the system band by y, then the note
  // whose x-center is closest within that band (falls back to nearest across all bands).
  function nearestByX(list, x) {
    let best = null, bd = Infinity;
    list.forEach((n) => { const d = Math.abs((n.left + n.right) / 2 - x); if (d < bd) { bd = d; best = n; } });
    return best;
  }
  // Map an svg-space point to a rendered note. Primary axis is the system (line) under y; within
  // that line we take the nearest note by x. Crucially, dragging PAST a line's right edge wraps to
  // the next line's first note (and past the left edge → previous line's last note), so the window
  // can be extended/slid across a wrapped line break by the natural left↔right gesture, not only by
  // dragging diagonally down into the next system.
  function pointerToNote(ordered, x, y) {
    if (!ordered.length) return null;
    const bands = staffBoxes();
    if (!bands.length) return nearestByX(ordered, x);
    const bandIdx = nearestStaffIdx(bands, y);
    const inBand = ordered.filter((n) => (n.band || 0) === bandIdx);
    if (!inBand.length) return nearestByX(ordered, x);
    const maxX = Math.max(...inBand.map((n) => n.right));
    const minX = Math.min(...inBand.map((n) => n.left));
    if (x > maxX && bandIdx < bands.length - 1) {
      const next = ordered.filter((n) => (n.band || 0) === bandIdx + 1);
      if (next.length) return next.reduce((a, b) => (a.order < b.order ? a : b));   // first note of next line
    }
    if (x < minX && bandIdx > 0) {
      const prev = ordered.filter((n) => (n.band || 0) === bandIdx - 1);
      if (prev.length) return prev.reduce((a, b) => (a.order > b.order ? a : b));    // last note of prev line
    }
    return nearestByX(inBand, x);
  }

  // The currently selected window notes (reading order), seeding a small window at the start the
  // first time the window is shown. Shared by the overlay, the chord readout, and the play range.
  function currentWindowSelection() {
    const ordered = orderedRenderedNotes();
    if (!ordered.length) return { ordered, selected: [] };
    if (!chordWindow.start || !chordWindow.end) {
      chordWindow.start = { measure: ordered[0].measure, idx: ordered[0].idx };
      const e = ordered[Math.min(ordered.length - 1, 3)];
      chordWindow.end = { measure: e.measure, idx: e.idx };
    }
    const anchorList = ordered.map((n) => ({ measure: n.measure, idx: n.idx }));
    let a = clampAnchorIndex(anchorList, chordWindow.start);
    let b = clampAnchorIndex(anchorList, chordWindow.end);
    if (a > b) { const t = a; a = b; b = t; }
    return { ordered, selected: notesInWindow(ordered, a, b) };
  }

  // Playable range of a selection: always a measure span; plus a quarter-beat span when every
  // selected note carries an onset (note-accurate playback, possibly starting mid-measure).
  function rangeFromSelected(selected) {
    if (!selected || !selected.length) return null;
    const measures = selected.map((n) => n.measure);
    const range = { fromMeasure: Math.min(...measures), toMeasure: Math.max(...measures) };
    const onsets = selected.map((n) => n.onsetBeats).filter((v) => typeof v === 'number');
    if (onsets.length === selected.length) { range.fromBeat = Math.min(...onsets); range.toBeat = Math.max(...onsets); }
    return range;
  }

  function fireWindowChange(selected) {
    if (!onWindowChange) return;
    const forChords = selected.map((n) => ({ name: n.name, el: n.el, left: n.order }));
    const areas = guessChordAreas(forChords, undefined, { maxPerArea: 3 });
    const seen = new Set();
    const chords = [];
    areas.forEach((area) => area.chords.forEach((ch) => {
      if (!seen.has(ch.name)) { seen.add(ch.name); chords.push({ name: ch.name, notes: ch.notes }); }
    }));
    const range = rangeFromSelected(selected);
    try { onWindowChange({ chords, measureRange: range ? [range.fromMeasure, range.toMeasure] : null }); } catch (_) {}
  }

  // Remove + redraw the window overlay (per-system rectangles + two edge handles), recompute its
  // chords, and notify the UI. Part of redraw(), so it re-anchors after every render.
  function applyChordWindow() {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.' + WINDOW_LAYER_CLASS).forEach((n) => n.remove());
    if (!chordWindow.active) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    const { selected } = currentWindowSelection();
    if (!selected.length) { fireWindowChange([]); return; }
    const bands = staffBoxes();
    const layer = mkSvg('g', { class: WINDOW_LAYER_CLASS });

    // One rectangle per system the selection spans (text-selection shape across wrapped lines).
    const byBand = new Map();
    selected.forEach((n) => { const arr = byBand.get(n.band) || []; arr.push(n); byBand.set(n.band, arr); });
    byBand.forEach((notes, bandIdx) => {
      const left = Math.min(...notes.map((n) => n.left));
      const right = Math.max(...notes.map((n) => n.right));
      const band = bands[bandIdx] || { top: Math.min(...notes.map((n) => n.top)), bottom: Math.max(...notes.map((n) => n.bottom)) };
      const pad = 6;
      const rect = mkSvg('rect', { x: left - 4, y: band.top - pad, width: (right - left) + 8,
        height: (band.bottom - band.top) + 2 * pad, fill: WINDOW_FILL, opacity: '0.33', style: 'cursor:move' });
      rect.addEventListener('pointerdown', startMiddleDrag);
      layer.appendChild(rect);
    });

    // Edge handles at the true endpoints.
    const s = selected[0], e = selected[selected.length - 1];
    const sBand = bands[s.band] || { top: s.top, bottom: s.bottom };
    const eBand = bands[e.band] || { top: e.top, bottom: e.bottom };
    const lh = mkSvg('rect', { x: s.left - 8, y: sBand.top - 6, width: 6, height: (sBand.bottom - sBand.top) + 12,
      fill: WINDOW_HANDLE, opacity: '0.85', rx: 2, style: 'cursor:ew-resize' });
    lh.addEventListener('pointerdown', (ev) => startHandleDrag(ev, 'start'));
    const rh = mkSvg('rect', { x: e.right + 2, y: eBand.top - 6, width: 6, height: (eBand.bottom - eBand.top) + 12,
      fill: WINDOW_HANDLE, opacity: '0.85', rx: 2, style: 'cursor:ew-resize' });
    rh.addEventListener('pointerdown', (ev) => startHandleDrag(ev, 'end'));
    layer.appendChild(lh);
    layer.appendChild(rh);

    svg.appendChild(layer);
    fireWindowChange(selected);
  }

  // Drag an endpoint handle: map the pointer to the nearest note and move that anchor live.
  function startHandleDrag(ev, which) {
    ev.preventDefault(); ev.stopPropagation();
    const svg = container.querySelector('svg');
    if (!svg) return;
    const move = (e) => {
      const ordered = orderedRenderedNotes();
      const p = svgPoint(svg, e.clientX, e.clientY);
      const note = pointerToNote(ordered, p.x, p.y);
      if (note) { chordWindow[which] = { measure: note.measure, idx: note.idx }; applyChordWindow(); }
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // Drag the middle: slide the whole range through reading order by the pointer's note-delta,
  // keeping the note count constant (can roll across a line break); clamped to the rendered notes.
  function startMiddleDrag(ev) {
    ev.preventDefault();
    const svg = container.querySelector('svg');
    if (!svg) return;
    const ordered = orderedRenderedNotes();
    const anchorList = ordered.map((n) => ({ measure: n.measure, idx: n.idx }));
    const a0 = clampAnchorIndex(anchorList, chordWindow.start);
    const b0 = clampAnchorIndex(anchorList, chordWindow.end);
    const grab = pointerToNote(ordered, svgPoint(svg, ev.clientX, ev.clientY).x, svgPoint(svg, ev.clientX, ev.clientY).y);
    const grabOrder = grab ? grab.order : a0;
    const move = (e) => {
      const p = svgPoint(svg, e.clientX, e.clientY);
      const cur = pointerToNote(ordered, p.x, p.y);
      if (!cur) return;
      let delta = cur.order - grabOrder;
      let na = a0 + delta, nb = b0 + delta;
      const n = ordered.length;
      if (na < 0) { nb -= na; na = 0; }
      if (nb > n - 1) { na -= (nb - (n - 1)); nb = n - 1; }
      na = clamp(na, 0, n - 1); nb = clamp(nb, 0, n - 1);
      chordWindow.start = anchorList[na];
      chordWindow.end = anchorList[nb];
      applyChordWindow();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // One render pass: apply model colors, render, dim connectors, then (re)build the note-name
  // overlay, the captured-measure shading, the chord-candidate overlay, the chord window, and
  // notify the UI.
  function redraw() {
    clearHighlight();
    applyVoiceColors();
    osmd.render();
    applyDimConnectors();
    applyNoteNames();
    applyMeasureHighlight();
    applyChordOverlay();
    applyChordWindow();
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
    // Toggle the draggable chord window. Off clears its anchors so it re-seeds next time.
    setChordWindow(on) { chordWindow.active = !!on; if (!chordWindow.active) { chordWindow.start = null; chordWindow.end = null; } redraw(); },
    // Live play range of the window: { fromMeasure, toMeasure, fromBeat?, toBeat? }, or null when
    // the window is off / empty. Beats are present only when onset times were available (then
    // playback is note-accurate; otherwise it's measure-granular). Read fresh, not cached.
    getWindowRange() { return chordWindow.active ? rangeFromSelected(currentWindowSelection().selected) : null; },
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
