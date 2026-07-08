// public/music-render.js
// Rendering for the music study app: pure measure-mapping helpers (TDD) +
// a thin OSMD wrapper (injectable factory) for whole-piece / segment rendering.
import { primaryVoice } from './music-encoding.js';
import { guessChords, guessChordAreas, bestChords, bestChordsCompleting, chordDisplayName, chordOccurrenceNotes } from './music-chords.js';
import { indexAssignments, colorMap, toggleNote, firstTagForKey, revealedTagForKey, noteId as tagNoteId } from './music-tags.js';
import { findScopedMatches, pcHistogram, guessKey, keyLabel } from './music-pattern.js';
import { addPhrase as addPhraseReducer, removePhrase as removePhraseReducer, setPhraseTag as setPhraseTagReducer,
  removeTagFromPhrases, togglePhraseNote as togglePhraseNoteReducer, resolvePhraseNoteIds, phraseByName } from './music-phrase.js';

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

// Atomically (re)build an overlay `<g class=className>` inside `svg`. `build(layer)` fills a fresh,
// DETACHED group; only if it completes WITHOUT throwing do we remove the old layer(s) and append the
// new one. So a transient geometry error mid-build (getBBox / getScreenCTM can throw or return null
// during a viewport or font-swap transition on mobile) leaves the previous overlay intact instead of
// blanking it. Returns true on a successful swap, false if build threw (old layer kept). No-throw.
export function swapOverlayLayer(svg, className, build) {
  const layer = document.createElementNS(SVG_NS, 'g');
  layer.setAttribute('class', className);
  try { build(layer); }
  catch (_) { return false; }
  svg.querySelectorAll('g.' + className).forEach((n) => n.remove());
  svg.appendChild(layer);
  return true;
}

// Build an SVG <foreignObject> wrapping an HTML <div> as a label at (x, y) in svg-user space. Rendering
// the label as HTML — not an SVG <text> — sidesteps the Blink/Android bug where SVG-text glyph layout
// collapses after a web font (OSMD's engraving font) finishes loading. The foreignObject sits in the
// same coordinate system as the old <text>, so positioning/scroll are unchanged. `anchor` aligns the
// box horizontally: 'start' (x = left edge) or 'middle' (x = centre). `vAlign` aligns it vertically:
// 'baseline' (y = text baseline, matching <text>'s default) or 'middle' (y = vertical centre, for a
// label centred in a dot). Returns the <foreignObject>; its sole child is the <div>.
export function svgHtmlLabel(doc, { x, y, fontSize, anchor = 'start', vAlign = 'baseline', css = '', text }) {
  const fo = doc.createElementNS(SVG_NS, 'foreignObject');
  const w = 240, h = Math.ceil(fontSize * 1.7);
  fo.setAttribute('x', anchor === 'middle' ? x - w / 2 : x);
  fo.setAttribute('y', vAlign === 'middle' ? y - h / 2 : y - fontSize);   // baseline ≈ box top; middle ≈ box centre
  fo.setAttribute('width', w);
  fo.setAttribute('height', h);
  fo.setAttribute('overflow', 'visible');
  const div = doc.createElement('div');
  div.textContent = text;
  div.setAttribute('style',
    `font-size:${fontSize}px;line-height:${h}px;white-space:nowrap;`
    + (anchor === 'middle' ? 'text-align:center;' : '')
    + css);
  fo.appendChild(div);
  return fo;
}
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

// Pure: step a window [a,b] over n reading-order notes by one note. Returns the new {a, b}.
//   moveLeft/moveRight — slide the whole range (count fixed), clamped at the ends
//   expand — grow by one at the end; if already at the last note, grow at the start instead
//   shrink — shrink by one at the end, but never below a single note
export function stepWindowAnchors(a, b, n, action) {
  if (a > b) { const t = a; a = b; b = t; }
  if (action === 'moveLeft') { if (a > 0) { a--; b--; } }
  else if (action === 'moveRight') { if (b < n - 1) { a++; b++; } }
  else if (action === 'expand') { if (b < n - 1) b++; else if (a > 0) a--; }
  else if (action === 'shrink') { if (b > a) b--; }
  a = clamp(a, 0, n - 1); b = clamp(b, 0, n - 1);
  return { a, b };
}

// Pure: move a window [a,b] to the system (line) above (dir=-1) or below (dir=+1), keeping its note
// count and its horizontal position-within-the-line. `bandOf` is the band/system index per ordered
// note. Returns the new {a, b}; unchanged when there is no band in that direction.
export function stepWindowToBand(bandOf, a, b, dir) {
  const n = bandOf.length;
  if (!n) return { a, b };
  if (a > b) { const t = a; a = b; b = t; }
  const width = b - a;
  const curBand = bandOf[a];
  const targetBand = curBand + dir;
  const targetIdxs = [];
  for (let i = 0; i < n; i++) if (bandOf[i] === targetBand) targetIdxs.push(i);
  if (!targetIdxs.length) return { a, b };          // no line that way → stay put
  let posInBand = 0;                                // how far into the current line the start sits
  for (let i = 0; i < a; i++) if (bandOf[i] === curBand) posInBand++;
  const na = targetIdxs[Math.min(posInBand, targetIdxs.length - 1)];
  const nb = clamp(na + width, 0, n - 1);
  return { a: na, b: nb };
}

// Distinct pitch-class names from a list of note objects that carry a `name` (e.g. "C#").
export function pitchClassesOf(notes) {
  const seen = new Set();
  const out = [];
  (notes || []).forEach((n) => {
    const nm = n && n.name;
    if (nm && !seen.has(nm)) { seen.add(nm); out.push(nm); }
  });
  return out;
}

// Scientific-pitch octave for a MIDI number (C4 = 60 → '4'); null when midi is absent.
export function octaveFromMidi(midi) {
  if (typeof midi !== 'number') return null;
  return '' + (Math.floor(midi / 12) - 1);
}

// A VexFlow key ("c#/5", "bb/3", "cn/4") → MIDI number, or null. Used to recover a note's register
// when OSMD's source-note Pitch model is unavailable (then only the VexFlow key carries the octave),
// so the fretboard can still place the note at its true octave instead of treating it as pitch-class.
const VEX_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midiFromVexKey(key) {
  if (!key || typeof key !== 'string') return null;
  const [pcRaw, octRaw] = key.split('/');
  if (!pcRaw || octRaw == null) return null;
  const norm = (pcRaw[0].toUpperCase() + pcRaw.slice(1)).replace(/n/g, '');   // "C#", "Bb"
  let semi = VEX_SEMITONE[norm[0]];
  if (semi == null) return null;
  for (const ch of norm.slice(1)) { if (ch === '#') semi++; else if (ch === 'b') semi--; }
  const oct = parseInt(octRaw, 10);
  if (Number.isNaN(oct)) return null;
  const midi = 12 * (oct + 1) + semi;
  return (midi >= 0 && midi <= 127) ? midi : null;
}

// Distinct { name, octave } pitches from note objects carrying `name` + `midi`. Keeps the actual
// register (so the fretboard can place each note at its real pitch), de-duped by name+octave.
export function noteSetOf(notes) {
  const seen = new Set();
  const out = [];
  (notes || []).forEach((n) => {
    if (!n || !n.name) return;
    const octave = octaveFromMidi(n.midi);
    const key = n.name + '|' + (octave == null ? '' : octave);
    if (!seen.has(key)) { seen.add(key); out.push({ name: n.name, octave }); }
  });
  return out;
}

// Playable events for a note set: [{midi, beat, durBeats}] in onset order (notes without a numeric
// midi dropped). Carries each note's onset + duration so a step is sounded as it reads on the
// sheet — notes sharing an onset stack into a chord, later onsets play in sequence — at the true
// written register, regardless of the fretboard's match-octave mode.
export function eventsOf(notes) {
  return (notes || [])
    .filter((n) => n && typeof n.midi === 'number')
    .map((n) => ({ midi: n.midi, beat: (n.onsetBeats == null ? 0 : n.onsetBeats), durBeats: (n.durBeats == null ? 1 : n.durBeats) }))
    .sort((a, b) => a.beat - b.beat);
}

// Ordered note sequence [{name, octave}] in SHEET (onset) order, with repeats preserved — for the
// fretboard's per-string movement arrows (which need melodic direction, not a de-duped set).
export function seqOf(notes) {
  return (notes || [])
    .filter((n) => n && n.name)
    .slice()
    .sort((a, b) => ((a.onsetBeats == null ? 0 : a.onsetBeats) - (b.onsetBeats == null ? 0 : b.onsetBeats)))
    .map((n) => ({ name: n.name, octave: octaveFromMidi(n.midi) }));
}

// Given measureChordAreas output (ordered), take each measure's top (first) chord.
export function topChordPerMeasure(areas) {
  return (areas || [])
    .filter((a) => a.chords && a.chords.length)
    .map((a) => ({ measure: a.measure, chord: a.chords[0] }));
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
  // Mobile late-settle guard: on phones the URL bar collapsing (≈1s after load), rotation, or the
  // music font finishing can trigger a browser repaint that strands our SVG <text> overlays (note
  // names, chord labels) even though no re-render ran — a known mobile WebKit quirk. Re-apply the
  // overlays when those settle. Debounced and overlay-only (no osmd.render), so it can't reflow the
  // score; postRender's sub-passes are no-ops until a sheet is loaded.
  function reapplyOverlays() { try { postRender(); } catch (_) {} }
  if (typeof window !== 'undefined' && window.addEventListener) {
    let _settleT = null;
    const settle = () => { clearTimeout(_settleT); _settleT = setTimeout(reapplyOverlays, 160); };
    const vv = window.visualViewport;
    if (vv && vv.addEventListener) vv.addEventListener('resize', settle); else window.addEventListener('resize', settle);
    window.addEventListener('orientationchange', settle);
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(reapplyOverlays).catch(() => {});
    }
  }

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
  let stepHighlight = null;      // [from,to] of the current fretboard step's measures (blue band)
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

  // Pattern tags. The tag list is GLOBAL (tagRegistry: [{name,color}], supplied by the host), while
  // the note assignments are per-piece (assignments: [{name, notes}], persisted as detail.patterns).
  // tagMode → notehead clicks add/remove the note in the active tag (no muting). filter dims notes
  // not in the selected tags. Color comes from the registry; first-tag wins for a multi-tag note.
  let assignments = [];              // per-piece [{ name, notes:[{measure,midi,beats}] }]
  let tagRegistry = [];              // global [{ name, color }]
  let tagMode = false;
  let activeTag = null;              // the tag that notehead clicks paint into
  let tagFilter = false;             // when on, dim notes not in the selected tags
  let filterTags = new Set();        // tag names the filter shows
  const onPatternsChange = opts.onPatternsChange;   // fired after the user edits per-piece assignments
  // Phrases: per-piece [{ name, color, tags:[tagName], notes:[{measure,midi,beats}] }] — a logical
  // group of member tags plus extra hand-picked notes, resolved live to the union of their notes
  // (see music-phrase.js), for highlighting/playing together, find, and fretboard capture.
  // Persisted as detail.phrases.
  let phrases = [];
  let phrasePaintMode = false;       // when on, notehead clicks add/remove the active phrase's extra notes
  let activePhrase = null;           // the phrase that paint-mode clicks edit
  let phraseFilter = false;          // when on (phrase panel open), dim notes not in a shown phrase
  let shownPhrases = new Set();       // phrase names whose notes are revealed + tinted on the sheet
  const onPhrasesChange = opts.onPhrasesChange;     // fired after the user edits phrases
  // A detached copy of the per-piece assignments, safe to persist / hand to the UI.
  function getAssignments() {
    return assignments.map((a) => ({ name: a.name, notes: (a.notes || []).map((n) => ({ ...n })) }));
  }
  // A detached copy of the phrases, safe to persist / hand to the UI.
  function getPhrases() {
    return phrases.map((p) => ({ name: p.name, color: p.color, tags: [...(p.tags || [])], notes: (p.notes || []).map((n) => ({ ...n })) }));
  }
  function firePhrasesChange() { if (onPhrasesChange) { try { onPhrasesChange(getPhrases()); } catch (_) {} } }

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
    const svg = container.querySelector('svg');
    if (!noteNames) { container.querySelectorAll('.note-name-layer').forEach((n) => n.remove()); return; }
    const measureList = osmd.graphic && osmd.graphic.measureList;
    if (!measureList || !measureList.forEach || !svg) return;
    // Build-then-swap: a getBBox that throws/returns garbage mid-transition won't blank the labels.
    swapOverlayLayer(svg, 'note-name-layer', (layer) => {
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
                let b; try { b = head.getBBox(); } catch (_) { return; }   // skip a note whose box isn't measurable yet
                // HTML label (foreignObject), not SVG <text>: on Android/Blink SVG-text glyphs collapse
                // after OSMD's music font loads. Centred above the notehead. The white halo (so a staff
                // line can't strike through the glyph) is a CSS text-shadow instead of paint-order stroke.
                const fo = svgHtmlLabel(document, {
                  x: b.x + b.width / 2, y: b.y - 2, fontSize: 7, anchor: 'middle',
                  css: 'color:#444;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 2px #fff;',
                  text: label,
                });
                layer.appendChild(fo);
              });
            });
          });
        });
      });
    });
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
              // color-index — used to identify suppressed notes and to suppress whole voices. When the
              // Pitch model is missing, recover the register from the VexFlow key (which carries the
              // octave) so the note isn't left octave-less — that made fretboard capture place such a
              // note (e.g. a borrowed chord tone) at an arbitrary octave.
              const midi = (pitch && typeof pitch.getHalfTone === 'function')
                ? pitch.getHalfTone() + 12
                : midiFromVexKey(vf[0].keys && vf[0].keys[idx]);
              // Note duration in quarter-beats (Length is in whole notes → ×4), for pattern search.
              const len = sourceNote && sourceNote.Length;
              const durBeats = (len && typeof len.RealValue === 'number') ? len.RealValue * 4 : null;
              const voiceRef = sourceNote && sourceNote.ParentVoiceEntry && sourceNote.ParentVoiceEntry.ParentVoice;
              const voice = voiceIndexByRef.has(voiceRef) ? voiceIndexByRef.get(voiceRef) : 0;
              // `measure`/`idx` are the note's stable musical key (absolute measure + position
              // within it), used to re-anchor the draggable chord window across re-renders.
              const arr = (byMeasure[num] = byMeasure[num] || []);
              arr.push({ name, left: b.x, el, measure: num, idx: arr.length, onsetBeats, midi, durBeats, voice, system });
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

  // Recolor the given noteheads in `color` (default chord yellow); sets both the fill attribute and
  // the inline style so it wins over OSMD's voice-color style. Does NOT clear prior highlights, so
  // several groups (e.g. per-tag pattern matches) can be painted in different colors — callers that
  // want a fresh start call clearHighlight() first.
  function highlightNotes(notes, color = CHORD_HL_COLOR) {
    (notes || []).forEach((nt) => {
      const el = nt && nt.el;
      if (!el || !el.querySelectorAll) return;
      el.querySelectorAll('path').forEach((p) => {
        if (!p.hasAttribute('data-chord-orig')) {
          p.setAttribute('data-chord-orig', p.getAttribute('fill') || '');
          p.setAttribute('data-chord-orig-style', p.style.fill || '');
        }
        p.setAttribute('fill', color);
        p.style.fill = color;
      });
    });
  }
  // Highlight one chord's notes in yellow, replacing any prior highlight.
  function highlightChord(notes) { clearHighlight(); highlightNotes(notes, CHORD_HL_COLOR); }

  // Overlay stacked chord-candidate labels above each detected chord area. Each area shows its
  // best few chords (closest to the staff = best); clicking a label highlights that chord's
  // notes. Removed + rebuilt every render. No-op without a DOM svg (test fakes, jsdom).
  const CHORD_LAYER_CLASS = 'chord-area-layer';
  const MIN_LABEL_GAP = 30;        // min horizontal spacing between label columns (de-crowd)
  const MAX_LABELS_PER_AREA = 2;   // cap the vertical stack so labels don't pile up

  // overlay-svg-space anchor for an area's labels: its leftmost contributing notehead, projected
  // through elBox (getBoundingClientRect → overlaySvg.getScreenCTM().inverse()). This is the SAME
  // space the y-bands and the chord window use, so labels land on the notes even on a CSS-scaled
  // (mobile) layout — where the old getBBox×getCTM path missed the svg's CSS scale and bunched the
  // labels into the left half of the line.
  function chordAnchorXY(area) {
    let anchor = null;
    area.chords.forEach((ch) => (ch.notes || []).forEach((n) => {
      if (n && n.el && (anchor === null || (n.left || 0) < (anchor.left || 0))) anchor = n;
    }));
    if (anchor && anchor.el) {
      const b = elBox(anchor.el);
      if (b) return { x: b.left, top: b.top, bottom: b.bottom };
    }
    return { x: area.x, top: area.top, bottom: area.top };
  }

  // Top/bottom of the rendered staff lines in overlay-svg space (falls back to the notehead
  // extent), so chord labels can sit on even rows above/below the staff rather than per-note.
  // Uses elBox (getScreenCTM projection) to match the bands/anchors — the old getBBox×getCTM
  // missed the svg's CSS scale on mobile.
  function systemBounds() {
    const staves = container.querySelectorAll('.vf-stave');
    const els = staves.length ? staves : container.querySelectorAll('.vf-notehead');
    let top = Infinity, bottom = -Infinity;
    els.forEach((el) => {
      const b = elBox(el);
      if (!b) return;
      if (b.top < top) top = b.top;
      if (b.bottom > bottom) bottom = b.bottom;
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
    // Draw into the SAME viewport the anchors/bands resolve to (overlaySvg = the noteheads' nearest
    // <svg>, which is the inner zoom-scaled one when OSMD nests). Appending to the outer svg while
    // positioning in overlaySvg space is what pushed the labels into the left half on mobile.
    const svg = overlaySvg();
    if (!showChords) { container.querySelectorAll('.' + CHORD_LAYER_CLASS).forEach((n) => n.remove()); return; }
    if (!svg) return;
    let selectedNotes = [];
    // Build-then-swap: notesBySystem/elBox use getScreenCTM, which can throw/return null mid-transition
    // on mobile. On failure the previous chord labels (and highlight) stay put instead of blanking.
    const ok = swapOverlayLayer(svg, CHORD_LAYER_CLASS, (layer) => {
    // Group rendered notes by system before detecting chords (see notesBySystem). Within one
    // system x is onset order, so we detect per system and place labels against its own band.
    const fallback = systemBounds();            // global extent when no notehead bands are found
    const { groups, bands } = notesBySystem();
    // Drawable bottom of the score in svg-user space: a label placed past this is outside the svg's
    // height and gets clipped (invisible) — which is exactly why a below-the-last-line label vanished.
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const drawBottom = (vb && vb.height) ? (vb.y + vb.height) : Infinity;

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
          // HTML label (foreignObject) instead of SVG <text> — see svgHtmlLabel: SVG text glyphs
          // collapse on Android/Blink after OSMD's font loads; HTML text doesn't.
          const fo = svgHtmlLabel(document, {
            x, y: side === 0 ? (aboveY - k * 11) : (belowY + k * 11),
            fontSize: isSel ? 11 : 9, anchor: 'start',
            css: `font-weight:700;cursor:pointer;color:${isSel ? '#c62828' : '#1565c0'};`
              + (isSel ? 'text-decoration:underline;' : ''),
            text: (isSel ? '✓ ' : '') + chordDisplayName(ch.name),
          });
          fo.firstChild.addEventListener('click', () => {
            if (selectedChords.has(ch.name)) selectedChords.delete(ch.name); else selectedChords.add(ch.name);
            applyChordOverlay();
            if (onChordSelect) { try { onChordSelect([...selectedChords]); } catch (_) {} }
          });
          layer.appendChild(fo);
        });
      });
    });

    // Global mode: ignore the per-area notes and light up every complete occurrence of each
    // selected chord across the whole visible sheet.
    if (globalChordMatch && selectedChords.size) selectedNotes = occurrenceNotesForChords([...selectedChords]);
    });
    // Only touch the highlight when the rebuild actually succeeded (otherwise keep the prior state).
    if (ok) { if (selectedNotes.length) highlightChord(selectedNotes); else clearHighlight(); }
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

  // Shade a [from,to] measure range behind the notes. One translucent rect per matching measure,
  // sized from its VexFlow stave geometry (the same coordinates OSMD renders into, per
  // getMeasurePosition in the original analysis code) — robust across line breaks and
  // partial/segment renders. No-op without a range.
  function shadeMeasureRange(svg, measureList, range, { cls, fill, opacity }) {
    if (!range) return;
    const [from, to] = range;
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
      rect.setAttribute('class', cls);
      rect.setAttribute('x', x1);
      rect.setAttribute('y', y1 - padY);
      rect.setAttribute('width', x2 - x1);
      rect.setAttribute('height', (y2 - y1) + 2 * padY);
      rect.setAttribute('fill', fill);
      rect.setAttribute('opacity', opacity);
      rect.setAttribute('pointer-events', 'none');
      svg.insertBefore(rect, svg.firstChild);   // first child → painted behind the notes
    });
  }

  // Two independent shaded bands, rebuilt on every render: the captured vocab range (yellow) and
  // the current fretboard step's measures (blue, echoing the fretboard dots). No-op without a DOM svg.
  const MEASURE_HL_CLASS = 'measure-hl-layer';
  const STEP_HL_CLASS = 'step-hl-layer';
  function applyMeasureHighlight() {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.' + MEASURE_HL_CLASS + ',.' + STEP_HL_CLASS).forEach((n) => n.remove());
    if (!measureHighlight && !stepHighlight) return;
    const svg = container.querySelector('svg');
    const measureList = osmd.graphic && osmd.graphic.measureList;
    if (!svg || !measureList || !measureList.length) return;
    shadeMeasureRange(svg, measureList, measureHighlight, { cls: MEASURE_HL_CLASS, fill: '#ffe9a8', opacity: '0.5' });
    shadeMeasureRange(svg, measureList, stepHighlight, { cls: STEP_HL_CLASS, fill: '#1565c0', opacity: '0.18' });
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

  // Color noteheads by their pattern tag (first tag wins) and, when the filter is on, dim notes that
  // aren't in a selected tag. Runs in postRender AFTER applySuppressionDim so tag colors win over the
  // suppression grey. No-op when there are no patterns.
  // Tag + phrase coloring / dimming, in one pass. The tag panel (tagFilter) and phrase panel
  // (phraseFilter) each act as a "dim mode": while open, notes NOT in a revealed tag/phrase are
  // dimmed, and a note is revealed (kept lit + colored) when its tag is checked (filterTags) or a
  // phrase containing that tag is shown (shownPhrases). The tag currently being painted is always
  // revealed so authoring stays visible. When neither panel is open, tagged notes keep their base
  // color-by-tag and nothing dims. Phrase color wins over tag color on a shared note.
  function applyTagOverlay() {
    if (!container || !container.querySelectorAll) return;
    if (!tagFilter && !phraseFilter && !assignments.length) return;   // nothing to color / dim
    const indexed = indexAssignments(assignments);
    const cmap = colorMap(tagRegistry);
    const revealTags = new Set(filterTags);
    if (tagMode && activeTag) revealTags.add(activeTag);
    const revealPhrases = new Set(shownPhrases);
    if (phrasePaintMode && activePhrase) revealPhrases.add(activePhrase);   // keep the painted phrase visible
    // note-id → phrase color, for the revealed phrases (their resolved union of tags' + extra notes).
    const phraseKeyColor = new Map();
    if (phraseFilter) phrases.forEach((p) => {
      if (revealPhrases.has(p.name)) resolvePhraseNoteIds(p, assignments).forEach((n) => phraseKeyColor.set(tagNoteId(n), p.color));
    });
    orderedRenderedNotes().forEach((n) => {
      if (n.midi == null || !n.el) return;
      const key = tagNoteId({ measure: n.measure, midi: n.midi, beats: n.onsetBeats });
      let paint = null, lit = false;
      if (phraseFilter && phraseKeyColor.has(key)) { paint = phraseKeyColor.get(key); lit = true; }
      else if (tagFilter) {
        // Light the note for ANY revealed tag it belongs to — not just its first tag — so a note
        // shared with an earlier (hidden) tag still shows when a later tag is revealed.
        const tname = revealedTagForKey(indexed, key, revealTags);
        if (tname) { paint = cmap[tname]; lit = true; }
      } else {
        const tname = firstTagForKey(indexed, key);
        if (tname) { paint = cmap[tname]; }   // panels closed → base color-by-tag, no dim
      }
      if (!lit && (tagFilter || phraseFilter)) paint = DIM_CONNECTOR_COLOR;   // dim the un-revealed
      if (!paint) return;
      [n.el, ...n.el.querySelectorAll('path, ellipse, circle, rect')].forEach((h) => {
        h.setAttribute('fill', paint); h.style.fill = paint;
        const st = h.getAttribute('stroke');
        if (st && st !== 'none') { h.setAttribute('stroke', paint); h.style.stroke = paint; }
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
        // Prefer OSMD's system index; only fall back to nearest-band-by-y when it's unavailable.
        const band = (n.system != null) ? n.system : (bands.length ? nearestStaffIdx(bands, mid) : 0);
        out.push({ name: n.name, el: n.el, measure: n.measure, idx: n.idx, order: out.length, band,
          onsetBeats: n.onsetBeats, midi: n.midi, durBeats: n.durBeats, voice: n.voice,
          left: box.left, right: box.right, top: box.top, bottom: box.bottom });
      });
    });
    return out;
  }

  const NOTE_EPS = 1e-6;
  // Stream indices (ascending) of the given note identities in the rendered `ordered` stream,
  // matched by (midi, onset). Unrendered notes drop out. Shared by tag + phrase pattern search.
  function orderedIndicesFor(noteIds, ordered) {
    return (noteIds || [])
      .map((tn) => ordered.findIndex((n) => n.midi === tn.midi && Math.abs((n.onsetBeats == null ? NaN : n.onsetBeats) - tn.beats) < NOTE_EPS))
      .filter((i) => i >= 0)
      .sort((p, q) => p - q);
  }

  // Resolve the diatonic key ONCE from the whole piece (or honor the picked `key`), so a search's
  // key label and every tag/phrase within it use the same key. Null unless diatonic + interval mode.
  function resolveSearchKey(ordered, { intervalBasis, wantInt, key }) {
    if (intervalBasis !== 'diatonic' || !wantInt) return null;
    return key || guessKey(pcHistogram(ordered.map((n) => n.midi)));
  }

  // Search the open sheet for other occurrences of each checked filter tag's note pattern, and
  // highlight every match in that tag's color. Matched by intervals / durations / both. The pattern
  // is scoped to the melodic voice(s) the tag lives in (see findScopedMatches), so accompaniment /
  // bar-line crossings don't count toward the gap structure. intervalBasis 'chromatic' (literal
  // semitones) or 'diatonic' (scale-degree steps under `key`, or a best-guess key when `key` is
  // null). Returns { results: [{name,color,count}], keyLabel }.
  // Groups from the most recent pattern search: `lastPatternMatches` = OTHER occurrences (for
  // Play-tags + fretboard); `lastPatternOriginals` = each tag's own occurrence (fretboard, so the
  // capture shows every occurrence in piece order — originals + matches).
  let lastPatternMatches = [];
  let lastPatternOriginals = [];
  // The most recent pattern search, as a thunk that re-applies it. Match highlights are painted
  // directly onto notehead paths, so an osmd.render (autoResize, zoom settle, font load) wipes them;
  // postRender re-invokes this so occurrences survive re-renders. Cleared when the tag selection or
  // assignments change (the search must be re-run explicitly then). `_inReapply` guards re-entry.
  let lastSearch = null;
  let _inReapply = false;
  function searchTagPatterns({ mode = 'intervals', durationStrict = true, intervalBasis = 'chromatic', key = null } = {}) {
    clearHighlight();
    lastPatternMatches = [];
    lastPatternOriginals = [];
    const ordered = orderedRenderedNotes();
    const stream = ordered.map((n) => ({ midi: n.midi, durBeats: n.durBeats, voice: n.voice, onset: n.onsetBeats }));
    const wantInt = mode === 'intervals' || mode === 'both';
    const resolvedKey = resolveSearchKey(ordered, { intervalBasis, wantInt, key });
    const resolvedKeyLabel = resolvedKey ? keyLabel(resolvedKey.tonicPc, resolvedKey.mode) : null;
    const cmap = colorMap(tagRegistry);
    const results = [];
    assignments.forEach((a) => {
      if (!filterTags.has(a.name)) return;
      const color = cmap[a.name] || CHORD_HL_COLOR;
      // Locate this tag's notes in the rendered stream by (midi, onset); keep those visible, ordered.
      const idx = orderedIndicesFor(a.notes, ordered);
      if (idx.length < 2) { results.push({ name: a.name, color, count: 0 }); return; }
      const { originalIdx, matches } = findScopedMatches(stream, idx, { mode, durationStrict, intervalBasis, key: resolvedKey });
      lastPatternOriginals.push({ name: a.name, notes: originalIdx.map((i) => ordered[i]) });   // the tag's own occurrence
      matches.forEach((m) => {
        const notes = m.map((i) => ordered[i]);
        highlightNotes(notes, color);
        lastPatternMatches.push({ name: a.name, notes });   // one group per matched occurrence
      });
      results.push({ name: a.name, color, count: matches.length });
    });
    lastSearch = () => searchTagPatterns({ mode, durationStrict, intervalBasis, key });   // re-apply on re-render
    return { results, keyLabel: resolvedKeyLabel };
  }

  // ── Phrases ────────────────────────────────────────────────────────────────────────────────
  // Resolve a phrase to onset-ordered note identities [{measure,midi,beats}] (its member tags'
  // notes + extra notes, unioned) — the play-set for playing the phrase together. Empty when unknown.
  function getPhraseNoteIds(name) {
    return resolvePhraseNoteIds(phraseByName(phrases, name), assignments);
  }

  // Every phrase as fretboard capture steps — ONE step per phrase (all its resolved notes together),
  // in creation order. Mirrors how "Motifs" captures each occurrence as a single step. Each step
  // carries notes/seq/events/measures. Honors includeSuppressed. Empty when no phrase has notes drawn.
  function getPhrasesSequence({ includeSuppressed = false } = {}) {
    const ordered = orderedRenderedNotes();
    const mutedKeys = includeSuppressed ? new Set()
      : new Set(mutedList().map((n) => suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
    const steps = [];
    phrases.forEach((p) => {
      const all = orderedIndicesFor(resolvePhraseNoteIds(p, assignments), ordered).map((i) => ordered[i]);
      const live = all.filter((n) => !mutedKeys.has(suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
      const src = live.length ? live : all;
      if (!src.length) return;
      const ms = src.map((n) => n.measure).filter((m) => m != null);
      const m0 = ms.length ? Math.min(...ms) : null;
      steps.push({ name: `${p.name}${m0 != null ? ` · m${m0}` : ''}`, notes: noteSetOf(src), seq: seqOf(src),
        events: eventsOf(src), measures: ms.length ? [m0, Math.max(...ms)] : null });
    });
    return steps;
  }

  // Find + highlight other occurrences of a phrase's note sequence on the open sheet — SAME engine
  // and rules as tag/motif search (intervals/duration/both, chromatic/diatonic). Highlights the
  // phrase's own occurrence and every match in the phrase color. Returns { count, keyLabel }.
  function searchPhrasePattern(name, { mode = 'intervals', durationStrict = true, intervalBasis = 'chromatic', key = null } = {}) {
    clearHighlight();
    const phrase = phraseByName(phrases, name);
    if (!phrase) return { count: 0, keyLabel: null };
    lastSearch = () => searchPhrasePattern(name, { mode, durationStrict, intervalBasis, key });   // re-apply on re-render
    const ordered = orderedRenderedNotes();
    const stream = ordered.map((n) => ({ midi: n.midi, durBeats: n.durBeats, voice: n.voice, onset: n.onsetBeats }));
    const wantInt = mode === 'intervals' || mode === 'both';
    const resolvedKey = resolveSearchKey(ordered, { intervalBasis, wantInt, key });
    const resolvedKeyLabel = resolvedKey ? keyLabel(resolvedKey.tonicPc, resolvedKey.mode) : null;
    const idx = orderedIndicesFor(resolvePhraseNoteIds(phrase, assignments), ordered);
    const color = phrase.color || CHORD_HL_COLOR;
    highlightNotes(idx.map((i) => ordered[i]), color);   // the phrase's own occurrence
    if (idx.length < 2) return { count: 0, keyLabel: resolvedKeyLabel };
    const { matches } = findScopedMatches(stream, idx, { mode, durationStrict, intervalBasis, key: resolvedKey });
    matches.forEach((m) => highlightNotes(m.map((i) => ordered[i]), color));
    return { count: matches.length, keyLabel: resolvedKeyLabel };
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
    if (phrasePaintMode) {   // paint the note into the active phrase's extra notes; wins over tag/suppress
      if (!activePhrase) return;
      phrases = togglePhraseNoteReducer(phrases, activePhrase, id);
      redraw();
      firePhrasesChange();
      return;
    }
    if (tagMode) {   // paint the note into the active tag (no muting); takes precedence over suppress
      if (!activeTag) return;
      assignments = toggleNote(assignments, activeTag, id);
      redraw();
      if (onPatternsChange) { try { onPatternsChange(getAssignments()); } catch (_) {} }
      return;
    }
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

  // Step the window without dragging (for touch / small screens). action:
  //   'moveLeft'|'moveRight' — slide the whole range one note through reading order (count fixed)
  //   'moveUp'|'moveDown'    — jump to the line (system) above/below at the same horizontal spot
  //   'expand'|'shrink'       — grow/shrink the range by one note at the end (expand falls back to
  //                             the start edge when already at the last note; shrink keeps ≥1 note)
  function adjustWindow(action) {
    if (!chordWindow.active) return;
    const ordered = orderedRenderedNotes();
    if (!ordered.length) return;
    currentWindowSelection();   // seed start/end the first time
    const anchorList = ordered.map((n) => ({ measure: n.measure, idx: n.idx }));
    const a0 = clampAnchorIndex(anchorList, chordWindow.start);
    const b0 = clampAnchorIndex(anchorList, chordWindow.end);
    const { a, b } = (action === 'moveUp' || action === 'moveDown')
      ? stepWindowToBand(ordered.map((nn) => nn.band || 0), a0, b0, action === 'moveUp' ? -1 : 1)
      : stepWindowAnchors(a0, b0, ordered.length, action);
    chordWindow.start = anchorList[a];
    chordWindow.end = anchorList[b];
    applyChordWindow();
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
    applyTagOverlay();
    // Re-paint the last pattern search's occurrences (over the fresh overlay) so a re-render doesn't
    // strip them. Guarded so the search's own clearHighlight/highlightNotes can't recurse into here.
    if (lastSearch && !_inReapply) { _inReapply = true; try { lastSearch(); } catch (_) {} finally { _inReapply = false; } }
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

  // Read-only: the auto-guessed chords as an ordered step sequence. Concatenates per-system
  // measure chords in reading order; each step's noteNames are the chord's pitch classes with
  // suppressed notes excluded unless includeSuppressed. Reuses measureChordAreas + mutedList.
  function getGuessedChordSequence({ includeSuppressed = false } = {}) {
    const { groups } = notesBySystem();
    const mutedKeys = includeSuppressed ? new Set()
      : new Set(mutedList().map((n) => suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
    const steps = [];
    groups.forEach((notes) => {
      topChordPerMeasure(measureChordAreas(notes)).forEach(({ measure, chord }) => {
        const live = (chord.notes || []).filter((n) =>
          !mutedKeys.has(suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
        const src = live.length ? live : chord.notes;
        steps.push({ measure, name: chord.name, notes: noteSetOf(src), seq: seqOf(src), events: eventsOf(src), measures: [measure, measure] });
      });
    });
    steps.sort((a, b) => a.measure - b.measure);
    return steps;
  }

  // Read-only: the current chord-window selection as one note-set, or null when no window is active.
  function getWindowNoteSet({ includeSuppressed = false } = {}) {
    if (!chordWindow.active) return null;
    const { selected } = currentWindowSelection();
    if (!selected || !selected.length) return null;
    const mutedKeys = includeSuppressed ? new Set()
      : new Set(mutedList().map((n) => suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
    const live = selected.filter((n) =>
      !mutedKeys.has(suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
    const range = rangeFromSelected(selected);
    return {
      measureRange: range ? [range.fromMeasure, range.toMeasure] : null,
      notes: noteSetOf(live.length ? live : selected),
      seq: seqOf(live.length ? live : selected),
      events: eventsOf(live.length ? live : selected),
    };
  }

  return {
    osmd,
    getGuessedChordSequence,
    getWindowNoteSet,
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
      assignments = (detail.patterns || []).map((p) => ({ name: p.name, notes: (p.notes || []).map((n) => ({ ...n })) }));
      phrases = (detail.phrases || []).map((p) => ({ name: p.name, color: p.color, tags: [...(p.tags || [])], notes: (p.notes || []).map((n) => ({ ...n })) }));
      tagMode = false; activeTag = null; tagFilter = false; filterTags = new Set();   // tagRegistry is global — not reset here
      phrasePaintMode = false; activePhrase = null; phraseFilter = false; shownPhrases = new Set();
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
    // Move/resize the window by one note without dragging (touch-friendly). See adjustWindow.
    adjustWindow(action) { adjustWindow(action); },

    // ── Pattern tags ──────────────────────────────────────────────────────────────────────────
    // The global tag list [{name,color}] — colors and the selectable names come from here. The host
    // owns it (persisted device-wide) and pushes it in; it is NOT reset on piece load.
    setTagRegistry(list) { tagRegistry = (list || []).map((t) => ({ name: t.name, color: t.color })); redraw(); },
    getTagNames() { return tagRegistry.map((t) => t.name); },
    getTagColors() { return colorMap(tagRegistry); },
    // Per-piece note assignments [{name, notes}], persisted as detail.patterns. setPatterns does not
    // fire onPatternsChange (used on load); editing notes via tag-mode clicks does.
    setPatterns(list) { assignments = (list || []).map((a) => ({ name: a.name, notes: (a.notes || []).map((n) => ({ ...n })) })); lastPatternMatches = []; lastPatternOriginals = []; lastSearch = null; redraw(); },
    getPatterns() { return getAssignments(); },
    // Drop a tag's note assignments in THIS piece (called when the global tag is deleted). Fires
    // onPatternsChange so the piece persists.
    clearTagAssignments(name) {
      assignments = assignments.filter((a) => a.name !== name);
      if (activeTag === name) activeTag = null;
      filterTags.delete(name);
      // A deleted tag also stops being a member of any phrase.
      const before = JSON.stringify(phrases.map((p) => p.tags));
      phrases = removeTagFromPhrases(phrases, name);
      redraw();
      if (onPatternsChange) { try { onPatternsChange(getAssignments()); } catch (_) {} }
      if (before !== JSON.stringify(phrases.map((p) => p.tags))) firePhrasesChange();
    },
    // Enter/leave tag-paint mode; clicking noteheads then edits the active tag.
    setTagMode(on) { if (tagMode === !!on) return; tagMode = !!on; redraw(); },
    setActiveTag(name) { activeTag = name || null; },
    // Filtering: master on/off plus the set of tag names to keep highlighted (others dim).
    setTagFilter(on) { tagFilter = !!on; redraw(); },
    setFilterTags(names) {
      const next = new Set(names || []);
      // No-op when the selection is unchanged: renderTagUI re-pushes the same set on every rebuild
      // (e.g. when the Motifs panel expands), and redrawing there would clear the pattern search and
      // dim its occurrences. Only a real selection change resets the search.
      if (next.size === filterTags.size && [...next].every((n) => filterTags.has(n))) return;
      filterTags = next; lastPatternMatches = []; lastPatternOriginals = []; lastSearch = null; redraw();
    },
    // Note identities [{measure,midi,beats}] of the currently-checked filter tags, merged across
    // tags, de-duplicated, and sorted by onset — the play-set for tag skip-playback. [] if none.
    getFilterNotes() {
      const seen = new Set();
      const out = [];
      assignments.forEach((a) => {
        if (!filterTags.has(a.name)) return;
        (a.notes || []).forEach((n) => {
          const k = suppressionKey(n);
          if (seen.has(k)) return;
          seen.add(k);
          out.push({ measure: n.measure, midi: n.midi, beats: n.beats });
        });
      });
      return out.sort((x, y) => x.beats - y.beats);
    },
    // Find + highlight other occurrences of each checked tag's pattern on the open sheet. Returns
    // [{name, color, count}]. mode ∈ 'intervals'|'duration'|'both'; durationStrict toggles exact vs
    // proportional duration matching.
    searchTagPatterns(opts) { return searchTagPatterns(opts); },

    // ── Phrases (named logical group of tags; see music-phrase.js) ───────────────────────────
    // Per-piece phrase list, persisted as detail.phrases. setPhrases does NOT fire onPhrasesChange
    // (used on load / restore); the editing methods below do.
    setPhrases(list) {
      phrases = (list || []).map((p) => ({ name: p.name, color: p.color, tags: [...(p.tags || [])], notes: (p.notes || []).map((n) => ({ ...n })) }));
      redraw();
    },
    getPhrases() { return getPhrases(); },
    getPhraseNames() { return phrases.map((p) => p.name); },
    getPhraseColors() { const m = {}; phrases.forEach((p) => { m[p.name] = p.color; }); return m; },
    // Create a phrase (next palette color); no-op on blank/duplicate. Returns whether it was added.
    addPhrase(name) {
      const { phrases: next, added } = addPhraseReducer(phrases, name);
      if (added) { phrases = next; firePhrasesChange(); redraw(); }
      return added;
    },
    removePhrase(name) {
      phrases = removePhraseReducer(phrases, name);
      if (activePhrase === name) activePhrase = null;
      shownPhrases.delete(name);
      firePhrasesChange(); redraw();
    },
    // Add/remove a member tag on a phrase (its notes resolve live from the tags + extra notes).
    setPhraseTag(name, tagName, on) { phrases = setPhraseTagReducer(phrases, name, tagName, !!on); firePhrasesChange(); redraw(); },
    // Enter/leave phrase-paint mode; notehead clicks then add/remove the active phrase's extra notes.
    setPhrasePaintMode(on) { if (phrasePaintMode === !!on) return; phrasePaintMode = !!on; redraw(); },
    setActivePhrase(name) { activePhrase = name || null; },
    // Phrase "dim mode" (on while the phrase panel is open): dim notes not in a shown phrase.
    setPhraseFilter(on) { phraseFilter = !!on; redraw(); },
    // The set of phrase names whose resolved notes are revealed + tinted on the sheet.
    setShownPhrases(names) { shownPhrases = new Set(names || []); redraw(); },
    getPhraseNoteIds(name) { return getPhraseNoteIds(name); },
    getPhrasesSequence(opts) { return getPhrasesSequence(opts); },
    searchPhrasePattern(name, opts) { return searchPhrasePattern(name, opts); },
    // Best-guess key of the currently-rendered notes (Krumhansl-Schmuckler profiles), as
    // { tonicPc, mode, label } — powers the diatonic key picker's default. null when nothing is drawn.
    guessBestKey() {
      const counts = new Array(12).fill(0);
      orderedRenderedNotes().forEach((n) => { if (n.midi != null) counts[((n.midi % 12) + 12) % 12]++; });
      if (!counts.some((c) => c > 0)) return null;
      const k = guessKey(counts);
      return { tonicPc: k.tonicPc, mode: k.mode, label: keyLabel(k.tonicPc, k.mode) };
    },
    // Note identities [{measure,midi,beats}] matched by the most recent searchTagPatterns (flattened
    // across occurrences) — so Play-tags can include them. Reset when the tag selection / patterns change.
    getPatternMatchNotes() {
      const out = [];
      lastPatternMatches.forEach((g) => g.notes.forEach((n) => out.push({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
      return out;
    },
    // Matched occurrences as fretboard capture steps: one step per occurrence, [{name, notes:[{name,octave}]}].
    // Honors includeSuppressed like the other capture sources. Empty when no search has been run.
    getPatternMatchSequence({ includeSuppressed = false } = {}) {
      const mutedKeys = includeSuppressed ? new Set()
        : new Set(mutedList().map((n) => suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
      const onsetOf = (g) => (g.notes[0] ? (g.notes[0].onsetBeats ?? g.notes[0].measure ?? 0) : 0);
      const steps = [];
      // Every occurrence of the pattern — the tags' own notes AND the matches — in piece order.
      [...lastPatternOriginals, ...lastPatternMatches].sort((a, b) => onsetOf(a) - onsetOf(b)).forEach((g) => {
        const live = g.notes.filter((n) => !mutedKeys.has(suppressionKey({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
        const src = live.length ? live : g.notes;
        const notes = noteSetOf(src);
        const ms = src.map((n) => n.measure).filter((m) => m != null);
        const m0 = (g.notes[0] || {}).measure;
        if (notes.length) steps.push({ name: `${g.name}${m0 != null ? ` · m${m0}` : ''}`, notes, seq: seqOf(src), events: eventsOf(src),
          measures: ms.length ? [Math.min(...ms), Math.max(...ms)] : null });
      });
      return steps;
    },
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
    // Shade the current fretboard step's measures in a distinct blue band (echoing the fretboard
    // dots), independent of the vocab-range highlight. Tracks stepping; persists across re-renders.
    highlightStepMeasures(range) { stepHighlight = (range && range.length === 2) ? [range[0], range[1]] : null; applyMeasureHighlight(); },
    clearStepHighlight() { stepHighlight = null; applyMeasureHighlight(); },
    applyResponsiveZoom(viewportWidth) { setZoom(responsiveZoom(viewportWidth)); }
  };
}
