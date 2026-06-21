# Visual Chord Window — Design

**Date:** 2026-06-21
**Branch:** `music-study-app`
**Files:** `public/music-render.js` (renderer subsystem), `public/music.html` (UI wiring), `public/music-render.test.js` (pure-core tests)

## Goal

A draggable selection window over the rendered staff that captures a contiguous
musical passage — even when it spans a wrapped staff-line break — and shows the
chords guessed for the enclosed notes, with a one-click path to save the
selection (measure range + picked chords) to vocab.

## Selection model

The window is a contiguous range over the rendered notes in **reading/time
order** (measure → onset), NOT a raw pixel box. It is defined by two endpoints:

- `startAnchor` and `endAnchor`, each a **stable musical key** `{ measure, idx }`
  (absolute measure number + 0-based index of the note within that measure, in
  onset order).

The selected set is every rendered note whose reading-order index falls between
the resolved start and end (inclusive). Using reading order — not x — is what
makes a cross-line selection well-defined and keeps chord detection correct:
x resets on each wrapped line, so any x-based grouping would conflate notes from
different lines; reading order is monotonic across line breaks.

## Visual (text-selection style)

Drawn as one translucent rectangle **per system (staff line)** the selection
touches, using the per-system bands from `staffBoxes()` for each rect's height:

- Same line → one rectangle from the start note's left to the end note's right.
- Spans a break → rest of line 1 (start → line end), full intermediate lines,
  line N (line start → end note).

Two drag **handles** are drawn at the true endpoints: a left handle at the start
note's left edge, a right handle at the end note's right edge. Rect fill is a
distinct translucent color from the captured-measure highlight (e.g. `#bcdcff`
at ~0.35 opacity) so they don't visually clash.

## Interaction

- **Drag left handle** → moves `startAnchor` to the nearest note under the
  pointer. **Drag right handle** → moves `endAnchor`. Endpoints snap to whole
  notes (the model is note-based).
- **Drag the middle** (on a rect, not a handle) → slides the whole range through
  reading order by the delta in note-steps, keeping the note count constant; can
  roll across a line break. Clamped so start ≥ first rendered note and
  end ≤ last.
- Live: every pointermove rebuilds the overlay and re-runs the chord readout.
- If `start` resolves after `end` (user drags past), swap so start ≤ end.

### Pointer → note hit-testing

`pointerToNote(clientX, clientY)`:
1. Convert client coords to svg-user space (via the svg's `getScreenCTM().inverse()`).
2. Pick the system band whose vertical range contains/nearest the y
   (`nearestStaffIdx(staffBoxes(), y)`).
3. Among rendered notes in that band, pick the one whose x-center is nearest the
   x. Return its `{ measure, idx }` anchor (and order index).

## Chord readout

The selected notes feed `guessChordAreas(selected, undefined, { ... })`, but each
note's `left` is set to its **reading-order index** before the call, so the
internal x-sort/windowing follows musical order across lines. The returned chord
candidates are surfaced via the `onWindowChange` callback as
`{ chords: [{name, notes}], measureRange: [from,to] }`. (Area x/top are unused
here — the readout is an HTML chip panel, not in-score labels.)

The UI shows the candidates as **selectable chips** (multi-select). Selecting a
chip highlights that chord's notes yellow (`renderer.highlightChord(notes)`) and
adds the name to the window's picked set. The picked set is what capture saves.

## Capture to vocab

A "Capture window → vocab" button:
1. Reads the window's measure range = `[min, max]` absolute measure over the
   selected notes.
2. Sets `#segFrom`/`#segTo` to that range.
3. Sets the renderer's `selectedChords` to the chip picks
   (`renderer.setSelectedChords(picks)`), so `getSelectedChords()` returns them.
4. Invokes the existing Add/update-to-vocab flow (`addVocabBtn` handler), which
   already reads `#segFrom/#segTo`, `#guessSec/#guessEndSec`, `getSelectedChords()`,
   and `#vocabNote`, and does the update-vs-add confirm + local-store write +
   best-effort push.

The saved range stays measure-granular (matches today's vocab schema); the
window's value is precisely choosing which notes/chords inside the view.

## Re-anchoring (persistence across re-renders)

The overlay is part of the `redraw()` sequence (after `applyChordOverlay()`). On
every render it re-resolves both anchors against the freshly-rendered notes:

- `resolveAnchor(ordered, anchor)`: find the note with matching `{measure, idx}`;
  if absent (e.g. the segment changed), clamp to the nearest rendered note by
  `(measure, idx)`. Returns an order index into `ordered`.
- Recompute rectangles/handles and the chord readout from the resolved range.
- Result: **zoom** keeps the same measures so anchors track exactly; **segment /
  Prev-Next** follows the anchored measures while they're rendered, and clamps
  to the nearest rendered note when an endpoint scrolls out of view. The window
  hides only when `active` is false or there are no rendered notes.

## Components / API (music-render.js)

State:
- `chordWindow = { active: false, start: null, end: null }` where `start`/`end`
  are `{ measure, idx }` anchors.

New/changed functions:
- `renderedNotesByMeasure()` — extend each pushed note with `measure` (the
  absolute number) and `idx` (running index within that measure). (Already keyed
  by measure; just attach the keys.)
- `orderedRenderedNotes()` — flatten `renderedNotesByMeasure()` into reading
  order, attaching `order` (global index), `band` (system index via
  `nearestStaffIdx`), and `top/bottom/left/right` in svg space (via `elBand` +
  bbox width). Pure-ish over the DOM; the geometric source.
- `resolveAnchor(ordered, anchor)` — anchor → clamped order index.
- `pointerToNote(ordered, x, y)` — svg-space point → nearest note anchor.
- `applyChordWindow()` — remove old `chord-window-layer`; if active and notes
  exist, resolve range, draw per-band rects + handles, attach pointer handlers,
  compute chords (reading-order `left`), fire `onWindowChange`.
- `setChordWindow(on)` — toggle; on first enable, seed `start`/`end` to a small
  range near the first rendered note (e.g. first note → ~3 notes in); redraw.
- Add `applyChordWindow()` to `redraw()`.
- `opts.onWindowChange(payload)` callback.

Reuses existing: `elBand`, `staffBoxes`, `nearestStaffIdx`, `chordAnchorXY`-style
mapping, `guessChordAreas`, `highlightChord`, `clearHighlight`, `SVG_NS`.

## UI (music.html)

- `#chordWindowChk` checkbox in the view-options row → `renderer.setChordWindow(checked)`.
- `#windowChords` panel: renders the window's chord chips (multi-select) from the
  `onWindowChange` payload; click toggles a pick + highlights notes.
- `#captureWindowBtn` "Capture window → vocab" → performs the capture mapping
  above. Hidden/disabled when the window is inactive or empty.
- The window's chip selection is independent of the in-score Show-Chords overlay
  selection; capture uses the window picks when the window is active.

## Pure core + testing

- `notesInWindow(ordered, startOrder, endOrder)` — pure: returns the inclusive
  slice with start/end normalized (swap if reversed) and clamped to bounds. Unit
  tested (ordering, swap, clamp, empty).
- `clampAnchorIndex(ordered, anchor)` resolution logic where feasible as a pure
  helper over a plain `[{measure, idx}]` list — unit tested for exact match,
  missing-measure clamp, and out-of-range clamp.
- Drag/overlay/hit-testing and OSMD geometry remain browser glue: `node --check`
  + in-browser verification (consistent with the rest of the renderer; jsdom
  can't exercise SVG geometry). Verified by exporting the rendered SVG and
  inspecting window-rect/handle coordinates, as we did for the chord-label fix.

## Out of scope (v1)

- Sub-note / beat-fraction precision (snaps to whole notes).
- Keyboard nudging of handles.
- Persisting the window selection itself to storage (only the captured vocab
  item persists).
- Touch-specific gestures beyond pointer events.
