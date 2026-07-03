# Tag pattern search — design

Date: 2026-06-29
Branch: music-study-app
Files: `public/music-pattern.js` (new), `public/music-render.js`, `public/music.html` (+ tests)

## Goal

With pattern tags selected (e.g. T1, T2), find *other* occurrences of each tag's note sequence on
the currently-rendered sheet — matched by **intervals**, **note durations**, or **both** — and
highlight every match in that tag's color. Search is limited to the open sheet (Preview or vocab
item); no cross-piece search.

## Decisions (from brainstorming)

- **Per tag:** each selected tag is searched independently; results reported per tag.
- **Modes:** Intervals / Duration / Both (user-selected). Duration has an **Exact ↔ Proportional**
  toggle.
- **Non-contiguous, gap-structure–preserving:** the count of intervening (untagged) notes between
  consecutive tagged notes is part of the pattern. If T1 = n1, x, y, n2 (two untagged notes
  between), a match n1′…n2′ must also have exactly two notes between them.
- **Results:** highlight every match on the sheet, colored by the matched tag; show a per-tag count.

## Components

### 1. Pure matcher — `public/music-pattern.js` (new)

No DOM. Operates on plain arrays so it is fully unit-testable.

- `extractTemplate(taggedIdx, midis, durs)` — `taggedIdx` is the ascending stream indices of one
  tag's notes (length ≥ 2). `midis`/`durs` are the full stream's per-note arrays. Returns:
  - `start` = `taggedIdx[0]` (the original occurrence's start, excluded from matches).
  - `offsets[j]` = `taggedIdx[j] − taggedIdx[0]` (encodes the gap structure; `offsets[0] = 0`).
  - `intervals[j]` = `midis[taggedIdx[j+1]] − midis[taggedIdx[j]]` (length k−1).
  - `durations[j]` = `durs[taggedIdx[j]]` (length k).
- `findMatches(midis, durs, template, { mode, durationStrict })` — slides `s` from 0 to
  `n − 1 − offsets[last]`. For each `s` (skip `s === template.start`), the candidate positions are
  `pos[j] = s + offsets[j]`. It is a match when, per `mode`:
  - **intervals**: for all j, `midis[pos[j+1]] − midis[pos[j]] === intervals[j]` (transposition-
    invariant, exact semitones).
  - **duration**: `durationStrict` → `|durs[pos[j]] − durations[j]| < EPS` for all j (exact note
    types). Else **proportional** → `durs[pos[j]] * durations[0] ≈ durations[j] * durs[pos[0]]`
    for all j (scale-invariant; augmentation/diminution matches).
  - **both**: intervals AND duration tests.
  Returns an array of matches, each match = `offsets.map((o) => s + o)` (the matched-note stream
  indices at the tagged positions — the wildcards in between are not returned). Cost O(n·k).

`mode` ∈ `'intervals' | 'duration' | 'both'`. A pattern shorter than 2 notes yields `[]`.

### 2. Renderer — `public/music-render.js`

- **Thread durations.** At note extraction ([music-render.js:528](public/music-render.js#L528)),
  capture `durBeats` from `sourceNote.Length` (`Length.RealValue * 4` → quarter-beats, null-guarded)
  and carry it through `orderedRenderedNotes()` so each ordered note has `{ …, midi, onsetBeats,
  durBeats }`.
- **Generalize highlight color.** Extract `highlightNotes(notes, color)` from `highlightChord`
  (same `data-chord-orig` save + inline-style override; does NOT call `clearHighlight` so groups
  accumulate). `highlightChord(notes)` becomes `highlightNotes(notes, CHORD_HL_COLOR)`.
- **New API** `searchTagPatterns({ mode, durationStrict })`:
  1. `clearHighlight()` once.
  2. Build the ordered stream once: `midis[]`, `durs[]`, and the note objects (for `el`).
  3. For each *checked* filter tag (`filterTags`): map its assignment notes to stream indices via
     `(midi, onsetBeats)` match, keep those found, sort ascending → `taggedIdx`. If `< 2`, record
     count 0 and continue.
  4. `extractTemplate` → `findMatches` → for each match, `highlightNotes(matchedEls, tagColor)`.
  5. Return `[{ name, color, count }]` (color from the tag registry).
  - `mode`/`durationStrict` are passed straight to the matcher.

### 3. Page glue — `public/music.html`

In the tag panel, next to the existing tag controls:
- **🔎 Find pattern** button.
- A mode `<select id="patMode">`: Intervals / Duration / Both.
- An **Exact ↔ Proportional** toggle (`<input type="checkbox" id="patProportional">`, labelled),
  meaningful only when the mode involves duration (left enabled regardless; ignored in intervals
  mode).
- On click → `searchTagPatterns({ mode, durationStrict: !proportional })`; render the per-tag
  result in `transportMsg` (or a small status line) as `T1: 3 · T2: 1`, each name in its color.
  A second click re-runs; switching pieces / closing preview clears via the existing render reset.
- Guards: non-MusicXML piece → "Pattern search needs a MusicXML piece"; no tag checked → "Check a
  tag to search"; tag with < 2 visible notes → counted as 0 (noted in the message).

## Error handling / edge cases

- Tagged notes outside the rendered window can't be located → only the visible ones form the
  template; if < 2 remain, that tag is skipped (count 0).
- Chords / same-onset notes: located by `(midi, onsetBeats)`; ties resolve to the first match.
- Overlapping matches are allowed and all reported.
- Re-running replaces the previous highlight (`clearHighlight` at the start).

## Testing

- `public/music-pattern.test.js`
  - `extractTemplate`: offsets capture gap structure; intervals/durations correct.
  - `findMatches` intervals: finds a transposed recurrence; respects gap spacing (a hit with the
    wrong number of intervening notes is rejected); excludes the original (`start`).
  - `findMatches` duration: exact rejects an augmentation; proportional accepts it.
  - `findMatches` both: requires intervals AND durations.
  - pattern length < 2 → `[]`.

## Addendum: key-interval (diatonic) matching

An option to match by **scale-degree intervals** instead of literal semitone intervals. In Em,
E-G-F# (degrees 1-3-2 → steps [+2,−1]) matches C-E-D (also [+2,−1]); a major third matches a minor
third because both are "a third".

**Key insight:** the degree *difference* between two in-scale notes is invariant to which tonic is
chosen within the same 7-note collection (verified: E-G-F# vs C-E-D give identical step patterns
under Em or G major). So matching depends only on the **scale collection** (key signature); the
tonic is cosmetic.

- `music-pattern.js` (new pure helpers; matcher unchanged — for key mode the caller passes the
  degree array in place of the midi array):
  - `MAJOR_SCALE = [0,2,4,5,7,9,11]`, `MINOR_SCALE = [0,2,3,5,7,8,10]` (natural minor).
  - `guessKey(pcCounts)` → `{ tonicPc, mode }` via Krumhansl-Schmuckler profiles correlated with the
    12-bin pitch-class histogram.
  - `degreeIndex(midi, tonicPc, scaleSemis)` → monotonic diatonic index = `7*oct + countBelow`,
    where `oct/within` come from `midi − tonicPc` and `countBelow` = scale tones ≤ `within`. In-scale
    notes get integer degrees whose diffs are diatonic steps; out-of-scale notes snap to the degree
    just below. Returns `null` for null midi.
  - `keyLabel(tonicPc, mode)` → e.g. "E minor".
- `music-render.js`: `searchTagPatterns({ mode, durationStrict, intervalBasis, key })`. When
  `intervalBasis === 'diatonic'` and mode involves intervals, the interval basis array is
  `ordered.map((n) => degreeIndex(n.midi, tonic, scale))`; `key` is the chosen `{tonicPc, mode}` or
  `null` → `guessKey` over the rendered pitch classes. `'chromatic'` (default) uses raw midis.
  Returns `{ results, keyLabel }` (`keyLabel` null when chromatic).
- `music.html`: a **chromatic ↔ diatonic** toggle (`<select id="patIntervalBasis">` with options
  `chromatic` / `diatonic`) + a **key** `<select>` (`auto (best guess)` + 24 keys, relevant only in
  diatonic mode). On `auto`, the result line shows the resolved key, e.g.
  `key: E minor — T1: 3 · T2: 1`.

**Decided defaults:** minor = natural minor collection; chromatic notes snap to nearest lower scale
degree; `auto` key is the default.

## Out of scope (YAGNI)

- Cross-piece / library-wide search (open sheet only).
- Per-voice stream isolation — the stream is the flattened cross-voice onset order, so on
  polyphonic sheets the gap count includes other-voice notes (acceptable for melodic lines).
- Inversion / retrograde matching.
- Step-through navigation between matches (all highlighted at once).
