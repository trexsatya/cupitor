# Tag skip-playback — design

Date: 2026-06-29
Branch: music-study-app
Files: `public/music-player.js`, `public/music-render.js`, `public/music.html` (+ tests)

## Goal

In `music.html`, add a dedicated **▶ Play tags** button that plays only the notes in the
currently-checked pattern tags, in score order, removing the empty stretches between tagged
passages. A run of tagged notes in measure 1 plays with its natural rhythm; audio and the OSMD
cursor then jump ahead to the next tagged run in measure 3, separated by a short breath.

Example: Tag-1 = {n1, n2, n3} in measure 1, Tag-2 = {n4, n5, n6} in measure 3. Playback =
n1 n2 n3 · (breath) · n4 n5 n6 — measure 2 (and any untagged material) is skipped.

## Decisions (from brainstorming)

- **Timing model:** preserve rhythm within a contiguous tagged run; jump only across gaps that
  contain untagged material.
- **Activation:** a separate **▶ Play tags** button (normal ▶ Play is unaffected).
- **Range:** the button plays across the **whole piece** (no segment/window intersection).
- **Breath gap:** between runs, insert a beat-relative gap (quarter-beats, scales with tempo),
  **user-configurable** via a control in the tag panel, defaulting to **1 beat**.

## Components

### 1. Schedule builder — `public/music-player.js`

Extend `buildScheduleFromMusicXml(xmlString, opts)` with a new option:

- `opts.keepNotes` — `[{ midi, beats }]`. Identities matched the same way `isSuppressed` matches:
  `midi` equal AND `|beats − onset| < 1e-6`. Measure is ignored (pickup-bar safety, consistent
  with the existing suppression matching).

When `keepNotes` is present, after the full event list is built (events carry `beats` = absolute
onset in quarter-beats, `durBeats`, `measure`):

1. Partition events into **kept** (identity ∈ `keepNotes`) and **other**.
2. **Gap compression** over kept events in onset order, via a new exported pure helper
   `compressKeptEvents(kept, others, { breathBeats })` returning events with rewritten onsets
   (in beats), each retaining its original `durBeats` and its original absolute `beats` (see
   cursor note). Rule, walking kept events A → B:
   - `gap = B.onset − (A.onset + A.durBeats)` (A's written end to B's onset).
   - If `gap <= 1e-6` (contiguous/overlapping, e.g. chord or back-to-back) → keep B immediately
     after A (no change).
   - Else, inspect the span `(A.end, B.onset)`:
     - If **no `other` event has an onset inside the span** (empty or rest only) → **preserve**
       the original `gap` (it is part of the passage's rhythm).
     - If **≥1 `other` (untagged) note onset lies in the span** → this is "in between" material to
       skip → place B at `A.end + breathBeats` (the breath gap).
   - The very first kept note starts the output timeline at 0.
3. `breathBeats` is passed through from `opts.breathBeats` (the UI control), defaulting to `1`
   when unset/invalid.
4. Map kept events to schedule items exactly as the normal path does: `time = compressedOnset
   * spb`, `duration = durBeats * spb`, and **`beat` = the ORIGINAL absolute onset** (NOT the
   compressed value). Re-zero `time` so the segment starts at 0s (already done downstream).

`keepNotes` is mutually exclusive with `mutedNotes` in practice (the Play-tags path passes only
`keepNotes`); if both are passed, `keepNotes` filtering wins and muting is not applied.

**Why `beat` stays absolute:** the OSMD cursor is driven by `advanceCursorToBeat(cursor, beat)`,
which steps the cursor FORWARD to the note's true score position. Leaving `beat` at the original
absolute onset means the cursor jumps across skipped measures for free — no new cursor code. Only
the audio `time` axis is compressed.

`scheduleEnd` over the compressed schedule gives the correct loop boundary automatically.

### 2. Renderer — `public/music-render.js`

Add to the returned API:

- `getFilterNotes()` → merged, onset-sorted note identities `[{ measure, midi, beats }]` for the
  currently-checked filter tags (`filterTags ∩ assignments`). Reuses existing `assignments` and
  `filterTags`; de-duplicates by `suppressionKey`. Returns `[]` when no tags are checked. No new
  state.

### 3. Page glue — `public/music.html`

- Add a **▶ Play tags** button in `#tagPanel`, next to the Filter toggle.
- Add a **Breath** control next to it: `<input type="number" id="breathBeats" min="0" max="4"
  step="0.25" value="1">` (labelled "breath (beats)"). Read live by `playTags()`; no persistence.
- `playTags()`:
  - If the piece is not MusicXML (`currentDetail.format !== 'musicxml'` or no `source`) →
    `transportMsg` = "Tag playback needs a MusicXML piece"; return. (The note-text builder has no
    real timing — out of scope.)
  - `const keep = renderer.getFilterNotes();`
  - If `!keep.length` → `transportMsg` = "Check a tag to play it"; return.
  - `schedule = buildScheduleFromMusicXml(currentDetail.source, { tempo: currentTempo(),
    keepNotes: keep, breathBeats: <#breathBeats value> })` — no `fromMeasure`/`toMeasure`/window
    (whole piece).
  - If `!schedule.length` → "Nothing to play."; return.
  - `ensurePlayer()`, `setInstrument`, `setSchedule(schedule, { cursorStartStep: 0 })`,
    `setLoop(loopChk.checked)`, `play()`. On success: "Playing N tagged notes".
  - Pause / Stop / Loop reuse the existing transport controls (shared player) unchanged.

## Error handling / edge cases

- No tags checked, or checked tags have no notes in this piece → guarded message, no playback.
- Non-MusicXML piece → guarded message.
- A kept note that is also suppressed: with `keepNotes` only (no `mutedNotes`), it still plays —
  Play-tags intentionally ignores suppression (you asked to hear the tagged pattern).
- Tiny untagged span shorter than the breath: the breath (1 beat) replaces it regardless, so a
  collapsed jump never sounds rushed (acceptable: the breath is an intentional separator).

## Testing

- `public/music-player.test.js`
  - `compressKeptEvents` (pure): preserves a rest-only gap within a run; collapses a gap spanning
    an untagged note to a breath; contiguous notes stay contiguous; first note at 0.
  - `buildScheduleFromMusicXml` with `keepNotes`: keeps only matched identities; output `time`
    axis is compressed with the breath; each item's `beat` equals the ORIGINAL absolute onset;
    durations unchanged; a custom `breathBeats` overrides the default.
- `public/music-render.test.js`
  - `getFilterNotes()` returns the merged, onset-sorted, de-duplicated identities for the checked
    tags; `[]` when none checked.

## Out of scope (YAGNI)

- Segment/chord-window intersection with Play-tags.
- Note-text (non-MusicXML) tag playback.
- Persisting the breath-gap value across reloads (live-read only; resets to 1).
