// public/music-render.js
// Rendering for the music study app: pure measure-mapping helpers (TDD) +
// a thin OSMD wrapper (injectable factory) for whole-piece / segment rendering.
import { primaryVoice, canonicalChordSpans } from './music-encoding.js';
import { guessChords, guessChordAreas, bestChords, bestChordsCompleting, verticalChords, chordDisplayName, chordOccurrenceNotes } from './music-chords.js';
import { chordByAnyName } from './music-reference-data.js';
import { indexAssignments, colorMap, toggleNote, firstTagForKey, revealedTagForKey, renameInAssignments, noteId as tagNoteId } from './music-tags.js';
import { findScopedMatches, pcHistogram, guessKey, keyLabel } from './music-pattern.js';
import { findRhythmPatterns, soloMutedIndices } from './music-rhythm.js';
import { detectKey, parseKeyName, fifthsOfKey } from './music-key.js';
import { addPhrase as addPhraseReducer, removePhrase as removePhraseReducer, setPhraseTag as setPhraseTagReducer,
  removeTagFromPhrases, renameTagInPhrases, togglePhraseNote as togglePhraseNoteReducer, phraseByName,
  phraseRange, phraseNotes, addedNotes, droppedNotes, setPhraseRange as setPhraseRangeReducer } from './music-phrase.js';
import { detectPhrases as detectPhrasesModel, phraseBands as phraseBandsModel } from './music-phrase-detect.js';
import { addGroup as addGroupReducer, removeGroup as removeGroupReducer, setGroupRanges as setGroupRangesReducer,
  addGroupRanges as addGroupRangesReducer, setGroupPattern as setGroupPatternReducer, groupByName,
  normalizeRanges as normRanges, groupPatterns, resolveGroupPattern, groupOpts, groupShades } from './music-rhythm-group.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Readable, deterministic palette for coloring voices in the rendered sheet.
const VOICE_COLORS = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#17becf'];
const DEFAULT_NOTE_COLOR = '#000000';
const CHORD_HL_COLOR = '#ffcc00';   // notes of a clicked chord chip, highlighted in yellow
// Occurrences of the picked rhythm pattern. Two shades of ONE hue: same hue reads as "one pattern",
// while alternating shades keep back-to-back occurrences from merging into a single block of color.
const RHYTHM_HL_COLORS = ['#0ca678', '#63e6be'];
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

// Reconstruct the index's chord list with measure spans, so a chord-match's index range maps
// back to measures. Uses the SAME canonicalChordSpans as buildIndexEntry, so the reconstructed
// sequence lines up with search.chords index-for-index. Because the sequence is measure-ordered
// (never a per-voice concatenation), the spans are monotonic and a match resolves to a tight
// measure range instead of blowing up across a voice boundary.
export function collapsedChordSpans(detail) {
  return canonicalChordSpans((detail && detail.voices) || []);
}

// Pure: from `notesByMeasure` (measure-number → rendered notes, each with a pitch-class `name`),
// the notes within [range] whose name is one of `tones`. Used to highlight exactly the notes that
// form a matched chord at its own measure(s) — the caller passes the chord's measure span so a
// chip only lights up its own notes, not other measures that happen to share a tone.
// `range` is in the detail's SEQUENTIAL numbering (music-encoding counts the pickup as measure 1);
// `notesByMeasure` is keyed by the RENDERED/printed number = sequential − offset. So on a pickup
// piece (offset > 0) we shift the range back, else a chip lands one measure late (the classic
// "only one note lit" bug where the neighbour measure shares a single tone).
export function chordToneNotesInMeasures(notesByMeasure, tones, range, offset = 0) {
  if (!tones || !tones.length || !range || range.length !== 2 || !notesByMeasure) return [];
  const lo = Math.min(range[0], range[1]) - offset;
  const hi = Math.max(range[0], range[1]) - offset;
  const toneSet = new Set(tones);
  const out = [];
  for (let m = lo; m <= hi; m++) {
    (notesByMeasure[m] || []).forEach((n) => { if (toneSet.has(n.name)) out.push(n); });
  }
  return out;
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

// Which drawn notes are genuinely dimmed, given each notehead's identity and whether it is grey.
//
// A cross-voice unison draws TWO noteheads for one sound. If either is lit, the note is lit — and
// reporting its grey twin would silence a highlighted note in playback, because the player matches
// identities on (midi, beats) and cannot tell the two noteheads apart. `promoteUnisonHighlights`
// lifts the grey twin at paint time; this makes the guarantee hold in the data whether or not that
// paint pass has run. De-duped, so a note greyed in both staves is reported once.
// Which whole occurrences lie inside `bars` ([[from,to],…], printed measures). A motif is a run of
// notes, so it counts only when ALL of it is inside — an occurrence that starts before the last bar of
// a phrase and finishes after it is not an occurrence "in" that phrase, and playing the part that fits
// would sound like a fragment of the tune rather than the tune.
export function groupsInsideBars(groups, bars) {
  if (!bars || !bars.length) return groups || [];
  return (groups || []).filter((g) => g && g.from != null && g.to != null
    && bars.some(([from, to]) => g.from >= from && g.to <= to));
}

// Measure numbers as a compact human range: [2,3,4,7,9,10] → "2–4, 7, 9–10". De-duped and sorted, so
// callers can hand over one entry per note. `max` caps how many groups are listed and appends "…":
// a motif can occur three dozen times, and a tooltip that long is one nobody reads.
export function formatMeasureRanges(nums, max = 12) {
  const xs = [...new Set((nums || []).filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
  if (!xs.length) return '';
  const groups = [];
  let start = xs[0], prev = xs[0];
  for (let i = 1; i <= xs.length; i++) {
    const n = xs[i];
    if (n === prev + 1) { prev = n; continue; }   // still the same run (undefined past the end ends it)
    groups.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = n; prev = n;
  }
  return groups.length > max ? `${groups.slice(0, max).join(', ')}, …` : groups.join(', ');
}

export function unlitIdentities(entries) {
  const lit = new Set();
  const key = (e) => `${e.midi}@${Number(e.beats).toFixed(6)}`;
  (entries || []).forEach((e) => { if (!e.dim) lit.add(key(e)); });
  const seen = new Set();
  const out = [];
  (entries || []).forEach((e) => {
    if (!e.dim) return;
    const k = key(e);
    if (lit.has(k) || seen.has(k)) return;
    seen.add(k);
    out.push({ measure: e.measure, midi: e.midi, beats: e.beats });
  });
  return out;
}

// Where to scroll so the play cursor stays on screen — the decision, without any DOM.
//
// Scrolling on every note would twitch, so the cursor is left alone while it sits inside a comfortable
// band and only re-parked once it leaves. It is then placed a third of the way down, which puts the
// music about to be played in the larger half of the view instead of at the bottom edge.
// All values are in the scroll container's own coordinates. Returns the new scrollTop, or null for
// "leave it alone" — including when the move would be less than a pixel.
export function followScrollTop({ cursorTop, cursorBottom, scrollTop, viewHeight, contentHeight } = {}) {
  if (!(viewHeight > 0) || cursorTop == null || cursorBottom == null) return null;
  const margin = Math.min(viewHeight * 0.2, 120);
  if (cursorTop >= scrollTop + margin && cursorBottom <= scrollTop + viewHeight - margin) return null;
  const max = contentHeight > viewHeight ? contentHeight - viewHeight : 0;
  const next = Math.max(0, Math.min(max, cursorTop - viewHeight / 3));
  return Math.abs(next - scrollTop) < 1 ? null : next;
}

// Locate a tag's stored notes in the rendered stream, keeping the tag inside ONE voice.
//
// A tag note is stored as (midi, beats) with no voice, so in a combined / two-hand score a unison —
// the same pitch at the same moment in both hands — gives one id two candidate noteheads. Taking
// whichever is drawn first used to be enough, but it isn't: the resolved notes decide which voices
// the melodic search is scoped to, and one note landing in the wrong hand pulls that whole hand in.
// The reduction then collapses each onset to its top note, so the tagged note itself gets replaced
// by whatever sits above it and the search hunts a pattern that was never tagged.
//
// Resolve by agreement instead: notes with a single candidate name the tag's voice, and ambiguous
// ones follow that vote. A tag genuinely spanning two hands is unaffected — its notes are each
// unambiguous, so they keep their own voice. No unambiguous note at all falls back to the old
// first-candidate rule, which is as good a guess as any.
const TAG_ONSET_EPS = 1e-6;
export function resolveTagIndices(noteIds, ordered) {
  const all = ordered || [];
  const candidates = (noteIds || []).map((tn) => {
    const hits = [];
    all.forEach((n, i) => {
      if (n && n.midi === tn.midi && Math.abs((n.onsetBeats == null ? NaN : n.onsetBeats) - tn.beats) < TAG_ONSET_EPS) hits.push(i);
    });
    return hits;
  }).filter((hits) => hits.length);
  const votes = new Map();
  candidates.forEach((hits) => {
    if (hits.length !== 1) return;
    const v = all[hits[0]].voice;
    votes.set(v, (votes.get(v) || 0) + 1);
  });
  let winner = null, best = 0;
  votes.forEach((n, v) => { if (n > best) { best = n; winner = v; } });
  return candidates
    .map((hits) => {
      if (winner == null) return hits[0];
      const inVoice = hits.find((i) => all[i].voice === winner);
      return inVoice == null ? hits[0] : inVoice;
    })
    .sort((p, q) => p - q);
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

// Repair a crash in the bundled VexFlow that aborts a draw pass mid-page.
//
// A pedal mark anchored to a rest gets a ghost note — a spacer with no noteheads — and VexFlow's
// PedalMarking.drawBracketed calls note.getNoteHeadBeginX() on it unconditionally. Ghost notes don't
// define it (only StaveNote does), so the call throws out of drawPedals, which drawStaffLine calls
// BEFORE drawExpressions — so the throw takes the pedal, that line's expression marks, and the
// remaining systems of that pass with it. Measured on Clair de Lune: an uncaught console error on every
// load, no pedal marks, and ~180 stray path elements left behind by the abandoned pass, still layered
// under the re-render that follows it. (Noteheads survive — they are drawn in a different pass — so the
// score looks complete, which is what makes this easy to miss.)
//
// OSMD's own code guards this exact call ("if (!t.getNoteHeadBeginX) return"); VexFlow's does not, and
// VexFlow isn't reachable from outside the bundle to patch directly.
//
// So the missing methods are supplied on the offending note itself, using VexFlow's own definitions
// (getNoteHeadBeginX = getAbsoluteX() + x_shift). For something with no notehead that is exactly the
// right anchor — where the notehead would have been — so the pedal still draws in the right place
// instead of being dropped. Zero glyph width likewise: no notehead, nothing to span.
//
// The shim is REMOVED again as soon as the pedals are drawn, and that is not tidiness — it is required.
// OSMD's own guard is load-bearing: applyBordersFromVexflow reads `if (!note.getNoteHeadBeginX) return`
// to skip exactly these notes, because a ghost note's getBoundingBox() is null and the line after the
// guard dereferences it. Leaving the method attached defeats that guard and moves the crash from drawing
// into the NEXT render's layout, where it kills the score outright rather than truncating it. Layout and
// draw are separate phases of a render, so a shim scoped to the draw call is invisible to layout.
//
// The try/finally also backstops: should a pedal fail for some other reason, it costs the pedals of one
// staff line rather than the remainder of the score.
export function patchPedalGhostNoteCrash(ns = (typeof opensheetmusicdisplay !== 'undefined' ? opensheetmusicdisplay : null)) {
  const proto = ns && ns.VexFlowMusicSheetDrawer && ns.VexFlowMusicSheetDrawer.prototype;
  if (!proto || !proto.drawPedals || proto.drawPedals._ghostNotePatched) return false;
  const original = proto.drawPedals;
  const patched = function drawPedals(staffLine, ...rest) {
    const shimmed = [];
    try {
      ((staffLine && staffLine.Pedals) || []).forEach((pedal) => {
        const marking = pedal && pedal.getPedalMarking && pedal.getPedalMarking();
        ((marking && marking.notes) || []).forEach((note) => {
          if (!note || typeof note.getAbsoluteX !== 'function') return;
          if (typeof note.getNoteHeadBeginX === 'function') return;
          note.getNoteHeadBeginX = () => note.getAbsoluteX() + (note.x_shift || 0);
          note.getNoteHeadEndX = () => note.getNoteHeadBeginX()
            + (typeof note.getGlyphWidth === 'function' ? note.getGlyphWidth() : 0);
          shimmed.push(note);
        });
      });
    } catch (_) { /* best-effort; the finally still restores and the catch still protects the page */ }
    try {
      return original.call(this, staffLine, ...rest);
    } catch (_) {
      return undefined;   // lose this staff line's pedals, never the rest of the score
    } finally {
      shimmed.forEach((note) => { delete note.getNoteHeadBeginX; delete note.getNoteHeadEndX; });
    }
  };
  patched._ghostNotePatched = true;
  proto.drawPedals = patched;
  return true;
}

// Drop `<tuplet>` brackets from notes that carry no `<time-modification>`, and hand OSMD the result.
//
// A `<tuplet>` is only the BRACKET; the ratio lives in `<time-modification>`. A note with the bracket
// and no ratio is malformed — it says "part of a tuplet" while its duration says otherwise — and it
// FREEZES OSMD 1.8+ inside load(), synchronously, so the tab is gone with no error to catch. Two
// MuseScore exports in this library do it (a 3-sixteenth group bracketed but never scaled); both open
// instantly once the stray bracket is gone.
//
// Nothing audible or positional changes: no pitch, duration, voice or measure is touched, only a
// notation bracket that describes a tuplet the notes aren't in. Applied to what OSMD reads, so the
// stored source — the thing playback and the schedule parse — stays exactly as the exporter wrote it.
// Skips the parse entirely when the file has no tuplet markup at all.
export function stripBracketOnlyTuplets(xml) {
  const src = String(xml == null ? '' : xml);
  if (src.indexOf('<tuplet') < 0) return src;
  let doc;
  try { doc = new DOMParser().parseFromString(src, 'application/xml'); } catch (_) { return src; }
  if (!doc || doc.getElementsByTagName('parsererror').length) return src;
  let dropped = 0;
  doc.querySelectorAll('note').forEach((n) => {
    if (n.querySelector('time-modification')) return;
    n.querySelectorAll('tuplet').forEach((t) => { t.remove(); dropped++; });
  });
  if (!dropped) return src;
  try { return new XMLSerializer().serializeToString(doc); } catch (_) { return src; }
}

// Force each of `bars` (PRINTED measure numbers) to begin a new staff line, and take away every break
// the score itself carries so those are the only ones. Returns the XML to hand OSMD.
//
// This is what makes one phrase per line possible: a phrase and each of its returns start their own
// system, so bar 3 of the first statement sits above bar 3 of the return and the two can be read against
// each other. OSMD only obeys these once rules.NewSystemAtXMLNewSystemAttribute is on, which is off by
// default — so an untouched score's own breaks are ignored today, and turning the rule on without this
// stripping pass would suddenly activate all of them (measured: 4 in one library file, which put lines
// in places nobody asked for).
//
// A forced break is a FLOOR, not a ceiling: it guarantees a line starts there, and OSMD still breaks
// wherever a stretch would overflow the page. Making the phrase itself fit is FixedMeasureWidth's job.
//
// An empty / falsy `bars` strips the score's breaks and adds none. That is NOT how the aligned view is
// switched off — restoring the engraved layout means re-loading the stored source untouched, because a
// stripped copy measurably lays out differently even with the rule off (see setPhraseAlign).
export function setSystemBreaks(xml, bars) {
  const src = String(xml == null ? '' : xml);
  if (!src) return src;
  let doc;
  try { doc = new DOMParser().parseFromString(src, 'application/xml'); } catch (_) { return src; }
  if (!doc || doc.getElementsByTagName('parsererror').length) return src;
  const want = new Set((bars || []).map((b) => String(b)));
  let changed = 0;
  doc.querySelectorAll('print').forEach((p) => {
    if (p.hasAttribute('new-system')) { p.removeAttribute('new-system'); changed++; }
    if (p.hasAttribute('new-page')) { p.removeAttribute('new-page'); changed++; }
  });
  doc.querySelectorAll('measure').forEach((m) => {
    if (!want.has(m.getAttribute('number'))) return;
    let p = m.querySelector('print');
    // `<print>` must be the measure's first element to be a layout instruction for it, and a measure
    // that has none gets one. Reusing an existing one keeps whatever else it says (staff distances,
    // measure numbering) instead of quietly dropping it.
    if (!p) {
      p = doc.createElement('print');
      m.insertBefore(p, m.firstChild);
    }
    p.setAttribute('new-system', 'yes');
    changed++;
  });
  if (!changed) return src;
  try { return new XMLSerializer().serializeToString(doc); } catch (_) { return src; }
}

// "4-8", "m4–8", "4 8", "4,8" → [4, 8]; a single number is that bar alone. Null when it says nothing
// usable. Typed by hand into a comparison box, so every separator anyone would reasonably reach for is
// accepted rather than one blessed spelling.
export function parseBarRange(text) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return null;
  // A phrase is named with letters — A, B2, B′, "Chorus" — and a bar range is not. So anything carrying a
  // letter beyond the "m" people write in front of a bar number is NOT a range, and the caller should try
  // it as a name instead. Without this test "B2" parsed as bar 2, which silently drew the wrong music.
  if (/[a-zA-Z]/.test(raw.replace(/[mM]/g, ''))) return null;
  const s = raw.replace(/[mM]/g, ' ').trim();
  if (!s) return null;
  const nums = s.split(/[^0-9]+/).filter((p) => p !== '').map((p) => parseInt(p, 10)).filter(Number.isFinite);
  if (!nums.length) return null;
  const a = nums[0], b = nums.length > 1 ? nums[1] : nums[0];
  return [Math.min(a, b), Math.max(a, b)];
}

// ── Paint helpers shared by every OSMD instance ────────────────────────────────────────────────────
// The sheet and the compare panes are SEPARATE OSMD instances drawing the same piece. Anything the
// sheet paints onto its notes has to be paintable onto theirs the same way, or the comparison reads
// differently from the score it was cut out of — so these live at module level rather than inside the
// renderer's closure.

// Onset of a graphical staff entry in quarter-note beats from the piece start, read from OSMD's
// source timestamps (RealValue is in whole notes → ×4 for quarter beats). null when unavailable,
// in which case window playback falls back from note-accurate to measure-granular.
export function staffEntryOnsetBeats(se) {
  try { if (se && se.getAbsoluteTimestamp) { const t = se.getAbsoluteTimestamp(); if (t && typeof t.RealValue === 'number') return t.RealValue * 4; } } catch (_) {}
  try {
    const sse = se && (se.sourceStaffEntry || se.parentStaffEntry);
    const t = sse && (sse.AbsoluteTimestamp || (sse.getAbsoluteTimestamp && sse.getAbsoluteTimestamp()));
    if (t && typeof t.RealValue === 'number') return t.RealValue * 4;
  } catch (_) {}
  return null;
}

// Every DRAWN note of an OSMD instance as { measure, midi, beats, el, headIndex } — `el` is the
// VexFlow group carrying the noteheads and `headIndex` picks this note's head out of a chord's group.
// (measure, midi, beats) is the same identity motifs and phrases are stored under, so a note found
// here can be looked up against them.
//
// osmd.graphic.measureList holds EVERY measure of the piece whatever window is drawn; the measures
// outside it have detached elements, which the isConnected test drops. What is in the document is
// what was drawn.
export function drawnNotesOf(osmd) {
  const out = [];
  const measureList = osmd && osmd.graphic && osmd.graphic.measureList;
  if (!measureList || !measureList.forEach) return out;
  measureList.forEach((measures) => {
    (measures || []).forEach((measure) => {
      if (!measure) return;   // OSMD hands back holes — an empty staff slot carries no notes
      const sm = measure.parentSourceMeasure;
      const num = sm && Number.isFinite(sm.MeasureNumber) ? sm.MeasureNumber : null;
      ((measure.staffEntries) || []).forEach((se) => {
        const beats = staffEntryOnsetBeats(se);
        (se.graphicalVoiceEntries || []).forEach((gve) => {
          (gve.notes || []).forEach((gnote) => {
            const pitch = gnote.sourceNote && gnote.sourceNote.Pitch;
            const midi = (pitch && typeof pitch.getHalfTone === 'function') ? pitch.getHalfTone() + 12 : null;
            const vf = gnote.vfnote;
            const el = vf && vf[0] && vf[0].attrs && vf[0].attrs.el;
            if (!el || !el.isConnected) return;
            // The model's own colour — what this note wears with nothing painted over it. Kept so a
            // note can be put BACK to it when a highlight is taken away.
            const base = (gnote.sourceNote && gnote.sourceNote.NoteheadColor) || null;
            out.push({ measure: num, midi, beats, el, base, headIndex: gnote.vfnoteIndex || 0 });
          });
        });
      });
    });
  });
  return out;
}

// Push per-voice NoteheadColor onto the OSMD model, so the colour survives re-renders. `indexSink`,
// when given, is filled with voice object → its global voice index (the same index voiceColor uses),
// letting a rendered note be traced back to a stable voice id. No-op on a sheet without instruments
// (the test fake, or before load).
export function paintVoiceColors(osmd, on, indexSink) {
  const instruments = osmd && osmd.Sheet && osmd.Sheet.Instruments;
  if (!instruments || !instruments.forEach) return;
  if (indexSink) indexSink.clear();
  let vi = 0;
  instruments.forEach((instr) => {
    (instr.Voices || []).forEach((voice) => {
      if (indexSink) indexSink.set(voice, vi);
      const color = on ? voiceColor(vi) : DEFAULT_NOTE_COLOR;
      (voice.VoiceEntries || []).forEach((ve) => {
        (ve.Notes || []).forEach((note) => { note.NoteheadColor = color; });
      });
      vi++;
    });
  });
}

// Overlay English/scientific note names on an instance's rendered SVG. Removed + rebuilt on every
// render. No-op when there's no DOM container / rendered graphic (test fakes, jsdom).
export function paintNoteNames(osmd, container, on = true) {
  if (!container || !container.querySelectorAll) return;
  if (!on) { container.querySelectorAll('.note-name-layer').forEach((n) => n.remove()); return; }
  const svg = container.querySelector('svg');
  if (!svg) return;
  const notes = drawnNotesOf(osmd);
  // Build-then-swap: a getBBox that throws/returns garbage mid-transition won't blank the labels.
  swapOverlayLayer(svg, 'note-name-layer', (layer) => {
    notes.forEach((n) => {
      const label = noteName(n.midi);
      if (!label) return;   // rest / no pitch
      const heads = n.el.querySelectorAll ? n.el.querySelectorAll('.vf-notehead') : [];
      const head = heads[n.headIndex] || heads[0];
      if (!head || !head.getBBox) return;
      let b; try { b = head.getBBox(); } catch (_) { return; }   // skip a note whose box isn't measurable yet
      // HTML label (foreignObject), not SVG <text>: on Android/Blink SVG-text glyphs collapse
      // after OSMD's music font loads. Centred above the notehead. The white halo (so a staff
      // line can't strike through the glyph) is a CSS text-shadow instead of paint-order stroke.
      layer.appendChild(svgHtmlLabel(document, {
        x: b.x + b.width / 2, y: b.y - 2, fontSize: 7, anchor: 'middle',
        css: 'color:#444;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 2px #fff;',
        text: label,
      }));
    });
  });
}

// Paint `color` over a rendered note's whole group (notehead, and any shape drawn with it), matching
// how the sheet's own overlay inks a note so a compare pane and the sheet look identical.
export function paintNoteElement(el, color) {
  if (!el || !el.querySelectorAll) return;
  [el, ...el.querySelectorAll('path, ellipse, circle, rect')].forEach((h) => {
    h.setAttribute('fill', color); h.style.fill = color;
    const st = h.getAttribute('stroke');
    if (st && st !== 'none') { h.setAttribute('stroke', color); h.style.stroke = color; }
  });
}

// Draw several stretches of ONE piece stacked in `host`, each on its own staff line, with the same bar
// width in all of them — so bar 1 of m4–8 sits directly above bar 1 of m9–12 and the two can be read
// against each other. Returns { zoom, panes:[{ range, label, bars, xs, lines }] }.
//
// One OSMD per pane rather than one score cut and pasted together: OSMD draws a CONTIGUOUS window
// (drawFromMeasureNumber…drawUpToMeasureNumber), so two disjoint stretches cannot be one render without
// rewriting the file, and each pane being its own score is what gives both of them an identical leading
// clef/key/time — the thing that would otherwise offset one pane from the other.
//
// Alignment rests on a quiet OSMD default: StretchLastSystemLine is false, so the LAST system of a score
// keeps its measures' own widths instead of being spread to fill the page. Every pane here is a single
// system, hence every pane is a last system — which is why ranges of DIFFERENT lengths still share their
// leading columns. Ranges are printed bar numbers; `offset` converts them to the sequential ones OSMD
// wants (the pickup shift), exactly as showSegment does.
// The panes carry the sheet's own colours and note names (opts.voiceColors / opts.colorOf /
// opts.noteNames): this view exists to be read closely, and a stretch that loses the motif colouring
// it has on the sheet is harder to read here than it was there.
export async function renderAlignedSegments(host, xml, ranges, opts = {}) {
  const { zoom = 1, offset = 0, minZoom = 0.3, factory,
    voiceColors = false, colorOf = null, noteNames = false, onPlay = null } = opts;
  const make = factory || ((c) => new opensheetmusicdisplay.OpenSheetMusicDisplay(c));
  const wanted = (ranges || []).filter((r) => Array.isArray(r) && r.length === 2);
  host.innerHTML = '';
  if (!wanted.length) return { zoom, panes: [] };
  const built = wanted.map((range) => {
    const pane = document.createElement('div');
    pane.className = 'cmp-pane';
    const tag = document.createElement('div');
    tag.className = 'cmp-tag';
    const label = `m${range[0]}–${range[1]}`;
    tag.textContent = label;
    // ▶ on the pane itself: the stretch you are looking at is the one you want to hear, and reaching
    // for the transport means first telling it which bars — which is what this pane already says.
    if (onPlay) {
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'cmp-play';
      play.textContent = '▶';
      play.title = `Play bars ${range[0]}–${range[1]}`;
      play.onclick = () => onPlay([range[0], range[1]]);
      tag.append(' ', play);
    }
    const sheet = document.createElement('div');
    sheet.className = 'cmp-sheet';
    pane.append(tag, sheet);
    host.append(pane);
    return { range, label, sheet, osmd: make(sheet) };
  });
  // PADDING. FixedMeasureWidth makes every bar of a pane the same width, but the pane still has to fit
  // the page — so eight bars compress to ~145px each while two sit at ~225px, and the columns of a short
  // stretch and a long one stop meaning anything (measured: m2–3 vs m20–27 shared 1 column of 2, while
  // the evenly matched m4–8 vs m9–12 shared all 4).
  //
  // So every pane DRAWS the same number of bars — the shorter ones padded with the bars that follow them
  // — and the surplus is then clipped away. Both panes are laid out under identical pressure, so a bar is
  // the same width in each; what you see is only the stretch you asked for. Padding with real following
  // bars rather than blank ones because an empty measure has to be invented (key, time, clef, rests) and
  // an invented bar is a bar that can be wrong; these are clipped before they are ever seen.
  const span = (r) => r[1] - r[0] + 1;
  const padTo = Math.max(...wanted.map(span));
  for (const b of built) {
    b.osmd.setOptions({ backend: 'svg', drawingParameters: 'compacttight', drawTitle: false,
      useXMLMeasureNumbers: true, autoResize: false });
    if (b.osmd.rules) b.osmd.rules.FixedMeasureWidth = true;
    await b.osmd.load(xml);
    paintVoiceColors(b.osmd, voiceColors);   // on the MODEL, so the shrink loop's re-renders keep it
    const total = (b.osmd.Sheet && b.osmd.Sheet.SourceMeasures && b.osmd.Sheet.SourceMeasures.length) || 0;
    b.real = span(b.range);
    // Clamped at the end of the piece: a stretch in the last bars cannot be padded to full width, and
    // then its columns are its own. Reported per pane as `padded`, so the caller can say so.
    const to = Math.min(b.range[0] + padTo - 1, total ? total - offset : b.range[1]);
    b.drawn = to - b.range[0] + 1;
    b.padded = b.drawn - b.real;
    b.osmd.setOptions({ drawFromMeasureNumber: b.range[0] + offset, drawUpToMeasureNumber: to + offset });
  }
  // Shrink until every pane is ONE line: a stretch split over two lines has nothing to compare against
  // the other pane's second line, and the columns stop meaning anything.
  let z = zoom;
  const draw = () => built.forEach((b) => { b.osmd.Zoom = z; b.osmd.render(); });
  // Measured off the DRAWN SVG, not the graphic model. The model holds every measure of the piece and
  // only a window of it is drawn, so counting rows there reported all 35 bars of the score for a 4-bar
  // pane, decided it had wrapped, and drove the shrink loop to its floor — a 4-bar comparison rendered
  // at 38%. What is on screen is the only thing that answers "did this fit on one line".
  const linesOf = (b) => b.sheet.querySelectorAll('.staffline').length || 1;
  const columnsOf = (b) => {
    const base = b.sheet.getBoundingClientRect().left;
    const xs = [...b.sheet.querySelectorAll('.vf-measure')]
      .map((m) => Math.round(m.getBoundingClientRect().left - base));
    return [...new Set(xs)].sort((p, q) => p - q);
  };
  draw();
  for (let i = 0; i < 6 && built.some((b) => linesOf(b) > 1) && z > minZoom; i++) {
    z = Math.max(minZoom, z * 0.85);
    draw();
  }
  // Colours and names go on AFTER the last render — a re-render inside the shrink loop repaints the
  // noteheads and rebuilds the SVG, so anything inked before it would be thrown away. Neither pass
  // moves anything: the colour is a fill on notes already placed, the names are an overlay layer.
  // Every note is inked on every pass, not just the ones a colour is found for: a motif being UNchecked
  // has to take its colour off again, and a note left as it was painted last time would keep a highlight
  // that the sheet no longer shows. `base` is the note's own (voice) colour, so that is where it goes back to.
  const ink = (fn) => built.forEach((b) => {
    drawnNotesOf(b.osmd).forEach((n) => {
      if (n.midi == null) return;
      const paint = (fn && fn({ measure: n.measure, midi: n.midi, beats: n.beats })) || n.base || DEFAULT_NOTE_COLOR;
      paintNoteElement(n.el, paint);
    });
  });
  if (colorOf) ink(colorOf);
  if (noteNames) built.forEach((b) => paintNoteNames(b.osmd, b.sheet, true));
  // Clip each pane after its own last real bar, so the padding that made the widths match is not shown.
  // The frames stay equal width, so a shorter stretch reads as shorter rather than as cut off.
  const panes = built.map((b) => {
    const all = columnsOf(b);
    const xs = all.slice(0, b.real);
    const cut = all[b.real];                     // where the first padding bar starts
    b.sheet.style.width = cut != null ? `${cut}px` : '';
    b.sheet.style.minWidth = '';
    // A playhead per pane, so a comparison can be FOLLOWED while it sounds. A plain line rather than the
    // pane's own OSMD cursor: OSMD throws when asked to update a cursor sitting outside the drawn
    // window, and every pane draws a window. The marks are the drawn notes' (beat, x) — the same
    // absolute beats the transport counts in, so any pane can be asked where a given beat is.
    const base = b.sheet.getBoundingClientRect().left;
    const byBeat = new Map();
    drawnNotesOf(b.osmd).forEach((n) => {
      if (n.beats == null) return;
      const x = Math.round(n.el.getBoundingClientRect().left - base);
      if (cut != null && x >= cut) return;   // a padding bar: clipped away, so not this pane's music
      byBeat.set(n.beats, Math.min(byBeat.has(n.beats) ? byBeat.get(n.beats) : Infinity, x));
    });
    b.marks = [...byBeat.entries()].map(([beat, x]) => ({ beat, x })).sort((p, q) => p.beat - q.beat);
    b.head = document.createElement('div');
    b.head.className = 'cmp-head';
    b.head.style.display = 'none';
    b.sheet.appendChild(b.head);
    return { range: b.range, label: b.label, lines: linesOf(b), count: xs.length,
      padded: b.padded, xs };
  });
  // Move every pane's playhead to `beat` (absolute quarter-beats, as the transport counts them). A pane
  // whose stretch doesn't contain that beat hides its own — so while one is sounding the other is
  // plainly not, which is the whole point of hearing them one after the other.
  const showCursorAtBeat = (beat) => {
    built.forEach((b) => {
      const m = b.marks;
      if (beat == null || !m.length || beat < m[0].beat - 1e-6 || beat > m[m.length - 1].beat + 1e-6) {
        b.head.style.display = 'none';
        return;
      }
      let at = 0;
      for (let i = 0; i < m.length && m[i].beat <= beat + 1e-6; i++) at = i;
      b.head.style.left = `${m[at].x - 2}px`;
      b.head.style.display = '';
    });
  };
  const hideCursor = () => built.forEach((b) => { b.head.style.display = 'none'; });
  // Re-ink the panes that are already drawn. What the Motifs panel does to the sheet — check a motif,
  // Find its pattern, dim the rest — has to show up here too, and re-drawing the panes for a colour
  // change would throw away the alignment that was measured to build them.
  const recolor = (fn) => ink(fn);
  return { zoom: z, panes, showCursorAtBeat, hideCursor, recolor };
}

// Thin OSMD wrapper. opts.osmdFactory(container) lets tests inject a spy; in the browser
// it defaults to the global OpenSheetMusicDisplay. Visual output is browser-verified;
// this wrapper's method/argument contract is unit-tested via an injected fake.
export function createMusicRenderer(container, opts = {}) {
  patchPedalGhostNoteCrash();   // before the first render — see patchPedalGhostNoteCrash
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
  // Where the reader put the score, kept across renders. Drawing a different window changes the sheet's
  // HEIGHT, so the box it scrolls in clamps to the shorter content and the place you were reading is
  // gone — on a phone, where the preview is a fixed scrolling panel and a script redraws on nearly
  // every step, that reads as being thrown back to the top over and over. So remember where the reader
  // left it and put it back after each render; when the height comes back, so does the position.
  //
  // A clamp fires a scroll event of its own, and taking that for a choice would overwrite the very
  // position being rescued — hence settleUntil: scrolls landing just after a render are the browser's,
  // not the reader's.
  let scrollBox = null;        // the element that actually scrolls the score (the mobile preview panel)
  let wantScrollTop = null;
  let settleUntil = 0;
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('scroll', (e) => {
      if (Date.now() < settleUntil) return;
      const t = e.target;
      const el = (t === document || t === document.documentElement) ? document.scrollingElement : t;
      if (!el || !el.contains || !container || !el.contains(container)) return;   // not a box the score sits in
      scrollBox = el;
      wantScrollTop = el.scrollTop;
    }, true);
  }
  function restoreScroll() {
    if (!scrollBox || wantScrollTop == null) return;
    // Clamped by the browser when the sheet is currently shorter than where we were; wantScrollTop is
    // kept as asked, so the next render that restores the height also restores the place.
    try { if (Math.abs(scrollBox.scrollTop - wantScrollTop) >= 1) scrollBox.scrollTop = wantScrollTop; } catch (_) {}
  }
  const _osmdRender = osmd.render.bind(osmd);
  let _inRender = false;
  osmd.render = (...a) => {
    clampCursorToDrawnRange();   // never let OSMD update a cursor that sits outside the drawn window (it throws)
    settleUntil = Date.now() + 400;
    const out = _osmdRender(...a);
    if (!_inRender) { _inRender = true; try { postRender(); } finally { _inRender = false; } }
    restoreScroll();
    // Again once layout has settled: the SVG's final height can land after this call returns, and a
    // restore against the old height is a restore to the wrong place.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restoreScroll);
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
  const onSeek = opts.onSeek;   // fired when the click-to-play-from start note changes (set or cleared)
  let totalMeasures = 0;
  let measureOffset = 0;     // sequential MeasureNumber − printed number (the pickup/anacrusis shift)
  let sourceXml = '';        // the piece's MusicXML as stored, so the layout can be rebuilt from it
  let alignBars = null;      // printed bars forced to start a line, or null for the score as engraved
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
  let phraseBandList = [];       // [{from,to,fill,opacity}] — the bars of a detected phrase's every
                                 // occurrence, shaded in the family's colour. Many ranges at once
                                 // (unlike the two single-range bands above), each with its own tint so
                                 // a modified return reads lighter than the phrase's first statement.
  let extraNoteMarks = null;     // { marks:[{measure,midi}], color } — added-note (variation) highlight,
                                 // re-applied after EVERY render so OSMD's deferred/font-load re-render
                                 // (which rebuilds the SVG) can't wipe it. Cleared on loadDetail.
  let shownFrom = 1;             // 1-based first measure of the currently drawn window
  let shownTo = Number.MAX_SAFE_INTEGER;   // ...and the last (chords/highlight clip to this)
  let playStart = null;          // {measure, midi, beats} of a click-selected start note; playback begins
                                 // here (until the view changes or another note is clicked). See getPlayStartRange.
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
  let dimAll = false;                // authoring aid: dim the whole sheet, keeping only the active/checked
                                     // tags (and any Find-pattern matches) lit — like tagFilter but forced
                                     // on even with nothing checked, so notes stand out while tagging.
  let plainView = false;             // "Original view": suppress ALL motif/phrase overlays (even the base
                                     // tag tint) so the sheet reads as the untouched piece. Data (tags /
                                     // phrases) is untouched; cleared the moment any highlight is activated.
  // On while a rhythm is highlighted (a picked pattern or a selected group): the sheet greys out and
  // only the rhythm's own colours show, so voice / motif / phrase colours can't be mistaken for it.
  let rhythmFocus = false;
  let filterTags = new Set();        // tag names the filter shows
  const onPatternsChange = opts.onPatternsChange;   // fired after the user edits per-piece assignments
  // Phrases: per-piece [{ name, color, from, to, drop:[…], add:[…] }] — a named stretch of bars plus
  // the exceptions to it: notes inside those bars that are not part of the phrase, and notes outside
  // them that are (see music-phrase.js). Used for highlighting/playing together, find, and fretboard
  // capture. Persisted as detail.phrases.
  let phrases = [];
  let phrasePaintMode = false;       // when on, notehead clicks correct the active phrase's contents
  let activePhrase = null;           // the phrase that paint-mode clicks edit
  let phraseFilter = false;          // when on (phrase panel open), dim notes not in a shown phrase
  let shownPhrases = new Set();       // phrase names whose notes are revealed + tinted on the sheet
  const onPhrasesChange = opts.onPhrasesChange;     // fired after the user edits phrases
  // Rhythm groups: per-piece [{ name, color, ranges:[[fromMeasure,toMeasure],…] }] — BARS the user
  // judged to share a rhythmic character (see music-rhythm-group.js), highlightable and playable on
  // their own. Persisted as detail.rhythmGroups.
  let rhythmGroups = [];
  const onRhythmGroupsChange = opts.onRhythmGroupsChange;   // fired after the user edits groups
  // A detached copy of the per-piece assignments, safe to persist / hand to the UI.
  function getAssignments() {
    return assignments.map((a) => ({ name: a.name, notes: (a.notes || []).map((n) => ({ ...n })) }));
  }
  // A detached copy of the phrases, safe to persist / hand to the UI.
  function getPhrases() {
    // `from`/`to` are reported filled in even for a phrase saved under the old model, so every reader
    // sees one shape — the stored record is left as it is until the range is actually edited.
    return phrases.map((p) => {
      const r = phraseRange(p);
      return { name: p.name, color: p.color, from: r ? r[0] : null, to: r ? r[1] : null,
        tags: [...(p.tags || [])],
        add: addedNotes(p).map((n) => ({ ...n })), drop: droppedNotes(p).map((n) => ({ ...n })) };
    });
  }
  function firePhrasesChange() { if (onPhrasesChange) { try { onPhrasesChange(getPhrases()); } catch (_) {} } }
  // A detached copy of the rhythm groups, safe to persist / hand to the UI.
  // A detached copy of one group, safe to persist / hand to the UI. `pattern` carries the settings it
  // was bound under (unit / proportional) — see music-rhythm-group.js.
  function copyGroup(g) {
    const out = { name: g.name, color: g.color, ranges: normRanges(g.ranges), pattern: g.pattern || null };
    if (out.pattern) { out.unit = g.unit || 'bar'; out.proportional = !!g.proportional; }
    return out;
  }
  function getRhythmGroups() { return rhythmGroups.map(copyGroup); }
  function fireRhythmGroupsChange() { if (onRhythmGroupsChange) { try { onRhythmGroupsChange(getRhythmGroups()); } catch (_) {} } }

  // OSMD Voice object → its global color index (the same index voiceColor() uses), rebuilt every
  // render by applyVoiceColors so rendered notes can be tagged with a stable voice id.
  const voiceIndexByRef = new Map();

  function applyVoiceColors() { paintVoiceColors(osmd, colorVoices, voiceIndexByRef); }

  function applyNoteNames() { paintNoteNames(osmd, container, noteNames); }

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
        // An EMPTY staff slot. OSMD hands back a measureList with holes in it — a trailing row whose
        // staves are all undefined, and (on some scores) a staff that carries nothing in one measure.
        // Reading through one threw before a note was collected, so the whole piece failed to open
        // with "Cannot read properties of undefined". A hole holds no notes, so skipping loses nothing.
        if (!measure) return;
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
              // A rest is a StaveNote as well: VexFlow gives it a real .vf-notehead element and a
              // PLACEHOLDER key — b/4, d/5, or wherever it was nudged to clear another voice. It has no
              // Pitch, so the vexKey fallback below read that placeholder and invented a pitch for it.
              // Every consumer of this stream then saw phantom notes: 21 of them in the Marmotte, mostly
              // B4/D5. They padded the motif search's gap structure, could out-rank a real melody note in
              // the top-note-per-onset rule, skewed the key histogram, and — since no sound exists at
              // those identities — silently swallowed a 🔇 click on any rest.
              if (sourceNote && (typeof sourceNote.isRest === 'function' ? sourceNote.isRest() : sourceNote.isRestFlag)) return;
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
              // A grace note's notehead sits ON its principal's onset — that is its identity, and the
              // schedule matches it there too. Flagged so the pattern search can give it a slot of its
              // own just BEFORE the beat; sharing the onset, it always lost to the principal and no
              // motif could contain or match an ornament.
              const grace = !!(sourceNote && (sourceNote.IsGraceNote || sourceNote.isGraceNote));
              // `measure`/`idx` are the note's stable musical key (absolute measure + position
              // within it), used to re-anchor the draggable chord window across re-renders.
              const arr = (byMeasure[num] = byMeasure[num] || []);
              arr.push({ name, left: b.x, el, measure: num, idx: arr.length, onsetBeats, midi, durBeats, voice, system, grace });
            });
          });
        });
      });
    });
    // systemIndexOf advances its cache for EVERY measure in measureList, including undrawn ones whose
    // notes were dropped above — so on a clipped segment the kept notes carry OFFSET system indices
    // (e.g. 6..12 when measures 1..24 occupy systems 0..5). notesBySystem/staffBoxes treat system as a
    // dense 0-based band index, so those gaps dumped whole lines into band 0 (chord labels for lower
    // lines piled onto the first line). Remap to a dense 0-based range over the systems actually kept.
    const present = [...new Set(
      Object.keys(byMeasure).flatMap((m) => byMeasure[m].map((n) => n.system)).filter((s) => s != null),
    )].sort((a, b) => a - b);
    if (present.length && (present[0] !== 0 || present[present.length - 1] !== present.length - 1)) {
      const remap = new Map(present.map((s, i) => [s, i]));
      Object.keys(byMeasure).forEach((m) => byMeasure[m].forEach((n) => {
        if (n.system != null && remap.has(n.system)) n.system = remap.get(n.system);
      }));
    }
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

  // Re-ink the variation's ADDED notes (matched by measure+MIDI against the freshly rendered
  // noteheads) in extraNoteMarks.color. Called from postRender after every render, so OSMD's
  // deferred/font-load re-render — which rebuilds the SVG and drops direct notehead paint — can't
  // leave the added notes uncolored. No-op (returns 0) when no marks are set.
  // Marks carry (measure, midi, onsetBeats-from-the-barline). Measure+midi alone is not an identity:
  // a bar that already holds a written C5 would have it inked as "added" alongside the variation's new
  // C5. So when a bar has several noteheads of the mark's pitch, take the one whose position in the bar
  // is nearest the mark's, and let each notehead be claimed once. A single candidate is used as-is,
  // which is also the path taken by marks recorded before onsetBeats existed.
  function applyExtraNoteHighlight() {
    if (!extraNoteMarks || !extraNoteMarks.marks || !extraNoteMarks.marks.length) return 0;
    const byM = renderedNotesByMeasure();
    const els = [];
    const claimed = new Set();
    extraNoteMarks.marks.forEach((m) => {
      const cands = (byM[m.measure] || []).filter((n) => n.midi === m.midi);
      if (!cands.length) return;
      if (cands.length === 1 || m.onsetBeats == null) { els.push(cands[0]); return; }
      const barStart = measureStartBeat(m.measure);
      let best = null, bestGap = Infinity;
      cands.forEach((n) => {
        if (claimed.has(n)) return;
        const gap = Math.abs((n.onsetBeats - barStart) - m.onsetBeats);
        if (gap < bestGap) { bestGap = gap; best = n; }
      });
      if (!best) return;
      claimed.add(best);
      els.push(best);
    });
    highlightNotes(els, extraNoteMarks.color);
    return els.length;
  }

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

  // Chord labels are resolved PER MEASURE (not per sliding-window "area"), so a label can't drift
  // across the barline the way the window scan let it. Within a measure there are two cases:
  //   • Chords are PRINTED (notes stacked on a beat) → one label per such beat, anchored at that beat,
  //     naming exactly what sounds there. A bar that goes C then G shows both.
  //   • Nothing is stacked (a single melodic line) → one guessed label for the measure, and a chord
  //     whose completing tone sits just over a barline is allowed: bestChordsCompleting may pull in
  //     NON-STACK neighbours within ±LOOK_BEATS to finish a same-bass chord (conservative — see it).
  // Shape matches the old areas — [{ x, top, chords }] — so the placement/de-crowding code is unchanged.
  const LOOK_BEATS = 1.5;   // how far across a barline a completing tone may sit
  function measureChordAreas(notes) {
    // A note is "stacked" if another note in this system shares its BEAT — those carry the measure's
    // own harmony and are never borrowed across the barline (only melodic singletons are). Keyed by
    // beat, not x: VexFlow offsets a notehead in a cluster/cross-staff chord, so x split real stacks.
    const beatCount = new Map();
    notes.forEach((n) => { const k = n.onsetBeats != null ? n.onsetBeats : n.left; beatCount.set(k, (beatCount.get(k) || 0) + 1); });
    const singletons = notes.filter((n) => (beatCount.get(n.onsetBeats != null ? n.onsetBeats : n.left) || 0) < 2 && n.onsetBeats != null);
    const byMeasure = new Map();
    notes.forEach((n) => { const arr = byMeasure.get(n.measure) || []; arr.push(n); byMeasure.set(n.measure, arr); });
    const out = [];
    [...byMeasure.keys()].sort((a, b) => a - b).forEach((m) => {
      const mn = byMeasure.get(m);
      if (mn.length < 2) return;
      // Printed chords first: every beat whose stack spells a chord gets its OWN label, anchored at
      // that beat (a bar reading C then G shows both, where each sounds — chord-chart convention).
      const stacked = verticalChords(mn);
      if (stacked.length) {
        stacked.forEach((c) => out.push({
          x: c.x != null ? c.x : Math.min(...mn.map((n) => n.left)), top: 0, measure: m,
          chords: [{ name: c.name, notes: c.notes, chordTones: c.chordTones }],
        }));
        return;
      }
      // Nothing sounds together in this bar → guess from the melody, allowing a completing tone just
      // across the barline (see bestChordsCompleting).
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

  // Box of one measure in the coordinates OSMD renders into, unioning its staves (a grand staff spans
  // several) — read off the VexFlow stave geometry, per getMeasurePosition in the original analysis
  // code, so it is robust across line breaks and partial/segment renders. Null when unmeasurable.
  const SHADE_PAD_Y = 8;
  function measureUnionBox(measures) {
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
    return ok ? { x1, y1, x2, y2 } : null;
  }

  // Boxes of the measures in [from,to], measure-number order. Shared by both shading styles below.
  function measureBoxesInRange(measureList, from, to) {
    const out = [];
    measureList.forEach((measures, a) => {
      const abs = absoluteMeasureNumber(measures, a, measureList.length);
      if (abs < from || abs > to) return;
      const b = measureUnionBox(measures);
      if (b) out.push({ abs, ...b });
    });
    return out.sort((p, q) => p.abs - q.abs);
  }

  // Shade a [from,to] measure range behind the notes — one translucent rect per matching measure.
  // No-op without a range.
  function shadeMeasureRange(svg, measureList, range, { cls, fill, opacity }) {
    if (!range) return;
    measureBoxesInRange(measureList, range[0], range[1]).forEach((b) => {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', cls);
      rect.setAttribute('x', b.x1);
      rect.setAttribute('y', b.y1 - SHADE_PAD_Y);
      rect.setAttribute('width', b.x2 - b.x1);
      rect.setAttribute('height', (b.y2 - b.y1) + 2 * SHADE_PAD_Y);
      rect.setAttribute('fill', fill);
      rect.setAttribute('opacity', opacity);
      rect.setAttribute('pointer-events', 'none');
      svg.insertBefore(rect, svg.firstChild);   // first child → painted behind the notes
    });
  }

  // Shade ONE occurrence of a detected phrase as a BLOCK rather than as loose per-bar rects: its bars
  // are merged into a single rect per system, trimmed at each end.
  //
  // The trim is the whole point. A phrase whose next return starts on the very next bar produced an
  // unbroken wash of one colour across both, so there was no way to see where one ended — which is
  // exactly what a phrase map has to show. Trimming each block leaves a visible seam at a boundary
  // while bar lines INSIDE an occurrence stay unbroken, so a block reads as one phrase.
  //
  // A phrase that breaks across a line becomes several blocks with no seam to read, so the first block
  // also gets a small badge (B2′) naming which return it is. That is drawn ON TOP of the notes — it is
  // a label, and a label behind a notehead is no label.
  const PHRASE_BLOCK_TRIM = 5;   // svg units off each end of a block → the seam at a phrase boundary
  function shadePhraseOccurrence(svg, measureList, band, cls) {
    const boxes = measureBoxesInRange(measureList, band.from, band.to);
    if (!boxes.length) return;
    // Merge into runs of consecutive bars sharing a system (same stave top). A line break starts a run.
    const runs = [];
    boxes.forEach((b) => {
      const last = runs[runs.length - 1];
      if (last && Math.abs(last.y1 - b.y1) < 1 && b.abs === last.lastAbs + 1) {
        last.x2 = Math.max(last.x2, b.x2);
        last.y2 = Math.max(last.y2, b.y2);
        last.lastAbs = b.abs;
      } else {
        runs.push({ x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, lastAbs: b.abs });
      }
    });
    runs.forEach((r, i) => {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', cls);
      rect.setAttribute('x', r.x1 + PHRASE_BLOCK_TRIM);
      rect.setAttribute('y', r.y1 - SHADE_PAD_Y);
      // Never let the trim collapse a short block (a one-bar occurrence) to nothing.
      rect.setAttribute('width', Math.max(2, (r.x2 - r.x1) - 2 * PHRASE_BLOCK_TRIM));
      rect.setAttribute('height', (r.y2 - r.y1) + 2 * SHADE_PAD_Y);
      rect.setAttribute('fill', band.fill);
      rect.setAttribute('opacity', String(band.opacity));
      rect.setAttribute('pointer-events', 'none');
      svg.insertBefore(rect, svg.firstChild);
      if (i !== 0 || !band.badge) return;
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('class', cls);
      t.setAttribute('x', r.x1 + PHRASE_BLOCK_TRIM + 2);
      t.setAttribute('y', r.y1 - SHADE_PAD_Y + 9);
      t.setAttribute('font-size', '10');
      t.setAttribute('font-weight', 'bold');
      t.setAttribute('fill', band.fill);
      t.setAttribute('pointer-events', 'none');
      t.textContent = band.badge;
      svg.appendChild(t);   // last child → drawn over the notes, so the label stays readable
    });
    // Inside a modified return, outline the bars that actually differ from the phrase's first statement.
    // The lighter fill only says "something in here changed"; this says where. A dashed outline rather
    // than a stronger fill, because fill intensity already means literal-vs-varied and reusing it would
    // make a changed bar of a variation look like the reference.
    (band.changed || []).forEach((m) => {
      const box = measureBoxesInRange(measureList, m, m)[0];
      if (!box) return;
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', cls);
      rect.setAttribute('x', box.x1 + PHRASE_BLOCK_TRIM);
      rect.setAttribute('y', box.y1 - SHADE_PAD_Y);
      rect.setAttribute('width', Math.max(2, (box.x2 - box.x1) - 2 * PHRASE_BLOCK_TRIM));
      rect.setAttribute('height', (box.y2 - box.y1) + 2 * SHADE_PAD_Y);
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', band.fill);
      rect.setAttribute('stroke-width', '1.5');
      rect.setAttribute('stroke-dasharray', '5 3');
      rect.setAttribute('opacity', '0.85');
      rect.setAttribute('pointer-events', 'none');
      svg.insertBefore(rect, svg.firstChild);   // behind the notes — a frame, not a veil
    });
  }

  // Two independent shaded bands, rebuilt on every render: the captured vocab range (yellow) and
  // the current fretboard step's measures (blue, echoing the fretboard dots). No-op without a DOM svg.
  const MEASURE_HL_CLASS = 'measure-hl-layer';
  const STEP_HL_CLASS = 'step-hl-layer';
  const PHRASE_BAND_CLASS = 'phrase-band-layer';
  function applyMeasureHighlight() {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.' + MEASURE_HL_CLASS + ',.' + STEP_HL_CLASS + ',.' + PHRASE_BAND_CLASS).forEach((n) => n.remove());
    if (!measureHighlight && !stepHighlight && !phraseBandList.length) return;
    const svg = container.querySelector('svg');
    const measureList = osmd.graphic && osmd.graphic.measureList;
    if (!svg || !measureList || !measureList.length) return;
    // Phrase blocks first, so the vocab/step bands stay readable on top of them.
    phraseBandList.forEach((b) => shadePhraseOccurrence(svg, measureList, b, PHRASE_BAND_CLASS));
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
  // aren't in a selected tag. Runs in postRender after applySuppressionDim so tag colors win over the
  // suppression grey — EXCEPT while the Suppress-notes toggle is on, when that pass moves to the end
  // and wins instead (see postRender). No-op when there are no patterns.
  // Tag + phrase coloring / dimming, in one pass. The tag panel (tagFilter) and phrase panel
  // (phraseFilter) each act as a "dim mode": while open, notes NOT in a revealed tag/phrase are
  // dimmed, and a note is revealed (kept lit + colored) when its tag is checked (filterTags) or a
  // phrase containing that tag is shown (shownPhrases). The tag currently being painted is always
  // revealed so authoring stays visible. When neither panel is open, tagged notes keep their base
  // color-by-tag and nothing dims. Phrase color wins over tag color on a shared note.
  //
  // The decision itself is separated from the painting: (note identity) → the colour to ink it, or
  // null to leave it as rendered. null instead of a function means the overlay is off entirely. Kept
  // apart from applyTagOverlay so the compare view — a different OSMD instance drawing the same piece
  // — can ask the same question about its own notes and come out the same colour.
  function overlayPainter() {
    if (plainView) return null;     // "Original view" — no tag/phrase colour or dim at all
    if (rhythmFocus) return null;   // a rhythm highlight owns the sheet on its own — see applyRhythmFocusDim
    if (!tagFilter && !phraseFilter && !dimAll && !assignments.length) return null;   // nothing to color / dim
    const indexed = indexAssignments(assignments);
    const cmap = colorMap(tagRegistry);
    const revealTags = new Set(filterTags);
    if (tagMode && activeTag) revealTags.add(activeTag);
    const revealPhrases = new Set(shownPhrases);
    if (phrasePaintMode && activePhrase) revealPhrases.add(activePhrase);   // keep the painted phrase visible
    // note-id → phrase color, for the revealed phrases (their resolved union of tags' + extra notes).
    const phraseKeyColor = new Map();
    if (phraseFilter) phrases.forEach((p) => {
      if (revealPhrases.has(p.name)) phraseNoteIds(p).forEach((n) => phraseKeyColor.set(tagNoteId(n), p.color));
    });
    return (key) => {
      let paint = null, lit = false;
      if (phraseFilter && phraseKeyColor.has(key)) { paint = phraseKeyColor.get(key); lit = true; }
      else if (tagFilter || dimAll) {
        // Light the note for ANY revealed tag it belongs to — not just its first tag — so a note
        // shared with an earlier (hidden) tag still shows when a later tag is revealed. Under dimAll the
        // Find-pattern matches are re-lit afterwards by lastSearch (postRender), so they survive the dim.
        const tname = revealedTagForKey(indexed, key, revealTags);
        if (tname) { paint = cmap[tname]; lit = true; }
      } else {
        const tname = firstTagForKey(indexed, key);
        if (tname) { paint = cmap[tname]; }   // panels closed → base color-by-tag, no dim
      }
      if (!lit && (tagFilter || phraseFilter || dimAll)) paint = DIM_CONNECTOR_COLOR;   // dim the un-revealed
      return paint;
    };
  }

  function applyTagOverlay() {
    if (!container || !container.querySelectorAll) return;
    const paintOf = overlayPainter();
    if (!paintOf) return;
    orderedRenderedNotes().forEach((n) => {
      if (n.midi == null || !n.el) return;
      const paint = paintOf(tagNoteId({ measure: n.measure, midi: n.midi, beats: n.onsetBeats }));
      if (paint) paintNoteElement(n.el, paint);
    });
  }

  // Grey → hex + rgb() forms, for reading back a fill that the browser may have normalised.
  const DIM_HEX = DIM_CONNECTOR_COLOR.toLowerCase();
  const DIM_RGB = (() => { const m = DIM_HEX.match(/^#(\w\w)(\w\w)(\w\w)$/); return m ? `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})` : ''; })();
  const isDimFill = (v) => { v = (v || '').toLowerCase(); return v === DIM_HEX || v === DIM_RGB; };

  // Unison fix: in a merged/two-voice piece the SAME pitch can sound at the SAME onset in two voices, so
  // OSMD draws two noteheads at one spot. A motif/phrase search lights one of them (its notehead carries
  // data-chord-orig); its unison partner was greyed by applyTagOverlay and, drawn on top, hides the lit
  // one. Promote every grey notehead that shares an identity (measure,midi,beats) with a lit one to that
  // lit colour — so both read as matched, and getDimmedNotes (grey-based) no longer mutes them in playback.
  // Runs in postRender AFTER the search re-light. No-op when nothing is highlighted.
  function promoteUnisonHighlights() {
    if (!container || !container.querySelectorAll) return;
    const ordered = orderedRenderedNotes();
    const litColor = new Map();   // identity → the highlight colour it was lit with
    ordered.forEach((n) => {
      if (n.midi == null || !n.el) return;
      const head = n.el.querySelector('path[data-chord-orig]');
      if (!head) return;
      const color = head.getAttribute('fill');
      if (color && !isDimFill(color)) litColor.set(tagNoteId({ measure: n.measure, midi: n.midi, beats: n.onsetBeats }), color);
    });
    if (!litColor.size) return;
    ordered.forEach((n) => {
      if (n.midi == null || !n.el) return;
      const color = litColor.get(tagNoteId({ measure: n.measure, midi: n.midi, beats: n.onsetBeats }));
      if (!color) return;
      [n.el, ...n.el.querySelectorAll('path, ellipse, circle, rect')].forEach((h) => {
        if (isDimFill(h.getAttribute('fill')) || isDimFill(h.style && h.style.fill)) { h.setAttribute('fill', color); h.style.fill = color; }
      });
    });
  }

  // While a rhythm (a picked pattern or a selected group) is highlighted, that highlight owns the
  // sheet: every notehead goes grey first, so voice colours and motif/phrase colours can't compete
  // with it, and only what the rhythm lights up carries colour. Runs before the highlight is
  // re-applied in postRender; a no-op when no rhythm is highlighted.
  function applyRhythmFocusDim() {
    if (!rhythmFocus || !container || !container.querySelectorAll) return;
    orderedRenderedNotes().forEach((n) => {
      if (!n.el) return;
      [n.el, ...n.el.querySelectorAll('path, ellipse, circle, rect')].forEach((h) => {
        h.setAttribute('fill', DIM_CONNECTOR_COLOR); h.style.fill = DIM_CONNECTOR_COLOR;
        const st = h.getAttribute('stroke');
        if (st && st !== 'none') { h.setAttribute('stroke', DIM_CONNECTOR_COLOR); h.style.stroke = DIM_CONNECTOR_COLOR; }
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
        // `grace` has to be carried, not re-derived: this re-pack is what every consumer reads, and
        // dropping the flag here silently disabled the whole grace handling in the pattern search.
        out.push({ name: n.name, el: n.el, measure: n.measure, idx: n.idx, order: out.length, band,
          onsetBeats: n.onsetBeats, midi: n.midi, durBeats: n.durBeats, voice: n.voice, grace: !!n.grace,
          left: box.left, right: box.right, top: box.top, bottom: box.bottom });
      });
    });
    return out;
  }

  const NOTE_EPS = 1e-6;
  // Stream indices (ascending) of the given note identities in the rendered `ordered` stream,
  // matched by (midi, onset). Unrendered notes drop out. Shared by tag + phrase pattern search.
  function orderedIndicesFor(noteIds, ordered) {
    return resolveTagIndices(noteIds, ordered);
  }

  // Resolve the diatonic key ONCE from the whole piece (or honor the picked `key`), so a search's
  // key label and every tag/phrase within it use the same key. Null unless diatonic + interval mode.
  // Uses the full detection (signature + cadences) rather than the profile alone: diatonic matching
  // maps notes onto the major or the natural-minor collection, so a wrong mode shifts every degree.
  function resolveSearchKey(ordered, { intervalBasis, wantInt, key }) {
    if (intervalBasis !== 'diatonic' || !wantInt) return null;
    if (key) return key;
    const d = detectedKey(ordered);
    return d ? { tonicPc: d.tonicPc, mode: d.mode } : guessKey(pcHistogram(ordered.map((n) => n.midi)));
  }

  // The rendered notes' key, judged against the signature the sheet is actually drawn in (taken from
  // the loaded piece's key string, so a transposed/combined score is judged in ITS key). Null when
  // nothing is drawn. Shared by the diatonic search and the Transpose/patKey "original key".
  function detectedKey(ordered) {
    const notes = (ordered || []).filter((n) => n.midi != null);
    if (!notes.length) return null;
    const parsed = currentKey ? parseKeyName(currentKey) : null;
    const fifths = parsed ? fifthsOfKey(parsed.tonicPc, parsed.mode) : null;
    return detectKey(notes.map((n) => ({ midi: n.midi, measure: n.measure, onsetBeats: n.onsetBeats, durBeats: n.durBeats })),
      { fifths, hasSignature: fifths != null });
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
  function setRhythmFocus(on) {
    const next = !!on;
    if (rhythmFocus === next) return;
    rhythmFocus = next;
    if (!_inReapply) redraw();   // repaint the sheet under (or back out from) the focus
  }
  // The note line the pattern search runs on. Grace notes are nudged just before their principal so
  // each holds its own moment: they are drawn (and identified) AT the principal's onset, so on a line
  // of one-note-per-onset they were always beaten by it and stayed invisible to motifs. The nudge is
  // search-only — every stored identity still uses the notehead's real onset.
  const GRACE_NUDGE = 0.001;
  function searchStream(ordered) {
    const graceCount = new Map();
    ordered.forEach((n) => { if (n.grace) graceCount.set(n.onsetBeats, (graceCount.get(n.onsetBeats) || 0) + 1); });
    const placed = new Map();
    return ordered.map((n) => {
      let onset = n.onsetBeats;
      if (n.grace && onset != null) {
        const k = (placed.get(n.onsetBeats) || 0);
        placed.set(n.onsetBeats, k + 1);
        onset -= GRACE_NUDGE * (graceCount.get(n.onsetBeats) - k);   // first grace sits earliest
      }
      return { midi: n.midi, durBeats: n.durBeats, voice: n.voice, onset };
    });
  }

  function searchTagPatterns({ mode = 'intervals', durationStrict = true, intervalBasis = 'chromatic', key = null } = {}) {
    clearHighlight();
    lastPatternMatches = [];
    lastPatternOriginals = [];
    const ordered = orderedRenderedNotes();
    const stream = searchStream(ordered);
    const wantInt = mode === 'intervals' || mode === 'both';
    const resolvedKey = resolveSearchKey(ordered, { intervalBasis, wantInt, key });
    const resolvedKeyLabel = resolvedKey ? keyLabel(resolvedKey.tonicPc, resolvedKey.mode) : null;
    const cmap = colorMap(tagRegistry);
    const results = [];
    const painted = [];   // every matched occurrence, painted after the loop in size order
    assignments.forEach((a) => {
      if (!filterTags.has(a.name)) return;
      const color = cmap[a.name] || CHORD_HL_COLOR;
      // Locate this tag's notes in the rendered stream by (midi, onset); keep those visible, ordered.
      const idx = orderedIndicesFor(a.notes, ordered);
      if (idx.length < 2) { results.push({ name: a.name, color, count: 0 }); return; }
      const { originalIdx, matches } = findScopedMatches(stream, idx, { mode, durationStrict, intervalBasis, key: resolvedKey });
      // The tag's OWN occurrence is painted here too, not left to the tag overlay: this pass opens with
      // clearHighlight(), which resets every notehead to its base fill — so the overlay's colour on the
      // notes you tagged by hand was wiped and never put back. They played but did not light up.
      const own = originalIdx.map((i) => ordered[i]);
      lastPatternOriginals.push({ name: a.name, notes: own });
      if (own.length) painted.push({ notes: own, color });
      matches.forEach((m) => {
        const notes = m.map((i) => ordered[i]);
        painted.push({ notes, color });
        lastPatternMatches.push({ name: a.name, notes });   // one group per matched occurrence
      });
      results.push({ name: a.name, color, count: matches.length });
    });
    // Paint the longest occurrences LAST, so where a longer motif covers a shorter one the longer
    // one's colour survives. Painting in motif order made the winner depend on which was tagged first.
    painted.sort((x, y) => x.notes.length - y.notes.length)
      .forEach((p) => highlightNotes(p.notes, p.color));
    lastSearch = () => searchTagPatterns({ mode, durationStrict, intervalBasis, key });   // re-apply on re-render
    // A motif search takes the sheet back from a rhythm highlight. AFTER lastSearch is reassigned:
    // dropping the focus re-renders, and postRender repaints from whatever lastSearch now names.
    setRhythmFocus(false);
    return { results, keyLabel: resolvedKeyLabel };
  }

  // ── Phrases ────────────────────────────────────────────────────────────────────────────────
  // ---- Rhythm patterns -------------------------------------------------------------------------
  // Pitch-blind counterpart of the motif search: read the rhythms the DRAWN notes use (so a segment
  // view yields that segment's rhythms), list them for a picker, then paint every occurrence of the
  // picked one. Nothing has to be tagged first.
  // Meter of one measure, in quarter-beats: its downbeat, the length of ONE BEAT, and the bar length.
  // Compound meters (6/8, 9/8, 12/8) beat in dotted quarters — that is what makes three eighths a
  // single beat-cell in 6/8 instead of an arbitrary run of three. Falls back to 4/4. Memoized per scan.
  function meterOfMeasure(mnum, cache) {
    if (cache.has(mnum)) return cache.get(mnum);
    let numerator = 4, denominator = 4;
    try {
      const sms = osmd.Sheet && osmd.Sheet.SourceMeasures;
      const m = sms && sms[Math.max(0, Math.min(sms.length - 1, mnum - 1))];
      const ts = m && m.ActiveTimeSignature;
      if (ts && ts.Numerator > 0 && ts.Denominator > 0) { numerator = ts.Numerator; denominator = ts.Denominator; }
    } catch (_) { /* no sheet / no signature → 4/4 */ }
    const unit = 4 / denominator;   // the notated beat unit (quarter-beats)
    const compound = numerator % 3 === 0 && numerator > 3 && (denominator === 8 || denominator === 16);
    const meter = { barBeat: measureStartBeat(mnum), beatBeats: compound ? unit * 3 : unit, barBeats: numerator * unit };
    cache.set(mnum, meter);
    return meter;
  }
  function rhythmStream(ordered) {
    const cache = new Map();
    return ordered.map((n) => {
      const m = meterOfMeasure(n.measure, cache);
      return { midi: n.midi, durBeats: n.durBeats, voice: n.voice, onset: n.onsetBeats, measure: n.measure,
        barBeat: m.barBeat, beatBeats: m.beatBeats, barBeats: m.barBeats };
    });
  }
  // The rhythm patterns of the open sheet, most frequent first — without the per-occurrence note
  // lists, which only highlightRhythmPattern needs. See music-rhythm.js for `unit`/`proportional`.
  function getRhythmPatterns(opts = {}) {
    return findRhythmPatterns(rhythmStream(orderedRenderedNotes()), opts)
      .map(({ id, unit, key, label, len, count, measures }) => ({ id, unit, key, label, len, count, measures }));
  }
  // Highlight every occurrence of one rhythm pattern (by `id` from getRhythmPatterns), replacing any
  // prior highlight. A blank id just clears. Re-scans rather than caching occurrences, because a
  // re-render rebuilds the note elements. Returns { count, label, measures }.
  function highlightRhythmPattern(id, opts = {}) {
    clearHighlight();
    if (!id) { lastSearch = null; setRhythmFocus(false); return { count: 0, label: null, measures: [] }; }
    lastSearch = () => highlightRhythmPattern(id, opts);   // survive re-renders
    const ordered = orderedRenderedNotes();
    const pat = findRhythmPatterns(rhythmStream(ordered), opts).find((p) => p.id === id);
    if (!pat) return { count: 0, label: null, measures: [] };
    pat.occurrences.forEach((o, i) => highlightNotes(o.noteIdx.map((k) => ordered[k]), RHYTHM_HL_COLORS[i % RHYTHM_HL_COLORS.length]));
    const res = { count: pat.count, label: pat.label, measures: pat.measures };
    setRhythmFocus(true);   // grey the rest of the sheet, then re-paint these (postRender → lastSearch)
    return res;
  }

  // Note identities [{measure,midi,beats}] to hand the player as `mutedNotes` so that only one rhythm
  // pattern sounds — every drawn note that is not part of it (see soloMutedIndices for the rule).
  // Empty for an unknown id.
  function getRhythmMutedNotes(id, opts = {}) {
    if (!id) return [];
    const ordered = orderedRenderedNotes();
    const stream = rhythmStream(ordered);
    const pat = findRhythmPatterns(stream, opts).find((p) => p.id === id);
    if (!pat) return [];
    return soloMutedIndices(stream, pat)
      .map((i) => ({ measure: ordered[i].measure, midi: ordered[i].midi, beats: ordered[i].onsetBeats }));
  }

  // Note ids of EVERY drawn note in the measures a set of occurrences lands in — the play-set for
  // "just the bars this rhythm lives in", which keeps those bars' timing exact while the stretches
  // between them are removed. Onset-ordered, de-duped by (midi, onset).
  function noteIdsInOccurrenceMeasures(ordered, occurrences) {
    const bars = new Set();
    (occurrences || []).forEach((o) => (o.noteIdx || []).forEach((k) => { if (ordered[k]) bars.add(ordered[k].measure); }));
    if (!bars.size) return [];
    const seen = new Set();
    return ordered
      .filter((n) => bars.has(n.measure))
      .filter((n) => {
        const key = `${n.midi}@${n.onsetBeats}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      })
      .map((n) => ({ measure: n.measure, midi: n.midi, beats: n.onsetBeats }))
      .sort((a, b) => a.beats - b.beats);
  }

  // Note ids of every drawn note inside one bar range — the play-set for "these bars, exactly as
  // written". `from`/`to` are PRINTED measure numbers, the numbering the rendered stream itself carries,
  // so a detected phrase's occurrence can be played straight from its own range with no renumbering
  // (same reasoning as autoDetectPhrases). De-duped by (midi, onset) so a note doubled across staves is
  // one event, and onset-ordered because that is what the player's keepNotes path expects.
  function noteIdsInBarRange(from, to) {
    const seen = new Set();
    return orderedRenderedNotes()
      .filter((n) => n.midi != null && n.measure >= from && n.measure <= to)
      .filter((n) => {
        const key = `${n.midi}@${n.onsetBeats}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      })
      .map((n) => ({ measure: n.measure, midi: n.midi, beats: n.onsetBeats }))
      .sort((a, b) => a.beats - b.beats);
  }

  // …for a picked pattern: the bars its occurrences land in.
  function getRhythmMeasureNoteIds(id, opts = {}) {
    if (!id) return [];
    const ordered = orderedRenderedNotes();
    const pat = findRhythmPatterns(rhythmStream(ordered), opts).find((p) => p.id === id);
    return pat ? noteIdsInOccurrenceMeasures(ordered, pat.occurrences) : [];
  }

  // ---- Rhythm groups ---------------------------------------------------------------------------
  // A group is a rhythm FIGURE limited to its own bars, so it behaves exactly like a picked pattern —
  // same scan, same highlight, same solo — only fed the notes of those bars (see music-rhythm-group.js
  // groupPatterns). Everything here works off the DRAWN notes, so a segment view narrows it.
  function groupFigure(name, opts = {}) {
    const g = groupByName(rhythmGroups, name);
    if (!g) return null;
    const ordered = orderedRenderedNotes();
    const stream = rhythmStream(ordered);
    const pat = resolveGroupPattern(stream, g, opts);
    return pat ? { g, ordered, stream, pat } : { g, ordered, stream, pat: null };
  }

  // Paint every occurrence of the group's figure, alternating two shades of the group's colour (what
  // the whole-sheet rhythm highlight does with its greens). A blank name clears. Returns
  // { count, label, measures } — count/measures describe the FIGURE, not the bars.
  function highlightRhythmGroup(name, opts = {}) {
    clearHighlight();
    if (!name) { lastSearch = null; setRhythmFocus(false); return { count: 0, label: null, measures: [] }; }
    lastSearch = () => highlightRhythmGroup(name, opts);
    const f = groupFigure(name, opts);
    if (!f || !f.pat) return { count: 0, label: null, measures: [] };
    const shades = groupShades(f.g.color || CHORD_HL_COLOR);
    f.pat.occurrences.forEach((o, i) => highlightNotes(o.noteIdx.map((k) => f.ordered[k]), shades[i % shades.length]));
    const res = { count: f.pat.count, label: f.pat.label, measures: f.pat.measures };
    setRhythmFocus(true);   // the figure owns the sheet: everything else greys out
    return res;
  }

  // Note identities [{measure,midi,beats}] to hand the player as `mutedNotes` so that only this group
  // sounds: every drawn note that is not part of its figure — including every note outside its bars,
  // since those are never in an occurrence. Empty when the figure isn't on the drawn sheet.
  function getRhythmGroupMutedNotes(name, opts = {}) {
    const f = groupFigure(name, opts);
    if (!f || !f.pat) return [];
    return soloMutedIndices(f.stream, f.pat)
      .map((i) => ({ measure: f.ordered[i].measure, midi: f.ordered[i].midi, beats: f.ordered[i].onsetBeats }));
  }

  // The figure's own notes, onset-ordered — the play-set for hearing the group alone (skip-playback).
  function getRhythmGroupNoteIds(name, opts = {}) {
    const f = groupFigure(name, opts);
    if (!f || !f.pat) return [];
    const seen = new Set();
    const out = [];
    f.pat.occurrences.forEach((o) => o.noteIdx.forEach((k) => {
      const n = f.ordered[k];
      const key = `${n.midi}@${n.onsetBeats}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ measure: n.measure, midi: n.midi, beats: n.onsetBeats });
    }));
    return out.sort((a, b) => a.beats - b.beats);
  }

  // …and for a group: the bars its figure actually lands in (a subset of the group's own bars).
  function getRhythmGroupMeasureNoteIds(name, opts = {}) {
    const f = groupFigure(name, opts);
    return (f && f.pat) ? noteIdsInOccurrenceMeasures(f.ordered, f.pat.occurrences) : [];
  }

  // The figures the group's bars run, most used first — the picker for "which rhythm is this group?".
  function rhythmGroupPatterns(name, opts = {}) {
    const g = groupByName(rhythmGroups, name);
    if (!g) return [];
    return groupPatterns(rhythmStream(orderedRenderedNotes()), g.ranges, groupOpts(g, opts))
      .map(({ id, label, count, measures }) => ({ id, label, count, measures }));
  }

  // The figures of an arbitrary bar list — used to name a group after its rhythm as it is captured.
  function rhythmRangesPatterns(ranges, opts = {}) {
    return groupPatterns(rhythmStream(orderedRenderedNotes()), ranges || [], opts)
      .map(({ id, label, count, measures }) => ({ id, label, count, measures }));
  }

  // Automatic phrase detection over the drawn sheet — cut the piece into `bars`-long spans and group
  // the ones that recur (music-phrase-detect.js). Reads the same note stream the rhythm scanner does,
  // whose `measure` is the PRINTED number, which is also what shadeMeasureRange matches on — so a
  // detected phrase's bars can be shaded straight from the result with no renumbering.
  // Re-scanned on demand rather than cached: a re-render rebuilds the notes this reads.
  function autoDetectPhrases(opts = {}) {
    return detectPhrasesModel(rhythmStream(orderedRenderedNotes()), opts);
  }

  // Resolve a phrase to onset-ordered note identities [{measure,midi,beats}] (its member tags'
  // notes + extra notes, unioned) — the play-set for playing the phrase together. Empty when unknown.
  // A phrase is a stretch of bars corrected by hand: the notes drawn in those bars, less the ones it
  // says are not part of it, plus the ones it brings in from outside (see phraseNotes). Only the
  // renderer knows what is drawn, so it supplies the bars' notes and the model does the arithmetic.
  function phraseNoteIds(p) {
    const r = phraseRange(p);
    return phraseNotes(p, r ? noteIdsInBarRange(r[0], r[1]) : []);
  }
  function getPhraseNoteIds(name) {
    return phraseNoteIds(phraseByName(phrases, name));
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
      const all = orderedIndicesFor(phraseNoteIds(p), ordered).map((i) => ordered[i]);
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
    const idx = orderedIndicesFor(phraseNoteIds(phrase), ordered);
    const color = phrase.color || CHORD_HL_COLOR;
    highlightNotes(idx.map((i) => ordered[i]), color);   // the phrase's own occurrence
    if (idx.length < 2) return { count: 0, keyLabel: resolvedKeyLabel };
    const { matches } = findScopedMatches(stream, idx, { mode, durationStrict, intervalBasis, key: resolvedKey });
    matches.forEach((m) => highlightNotes(m.map((i) => ordered[i]), color));
    setRhythmFocus(false);   // last: the re-render it triggers repaints this search on a fresh sheet
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
    if (phrasePaintMode) {   // correct the active phrase's contents; wins over tag/suppress
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
      if (!suppressedNotes.has(key)) {
        // Default view: click a note to set the playback start there (moves the cursor; the next Play
        // begins from this beat). The chord window, when active, owns the play range — leave it alone.
        if (!chordWindow.active) setPlayStartFromNote(n);
        return;
      }
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
    // Where the suppression grey sits in the paint order is decided by the Suppress-notes toggle.
    // OFF: early, so tag / phrase / rhythm colour wins and a motif stays readable on a sheet that
    // happens to carry muted notes. ON: last (below), because then the whole point of the sheet is
    // WHICH notes are silenced — and every painter after this one would otherwise bury the grey,
    // leaving a suppressed note looking perfectly normal while it plays silently.
    if (!suppressMode) applySuppressionDim();
    applyTagOverlay();
    applyRhythmFocusDim();   // a highlighted rhythm greys everything, then paints only its own notes
    // Re-paint the last pattern search's occurrences (over the fresh overlay) so a re-render doesn't
    // strip them. Guarded so the search's own clearHighlight/highlightNotes can't recurse into here.
    if (lastSearch && !_inReapply) { _inReapply = true; try { lastSearch(); } catch (_) {} finally { _inReapply = false; } }
    promoteUnisonHighlights();   // lift a lit note's greyed unison partner so it isn't hidden / mis-muted
    applyExtraNoteHighlight();   // re-ink variation added-notes onto the fresh noteheads
    if (suppressMode) applySuppressionDim();   // owns the sheet while you are choosing what to silence
    if (onAfterRender) { try { onAfterRender(); } catch (_) {} }
  }

  // One render pass: push model colors, then render. The render wrap runs postRender() afterwards.
  // Absolute onset beat (quarter-beats from score start) of measure `mnum`'s downbeat; 0 if unavailable.
  function measureStartBeat(mnum) {
    try {
      const sms = osmd.Sheet && osmd.Sheet.SourceMeasures;
      if (!sms || !sms.length) return 0;
      const m = sms[Math.max(0, Math.min(sms.length - 1, mnum - 1))];
      const t = m && m.AbsoluteTimestamp;
      return (t && typeof t.RealValue === 'number') ? t.RealValue * 4 : 0;
    } catch (_) { return 0; }
  }
  // Keep the play cursor inside the drawn window [shownFrom, shownTo]. OSMD's render → Cursor.update
  // reads the graphical entry of the cursor's current note; when the window is clipped to a segment
  // that excludes that note, the entry is undefined and OSMD throws. So if the cursor sits outside the
  // drawn measures, snap it forward (by absolute beat) to the first entry of the window before render.
  function clampCursorToDrawnRange() {
    try {
      const c = osmd.cursor;
      if (!c || !c.iterator) return;
      const total = totalMeasures || 0;
      const startBeat = measureStartBeat(shownFrom);
      const endBeat = (total && shownTo < total) ? measureStartBeat(shownTo + 1) : Infinity;
      const t = c.iterator.currentTimeStamp;
      const cur = (t && typeof t.RealValue === 'number') ? t.RealValue * 4 : null;
      if (cur != null && cur >= startBeat - 1e-6 && cur < endBeat - 1e-6) return;   // already inside
      c.reset();
      let guard = 0;
      while (guard++ < 5000) {
        const tt = c.iterator.currentTimeStamp;
        const cb = (tt && typeof tt.RealValue === 'number') ? tt.RealValue * 4 : null;
        if (cb == null || cb >= startBeat - 1e-6 || c.iterator.EndReached) break;
        c.next();
      }
    } catch (_) {}
  }

  // Move the OSMD cursor to the first entry at/after absolute onset `beat` (quarter-beats from the
  // score start) and show it. Reset, then step forward. No-op if the cursor isn't ready. Shared by the
  // public showCursorAtBeat (fretboard stepping) and click-to-play-from.
  function positionCursorAtBeat(beat) {
    try {
      const c = osmd.cursor;
      if (!c) return;
      c.reset();
      if (beat != null) {
        let guard = 0;
        while (guard++ < 5000) {
          const t = c.iterator && c.iterator.currentTimeStamp;
          const cb = (t && typeof t.RealValue === 'number') ? t.RealValue * 4 : null;
          if (cb == null || cb >= beat - 1e-6 || (c.iterator && c.iterator.EndReached)) break;
          c.next();
        }
      }
      c.show();
    } catch (_) {}
  }

  // Record `n` as the playback start (click-to-play-from) and move the cursor there for feedback.
  function setPlayStartFromNote(n) {
    // Keep the voice: (measure, midi, beats) alone is ambiguous at a cross-voice unison, and
    // getPlayStartRange derives the cursor's step count from the resolved note's reading ORDER —
    // so re-resolving to the other hand's copy parks the cursor one notehead from where you clicked.
    playStart = { measure: n.measure, midi: n.midi, beats: n.onsetBeats, voice: n.voice };
    positionCursorAtBeat(n.onsetBeats);
    if (onSeek) { try { onSeek(); } catch (_) {} }
  }

  // Drop the click-selected start (view changes reset playback to the view's own start).
  function clearPlayStart() {
    if (!playStart) return;
    playStart = null;
    if (onSeek) { try { onSeek(); } catch (_) {} }
  }

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

  // The two engraving rules the aligned layout needs, both off in OSMD by default.
  //
  //   NewSystemAtXMLNewSystemAttribute — obey the <print new-system> marks setSystemBreaks wrote.
  //   FixedMeasureWidth               — give every bar the same width, which is what actually puts bar k
  //                                     of one line above bar k of the next. Breaking alone does NOT
  //                                     align anything: each system is stretched to the full page width,
  //                                     so a 3-bar line and a 5-bar line share no column positions.
  //
  // No FixedMeasureWidthFixedValue: OSMD then derives the width from the widest bar, so however many fit
  // is however many fit. Pinning a value would let us force a bar count per line, but the value and the
  // count are coupled (measured: 20 fit four bars, 23 fit only three) and guessing wrong puts a break in
  // before the one we asked for — worse than a phrase that wraps with its columns still true.
  function applyAlignRules() {
    if (!osmd || !osmd.rules) return;   // the injected fake in the unit tests has no rules object
    const on = !!(alignBars && alignBars.length);
    osmd.rules.NewSystemAtXMLNewSystemAttribute = on;
    osmd.rules.FixedMeasureWidth = on;
  }
  // The phrases that did not fit on the line they started: the line ran out before the next phrase's
  // first bar. Reads the DRAWN systems, so it reports what happened rather than what was intended.
  function wrappedPhrases(systems, bars) {
    return (bars || []).filter((b, i) => {
      const next = (bars || [])[i + 1];
      if (next == null) return false;   // the last phrase runs to the end; nothing to fall short of
      const sys = systems.find((s) => s.bars[0] === b);
      return !!sys && sys.bars[sys.bars.length - 1] < next - 1;
    });
  }
  // Which systems the last render actually produced: [{ bars:[printed…], xs:[…] }], top row first.
  // Reports what was DRAWN rather than what was asked for, which is what lets the caller say honestly
  // whether each phrase fitted on its own line. Reuses the same measure-number and box readers the
  // shading uses, so a system here means the same thing a shaded band does.
  function renderedSystems() {
    const list = (osmd && osmd.graphic && osmd.graphic.measureList) || [];
    const rows = new Map();
    list.forEach((measures, a) => {
      const box = measureUnionBox(measures);
      if (!box) return;
      const key = Math.round(box.y1);   // one row per stave top; a line break starts a new one
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ bar: absoluteMeasureNumber(measures, a, list.length), x: Math.round(box.x1) });
    });
    return [...rows.entries()].sort((p, q) => p[0] - q[0]).map(([, ms]) => {
      ms.sort((p, q) => p.x - q.x);
      return { bars: ms.map((m) => m.bar), xs: ms.map((m) => m.x) };
    });
  }

  return {
    osmd,
    getGuessedChordSequence,
    getWindowNoteSet,
    async loadDetail(detail) {
      if (!detail || detail.format !== 'musicxml' || !detail.source) {
        return { ok: false, reason: 'not-musicxml' };
      }
      sourceXml = detail.source;   // kept so the layout can be rebuilt without the caller re-supplying it
      alignBars = null;            // a fresh piece is drawn as engraved
      wantScrollTop = null;        // a new piece opens at its beginning, not at the last one's place
      applyAlignRules();
      await osmd.load(stripBracketOnlyTuplets(detail.source));
      currentKey = (detail.meta && detail.meta.key) || null;   // powers the chord detector's power-chord fallback
      totalMeasures = (osmd.Sheet && osmd.Sheet.SourceMeasures && osmd.Sheet.SourceMeasures.length) || 0;
      computeMeasureOffset();
      shownFrom = 1; shownTo = totalMeasures || Number.MAX_SAFE_INTEGER;
      selectedChords.clear();   // a fresh piece carries no manual chord picks
      extraNoteMarks = null;    // ...and no carried-over variation added-note highlight
      assignments = (detail.patterns || []).map((p) => ({ name: p.name, notes: (p.notes || []).map((n) => ({ ...n })) }));
      // from/to come back too. They did not, and since a phrase IS its bars, every phrase saved under
      // the current model came back covering nothing and resolving to no notes at all — only the older
      // ones survived a reload, on the strength of the notes they carried.
      phrases = (detail.phrases || []).map((p) => ({ name: p.name, color: p.color,
        from: p.from == null ? null : p.from, to: p.to == null ? null : p.to, tags: [...(p.tags || [])],
        add: addedNotes(p).map((n) => ({ ...n })), drop: droppedNotes(p).map((n) => ({ ...n })) }));
      rhythmGroups = (detail.rhythmGroups || []).map(copyGroup);
      tagMode = false; activeTag = null; tagFilter = false; dimAll = false; plainView = false; filterTags = new Set();   // tagRegistry is global — not reset here
      phrasePaintMode = false; activePhrase = null; phraseFilter = false; shownPhrases = new Set();
      clearPlayStart();   // a fresh piece has no click-selected start
      redraw();
      return { ok: true, totalMeasures, measureOffset };
    },
    // Lay the sheet out so each of `bars` (printed numbers) starts a staff line and every bar is the same
    // width — one phrase per line, columns true, so a phrase can be read against its own return. A falsy
    // or empty `bars` restores the score as engraved.
    //
    // This RE-LOADS the XML, because the break marks are read when the file is parsed, not when it is
    // drawn. The reload deliberately does not go through loadDetail: that resets motifs, phrases, rhythm
    // groups and every view flag, which would throw away the phrase list this layout is built from.
    // Nothing else about the piece changes — same notes, same stored source; only what OSMD was handed.
    //
    // Returns what was actually drawn: { on, systems, aligned, wrapped } — `aligned` is how many systems
    // share the leading column positions, `wrapped` the phrases that needed more than one line.
    async setPhraseAlign(bars) {
      if (!sourceXml) return { on: false, systems: [], aligned: 0, wrapped: [] };
      const want = [...new Set((bars || []).map((b) => parseInt(b, 10)).filter(Number.isFinite))]
        .sort((p, q) => p - q);
      alignBars = want.length ? want : null;
      applyAlignRules();
      // Off loads the stored source UNTOUCHED. Handing it a stripped copy instead looked equivalent — the
      // rule is off, so the score's own breaks are ignored either way — but measurably is not: the same
      // piece came back as 7 systems where it had always drawn 6, and stayed there. Whatever OSMD does
      // with those marks beyond the documented rule, the only layout guaranteed to be the one the app has
      // always drawn is the one from the bytes it has always loaded.
      const wasFull = shownFrom <= 1 && shownTo >= totalMeasures;
      await osmd.load(stripBracketOnlyTuplets(alignBars ? setSystemBreaks(sourceXml, alignBars) : sourceXml));
      totalMeasures = (osmd.Sheet && osmd.Sheet.SourceMeasures && osmd.Sheet.SourceMeasures.length) || 0;
      computeMeasureOffset();
      // A load starts a fresh sheet, so everything the VIEW had to say about the old one has to be said
      // again. Both of these were missed at first, and the piece came back laid out differently after a
      // round trip through the toggle — same bytes, 7 systems where it had always drawn 6 — because the
      // responsive zoom had silently gone back to 1 and the drawn window with it.
      osmd.Zoom = currentZoom;
      if (wasFull) { shownFrom = 1; shownTo = totalMeasures || Number.MAX_SAFE_INTEGER; }
      osmd.setOptions({ drawFromMeasureNumber: shownFrom, drawUpToMeasureNumber: shownTo });
      redraw();
      // A phrase that wrapped cannot be read against another bar for bar, which is the only reason to
      // align in the first place — so shrink until it fits rather than leaving the reader to do it. Zoom
      // is the lever because it is the one the sheet already has; the alternative, pinning a fixed bar
      // width, has to be solved against the bar count and lands a break BEFORE the one we asked for when
      // the guess is wrong. Bounded and render-only (the breaks are already in the loaded XML), and it
      // stops at a floor — some phrases are simply too long for the window, and a sheet shrunk to nothing
      // helps no one.
      const ZOOM_FLOOR = 0.35;
      let systems = renderedSystems();
      let wrapped = wrappedPhrases(systems, alignBars);
      if (alignBars) {
        for (let i = 0; i < 5 && wrapped.length && osmd.Zoom > ZOOM_FLOOR; i++) {
          osmd.Zoom = Math.max(ZOOM_FLOOR, osmd.Zoom * 0.85);
          redraw();
          systems = renderedSystems();
          wrapped = wrappedPhrases(systems, alignBars);
        }
      }
      const starts = systems.map((s) => s.xs.join(','));
      const common = starts.filter((s) => s === starts[1]).length;   // [0] holds the clef, so compare to [1]
      return { on: !!alignBars, systems, aligned: alignBars ? common : 0, wrapped, zoom: osmd.Zoom };
    },
    getPhraseAlign() { return alignBars ? [...alignBars] : null; },
    showFull() {
      osmd.setOptions({ drawFromMeasureNumber: 1, drawUpToMeasureNumber: totalMeasures || Number.MAX_SAFE_INTEGER });
      shownFrom = 1; shownTo = totalMeasures || Number.MAX_SAFE_INTEGER;
      clearPlayStart();   // changing the view resets playback to the view's own start
      redraw();
    },
    showSegment(measureRange) {
      osmd.setOptions({ drawFromMeasureNumber: measureRange[0], drawUpToMeasureNumber: measureRange[1] });
      shownFrom = measureRange[0]; shownTo = measureRange[1];
      clearPlayStart();   // changing the view resets playback to the view's own start
      redraw();
    },
    // The currently drawn measure window (1-based). from===1 && to>=totalMeasures means the whole piece.
    getShownRange() { return { from: shownFrom, to: shownTo, total: totalMeasures }; },
    setZoom,
    setVoiceColors(on) { colorVoices = !!on; redraw(); },
    setNoteNames(on) { noteNames = !!on; redraw(); },
    getVoiceColors() { return colorVoices; },
    // A snapshot of the colours the sheet is wearing: (note identity) → colour, or null for "nothing
    // says otherwise". For the compare view, which draws the same piece in its own OSMD and has to reach
    // the same colours. Re-ask after any change — it reads the state as it stands now.
    //
    // Read off the RENDERED noteheads first, and only fall back to the overlay's decision for notes the
    // sheet isn't currently drawing. The paint order on a sheet is a stack — voice colour, suppression
    // grey, tag/phrase colour, rhythm focus, the last pattern search — and re-deriving it would mean
    // keeping a second copy of that stack in step with the first. What is on the notehead already IS
    // the answer; the overlay is only needed where there is no notehead to read.
    noteColorFn() {
      const painted = new Map();
      if (container && container.querySelectorAll) {
        orderedRenderedNotes().forEach((n) => {
          if (n.midi == null || !n.el || !n.el.querySelector) return;
          const head = n.el.querySelector('.vf-notehead path') || n.el.querySelector('path');
          const c = head && ((head.style && head.style.fill) || head.getAttribute('fill'));
          if (c) painted.set(tagNoteId({ measure: n.measure, midi: n.midi, beats: n.onsetBeats }), c);
        });
      }
      const overlay = overlayPainter();
      return (n) => {
        const key = tagNoteId(n);
        if (painted.has(key)) return painted.get(key);
        return overlay ? overlay(key) : null;
      };
    },
    // Toggle the in-score chord-candidate overlay (stacked labels above each chord area).
    setShowChords(on) { showChords = !!on; redraw(); },
    // Toggle dimming of beams/stems/slurs (reduces visual noise; noteheads stay black).
    setDimConnectors(on) { dimConnectors = !!on; redraw(); },
    // Pickup/anacrusis shift (sequential − printed); the UI shows/accepts printed measure numbers.
    getMeasureOffset() { return measureOffset; },
    // Absolute quarter-beat where the first full measure begins — i.e. the anacrusis/pickup length, or a
    // whole measure when there's no pickup. Its value mod the meter is the phase of every barline
    // downbeat, letting the metronome accent align to real downbeats on pickup pieces. See downbeatAlignment.
    anacrusisBeats() { return Math.round(measureStartBeat(2)); },
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
    setPatterns(list) { assignments = (list || []).map((a) => ({ name: a.name, notes: (a.notes || []).map((n) => ({ ...n })) })); lastPatternMatches = []; lastPatternOriginals = []; lastSearch = null; rhythmFocus = false; redraw(); },
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
    // Move THIS piece's notes for `from` onto `to`, following the name through the phrase membership
    // and through whatever this piece had selected — the motif you were looking at must still be the
    // one shown and checked afterwards, or a rename would silently blank the sheet. Refused (false)
    // when `to` already carries notes here: that is a merge, not a rename. Fires onPatternsChange.
    renameTagAssignments(from, to) {
      const clean = (to || '').trim();
      if (!clean || clean === from || !assignments.some((a) => a.name === from)) return false;
      const next = renameInAssignments(assignments, from, clean);
      if (next === assignments) return false;   // `to` was taken — renameInAssignments refused
      assignments = next;
      if (activeTag === from) activeTag = clean;
      if (filterTags.delete(from)) filterTags.add(clean);
      const before = JSON.stringify(phrases.map((p) => p.tags));
      phrases = renameTagInPhrases(phrases, from, clean);
      // The cached search still holds groups labelled with the old name — drop it rather than repaint
      // a stale label; the caller re-runs Find pattern if it wants the occurrences back.
      lastPatternMatches = []; lastPatternOriginals = []; lastSearch = null;
      redraw();
      if (onPatternsChange) { try { onPatternsChange(getAssignments()); } catch (_) {} }
      if (before !== JSON.stringify(phrases.map((p) => p.tags))) firePhrasesChange();
      return true;
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
      filterTags = next; lastPatternMatches = []; lastPatternOriginals = []; lastSearch = null; rhythmFocus = false; redraw();
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
      phrases = (list || []).map((p) => ({ name: p.name, color: p.color, from: p.from ?? null, to: p.to ?? null,
        tags: [...(p.tags || [])],
        add: addedNotes(p).map((n) => ({ ...n })), drop: droppedNotes(p).map((n) => ({ ...n })) }));
      redraw();
    },
    getPhrases() { return getPhrases(); },
    getPhraseNames() { return phrases.map((p) => p.name); },
    getPhraseColors() { const m = {}; phrases.forEach((p) => { m[p.name] = p.color; }); return m; },
    // Create a phrase (next palette color); no-op on blank/duplicate. Returns whether it was added.
    addPhrase(name, from = null, to = null) {
      const { phrases: next, added } = addPhraseReducer(phrases, name, null, from, to);
      if (added) { phrases = next; firePhrasesChange(); redraw(); }
      return added;
    },
    // Move a phrase's bars.
    setPhraseRange(name, from, to) {
      phrases = setPhraseRangeReducer(phrases, name, from, to);
      firePhrasesChange(); redraw();
    },
    removePhrase(name) {
      phrases = removePhraseReducer(phrases, name);
      if (activePhrase === name) activePhrase = null;
      shownPhrases.delete(name);
      firePhrasesChange(); redraw();
    },
    // Add/remove a member tag on a phrase (its notes resolve live from the tags + extra notes).
    setPhraseTag(name, tagName, on) { phrases = setPhraseTagReducer(phrases, name, tagName, !!on); firePhrasesChange(); redraw(); },
    // Enter/leave phrase-edit mode; notehead clicks then correct the active phrase — see togglePhraseNote.
    setPhrasePaintMode(on) { if (phrasePaintMode === !!on) return; phrasePaintMode = !!on; redraw(); },
    setActivePhrase(name) { activePhrase = name || null; },
    // Which phrase clicks are editing, or null. The panel reads it back so its 🖌 shows what is on.
    getPhraseEdit() { return phrasePaintMode ? activePhrase : null; },
    // Phrase "dim mode" (on while the phrase panel is open): dim notes not in a shown phrase.
    setPhraseFilter(on) { phraseFilter = !!on; redraw(); },
    // The set of phrase names whose resolved notes are revealed + tinted on the sheet.
    setShownPhrases(names) { shownPhrases = new Set(names || []); redraw(); },
    getPhraseNoteIds(name) { return getPhraseNoteIds(name); },
    getPhrasesSequence(opts) { return getPhrasesSequence(opts); },
    searchPhrasePattern(name, opts) { return searchPhrasePattern(name, opts); },
    // Rhythm patterns of the drawn notes (list) + highlight every occurrence of one (by its id).
    getRhythmPatterns(opts) { return getRhythmPatterns(opts); },
    highlightRhythmPattern(id, opts) { return highlightRhythmPattern(id, opts); },
    getRhythmMutedNotes(id, opts) { return getRhythmMutedNotes(id, opts); },
    // Every note of the bars a picked rhythm occurs in — for playing those bars and nothing else.
    getRhythmMeasureNoteIds(id, opts) { return getRhythmMeasureNoteIds(id, opts); },
    // ── Rhythm groups (a rhythm figure limited to chosen bars; see music-rhythm-group.js) ───────
    // Per-piece group list, persisted as detail.rhythmGroups. setRhythmGroups does NOT fire
    // onRhythmGroupsChange (it IS the load path); every edit below does.
    setRhythmGroups(list) { rhythmGroups = (list || []).map(copyGroup); },
    getRhythmGroups() { return getRhythmGroups(); },
    getRhythmGroupColors() { const m = {}; rhythmGroups.forEach((g) => { m[g.name] = g.color; }); return m; },
    // Create a group over `ranges` (next palette color), optionally fixed to one figure (`pattern`);
    // no-op on blank/duplicate name.
    addRhythmGroup(name, ranges, pattern, opts) {
      const { groups, added } = addGroupReducer(rhythmGroups, name, ranges, null, pattern, opts);
      if (added) { rhythmGroups = groups; fireRhythmGroupsChange(); }
      return added;
    },
    removeRhythmGroup(name) { rhythmGroups = removeGroupReducer(rhythmGroups, name); fireRhythmGroupsChange(); },
    // Replace / extend a group's bars, or change which of their figures it stands for.
    setRhythmGroupRanges(name, ranges) { rhythmGroups = setGroupRangesReducer(rhythmGroups, name, ranges); fireRhythmGroupsChange(); },
    addRhythmGroupRanges(name, ranges) { rhythmGroups = addGroupRangesReducer(rhythmGroups, name, ranges); fireRhythmGroupsChange(); },
    setRhythmGroupPattern(name, id, opts) { rhythmGroups = setGroupPatternReducer(rhythmGroups, name, id, opts); fireRhythmGroupsChange(); },
    // What a group is bound to right now: its figure's label + the settings it was read under, so the
    // UI can say what the association IS (and flag one made under other settings than the panel's).
    rhythmGroupBinding(name, opts) {
      const g = groupByName(rhythmGroups, name);
      if (!g) return null;
      const bound = groupOpts(g, opts);
      const pat = resolveGroupPattern(rhythmStream(orderedRenderedNotes()), g, opts);
      return { pattern: g.pattern || null, label: pat ? pat.label : null, count: pat ? pat.count : 0, ...bound };
    },
    highlightRhythmGroup(name, opts) { return highlightRhythmGroup(name, opts); },
    // A selected group's solo set (mutedNotes) and its own notes (keepNotes) — the two playback paths.
    getRhythmGroupMutedNotes(name, opts) { return getRhythmGroupMutedNotes(name, opts); },
    getRhythmGroupNoteIds(name, opts) { return getRhythmGroupNoteIds(name, opts); },
    getRhythmGroupMeasureNoteIds(name, opts) { return getRhythmGroupMeasureNoteIds(name, opts); },
    // The figures found in a group's bars (its picker), and in any bar list (to name a fresh capture).
    rhythmGroupPatterns(name, opts) { return rhythmGroupPatterns(name, opts); },
    rhythmRangesPatterns(ranges, opts) { return rhythmRangesPatterns(ranges, opts); },
    // Best-guess key of the currently-rendered notes — the notated signature narrowed to one of its
    // two keys by the cadences, with the pitch profile as a check (see music-key.js/detectKey). Powers
    // the diatonic key picker's default and the Transpose "original key". Returns the full detail
    // ({ tonicPc, mode, label, key, confidence, signatureFits, reasons, … }); null when nothing is drawn.
    // The signature comes from the loaded piece's own key string, so a transposed/combined sheet is
    // judged against the signature it is actually drawn in.
    guessBestKey() { return detectedKey(orderedRenderedNotes()); },
    // Note identities [{measure,midi,beats}] matched by the most recent searchTagPatterns (flattened
    // across occurrences) — so Play-tags can include them. Reset when the tag selection / patterns change.
    getPatternMatchNotes() {
      const out = [];
      lastPatternMatches.forEach((g) => g.notes.forEach((n) => out.push({ measure: n.measure, midi: n.midi, beats: n.onsetBeats })));
      return out;
    },
    // The same occurrences kept WHOLE: one entry per occurrence (the tags' own and the matches), with
    // the bars it spans. getPatternMatchNotes flattens these into loose notes, which is fine when you
    // want them all — but anything that narrows by bars has to weigh a run of notes as one thing, or a
    // match lying across the boundary is played half-in, half-out.
    getPatternMatchGroups() {
      return [...lastPatternOriginals, ...lastPatternMatches].map((g) => {
        const notes = (g.notes || []).map((n) => ({ measure: n.measure, midi: n.midi, beats: n.onsetBeats }));
        const ms = notes.map((n) => n.measure).filter((m) => m != null);
        return { name: g.name, notes, from: ms.length ? Math.min(...ms) : null, to: ms.length ? Math.max(...ms) : null };
      });
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
    setDimAll(on) { dimAll = !!on; redraw(); },
    dimAllOn() { return dimAll; },
    anyDimActive() { return !!(tagFilter || phraseFilter || rhythmFocus || dimAll); },
    setPlainView(on) { plainView = !!on; redraw(); },
    plainViewOn() { return plainView; },
    // Drop the active motif/phrase search's coloured occurrences (keeps the tags/phrases themselves).
    clearSearchHighlight() { lastSearch = null; lastPatternMatches = []; lastPatternOriginals = []; clearHighlight(); redraw(); },
    // Identities [{measure,midi,beats}] of notes currently drawn DIMMED (grey) by whatever highlight owns
    // the sheet — motif / phrase / rhythm / dim-all. Read straight from the rendered noteheads so it always
    // matches what the eye sees. The player feeds these in as mutedNotes so a dimmed sheet plays only its
    // lit notes. Empty when nothing is dimmed (returns [] so callers can spread it unconditionally).
    getDimmedNotes() {
      const out = [];
      if (!(tagFilter || phraseFilter || rhythmFocus || dimAll)) return out;
      if (!container || !container.querySelectorAll) return out;
      // The dim passes set the notehead's `fill` ATTRIBUTE to the hex grey (they also set style.fill, but
      // the browser reports that back as rgb()) — isDimFill matches either form. promoteUnisonHighlights has
      // already lifted any lit note's greyed unison partner, so a still-grey notehead is genuinely dimmed.
      orderedRenderedNotes().forEach((n) => {
        if (n.midi == null || !n.el) return;
        const head = n.el.querySelector('path, ellipse, circle');
        if (!head) return;
        const dim = isDimFill(head.getAttribute('fill')) || isDimFill(head.style && head.style.fill);
        out.push({ measure: n.measure, midi: n.midi, beats: n.onsetBeats, dim });
      });
      // A grey notehead whose unison twin is LIT is not a dimmed note — see unlitIdentities.
      return unlitIdentities(out);
    },
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
    // Voices present in the view: [{ id, color, allSuppressed, count, lo, hi }] — `id` is the color
    // index (voiceColor's), `lo`/`hi` the voice's lowest/highest MIDI pitch. Powers the suppress chips
    // and the colour legend, which names each colour by its voice and pitch range.
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
        const midis = notes.map((n) => n.midi);
        return { id, color: voiceColor(id), allSuppressed, count: notes.length,
          lo: Math.min(...midis), hi: Math.max(...midis) };
      });
    },
    // Is voice colouring in effect? The legend must not name colours the sheet isn't using.
    voiceColorsOn() { return colorVoices; },
    // Is a rhythm highlight owning the sheet (everything else greyed)? The legend reads this.
    rhythmFocusOn() { return rhythmFocus; },
    // The colours highlights are painted in, so the UI's legend names the same hues the sheet shows
    // instead of keeping its own copy of them.
    highlightColors() { return { chord: CHORD_HL_COLOR, rhythm: [...RHYTHM_HL_COLORS], dim: DIM_CONNECTOR_COLOR }; },
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
    // Play range for a click-selected start note: from that note through the END of the drawn view,
    // as { fromMeasure, toMeasure, fromBeat?, toBeat?, cursorStep } (same shape as getWindowRange).
    // Null when no start is set OR the start note isn't in the current view (e.g. re-clipped) — then
    // playback falls back to the segment/whole-piece range. Read fresh so re-renders can't stale it.
    getPlayStartRange() {
      if (!playStart) return null;
      const ordered = orderedRenderedNotes();
      if (!ordered.length) return null;
      const hits = [];
      ordered.forEach((n, i) => {
        if (n.midi === playStart.midi && n.measure === playStart.measure
          && Math.abs((typeof n.onsetBeats === 'number' ? n.onsetBeats : NaN) - playStart.beats) < NOTE_EPS) hits.push(i);
      });
      // A unison gives two candidates; take the one in the voice that was clicked. Starts recorded
      // before the voice was kept (or whose voice is gone from the view) fall back to the first.
      const inVoice = playStart.voice == null ? -1 : hits.findIndex((i) => ordered[i].voice === playStart.voice);
      const idx = inVoice >= 0 ? hits[inVoice] : (hits.length ? hits[0] : -1);
      if (idx < 0) return null;
      const selected = ordered.slice(idx);   // clicked note → end of the drawn view
      const range = rangeFromSelected(selected);
      if (!range) return null;
      const startOrder = ordered[idx].order;
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
    // Recolor every rendered notehead whose (measure, midi) matches one of `marks`
    // ([{ measure, midi }]) — used to make a segment-embellishment variation's ADDED notes stand out
    // in the dedicated variation renderer. Does NOT clear prior highlights (composes with others).
    // Match-by (measure,midi) is intentionally simple: decorations are typically unique pitches in the
    // bar, so coloring all same-midi matches in the measure is acceptable. Returns the count colored.
    // No-op (0) without a DOM / rendered graphic, like the other highlight methods.
    highlightExtraNotes(marks, color = '#C62828') {
      extraNoteMarks = (marks && marks.length) ? { marks, color } : null;
      return applyExtraNoteHighlight();
    },
    // Recolor exactly the notes that form a matched chord `name` (search-normalised or raw) within
    // its measure span [from,to], in chord yellow. Replaces any prior highlight. Returns the notes
    // (so the caller can tell whether anything lit up). Powers the clickable matched-chord chips.
    highlightMatchedChord(name, range) {
      const chord = chordByAnyName(name);
      if (!chord) { clearHighlight(); return []; }
      // `range` arrives in the detail's sequential numbering; renderedNotesByMeasure is keyed by the
      // printed number, so pass measureOffset to realign (matters on pickup pieces).
      const notes = chordToneNotesInMeasures(renderedNotesByMeasure(), chord.notes, range, measureOffset);
      highlightChord(notes);
      return notes;
    },
    // Shade a captured measure range [from,to] behind the notes; persists across re-renders
    // (zoom / segment changes) until cleared. Used to mark a vocab item's original measures.
    highlightMeasures(range) { measureHighlight = (range && range.length === 2) ? [range[0], range[1]] : null; applyMeasureHighlight(); },
    clearMeasureHighlight() { measureHighlight = null; applyMeasureHighlight(); },
    // Detected phrases of the drawn sheet, in order of first appearance:
    // { bars, offset, phrases:[{name,color,count,occurrences,ranges,label}] }. Pure read — nothing on
    // the sheet changes until one of them is handed to shadePhrase.
    detectPhrases(opts = {}) { return autoDetectPhrases(opts); },
    // Shade every bar of one detected phrase in its family colour (its first statement stronger, its
    // modified returns lighter). Replaces any previous phrase shading; a falsy phrase just clears.
    // Independent of the motif / phrase / rhythm note colouring — this is a background band, so it
    // survives (and reads under) whatever owns the noteheads.
    shadePhrase(phrase) { phraseBandList = phraseBandsModel(phrase); applyMeasureHighlight(); },
    clearPhraseShade() { phraseBandList = []; applyMeasureHighlight(); },
    // Shade one arbitrary bar range as a single block — a stretch of bars named outright rather than found
    // by the detector, which is what a script's inBars(9-16) is. Shares the phrase-band channel on
    // purpose: "the bars this step is about" is one idea, so naming a new stretch REPLACES the last one
    // instead of layering another wash over it. A falsy or unparseable range clears.
    shadeBars(range, { fill = '#1565c0', opacity = 0.16, badge = '' } = {}) {
      const a = range ? Number(range[0]) : NaN;
      const b = range ? Number(range.length > 1 ? range[1] : range[0]) : NaN;
      phraseBandList = (Number.isFinite(a) && Number.isFinite(b))
        ? [{ from: Math.min(a, b), to: Math.max(a, b), fill, opacity, badge, changed: [] }]
        : [];
      applyMeasureHighlight();
    },
    // Note ids [{measure,midi,beats}] of every drawn note in a printed-measure range — the play-set for
    // one occurrence of a detected phrase. Empty when those bars aren't on the drawn sheet.
    barRangeNoteIds(from, to) { return noteIdsInBarRange(from, to); },
    // Shade the current fretboard step's measures in a distinct blue band (echoing the fretboard
    // dots), independent of the vocab-range highlight. Tracks stepping; persists across re-renders.
    highlightStepMeasures(range) { stepHighlight = (range && range.length === 2) ? [range[0], range[1]] : null; applyMeasureHighlight(); },
    clearStepHighlight() { stepHighlight = null; applyMeasureHighlight(); },
    // Position the OSMD cursor at an absolute onset beat (quarter-beats from the score start — the same
    // scale as a schedule event's `beat`) and show it. Lets the sheet cursor follow fretboard stepping:
    // reset, then step forward to the first entry at/after `beat`. No-op if the cursor isn't ready yet.
    showCursorAtBeat(beat) { positionCursorAtBeat(beat); },
    hideCursor() { try { const c = osmd.cursor; if (c) { c.reset(); c.hide(); } } catch (_) {} },
    // Bring the play cursor into view, scrolling whichever box actually scrolls: the preview pane on
    // mobile (it is the fixed, overflow:auto dialog) or the page itself on desktop. Returns true only
    // when it moved something, so callers can tell "followed" from "already visible". Silent on any
    // failure — this runs inside the playback draw callback and must never break it.
    scrollCursorIntoView() {
      let el = null;
      try {
        const c = osmd.cursor;
        el = c && (c.cursorElement || (c.cursorElements && c.cursorElements[0]));
      } catch (_) { return false; }
      if (!el || !el.getBoundingClientRect) return false;
      const r = el.getBoundingClientRect();
      if (!r || (!r.height && !r.width)) return false;   // hidden cursor has no box
      let box = el.parentElement;
      while (box) {
        const cs = (typeof getComputedStyle === 'function') ? getComputedStyle(box) : null;
        if (cs && /(auto|scroll)/.test(cs.overflowY) && box.scrollHeight > box.clientHeight + 1) break;
        box = box.parentElement;
      }
      if (box) {
        const b = box.getBoundingClientRect();
        const next = followScrollTop({
          cursorTop: (r.top - b.top) + box.scrollTop,
          cursorBottom: (r.bottom - b.top) + box.scrollTop,
          scrollTop: box.scrollTop, viewHeight: box.clientHeight, contentHeight: box.scrollHeight,
        });
        if (next == null) return false;
        try { box.scrollTo({ top: next, behavior: 'smooth' }); } catch (_) { box.scrollTop = next; }
        return true;
      }
      if (typeof window === 'undefined') return false;
      const y = window.scrollY || 0;
      const doc = document.documentElement;
      const next = followScrollTop({
        cursorTop: r.top + y, cursorBottom: r.bottom + y, scrollTop: y,
        viewHeight: window.innerHeight, contentHeight: doc ? doc.scrollHeight : 0,
      });
      if (next == null) return false;
      try { window.scrollTo({ top: next, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, next); }
      return true;
    },
    applyResponsiveZoom(viewportWidth) { setZoom(responsiveZoom(viewportWidth)); }
  };
}
