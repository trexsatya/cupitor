# Music Study App — Milestone 2: Rendering, Search, Playback, Media-linking & Capture (Design)

- **Date:** 2026-06-20
- **Status:** Approved — ready for implementation planning
- **Scope:** This milestone covers ALL of: Search (S), Rendering (R), Playback (P), Media-linking + timestamps (L), Segment capture → vocabulary (C). Large, so it is built and planned in **5 phases**, but it is one milestone per the user's decision.
- **Builds on:** M1 ([2026-06-20-music-study-app-encoding-index-design.md](2026-06-20-music-study-app-encoding-index-design.md)) — the encoders, two-tier per-system index (`db/music/<system>/index.json` + `details/<id>.json`), `?system` routing, and GitHub persistence.

## 1. Vision

`music.html` evolves from the M1 Manager into the full study app: **search a corpus → see matches rendered as notation → play them (MIDI or linked YouTube) → capture segments into vocabulary**, mobile-friendly throughout. Search runs client-side over the M1 **Tier-1** index; a hit fetches the piece's **Tier-2** detail (for `measureIndex`, durations, inline MusicXML) to render/play/capture — the two-tier payoff designed in M1.

## 2. Locked decisions (from brainstorming)

1. **App layout = master→detail (Layout C).** Screen 1: search panel + compact results list. Screen 2: focused detail (full score, player, capture, media-link). Desktop = side-by-side; mobile = one screen at a time with a ‹back control.
2. **Chord input = chip builder.** Per-chord: root dropdown + quality dropdown + tappable extension pills; "+ Add chord"; global controls (`strict_extensions`, `max_gap`, `transpose_invariant`).
3. **Search semantics:**
   - Chords: any extension allowed by default; `strict_extensions` toggle applies the per-chord `extensions_allowed` whitelist.
   - Chord sequence: contiguous by default + `max_gap` knob.
   - `transpose_invariant`: **default OFF** for chords.
   - Melody: **octave-agnostic** by default.
4. **Playback engine = Tone.js** (vendored) for MIDI→WebAudio, plus the YouTube IFrame API for linked video.
5. **Timestamp guess = duration-weighted proportional**, user-editable before saving.
6. **Segment = measure range** (start measure → end measure).
7. **Vocabulary store = per-system `db/music/<system>/vocab.json`** (categorized entries), pushed via GitHubUtils.

## 3. Architecture & build order

`music.html` hosts Layout C and wires focused modules. New modules are pure where possible (logic in pure modules, browser glue thin):

| Phase | Module | Responsibility | Testability |
|---|---|---|---|
| 1 | `public/music-query.js` | parse chord/melody JSON queries; matching engine + scoring; return matches as note ranges | pure → TDD |
| 2 | `public/music-render.js` | OSMD wrapper: render whole piece + a measure-range segment; responsive sizing; note↔measure mapping | browser; pure helpers TDD |
| 3 | `public/music-player.js` | Tone.js transport (schedule notes from detail voices, tempo, play/loop) + YouTube IFrame control | browser; pure schedule-builder TDD |
| 4 | `public/music-media.js` | link YouTube to a piece; duration-weighted timestamp guess; edit + save | pure guess fn TDD; save = integration |
| 5 | `public/music-vocab.js` | capture a segment → `vocab.json` entry; load/save via GitHubUtils; categories | pure entry-builder TDD; save = integration |

Reused: M1 modules (`music-encoding.js`, `music-index.js` — `loadIndex`, `getMusicResourceUrl`, GitHub via `github-utils.js`), the vendored `opensheetmusicdisplay.min.js`, guitar.js's OSMD setup pattern (`new opensheetmusicdisplay.OpenSheetMusicDisplay`, `populateNoteheadData`, cursor), and language.js's YouTube IFrame patterns.

The M1 **Manager** (add/rebuild pieces) remains reachable as a section/route within `music.html`.

### Phase 0 — Encoder tempo parsing (small M1 extension)

A prerequisite tweak to M1's `encodeMusicXml` in [public/music-encoding.js](../../../public/music-encoding.js): read the MusicXML `<sound tempo="…">` attribute (commonly on the first measure's direction/sound element) into `meta.tempo` (a number, BPM). When absent, `meta.tempo` stays null and playback uses the 90 BPM default. Pure and TDD-able against the real Chopin/Sor fixtures; pieces already in the index pick it up on the next Rebuild & Push. This lands before Phase 3 so the player can read real tempos.

## 4. Phase 1 — Search (`music-query.js`)

### Query JSON (built by the UI)
```jsonc
// Chord query
{
  "type": "chord",
  "chords": [ { "chord": "C", "extensions_allowed": ["add9"] }, { "chord": "G", "extensions_allowed": ["7"] } ],
  "strict_extensions": false,    // default: any extension matches
  "max_gap": 0,                  // 0 = contiguous; N = up to N intervening chords
  "transpose_invariant": false   // default off
}
// Melody query
{
  "type": "melody",
  "notes": ["C", ".", ".", "E", "G"],   // "." = any single note
  "search_by_interval": false,           // true → contour match (transposition-invariant)
  "pitch_tolerance": 0,                   // semitones of slop (interval mode)
  "allow_passing": true,
  "allow_repetition": true
}
```

### Matching semantics
- **Chord** — matched against an index entry's `search.chords` (space-separated normalised symbols like `C`, `Am`, `G7`, `CM7`). Both query and piece symbols are decomposed into **{root pitch-class, base quality, extension}** by a small parser consistent with M1's `normaliseChordName`/`deNormaliseChordName` conventions ([public/music-reference-data.js](../../../public/music-reference-data.js)).
  - One query chord matches a piece chord when **root + base quality** (maj/min/dim/aug) match. By default any extension on the piece chord is tolerated; when `strict_extensions`, only the base triad + `extensions_allowed` match.
  - The query sequence must appear as a **sub-sequence** of the progression: contiguous when `max_gap=0`, else up to `max_gap` intervening chords between consecutive matches.
  - `transpose_invariant=false` → roots match literally; `true` → match by root-interval shape (qualities preserved) in any key.
- **Melody** — `search_by_interval=false`: match a window in the entry's `search.pitchClasses` where each non-`.` token equals the piece note's pitch class (octave-agnostic), `.` skips a position. Comparison is by **pitch-class number (0–11)**, so query spellings (`C#`, `Db`) and the index's compact spelling (`Cs`, …) are normalised on both sides before comparing. `search_by_interval=true`: match the entry's `search.contour` via the existing `findIntervalMatches` from [public/music_search.js](../../../public/music_search.js) (handles transposition, passing notes, repetition); `.` = a free step; `pitch_tolerance` widens interval slop.
- **Score & output:** rank by fraction matched / closeness. Each result: `{ pieceId, system, score, matchNoteRange: [startIdx, endIdx] }`.

### Execution flow
1. `loadIndex(system)` (M1) → all Tier-1 entries (with `search.*` fields).
2. `music-query` runs the matcher over each entry's search fields → ranked results with `matchNoteRange` (note indices in the primary voice).
3. On selecting a result, fetch the Tier-2 `details/<id>.json`; use its primary-voice `measureIndex` to convert `matchNoteRange` → **measure range** for rendering/playback/capture.

## 5. Phase 2 — Rendering (`music-render.js`)

- Wraps OSMD (`new opensheetmusicdisplay.OpenSheetMusicDisplay(container)`, `setOptions`, `load(detail.source).then(render)`), following guitar.js.
- **Whole piece:** render all measures. **Segment:** `osmd.setOptions({ drawFromMeasureNumber, drawUpToMeasureNumber }); osmd.render()` for the matched measure range. A "full piece / segment" toggle in the detail view.
- **Mobile:** Layout C shows one screen at a time on narrow viewports; OSMD `Zoom` is set from viewport width so the score fits without horizontal scroll. The matched segment is visually highlighted (reuse `populateNoteheadData` to color noteheads in range).
- Pure helper (TDD): `measureRangeFromNoteRange(detail, noteRange)` — maps a primary-voice note-index range to `[startMeasure, endMeasure]` via `measureIndex`.

## 6. Phase 3 — Playback (`music-player.js`)

- **MIDI (Tone.js):** a pure `buildSchedule(detailVoices, { tempo, fromMeasure, toMeasure })` returns `[{ midi, time, duration }]` from the encoded notes (duration channel → note length; uniform default when durations are null). `tempo` comes from `meta.tempo` when present (see Phase 0), falls back to **90 BPM** otherwise, and is adjustable in the UI. The player schedules these on a Tone transport; supports play/pause, **loop segment**, and drives an OSMD cursor to follow.
- **YouTube (IFrame API):** reuse language.js patterns (`YT.Player`, `playVideo`, `seekTo`, `getPlayerState`) to play the linked video and seek to a segment's start.
- One transport UI selects the source (MIDI vs YouTube). `buildSchedule` is unit-tested (TDD); the Tone/YT wiring is browser-verified.

## 7. Phase 4 — Media-linking + timestamps (`music-media.js`)

- **Link:** attach a YouTube URL to a piece → written to `meta.youtube` in both the Tier-1 entry and the Tier-2 detail; pushed via GitHubUtils (reusing the M1 rebuild/commit pattern).
- **Timestamp guess (pure, TDD):** `guessSegmentStart(detail, measureRange, mediaSeconds)` = (cumulative note-duration before the segment ÷ total note-duration) × `mediaSeconds`. `mediaSeconds` comes from the YouTube player's `getDuration()`.
- The guess is shown in an **editable** field; the user adjusts before saving. Saved start times are stored on the captured vocab entry (Phase 5), not mutated onto the piece.

## 8. Phase 5 — Segment capture → vocabulary (`music-vocab.js`)

- From the detail view, select a **measure range** → "Add to vocab".
- Pure `buildVocabEntry({ pieceId, system, measureRange, youtube, startSeconds, snapshot })` (TDD) → entry:
  ```jsonc
  { "id": "...", "category": "...", "pieceId": "...", "system": "western",
    "measureStart": 5, "measureEnd": 8, "youtube": "https://…", "startSeconds": 42.0,
    "snapshot": { "pitches": [...], "chords": [...] }, "createdAt": "2026-06-20" }
  ```
- Stored in `db/music/<system>/vocab.json` (an array, categorized like M1 vocab). `loadVocab(system)` / `saveVocab(system, entries)` via GitHubUtils `commitMultipleFiles`. The id scheme follows M1 (`pieceId` + measure range, spaces→`_`).

## 9. UI (Layout C, in `music.html`)

- **Search view:** mode toggle (Chord | Melody). Chord = chip builder (§ decision 2). Melody = a `C . . E G` **textbox with a small note-picker assist** (tappable note buttons + a `.` wildcard button that append tokens, so non-typists can build the same `notes` array) + the `search_by_interval` checkbox + tolerance. Flexibility controls (`strict_extensions`, `max_gap`, `transpose_invariant`, `pitch_tolerance`, `max_results`). Results = compact rows (title, score, match summary).
- **Detail view:** full-piece/segment OSMD render; transport (MIDI/YouTube, tempo, loop); "Link YouTube" + timestamp editor; "Add to vocab" (with category). ‹back on mobile.
- Responsive: side-by-side ≥ desktop width; stacked single-screen below.

## 10. Cross-cutting

- **Vendor Tone.js** into `public/vendor/tone.js` (UMD build, loaded via `<script>`), so playback works offline on gh-pages.
- Search operates on the **primary voice** for melody (matching M1's `search.contour`/`pitchClasses`) and on aggregated `search.chords` for chords.
- Playback/tempo: encoded durations used when present; note-text pieces (durations null) use a uniform note length; tempo comes from `meta.tempo` (parsed from MusicXML `<sound tempo>` — see Phase 0) when available, else defaults to 90 BPM, always user-adjustable.

## 11. Testing

- **Pure / TDD:** Phase 0 `<sound tempo>` parsing into `meta.tempo`; `music-query` (chord matching incl. extensions/strict/max_gap/transpose; melody pitch-class + interval + wildcards + knobs; scoring); `measureRangeFromNoteRange`; `buildSchedule`; `guessSegmentStart`; `buildVocabEntry`; query JSON parse/validate.
- **Integration (browser-verified):** OSMD whole/segment render + mobile zoom; Tone.js playback + loop; YouTube link/seek; GitHub saves (media link, vocab). Reuse the real Chopin/Sor scores from M1's integration tests as render/play fixtures.

## 12. Out of scope / deferrals

- Sub-measure (per-beat) segment precision (segments are measure ranges).
- n-gram inverted search index (linear scan over Tier-1 is fine at current corpus size).
- Soundfont/sampled instruments (Tone.js synth voices for M2; samples a later upgrade).
- Multi-piece "playlist"/practice-set playback and the Practice Log (a later milestone).
- Automatic audio-to-score alignment (timestamps are a guess + manual edit, not detected).

## 13. Resolved review items

1. **Tempo source (resolved):** Phase 0 extends M1's `encodeMusicXml` to parse MusicXML `<sound tempo>` into `meta.tempo`; the player reads it when present and falls back to 90 BPM otherwise, always user-adjustable.
2. **Melody input control (resolved):** a `C . . E G` textbox with a small note-picker assist (tappable note + `.` buttons that append tokens).
