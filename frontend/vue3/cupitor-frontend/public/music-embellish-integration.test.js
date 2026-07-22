/** @jest-environment jsdom */
// End-to-end alignment test on REAL cached detail: the engine's collapsed voice note-list must
// index-align (length + MIDI pitches) with the XML builder's addressable note-list, and a real
// variation must build valid MusicXML without dropping the other voices' notes.
import fs from 'fs';
import path from 'path';
import jQuery from 'jquery';
import { generateVariations } from './music-embellish.js';
import {
  extractSegmentXml, applyVariation, coloredNoteMarks, writeVoice, ADDED_NOTE_COLOR,
} from './music-embellish-xml.js';
import { collapsedChordSpans } from './music-render.js';
import { generateCounterLines } from './music-counterpoint.js';
import { buildScheduleFromMusicXml } from './music-player.js';
import {
  buildChordByMeasure, buildVoiceNotes, orderedVoiceIds, addressableMidis,
  buildBeatNotes, counterLineToNotesByMeasure, variationFretSteps,
} from './music-embellish-ui.js';

beforeAll(() => { global.$ = global.jQuery = jQuery; });

const VALSA = path.join(process.env.TMPDIR || '/tmp', 'valsa.json');
const hasFixture = fs.existsSync(VALSA);
if (!hasFixture) {
  // eslint-disable-next-line no-console
  console.warn(`[skip] cached detail not found at ${VALSA}; skipping embellish integration test.`);
}

// Natural pitch class per letter, to derive MIDI from <pitch> independently in this test.
const STEP_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midiOf(pitchEl) {
  const step = pitchEl.querySelector('step').textContent.trim();
  const alterEl = pitchEl.querySelector('alter');
  const alter = alterEl ? parseInt(alterEl.textContent, 10) : 0;
  const octave = parseInt(pitchEl.querySelector('octave').textContent, 10);
  return (octave + 1) * 12 + (STEP_PC[step] || 0) + alter;
}

// Independent enumeration of a voice's addressable notes from an extracted segment (skip rest/chord).
function independentAddressableMidis(segXml, voiceId) {
  const doc = new DOMParser().parseFromString(segXml, 'application/xml');
  const all = Array.from(doc.querySelectorAll('note'));
  const hasVoices = all.some((n) => n.querySelector('voice'));
  const out = [];
  all.forEach((n) => {
    if (n.querySelector('rest') || n.querySelector('chord')) return;
    if (hasVoices) {
      const v = n.querySelector('voice');
      if (!v || v.textContent.trim() !== String(voiceId)) return;
    }
    const p = n.querySelector('pitch');
    if (p) out.push(midiOf(p));
  });
  return out;
}

// Part B — buildVoiceNotes must feed the engine NUMERIC beats (not note-type strings), so the
// engine's beat-based duration guards work. This unit check runs regardless of the cached fixture.
describe('buildVoiceNotes — numeric beats duration', () => {
  test('maps note-type strings to beats (quarter->1, eighth->0.5, half->2), unknown->1', () => {
    const voice = {
      pitch: [60, 62, 64, 65],
      name: ['C', 'D', 'E', 'F'],
      onset: [0, 1, 1.5, 2],           // distinct onsets => no chord-stack collapse
      duration: ['quarter', 'eighth', 'half', 'note-text'],
      measureIndex: [1, 1, 1, 1],
    };
    const out = buildVoiceNotes(voice, 1, 1, {});
    expect(out.map((n) => n.duration)).toEqual([1, 0.5, 2, 1]); // unknown type defaults to a quarter
    out.forEach((n) => expect(typeof n.duration).toBe('number'));
  });
});

const maybe = hasFixture ? describe : describe.skip;

maybe('music-embellish integration (real valsa detail)', () => {
  let detail; let source; let voice0; let voiceIds; let from; let to; let chordByMeasure;
  beforeAll(() => {
    detail = JSON.parse(fs.readFileSync(VALSA, 'utf8'));
    source = detail.source;
    voice0 = detail.voices[0];
    voiceIds = orderedVoiceIds(source);   // matches the encoder's voicesMap key order → voiceIds[i] ↔ voices[i]
    // Pick a ≤3-measure range that actually has voice-0 notes (measure 3 has a chord stack).
    from = 1; to = 3;
    chordByMeasure = buildChordByMeasure(collapsedChordSpans(detail));
  });

  // The index-alignment contract for one voice: the engine's collapsed voiceNotes must equal the
  // XML builder's addressable notes in BOTH length and MIDI pitches, in order.
  function assertAligned(vIdx) {
    const voiceNotes = buildVoiceNotes(detail.voices[vIdx], from, to, chordByMeasure);
    expect(voiceNotes.length).toBeGreaterThan(0);

    const segXml = extractSegmentXml(source, [from, to]);
    const builderMidis = independentAddressableMidis(segXml, voiceIds[vIdx]);

    // Equal length pins the collapse rule against the <chord/>-skip rule.
    expect(builderMidis.length).toBe(voiceNotes.length);
    // Equal MIDI pitches in order pins the index-alignment contract.
    expect(builderMidis).toEqual(voiceNotes.map((n) => n.midi));
    // The shared ui helper must agree with this test's independent enumeration.
    expect(addressableMidis(segXml, voiceIds[vIdx])).toEqual(builderMidis);
  }

  test('buildVoiceNotes emits numeric-beats durations for the real valsa voice', () => {
    const voiceNotes = buildVoiceNotes(voice0, from, to, chordByMeasure);
    expect(voiceNotes.length).toBeGreaterThan(0);
    voiceNotes.forEach((n) => {
      expect(typeof n.duration).toBe('number');
      expect(Number.isFinite(n.duration)).toBe(true);
      expect(n.duration).toBeGreaterThan(0);
    });
  });

  test('engine collapsed note-list index-aligns with the XML builder addressable list (voice 0)', () => {
    assertAligned(0);
  });

  test('index-alignment also holds for a voice index > 0 (voice 1)', () => {
    // valsa has 4 voices; a wrong voicesMap-vs-document ordering would silently map voice 1 to the
    // wrong <voice>. orderedVoiceIds guards against that — assert it here on real data.
    expect(detail.voices.length).toBeGreaterThan(1);
    assertAligned(1);
  });

  test('generateVariations yields ≥1 variation that builds valid XML keeping other voices', () => {
    const voiceNotes = buildVoiceNotes(voice0, from, to, chordByMeasure);
    const segmentNoteNames = detail.voices
      .flatMap((v) => v.name.filter((_, i) => v.measureIndex[i] >= from && v.measureIndex[i] <= to));

    const variations = generateVariations({
      voiceNotes,
      chordByMeasure,
      segmentNoteNames,
      key: detail.meta.key,
      techniques: ['passing', 'neighbour', 'anticipation', 'suspension'],
      addNotes: true,   // widen the pool so pitch-inserting techniques have material
      cap: 50,
    });
    expect(variations.length).toBeGreaterThanOrEqual(1);

    const segXml = extractSegmentXml(source, [from, to]);
    const otherVoiceIds = voiceIds.slice(1);
    const beforeOthers = otherVoiceIds.map((vid) => independentAddressableMidis(segXml, vid).length);

    const varXml = applyVariation(segXml, voiceIds[0], variations[0].edits);

    const doc = new DOMParser().parseFromString(varXml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelectorAll('note').length).toBeGreaterThan(0);

    // Nothing dropped from the other voices.
    const afterOthers = otherVoiceIds.map((vid) => independentAddressableMidis(varXml, vid).length);
    expect(afterOthers).toEqual(beforeOthers);
  });

  // Pins the data chain that feeds BOTH extra-note highlights (OSMD noteheads + fretboard rings):
  // a pitch-inserting variation's colored marks must be non-empty, and every mark's MIDI must be a
  // real note in the embellished voice (i.e. the added notes actually live in the voice we render).
  test('coloredNoteMarks pins the added-note highlight chain (marks non-empty, each in the voice)', () => {
    const voiceNotes = buildVoiceNotes(voice0, from, to, chordByMeasure);
    const segmentNoteNames = detail.voices
      .flatMap((v) => v.name.filter((_, i) => v.measureIndex[i] >= from && v.measureIndex[i] <= to));
    const variations = generateVariations({
      voiceNotes,
      chordByMeasure,
      segmentNoteNames,
      key: detail.meta.key,
      // Only pitch-inserting techniques (passing/neighbour/anticipation add colored notes; a
      // suspension tie is a hold, not an added note, so it stays uncolored).
      techniques: ['passing', 'neighbour', 'anticipation'],
      addNotes: true,   // widen the pool so an insert has material to add
      cap: 50,
    });
    expect(variations.length).toBeGreaterThanOrEqual(1);

    const segXml = extractSegmentXml(source, [from, to]);
    // Find a variation whose embellished XML actually carries colored (added) notes.
    let varXml = null; let marks = [];
    for (const v of variations) {
      const xml = applyVariation(segXml, voiceIds[0], v.edits);
      const m = coloredNoteMarks(xml);
      if (m.length) { varXml = xml; marks = m; break; }
    }
    expect(varXml).not.toBeNull();
    expect(marks.length).toBeGreaterThan(0);

    // Every highlighted MIDI must be one of the embellished voice's actual notes — so both the
    // OSMD notehead recolor and the fretboard highlightMidis point at real, present notes.
    const voiceMidis = independentAddressableMidis(varXml, voiceIds[0]);
    marks.forEach((m) => expect(voiceMidis).toContain(m.midi));
  });

  // Contrapuntal counter-line on REAL note data (real divisions/durations). Mirrors the corrected
  // music.html glue for a sequential segment [from,to]: extractSegmentXml RENUMBERS measures to
  // 1..N, so we build a segment-relative chord map, run buildBeatNotes on the extracted 1..N segment,
  // generate counter-lines, then realize via writeVoice(counterLineToNotesByMeasure(line, seg)).
  // All ranges are from>1: their segment measure numbers (1..N) differ from the source measure
  // numbers (from..to), which is the measure-numbering path a glue bug previously broke (0 marks).
  // (from=1 can't be exercised on valsa: source measures 1 and 5 carry no chord symbol, so
  // generateCounterLines correctly yields no line for any range that includes them.)
  test('contrapuntal counter-line realizes on real valsa data (from>1 renumbering path)', () => {
    const melodyVoiceId = orderedVoiceIds(source)[0];

    function contrapuntalXml(segFrom, segTo) {
      const N = segTo - segFrom + 1;
      const seg = extractSegmentXml(source, [segFrom, segTo]);        // renumbered 1..N
      const relChord = {};
      for (let m = 1; m <= N; m++) relChord[m] = chordByMeasure[segFrom + m - 1] || null;
      const melody = buildBeatNotes(seg, melodyVoiceId, 1, N);
      const lines = generateCounterLines({
        melody, chordByMeasure: relChord, key: detail.meta && detail.meta.key, register: 'below',
      });
      if (!lines.length) return { seg, xml: seg, lines, melody };
      const doc = new DOMParser().parseFromString(seg, 'application/xml');
      writeVoice(doc, {
        voiceId: '99', notesByMeasure: counterLineToNotesByMeasure(lines[0], seg), color: ADDED_NOTE_COLOR,
      });
      return { seg, xml: new XMLSerializer().serializeToString(doc), lines, melody };
    }

    // Ranges chosen from measures that carry chord symbols; a mix of N=1 and N=2 with growing
    // source offsets (segFrom-1 = 2, 7, 9) so a measure-numbering bug would visibly miss.
    for (const [segFrom, segTo] of [[3, 4], [8, 8], [10, 11]]) {
      const { xml, lines, melody } = contrapuntalXml(segFrom, segTo);
      expect(melody.length).toBeGreaterThan(0);                       // real melody present
      expect(lines.length).toBeGreaterThan(0);                        // at least one counter-line
      // Counter-line actually landed as colored notes in the rendered segment (this is what the
      // from>1 measure-numbering bug used to break — 0 marks).
      expect(coloredNoteMarks(xml).length).toBeGreaterThan(0);
      // Valid MusicXML + small per-beat fretboard steps for BOTH voices.
      expect(() => new DOMParser().parseFromString(xml, 'application/xml')).not.toThrow();
      const steps = variationFretSteps(xml, [melodyVoiceId, '99']);
      steps.forEach((s) => expect(s.notes.length).toBeLessThanOrEqual(6));
    }
  });

  // A real grace-slide variation must PLAY: applyGrace emits a duration-less <grace> note, and the
  // schedule builder used to drop every duration-less note — so grace notes rendered but never sounded.
  // On real data the grace must now appear in the schedule at a non-negative beat, and (because a grace
  // steals time from the beat rather than consuming the timeline) it must not shift any other onset.
  test('grace-slide variation is scheduled (audible) on real data and shifts no other note', () => {
    const melodyVoiceId = orderedVoiceIds(source)[0];
    const seg = extractSegmentXml(source, [3, 4]);
    const varXml = applyVariation(seg, melodyVoiceId, [{ op: 'grace', index: 2, insertMidi: 71, insertName: 'B' }]);
    const plain = buildScheduleFromMusicXml(seg, { tempo: 90 });
    const withGrace = buildScheduleFromMusicXml(varXml, { tempo: 90 });

    expect(withGrace.length).toBe(plain.length + 1);                 // exactly one extra event: the grace
    const graceEv = withGrace.find((e) => e.midi === 71
      && !plain.some((p) => p.midi === 71 && Math.abs(p.beat - e.beat) < 1e-6));
    expect(graceEv).toBeDefined();                                   // grace note now sounds (was dropped)
    expect(graceEv.beat).toBeGreaterThanOrEqual(0);                  // never negative → no cursor desync
    expect(graceEv.duration).toBeGreaterThan(0);                     // has audible length

    // Every non-grace onset is identical to the plain segment: the grace stole no timeline.
    const beatsWithout = withGrace.filter((e) => e !== graceEv).map((e) => e.beat).sort((a, b) => a - b);
    expect(beatsWithout).toEqual(plain.map((e) => e.beat).sort((a, b) => a - b));
  });
});
