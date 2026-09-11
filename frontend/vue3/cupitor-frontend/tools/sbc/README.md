# sbc_clean

Converts [Santa Barbara Corpus](https://www.linguistics.ucsb.edu/research/santa-barbara-corpus)
transcripts (`.trn`) into clean, readable text or JSONL.

Python 3, standard library only — nothing to install.

## Use

```sh
# straight from the corpus website
python3 sbc_clean.py https://www.linguistics.ucsb.edu/sites/default/files/sitefiles/research/SBC/SBC002.trn

# a local file, as JSONL
python3 sbc_clean.py SBC002.trn --format jsonl -o sbc002.jsonl

# a whole directory, Markdown and JSONL side by side
python3 sbc_clean.py corpus/ --format md,jsonl -o out/
```

Input is a `.trn` file, a directory of them, or an `http(s)` URL. Output goes to
stdout unless you pass `-o`; `-o` is required when writing more than one file
(more than one `--format`, or several sources), and is then treated as a
directory.

## What it does

The corpus stores each intonation unit as `start end ⇥ SPEAKER: ⇥ text`, where a
blank speaker column means "same speaker continues". `sbc_clean` fills those
blanks, stitches utterances that were split across an interruption back together,
strips the transcription notation, and optionally merges each speaker's
consecutive units into one turn.

```
0.00 6.52    JAMIE:      How [can you teach a three-year-old to] ta=p [2dance2].
->
**JAMIE:** How can you teach a three-year-old to tap dance.
```

## Output formats

`--format` takes one name, a comma-separated list, or `all`. The default is `md`.

**`md`** — a transcript document: an `# SBC002` heading from the file name, one
turn per paragraph with the speaker in bold, and non-speech events as blockquotes.

```markdown
# SBC002

**JAMIE:** How can you teach a three-year-old to tap dance.

**HAROLD:** I can't imagine teaching a Yeah, really.

> *[music becomes audible]*
```

`<` is written as `&lt;` so that the tags from `--level linguistic` stay visible
rather than being swallowed as inline HTML. Use `--format txt` if you want those
tags raw.

**`txt`** — the same turns as bare `SPEAKER: text` lines, one per line, no
heading and no blank lines. Convenient for `grep` and for feeding to other tools.

**`jsonl`** — one JSON object per turn; see below.

## Levels

`--level` picks how much notation survives. `readable` is the default.

| Markup | `readable` | `linguistic` | `minimal` |
|---|---|---|---|
| pauses `..` `...` | drop | `<p/>` `<pp/>` | keep |
| lengthening `=` | drop | drop | keep |
| overlap `[…]` `[2…2]` | unwrap | `<ovl n="2">` | unwrap |
| laughter `@@@` | `[laughs]` | `<laugh pulses="3"/>` | keep |
| laughing while speaking `@word` | `word` | `<laughing/>word` | keep |
| breaths `(H)` `(Hx)` | drop | `<breath dir="in"/>` | keep |
| noises `(TSK)` `(SNIFF)` | `[tsk]` | `<vocal type="tsk"/>` | keep |
| events `((CLAP))` | `[clap]` | `<event type="clap"/>` | keep |
| quality `<HI…HI>` `<VOX…VOX>` | unwrap | `<q type="high">` | keep |
| uncertain `<X…X>` | unwrap | `<unsure>` | keep |
| indecipherable `XX` | `[unclear]` | `<unclear syllables="2"/>` | keep |
| glottal `%` | drop | drop | keep |
| truncated unit `--` | drop | keep | keep |
| name markers `~Harold` `!Thomas` | `Harold` | `~Harold` | `~Harold` |

Override any row with `--keep` or `--drop`, using the feature names from the left
column (`pauses`, `lengthening`, `overlaps`, `laughter`, `breaths`, `noises`,
`events`, `quality`, `uncertain`, `indecipherable`, `glottal`, `truncation`,
`pseudonyms`):

```sh
python3 sbc_clean.py SBC002.trn --level readable --keep pauses,laughter
python3 sbc_clean.py SBC002.trn --level minimal --keep overlaps
```

For the three span features (`overlaps`, `quality`, `uncertain`), `drop` removes
the markup and keeps the words inside it.

Voice-quality labels are an open set in the corpus, so only the documented ones
are given readable names. Anything else (`<SING…SING>`, `<POUNDING…POUNDING>`)
passes through as its own lowercased label rather than being guessed at.

## Flags

| Flag | Effect |
|---|---|
| `--level readable\|linguistic\|minimal` | cleaning preset (default `readable`) |
| `--keep LIST` / `--drop LIST` | override the preset per feature |
| `--format LIST` | `md`, `txt`, `jsonl`, a comma-separated list, or `all` (default `md`) |
| `--merge` / `--no-merge` | join a speaker's consecutive units (default on) |
| `--speakers A,B` | keep only these speakers |
| `--no-env` | omit `((…))` events and non-participant sources (`>ENV`, `>RADIO`) |
| `--timestamps` | prefix text output with turn timings |
| `--include-raw` | add each unit's untouched source text to JSONL records |

## JSONL records

```json
{"start": 4.43, "end": 6.73, "speaker": "HAROLD", "kind": "speech",
 "text": "I can't imagine teaching a Yeah, really.",
 "truncated": false, "truncations": 1, "units": 3}
```

`kind` is `speech` or `event`. `units` counts the intonation units merged into the
turn. `truncated` says the turn *ends* mid-word or mid-unit; `truncations` counts
how many units inside it broke off. Both survive at `readable`, where `--` is
stripped from the text.

## Corpus quirks it handles

- **Two file layouts.** Early files write `start end` in one tab column, later
  ones use two, and some use CRLF line endings. Both parse.
- **Mixed encodings.** Some files are UTF-8, others Windows-1252 with curly
  apostrophes stored as byte `0x92`. Decoding is tried as UTF-8, then cp1252,
  then latin-1, and curly quotes are normalised to ASCII, so contractions come
  out as `he's` rather than as an invisible control character.
- **Stray control bytes** are removed. SBC015 has a NUL byte where the `c` of
  "church" should be; the letter is gone in the source and cannot be recovered,
  but the NUL does not reach the output.
- **Blank speaker columns** are forward-filled, except on `((…))` event lines —
  `((J,_M,_P_LAUGHING))` belongs to the room, not to whoever spoke last. An event
  the transcript *does* attribute keeps its speaker.
- **`>` sound sources** (`>ENV`, `>RADIO`, `>MAC`, `>DOG`) are not participants,
  so they never become the speaker that later blank columns inherit.
- **`&` continuations**: a unit interrupted by another speaker is written with a
  trailing `&` and a leading `&` on its other half. The halves are rejoined and the
  end timestamp extended.
- **Delimiters that straddle lines**: `<@` can open on one line and `@>` close two
  lines later, and overlap brackets do the same. Orphan halves are removed without
  taking the words with them, and without gluing their neighbours together.
- **Doubled and nested delimiters**: `<<SLAPPING … SLAPPING>>`, and
  `<P<% I like this song %>P>` resolving innermost-first.
- **Labels containing digits**: `<L2 … L2>` marks a switch into another language.
- **Malformed source**: a vocalism missing a paren (`(TSK (H)3]`) is still read as
  a vocalism, in both directions, but only where the parens really are unbalanced —
  an ordinary aside like `(NOT me)` is left alone. Empty `()` is dropped.
- **Pauses glued to the preceding word** (`I'd.. try`) are still pauses. A single
  `.` is never touched, so sentence-final punctuation survives.
- An overlap index is stripped along with its bracket, but a bare year (`1992]`) is
  not mistaken for one.
- Units that clean away to nothing are dropped *before* merging, so they cannot
  split one speaker's turn into two.

## Known limits

- **`linguistic` output is not guaranteed well-formed XML.** Overlap brackets and
  voice-quality spans legitimately cross each other in the corpus, and each is
  closed by its own handler, so a small number of lines produce crossing tags
  (6 of 761 in SBC002). Treat the tags as markers, not as a parseable tree.
- **Word-internal truncation is preserved as content** at every level: `cream-`
  and `g-` stay as written, since the trailing hyphen is part of what was said.
  Only the unit-final `--` responds to the `truncation` feature.
- **`minimal` unwraps overlap brackets** while keeping every other notation, so
  that the text stays readable. `--keep overlaps` puts them back.

## Tests

```sh
python3 test_sbc_clean.py
```

44 tests, covering decoding, the parser, `&` rejoining, each cleaning feature, the
level presets and their overrides, merging, rendering, and the corpus quirks
listed above. Inputs are taken verbatim from real transcripts.
