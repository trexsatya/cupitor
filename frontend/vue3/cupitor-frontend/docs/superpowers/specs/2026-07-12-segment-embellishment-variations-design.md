# Segment Embellishment Variations — Design

**Date:** 2026-07-12
**App:** cupitor music-study web app (`public/music.html` + ES modules under `public/`)

## 1. Goal

Given a short segment of a piece, **generate a set of playable variations** that decorate a
chosen melodic line using classical non-chord-tone (NCT) techniques, so the user can study each
concept — and combinations of them — against real music they are already working on.

Techniques in scope: **Passing tone, Neighbour tone, Suspension, Retardation, Appoggiatura,
Escape tone, Anticipation.**

## 2. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| What it produces | A browsable list of generated **variations** of the segment; each is playable and shown as staff notation. |
| Segment size | Hard cap **≤ 3 measures** (bounds the combinatorial explosion). If the current segment is larger, the panel asks the user to narrow it first. |
| What gets embellished | A **voice the user chooses** from the segment. |
| Harmonic frame | The segment's **detected per-measure chord** (same engine as the sheet: `canonicalChordSpans`/`bestChords`). Chord tones = stable; everything else = decoration. |
| Note pool for decorations | **Default:** the decorating pitch must be a pitch class **already present in the segment**. **"Add extra notes" toggle (off by default):** widen the pool to the piece's **diatonic key/scale**. |
| Combination model | **Progressive:** every single-site variation first, then pairs, then triples… **capped at ~50** total. Each row is labelled. |
| Presentation | **Full staff notation.** One **shared render panel** shows the **currently selected** variation (single OSMD target, reused). The result list is compact selectable rows (label + ▶ play). No per-row mini-scores. |
| Techniques shipped | All 7, spec'd together; implemented in complexity order (re-timing first). |

## 3. Approach (chosen)

**Edit the segment's existing MusicXML per variation.** Extract the ≤3 measures from
`detail.source` (the same `DOMParser`/`XMLSerializer` DOM surgery `music-split.js` already uses),
apply technique-specific edits to the chosen voice's `<note>` elements, serialize to a variation
XML string, and render it with OSMD. This preserves the real clef / key / time / divisions and
engraving. (Rejected: synthesising MusicXML from scratch — more error-prone for multi-voice
backups/beaming; a new note-model→render path — OSMD needs MusicXML anyway.)

## 4. Data flow

```
segment (≤3 measures) + chosen voiceId + chordByMeasure + pitch pool
  → embellishment engine (pure)      → variations: [{ id, label, techniques, edits }]
  → MusicXML variation builder       → one XML string per variation (built lazily on select)
  → shared render panel + player     → selected variation shown as notation + playable
```

## 5. Modules & interfaces

### 5.1 `public/music-embellish.js` — pure engine (unit-tested; the heart)

Note model (already available from `encodeMusicXml` voices, sliced to the segment):
`{ name, midi, onset, duration, measureIndex, chordSymbol }`.

- `noteRoles(voiceNotes, chordByMeasure)` → each note tagged `isChordTone` (its pitch **class**,
  `midi % 12`, is a tone of its measure's chord via `chordByAnyName(sym).notes`) + `beatStrength`.
  `beatStrength` is derived from `onset` within the measure: the lowest onset in a measure = strong
  (downbeat); others = weak. (No time-signature parsing; onset ordering is enough for
  strong/weak-beat gating of appoggiatura vs escape.)
- `eligibleSites(voiceNotes, chordByMeasure, { pool })` → `[{ technique, index, insertPitch?, timing, label }]`.
  A site is emitted only if the required decorating pitch is allowed by `pool`.
- `buildPool(segmentVoices, { addNotes, key })` → `Set` of allowed pitch classes
  (segment PCs by default; diatonic scale of `key` when `addNotes`).
- `enumerateVariations(sites, { cap = 50 })` → progressive combinations (size 1, then 2, …),
  each `{ id, label, techniques, edits }`, capped. **Conflict rule:** two sites conflict if their
  edits touch the same note index or the same insertion gap between two notes; conflicting sites are
  never combined in one variation (but each still appears in its own single-site variation).
- `TECHNIQUES` metadata (key, display name, needs-new-pitch flag, colour).

**Per-technique site rules** (over the chosen voice, relative to the measure chord):

| Technique | Trigger | Edit |
|---|---|---|
| Passing | two chord tones a **3rd** apart, adjacent in time | insert the stepwise middle pitch; split the first note's duration in two |
| Neighbour | a chord tone repeated/held | insert a step-away (upper or lower) then return; split duration |
| Anticipation | next note is a chord tone of the next chord | sound it early by stealing the tail of the current note (re-time; no new pitch) |
| Suspension | current chord tone is a **step above** a tone of the next chord | hold it across the beat/barline (tie), then resolve **down** by step |
| Retardation | as suspension but resolves **up** by step | hold + resolve up |
| Appoggiatura | strong-beat approach to a chord tone | accented non-chord step-neighbour on the beat, resolving by step into the chord tone |
| Escape | a chord tone | step away to a weak non-chord tone, then leap (opposite direction) into the next chord tone |

All decorating pitches are constrained by `pool`; re-timing techniques (anticipation, suspension,
retardation) never introduce a pitch and are therefore always available by default.

### 5.2 `public/music-embellish-xml.js` — variation builder (unit-tested)

- `extractSegmentXml(source, [fromMeasure, toMeasure])` → standalone MusicXML for the measures
  (carry forward clef/key/time/divisions, mirroring `music-split.js`).
- `applyVariation(segmentXml, voiceId, edits)` → variation XML string. Applies edits to the chosen
  voice's `<note>` elements: `insert` (new `<note>` with computed `<duration>`/`<type>`), `split`
  (halve a note, add the decorating note), `tie`/`retie` (suspension/retardation), `retime`
  (anticipation). Leaves other voices and `<backup>` intact.
- Edit shape: `{ op: 'split'|'insert'|'tie'|'retime', at, pitch?, dur?, ... }`.

The riskiest bookkeeping is `<duration>` / `<type>` / `<beam>` correctness; covered by
before/after fragment tests.

### 5.3 UI in `public/music.html` — "Variations" panel (style matches chord-window / phrases panels)

- **Controls:** voice selector; 7 technique checkboxes (all on by default); "add extra notes"
  toggle (off); **Generate**.
- **Result list:** compact selectable rows — label + ▶ play. Selecting a row is the only trigger
  to build+render its XML.
- **Shared render panel:** one dedicated OSMD renderer instance; renders the selected variation and
  plays it via the existing `music-player.js` schedule. Re-selecting swaps the content of this one
  panel (no accumulation of OSMD instances).
- **Guardrail:** if `segTo − segFrom + 1 > 3`, disable Generate and prompt to narrow the segment.

## 6. Testing (TDD)

- **Engine (`music-embellish.test.js`):** `noteRoles`, `buildPool`, per-technique `eligibleSites`
  (table-driven on small synthetic voices + chords), pitch-pool gating, `enumerateVariations`
  progressive order + cap + conflict-dropping.
- **XML builder (`music-embellish-xml.test.js`):** `extractSegmentXml` measure range + attribute
  carry-forward; `applyVariation` before/after fragment assertions per edit op.
- UI glue stays thin (not unit-tested), consistent with the rest of `music.html`.

## 7. Scope / phasing

All 7 techniques are spec'd. Implementation order by notation complexity:
1. Re-timing (no new pitch): **anticipation, suspension, retardation**.
2. Pitch-inserting with rhythm splits: **passing, neighbour, appoggiatura, escape**.

## 8. Out of scope (for now)

- Embellishing multiple voices at once (whole-texture).
- Chromatic (non-diatonic) decorating pitches beyond the key/scale.
- Saving variations back into the library or exporting them.
- Segments longer than 3 measures.

## 9. Risks

- **MusicXML duration/type/beam editing** is the fiddliest part; mitigated by fragment tests and
  the ≤3-measure bound.
- **Musical quality:** generated combinations may sometimes be awkward; acceptable for a study tool,
  and progressive/labelled listing lets the user pick musical ones.
- **Voice isolation** in multi-voice MusicXML (backups); edits must not disturb other voices.
