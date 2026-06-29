# Guitar Fretboard Movement Visualizer — Design

**Date:** 2026-06-24
**Branch context:** music study app (`public/music.html`)
**Status:** Design — awaiting implementation plan

## Goal

Inside the music study app, take a sequence of chord note-sets — from the
auto-guessed chords on the score, or from a chord-window selection — and
visualize, step by step, where those notes sit on a guitar fretboard. The
point is to *see the movement*: for a progression like A_Time_For_Us
m3–14 (`Bm · C · G · Am · Em · Bm · C · Am · Bm · Em · Em · Em`), show one
coherent way to play the whole thing across the neck, animate through it,
and let the user compare alternative ways.

## Vocabulary

- **Note-set** — the pitch classes for one step (e.g. `{B, D, F#}` for Bm).
- **Step** — one note-set, shown as one fretboard frame. A sequence of steps
  is what we animate.
- **Voicing / shape** — one playable way to finger a note-set: a set of
  `{string, fret}` positions, one per string used. A note-set has several.
- **Path** — a choice of *one voicing per step* across the whole sequence,
  picked to minimize hand movement. Several paths exist; the user selects one.
- **Trail** — the cumulative fade: the current step is bright, each earlier
  step is drawn progressively fainter so movement is visible at a glance.

## User-facing behavior

A collapsible **Fretboard** panel lives under the score in the preview area.

1. **Source** toggle: *Guessed chords* | *Chord window*.
   - *Guessed chords* → the ordered per-measure chords already detected on the
     score become the step sequence (one step per measure that has a chord).
   - *Chord window* → the currently selected window's note-set is captured as
     **one step**, appended to the sequence. Slide the window and capture again
     to build a custom sequence note-set by note-set.
2. **Include suppressed** checkbox (default off): suppressed notes are excluded
   from each note-set unless this is on.
3. **Capture → fretboard** button: (re)builds the step sequence from the chosen
   source, computes voicings and paths, and renders step 1.
4. **Ways to play** selectbox: lists the ranked paths (least-movement first).
   Selecting one re-drives the animation.
5. **Step controls**: ◀ Prev / Next ▶, a step counter (`3 / 12 — G`), ▶ Play
   with a speed slider (auto-advance), and a per-chord **shape cycler**
   (`◀ 1 / 4 ▶`) that swaps just the current step's voicing within the path.
6. **Fretboard**: horizontal neck, nut on the left, high-E string on top
   (standard tab orientation, matches the existing guitar code). Dots show
   `{string, fret}`; the dot label is the fret number. The current step is
   bright; earlier steps are dimmed along the trail.

Standard EADGBE tuning is assumed (no tuning UI in this version).

## Architecture

Four units, each with one responsibility. The first two are pure and
unit-tested; the renderer is a thin DOM writer; the panel is the controller.

```
music.html  ──init──▶  fretboard-panel.js  ──reads──▶  music-render.js (renderer instance)
                              │   getGuessedChordSequence({includeSuppressed})
                              │   getWindowNoteSet({includeSuppressed})
                              ▼
                       fretboard-core.js   (pure: voicings + path-finding)
                              ▼
                       fretboard-render.js (pure-ish: draws SVG fretboard)
```

### `public/fretboard-core.js` — new, pure

Ported and trimmed from `guitar.js` (which is jQuery/DOM-coupled). No DOM, no
jQuery — just data in, data out. Unit-tested.

- `STANDARD_TUNING` — the per-string fret→note-name and fret→octave tables for
  strings 1–6 (high-E=1 … low-E=6), copied from `guitar.js` `defaultSet.notes`
  / `defaultSet.octaves` (13 frets, 0–12).
- `findPositions(noteName, octave?)` → `[{string, fret, octave}]` — every place
  that pitch class (optionally a specific octave) appears on the neck. Ports
  `findNoteOnFretboard`; equality is enharmonic (reuse `equalNotes` logic).
- `isPlayable(posA, posB)` — `true` if either fret is 0 (open) or `|fretA −
  fretB| ≤ 3`. Ported verbatim.
- `voicingsForNotes(noteNames)` → `[voicing]` where `voicing = [{string,fret}]`
  — cartesian product of each note's positions, filtered so every pair is
  `isPlayable`, every string is used at most once, and all note-set members are
  covered. Ports `usefulChords`. De-duplicated.
- `voicingCenter(voicing)` → mean fret of fretted (non-zero) positions
  (0 if all open); `voicingSpan(voicing)` → max−min fretted fret. Used for
  movement cost.
- `findPaths(stepVoicings, { beamWidth = 12, maxPaths = 5 })` →
  `[{ voicings: [voicingPerStep], cost, label }]` — beam search across steps.
  At each step extend each surviving partial path by every voicing of that
  step, scoring the added move as `|voicingCenter(next) − voicingCenter(prev)|`;
  keep the `beamWidth` cheapest partials. Return up to `maxPaths` complete paths
  that are *distinct by neck region* (dedupe paths whose rounded mean center is
  equal), ranked by total `cost` ascending. `label` is a human summary derived
  from the path's mean center (e.g. `open / low position`, `barre ~fret 2`,
  `up the neck ~fret 7`) plus a movement sparkline string.
  - If a step's note-set has **no** playable voicing, that step contributes an
    empty frame (drawn as "no playable shape") and is skipped in cost; the path
    still proceeds. This is logged, never silently dropped.

### `public/fretboard-render.js` — new

One job: draw a fretboard SVG. No state, no event wiring.

- `renderFretboard(svgEl, { trail })` where `trail = [{ voicing, age }]` and
  `age` is 0 for the current step, increasing for older steps. Draws: the neck
  background, 6 horizontal string lines (high-E top), vertical fret lines + a
  nut, fret-number axis, and a dot per `{string, fret}` in each trail entry.
  Dot opacity = `Math.max(MIN_OPACITY, 1 − age * FADE_STEP)` (current=1.0, then
  fades); open notes render in the open column left of the nut. Clears and
  redraws on every call (idempotent).
- Pure-ish: only writes into the passed `svgEl`; no globals, easy to call from
  tests with a jsdom SVG node for structural assertions.

### `public/fretboard-panel.js` — new

The controller. Holds panel state and wires everything.

State: `{ source, includeSuppressed, steps, paths, selectedPathIdx,
stepIdx, perStepOverride (Map stepIdx→voicingIdx), playing, speed }`.

- `init(renderer, dom)` — `renderer` is the `createMusicRenderer` instance;
  `dom` is the panel's elements. Wires the source toggle, suppressed checkbox,
  Capture button, path selectbox, step buttons, play/speed, and shape cycler.
- **Capture**: reads the note-set sequence from the renderer
  (`getGuessedChordSequence` or `getWindowNoteSet`, passing
  `includeSuppressed`), maps each note-set to its `noteNames`, calls
  `voicingsForNotes` per step, then `findPaths` over the per-step voicing lists.
  Populates the selectbox, resets `stepIdx`/overrides, renders step 0.
- **currentTrail()**: for the selected path, builds `[{voicing, age}]` from step
  `0..stepIdx`, applying any `perStepOverride`, with `age = stepIdx − i`.
- **Stepping**: Prev/Next adjust `stepIdx` and re-render; Play sets an interval
  (cleared on pause / Capture / panel close) advancing `stepIdx`, stopping at
  the end; speed slider sets the interval ms.
- **Shape cycler**: ◀▶ change `perStepOverride[stepIdx]` modulo that step's
  voicing count and re-render the current trail.

### `public/music-render.js` — modified

Add read-only accessors to the object returned by `createMusicRenderer` so the
panel never reaches into the score DOM or re-derives suppression:

- `getGuessedChordSequence({ includeSuppressed = false } = {})` →
  `[{ measure, name, noteNames }]` in measure order. Internally reuses
  `measureChordAreas` across all systems (concatenated in reading order), taking
  each measure's **top** chord; `noteNames` are the chord's pitch-class names
  with suppressed notes filtered out unless `includeSuppressed`. (Suppression
  filtering reuses the existing `mutedList()` / `suppressionKey` machinery.)
- `getWindowNoteSet({ includeSuppressed = false } = {})` →
  `{ measureRange, noteNames }` for the current chord-window selection (the
  distinct pitch classes of the selected notes, suppressed filtered as above),
  or `null` when no window is active.

No behavior change to existing rendering; these are additive getters.

### `public/music.html` — modified

- Add a collapsible `<details id="fretboardPanel">` inside `#musicPreview`,
  below the score container, with the DOM from the mockup (source chips,
  include-suppressed checkbox, Capture button, "Ways to play" selectbox, step
  controls, and an `<svg id="fretboardSvg">`).
- Import `fretboard-panel.js` and call `init(renderer, dom)` once the renderer
  for a piece exists.

## Data flow (one capture, Guessed-chords source)

1. User opens the panel, leaves source on *Guessed chords*, clicks Capture.
2. Panel calls `renderer.getGuessedChordSequence({ includeSuppressed:false })`
   → `[{measure:3,name:'Bmin',noteNames:['B','D','F#']}, …]` (12 steps).
3. Panel maps to per-step voicing lists via `voicingsForNotes`.
4. Panel calls `findPaths(stepVoicings)` → up to 5 ranked paths; fills selectbox.
5. Panel renders step 0 of path 0 (trail = just the first chord, bright).
6. Next ▶ advances; trail grows with earlier chords fading. Selecting another
   path or cycling a shape re-renders from current state.

## Edge cases & error handling

- **No source data** (no guessed chords / no window): Capture shows an inline
  message in the panel ("No chords to capture — guess chords or select a window
  first"); nothing else changes.
- **Note-set with no playable voicing**: that step renders an empty fretboard
  frame labeled "no playable shape"; path-finding skips it for cost (see
  `findPaths`). Logged.
- **Single-step sequence** (typical chord-window capture): `findPaths` returns
  one path per distinct voicing region; stepping is a no-op but the shape cycler
  still lets the user browse all voicings of that one note-set.
- **Enharmonic / spelling**: position lookup uses the same enharmonic equality
  as `guitar.js`/`music-chords.js` so `Bb` and `A#` resolve to the same frets.
- **Suppression toggled while captured**: changing the checkbox does not
  retroactively edit a capture; the user re-clicks Capture to apply it (kept
  simple; the button is the single rebuild trigger).
- **Panel closed mid-play**: the play interval is cleared on `<details>` toggle
  to closed.

## Testing

- `fretboard-core.test.js` (Jest, pure):
  - `findPositions('E')` includes open high-E (`{string:1,fret:0}`) and low-E.
  - `voicingsForNotes(['C','E','G'])` yields known open-C shape `x32010`-style
    positions and rejects unplayable spreads (pairwise > 3 frets, no open).
  - `voicingsForNotes` never reuses a string and always covers all note-set
    members.
  - `findPaths` over a 3-step toy sequence returns paths ranked by ascending
    movement cost, capped at `maxPaths`, distinct by region.
  - A step with an impossible note-set produces an empty frame without throwing.
- `fretboard-render.test.js` (jsdom): `renderFretboard` into an SVG node draws 6
  string lines and one dot circle per position; older-age dots get lower
  opacity than the current step.
- `music-render` accessor tests: `getGuessedChordSequence` returns measures in
  order with suppressed notes excluded by default and included when toggled;
  `getWindowNoteSet` returns the selection's distinct pitch classes or `null`.
- Panel controller logic that is non-trivial (trail building, shape-cycler
  modulo, path selection) extracted as pure helpers and unit-tested; DOM wiring
  verified manually in the browser per the app's convention.

Per the project's testing-economy guidance: pin the real behaviors above; skip
trivial getter/DOM-attribute coverage.

## Out of scope (YAGNI)

- Alternate tunings / capo.
- Fingering (which finger), barre detection beyond the movement heuristic.
- Audio playback of the fretboard shapes (the score already plays).
- Persisting captured paths to vocab/storage.
- Left-handed orientation.

## Reuse note

`guitar.js` stays untouched; we port the three algorithms we need
(`findNoteOnFretboard`, `usefulChords`, `isPlayable`) into the pure
`fretboard-core.js` rather than depend on its jQuery/`.guitar-neck` renderer.
The new SVG renderer is written fresh to match the music app's overlay style.
