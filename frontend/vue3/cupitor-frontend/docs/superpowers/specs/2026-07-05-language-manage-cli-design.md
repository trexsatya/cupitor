# Language "Manage" CLI — Design

Date: 2026-07-05
Status: Implemented (2026-07-05)
Author: brainstormed with Claude

## Implementation summary

Built and verified. Shared pure modules (browser + Node, `public/language/`):
`vocab-expand.js`, `subtitle-naming.js`, `rare-words.js`, `filmot-parse.js` (plus
reuse of existing `srt-parser.js`, `search-text.js`, `vocab-merge.js`). Node CLI
(`tools/language/`, own `package.json {"type":"module"}`): `progress.js`,
`config.js`, `args.js`, `google-translate.js`, `srt-store.js`, `filmot-fetch.js`,
`youtube-channel.js`, `lang-manage.js` (the `rare`/`filmot`/`srt` orchestrator) +
`README.md` + `config.example.json`. `language.js` refactored to delegate
`expandWords`/`removeHintsInBrackets`/`getExpansionForWords`/filename helpers and
the `scanRareWords` regex/flatten to the shared modules (behavior-preserving).

`rare-words.js` also carries a **substring pre-filter** (`buildRareWordPrefilter` /
`prefilterHit`): each alternative's longest literal letter-run is a required
substring, so a cheap `includes()` gate skips the expensive Unicode-boundary regex
for subtitles that can't match. It's a sound necessary condition (letters are never
made optional), so results are byte-identical; both the CLI `rare` and the browser
`scanRareWords` use it (~3× faster).

Verified: full test suite **748 tests / 42 suites green** (incl. all pre-existing
language tests after the refactor); `rare` on the real 3036-file dataset → 3387 rare
words (identical with and without the pre-filter); `srt` offline end-to-end (SRT
write + index upsert + idempotent merge); `filmot-parse` on the real 244 KB sample
(60 cards, 307 lines, split-phrase context). Live filmot fetch + translate run by
the user (network not available in this env).

## 1. Goal

A Node CLI that automates three "Manage" workflows currently done by hand /
inside the browser app (`public/language/language.js`) and the Flutter app
(`flutter/Cupitor/lib/main.dart`), run **step by step** against **local data**:

1. **Rare words** — find vocabulary items that occur in fewer than *X* local
   subtitle files. Vocabulary lines are **expanded first** (the `<*`, `(hint)`,
   `a|b|c` syntax) before matching.
2. **Filmot** — for each rare word, find real usages on filmot.com: extract up
   to *X* matching videos, **exclude some channels**, **prefer manual captions**
   (auto-generated used only to top up the quota), and capture **N lines before
   / M after** the match (configurable) — correctly handling a search phrase
   that is **split across adjacent subtitle lines**.
3. **SRT** — translate the captured Swedish subtitles to a target language and
   **create or update** the paired `.sv.srt` / `.<target>.srt` files (plus the
   `index.json`).

Each step is independently runnable and **chunkable/resumable** so large jobs
can be spread across many runs (filmot and the free Google translate endpoint
both rate-limit).

## 2. Decisions (locked with the user)

- **Runtime:** Node CLI (Node 20, global `fetch`), operating on local files.
- **Filmot input:** live fetch only, with an on-disk page cache (`out/filmot-cache/`)
  so re-runs are cheap and robust.
- **Translation:** the unofficial `translate.googleapis.com` endpoint the Flutter
  app already uses (no API key). Batched, throttled, retried.
- **Code reuse:** refactor pure logic into **shared ES modules** imported by both
  the browser app and the Node CLI — no duplicated logic. Follows the repo's
  existing extracted-module + Jest convention (`srt-parser.js`, `search-text.js`, …).
- **Chunking:** steps 2 and 3 process work in bounded chunks and skip already-done
  units on re-run (progress state on disk).

## 3. Non-goals (YAGNI)

- No GUI; no changes to the browser app's behavior (refactor is behavior-preserving).
- No GitHub push from the CLI (the app already owns `uploadSrtToGithub`); the CLI
  writes to the **local** `trexsatya.github.io` working copy only. Committing/pushing
  stays a manual/separate step.
- No filmot pagination beyond the first results page in v1 (one search page yields
  up to ~60 candidate videos — enough for typical `maxItemsPerWord`). Pagination is
  a noted follow-up.
- No YouTube Data API. Channel names come from the public oembed endpoint.

## 4. Architecture — three layers

### 4.1 Shared pure modules (browser + Node; no DOM, no `fs`, no network)

| Module | Status | Responsibility |
|---|---|---|
| `srt-parser.js` | **exists** | `parseSrtEntries`, `entriesToSrtText`, `linesToSrtText`, `mergeSrtWithNewEntries`, `mergeSrtWithResolution`, `detectSrtConflicts`, `srtTimeToSeconds/FromValue`, `srtToJson`. All of task 3's SRT text logic. Reuse unchanged. |
| `search-text.js` | **exists** | `cleanSrtForMatch`, `relaxSpaces`, `withWordBoundaries`, `getSearchedTerms`, `getSurrounding`, `getWords`. Reuse for task 1 matching + task 2 context windows. |
| `stemming.js` | **exists** | `guessStems` — optional fuzzy fallback for filmot matching. |
| `vocab-expand.mjs` | **new** | Extract `expandWords` / `_expandWords` / `removeHintsInBrackets` out of `language.js`. Pure: takes the **expansion map** as a parameter (no `window.vocabulary`); replaces lodash `_.uniq` with plain JS. |
| `subtitle-naming.mjs` | **new** | Extract `sanitizeFilenameSegment` + `buildCapturedSubtitleBaseName` out of `language.js` (used by both the app and step 3's `srt-store`). Pure. |
| `rare-words.mjs` | **new** | Pure core of `scanRareWords`: `(expandedVocabLines, subtitleTexts, threshold) → [{line, category, count}]`. Builds the Unicode-boundary alternation regex exactly as the current scan does. |
| `filmot-parse.mjs` | **new** | Pure string parsers (no DOM): `parseSearchResults(html) → [{videoId, title, transcriptUrl, isAutoGenerated, views, likes, date}]`; `parseTranscript(html) → {videoId, videoTitle, lines:[{idx, ts, text}]}`; `findMatchWithContext(lines, regexOrTerms, before, after) → {matchIdx, tsStart, tsEnd, contextLines[]}`. |
| `vocab-file.mjs` | **new** | Parse `vocabulary.txt` into `{ categories: {name: lines[]}, expansionMap }` (the `#Header` categories + the `expansions` category → `getExpansionForWords` shape). Pure (string in → object out). |

> The browser today derives the expansion map from `window.vocabulary['expansions']`
> inside `getExpansionForWords()`. That stays; we only lift the *pure transform* so
> both callers pass the same map into `vocab-expand`.

### 4.2 Node-only helpers (`.mjs`; use `fs` / `fetch`)

| Module | Responsibility |
|---|---|
| `filmot-fetch.mjs` | GET the search page (`/search/"word"/1?lang=sv`) and each per-video transcript page (the vlink `/search/"word"/<id>/1?lang=sv`). Browser-like `User-Agent`. Disk cache keyed by URL under `out/filmot-cache/`. Throttle + retry/backoff. |
| `youtube-channel.mjs` | Resolve `videoId → channelName` via `https://www.youtube.com/oembed?url=…&format=json` (`author_name`). Cache to `out/channel-cache.json`. |
| `google-translate.mjs` | Batch SV→target via `translate.googleapis.com/translate_a/single`. Chunk request size, throttle, retry; provider hidden behind one `translateBatch(texts, from, to)` fn so a paid provider can drop in later. |
| `srt-store.mjs` | Local `fs` read/write of SRT files + `index.json`. Uses `srt-parser.js` for all text; `buildCapturedSubtitleBaseName` for filenames. Create-or-merge semantics. |
| `config.mjs` | Load `config.json`, merge CLI flags, validate paths. |
| `progress.mjs` | Read/write per-step progress state; provides the chunk iterator (see §6). |

### 4.3 CLI orchestrator — `tools/lang-manage.mjs`

Three subcommands, each reads/writes a JSON artifact so steps run independently:

```
node tools/lang-manage.mjs rare   [--threshold X] [--category C]
node tools/lang-manage.mjs filmot [--chunk N] [--words a,b,..] [--max X] [--before 3] [--after 3] [--reset]
node tools/lang-manage.mjs srt    [--chunk N] [--reset]
```

## 5. Data flow & artifacts

```
vocabulary.txt + srts/*.srt
        │  rare
        ▼
out/rare-words.json        [{ line, category, count, expanded }]
        │  filmot   (chunked, resumable)
        ▼
out/filmot-hits.json       { word: [ {videoId, title, channel, isAutoGenerated,
                                      transcriptUrl, tsStart, tsEnd,
                                      matchIdx, matchReason, lines:[{ts,text}] } ] }
out/filmot-progress.json   { doneWords:[...], skipped:{...} }
        │  srt      (chunked, resumable)
        ▼
srts/<base>.sv.srt  +  srts/<base>.<target>.srt   (created or merged)
srts/index.json                                    (upserted)
out/srt-progress.json      { doneVideoIds:[...] }
```

### 5.1 Artifact schemas (concrete)

`rare-words.json` entry:
```json
{ "line": "(sense)|känna|känner|kände|känt|känn", "category": "Very Basic",
  "count": 1, "expanded": "känna|känner|kände|känt|känn" }
```

`filmot-hits.json` value (per word → array of video hits):
```json
{ "videoId": "NxAaT1Yj9OE", "title": "GTA 5 LASERVAPEN!!!",
  "channel": "SomeChannel", "isAutoGenerated": true,
  "transcriptUrl": "https://filmot.com/search/%22åtgång%22/NxAaT1Yj9OE/1?lang=sv",
  "tsStart": 671.639, "tsEnd": 674.9, "matchIdx": 202, "matchReason": "exact",
  "lines": [ {"ts":665.1,"text":"…"}, {"ts":671.639,"text":"…åtgång…"}, … ] }
```

## 6. Chunking & resumability (steps 2 & 3)

Both steps follow one pattern (in `progress.mjs`):

- **Unit of work:** step 2 = one rare *word*; step 3 = one *video hit* (videoId).
- **Progress file** records completed units. On each run the CLI computes
  `pending = allUnits − done`, takes the **first `--chunk N`** (default 10 for
  filmot words, 20 for srt videos), processes them, and appends results +
  marks them done — atomically per unit, so a crash mid-chunk loses at most the
  in-flight unit.
- **Re-run** = "process the next chunk." Repeat until `pending` is empty; the CLI
  prints `done/total` and the exit signals whether work remains.
- `--words a,b,c` / explicit selection overrides the auto chunk (targeted re-runs).
- `--reset` clears that step's progress to start over.
- **Throttling** lives inside the fetch/translate helpers (per-request delay +
  backoff); chunking bounds *how much* runs per invocation, throttling bounds
  *how fast*. The filmot page cache and channel cache persist across chunks.

This directly satisfies "the script doesn't have to do everything in one go."

## 7. Filmot specifics

- **Candidate discovery:** parse the search page's `vcard_<videoId>` cards →
  videoId, title, view/like/date, the per-video `transcriptUrl` (vlink `href`),
  and **auto/manual** from the sidebyside link label (`(auto-generated)` / `auto.sv`
  ⇒ auto; plain `Swedish` / `sv` ⇒ manual).
- **Ordering / quota:** drop excluded-channel videos; take manual-caption videos
  first; fill the remaining `maxItemsPerWord` slots from auto-generated ones only
  if manual didn't reach the quota.
- **Transcript + match:** fetch each chosen video's transcript page; `#subtitlesIn`
  gives `<div id="sN"><a href="javascript:jtt(N,ts)">▶</a>TEXT</div>` lines.
- **Phrase split across lines:** join the line texts into one string while
  recording each line's char-span; run the expanded/relaxed regex over the joined
  string; map the match span back to the set of `sN` lines it touches; then take
  `before` lines above the first touched line and `after` below the last. Reuse
  `cleanSrtForMatch` + `relaxSpaces` + `withWordBoundaries` from `search-text.js`.
  Fallback cascade mirrors the Flutter `findMatch`: exact → diacritic-insensitive
  → stem-prefix → token-overlap.
- **Channel exclusion:** filmot pages carry no channel name; resolve `videoId →
  channel` via YouTube oembed (cached), compare against `excludeChannels`.

## 8. Translation & SRT write (step 3)

- Source lines for a hit = its captured context `lines` (SV). Translate each to
  `targetLang` via `google-translate.mjs` (batched).
- Build SRT entries `{start, end, text}` from `{ts, text}` (end = next line's ts,
  or `ts + defaultDur`). Serialize/merge with `srt-parser.js`:
  - New file → `linesToSrtText`.
  - Existing file → `mergeSrtWithNewEntries` (dedupe same start+text). Conflicts
    surfaced via `detectSrtConflicts`; default resolution keeps existing (config
    `srtConflict: keep|overwrite`), no interactive prompt in the CLI.
- Filenames: `buildCapturedSubtitleBaseName({videoId, videoTitle, channel})` →
  `<channel || title || id>` + `.sv.srt` / `.<target>.srt`, NFC-normalized.
- Upsert `index.json` (`{link: videoId, name: base, source:"YouTube"}`), NFC names,
  no duplicate `link`.

## 9. `language.js` refactor (behavior-preserving)

Replace the bodies of `expandWords`, `removeHintsInBrackets`,
`buildCapturedSubtitleBaseName`, `sanitizeFilenameSegment`, and the counting core
of `scanRareWords` with calls into the new shared modules — leaving thin wrappers
that pass `window`-derived data in (exactly as `getSearchedTerms` already delegates
to `_coreGetSearchedTerms`). No user-visible change; covered by the new module
tests + the existing suite (`yarn test:unit`).

## 10. ESM interop — first-task spike (the one real integration unknown)

The browser loads `public/**` as **native ESM**; Jest transpiles `.js` ESM→CJS via
babel; the root is CommonJS (no `"type"`). A **native Node** process therefore
cannot `import` the existing `public/language/*.js` ESM files as-is. Task 0 of the
plan resolves this empirically, in this order:

1. **Default:** add a scoped `public/language/package.json` `{"type":"module"}`.
   Run `yarn test:unit` — if green **and** `node` can import `srt-parser.js`, done.
2. **Fallback A:** author the *new* modules as `.mjs` and reference the two needed
   existing ones through `.mjs` copies/renames (update importers + jest
   `moduleFileExtensions`).
3. **Fallback B:** run the CLI through the repo's babel (`@babel/register`/esbuild
   loader) so `.js` ESM resolves without touching the shared files.

Whichever passes the existing suite + a `node -e "import(...)"` smoke wins.

**RESOLVED (2026-07-05 spike):** the scoped `public/language/package.json`
`{"type":"module"}` works — Node natively imports `srt-parser.js` / `search-text.js`
(graph fully contained in `public/language/`, explicit `.js` extensions), and the
full `language/` Jest suite stays green (**1362 tests, 62 suites**). Therefore **all
shared + new pure modules stay `.js` under `public/language/`** (browser + Node +
Jest), and **no `.mjs` is used anywhere**. Node-only fs/fetch helpers + the CLI live
under a new `tools/language/` with its own `package.json {"type":"module"}`. NOTE:
the real test runner is `npx jest` (Jest 27); the `test:unit` npm script is legacy
mocha and is not used.

**Empirical host check (2026-07-05):** the live site is GitHub Pages behind the
custom domain `satyendra.website`; it serves `.js` as `application/javascript`
(modules load fine) but `.mjs` is unverified and GitHub Pages has historically
served `.mjs` as `application/octet-stream` (breaks module loading). Conclusion:
**browser-served shared modules stay `.js`** — the `.mjs`-for-browser option is
ruled out for this host. The interop decision is therefore scoped-`package.json`
(default) vs babel loader (fallback) only; Node-only CLI files remain `.mjs`.

## 11. Config (`config.json`, CLI flags override)

```json
{ "lang": "sv", "targetLang": "en",
  "dataDir": "/…/trexsatya.github.io/db/language/swedish",
  "srtsDir": "/…/swedish/srts", "outDir": "./out",
  "rareThreshold": 2, "maxItemsPerWord": 5,
  "linesBefore": 3, "linesAfter": 3,
  "excludeChannels": [], "preferManualCaptions": true,
  "filmotDelayMs": 1500, "translateDelayMs": 800,
  "chunkFilmot": 10, "chunkSrt": 20, "srtConflict": "keep" }
```

## 12. Testing

- New Jest `*.test.js` per shared module (repo convention):
  - `vocab-expand` — real `vocabulary.txt` lines: `<*` refs, nested `(hints)`,
    `a|b|c`, short-form dropping.
  - `rare-words` — count vs threshold, boundary anchoring, short-alt dropping.
  - `filmot-parse` — **fixture = the saved sample HTML** (`filmot_sample.html`):
    finds åtgång at s203 split across s202/s203; card auto/manual detection;
    videoId/title/transcriptUrl extraction.
  - `vocab-file` — category + expansion-map parsing.
  - `srt-store` — create vs merge vs conflict, index upsert, filename convention.
- Node-only helpers: small integration smoke tests (fetch/translate) guarded so
  they don't run offline; the fixture-based parse tests carry the real coverage.
- Regression: `yarn test:unit` stays green after the `language.js` refactor.

## 13. Step-by-step usage (target UX)

```
# 1. Rare words below threshold 2
node tools/lang-manage.mjs rare --threshold 2
# → out/rare-words.json

# 2. Filmot, 10 words per run, 5 videos each, 3 lines of context
node tools/lang-manage.mjs filmot --chunk 10 --max 5 --before 3 --after 3
node tools/lang-manage.mjs filmot --chunk 10      # next 10 … repeat until done
node tools/lang-manage.mjs filmot --words åtgång  # targeted redo

# 3. Translate + write/update SRTs, 20 videos per run
node tools/lang-manage.mjs srt --chunk 20
node tools/lang-manage.mjs srt --chunk 20         # repeat until done
```

## 14. Risks / open items

- **ESM interop** (§10) — resolved by the Task 0 spike.
- **Filmot HTML drift** — parser is fixture-tested; if filmot changes markup, the
  fixture + parser update together.
- **Rate limiting / blocking** — mitigated by throttle + cache + chunking; the free
  translate endpoint may still 429 (backoff + resume on next run).
- **Channel resolution gaps** — oembed can fail (private/deleted video); such a
  video is kept unless its (unknown) channel matches the exclude list; logged.
- **filmot pagination** — v1 uses the first results page only; note for later.
```
