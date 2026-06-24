// public/music-render.js
// Rendering for the music study app: pure measure-mapping helpers (TDD) +
// a thin OSMD wrapper (injectable factory) for whole-piece / segment rendering.
import { primaryVoice } from './music-encoding.js';
import { guessChords, guessChordAreas, bestChords, bestChordsCompleting, chordDisplayName, chordOccurrenceNotes } from './music-chords.js';

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

// Authoritative pitch-class spelling from an OSMD source-note Pitch ("F#"): the notated
// letter (FundamentalNote) + accidental, read via the Pitch class's own static converters.
// Preferred over the VexFlow key, which can omit an accidental OSMD draws as a separate
// glyph — a notated F# then read as F and mis-named chords (G7/Bdim instead of Gmaj7).
// Returns null when the Pitch object doesn't expose the expected OSMD API.
export function pitchClassFromPitch(pitch) {
  if (!pitch) return null;
  const P = pitch.constructor;
  if (!P || typeof P.getNoteEnumString !== 'function') return null;
  const letter = P.getNoteEnumString(pitch.FundamentalNote);
  if (!letter) return null;
  let acc = (typeof P.accidentalVexflow === 'function') ? P.accidentalVexflow(pitch.Accidental) : '';
  if (!acc || acc === 'n') acc = '';   // NONE / NATURAL carry no accidental in the name
  return letter + acc;
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

// Pure: cluster notehead vertical extents into systems (wrapped staff lines). `mids` is
// [{top,bottom,mid}] sorted by `mid` ascending; a vertical gap between consecutive mids greater
// than `gap` starts a new system. Returns [{top,bottom}] per system, top→bottom. NOTE: OSMD
// scales drawn coordinates by its zoom, so `gap` MUST be zoom-scaled — a fixed value collapses
// every system into one band at small (mobile) zoom.
export function clusterBandsByGap(mids, gap) {
  if (!mids || !mids.length) return [];
  const out = [];
  let cur = { top: mids[0].top, bottom: mids[0].bottom, last: mids[0].mid };
  for (let i = 1; i < mids.length; i++) {
    if (mids[i].mid - cur.last > gap) {
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

// Pure: stable string key for a note identity, for suppression-set membership/dedupe.
export function suppressionKey({ measure, midi, beats }) {
  return `${measure}:${midi}:${Number(beats).toFixed(6)}`;
}

// Pure: the note identities {measure, midi, beats} of a given voice in a rendered-note list
// (excludes unpitched notes, which have midi == null).
export function notesOfVoice(notes, voiceId) {
  return (notes || [])
    .filter((n) => n.voice === voiceId && n.midi != null)
    .map((n) => ({ measure: n.measure, midi: n.midi, beats: n.onsetBeats }));
}

// Pure: notes currently silenced/dimmed = hearAll ? none : suppressed minus temp-restored.
// `tempRestored` is a Set of suppressionKey strings; keys not present in `suppressed` are ignored.
export function effectiveMuted(suppressed, tempRestored, hearAll) {
  if (hearAll) return [];
  const t = tempRestored || new Set();
  return (suppressed || []).filter((n) => !t.has(suppressionKey(n)));
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
  // Show the score's PRINTED (XML) measure numbers — that's the canonical reference a musician
  // reads. The app counts measures sequentially (pickup = 1), so with an anacrusis the printed
  // number is offset by the pickup count; measureOffset (computed on load) bridges the two and the
  // UI displays/accepts printed numbers while storage/drawFrom stay sequential. See getMeasureOffset.
  // autoResize:false — OSMD's auto-resize attaches a debounced window.resize handler that calls
  // osmd.render() directly. We zoom explicitly via applyResponsiveZoom, so the resize re-render is
  // pure liability — turn it off. (This alone is not enough: OSMD ALSO defers a one-shot render ~1ms
  // after construction that is NOT gated by autoResize — see the render wrap below.)
  osmd.setOptions({ backend: 'svg', drawingParameters: 'compacttight', drawTitle: false, useXMLMeasureNumbers: true, autoResize: false });
  // OSMD renders behind our back: a one-shot render it schedules ~1ms after construction (via
  // handleResize's `setTimeout(e,1)`, ungated by autoResize) and any autoResize render. Both call
  // osmd.render() directly — repainting connectors black and dropping our overlays, which races and
  // often beats our dim pass on load. Wrap render so postRender() (dim + overlays) ALWAYS runs after
  // it, whoever triggered it. The guard stops a postRender that ever re-enters render from looping.
  const _osmdRender = osmd.render.bind(osmd);
  let _inRender = false;
  osmd.render = (...a) => {
    const out = _osmdRender(...a);
    if (!_inRender) { _inRender = true; try { postRender(); } finally { _inRender = false; } }
    return out;
  };
  // Notehead clicks drive suppression (edit-mode) / temporary restore (practice-mode).
  if (container && container.addEventListener) container.addEventListener('click', onNoteheadClick);
  const onAfterRender = opts.onAfterRender;   // called after each render (lets the UI rebuild chord chips)
  const onChordSelect = opts.onChordSelect;   // called on a user chord-label click with the selected names
  const onWindowChange = opts.onWindowChange; // called with { chords, measureRange } when the chord window moves
  const onSuppressionChange = opts.onSuppressionChange;   // fired after a user change to S, T, or hearAll
  let totalMeasures = 0;
  let measureOffset = 0;     // sequential MeasureNumber − printed number (the pickup/anacrusis shift)
  let colorVoices = true;    // voices are colored by default; the UI checkbox starts checked
  let noteNames = false;
  let showChords = false;        // draw stacked chord-candidate labels above each chord area
  let dimConnectors = true;      // grey out beams/stems/slurs by default to cut visual noise
  let currentZoom = 1;           // OSMD zoom in effect; system-gap detection must scale with it
  let currentKey = null;         // piece key (e.g. 'C'), for the chord detector's power-chord fallback
  let globalChordMatch = false;  // when on, clicking a chord name highlights EVERY complete
                                 // occurrence of it across the visible sheet (not just locally)
  const selectedChords = new Set();   // manually-picked best-match chord names (multi-select; persisted per vocab item)
  let measureHighlight = null;   // [from,to] of a captured vocab range to shade behind the notes
  let shownFrom = 1;             // 1-based first measure of the currently drawn window
  let shownTo = Number.MAX_SAFE_INTEGER;   // ...and the last (chords/highlight clip to this)
  // Draggable selection window over the staff. start/end are stable {measure, idx} anchors so the
  // window re-resolves to the right notes after re-renders (zoom/segment). Inactive by default.
  const chordWindow = { active: false, start: null, end: null };

  // Note suppression (vocab practice): S = persisted suppressed set, T = transient per-note
  // restore, hearAll = transient global restore. Effective muted = hearAll ? [] : (S − T).
  const suppressedNotes = new Map();   // suppressionKey → {measure, midi, beats}  (S)
  const tempRestored = new Set();      // suppressionKey strings, subset of S       (T)
  let hearAll = false;
  let suppressMode = false;            // true → notehead clicks edit S; false → toggle T (practice)
  // Internal: the current effective muted identities (shared by getMutedNotes + applySuppressionDim).
  function mutedList() { return effectiveMuted([...suppressedNotes.values()], tempRestored, hearAll); }

  // OSMD Voice object → its global color index (the same index voiceColor() uses), rebuilt every
  // render by applyVoiceColors so rendered notes can be tagged with a stable voice id.
  const voiceIndexByRef = new Map();

  // Push per-voice NoteheadColor onto the OSMD model so it survives re-renders.
  // No-op on a sheet without instruments (e.g. the test fake / before load).
  function applyVoiceColors() {
    const instruments = osmd.Sheet && osmd.Sheet.Instruments;
    if (!instruments || !instruments.forEach) return;
    voiceIndexByRef.clear();
    let vi = 0;
    instruments.forEach((instr) => {
      (instr.Voices || []).forEach((voice) => {
        voiceIndexByRef.set(voice, vi);
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
              // White halo painted UNDER the fill (paint-order: stroke) so a staff line can't strike
              // through the glyph — the label stays readable wherever it lands on the staff.
              t.setAttribute('stroke', '#fff');
              t.setAttribute('stroke-width', '2.5');
              t.setAttribute('stroke-linejoin', 'round');
              t.setAttribute('paint-order', 'stroke');
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
  // OSMD music-system (wrapped line) of a graphical measure → a stable 0-based index in reading
  // (top→bottom) order. This is the authoritative line grouping; falls back to null when the
  // model isn't reachable (then staffBoxes clusters noteheads by Y instead). `cache` maps each
  // distinct system object to its first-encounter index.
  function systemIndexOf(measure, cache) {
    try {
      const sl = measure && (measure.ParentStaffLine || measure.parentStaffLine);
      const sys = sl && (sl.ParentMusicSystem || sl.parentMusicSystem);
      if (sys) { if (!cache.has(sys)) cache.set(sys, cache.size); return cache.get(sys); }
    } catch (_) {}
    return null;
  }

  function renderedNotesByMeasure() {
    const byMeasure = {};
    const measureList = osmd.graphic && osmd.graphic.measureList;
    if (!measureList || !measureList.forEach) return byMeasure;
    const systemCache = new Map();   // system object → top→bottom index, built in reading order
    // measureList is [measureIndex][staffIndex]. Key by each measure's absolute number. We do NOT
    // clip to [shownFrom, shownTo]: OSMD's measureList can hold undrawn measures, but their note
    // elements are detached and dropped by the isConnected guard below — so the result is exactly
    // the rendered notes. An explicit measure-number clip here used to wrongly drop the leftmost
    // rendered measure when OSMD's numbering was offset from shownFrom (e.g. a pickup measure),
    // misaligning the chord window from what's drawn.
    measureList.forEach((measures, a) => {
      const num = absoluteMeasureNumber(measures, a, measureList.length);
      (measures || []).forEach((measure) => {
        const system = systemIndexOf(measure, systemCache);   // wrapped-line index (null if unknown)
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
              // Pitch-class name for chord matching. Prefer OSMD's source-note Pitch (the
              // authoritative notated spelling) and fall back to the VexFlow key only when the
              // model is unavailable — the key can drop an accidental drawn as a separate glyph.
              const sourceNote = gnote.sourceNote;
              const pitch = sourceNote && sourceNote.Pitch;
              const name = pitchClassFromPitch(pitch) || vexKeyToPitchClass(vf[0].keys && vf[0].keys[idx]);
              // Skip notes whose notehead isn't actually in the rendered SVG: OSMD's measureList
              // can hold measures outside the drawn window, and their elements are detached
              // (getBBox → 0). Those phantom notes otherwise anchor chord labels at x=0.
              if (!el || !name || el.isConnected === false) return;
              const b = el.getBBox ? el.getBBox() : { x: 0 };
              // MIDI pitch (Pitch.getHalfTone() + 12, as in applyNoteNames) and the note's voice
              // color-index — used to identify suppressed notes and to suppress whole voices.
              const midi = (pitch && typeof pitch.getHalfTone === 'function') ? pitch.getHalfTone() + 12 : null;
              const voiceRef = sourceNote && sourceNote.ParentVoiceEntry && sourceNote.ParentVoiceEntry.ParentVoice;
              const voice = voiceIndexByRef.has(voiceRef) ? voiceIndexByRef.get(voiceRef) : 0;
              // `measure`/`idx` are the note's stable musical key (absolute measure + position
              // within it), used to re-anchor the draggable chord window across re-renders.
              const arr = (byMeasure[num] = byMeasure[num] || []);
              arr.push({ name, left: b.x, el, measure: num, idx: arr.length, onsetBeats, midi, voice, system });
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

  // Map an element to {left,right,top,bottom} in the OVERLAY svg's user space — the space the
  // chord window is drawn in and pointers are mapped to. PRIMARY path: take the element's true
  // on-screen box (getBoundingClientRect, which reflects every transform INCLUDING the CSS scaling
  // that responsive/mobile layout applies to the svg) and project it back through the overlay svg's
  // getScreenCTM().inverse(). This guarantees a round-trip: a rect drawn at these coords on the
  // overlay svg paints exactly where the element paints — which getBBox×getCTM does NOT, because
  // getCTM only sees the svg's internal viewBox transform and misses any CSS scale on the svg, so
  // on a CSS-scaled (mobile) layout the window landed above and short of the notes. Falls back to
  // getBBox×getCTM when there's no screen-CTM (jsdom/tests, or before first paint).
  function elBox(el) {
    if (!el) return null;
    const svg = overlaySvg();
    const scm = svg && svg.getScreenCTM && svg.getScreenCTM();
    const r = el.getBoundingClientRect && el.getBoundingClientRect();
    if (scm && scm.inverse && r && (r.width || r.height)) {
      const inv = scm.inverse();
      const map = (cx, cy) => ({ x: inv.a * cx + inv.c * cy + inv.e, y: inv.b * cx + inv.d * cy + inv.f });
      const p1 = map(r.left, r.top), p2 = map(r.right, r.bottom);
      return { left: Math.min(p1.x, p2.x), right: Math.max(p1.x, p2.x), top: Math.min(p1.y, p2.y), bottom: Math.max(p1.y, p2.y) };
    }
    if (!el.getBBox) return null;
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

  // Per-system [{top,bottom}] in svg-user space, indexed so bands[i] is the band of the notes whose
  // `system === i` — a label/window can sit on the note's OWN line. PRIMARY source is OSMD's system
  // grouping (note.system): each system's extent is the min/max of its own noteheads. This is robust
  // on compressed scores, where the old Y-gap clustering broke because the inter-system gap is no
  // bigger than the within-system note spread. Fallbacks: explicit .vf-stave (none in this build),
  // then zoom-scaled notehead clustering (when the system model isn't reachable).
  const SYSTEM_GAP = 60;   // min vertical whitespace (svg units) separating two systems (fallback)
  // Per-measure svg-space extent (over all notes in the measure, all staves): {num,left,top,bottom}
  // in reading order. The basis for line detection — measures wrap as a unit, so a measure-level
  // X-reset works for single AND multi staff (a within-measure staff switch keeps the same X).
  function measureExtents() {
    const byMeasure = renderedNotesByMeasure();
    return Object.keys(byMeasure).map(Number).sort((a, b) => a - b).map((num) => {
      let left = Infinity, top = Infinity, bottom = -Infinity, sys = null;
      byMeasure[num].forEach((n) => {
        if (!n.el) return; const b = elBox(n.el); if (!b) return;
        left = Math.min(left, b.left); top = Math.min(top, b.top); bottom = Math.max(bottom, b.bottom);
        if (sys == null && n.system != null) sys = n.system;
      });
      return { num, left, top, bottom, system: sys };
    }).filter((x) => x.left !== Infinity);
  }

  function staffBoxes() {
    const ext = measureExtents();
    if (!ext.length) {
      if (container && container.querySelectorAll) {
        const out = []; container.querySelectorAll('.vf-stave').forEach((el) => { const b = elBand(el); if (b) out.push(b); });
        if (out.length) return out.sort((a, b) => a.top - b.top);
      }
      return [];
    }
    // (1) Authoritative — OSMD music-system index per measure, when the model chain is reachable.
    if (ext.some((e) => e.system != null)) {
      const bySystem = new Map();
      ext.forEach((e) => {
        if (e.system == null) return;
        const cur = bySystem.get(e.system);
        if (!cur) bySystem.set(e.system, { top: e.top, bottom: e.bottom });
        else { cur.top = Math.min(cur.top, e.top); cur.bottom = Math.max(cur.bottom, e.bottom); }
      });
      if (bySystem.size) return [...bySystem.keys()].sort((a, b) => a - b).map((k) => bySystem.get(k));
    }
    // (2) Measure-level X-RESET: measures climb left→right across a line and snap back to the left
    // margin at each wrap — scale-independent, and correct for multi-staff too. Each line's band is
    // the full vertical extent of the measures on it. (This OSMD build doesn't expose its systems.)
    const maxLeft = Math.max(...ext.map((e) => e.left));
    const RESET = Math.max(20, maxLeft * 0.35);   // a wrap drops ~a full line width
    const bands = []; let cur = null, prevLeft = -Infinity;
    ext.forEach((e) => {
      if (cur && e.left < prevLeft - RESET) { bands.push(cur); cur = null; }
      prevLeft = e.left;
      if (!cur) cur = { top: e.top, bottom: e.bottom };
      else { cur.top = Math.min(cur.top, e.top); cur.bottom = Math.max(cur.bottom, e.bottom); }
    });
    if (cur) bands.push(cur);
    if (bands.length) return bands;
    // (3) Last resort — zoom-scaled notehead Y-gap clustering.
    const mids = ext.map((e) => ({ top: e.top, bottom: e.bottom, mid: (e.top + e.bottom) / 2 }));
    mids.sort((a, b) => a.mid - b.mid);
    return clusterBandsByGap(mids, SYSTEM_GAP * currentZoom);
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

  // Group all rendered notes into per-system streams (one per wrapped line). x RESETS on each
  // system, so any x-ordered chord scan (overlay detection, global occurrence match) must run
  // within a single system — a global x-sort would conflate notes that share an x-column on
  // different lines. Returns the bands too, for placing each system's labels against its band.
  function notesBySystem() {
    const bands = staffBoxes();                 // [{top,bottom}] per system, indexed by system
    const byMeasure = renderedNotesByMeasure();
    const allNotes = [];
    Object.keys(byMeasure).forEach((m) => allNotes.push(...byMeasure[m]));
    const groups = Array.from({ length: Math.max(1, bands.length) }, () => []);
    allNotes.forEach((n) => {
      // Prefer OSMD's own system index; fall back to nearest band by y only when it's unavailable.
      let idx = (n.system != null && n.system < groups.length) ? n.system : 0;
      if (n.system == null && bands.length) { const b = elBand(n.el); if (b) idx = nearestStaffIdx(bands, (b.top + b.bottom) / 2); }
      groups[idx].push(n);
    });
    return { groups, bands };
  }

  // Every visible note that takes part in a complete occurrence of any chord in `names`, across
  // all systems (occurrence detection runs per system; results unioned, de-duplicated by element).
  function occurrenceNotesForChords(names) {
    if (!names || !names.length) return [];
    const { groups } = notesBySystem();
    const seen = new Set();
    const out = [];
    groups.forEach((notes) => names.forEach((name) => {
      chordOccurrenceNotes(notes, name).forEach((n) => {
        if (n.el && seen.has(n.el)) return;
        if (n.el) seen.add(n.el);
        out.push(n);
      });
    }));
    return out;
  }

  // Chord labels are anchored PER MEASURE (not per sliding-window "area"): each measure's notes are
  // scored as a unit so the vertical downbeat stack drives the label and it can't drift across the
  // barline (the window scan blurred boundaries). But a chord whose completing tone sits just over a
  // barline is allowed: bestChordsCompleting may pull in the measure's NON-STACK neighbours within
  // ±LOOK_BEATS to finish a same-bass chord (conservative — see that function). Shape matches the old
  // areas — [{ x, top, chords }] — so the placement/de-crowding code below is unchanged.
  const LOOK_BEATS = 1.5;   // how far across a barline a completing tone may sit
  function measureChordAreas(notes) {
    // A note is "stacked" if another note in this system shares its onset column — those carry the
    // measure's own harmony and are never borrowed across the barline (only melodic singletons are).
    const xCount = new Map();
    notes.forEach((n) => xCount.set(n.left, (xCount.get(n.left) || 0) + 1));
    const singletons = notes.filter((n) => (xCount.get(n.left) || 0) < 2 && n.onsetBeats != null);
    const byMeasure = new Map();
    notes.forEach((n) => { const arr = byMeasure.get(n.measure) || []; arr.push(n); byMeasure.set(n.measure, arr); });
    const out = [];
    [...byMeasure.keys()].sort((a, b) => a - b).forEach((m) => {
      const mn = byMeasure.get(m);
      if (mn.length < 2) return;
      const own = new Set(mn);
      const onsets = mn.map((n) => n.onsetBeats).filter((v) => v != null);
      let neighbors = [];
      if (onsets.length) {
        const lo = Math.min(...onsets) - LOOK_BEATS, hi = Math.max(...onsets) + LOOK_BEATS;
        neighbors = singletons.filter((n) => !own.has(n) && n.onsetBeats >= lo && n.onsetBeats <= hi);
      }
      const chords = bestChordsCompleting(mn, neighbors, undefined, { key: currentKey, limit: MAX_LABELS_PER_AREA })
        .map((c) => ({ name: c.name, notes: c.notes, chordTones: c.chordTones }));
      if (!chords.length) return;
      out.push({ x: Math.min(...mn.map((n) => n.left)), top: 0, chords, measure: m });
    });
    return out;
  }

  function applyChordOverlay() {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.' + CHORD_LAYER_CLASS).forEach((n) => n.remove());
    if (!showChords) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    // Group rendered notes by system before detecting chords (see notesBySystem). Within one
    // system x is onset order, so we detect per system and place labels against its own band.
    const fallback = systemBounds();            // global extent when no notehead bands are found
    const { groups, bands } = notesBySystem();
    // Drawable bottom of the score in svg-user space: a label placed past this is outside the svg's
    // height and gets clipped (invisible) — which is exactly why a below-the-last-line label vanished.
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const drawBottom = (vb && vb.height) ? (vb.y + vb.height) : Infinity;

    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('class', CHORD_LAYER_CLASS);
    let selectedNotes = [];

    groups.forEach((notes, bandIdx) => {
      if (notes.length < 2) return;
      const areas = measureChordAreas(notes);   // one label group per measure, anchored at its downbeat
      if (!areas.length) return;
      // Local mode: highlight the selected chords' notes wherever they surfaced as an area chord
      // (regardless of label de-crowding). Global mode collects across the whole sheet below.
      if (!globalChordMatch) areas.forEach((area) => area.chords.forEach((ch) => {
        if (selectedChords.has(ch.name)) selectedNotes = selectedNotes.concat(ch.notes);
      }));
      const band = bands[bandIdx] || fallback || { top: 0, bottom: 0 };
      const aboveY = band.top - 8, belowY = band.bottom + 16;
      const belowFits = (belowY + 12) <= drawBottom;   // would a below-label stay on-screen?
      const cols = areas.map((area) => ({ area, x: chordAnchorXY(area).x })).sort((a, b) => a.x - b.x);
      // Place labels ABOVE the staff by default (chord-chart convention, one per measure). Bump to
      // BELOW only when the above row is crowded AND below is on-screen; otherwise place above anyway —
      // a slightly tight label beats one hidden under the staff or clipped off the bottom (which is
      // what dropped m9's "C": its below-the-last-line label fell past the svg height).
      let lastAbove = -Infinity, lastBelow = -Infinity;
      cols.forEach(({ area, x }) => {
        let side = 0;
        if (x - lastAbove >= MIN_LABEL_GAP) { side = 0; lastAbove = x; }
        else if (belowFits && x - lastBelow >= MIN_LABEL_GAP) { side = 1; lastBelow = x; }
        else { side = 0; lastAbove = x; }   // visible-but-tight over hidden
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
          t.textContent = (isSel ? '✓ ' : '') + chordDisplayName(ch.name);
          t.addEventListener('click', () => {
            if (selectedChords.has(ch.name)) selectedChords.delete(ch.name); else selectedChords.add(ch.name);
            applyChordOverlay();
            if (onChordSelect) { try { onChordSelect([...selectedChords]); } catch (_) {} }
          });
          layer.appendChild(t);
        });
      });
    });

    // Global mode: ignore the per-area notes and light up every complete occurrence of each
    // selected chord across the whole visible sheet.
    if (globalChordMatch && selectedChords.size) selectedNotes = occurrenceNotesForChords([...selectedChords]);

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

  // Grey the noteheads that are currently muted (effective set). Runs in postRender, AFTER a fresh
  // osmd.render() has repainted voice colors — so notes no longer muted are already their normal
  // color and need no reset; we only paint the muted ones. No-op unless something is suppressed.
  function applySuppressionDim() {
    if (!container || !container.querySelectorAll || !suppressedNotes.size) return;
    const mutedKeys = new Set(mutedList().map(suppressionKey));
    if (!mutedKeys.size) return;   // hearAll on, or all temp-restored
    orderedRenderedNotes().forEach((n) => {
      if (n.midi == null || !n.el) return;
      const key = suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats });
      if (!mutedKeys.has(key)) return;
      [n.el, ...n.el.querySelectorAll('path, ellipse, circle, rect')].forEach((h) => {
        h.setAttribute('fill', DIM_CONNECTOR_COLOR); h.style.fill = DIM_CONNECTOR_COLOR;
        const st = h.getAttribute('stroke');
        if (st && st !== 'none') { h.setAttribute('stroke', DIM_CONNECTOR_COLOR); h.style.stroke = DIM_CONNECTOR_COLOR; }
      });
      // Practice affordance: a muted note is click-to-hear when not editing the set.
      if (!suppressMode && n.el.style) { n.el.style.cursor = 'pointer'; }
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
        // Prefer OSMD's system index; only fall back to nearest-band-by-y when it's unavailable.
        const band = (n.system != null) ? n.system : (bands.length ? nearestStaffIdx(bands, mid) : 0);
        out.push({ name: n.name, el: n.el, measure: n.measure, idx: n.idx, order: out.length, band,
          onsetBeats: n.onsetBeats, midi: n.midi, voice: n.voice,
          left: box.left, right: box.right, top: box.top, bottom: box.bottom });
      });
    });
    return out;
  }

  // The SVG viewport that note elements resolve to via getCTM. Some OSMD/VexFlow builds nest an
  // inner <svg> whose coordinate system is scaled (by zoom) relative to the OUTER <svg> that
  // container.querySelector('svg') returns. The chord window's coordinates come from elBox (getCTM
  // → this nearest viewport), so its overlay must be appended HERE and pointer coords mapped through
  // HERE — otherwise (only at zoom ≠ 1) the rect renders scaled by the zoom and pointer hit-testing
  // is off. No-op when there's no nesting (viewportElement === the outer svg), so desktop is unchanged.
  function overlaySvg() {
    const head = container && container.querySelector && container.querySelector('.vf-notehead');
    return (head && head.viewportElement) || (container && container.querySelector && container.querySelector('svg')) || null;
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

  // Click a notehead to toggle suppression. Edit-mode → add/remove from S. Practice-mode → toggle
  // temporary restore (T) on a note that is in S. Ignores clicks that aren't on a notehead.
  function onNoteheadClick(ev) {
    const head = ev.target && ev.target.closest && ev.target.closest('.vf-notehead');
    if (!head) return;
    const n = orderedRenderedNotes().find((o) => o.el === head || (o.el && o.el.contains && o.el.contains(head)));
    if (!n || n.midi == null) return;
    const id = { measure: n.measure, midi: n.midi, beats: n.onsetBeats };
    const key = suppressionKey(id);
    if (suppressMode) {
      if (suppressedNotes.has(key)) { suppressedNotes.delete(key); tempRestored.delete(key); }
      else suppressedNotes.set(key, id);
    } else {
      if (!suppressedNotes.has(key)) return;                 // practice: only S notes are clickable
      if (tempRestored.has(key)) tempRestored.delete(key);   // re-suppress
      else tempRestored.add(key);                            // temporarily restore
    }
    redraw();
    if (onSuppressionChange) { try { onSuppressionChange(); } catch (_) {} }
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
    const svg = overlaySvg();   // the noteheads' viewport, so the window's getCTM coords line up
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

    // Edge handles at the true endpoints. Wider than hairline so they're grabbable by a fingertip,
    // and touch-action:none so a touch starting on a handle drags it instead of scrolling the page.
    const s = selected[0], e = selected[selected.length - 1];
    const sBand = bands[s.band] || { top: s.top, bottom: s.bottom };
    const eBand = bands[e.band] || { top: e.top, bottom: e.bottom };
    const HW = 10;   // handle width
    const lh = mkSvg('rect', { x: s.left - (HW + 2), y: sBand.top - 6, width: HW, height: (sBand.bottom - sBand.top) + 12,
      fill: WINDOW_HANDLE, opacity: '0.85', rx: 2, style: 'cursor:ew-resize;touch-action:none' });
    lh.addEventListener('pointerdown', (ev) => startHandleDrag(ev, 'start'));
    const rh = mkSvg('rect', { x: e.right + 2, y: eBand.top - 6, width: HW, height: (eBand.bottom - eBand.top) + 12,
      fill: WINDOW_HANDLE, opacity: '0.85', rx: 2, style: 'cursor:ew-resize;touch-action:none' });
    rh.addEventListener('pointerdown', (ev) => startHandleDrag(ev, 'end'));
    layer.appendChild(lh);
    layer.appendChild(rh);

    svg.appendChild(layer);
    fireWindowChange(selected);
  }

  // Drag an endpoint handle: map the pointer to the nearest note and move that anchor live.
  function startHandleDrag(ev, which) {
    ev.preventDefault(); ev.stopPropagation();
    const svg = overlaySvg();   // map pointer coords through the noteheads' viewport (see overlaySvg)
    if (!svg) return;
    // Capture the pointer on the SVG (which is never removed), NOT the handle: applyChordWindow
    // rebuilds the handle on every move, and on touch the implicit capture sits on the handle —
    // removing it strands the capture and fires a spurious pointercancel, ending the drag after one
    // move. Capturing on the stable SVG keeps the whole drag flowing (and works the same on mouse).
    const pid = ev.pointerId;
    try { svg.setPointerCapture(pid); } catch (_) {}
    const move = (e) => {
      const ordered = orderedRenderedNotes();
      const p = svgPoint(svg, e.clientX, e.clientY);
      const note = pointerToNote(ordered, p.x, p.y);
      if (note) { chordWindow[which] = { measure: note.measure, idx: note.idx }; applyChordWindow(); }
    };
    const up = () => {
      svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up);
      try { svg.releasePointerCapture(pid); } catch (_) {}
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
  }

  // Drag the middle: slide the whole range through reading order by the pointer's note-delta,
  // keeping the note count constant (can roll across a line break); clamped to the rendered notes.
  function startMiddleDrag(ev) {
    // On touch, don't hijack the gesture: let a one-finger drag scroll and a pinch zoom the page
    // (the big translucent rect covers the staff). Reposition the window via the edge handles.
    if (ev.pointerType === 'touch') return;
    ev.preventDefault();
    const svg = overlaySvg();   // see overlaySvg — keeps pointer mapping in the noteheads' space
    if (!svg) return;
    const ordered = orderedRenderedNotes();
    const anchorList = ordered.map((n) => ({ measure: n.measure, idx: n.idx }));
    const a0 = clampAnchorIndex(anchorList, chordWindow.start);
    const b0 = clampAnchorIndex(anchorList, chordWindow.end);
    const grab = pointerToNote(ordered, svgPoint(svg, ev.clientX, ev.clientY).x, svgPoint(svg, ev.clientX, ev.clientY).y);
    const grabOrder = grab ? grab.order : a0;
    const pid = ev.pointerId;
    try { svg.setPointerCapture(pid); } catch (_) {}   // capture on the stable SVG, not the recreated rect
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
    const up = () => {
      svg.removeEventListener('pointermove', move); svg.removeEventListener('pointerup', up); svg.removeEventListener('pointercancel', up);
      try { svg.releasePointerCapture(pid); } catch (_) {}
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
  }

  // Everything that must run after a (re-)layout: dim connectors, then (re)build the note-name
  // overlay, the captured-measure shading, the chord-candidate overlay, the chord window, and
  // notify the UI. Wired to run after EVERY osmd.render() via the render wrap installed in
  // createMusicRenderer — so OSMD's own internal re-renders (notably the render it defers ~1ms
  // after construction, and any autoResize render) can't leave the score un-dimmed or overlays
  // stale. osmd.render() repaints connectors black on every pass, so this must re-dim each time.
  function postRender() {
    applyDimConnectors();
    applyNoteNames();
    applyMeasureHighlight();
    applyChordOverlay();
    applyChordWindow();
    applySuppressionDim();
    if (onAfterRender) { try { onAfterRender(); } catch (_) {} }
  }

  // One render pass: push model colors, then render. The render wrap runs postRender() afterwards.
  function redraw() {
    clearHighlight();
    applyVoiceColors();
    osmd.render();
  }

  function setZoom(factor) { currentZoom = factor || 1; osmd.Zoom = factor; redraw(); }

  // The pickup/anacrusis shift between the app's sequential numbering (music-encoding counts the
  // pickup as measure 1) and the score's printed numbers. Primary: the count of leading implicit
  // (pickup) measures — robust regardless of OSMD's internal MeasureNumber semantics. Fallback for
  // a score with no pickup but shifted printed numbers: 1 − printed-number-of-the-first-measure.
  function computeMeasureOffset() {
    measureOffset = 0;
    try {
      const sms = osmd.Sheet && osmd.Sheet.SourceMeasures;
      if (!sms || !sms.length) return;
      let lead = 0;
      for (const m of sms) { if (m.ImplicitMeasure) lead++; else break; }
      if (lead > 0) { measureOffset = lead; return; }
      const m0 = sms[0];
      const printed = (typeof m0.getPrintedMeasureNumber === 'function') ? m0.getPrintedMeasureNumber() : m0.MeasureNumberPrinted;
      if (Number.isFinite(printed)) measureOffset = 1 - printed;
    } catch (_) { measureOffset = 0; }
  }

  return {
    osmd,
    async loadDetail(detail) {
      if (!detail || detail.format !== 'musicxml' || !detail.source) {
        return { ok: false, reason: 'not-musicxml' };
      }
      await osmd.load(detail.source);
      currentKey = (detail.meta && detail.meta.key) || null;   // powers the chord detector's power-chord fallback
      totalMeasures = (osmd.Sheet && osmd.Sheet.SourceMeasures && osmd.Sheet.SourceMeasures.length) || 0;
      computeMeasureOffset();
      shownFrom = 1; shownTo = totalMeasures || Number.MAX_SAFE_INTEGER;
      selectedChords.clear();   // a fresh piece carries no manual chord picks
      redraw();
      return { ok: true, totalMeasures, measureOffset };
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
    // Pickup/anacrusis shift (sequential − printed); the UI shows/accepts printed measure numbers.
    getMeasureOffset() { return measureOffset; },
    // Toggle the draggable chord window. Off clears its anchors so it re-seeds next time.
    setChordWindow(on) { chordWindow.active = !!on; if (!chordWindow.active) { chordWindow.start = null; chordWindow.end = null; } redraw(); },
    // Toggle "Global" chord matching: when on, a clicked chord name highlights every complete
    // occurrence of it across the visible sheet. Re-applies the overlay highlight in the new scope.
    setGlobalChordMatch(on) { globalChordMatch = !!on; applyChordOverlay(); },
    getGlobalChordMatch() { return globalChordMatch; },
    // Notes forming every complete occurrence of the given chord name(s) across the visible sheet
    // (de-duplicated). For the window-chip "Global" highlight, which lives in the page glue.
    occurrenceNotesForChords(names) { return occurrenceNotesForChords(names); },
    // ── Note suppression ─────────────────────────────────────────────────────────────────────
    // Set/replace the persisted suppressed set (e.g. from a vocab entry); resets transient state.
    // Does NOT fire onSuppressionChange — the caller restores player state explicitly.
    setSuppressedNotes(list) {
      suppressedNotes.clear(); tempRestored.clear(); hearAll = false;
      (list || []).forEach((n) => {
        if (n && n.midi != null && n.beats != null) suppressedNotes.set(suppressionKey(n), { measure: n.measure, midi: n.midi, beats: n.beats });
      });
      redraw();
    },
    getSuppressedNotes() { return [...suppressedNotes.values()]; },     // S, for persistence
    getMutedNotes() { return mutedList(); },                            // effective muted, for the player
    setHearAll(on) { hearAll = !!on; redraw(); if (onSuppressionChange) { try { onSuppressionChange(); } catch (_) {} } },
    setSuppressMode(on) { suppressMode = !!on; redraw(); },
    // Bulk-suppress (on=true) or restore (on=false) every rendered note of a voice in the view.
    suppressVoice(voiceId, on) {
      notesOfVoice(orderedRenderedNotes(), voiceId).forEach((id) => {
        const key = suppressionKey(id);
        if (on) suppressedNotes.set(key, id);
        else { suppressedNotes.delete(key); tempRestored.delete(key); }
      });
      redraw();
      if (onSuppressionChange) { try { onSuppressionChange(); } catch (_) {} }
    },
    // Voices present in the view, for the chips: [{ id, color, allSuppressed }].
    listVoices() {
      const byVoice = new Map();
      orderedRenderedNotes().forEach((n) => {
        if (n.midi == null) return;
        if (!byVoice.has(n.voice)) byVoice.set(n.voice, []);
        byVoice.get(n.voice).push(n);
      });
      return [...byVoice.keys()].sort((a, b) => a - b).map((id) => {
        const notes = byVoice.get(id);
        const allSuppressed = notes.every((n) =>
          suppressedNotes.has(suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
        return { id, color: voiceColor(id), allSuppressed };
      });
    },
    // Live play range of the window: { fromMeasure, toMeasure, fromBeat?, toBeat?, cursorStep },
    // or null when the window is off / empty. Beats are present only when onset times were
    // available (note-accurate; else measure-granular). cursorStep is the number of distinct
    // onsets in the rendered view BEFORE the window's first note, so the player can home the OSMD
    // cursor to the window start (the schedule is re-zeroed). Read fresh, not cached.
    getWindowRange() {
      if (!chordWindow.active) return null;
      const { ordered, selected } = currentWindowSelection();
      const range = rangeFromSelected(selected);
      if (!range) return null;
      const startOrder = selected[0].order;
      const key = (n) => (typeof n.onsetBeats === 'number' ? n.onsetBeats : n.order);
      range.cursorStep = new Set(ordered.filter((n) => n.order < startOrder).map(key)).size;
      return range;
    },
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
