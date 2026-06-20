# Music Study App — M2.2: Segment Loop/Stop, Voice Colors, Note-Name Toggle (Design)

**Status:** Approved
**Date:** 2026-06-20
**Branch:** `music-study-app`
**Builds on:** M2 / M2.1 (the assembled Layout C app in `music.html` + `music-*.js`).

## Problem / goals

Three issues surfaced from using the M2.1 build:

1. **MIDI doesn't stop or loop at the segment boundary.** Playing a segment runs the Transport open-endedly: it never halts at the segment end, and "Loop segment" doesn't actually repeat the segment. The UI also never returns to a stopped state.
2. **All voices render the same color.** A multi-voice piece is hard to read because every notehead is black. Color each voice distinctly in the OSMD-rendered sheet.
3. **No note names on the sheet.** A study aid: a toggle to label each rendered note with its name. Notation: **English / scientific** (letter + octave, e.g. `C4`, `F#5`, `Bb3`) — self-contained from pitch, works for any system. (Sargam/solfège deferred — it needs a tonic reference.)

Constraints: vanilla ES modules, **no new dependencies, no assets**, must work offline on gh-pages. Pure logic is unit-tested (TDD); Tone/OSMD/DOM glue is `node --check` + manual, per the established pattern. Tests stay lean.

## Feature A — Segment stop & loop (player fix)

The bug is in `createMusicPlayer` (`public/music-player.js`). Root causes:

- **No Transport reset on play.** After a play-through the Transport keeps running, so `Tone.Transport.position` advances past the segment. A second `play()` calls `part.start(0)`, whose events are now in the past → nothing fires (reads as "loop/replay broken"). Fix: stop the Transport (resets position to 0) before starting.
- **No hard stop at the boundary when not looping.** The Transport runs forever; the cursor simply stops advancing and the UI never returns to "stopped." Fix: schedule a one-shot stop at the segment end.
- **Loop bounds left implicit / order-fragile.** `setLoop` only mutates `part.loop` when a part exists, so call order matters.

Changes:

- **Pure** `scheduleEnd(schedule)` in `music-player.js` (TDD) → the segment's end time in seconds = `last.time + last.duration` for the last event, or `0` for an empty schedule.
- **Glue** in `createMusicPlayer`:
  - Store a `loop` flag on the player (default `false`); `setLoop(on)` updates the flag and, if a part exists, `part.loop = !!on`.
  - In `buildPart()` (or `setSchedule`): set `part.loop = loop`, `part.loopStart = 0`, `part.loopEnd = scheduleEnd(schedule)`.
  - In `play()`: `await T.start();` then **reset** the Transport position (`T.Transport.stop()`), `(re)build part if needed`, `T.Transport.start(); part.start(0);`. When **not** looping, also `T.Transport.scheduleOnce(() => this.stop(), end)` (end = `scheduleEnd`) so playback stops and the cursor resets exactly at the boundary. Track the scheduled id and clear it on an explicit `stop()`/new `play()` to avoid stale callbacks.
  - `stop()` keeps its current behavior (stop Transport, stop part, reset+hide cursor) and clears any pending one-shot.
- No `music.html` API change needed beyond what already calls `setSchedule`/`setLoop`/`play`; the existing wiring (`playMidi`) already passes the segment schedule and the loop checkbox.

Manual verification: play a segment → it stops at the end; check Loop → it repeats the segment cleanly; toggling Loop mid-session and replaying behaves correctly.

## Feature B — Per-voice notehead colors

- **Pure** `voiceColor(index)` in `public/music-render.js` (TDD): map a 0-based voice index to a hex color from a fixed, readable palette, cycling for indices beyond the palette length. Stable + deterministic.
- **Glue** in `createMusicRenderer`:
  - A `colorVoices` flag (default `false`) and `setVoiceColors(on)` that sets the flag and re-renders.
  - A private `applyVoiceColors()` that walks `osmd.Sheet.Instruments`, enumerates their `Voices` in a stable global order, and sets every note's `NoteheadColor` to `voiceColor(globalVoiceIndex)` when on, or to the default (`'#000000'`) when off. Called inside both `showFull()` and `showSegment()` **before** `osmd.render()` (and once after `loadDetail`), so colors survive every re-render and segment switch.
  - Use OSMD's native `Note.NoteheadColor` (confirmed present in the vendored build) — no DOM/SVG manipulation, no coupling to `music-analysis.js`.
- **UI** (`music.html`, preview toolbar): `<label><input type="checkbox" id="voiceColorChk"> Color voices</label>`; `onchange` → `renderer.setVoiceColors(checked)`. Off by default.

Manual verification: a multi-voice piece shows each voice in a distinct color; toggling off restores black; colors persist when switching between full and segment views.

## Feature C — Note-name toggle

- **Pure** `noteName(midi)` in `public/music-render.js` (TDD): MIDI number → English/scientific name with octave using sharps (`C`, `C#`, `D`, … `B`) and octave `Math.floor(midi/12) - 1` (so MIDI 60 → `C4`). Returns `''` for null/NaN.
- **Glue** in `createMusicRenderer`:
  - A `noteNames` flag (default `false`) and `setNoteNames(on)` that sets the flag and re-renders.
  - A private `applyNoteNames()` that, **after** `osmd.render()`, removes any existing label layer, and when on, walks the graphical notes (`osmd.graphic.measureList` → measures → `staffEntries` → `graphicalVoiceEntries` → `notes`, the same traversal proven in `music-analysis.js`), reads each note's pitch (`note.sourceNote.halfTone` + 12 → MIDI, or the source pitch), and overlays a small SVG `<text>` near the notehead's bounding box inside the OSMD SVG. Skips rests (no pitch). Labels are grouped in a single `<g class="note-name-layer">` appended to the SVG so toggling off is one removal.
  - Called at the end of `showFull()`/`showSegment()` after render.
- **UI** (`music.html`, preview toolbar): `<label><input type="checkbox" id="noteNameChk"> Note names</label>`; `onchange` → `renderer.setNoteNames(checked)`. Off by default.

Placement uses each notehead element's bounding box within the SVG (`getBBox`/element position), which is browser-verified. The label layer is purely additive and removed wholesale on toggle-off, so it never corrupts the score.

Manual verification: toggling on labels each note with its name (`C4`, `F#5`, …); toggling off removes all labels; labels reposition correctly after a segment change or zoom.

## Architecture & files

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `public/music-player.js` | + pure `scheduleEnd`; `createMusicPlayer` stored loop flag, explicit loop bounds, Transport reset + one-shot boundary stop (glue). |
| Modify | `public/music-player.test.js` | tests for `scheduleEnd`. |
| Modify | `public/music-render.js` | + pure `voiceColor`, `noteName`; `createMusicRenderer` `setVoiceColors`/`applyVoiceColors` (NoteheadColor) and `setNoteNames`/`applyNoteNames` (SVG overlay) (glue). |
| Modify | `public/music-render.test.js` | tests for `voiceColor`, `noteName`. |
| Modify | `public/music.html` | two checkboxes in the preview toolbar + wiring to `setVoiceColors`/`setNoteNames`. |

## Testing

- **Pure / TDD:** `scheduleEnd` (normal schedule, empty → 0); `voiceColor` (in-range, cycling, index 0); `noteName` (C4=60, sharps, octave boundaries, null → '').
- **Browser-verified (glue):** segment stop + loop (Feature A); per-voice colors persist across renders (Feature B); note-name overlay toggles cleanly and repositions (Feature C).

## Out of scope

- Sargam/solfège note names (deferred — needs tonic selection).
- Coloring by anything other than voice (pitch-class Boomwhacker, etc.).
- Per-note stem/beam coloring (noteheads only).
- Loop count limits, fade, count-in, or A/B loop sub-ranges.
- Editing/moving labels; label collision avoidance beyond simple offset.
