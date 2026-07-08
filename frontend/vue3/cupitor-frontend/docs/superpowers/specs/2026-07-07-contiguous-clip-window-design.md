# Bound playlist clips to the contiguous run around the word

Date: 2026-07-07
Status: Approved (pending spec review)

## Problem

Since subtitles are now served as **sparse snippets** (a video's `.srt` holds only
the captured passages, stitched together) instead of full SRTs, almost every
playlist item plays far past the captured lines — often until the `dur + 15s`
safety "timeout" in `_waitYTUntilEnd`.

### Root cause

A playlist item stores an absolute `[timeStart, timeEnd]` (video seconds) and
playback pauses when the YouTube playhead reaches `timeEnd`
(`_waitYTUntilEnd`, language.js). The auto-random builder derives that window
from the **±N context cues** around the matched word:

```js
// buildAutoItemsForWord (random-playlist.js)
const from = Math.max(0, pos - contextLines);
const to   = Math.min(last, pos + contextLines);
timeStart: lines[from].ts,
timeEnd:   lines[to].te,
```

In a snippet SRT the ±N neighbours are frequently cues from a *different part
of the video* (minutes away), so `timeEnd` overshoots and the clip runs until
the neighbour's time — i.e. long past the word. Measured on the live corpus:
**807 / 6986** snippet files have a >30s internal gap, and heavily-studied
videos (which contribute the most playlist items) are exactly the ones with the
most gaps — so at the item level this hits "almost every" clip.

### Existing partial mitigation

The search-results renderer (language.js ~5027–5062), which also supplies the
times used by manual capture, **already** contracts the play window to the
contiguous segment containing the matched line — but with a hardcoded, loose
`MAX_GAP_S = 60` and no duration cap. The auto-random builder has none of this.
`_repairMalformedClip` only rescues the extreme `> 600s` (`MAX_REASONABLE_CLIP_S`)
case.

## Approach (chosen)

Play the **contiguous run** around the matched word: start at the matched cue
and extend outward only while neighbouring cues are temporally adjacent
(gap `< gapThreshold`); stop at the first larger gap. Scope the fix to
**build time and capture time** (no play-time recomputation).

Rejected alternatives (from brainstorming): "matched line + fixed pad" (loses
naturally-contiguous surrounding sentences); "cap gap + max duration on the
existing ±N window" (equivalent but less direct); play-time authoritative
recomputation (out of scope — user chose builder/capture only).

## Design

### 1. Shared pure helper — `random-playlist.js`

```js
// cues: [{ ts, te }, ...] in seconds (extra fields ignored).
// anchorPos: array index of the matched cue.
// Walk outward from anchorPos while the gap to the neighbour cue is
// < gapThreshold; stop at the first larger gap. Restrict the walk to
// [loBound, hiBound] when given (the ±context window). Then, if the run
// exceeds maxDuration, clamp it — biased to keep a short lead before the
// matched cue and fill trailing context, always fully covering the anchor cue.
// Returns { fromPos, toPos, timeStart, timeEnd }.
export function contiguousClipWindow(cues, anchorPos, opts = {}) {
  const gapThreshold = opts.gapThreshold == null ? 1.5 : opts.gapThreshold;
  const maxDuration  = opts.maxDuration  == null ? 25  : opts.maxDuration;   // Infinity = no cap
  const loBound = Math.max(0, opts.loBound == null ? 0 : opts.loBound);
  const hiBound = Math.min((cues || []).length - 1, opts.hiBound == null ? (cues || []).length - 1 : opts.hiBound);
  // ... (see algorithm below)
}
```

**Adjacency walk** (matches the existing search-path semantics):
- left: for `i = anchorPos-1 … loBound`, include `i` while
  `cues[lo].ts - cues[i].te <= gapThreshold`, else break; set `lo = i`.
- right: for `i = anchorPos+1 … hiBound`, include `i` while
  `cues[i].ts - cues[hi].te <= gapThreshold`, else break; set `hi = i`.
- `timeStart = cues[lo].ts`, `timeEnd = cues[hi].te`.

**Duration clamp** (only when `timeEnd - timeStart > maxDuration`):
- `lead = min(maxDuration * 0.25, anchor.ts - timeStart)` — keep up to 25% as pre-roll.
- `newStart = anchor.ts - lead`; `newEnd = newStart + maxDuration`.
- If `newEnd < anchor.te` (anchor longer than the cap window), set
  `newEnd = anchor.te`, `newStart = max(timeStart, newEnd - maxDuration)`.
- `timeStart = max(timeStart, newStart)`, `timeEnd = min(timeEnd, newEnd)`.

**Guards:** if `cues` empty, `anchorPos` out of range, or the anchor cue's
`ts`/`te` are not finite → return the anchor-only window
(`{ fromPos: anchorPos, toPos: anchorPos, timeStart: anchor.ts, timeEnd: anchor.te }`),
or `{ …, timeStart: 0, timeEnd: 0 }` when even the anchor is unusable. Never throws.

### 2. Auto-random builder — `buildAutoItemsForWord` (random-playlist.js)

Compute `from`/`to` (±`contextLines`) as today, then:

```js
const { timeStart, timeEnd } = contiguousClipWindow(lines, pos, {
  loBound: from, hiBound: to,
  gapThreshold: opts.gapThreshold,   // from _appSettings (default 1.5)
  maxDuration:  opts.maxDuration,    // from _appSettings (default 25)
});
```

`lineIndex` still points at `lines[pos].index`; the displayed context window is
unchanged (only the clip's play-bounds contract). `buildAutomaticItems`
(language.js) passes `gapThreshold`/`maxDuration` from `window._appSettings`
through to `buildAutoItemsForWord`.

### 3. Capture path — language.js ~5024–5066

Replace the inline contiguous walk + hardcoded `MAX_GAP_S = 60` with the same
helper, so captures use the configurable `clipGapThresholdSec`. **Capture stays
uncapped** (user decision): pass `maxDuration: Infinity`. Behaviour is otherwise
identical (display window unchanged; only `timeStart`/`timeEnd` on the play
button / captured item contract to the contiguous run).

Implementation note: the search path indexes `subtitleFile.data` by SRT
`.index` via `getSub`. The helper is array-position based, so build a
normalized `{ts, te}` array for the `[fromLineIndex, toLineIndex]` display
window, locate the anchor's array position, call the helper, and map its
`timeStart/timeEnd` back. If `subtitleFile.data` ordering can't be trusted,
keep the existing index-walk and only (a) swap `MAX_GAP_S` for the setting and
(b) skip the cap — the observable result is the same.

### 4. Configurable settings — `window._appSettings`

Add two per-language (localStorage, no cross-device sync) settings alongside
`contextLinesBefore`:

| key                   | default | meaning                                             |
|-----------------------|---------|-----------------------------------------------------|
| `clipGapThresholdSec` | `1.5`   | Max gap (s) between cues still treated as adjacent. |
| `clipMaxDurationSec`  | `25`    | Hard cap (s) on an auto-built clip. Capture ignores it. |

Wire both into `#settingsPanel` (music.html / language HTML) with number
inputs, `loadAppSettings` population, and `saveAppSettings` on change — mirroring
the existing `contextLinesBefore/After` handlers (clamp to sane ranges, e.g.
gap 0–30, duration 5–120). The pure helper bakes in `1.5` / `25` as its own
defaults so it never reads `window`.

### 5. Tests

- `random-playlist.test.js` — new `contiguousClipWindow` describe block:
  - contiguous cues: run stays the whole window;
  - a >threshold gap on one side: walk stops there, other side still extends;
  - gaps on both sides: anchor-only window;
  - run longer than `maxDuration`: clamped, anchor cue still covered, lead ≤ 25%;
  - `maxDuration: Infinity`: no clamp;
  - degenerate (empty cues / bad anchor / non-finite ts/te): safe anchor-only / zero window, no throw.
- `buildAutoItemsForWord` tests: add a case where `pos ± contextLines` straddles
  a large gap and assert `timeEnd - timeStart` is bounded to the contiguous run
  (not the full ±N span), and `lineIndex` is unchanged.

## Files touched

- `public/language/random-playlist.js` — add `contiguousClipWindow`; use it in `buildAutoItemsForWord`.
- `public/language/random-playlist.test.js` — new + updated tests.
- `public/language/language.js` — `_appSettings` defaults + `loadAppSettings`/`saveAppSettings` wiring; `buildAutomaticItems` passes the two settings; capture path (~5024–5066) uses the helper with `maxDuration: Infinity` and the configurable gap.
- language settings HTML (`#settingsPanel`) — two number inputs.

## Addendum — retroactive play-time clamp (added after initial deploy)

The "builder/capture only" scope left already-built playlists overshooting (e.g.
"fast" 331s, "demon" 165s — old auto items built before the fix). Added a
play-time clamp so they're corrected with no rebuild:

- `contiguousPlayWindow(primary, item, { gapThreshold, maxDuration })` in
  `renderer/playing-ui-vm.js` — locates the matched cue (lineIndex, else
  `resolveMatchIdxByTimeWord`), contracts to the contiguous run via
  `contiguousClipWindow`. **Shrink-only:** the walk is bounded to the stored
  `[timeStart, timeEnd]`, so it only trims gap overshoot and never lengthens a
  clip. Returns null for manual/unlocatable items (caller keeps the stored window).
  Uncapped (`maxDuration: Infinity`) — the gap contraction is what fixes overshoot.
- `playRecording` (language.js) calls it before `playMediaSlice`, awaiting the
  (cached) subtitle load, overriding `_playStart`/`_playEnd` when it returns a window.
- Tests: `playing-ui-vm.test.js` — gap contraction, idempotent contiguous window,
  shrink-only, stale-lineIndex recovery, manual/unlocatable/empty → null.

## Out of scope

- Changing the displayed context-line window or `_repairMalformedClip`/`MAX_REASONABLE_CLIP_S`.
- Cross-device sync of the two new settings (they stay per-device, like other app settings).
- Rewriting the stored `timeStart`/`timeEnd` on disk (the play-time clamp is computed each play; stored values are untouched).
