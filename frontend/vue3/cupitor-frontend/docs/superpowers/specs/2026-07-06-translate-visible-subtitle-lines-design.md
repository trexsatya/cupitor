# Translate Visible Subtitle Lines — Design

**Date:** 2026-07-06
**Status:** Approved (design); pending spec review
**Area:** `public/language/language.js` (web app), reusing `public/language/srt-parser.js`

## Problem

The CLI `srt --no-translate` command creates source-only snippet SRTs (`.sv.srt`
with no paired `.en.srt`) so vocabulary can be captured quickly. Those snippets
then need English on demand, inside the study app, without a round-trip to the
CLI. More generally, a user reading a subtitle window wants a one-click way to
(re)generate the English for the lines currently on screen.

The web app runs on GitHub Pages, where the browser JSON-translation endpoints
are CORS-blocked. The Flutter Cupitor host already solves this: it exposes a
`TranslateRequest` JavaScript channel that translates natively (Google endpoint
+ on-device ML Kit fallback) and replies to the page. The app already mirrors
this exact bridge shape for audio (`AudioBridge` / `window.__cupAudio` /
`_audioRpc`).

## Goal

Add a **Translate** button to each subtitle window's toolbar. Clicking it:
1. Collects the window's currently visible **source** (main / `sv`) lines.
2. Translates **all** of them to English via the host bridge (overwrite policy:
   re-translate every visible line, per user decision).
3. Writes the results into the paired `.en.srt` — creating the file/lines if
   they don't exist yet — through the existing edit → queue → Sync commit path.
4. Re-renders the window so the new English shows immediately.

Non-goals: translating non-visible lines; changing the CLI; translating to
languages other than English; automatic (unprompted) translation.

## Decisions (resolved during brainstorming)

- **Backend:** reuse the Flutter host's `TranslateRequest` channel (not an
  in-browser HTTP call, which CORS blocks on GitHub Pages).
- **Overwrite policy:** re-translate **all** visible lines every click
  (idempotent overwrite), not just the missing ones.

## Architecture

Three small, independently-testable units plus thin UI glue. `language.js` is a
browser entry (it touches `window`/`$`/`document` at load) and is **not**
jest-importable, so — following the existing refactor pattern — the pure logic
lives in shared, already-tested modules and `language.js` delegates to them:

- SRT block insert/create → **`public/language/srt-parser.js`** (tested by
  `srt-parser.test.js`).
- Queued-edit text builder → **`public/language/srt-parser.js`** (same).
- `translateLines` orchestration → new **`public/language/translate-lines.js`**
  (tested by `translate-lines.test.js`).

The bridge RPC and button handler stay in `language.js` (window/DOM-bound,
verified manually — same as `AudioBridge`).

### 1. Translate bridge client (mirrors `AudioBridge`)

A direct analogue of the audio RPC at `language.js:9420`, adapted to the
host's translate protocol (which the Flutter side already implements):

- Request: `window.TranslateRequest.postMessage(JSON.stringify({ id, text, source, target }))`
- Reply:   `window.__cupTranslated(id, result, err)` — **positional** args, and
  `id` must be **numeric** (the Dart handler echoes `$id` unquoted into a
  `runJavaScript` call, so a string id would produce invalid JS).

API:
- `_haveTranslateBridge()` → `!!(window.TranslateRequest && typeof window.TranslateRequest.postMessage === 'function')`
- `window.__cupTranslated = function (id, result, err) { … }` — resolve/reject
  the pending promise for `id` from a `_TRANSLATE_PENDING` map.
- `_requestTranslation(text, source, target)` → `Promise<string>`; allocates a
  numeric id, stores the pending entry, posts the message, and rejects on a
  timeout (so a silent host never hangs the UI).

### 2. `translateLines(lines, translateFn, opts)` — pure orchestration

New module `public/language/translate-lines.js`. Given an array of source
strings and an injected async `translateFn(text)`, return a `Promise<string[]>`
of translations **in the same order**. Empty / whitespace-only lines pass
through untranslated (no bridge call). Runs with a small concurrency cap.
`translateFn` is injected so this is unit-testable without the bridge;
production passes `t => _requestTranslation(t, src, 'en')`.

### 3. Insert/create-capable SRT write path

The current write path cannot create lines or files. The pure text logic goes
into `srt-parser.js`; `language.js` gets thin wrappers:

- **`upsertSrtEntry(raw, { index, start, end, text })`** — new pure export in
  `srt-parser.js`. Replaces the block whose leading index matches; if absent,
  **inserts** a block (`index`, `HH:MM:SS,mmm --> HH:MM:SS,mmm`, `text`) in
  numeric-index order; if `raw` is empty, builds a fresh single-entry SRT. It
  reuses the module's existing `srtTimeFromValue` for formatting. Indices mirror
  the `sv` file (same `sub.index`), so no renumbering is needed.
- **`applyQueuedEditsToText(current, edits)`** — new pure export in
  `srt-parser.js`. (a) updates existing lines; (b) when `current` is empty
  **and** every edit carries a timestamp, builds a fresh SRT via `upsertSrtEntry`
  instead of skipping; (c) when `current` is empty and edits lack timestamps,
  returns null (today's "don't create from edits alone" behavior for manual ✎).
- **`_replaceSrtLine(raw, lineIndex, newText, opts)`** (`language.js:4663`):
  gains optional `opts = { start, end }` and delegates the insert/create case to
  `upsertSrtEntry`. Existing replace behavior (preserve timestamp formatting
  verbatim) is unchanged.
- **`_saveSubtitleEdit(link, langCode, lineIndex, newText, opts)`**
  (`language.js:4682`): accepts the same optional `{ start, end }`. When
  `langCode === 'en'` and `stored.en` is missing, treat it as an empty string so
  the create path can build it. Passes `opts` through, and includes
  `start`/`end` in the queued entry.
- **`flushPendingSrtEdits` `getContent`** (`language.js:4780`): delegates its
  per-file body to `applyQueuedEditsToText(current, edits[filePath])`.

Rationale for keeping one path: translation edits flow through the same
`_queueSubtitleEdit` → localStorage → manual **Sync Edits** commit as manual
edits. This preserves the app's "no silent pushes" rule (`language.js:4746`) and
its Review dialog, and avoids a parallel commit mechanism.

### 4. UI glue

- **Button:** add `<span class="translate-lines-btn btn" title="Translate visible lines to English">🌐</span>`
  to the `.buttons` toolbar in `renderLines` (`language.js:5046`), next to the
  `.capture-btn`. The window's `data-url`/id are already available on the toolbar.
- **Handler:** a delegated `$(document).on('click', '.translate-lines-btn', …)`
  alongside the existing `.edit-line-btn` binding.
- **Fallback:** when `_haveTranslateBridge()` is false (plain browser), the click
  shows a brief "Translation needs the Cupitor app" notice and no-ops. (Button
  still renders; it does not attempt a CORS-blocked HTTP call.)

## Data flow

```
click 🌐
  → resolve window range [fromIndex..toIndex] → for each idx: getSub(idx)
      → { lineIndex: sub.index, text: sv text, start, end }  (skip empty)
  → translateLines(texts, t => _requestTranslation(t, mainLangCode, 'en'))
  → for each (lineIndex, start, end, translated):
        _saveSubtitleEdit(link, 'en', lineIndex, translated, { start, end })
            → _replaceSrtLine (replace or insert) → stored.en updated in memory
            → _queueSubtitleEdit(filePath, lineIndex, translated, { start, end })
  → re-render this window (English now visible)
  → user clicks Sync Edits → flushPendingSrtEdits → commitMultipleFiles → GitHub
```

Source text and timestamps come from the already-parsed `sv` entries in memory
(`getSub(idx)` / `stored._parsedSv`), so no re-fetch is needed. The `en` line
reuses the `sv` line's `index` and timestamp, keeping the two files aligned.

## Error handling

- **No bridge:** notice + no-op (see Fallback).
- **Bridge timeout / host error:** `_requestTranslation` rejects; that line is
  left unchanged and a per-window error toast summarizes how many lines failed.
  Successful lines are still saved (partial success is fine).
- **Line not found and no timestamp:** unchanged (edit dropped with a warning) —
  can't happen on the translate path because translate always supplies a
  timestamp.
- **Concurrent Sync:** unchanged; `commitWithMerge` re-applies queued edits
  against the latest remote text.

## Testing (TDD)

Pure units get RED→GREEN tests in shared modules; bridge and DOM glue are
verified manually (same policy as `AudioBridge`).

1. `upsertSrtEntry` (in `srt-parser.test.js`):
   - inserts a missing index in numeric order with the supplied timestamp;
   - builds a fresh SRT from empty input + one timestamped entry;
   - existing-index replace preserves the block's timestamp verbatim (regression).
2. `applyQueuedEditsToText` (in `srt-parser.test.js`):
   - creates content when `current` is empty and edits carry timestamps;
   - returns null for timestamp-less edits on empty input (manual-edit behavior);
   - updates existing lines otherwise.
3. `translateLines` (in `translate-lines.test.js`):
   - preserves order;
   - passes whitespace-only lines through untouched (no `translateFn` call);
   - respects the concurrency cap (via an injected counting `translateFn`).

Existing suite (794 tests / 44 suites) stays green.

## Files touched

- `public/language/srt-parser.js` — new pure exports `upsertSrtEntry`,
  `applyQueuedEditsToText`.
- `public/language/srt-parser.test.js` — tests for the two new exports.
- `public/language/translate-lines.js` (new) — `translateLines` pure orchestration.
- `public/language/translate-lines.test.js` (new) — tests for `translateLines`.
- `public/language/language.js` — translate bridge client (`_haveTranslateBridge`,
  `window.__cupTranslated`, `_requestTranslation`), `_replaceSrtLine` /
  `_saveSubtitleEdit` / queue wiring to the new pure helpers, toolbar 🌐 button +
  delegated click handler, plain-browser fallback notice.
- No CLI changes.
