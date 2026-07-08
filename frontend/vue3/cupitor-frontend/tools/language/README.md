# language "Manage" CLI

Node CLI that automates three study-data workflows against your **local** Swedish
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
| `srtsDir` | — | where step 3 writes the paired `.srt` files + `index.json` |
| `outDir` | `./out` | working dir for `rare-words.json`, progress files, caches |
| `rareThreshold` | `2` | a word is "rare" if it appears in fewer than this many subtitle files |
| `maxItemsPerWord` | `5` | max videos captured per word (step 2) |
| `linesBefore` / `linesAfter` | `3` / `3` | context lines kept around each match |
| `excludeChannels` | `[]` | channel names to **hard-drop** (resolved via oembed, cached) |
| `blacklistChannels` | `[]` | channel names to **soft de-prioritize** — captured only if non-blacklisted videos are insufficient (see `maxSearchPages`) |
| `preferManualCaptions` | `true` | use auto-generated captions only to fill the quota |
| **`filmotMode`** | `http` | how to fetch filmot: **`"browser"`** (recommended — real Chromium via Playwright, gets past the captcha wall) or `"http"` (pasted cookie, often blocked) |
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
create the paired `.sv.srt` / `.<target>.srt` files, updating `index.json`. If a
file already exists it is **merged** (union of entries) — never overwritten.

```bash
node tools/language/lang-manage.js srt --chunk 20
node tools/language/lang-manage.js srt --chunk 20             # repeat until done
node tools/language/lang-manage.js srt --no-translate         # source snippet only, no Google calls
node tools/language/lang-manage.js srt --reset
# → srts/<channel || title || id>.{sv,en}.srt  +  srts/index.json
```

`--no-translate` skips the Google translate calls entirely and writes only the
source `.<lang>.srt` snippet (no `.<target>.srt`); `index.json` is still updated.
Useful to grab snippets fast without the translate rate-limit. It still advances
progress, so to translate those videos later, re-run `srt --reset` (or clear
`out/srt-progress.json`) and run again without the flag.

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
| `--browser` | sets `filmotMode: "browser"` | (config `filmotMode`) |
| `--headed` / `--headless` | sets `browserHeadless: false` / `true` | headed |
| `--minSpan N` | `pruneMinSpanSec` (a transcript counts as "full-video" if it spans > N s) | 60 |
| `--window N` | `pruneWindowLines` (context lines kept each side of a preserved item) | 4 |
| `--apply` | `prune` actually rewrites/deletes (default is a dry-run plan) | — |

## Notes

- **Runtime:** `rare` scans every local subtitle (≈3000 files / 40 MB) and is a
  one-shot (not chunked). A cheap substring pre-filter skips subtitles that can't
  possibly contain a word before running the (slow) Unicode-boundary regex, so the
  full scan is roughly 3× faster; it still takes a few minutes and prints progress.
- **Resumability:** `filmot`/`srt` skip already-done units; just re-run to continue.
- **Rate limits:** filmot and the free translate endpoint throttle
  (`filmotDelayMs` / `translateDelayMs`) and retry with backoff; on failure a unit
  is left pending for the next run.
- Tests: `npx jest "(public/language|tools/language)/.*\.test\.js$"`.
