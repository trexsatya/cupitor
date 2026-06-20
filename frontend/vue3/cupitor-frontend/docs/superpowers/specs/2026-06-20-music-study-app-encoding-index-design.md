# Music Study App — Milestone 1: Encoding + Index (Design)

- **Date:** 2026-06-20
- **Status:** Draft — awaiting final user review
- **Scope of this spec:** Milestone 1 only (the searchable encoding + index pipeline). Later milestones are sketched for context but are out of scope here.

## 1. Vision

Build a music counterpart to the existing language-study app ([public/language.html](../../../public/language.html)). language.html is, at its core, a *corpus search + study + capture* loop over subtitles. The music app applies the same loop to musical scores: search a corpus → render the match as sheet music → slow-loop it against audio → collect it as vocabulary → schedule it for practice.

The music-theory engine for this already largely exists in the repo. The work is building the integrated study shell around it, reusing language.html's proven, domain-agnostic pieces.

### Existing assets we build on

| Capability | Location |
|---|---|
| MusicXML ↔ note-model (parse, build, transpose, key/time) | [public/musicxml.js](../../../public/musicxml.js) — `MusicXml()`, `.toArray()`, `.loadMelody()` |
| Interval-contour search (transposition-invariant, tolerance, passing notes, repetition) | [public/music_search.js](../../../public/music_search.js) — `findIntervalMatches`, `extractPitchesFromText`, `getIntervals` |
| Chord recognition, rhythm counting, rhythm similarity | [public/music-analysis.js](../../../public/music-analysis.js) — `guessChords`, `getRhythmCounting`, `analyseRhythmSimilarity` |
| Keys, scales, chord patterns, roman numerals, progressions, **sargam** | [public/music-reference-data.js](../../../public/music-reference-data.js), [public/music.js](../../../public/music.js) |
| Key-relative vs absolute melody, melody gen, diatonic inversion | [public/music.js](../../../public/music.js) — `melodyInContextOfKey`, `diatonicMelodicInversion` |
| Sheet-music render (OSMD), fretboard, circle of fifths, voice toggles, sargam display | [public/guitar.html](../../../public/guitar.html), [public/guitar.js](../../../public/guitar.js) |
| GitHub read/write persistence | [public/github-utils.js](../../../public/github-utils.js) |
| `?lang` URL routing + per-language data root | [public/language/language.js](../../../public/language/language.js) — `getLangFromUrl()`, `getResourceUrl()` |
| Working corpus-search prototype over 38 note-text songs | [public/music.html](../../../public/music.html), [public/data/](../../../public/data/) |

## 2. Locked decisions (from brainstorming)

1. **Target:** the full integrated study app (search + vocab + render + play + practice log + GitHub sync), built incrementally.
2. **Codebase strategy:** grow [public/music.html](../../../public/music.html) and the existing music modules; cherry-pick shell pieces from language.html module-by-module. No fork of the 13k-line language.js, no Vue3 rewrite.
3. **Corpus:** MusicXML is the canonical, full-channel format. The 38 existing note-text songs are imported as lightweight (partial-channel) entries. Both produce the same schema.
4. **Index shape:** **two-tier** — one index file (metadata + compact search fields + pointers) + one detail file per piece.
5. **Index build:** in-app **"Rebuild & Push"**, incremental — operates on selected and/or newly added pieces, not a forced whole-corpus rebuild.
6. **Search fields live in Tier-1** (confirmed) — so a search needs only the single Tier-1 fetch and never downloads detail files to *find* matches.
7. **MusicXML stored inline** inside each detail file (confirmed).
8. **Notation systems are partitioned at the storage root** — `db/music/western` and `db/music/sargam` — **mirroring** language.html's `db/language/swedish|spanish`. Selected by a URL param `?system=` (default `western`), mirroring `?lang=`.
9. **One system per piece** (confirmed) — a piece is filed under the system of its source notation. Cross-system melody search still works via the shared **interval-contour** channel (intervals are identical whether spelled C→E or Sa→Ga).
10. **Piece id** derived from the piece name, **spaces → `_`**, filesystem-unsafe chars stripped (confirmed).

## 3. Roadmap (context — only Milestone 1 is specced here)

1. **Encoding + index** ← *this spec*.
2. **Search shell** — one search box, channel + system selector, results rendered as OSMD sheet music with surrounding-measure context.
3. **Player + sync** — audio/YouTube, speed + slow-loop, noteheads highlighting in time (lift player from language.html; use `populateNoteheadData`).
4. **Vocabulary** — Add-to-Vocab for motifs/voicings/progressions, categories, Search-Similar.
5. **Practice Log + persistence** — practice schedule + GitHub sync.

Each milestone gets its own spec → plan → implement cycle.

## 4. Milestone 1 goal

Turn any score into a **normalized, multi-channel searchable document**, and assemble all documents (per notation system) into a two-tier index the later search UI reads. The only UI in this milestone is a small **Manager / Rebuild & Push** view. **No search box, no rendering, no player.**

## 5. Storage layout & system selection (mirrors language.html)

language.html resolves its data root from the URL:

```js
// language.js (existing)
getLangFromUrl()  -> { fullName: 'swedish'|'spanish', code: 'sv'|'es' }   // default 'swedish'
getResourceUrl()  -> `https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/language/${fullName}`
```

The music app mirrors this exactly:

```js
// new, in music modules
getSystemFromUrl() -> { name: 'western'|'sargam' }                         // default 'western', from ?system=
getMusicResourceUrl() -> `https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/music/${name}`
```

Resulting tree (one self-contained two-tier index **per system**):

```
db/music/
  western/
    index.json                 # Tier-1: array of entries (metadata + packed search fields + pointer)
    details/
      Chopin_Nocturne_Op.9_No.2_for_Solo_Guitar.json   # Tier-2: full channels + inline MusicXML
      24_Etudes_Op.35_-_Fernando_Sor.json
      jethalal-bgm.json
      …
  sargam/
    index.json
    details/
      …
```

- **Reads** go through `getMusicResourceUrl()` (raw.githubusercontent.com), exactly like language.html.
- **Writes** (Rebuild & Push) go to the same `trexsatya/trexsatya.github.io` `gh-pages` repo under `db/music/<system>/…` via [public/github-utils.js](../../../public/github-utils.js).
- **Dev fallback:** the existing local [public/data/](../../../public/data/) `.txt` files are the migration source for the western corpus on first Rebuild (they are western-letter-notated → `db/music/western`). *(Confirm at review — see §12 Q1.)*
- `music.html` opens to `?system=western` by default; `?system=sargam` selects the other corpus. The system also tags every entry (`"system": "western"`).

## 6. The searchable unit

Not "a measure" — motifs cross barlines. Each score is encoded as a **continuous per-voice note stream**, with measure boundaries kept as metadata so a later milestone can render a matched passage in its surrounding context.

Per voice, channel arrays are index-aligned (entry *i* of every array describes note *i*):

```
{
  pitch:        [68, 75, 74, 73, …],   // MIDI numbers
  interval:     [+7, -1, -1, …],        // contour vs previous note (length = pitch.length - 1) — CROSS-SYSTEM bridge
  sargam:       ["Pa","Dha", …],        // key-relative scale degree
  duration:     ["q","e","e", …],       // rhythm channel (MusicXML only; null for note-text)
  chordSymbol:  [null,"A#m",null, …],   // explicit <harmony> if present, else INFERRED per-measure (new pure matcher); null where none
  lyric:        ["a","gar", …],         // aligned (MusicXML only; null for note-text)
  measureIndex: [1,1,1,2, …]            // note → measure number, for context rendering later
}
```

Channel producers (all already in the repo):

| Channel | Source function |
|---|---|
| pitch / interval | `musicxml.js` `.toArray()` + `music_search.js` `getIntervals` |
| sargam / degree | `music.js` `melodyInContextOfKey` |
| duration / rhythm | `music-analysis.js` `getRhythmCounting` |
| chordSymbol | explicit `<harmony>` if present; else **inferred** by a new pure per-measure matcher (`inferChords`) built on `music-reference-data.js` `allChords` + `normaliseChordName`. *Not* the existing `guessChords` — that reads OSMD pixel geometry (`n.left`/`n.line`) and can't run without rendering. Sub-measure (per-beat) chord resolution is a later refinement. |
| key inference | `music.js` `Key()`, `music-reference-data.js` |

## 7. Two encoders, one schema

- **`encodeMusicXml(xmlString)`** → full doc (all channels populated). Used for the western tree (Chopin, Sor, and any MusicXML).
- **`encodeNoteText(txtString)`** → partial doc (pitch / interval / sargam populated; duration / lyric / chordSymbol = null). Reuses `extractPitchesFromText`; the `+` simultaneity marker and `,` separators of the existing format are preserved as best-effort grouping hints.

Both emit the identical schema, so the search layer (M2) never branches on a song's origin. Missing channels are `null`; a channel-restricted search skips pieces lacking that channel.

## 8. The two-tier index

### Tier 1 — `db/music/<system>/index.json` (small, always loaded)

An array of per-piece entries: **metadata + compact (packed) search fields + a pointer**:

```jsonc
{
  "id": "Chopin_Nocturne_Op.9_No.2_for_Solo_Guitar",
  "title": "Nocturne Op.9 No.2",
  "system": "western",
  "format": "musicxml",             // "musicxml" | "note-text"
  "sourceUrl": null,
  "youtube": "https://youtube.com/results?search_query=Chopin+Nocturne+Op.9+No.2",
  "key": "E",                       // from MusicXML <fifths>=4; inferred for note-text; may be null
  "time": "4/4",                    // MusicXML only; null for note-text
  "tempo": null,
  "instrument": "Classical Guitar",
  "voiceCount": 2,
  "noteCount": 612,
  "channels": ["pitch","interval","sargam","duration","chordSymbol"],
  "search": {                       // packed search fields — kept in Tier-1 (decision #6)
    "contour": "…",                 // packed interval string ≈ 1 byte/note
    "pitchClasses": "…",            // compact absolute-pitch string
    "sargam": "…",                  // compact degree string
    "chords": "A#m G# …"            // chord-symbol sequence
  },
  "detailPath": "details/Chopin_Nocturne_Op.9_No.2_for_Solo_Guitar.json",
  "contentHash": "sha1:…",          // of the source; lets Rebuild skip unchanged pieces
  "updatedAt": "2026-06-20"
}
```

Packed contour ≈ 1 byte/note ⇒ Tier-1 stays ~hundreds of KB even at hundreds of songs.

### Tier 2 — `db/music/<system>/details/<id>.json` (one per piece, lazy + cached)

Holds the heavy, render/playback-only data: the full per-voice channel arrays (§6), `measureIndex`, lyrics, and the **inline raw MusicXML** (decision #7). Fetched only for pieces that match a search, when the user expands a result in M2/M3. Cached in IndexedDB after first fetch (mirrors language.html's lazy SRT caching).

> **Size note:** with inline MusicXML, the Sor détail file is ~4 MB (the source is 24 études / 932 measures in one file; gzips to ~400 KB). Acceptable because Tier-2 is lazy + cached. Splitting a multi-movement file into per-movement pieces is **deferred** — M1 treats **one file = one piece**.

### Why two tiers (rationale)

Sequence/contour search inherently scans every song, so splitting the index by song-id or alphabet buys nothing. Splitting **by purpose** (find-data in Tier-1 vs render-data in Tier-2) is what helps. Threshold guidance: single Tier-1 file per system is fine to ~1,000 pieces; beyond that, add an n-gram inverted index (interval-trigram → ids+positions) — a later, separate enhancement, **not** in this milestone.

## 9. Rebuild & Push (incremental)

The in-app artifact-builder. Workflow:

1. A Manager view (the only M1 UI, added to music.html) lists every piece in the **current `?system`** (from Tier-1) with checkboxes, plus an **"Add new"** affordance: upload a `.musicxml`/`.xml` file or paste note-text.
2. The user selects pieces (and/or adds new) and clicks **Rebuild & Push**.
3. For each selected/new piece: re-parse the source → regenerate `details/<id>.json` and recompute its Tier-1 entry (incl. `contentHash`, `noteCount`, `channels`, packed `search`).
4. Pieces whose `contentHash` is unchanged are skipped, unless explicitly selected.
5. All changed files (`index.json` + the touched `details/*.json`) are pushed to `trexsatya.github.io` `gh-pages` under `db/music/<system>/` in **one commit**, reusing the batched-commit pattern from language.html's "Sync edits" via [public/github-utils.js](../../../public/github-utils.js).

Never forces a whole-corpus rebuild; touches only selected/new pieces.

## 10. New files / modules

- **`public/music-encoding.js`** — `encodeMusicXml`, `encodeNoteText`, shared schema + normalizer, and the packers (contour/pitch/sargam/chord → strings) + a decoder for the round-trip test. Pure functions, no I/O.
- **`public/music-index.js`** — `getSystemFromUrl`, `getMusicResourceUrl`, build/load the two-tier index, `contentHash`, GitHub read/write via `github-utils.js`, IndexedDB cache for detail files. The Rebuild & Push engine.
- **Manager view** wired into [public/music.html](../../../public/music.html) (list + Add new + Rebuild & Push button).
- **Tests:** extend [public/music_search.test.js](../../../public/music_search.test.js) and/or add `public/music-encoding.test.js` (§11).

Reused as-is: `musicxml.js`, `music.js`, `music-analysis.js`, `music-reference-data.js`, `music_search.js`, `github-utils.js`.

## 11. Testing

**Hermetic unit tests** (fast, committed fixtures):
- Commit small fixtures under a test fixtures dir — e.g. the first ~4 measures of the Chopin extracted into a tiny `.musicxml`, plus an existing note-text song.
- `encodeNoteText('jethalal-bgm')` yields the expected pitch array + interval contour; `duration`/`lyric`/`chordSymbol` null; `channels = ["pitch","interval","sargam"]`.
- `encodeMusicXml(<chopin-excerpt>)` populates **all** channels with a correct `measureIndex`; `chordSymbol` is present (inferred via `guessChords`).
- Round-trip: a Tier-1 packed `contour` decodes back to the detail file's `interval` array.
- `contentHash` stable for identical input, changes when source changes.
- Both encoders emit the identical top-level schema shape.

**Integration tests against the real files** (opt-in / dev-only; skipped if the paths are absent):
- `/Users/satyendra.kumar/Documents/MuseScore3/Scores/Chopin_Nocturne_Op.9_No.2_for_Solo_Guitar.xml` — assert it encodes without error, `noteCount` plausible for 36 measures / 2 voices, all channels present, `key` resolves from `<fifths>=4`.
- `/Users/satyendra.kumar/Documents/MuseScore3/Scores/24_Etudes_Op.35_-_Fernando_Sor_1778_-_1839.xml` — the stress case: 932 measures / ~4 MB encodes without error/timeout; verify the one-file-one-piece behavior and detail-file size.

## 12. Open items to confirm at review (small)

1. **Bollywood `.txt` → western tree.** The 38 existing note-text songs are western-letter-notated (`G4#`), so they migrate into `db/music/western`. Confirm that's where you want them (vs. treating them as sargam-system content).
2. **System param name.** `?system=western` (proposed) — or reuse `?lang=` for symmetry with the other app? Proposed: `?system=`.

## 13. Explicitly out of scope for Milestone 1

Search box UI and channel selector, OSMD result rendering, surrounding-measure context display, player/audio sync, vocabulary capture, practice log, multi-movement file splitting, and the n-gram inverted index. All are later milestones/enhancements.
