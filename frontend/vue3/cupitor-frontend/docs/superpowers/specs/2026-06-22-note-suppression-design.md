# Note Suppression in Vocabulary Items — Design

**Date:** 2026-06-22
**Status:** Approved (design); ready for implementation plan
**Branch:** `music-study-app`

## Goal

Let the user mark specific notes in a vocabulary item as **suppressed** so they can
practice chords: a suppressed note is **dimmed** in the score and **silenced** during
playback. A non-persisted **"Hear all"** toggle temporarily restores every suppressed
note (un-dims + un-mutes) so the user can check themselves, then hide them again — without
losing the saved suppression set.

This applies only when a vocabulary item is open (not in plain piece preview).

## Scope

In scope:
- Per-note selection by clicking noteheads (toggle suppressed/restored).
- A "suppress this voice" shortcut (bulk add/remove all of a voice's notes in the segment).
- Visual dimming of suppressed noteheads (+ their stems).
- Muting suppressed notes during playback while keeping cursor/timing correct.
- A temporary "Hear all" restore toggle (transient, not saved).
- Persisting the suppression set on the vocab entry.

Out of scope (YAGNI):
- Suppression in plain piece preview (only vocab items).
- Suppression by pitch-class or by arbitrary rules.
- Per-note temporary restore (the restore toggle is global only).
- Migrating existing vocab entries (absence of the field == empty set).

## Note Identity (the core decision)

A suppressed note is identified by the tuple **`(measure, midi, beats)`**:
- `measure` — sequential measure number (the app's internal numbering, pickup = 1), the
  same value already stored as `measureStart`/`measureEnd`.
- `midi` — MIDI pitch number.
- `beats` — onset in quarter-note beats from the piece start.

This is the **same `onsetBeats`/`beats` scale the chord window already uses** for
note-accurate sub-measure playback (renderer `getWindowRange().fromBeat/toBeat` vs player
`event.beats`), which is confirmed working — so the renderer (where notes are selected) and
the player (where notes are muted) agree on identity without a brittle index map.

Matching uses a small float epsilon on `beats` (`EPS = 1e-6`, matching the player's existing
beat-range filter). A note matches a stored suppression iff same `measure`, same `midi`, and
`|beats − onset| < EPS`.

Key string for set membership / dedupe: `` `${measure}:${midi}:${beats.toFixed(6)}` ``.

Rejected alternatives:
- `(measure, idx)` rendered reading-order index — the player has no `idx`; would need a
  fragile index↔event map.
- Voice-level-only identity — user wants per-note clicking; "suppress voice" is instead
  implemented as a bulk expansion into per-note identities (one model, not two).

## Data Model

`buildVocabEntry(...)` gains a `suppressed = []` parameter, stored as field `suppressed`:

```js
suppressed: [ { measure: <int>, midi: <int>, beats: <number> }, ... ]
```

- Defaults to `[]`.
- Persists with the entry in `vocab.json` exactly like the other fields (saved + pushed only
  on explicit Add/update, per existing convention — chord/note auto-edits never push).
- Old entries without the field load as an empty set (no migration).

## Components & Responsibilities

### `public/music-vocab.js` (pure, persisted shape)
- `buildVocabEntry`: add `suppressed = []` → entry field `suppressed`.
- No other changes; save/load already serialize the whole entry.

### `public/music-render.js` (visual + selection)
State (module-closure, like `dimConnectors`):
- `suppressedNotes: Set<string>` — keys `${measure}:${midi}:${beats6}`.
- `suppressionActive: boolean` — when false (Hear-all on), do not dim.
- `suppressMode: boolean` — when true, notehead clicks toggle suppression.

Note tagging: extend the rendered-note model so each note carries `midi` and `voice`
(both already derivable from OSMD — `midi` is used for voice coloring; `voice` from the
note's parent voice). Needed for matching and for voice expansion.

Passes / behavior:
- `applySuppressionDim()` — runs inside `postRender()` (so it survives OSMD re-renders, like
  `applyDimConnectors`). When `suppressionActive`, grey each notehead (+ its stem) whose
  `(measure,midi,beats)` key ∈ `suppressedNotes`. Uses the existing dim grey.
- Notehead click handler (active only when `suppressMode`): toggle that note's key in the
  set, re-dim, and fire `onSuppressChange([...list])`.
- `suppressVoice(voiceId, on)` — add/remove all rendered notes of that voice in the current
  view; fire `onSuppressChange`.

Pure helpers (unit-tested), exported:
- `suppressionKey({measure, midi, beats})` → string.
- `notesOfVoice(notes, voiceId)` → identity list (used by `suppressVoice`).

API additions on the renderer object:
- `setSuppressedNotes(list)` / `getSuppressedNotes()` (returns `[{measure,midi,beats}]`).
- `setSuppressMode(on)`.
- `setSuppressionActive(on)`.
- `suppressVoice(voiceId, on)`.
- `listVoices()` → `[{ id, color }]` present in the current view (to build the voice chips).

`onSuppressChange` is a new constructor callback (alongside `onChordSelect`,
`onWindowChange`).

### `public/music-player.js` (muting)
- `setSuppressed(list)` — store the suppression set.
- `setSuppressionActive(on)` — when false, ignore suppression (Hear-all).
- In `buildPart`: an event matching the set (when active) is **not** triggered on the synth
  (`triggerAttackRelease` skipped) but **keeps its `_step`/`_first`** so the OSMD cursor and
  Transport timing are unaffected — a fully-muted beat still advances the cursor.

Pure helper (unit-tested), exported:
- `isSuppressed(event, set)` → boolean — `(measure,midi,beats)` match with `EPS`.

### `public/music.html` (UI glue)
Shown only when `currentVocabEntry` is set:
- **🔇 "Suppress" toggle** — enters/exits suppress edit-mode (`renderer.setSuppressMode`).
  While on, a row of **voice chips** appears (from `renderer.listVoices()`), colored to match
  voice colors. A chip toggles its voice: if **every** rendered note of that voice is already
  suppressed, the chip restores them (`suppressVoice(id, false)`); otherwise it suppresses the
  whole voice (`suppressVoice(id, true)`). The chip shows an active/lit state when its voice is
  fully suppressed, mirroring the existing toggle buttons.
- **👂 "Hear all" toggle** — transient; flips `renderer.setSuppressionActive` and
  `player.setSuppressionActive`. Not saved.
- Wiring:
  - `onSuppressChange(list)` → `player.setSuppressed(list)` and update any count label.
  - `openVocabEntry` → `renderer.setSuppressedNotes(entry.suppressed||[])`,
    `player.setSuppressed(entry.suppressed||[])`, reset Hear-all to off, suppress-mode off.
  - Add/update vocab → include `renderer.getSuppressedNotes()` as `suppressed` in the entry.
  - On close / opening a plain preview → clear suppression state (mode off, set empty,
    active true).

## Data Flow

```
click notehead (suppress mode)         voice chip click
        │                                     │
        ▼                                     ▼
renderer toggles set ───────────► onSuppressChange(list)
        │                                     │
        ▼                                     ▼
applySuppressionDim (postRender)      player.setSuppressed(list)
        │                                     │
   dims noteheads                       buildPart skips synth trigger
                                        (keeps cursor step)

Add/update vocab → entry.suppressed = renderer.getSuppressedNotes() → vocab.json (push)
openVocabEntry  → renderer.setSuppressedNotes + player.setSuppressed from entry.suppressed
Hear-all toggle → renderer.setSuppressionActive(off) + player.setSuppressionActive(off)
```

## Error Handling / Edge Cases

- **Note not currently rendered** (segment changed): its key simply doesn't match any
  notehead → not dimmed, harmlessly retained in the set.
- **Unison across voices** (same midi + same onset in two voices): both match and are
  suppressed together. Acceptable — they are "that pitch at that time."
- **Fully-muted beat**: cursor still advances (events keep `_step`).
- **Hear-all on while editing**: dims are hidden but the set is unchanged; clicks still edit
  the set (the underlying selection is independent of the active flag). Restoring Hear-all
  off shows the current set.
- **Missing `midi`/`voice`** on a note (rests, unpitched): excluded from selection and
  matching.

## Testing

Pure cores (unit, Jest):
- `music-vocab.test.js`: `buildVocabEntry` includes `suppressed` (default `[]`; round-trips a
  provided list).
- `music-render.test.js`: `suppressionKey` formatting; `notesOfVoice` returns the right
  identities for a given voice.
- `music-player.test.js`: `isSuppressed` matches on `(measure,midi,beats)` with `EPS` and
  rejects near-misses; a schedule built with a suppressed event marks it muted while
  retaining its cursor step.

Browser-verified (cannot unit-test SVG/audio):
- Clicking noteheads in suppress mode dims/restores them.
- Voice chips bulk-suppress/restore a voice.
- Playback actually silences suppressed notes; cursor still tracks.
- "Hear all" restores audio + visuals temporarily; toggling back re-applies.
- Save/reopen round-trips the suppression set.
```
