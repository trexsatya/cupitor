# Music Study App — M2.1: Instrument Voices, Vocabulary View, YouTube Segment Playback (Design)

**Status:** Approved
**Date:** 2026-06-20
**Branch:** `music-study-app`
**Builds on:** M2 (the assembled Layout C app in `music.html` + `music-*.js`).

## Problem / goals

Three polish items surfaced after the M2 build:

1. **Instruments.** Playback uses one generic Tone.js voice (`PolySynth(Synth)`) for every piece, so nothing sounds like its actual instrument — even though each piece's instrument is already captured in `meta.instrument`. Give playback a small set of distinct instrument **voices** chosen from that metadata (and overridable).
2. **Vocabulary view.** Captured vocab is loaded, added, and pushed, but **never rendered** — there is no way to see the vocabulary in the UI. Add a view.
3. **YouTube segment playback + a bug.** The YouTube source currently plays from the start, not the matched/selected segment. And it throws `player.playVideo is not a function`: `new YT.Player(...)` builds the player asynchronously, so its methods don't exist until the IFrame API fires `onReady`, but the controller calls `play()` immediately. Fix the readiness handling and make Play seek to the segment's start.

Constraints: vanilla ES modules, **no new dependencies, no audio assets** (must work offline on gh-pages). Pure logic is unit-tested; Tone/YT/DOM glue is `node --check` + manual, per the established pattern.

## Feature 1 — Instrument voices (synth presets)

- **Pure** `instrumentVoiceKey(name)` in `public/music-player.js` (TDD): case-insensitive keyword match on the instrument string → one of `'piano' | 'guitar' | 'strings' | 'organ' | 'synth'`.
  - `/piano|keyboard|harpsichord|clav/` → `piano`; `/guitar|pluck|lute|harp|mandolin|banjo/` → `guitar`; `/violin|viola|cello|bass|string|fiddle/` → `strings`; `/organ|accordion|harmonium/` → `organ`; everything else (incl. null/empty) → `synth`.
- **Glue** in `createMusicPlayer`: a `makeVoice(category)` factory returning a Tone voice connected to destination, distinct per category (e.g. `piano`/`synth` → `PolySynth(Synth)` with a piano-ish vs. default envelope; `organ` → `PolySynth(FMSynth)`; `strings` → `PolySynth(AMSynth)` slow attack; `guitar` → `PolySynth(Synth)` with a short plucky envelope). The exact envelope params are an implementation detail of the glue (manually verified). Add `setInstrument(category)` which disposes the current voice and builds the new one; the scheduling `Part` references the live `synth` variable, so no Part rebuild is needed.
- **UI** (transport row in `music.html`): an instrument `<select>` (Piano / Guitar / Strings / Organ / Synth). On preview open it is auto-set from `instrumentVoiceKey(detail.meta.instrument)`; changing it calls `player.setInstrument(value)`. MIDI playback then uses the chosen voice.

These are synthesised timbres, not sampled instruments — distinguishable, zero-asset. Sampled/soundfont instruments remain deferred (M2 spec §12).

## Feature 2 — Vocabulary view

- **Pure** `groupVocabByCategory(vocab)` in `public/music-vocab.js` (TDD) → an array of `{ category, entries }` groups, categories sorted alphabetically, each group's entries in their original order. Tolerates empty/missing input.
- **UI** in `music.html`: a collapsible `<details id="vocabSection">` under the search results. On load and after each capture it renders the groups: a heading per category, then a row per entry showing the piece title (looked up in `index` by `pieceId`, falling back to `pieceId`) + `m{measureStart}–{measureEnd}` + a `▶` marker when the entry has `startSeconds`/`youtube`. Clicking a row opens that piece's segment via the existing detail flow: `openPreview(pieceId)` then, if rendered, `showSegment([measureStart, measureEnd])` and fill `#segFrom`/`#segTo`.
- Read-only this iteration: no delete/edit (YAGNI).

## Feature 3 — YouTube segment playback + readiness fix

- **Rework** `createYouTubeController(container, { YT, onReady } = {})` in `public/music-player.js` to handle the async player lifecycle:
  - Track a `ready` flag and a `pending` queue of deferred actions.
  - `load(videoId, startSeconds)`: if no player yet, create `new YT.Player(container, { videoId, playerVars: { start: Math.floor(startSeconds||0) }, events: { onReady: () => { ready = true; if (onReady) onReady(); flush(); } } })`; if a player already exists, call `player.loadVideoById({ videoId, startSeconds: startSeconds||0 })` (loads + plays from the start).
  - `play()`, `pause()`, `seekTo(seconds)`: run immediately when `ready`, else push onto `pending` (flushed on ready). This removes the `playVideo is not a function` error.
  - `getDuration()`: returns `player.getDuration()` when ready, else `0`.
- **Segment playback** in `music.html` `playYouTube()`: seek to the segment's start before playing. Start time precedence: the **edited `#guessSec`** value when finite; otherwise an **auto-computed** `guessSegmentStart(currentDetail, segmentRange, getDuration())` once the player is ready (written back into `#guessSec` so it's visible/adjustable). Concretely: build the controller with an `onReady` that computes the start (preferring the edited field), fills `#guessSec`, `seekTo`s it, and plays; on a reused (already-ready) player, do the same inline after `load`.
  - Known limitation: an auto-computed guess needs the video's duration, which is only reliable once the player has loaded — so the very first Play of a never-guessed segment may need the player to be ready before the seek lands; the edited `#guessSec` path is always exact. Acceptable for this iteration.

## Architecture & files

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `public/music-player.js` | + pure `instrumentVoiceKey`; `createMusicPlayer` `makeVoice`/`setInstrument` (glue); **rework `createYouTubeController`** for readiness + `onReady` + `seekTo`/start (glue). |
| Modify | `public/music-player.test.js` | tests for `instrumentVoiceKey`. |
| Modify | `public/music-vocab.js` | + pure `groupVocabByCategory`. |
| Modify | `public/music-vocab.test.js` | tests for `groupVocabByCategory`. |
| Modify | `public/music.html` | instrument `<select>` + wiring; Vocabulary section (render + click-to-open); YouTube segment-seek wiring. |

## Testing

- **Pure / TDD:** `instrumentVoiceKey` (each category + default/null), `groupVocabByCategory` (grouping, sort, empty).
- **Browser-verified (glue):** instrument voices audibly differ + the selector updates them; the Vocabulary list shows captured entries grouped, and a click opens the segment; YouTube plays without the readiness error and starts at the segment (edited `#guessSec` and auto-guess paths).

## Out of scope

- Sampled/soundfont instruments (still deferred).
- Vocab delete/edit/reorder.
- Per-voice mixing, effects, velocity dynamics.
- Frame-accurate YouTube seeking (we use the duration-weighted guess + manual edit).
