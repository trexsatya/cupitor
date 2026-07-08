# Practice Random — source options (Automatic + Manual, with filters)

- **Date:** 2026-07-07
- **Area:** `public/language/language.js` — Recorded Searches dialog
- **Status:** Approved design (pending user review)

## Goal

Clicking the 🎲 **Practice Random** button in the Recorded Searches dialog should
open an options dialog that lets the user compose the random-practice playlist
from one or both of two independent sources, each scoped by its own selector.
Any combination is allowed.

| Source (checkbox) | Contributes | Scoped by |
|---|---|---|
| ☑ **Automatic** | *Freshly generated* captures — scans downloaded subtitles for each selected vocabulary word and captures a ±N-line context window around each hit | **Vocabulary categories** + a **Matches-per-word** cap + a **Sentences-around-word** window |
| ☑ **Manually recorded/captured** | The user's *existing* hand-captured items (`!manual`) drawn from playlists | **Playlists** |

Manual flashcards (`manual: true`, created via "Add card") are **excluded** from
both sources — Practice Random is subtitle-clip based only.

## Current behavior (baseline)

- The 🎲 button (`#recRecRandom`, [language.js:10067](../../../public/language/language.js#L10067))
  currently calls `createRandomFromAllPlaylist()` immediately (with an overwrite
  `confirm` when `Random From All` already exists) — see the handler at
  [language.js:10248](../../../public/language/language.js#L10248).
- `createRandomFromAllPlaylist({ count = 50 })`
  ([language.js:8839](../../../public/language/language.js#L8839)) flattens every
  real, non-virtual playlist's items, dedupes by `(id, lineIndex, manual)`,
  Fisher-Yates shuffles, slices `count`, groups back into `items[st][w]`, and
  writes the reserved `Random From All` playlist (`RANDOM_REC_NAME`).

## Data model recap

- Recordings: `window._recordings[name].items[searchText][word] = [item, …]`.
- **Captured item** (hand-captured via `_captureMatchFromButton`,
  [language.js:9158](../../../public/language/language.js#L9158)):
  `{ searchText, word, id: <videoLink>, source, timeStart, timeEnd, lineIndex, enabled }`.
- **Manual flashcard** (`addManualEntry`): `{ manual: true, id, source, target, enabled, … }`
  under `items['Manual']['Card']`. `_isManualItem(it)` distinguishes them.
- Subtitles: `window.allSubtitles[link] = { sv, en, source, fileName }` (raw SRT
  text). Parsed lines carry `{ index, ts, te, text }` (`.ts`/`.te` in seconds).
- Vocabulary: `window.vocabulary = { category: [line, …] }`; categories in
  `VOCAB_HIDDEN_CATEGORIES` are not real searchable vocab.

## UI design — "Build Random Playlist" dialog

Open a jQuery-UI dialog cloned from `_openVirtualPlaylistEditor`
([language.js:9421](../../../public/language/language.js#L9421)). Contents:

```
Build Random Playlist
─────────────────────────────────────────────
[✓] Automatic — find example sentences from vocabulary
      Vocabulary categories: [ type to search…                     ]
                 ↑ searchable multi-select (select2); label "<cat> (<#words>)"
                   leave EMPTY = all categories
      Matches per word:      [ 1 ]  (1–10)
      Sentences around word: [ 2 ]  (0–10)   ← N before + N after the match

[✓] Manually recorded / captured
      Playlists: [ type to search…                                 ]
                 ↑ searchable multi-select (select2); label "<name> (<#captured>)"
                   leave EMPTY = all playlists

Total items: [ 50 ]

Save as:  (•) New playlist  [ Random-3 ]      ← auto-derived, editable
          ( ) Replace "Random From All"

                                   [ Build ]  [ Cancel ]
```

- Both **source** checkboxes default **on**.
- **Both selectors start EMPTY**, and an empty selector means **no restriction =
  all** (an empty Playlists selector reproduces today's "sample from all
  playlists" behavior). Nothing is pre-selected.
- Toggling a source checkbox enables/disables (greys out) its selector block.
- **Matches per word**: number input, default **1**, min 1, max 10.
- **Sentences around word**: number input, default **2**, min 0, max 10. A
  single symmetric value → N lines before + N lines after the matched line.
  Seeds its default from `window._appSettings.contextLinesBefore/After` (2) but
  is set explicitly per-build here.
- **Total items**: number input, default **50** (the current `count` default).
- **Selectors**: both **Vocabulary categories** and **Playlists** are searchable
  **select2 multi-selects** (not checkbox lists), starting empty (empty = all),
  each label showing a count. `dropdownParent` set to the dialog so the search
  dropdown layers correctly above the modal (select2 is already a project
  dependency — `vendor/select2.min.js`, used for `#searchedWords`).
- **Save as (destination)**: radio group —
  - (•) **New playlist** — a text input pre-filled with an auto-derived unique
    name `Random-<N>` (`_nextRandomPlaylistName()` = first integer N for which
    `Random-N` is free); editable.
  - ( ) **Replace "Random From All"** — overwrites the reserved
    `RANDOM_REC_NAME` playlist.

  Default selection = **New playlist** (non-destructive). The chosen radio is the
  explicit intent, so no extra overwrite `confirm` is shown for Replace; a
  `confirm` fires only if a **New-playlist** name the user edited collides with
  an existing playlist.
- Dialog is transient — rebuilt each open (destroy+recreate like the virtual
  editor), so it always reflects the current playlists/vocabulary.

### Searchable select2 controls

`<select>`-based controls that become type-to-filter via select2:

1. **Header "Playlist:" dropdown** (`#recRecSelect`,
   [language.js:10058](../../../public/language/language.js#L10058)) in the
   Recorded Searches dialog — re-init `.select2()` after each
   `openRecordingReviewDialog` rebuild (single-select, searchable). This one
   still has a concrete active value (it switches the current playlist); the
   empty=all convention does **not** apply here.
2. **Random dialog Vocabulary-categories selector** — select2 multi-select,
   empty = all categories.
3. **Random dialog Playlists selector** — select2 multi-select, empty = all
   playlists.

All use the app's existing select2 vendor bundle; no new dependency.

## Behavior / build logic

On **Build**:

1. Read the form: `useAuto`, `useManual`, `vocabCategories[]`, `matchesPerWord`,
   `contextLines`, `playlists[]`, `count`, and the **destination**
   `{ mode: 'new' | 'replace', name }` (for `new`, `name` is the auto-derived /
   edited text; for `replace`, the target is `RANDOM_REC_NAME`). An empty
   `vocabCategories[]` means **all** categories; an empty `playlists[]` means
   **all** playlists.
2. **Guards** (alert + keep dialog open):
   - Neither source ticked → "Pick at least one source."
   - `mode:'new'` with an empty name → "Enter a name for the new playlist."
   - `mode:'new'` whose name collides with an existing playlist → overwrite
     `confirm`; abort on cancel. (`mode:'replace'` needs no confirm — the radio
     is the explicit intent.)
3. Build the **pool** = (auto items if `useAuto`) ∪ (manual items if `useManual`).
4. Dedupe by `(id, lineIndex)` (reuse the existing key scheme).
5. Empty pool → existing "No items … to sample from" alert; don't write.
6. Fisher-Yates shuffle → `slice(count)` → group into `items[st][w]` → write the
   **target playlist** (`destination.name` for `new`, else `RANDOM_REC_NAME`),
   deep-copied; then `selectRecording(target)` + reopen the review dialog.
   (Steps 4 & 6 are the existing tail of `createRandomFromAllPlaylist`, now
   parameterised by target name.)

### Automatic source (new)

`async function buildAutomaticItems({ vocabCategories, matchesPerWord, contextLines })`:

1. Ensure subtitles/vocab are ready (await `window._subtitlesReadyPromise` /
   `window._vocabularyReadyPromise`, mirroring `doSearch`). Operates only on the
   already-downloaded corpus in `window.allSubtitles` — no new network fetches.
2. Collect the candidate words = union of `window.vocabulary[cat]` for each
   selected `cat` (skip `VOCAB_HIDDEN_CATEGORIES`). An **empty**
   `vocabCategories` = all (non-hidden) categories.
3. For each word (sequentially, with a progress indicator reusing the
   `#srtLoadingBar`/`vocabLoadingBar` pattern):
   - `const results = await fetchFromDownloadedFiles(word)` — called with
     `token` **undefined** so it runs to completion and does not interfere with
     the live search token. This function is non-destructive: it returns matches
     and does not touch `window.searchText`, `window.searchResult`, or the DOM
     ([language.js:6455](../../../public/language/language.js#L6455)).
   - From each `SearchResult`, take the **target-language** parsed subs
     (`sv_subs`; fall back to `en_subs` only if the target side is empty) and
     find the line indices whose text matches the word (same regex the search
     uses, `_relaxSpaces` + case-insensitive).
   - Flatten to a list of `{ link, source, subs, i }` matches for the word;
     **shuffle** and take the first `matchesPerWord` (default 1).
   - For each kept match build a captured-shaped item, using the configurable
     `contextLines` (default 2) for the symmetric window:
     `{ searchText: word, word, id: link, source,
        timeStart: subs[max(0, i - contextLines)].ts,
        timeEnd:   subs[min(len-1, i + contextLines)].te,
        lineIndex: i, enabled: true }`
     (clamped at file edges; `contextLines = 0` → just the matched line).
4. Return the flat item array. Nothing is persisted here — the items only enter
   the target playlist via the shared tail (step 6 above).

### Manual source (existing items, filtered)

`function collectManualItems({ playlists })`: walk the selected real,
non-virtual playlists (an **empty** `playlists` = all real playlists); collect
every `!_isManualItem(it)` item. (Same flatten as today's
`createRandomFromAllPlaylist`, but scoped to `playlists` and skipping manual
flashcards.)

### Filters — strictly paired

- **Vocabulary categories** scope **only** the Automatic source (which words to
  search); empty = all.
- **Playlists** scope **only** the Manual source (which playlists to draw from);
  empty = all.
- No cross-application.

## API changes

- Refactor `createRandomFromAllPlaylist` into small, testable pieces:
  - `buildAutomaticItems({ vocabCategories, matchesPerWord, contextLines })` →
    `item[]` (async).
  - `collectManualItems({ playlists })` → `item[]`.
  - `assembleRandomPlaylist({ pool, count, targetName })` → dedupe + shuffle +
    slice + group + write `targetName` (defaults to `RANDOM_REC_NAME`); the
    existing tail, extracted and parameterised by target.
  - `_nextRandomPlaylistName()` → first free `Random-<N>` string.
- Keep a backwards-compatible `createRandomFromAllPlaylist({ count })` that = all
  playlists' manual/captured items into `RANDOM_REC_NAME` (so any other caller /
  test still works), or update its single call site. (One call site today: the
  `#recRecRandom` handler, which will now open the dialog instead.)
- New `_openRandomBuilderDialog()` — the dialog opener + Build handler. Wire the
  `#recRecRandom` click to it. Inits the Playlists select2 (with `dropdownParent`
  = the dialog).
- In `openRecordingReviewDialog`, after the header HTML is built, init
  `$('#recRecSelect').select2({...})` (searchable single-select); ensure any
  prior instance is destroyed first (dialog is rebuilt each open).
- Expose new pure functions on `window` for tests (consistent with
  `window.createRandomFromAllPlaylist`).

## Edge cases

- File-edge clamping for the ±N window (start/end of a video's subs).
- A word with zero subtitle matches contributes nothing.
- `matchesPerWord` larger than a word's match count → take what exists.
- Auto + Manual can surface the same clip; the `(id, lineIndex)` dedupe collapses
  duplicates (auto vs. manual copies of the same line).
- Subtitles not yet loaded → await the ready promise; if still empty, Automatic
  yields nothing and (if Manual is off/empty) the empty-pool alert fires.
- Deep-copy on write (already done) so the snapshot doesn't alias sources.

## Testing plan

Pure functions unit-tested in a `*.test.js` beside `language.js`
(follow the existing `public/language/*.test.js` jest+ESM pattern):

- **`buildAutomaticItems`** (with a stubbed `fetchFromDownloadedFiles` /
  `window.allSubtitles`): correct ±N window for a configurable `contextLines`
  (incl. `0` = matched line only, and a larger value), edge clamping at index 0
  and last line, item field shape, `matchesPerWord` cap, word with no matches,
  and **empty `vocabCategories` = all categories**.
- **`collectManualItems`**: restricts to selected playlists, **empty `playlists`
  = all real playlists**, excludes `manual:true` flashcards, excludes virtual
  playlists.
- **`assembleRandomPlaylist`**: dedupe by `(id, lineIndex)`, `count` slice,
  grouping shape, empty-pool returns false / no write, writes to the given
  `targetName` (new vs `RANDOM_REC_NAME`).
- **`_nextRandomPlaylistName`**: returns `Random-1` when none exist; skips taken
  numbers (e.g. returns `Random-3` when `Random-1`/`Random-2` exist).
- Guard logic (no source ticked / empty new-playlist name) — unit-test the
  validate helper. (Empty selectors are valid = all, not a guard.)

Dialog wiring itself is thin and mirrors the already-working
`_openVirtualPlaylistEditor`; not separately unit-tested.

## Non-goals / out of scope

- No category/tag field added to manual flashcards.
- Manual flashcards remain excluded from Practice Random.
- No new subtitle downloading — Automatic uses the already-downloaded corpus.
- Vocabulary categories do **not** filter manual items (strictly paired).
- Cross-language capture heuristics beyond "prefer target language" are left as-is.
