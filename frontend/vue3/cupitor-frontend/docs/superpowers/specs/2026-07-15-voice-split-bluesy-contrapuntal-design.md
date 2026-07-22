# Voice-Split, Bluesy & Contrapuntal Variations — Design

**Date:** 2026-07-15
**App:** cupitor music-study web app (`public/music.html` + ES modules under `public/`)
**Builds on:** `2026-07-12-segment-embellishment-variations-design.md` (the Variations panel + NCT engine).

## 1. Goal

Extend the segment-Variations feature with three capabilities:

1. **Single-voice → bass/melody split.** When a piece/segment has only one voice, derive a
   melody line and a bass line by a pitch heuristic, so the Variations voice-picker has two lines
   to work with (embellish the melody over an untouched bass) — and so contrapuntal has a melody
   to write against.
2. **Bluesy variations.** A style that decorates the chosen melodic voice with a blues palette:
   blue notes (♭3, ♭5/♯4, ♭7), grace-note slides into chord tones, and an optional shuffle feel.
3. **Contrapuntal variations.** A style that adds an *independent counter-line* as a new voice
   moving against the melody (note-against-note, contrary/oblique motion, chord tones).

## 2. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Voice-split heuristic | **Pitch extremes per beat**: per beat, the single lowest-pitched note → **bass**; all other notes of the beat → **melody**. One-note beat → melody (bass rests). |
| Bluesy scope | **Blue-note ornaments + grace slides** AND **shuffle/swing re-timing**. |
| Contrapuntal output | **Independent counter-line in a new voice** (contrary/oblique, chord tones). |
| UI surface | **Style selector** (Classical / Bluesy / Contrapuntal). Classical & Bluesy show the technique checkboxes and combine; Contrapuntal generates on its own. |
| Phasing | Build all three behind tests, one deploy at the end (user tests before deploy). |
| Counter-line visibility | The whole counter-line is **colored as "added"** → red highlight on the sheet + ring on the fretboard. |

## 3. Architecture

```
segment MusicXML (≤3 measures)
  ├─ (if single voice) splitSingleVoice() ──► working segment with voice1=melody, voice2=bass
  │
  ├─ Classical/Bluesy style ─► embellish engine (edits chosen voice's notes)
  │       Bluesy: blue-note pool + grace-slide sites + optional shuffle transform
  │
  └─ Contrapuntal style ─────► counterpoint generator ──► writeVoice() adds counter-line voice
                                                          (colored as added)
  → variation MusicXML string  → shared render panel + player + fretboard (unchanged)
```

### 3.1 Shared primitive — `writeVoice` (in `public/music-embellish-xml.js`)

`writeVoice(segmentDoc, { voiceId, staff = null, notesByMeasure, color = null })` appends a full
voice to each `<measure>`: emit a `<backup>` of the measure's total divisions, then the voice's
`<note>`s in onset order with `<rest>`s filling gaps so the voice spans the whole measure.
`notesByMeasure[measureNumber]` is an array of `{ onsetDivs, durationDivs, midi | rest, name?, octave? }`.
When `color` is set, every emitted pitched note carries that `color` attribute (so contrapuntal
counter-lines and any added material light up via `coloredNoteMarks`). Divisions come from the
segment's `<divisions>` (carried forward by `extractSegmentXml`).

This is the one place that knows how to lay a second voice onto a staff with correct backups —
used by **A (split)** and **C (contrapuntal)**.

### 3.2 Feature A — `splitSingleVoice` (new `public/music-voice-split.js`)

- `classifyBassMelody(voiceNotesByBeat)` → `{ melody: [...], bass: [...] }` pure classifier.
  Group the single voice's notes (including `<chord/>`-stacked notes) by beat
  (`beat = floor(onsetDivs / divisions)`). In each beat: the min-MIDI note → bass (kept at the
  beat's earliest onset in that beat); every other note → melody. One-note beat → melody only.
- `splitSingleVoice(segmentXml)` → segment XML string with the original notes re-partitioned into
  **voice "1" = melody** and **voice "2" = bass**, realized via `writeVoice`. Ties are approximated
  by duration; beams/slurs are not preserved (acceptable for the derived render).
- Applies only when the segment has ≤1 distinct `<voice>`. Multi-voice pieces are untouched.

### 3.3 Feature B — Bluesy (extends `public/music-embellish.js`)

- `BLUE_PCS(key)` → pitch classes of ♭3, ♭5/♯4, ♭7 relative to `key`.
- Bluesy pool = default/`addNotes` pool ∪ `BLUE_PCS(key)`.
- New detector `blueGraceSlide`: for a strong-beat chord tone, a grace note a semitone below,
  slurred into it. Emits a `grace` edit op.
- Blue passing/neighbour need no new detector — the widened pool makes chromatic neighbours/passing
  tones eligible in the existing `neighbour`/`passing` detectors.
- `shuffleSegment` transform: swing consecutive eighth-note pairs within a beat to long–short (2:1),
  emitted as a `shuffle`/retime edit. Offered as a Bluesy-only toggle; combines with the rest.
- `generateVariations({ ..., style })`: `style: 'classical' | 'bluesy' | 'contrapuntal'`. Bluesy =
  classical enumeration with the blue pool + `blueGraceSlide` sites; shuffle applied per the toggle.

### 3.4 Feature C — Contrapuntal (new `public/music-counterpoint.js`)

- `generateCounterLines({ melodyNotesByBeat, chordByMeasure, key, register })` → a small set
  (~3–6) of counter-lines. Each counter-line is one chord tone per beat chosen to be:
  consonant with the melody note (3rd/6th/octave/unison/5th), in **contrary or oblique** motion vs
  the previous counter-note, and within `register` (default: below the melody). Variants differ by
  start tone, register (below/above), and whether brief passing motion is allowed.
- Realized by `writeVoice(..., { voiceId: <max+1>, color: ADDED_NOTE_COLOR })` so the counter-line
  is visible as added material (red on sheet, ringed on fretboard).
- Fretboard: for contrapuntal variations, `variationFretSteps` groups **both** the melody and the
  counter voice per beat, so each beat step shows the two-note interval.

### 3.5 UI (`public/music.html`)

- New `#varStyle` `<select>`: Classical / Bluesy / Contrapuntal, above the technique checkboxes.
  - Classical & Bluesy: technique checkboxes visible; Bluesy additionally shows a `#varShuffle`
    toggle.
  - Contrapuntal: checkboxes hidden; a small register control (below/above) shown.
- Voice-picker: when the current segment is single-voice, list **"Melody (auto-split)"** and
  **"Bass (auto-split)"** (backed by `splitSingleVoice`) instead of the lone raw voice.
- `varGenerate` handler dispatches by `#varStyle`:
  - classical/bluesy → `generateVariations({ style, techniques, addNotes, shuffle })` on the chosen
    (possibly split) voice.
  - contrapuntal → `generateCounterLines(...)` → `writeVoice` per line.
- `variationFretSteps` gains an optional second voice id for contrapuntal capture.

## 4. Data flow (contrapuntal example)

```
melody voice notes  → generateCounterLines → [{ id, label, notesByMeasure }]
  on select:  extractSegmentXml → writeVoice(counter-line, color=added) → variation XML
              → render panel (red counter-line) + player (both voices) + fretboard (both per beat)
```

## 5. Modules & interfaces (summary)

| Module | New/changed | Key exports |
|---|---|---|
| `music-embellish-xml.js` | + `writeVoice`, + `grace`/`shuffle` edit ops in `applyVariation` | `writeVoice`, existing |
| `music-voice-split.js` (new) | Feature A | `classifyBassMelody`, `splitSingleVoice` |
| `music-embellish.js` | Feature B | `BLUE_PCS`, `blueGraceSlide` detector, `shuffle`, `generateVariations({style})` |
| `music-counterpoint.js` (new) | Feature C | `generateCounterLines` |
| `music-embellish-ui.js` | split-aware voice list; `variationFretSteps` 2-voice | `voicePickerEntries`, `variationFretSteps(xml, voiceIds)` |
| `music.html` | Style selector, shuffle/register controls, dispatch | — |

## 6. Testing (TDD)

- **Split:** `classifyBassMelody` (lowest→bass, rest→melody, single-note beat, chord stacks);
  `splitSingleVoice` produces valid two-voice XML (backups sum correctly, rests fill gaps).
- **Bluesy:** `BLUE_PCS` per key; `blueGraceSlide` sites (strong-beat only); pool widening makes a
  chromatic neighbour eligible; `shuffle` yields 2:1 durations that still sum to the beat.
- **Contrapuntal:** `generateCounterLines` — consonance, contrary/oblique motion, register bound,
  count cap; `writeVoice` emits a well-formed colored voice.
- **Builder:** `writeVoice` backups/rests fragment tests; `grace`/`shuffle` before/after fragments.
- **Integration:** real-valsa sanity — split a single-voice segment, generate each style, confirm
  valid MusicXML + small per-beat fretboard steps + colored marks where expected.
- UI glue stays thin (not unit-tested), consistent with the rest of `music.html`.

## 7. Risks

- **Re-voicing fidelity:** the split rebuilds notes; ties/beams/slurs are simplified. Mitigated by
  preserving durations and bounding to ≤3 measures.
- **Counterpoint quality:** generated lines may be plain; acceptable for a study tool, and the
  labelled list lets the user pick musical ones.
- **MusicXML backups:** the fiddliest part; covered by `writeVoice` fragment tests and the ≤3-measure
  bound.
- **Grace/shuffle timing:** must not produce zero/void durations — reuse the builder's existing
  `<duration>` guards.

## 8. Out of scope

- Faithful beam/slur/tie preservation across the split.
- More than one counter-line at once; invertible counterpoint; canon.
- Chromaticism beyond the three blue notes.
- Persisting variations back to the library.
