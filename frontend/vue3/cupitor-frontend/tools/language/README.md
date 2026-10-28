# language "Manage" CLI

Node CLI for study-data workflows against your **local** language
data. Runs step by step; steps 2 and 3 are chunkable/resumable. Requires Node 18+
(uses global `fetch`). No npm install — it imports the shared pure modules under
`public/language/` (they are the same source of truth the browser app uses).

Design spec: `docs/superpowers/specs/2026-07-05-language-manage-cli-design.md`.

## Setup

```bash
cp tools/language/config.example.json config.json   # edit paths, then omit --dataDir/--srtsDir
```

Config is layered: built-in defaults ← `config.json` (or `--config path`) ← CLI flags.

## Config reference

Every key you can set in `config.json` (all optional — omit to take the default).
See `config.example.json` for a ready-to-edit copy.

| Key | Default | Meaning |
|---|---|---|
| `lang` | `sv` | source language of your vocab/subtitles |
| `targetLang` | `en` | language captured subtitles are translated into (step 3) |
| `dataDir` | — | folder with `vocabulary.txt` + `srts/` (step 1 input) |
| `srtsDir` | — | subtitle storage directory; captures/imports update its packs and metadata when bundled, or individual SRTs in a legacy directory |
| `outDir` | `./out` | working dir for `rare-words.json`, progress files, caches |
| `rareThreshold` | `2` | a word is "rare" if it appears in fewer than this many subtitle files |
| `maxItemsPerWord` | `5` | max videos captured per word (step 2) |
| `linesBefore` / `linesAfter` | `3` / `3` | context lines kept around each match |
| `excludeChannels` | `[]` | channel names to **hard-drop** (resolved via oembed, cached) |
| `blacklistChannels` | `[]` | channel names to **soft de-prioritize** — captured only if non-blacklisted videos are insufficient (see `maxSearchPages`) |
| `preferManualCaptions` | `true` | use auto-generated captions only to fill the quota |
| **`filmotMode`** | `http` | **`"api"`** (recommended with a Filmot API key), `"browser"` (legacy), or `"http"` (legacy) |
| `apiChannelLimit` | `10` | Number of most-represented channels in the local Cupitor SRT index to prioritize. Fewer = cheaper. |
| `apiChannelGroups` | `2` | At most two discounted Filmot searches per term (5 UC IDs each). |
| `apiMaxCreditsPerWord` | `30` | Conservative maximum estimated **new** search/details credits for one word; cached responses are free. |
| `apiUnrestrictedFallback` | `true` | After discounted channel searches, search all other Filmot channels only if more examples are needed. |
| **`browserHeadless`** | `false` | browser mode: `true` hides the window. Keep `false` the first time so you can log in / solve the captcha once |
| **`browserUserDataDir`** | `./out/filmot-browser` | persistent Chromium profile dir — keeps you logged into filmot across runs |
| `filmotCookie` | `""` | **http mode only:** your logged-in filmot `Cookie` header (or `FILMOT_COOKIE` env) |
| `userAgent` | `""` | **http mode only:** the matching browser User-Agent |
| `maxSearchPages` | `3` | max filmot result pages fetched per alternative term (only pages past 1 when a blacklist is set and page 1 lacks enough non-blacklisted candidates) |
| `filmotDelayMs` | `1500` | throttle between filmot requests (ms) |
| `translateDelayMs` | `800` | throttle between translate requests (ms) |
| `chunkFilmot` / `chunkSrt` | `10` / `20` | default units per run when `--chunk` isn't given |
| `defaultDurSec` | `3` | fallback subtitle duration (s) when the last line has no next timestamp |

## Steps


### On-demand SRT collection for a word list

Use **collect** when you want at least N *different subtitle videos* containing
each requested word or phrase. Unlike "filmot --words", this checks local
coverage **before spending Filmot credits**, fetches only missing videos and
merges clips into existing SRTs, rather than capturing a fixed number for every
word. The threshold means distinct subtitle videos, **not occurrences within
one video**. Counts use the same per-alternative expansion and Swedish/English
matching as the existing "rare" scan.

Provide either comma-separated words or a UTF-8 file with one item per line
(blank lines and lines beginning with `#` are ignored). You may combine both.
Alternatively, scope the vocabulary via `--category`. You do **not** need to
run `rare`, `filmot` or `srt` first.

```bash
# Inspect which terms need more SRT coverage, without calling Filmot.
node tools/language/lang-manage.js collect --words 'gäller,förargas,uppmana' --threshold 3 --dry-run

# Search for missing coverage and merge the new clips into srtsDir.
export FILMOT_API_KEY='your-api-key'
node tools/language/lang-manage.js collect --wordsFile ./wanted-words.txt --threshold 3 --api

# Fast source-only captures; no translations.
node tools/language/lang-manage.js collect --wordsFile ./wanted-words.txt --threshold 3 --api --no-translate

# Collect the next 20 under-covered words from one vocabulary category.
node tools/language/lang-manage.js collect --category 'Feelings' --threshold 3 --chunk 20 --api
```

A word with 0 sources needs 3; one with 2 needs 1; one with 3 or more
causes **no Filmot request**. The tool avoids requesting videos already
covering a word, and rechecks coverage against the real SRT store after
every word, including videos captured for earlier words in the same run.
Partial runs and interrupted runs are **resumed by running the same command
again**. No separate progress reset is needed, and the previous `rare`,
`filmot` and `srt` progress files are left untouched.

Filmot's channel-restricted API search remains the first choice, with the
configured fallback/budget. `collect` currently requires `--api` (or
`filmotMode: "api"`). `maxItemsPerWord` / `--max` caps the number of
new videos requested per word in one invocation (default 5), so high
thresholds may take multiple runs. When Filmot returns fewer matches than
the deficit, the tool records the remaining gap instead of pretending the
threshold was reached.

Each run writes a preview to `out/collect-plan.json` and, for a live run,
results to `out/collect-results.json`. Translation errors, cue conflicts,
quota limits and unsearchable expressions are reported instead of silently
being counted as collected. Existing indexed video names and timestamps
are retained by the normal SRT merge logic. Keep `FILMOT_API_KEY` in your
environment, never in the repository.


### 1. Rare words (offline)
Find vocabulary items occurring in fewer than `rareThreshold` local subtitle files.
Vocab lines are expanded first (`<*`, `(hints)`, `a|b|c`), then **each expanded
alternative is judged on its own** — so a rare idiom bundled with common synonyms
in the same line (e.g. `sålla agnarna från vetet` sitting next to `sila`/`filtrera`)
still surfaces instead of being masked by the common words. Alternatives are
deduped across lines (first category wins). This makes the output larger than a
per-line scan.

```bash
node tools/language/lang-manage.js rare --threshold 2
node tools/language/lang-manage.js rare --category "Feelings, emotions"  # rescan one category
# → out/rare-words.json   [{ line, category, count, expanded }]
```

`--category` scans only that category's vocab lines (faster) and **merges** the
result into `rare-words.json` — it replaces that category's entries and leaves the
rest of the file untouched, so scanning one category never wipes the others.

### Official Filmot API (recommended for step 2)

Obtain a Filmot API key at <https://filmot.com/api-keys>. Keep it **outside the repo**, in your shell environment:

```bash
export FILMOT_API_KEY='your-api-key'
node tools/language/lang-manage.js filmot --api --chunk 10
# Tune the budget: at most 10 Cupitor channels, in 2 groups of 5.
node tools/language/lang-manage.js filmot --api --channelLimit 10 --channelGroups 2 --apiCredits 30
# Optional: only discounted Cupitor channels, do not broaden to the whole Filmot index.
node tools/language/lang-manage.js filmot --api --no-unrestricted
```

First run `rare` and configure `srtsDir` to your **local Cupitor subtitle library**. The API mode reads `srtsDir/index.json`, ranks the channels represented there by distinct video count, then asks Filmot's `getvideos` API for the real UC channel IDs of representative videos. This is one batched, cached lookup for the chosen channel names, not a paid name lookup for every channel. If a channel name cannot be verified against the matching video's Filmot metadata, it is skipped instead of guessing an unrelated ID.

For each rare word, API mode searches the priority channel IDs in **groups of at most five** (Filmot's discounted rate), stopping early when it finds enough verified transcript matches. It then searches **unrestricted** only when necessary. It requests the caption lines and preserves the existing `filmot-hits.json` format for translation and SRT import. The index may contain thousands of channels; searching each of them individually would be *more expensive* than one unrestricted request, so the priority set is intentionally bounded and configurable.

The API client caches successful responses under `out/filmot-api-cache/`, channel IDs in `out/filmot-api-channels.json`, and retains standard `filmot-progress.json` resumability. A 429 quota response aborts the run without marking the affected word done. A per-word budget limits unexpected charges and unfinished words remain pending. The actual request costs/remaining allowance are printed from response headers when available. **No live request is performed until an API key is supplied.**

The older HTTP/Playwright fetching methods remain available for existing configs and are described below.

> **Getting past filmot's captcha.** filmot shows an hCaptcha "Verify You're
> Human" wall to non-browser clients (it fingerprints the client, so a pasted
> login cookie usually isn't enough). Two modes:
>
> **Browser mode (recommended, `filmotMode: "browser"`).** Drives a real Chromium
> via Playwright. A real browser fingerprint + your logged-in session gets past the
> wall.
> 1. Install once: `npm i playwright && npx playwright install chromium`
> 2. Put your logged-in filmot **Cookie** header in `config.json` as `filmotCookie`
>    (DevTools → Network → any filmot request → copy the `Cookie` header). Browser
>    mode **injects** it, so you don't log in inside the automated window.
>    ⚠️ Don't try to sign in *inside* the Playwright window with Google — Google
>    refuses OAuth in automated browsers ("this browser may not be secure"). The
>    injected cookie avoids that entirely; if you must log in interactively, use
>    Patreon **email + password**, not the Google button.
> 3. Run with `"filmotMode": "browser"` (or `--browser`). Results should load with
>    no login. The profile persists in `browserUserDataDir`; add `--headless` for
>    unattended runs once it works.
>
> **HTTP mode (`filmotMode: "http"`, fallback).** Paste your logged-in filmot
> **Cookie** header + matching **User-Agent** (DevTools → Network → document
> request) into `config.json` as `filmotCookie` / `userAgent` (or `FILMOT_COOKIE`
> env). Often still blocked by the fingerprint check — prefer browser mode.
>
> Either way: if filmot challenges, the CLI stops with a clear message and does
> **not** advance progress (already-done words are kept). Captcha pages are never
> cached and previously-cached ones are ignored, so it self-heals.

### 2. Filmot (live, chunked by word)
For each rare word, search filmot.com (one search per `|`-alternative, aggregated),
pick up to `maxItemsPerWord` videos
(excluded channels dropped, manual captions preferred, auto-generated only to fill
the quota), and capture `linesBefore`/`linesAfter` lines around the match
(handles a phrase split across subtitle lines).

```bash
node tools/language/lang-manage.js filmot --chunk 10 --max 5 --before 3 --after 3
node tools/language/lang-manage.js filmot --chunk 10          # next 10 words … repeat
node tools/language/lang-manage.js filmot --words åtgång,glädje  # targeted re-run
node tools/language/lang-manage.js filmot --reset             # start this step over
# → out/filmot-hits.json, out/filmot-progress.json, out/filmot-cache/, out/channel-cache.json
```

Fetched pages are cached under `out/filmot-cache/`, so re-runs are cheap. Channels
are resolved via YouTube oembed (cached) only when `excludeChannels` **or**
`blacklistChannels` is set.

**Exclude vs. blacklist a channel.** Two independent channel lists (both matched
by oembed display name):
- `excludeChannels` — **hard**: matching videos are dropped and never captured.
- `blacklistChannels` — **soft**: matching videos are ranked last and captured
  *only* to fill the quota when non-blacklisted videos aren't enough. The exact
  order is manual/non-blacklisted → manual/blacklisted → auto/non-blacklisted →
  auto/blacklisted (caption quality first, blacklist as the tiebreaker).

  To honour "only if others aren't sufficient," a blacklisted word pages through
  filmot results (up to `maxSearchPages`, default 3) looking for enough
  non-blacklisted candidates before it settles for blacklisted ones — so a
  blacklist run does more fetching (and channel lookups) than a plain run. Runs
  with an empty blacklist are unchanged: page 1 only, no extra requests. If a
  channel is in both lists, exclude wins.

**Scope to a vocabulary category.** `rare-words.json` carries each word's category.
List them, then restrict step 2 (and step 3) to one:
```bash
node tools/language/lang-manage.js categories                 # e.g. 167 Feelings, emotions
node tools/language/lang-manage.js filmot --browser --category "Feelings, emotions" --chunk 10
```
`--category` is a case-insensitive substring, and progress stays global — so a
category run only touches that category's words but won't redo ones already done.
(Tip: the big "Idioms"/"Sayings"/"Metaphors" categories are multi-word phrases that
rarely appear verbatim on YouTube; single-word categories yield more hits.)

### 3. SRT (translate + write, chunked by video)
Translate each captured hit (SV→`targetLang`, Google's free endpoint) and
save the paired source/target tracks, updating `index.json`. Bundled directories
update their existing packs and manifest directly; legacy directories write
individual `.srt` files. Existing tracks are **merged by video ID**, not replaced: capturing another word
from the same YouTube video adds its non-overlapping timestamped cues to the
existing source and translated tracks, without creating another indexed video.
Overlapping context lines are deduplicated by start timestamp, and an identical
rerun leaves the store unchanged. An existing filename and index metadata are
retained even if Filmot later supplies a different video title/channel.

If two captured cues disagree at the same timestamp, `srtConflict: "keep"`
(the default) preserves the earlier cue instead of writing competing SRT blocks.
Use `--srtConflict replace` to accept the new cue or
`--srtConflict error` to reject the capture without writing either track.
The selected policy applies independently to each language; on error, a failed
hit is left pending for retry. A source-only capture retains any previously
translated cues and does not generate an empty target track.

```bash
node tools/language/lang-manage.js srt --chunk 20
node tools/language/lang-manage.js srt --chunk 20             # repeat until done
node tools/language/lang-manage.js srt --no-translate         # source snippet only, no Google calls
node tools/language/lang-manage.js srt --reset
# → srts/packs/*.json + srts/storage.json + srts/index.json (bundled storage)
```

`--no-translate` skips the Google translate calls entirely and writes only the
source `.<lang>.srt` snippet (no `.<target>.srt`); `index.json` is still updated.
Useful to grab snippets fast without the translate rate-limit. It still advances
progress, so to translate those videos later, re-run `srt --reset` (or clear
`out/srt-progress.json`) and run again without the flag.

### Repair duplicate subtitle tracks across bundles (offline)

If `rare`, `prune`, or another command fails with
`Subtitle appears in more than one bundle: ...`, **do not delete a pack**.
A pack contains many unrelated videos. Run the offline repair preview:

```bash
node tools/language/lang-manage.js repair
node tools/language/lang-manage.js repair --apply
node tools/language/lang-manage.js prune
```

`repair` reads `storage.json`, every referenced pack, and `index.json`.
It reports each duplicate key and the packs holding it. The dry run modifies
nothing. `--apply` removes only duplicate tracks whose contents are identical,
moves the **whole media's language tracks together**, preserves other media in
those packs, and updates bundle file counts, revisions, and index pointers.
It creates a sibling backup folder (`<srtsDir>-repair-backup-XXXXXX`) containing
the original files it changed or deleted. Review `git diff` before committing.

If copies contain different text, nothing is written and the conflicting
packs are listed. To **read the actual subtitle text**, without opening raw
bundle JSON (which escapes all line breaks), run:

```bash
# Print full readable SRTs from every pack containing a conflicting copy
node tools/language/lang-manage.js repair --inspect

# Show only conflicts for a particular YouTube video
node tools/language/lang-manage.js repair --inspect --link gJKWuME2fhc

# Save both versions as normal .srt files, along with a manifest naming
# the original packs. Choose a new, empty directory outside srtsDir.
node tools/language/lang-manage.js repair --exportDir ./out/srt-conflicts
```

The `--inspect` mode prints each version with timestamps and its pack name.
`--exportDir` writes the **exact original SRT text** from each conflicting
bundle, plus `manifest.json` recording the full subtitle filename and pack.
Neither mode repairs, merges, or changes any existing bundle. You cannot
combine these modes with `--apply`. The export destination must be an empty
directory *outside* the SRT storage folder.

If copies have *different timestamp ranges*, you can opt in
to combining their SRT cues with:

```bash
node tools/language/lang-manage.js repair --merge     # preview
node tools/language/lang-manage.js repair --merge --apply
```

If copies disagree at the **same** timestamp, the repair refuses to choose
a subtitle automatically, even with `--merge`. Compare the reported pack
files and resolve their text manually, then rerun `repair`. Use
`--srtsDir /path/to/db/language/swedish/srts` if your configured data
directory is not the one you want to repair. GitHub-published files may differ
from uncommitted files on your computer.

### 4. Prune / shrink full-video transcripts (offline)
Full-video transcripts (span > `pruneMinSpanSec`, default 60s) eat disk; the small
captured snippets (a few seconds' span) are what you keep. Rather than delete a
whole 30-minute transcript just because it holds one rare word, `prune` **shrinks**
each transcript to `±pruneWindowLines` (default 4) lines around only the dictionary
items that live *nowhere else* — one window per item (its first occurrence; a
recurring word doesn't keep a window each time) — then renumbers and rewrites the
`.sv`/`.en` files.
A transcript whose items are all covered elsewhere (snippets or other transcripts)
is deleted outright.

```bash
node tools/language/lang-manage.js prune                 # dry run: writes out/prune-plan.json, changes nothing
node tools/language/lang-manage.js prune --window 6      # keep ±6 lines of context
node tools/language/lang-manage.js prune --minSpan 120   # only shrink transcripts spanning > 2 min
node tools/language/lang-manage.js prune --apply         # rewrite/delete the files + prune index.json
```

Coverage is preserved: items already in a snippet need no window; items found only
in transcripts are assigned to the fewest transcripts (greedy set cover) so every
dictionary item still lives in at least one file. Dry-run is the default; only
`--apply` touches your srts.

### 5. Import SRT files you create or download (offline)

You can still generate or download ordinary SRT files. Import them instead of
committing those loose files into a bundled repository. Use Node 18+; this command
needs no npm packages and makes no network calls.

For files named `Channel || Title || VIDEO_ID.sv.srt` and matching `.en.srt`
translations, the ID and languages are inferred. With `srtsDir` configured:

```bash
node tools/language/lang-manage.js import --input ~/new-subtitles       # preview
node tools/language/lang-manage.js import --input ~/new-subtitles --apply
```

The input may be one file or a folder (including subfolders). Existing index
entries are reused by filename or media ID, so a title change does not create a
second indexed copy. New records default to `source: "YouTube"`; use `--source`
for another provider. A folder may also contain an `index.json` array with
`name`, `link`, and `source` records, using the same format as the existing index.
Its names must match the input filename bases. Other metadata is retained;
foreign bundle paths/revisions are ignored.

For a plain SRT generated by `make-srt.py`, supply its media ID (or YouTube video
URL) and optional
display metadata. `--lang` supplies the language when the filename has no
language suffix; `.sv.srt`, `.en.srt`, `.es.srt`, etc. identify it directly:

```bash
python tools/language/make-srt.py episode.mp3 -l sv -o ./out/episode.sv.srt
node tools/language/lang-manage.js import --input ./out/episode.sv.srt \
  --link VIDEO_ID --title "Episode title" --channel "Channel" --apply
```

You can also keep the old copy-into-`srts/` habit, then run:

```bash
node tools/language/lang-manage.js import          # preview the dropped-in files
node tools/language/lang-manage.js import --apply  # pack them and update the index
```

The importer verifies the stored tracks before removing those in-place loose
copies. Originals outside `srtsDir` are always kept. New and replacement tracks
retain their exact UTF-8 text, including BOMs, CRLF and timings. Input errors or
conflicts abort the preview before any data is written. Each invocation replans
against current files; changes detected between planning and applying that run
abort the operation rather than overwriting newer data.

If a track already has different text, choose explicitly:

```bash
node tools/language/lang-manage.js import --input ~/new-subtitles --merge --apply
node tools/language/lang-manage.js import --input ~/new-subtitles --replace --apply
```

`--merge` unions cues using the capture merger, renumbering/normalizing the SRT;
`--replace` stores the supplied track exactly. Other languages and media sharing
the same pack are preserved. Identical imports are no-ops. Empty/new stores start
bundled automatically. Existing legacy stores keep their individual-file format;
use `subtitle-bundles.mjs pack <srts-dir> --apply` once to migrate them first.

The command prints the actual pack/index/manifest paths changed. Review and push
those changes in your **data repository** checkout:

```bash
git diff --stat
git add -A -- db/language/swedish/srts
git commit -m "Import subtitles"
git push origin gh-pages
```

`--srtsDir /path/to/trexsatya.github.io/db/language/swedish/srts` overrides config
for any import; `--dataDir` also works when it contains an `srts/` directory.
Run `lang-manage.js import --help` for all import options.

## Flags

Flags override the matching config key for one run (see the table above for what
each key means).

| Flag | Overrides config key | Default |
|---|---|---|
| `--config <path>` | (which file to load) | `config.json` |
| `--dataDir` / `--srtsDir` / `--outDir` | `dataDir` / `srtsDir` / `outDir` | from config |
| `--lang` / `--targetLang` | `lang` / `targetLang` | `sv` / `en` |
| `--threshold N` | `rareThreshold` (count < N) | 2 |
| `--max N` | `maxItemsPerWord` (videos per word, filmot) | 5 |
| `--maxPages N` | `maxSearchPages` (filmot pages per term, only used in blacklist mode) | 3 |
| `--before N` / `--after N` | `linesBefore` / `linesAfter` | 3 / 3 |
| `--chunk N` | `chunkFilmot` / `chunkSrt` (words for filmot, videos for srt) | 10 / 20 |
| `--words a,b,c` | process only these words (filmot) | — |
| `--category "<name>"` | scope rare/filmot/srt to one vocab category (case-insensitive substring); on `rare` it merges into the existing file | — |
| `--reset` | clear the step's progress | — |
| `--no-translate` | `srt` writes only the source snippet, no translation call | — |
| `--api` | sets `filmotMode: "api"` | (config `filmotMode`) |
| `--channelLimit N` / `--channelGroups N` | `apiChannelLimit` / `apiChannelGroups` | 10 / 2 |
| `--apiCredits N` / `--no-unrestricted` | `apiMaxCreditsPerWord` / `apiUnrestrictedFallback: false` | 30 / unrestricted enabled |
| `--browser` | sets `filmotMode: "browser"` | (config `filmotMode`) |
| `--headed` / `--headless` | sets `browserHeadless: false` / `true` | headed |
| `--minSpan N` | `pruneMinSpanSec` (a transcript counts as "full-video" if it spans > N s) | 60 |
| `--window N` | `pruneWindowLines` (context lines kept each side of a preserved item) | 4 |
| `--apply` | `prune` actually rewrites/deletes (default is a dry-run plan) | — |
| `--input <file-or-folder>` | SRT import source; omit to ingest loose files in `srtsDir` | `srtsDir` |
| `--link <media-id-or-YouTube-url>` | link for importing one media whose filename lacks an ID | inferred/indexed |
| `--title` / `--channel` / `--source` | metadata for a new imported media | filename / `YouTube` |
| `--merge` / `--replace` | how an import resolves different existing text; mutually exclusive | abort on conflict |
| `--apply` (import) | write the previewed storage changes and verify imported tracks | dry run |

## Notes

- **Runtime:** `rare` scans every local subtitle (≈3000 files / 40 MB) and is a
  one-shot (not chunked). A cheap substring pre-filter skips subtitles that can't
  possibly contain a word before running the (slow) Unicode-boundary regex, so the
  full scan is roughly 3× faster; it still takes a few minutes and prints progress.
- **Resumability:** `filmot`/`srt` skip already-done units; just re-run to continue.
- **Rate limits:** Filmot API quota is respected; 429 stops and preserves progress. Legacy filmot and the free translate endpoint throttle
  (`filmotDelayMs` / `translateDelayMs`) and retry with backoff; on failure a unit
  is left pending for the next run.
- Tests: `npx jest "(public/language|tools/language)/.*\.test\.js$"`.
