# Filmot channel blacklist + demand-driven pagination — design

Status: Implemented
Date: 2026-07-05
Extends: `2026-07-05-language-manage-cli-design.md` (step 2, "filmot")

## Problem

Step 2 (`filmot`) already supports `excludeChannels` — a **hard** block: any video
on a listed channel is dropped. There is no **soft** blacklist: a set of channels
that should be used *only when better options aren't sufficient*, the same way
auto-generated captions are already used only to fill the per-word quota.

Satisfying "use blacklisted channels only if others aren't sufficient" requires
looking beyond filmot's first result page: if a word's page-1 results are
dominated by blacklisted channels, we must page further to find non-blacklisted
videos before falling back to blacklisted ones.

## Scope

In scope:
- A new `blacklistChannels` config option (soft de-prioritize), distinct from the
  existing `excludeChannels` (hard drop, unchanged).
- Caption-primary, blacklist-secondary ranking of capture candidates.
- Bounded, demand-driven pagination of filmot search results, gated on a
  non-empty blacklist.

Out of scope:
- Changing `excludeChannels` semantics or its channel-name matching.
- Pagination for runs with no blacklist configured (behavior stays byte-identical
  to today).
- Any change to steps 1 (`rare`) or 3 (`srt`).

## Ranking

Channel identity is resolved via the existing cached YouTube oembed lookup
(`resolveChannel` / `channel-cache.json`), keyed by videoId. The filmot result
card does **not** carry the channel, so this lookup is unavoidable — but it only
runs when `blacklistChannels` or `excludeChannels` is set. Both lists match
against the oembed **display name** (unchanged from `excludeChannels` today).

`excludeChannels` videos are dropped before ranking. Remaining candidates are
ordered by a two-key sort (ascending), caption quality first:

| tier | captions | channel        | sort key (isAuto, isBlacklisted) |
|------|----------|----------------|----------------------------------|
| 1    | manual   | not blacklisted| (0, 0)                           |
| 2    | manual   | blacklisted    | (0, 1)                           |
| 3    | auto     | not blacklisted| (1, 0)                           |
| 4    | auto     | blacklisted    | (1, 1)                           |

Relative order within a tier is the order candidates were collected (stable sort).

Degenerate cases:
- `blacklistChannels` empty → the `isBlacklisted` key is always 0, so the order
  collapses to today's manual-first ordering. **Byte-identical** to current
  behavior.
- `preferManual: false` → caption quality is not a sort key; blacklist becomes the
  sole key `(isBlacklisted?1:0)`, i.e. non-blacklisted before blacklisted.

## Pagination

The per-word capture takes one of two code paths, chosen by whether a blacklist is
configured:

- **No blacklist (`blacklistChannels` empty) — legacy path, unchanged.** Keep
  today's interleaved per-term loop verbatim: for each alternative term, fetch
  page 1, select candidates, fetch transcripts, and break as soon as the quota is
  filled (so later terms may never be fetched). Same requests, same hits as today.
- **Blacklist set — new pool-first path.** Collect a candidate pool with
  pagination, rank once, then verify. Described below.

Why two paths: the pool-first flow fetches search pages before verifying any
transcript, which would change the request pattern (and possibly which later terms
get fetched) for existing no-blacklist runs. Branching keeps no-blacklist behavior
byte-identical and localizes the new logic to blacklist mode.

New config `maxSearchPages` (default `3`) caps pages fetched per alternative term.
`buildSearchUrl(word, lang, page = 1)` gains a `page` parameter; filmot's search
URL is `/search/<quoted>/<page>?lang=<lang>`.

Pool-first path — per alternative term:
1. Fetch page `p` (starting at 1), parse result cards, dedupe into the word's pool
   (skip videoIds already seen this word).
2. Resolve channels for the newly added cards (oembed, cached).
3. Count non-blacklisted, non-excluded candidates in the pool. Fetch page `p+1`
   and repeat **only while** all hold:
   - that count `< maxItemsPerWord`, and
   - `p < maxSearchPages`, and
   - the last page returned at least one new card.

After each term, if the pool already holds `>= maxItemsPerWord` non-blacklisted
candidates, stop collecting further terms (the same sufficiency check that ends
pagination). Then rank the full pool with the tier sort above and fetch transcripts
in ranked order, keeping confirmed regex matches until `maxItemsPerWord` hits or
the pool is exhausted.

This means blacklisted channels are captured only after paging (up to the cap)
failed to yield enough non-blacklisted candidates — the requested "only if others
aren't sufficient". The trigger counts *candidates*, not confirmed hits (a hit
requires an expensive transcript fetch); a candidate that later yields no regex
match can still leave a word short of `max`, which is acceptable and unchanged
from today.

## Components

- `filmot-fetch.js`
  - `buildSearchUrl(word, lang, page = 1)` — add `page`.
  - `selectCandidates(cards, opts)` — add `blacklistChannels` opt; replace the
    manual-first split with the two-key tier sort. `excludeChannels` hard-filter
    and `channelOf` unchanged.
  - `nonBlacklistedCount(cards, { blacklistChannels, excludeChannels, channelOf })`
    — new pure helper: count of cards that are neither excluded nor blacklisted.
    Drives the pagination trigger and is unit-testable in isolation.
- `lang-manage.js` `cmdFilmot` — branch on `blacklistChannels.length`: keep the
  existing interleaved per-term loop when empty; add a pool-first path (build pool
  with pagination, resolve channels, rank once, then verify+capture) when set.
  Both paths resolve a chosen card's channel for the hit record as today; the
  pool path additionally resolves channels for pooled cards to enable tiering.
- `config.js` DEFAULTS + `config.example.json` — add `blacklistChannels: []` and
  `maxSearchPages: 3`.
- `args.js` — accept `--maxPages N` (numeric → `maxSearchPages`). Blacklist is
  config-only (a comma-list of channel names on the CLI is awkward and rarely
  needed per-run); documented as such.
- `README.md` — document both new keys in the config table, the `--maxPages`
  flag, and the exclude-vs-blacklist distinction under step 2.

## Data flow

No-blacklist path (unchanged from today):
```
cmdFilmot(word)                     # blacklistChannels empty
  for term in searchTerms(word):
    if hits >= max: break
    cards = parseSearchResults(getPage(buildSearchUrl(term, lang)))  # page 1
    chosen = selectCandidates(cards, { max: max-hits, excludeChannels,
                                       channelOf, preferManual })
    for card in chosen:
      if hits >= max: break
      verify transcript regex → push hit
```

Blacklist path (new):
```
cmdFilmot(word)                     # blacklistChannels non-empty
  pool = []
  for term in searchTerms(word):
    if nonBlacklistedCount(pool) >= max: break     # enough already; stop terms
    p = 1
    loop:
      cards = parseSearchResults(getPage(buildSearchUrl(term, lang, p)))
      newCards = cards not already pooled for this word
      resolveChannel(c) for c in newCards          # oembed, cached
      pool += newCards
      if nonBlacklistedCount(pool) >= max: break
      if p >= maxSearchPages: break
      if newCards is empty: break
      p += 1
  ranked = selectCandidates(pool, { max, excludeChannels, blacklistChannels,
                                    channelOf, preferManual })
  for card in ranked:
    if hits >= max: break
    verify transcript regex → push hit
```

## Error handling

- Captcha wall on any page fetch aborts the word (progress not advanced), as today.
- A failed page fetch mid-pagination: treat like end-of-pages for that term (use
  what's pooled so far) rather than failing the whole word, so a transient error
  on page 3 doesn't discard pages 1–2.
- Unknown channel (oembed miss / falsy) is treated as **not** blacklisted and
  **not** excluded — never dropped or demoted on missing data (matches current
  `excludeChannels` "unknown channel => keep").

## Testing

Unit (pure, `filmot-fetch.test.js`):
- `buildSearchUrl` emits the page number for `page = 1` (default) and `page = 3`.
- `selectCandidates` tier ordering across all caption×blacklist combinations;
  empty blacklist reproduces current manual-first order; a channel in **both**
  exclude and blacklist is hard-dropped (exclude wins); `preferManual: false`
  path.
- `nonBlacklistedCount` with excluded, blacklisted, unknown, and plain channels.

Integration:
- `cmdFilmot` pagination loop driven by an injected `fetchFn`/fetcher returning
  scripted pages: verify it stops paging once enough non-blacklisted candidates
  exist, respects `maxSearchPages`, and that no-blacklist runs fetch page 1 only.

Regression: the full suite (`npx jest "(public/language|tools/language)/.*\.test\.js$"`)
stays green; no-blacklist behavior is byte-identical.

## Defaults summary

| key             | default | meaning                                             |
|-----------------|---------|-----------------------------------------------------|
| `blacklistChannels` | `[]` | soft de-prioritize; used only if non-blacklisted candidates are insufficient |
| `maxSearchPages`    | `3`  | max filmot result pages per alternative term (only paged when blacklist set) |
