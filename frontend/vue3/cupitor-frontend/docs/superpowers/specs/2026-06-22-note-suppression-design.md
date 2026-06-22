# Note Suppression in Vocabulary Items — Design

**Date:** 2026-06-22
**Status:** Approved (design); ready for implementation plan
**Branch:** `music-study-app`

## Goal

Let the user mark specific notes in a vocabulary item as **suppressed** so they can
practice chords: a suppressed note is **dimmed** in the score and **silenced** during
playback. Two non-persisted restore controls let the user check themselves without losing
the saved suppression set:
- a global **"Hear all"** toggle that temporarily restores *every* suppressed note, and
- **per-note temporary restore**: clicking a single dimmed note un-dims + un-mutes just that
  one (toggle), to preview a note they keep missing.

Neither restore control changes the saved set.

This applies only when a vocabulary item is open (not in plain piece preview).

## Scope

In scope:
- Per-note selection by clicking noteheads (toggle suppressed/restored).
- A "suppress this voice" shortcut (bulk add/remove all of a voice's notes in the segment).
- Visual dimming of suppressed noteheads (+ their stems).
- Muting suppressed notes during playback while keeping cursor/timing correct.
- A global "Hear all" restore toggle (transient, not saved).
- Per-note temporary restore by clicking a dimmed note (transient, not saved).
- Persisting the suppression set on the vocab entry.

Out of scope (YAGNI):
- Suppression in plain piece preview (only vocab items).
- Suppression by pitch-class or by arbitrary rules.
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

### Interaction Model — three sets

There are three note sets, and what is *currently* silenced/dimmed is computed from them:

- **`S` — suppressed (persisted).** The saved set. Edited only in edit-mode and by voice chips.
- **`T` — temporarily restored (transient).** A subset of `S` the user is previewing per-note.
  Cleared on reopen / segment change / mode reset. Never saved.
- **`H` — Hear-all (transient boolean).** When true, restore everything.

**Effective muted set** (drives both dimming and playback muting):
`muted = H ? [] : (S − T)`.

**Two click semantics on a notehead, selected by edit-mode:**
- **Edit-mode ON** (🔇 lit): click toggles the note in/out of `S` (and on removal, also drops
  it from `T`). This is "deciding what to suppress." Voice chips also edit `S` here.
- **Edit-mode OFF** (practice, the default): click a *dimmed* (currently-muted) note to toggle
  it in/out of `T` — temporary per-note restore. Clicking a non-muted note does nothing.
  Dimmed noteheads get `cursor:pointer` + a "click to hear" title for discoverability.

`H` on overrides `T` (everything audible); per-note restore only has visible effect when `H`
is off.

### `public/music-render.js` (visual + selection)
State (module-closure, like `dimConnectors`):
- `suppressedNotes: Set<string>` — `S`, keys `${measure}:${midi}:${beats6}`.
- `tempRestored: Set<string>` — `T`, same key space, subset of `S`.
- `hearAll: boolean` — `H`.
- `suppressMode: boolean` — when true, notehead clicks edit `S`; when false, they toggle `T`.

Note tagging: extend the rendered-note model so each note carries `midi`, `voice`, and
`onsetBeats` (midi + voice already derivable from OSMD — midi is used for voice coloring;
onsetBeats is already computed for the chord window). Needed for matching and voice expansion.

Passes / behavior:
- `applySuppressionDim()` — runs inside `postRender()` (so it survives OSMD re-renders, like
  `applyDimConnectors`). Greys each notehead (+ its stem) whose key is in the **effective muted
  set** (`muted`). Uses the existing dim grey. Sets `cursor:pointer` + title on muted noteheads
  when not in edit-mode (practice click-to-hear affordance).
- Notehead click handler: map click → nearest note via the existing `pointerToNote`, get its
  `{measure, midi, onsetBeats}` key, then — if `suppressMode`, toggle in `S`; else, only if the
  note is currently muted, toggle in `T`. After any change, re-dim and fire `onSuppressionChange()`.
- `suppressVoice(voiceId, on)` — add/remove all rendered notes of that voice from `S`; fire
  `onSuppressionChange()`.

Pure helpers (unit-tested), exported:
- `suppressionKey({measure, midi, beats})` → string.
- `notesOfVoice(notes, voiceId)` → identity list (used by `suppressVoice`).
- `effectiveMuted(S, T, hearAll)` → identity list (the `muted` computation).

API additions on the renderer object:
- `setSuppressedNotes(list)` — set `S`; clears `T`, `hearAll`.
- `getSuppressedNotes()` → `S` as `[{measure,midi,beats}]` (for persistence).
- `getMutedNotes()` → effective `muted` as `[{measure,midi,beats}]` (for the player).
- `setSuppressMode(on)`.
- `setHearAll(on)`.
- `suppressVoice(voiceId, on)`.
- `listVoices()` → `[{ id, color, allSuppressed }]` present in the current view (for the chips).

`onSuppressionChange` is a new constructor callback (alongside `onChordSelect`,
`onWindowChange`), fired after *any* change to `S`, `T`, or `H`, with no args — the page pulls
`getSuppressedNotes()` (persist) and `getMutedNotes()` (player) as needed.

### `public/music-player.js` (muting)
- `setSuppressed(list)` — store the **effective muted list** (the page passes
  `renderer.getMutedNotes()`; the player stays dumb — it just mutes whatever it's given).
- In `buildPart`: an event matching the muted list is **not** triggered on the synth
  (`triggerAttackRelease` skipped) but **keeps its `_step`/`_first`** so the OSMD cursor and
  Transport timing are unaffected — a fully-muted beat still advances the cursor.

Pure helper (unit-tested), exported:
- `isSuppressed(event, set)` → boolean — `(measure,midi,beats)` match with `EPS`.

### `public/music.html` (UI glue)
Shown only when `currentVocabEntry` is set:
- **🔇 "Suppress" toggle** — enters/exits suppress edit-mode (`renderer.setSuppressMode`).
  While on, a row of **voice chips** appears (from `renderer.listVoices()`), colored to match
  voice colors. A chip toggles its voice: if **every** rendered note of that voice is already
  suppressed (`allSuppressed`), the chip restores them (`suppressVoice(id, false)`); otherwise
  it suppresses the whole voice (`suppressVoice(id, true)`). The chip lights when its voice is
  fully suppressed, mirroring the existing toggle buttons.
- **👂 "Hear all" toggle** — transient; calls `renderer.setHearAll(on)`. Not saved.
- Per-note temporary restore needs no new control — it's the practice-mode notehead click
  (edit-mode off), handled inside the renderer.
- Wiring:
  - `onSuppressionChange()` → `player.setSuppressed(renderer.getMutedNotes())` and update the
    suppressed-count label.
  - `openVocabEntry` → `renderer.setSuppressedNotes(entry.suppressed||[])`,
    `player.setSuppressed(renderer.getMutedNotes())`, edit-mode off (Hear-all + `T` already
    cleared by `setSuppressedNotes`).
  - Add/update vocab → include `renderer.getSuppressedNotes()` as `suppressed` in the entry.
  - On close / opening a plain preview → `renderer.setSuppressedNotes([])`, mode off.

## Data Flow

```
notehead click ──► renderer: edit-mode? toggle S : (if muted) toggle T
voice chip   ──► renderer.suppressVoice → edits S
Hear-all     ──► renderer.setHearAll(H)
        │
        ▼
  onSuppressionChange()  ──► page pulls:
        │                      getSuppressedNotes() → entry.suppressed (on save)
        │                      getMutedNotes()      → player.setSuppressed(...)
        ▼
applySuppressionDim (postRender)        buildPart skips synth trigger for muted
   dims muted noteheads                 events (keeps cursor step)

muted = H ? [] : (S − T)   ← single source of truth for dim AND mute

Add/update vocab → entry.suppressed = getSuppressedNotes() → vocab.json (push)
openVocabEntry  → setSuppressedNotes(entry.suppressed); player.setSuppressed(getMutedNotes())
```

## Error Handling / Edge Cases

- **Note not currently rendered** (segment changed): its key simply doesn't match any
  notehead → not dimmed, harmlessly retained in the set.
- **Unison across voices** (same midi + same onset in two voices): both match and are
  suppressed together. Acceptable — they are "that pitch at that time."
- **Fully-muted beat**: cursor still advances (events keep `_step`).
- **`T` ⊆ `S` invariant**: removing a note from `S` (edit-mode) also drops it from `T`, so a
  stray temp-restore can never reference a note that is no longer suppressed.
- **Hear-all on**: overrides `T` — `muted = []`, everything audible/visible. `S` and `T` are
  untouched; turning Hear-all off restores `muted = S − T`.
- **Per-note click on a non-muted note** (practice mode): no-op (nothing to restore).
- **Edit-mode off + nothing suppressed**: notehead clicks are no-ops (no muted notes to toggle).
- **Missing `midi`/`voice`** on a note (rests, unpitched): excluded from selection and
  matching.

## Testing

Pure cores (unit, Jest):
- `music-vocab.test.js`: `buildVocabEntry` includes `suppressed` (default `[]`; round-trips a
  provided list).
- `music-render.test.js`: `suppressionKey` formatting; `notesOfVoice` returns the right
  identities for a given voice; `effectiveMuted(S, T, hearAll)` returns `S − T`, `[]` when
  `hearAll`, and ignores `T` entries not in `S`.
- `music-player.test.js`: `isSuppressed` matches on `(measure,midi,beats)` with `EPS` and
  rejects near-misses; a schedule built with a suppressed event marks it muted while
  retaining its cursor step.

Browser-verified (cannot unit-test SVG/audio):
- Edit-mode: clicking noteheads dims/restores them in the saved set; voice chips bulk-toggle.
- Practice-mode: clicking a dimmed note temporarily restores just that one (un-dim + audible);
  clicking again re-suppresses it; the saved set is unchanged on reopen.
- Playback actually silences suppressed notes; cursor still tracks.
- "Hear all" restores audio + visuals temporarily; toggling back re-applies.
- Save/reopen round-trips the suppression set (and `T`/Hear-all reset to clean).
