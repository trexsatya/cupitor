import { variationFretSteps, voicePickerEntries, counterLineToNotesByMeasure, buildBeatNotes } from './music-embellish-ui.js';
import { writeVoice, ADDED_NOTE_COLOR } from './music-embellish-xml.js';

// divisions=2 (quarter = 2 divisions), 3/4. Voice 1 across two measures:
//   m1: C quarter(0) | E eighth(2) G eighth(3) | A quarter(4)   → beats 0,1,1,2
//   m2: rest quarter(0) | B quarter(2)                          → beat 0 (rest), 1
const SEG = `<?xml version="1.0"?>
<score-partwise><part id="P1">
  <measure number="1">
    <attributes><divisions>2</divisions><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
    <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
    <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
    <note><pitch><step>A</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
  </measure>
  <measure number="2">
    <note><rest/><duration>2</duration><voice>1</voice></note>
    <note><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
  </measure>
</part></score-partwise>`;

describe('variationFretSteps', () => {
  test('groups notes by BEAT (one step per beat, not per note)', () => {
    const steps = variationFretSteps(SEG, '1');
    // Beats: m1 b1=[C], m1 b2=[E,G], m1 b3=[A], m2 b2=[B]. The m2 b1 rest holds no notes → no step.
    expect(steps.map((s) => s.notes.map((n) => n.name))).toEqual([['C'], ['E', 'G'], ['A'], ['B']]);
  });

  test('no step packs more than a beat of notes (fretboard OOM guard)', () => {
    const steps = variationFretSteps(SEG, '1');
    steps.forEach((s) => expect(s.notes.length).toBeLessThanOrEqual(3));
  });

  test('carries accidental + octave on each grouped note', () => {
    const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
    </measure></part></score-partwise>`;
    const steps = variationFretSteps(seg, '1');
    expect(steps).toHaveLength(1);
    expect(steps[0].notes[0]).toEqual({ name: 'F#', octave: 4 });
  });

  test('each step carries playable events {midi,beat,durBeats} for the fretboard Play-Step', () => {
    const steps = variationFretSteps(SEG, '1');
    // m1 b1 = C4 quarter (2 divisions ÷ 2 = 1 beat) at onset 0.
    expect(steps[0].events).toEqual([{ midi: 60, beat: 0, durBeats: 1 }]);
    // m1 b2 = E4 + G4 eighths, sequencing within the beat (onsets 2,3 → beats 1, 1.5).
    expect(steps[1].events).toEqual([
      { midi: 64, beat: 1, durBeats: 0.5 },
      { midi: 67, beat: 1.5, durBeats: 0.5 },
    ]);
  });

  test('step events carry ABSOLUTE beats across measure boundaries (for cursor positioning)', () => {
    const steps = variationFretSteps(SEG, '1');
    // m1 spans 3 quarter-beats (C=1, E+G=1, A=1). m2's B sits at measure-relative beat 1, so its
    // ABSOLUTE onset from the segment start is 3 + 1 = 4 — what the OSMD cursor needs to home there.
    const last = steps[steps.length - 1];
    expect(last.notes.map((n) => n.name)).toEqual(['B']);
    expect(last.events[0].beat).toBe(4);
  });

  test('variationFretSteps groups TWO voices per beat when given an array of ids', () => {
    const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      <backup><duration>4</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>2</voice></note>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>2</voice></note>
    </measure></part></score-partwise>`;
    const steps = variationFretSteps(seg, ['1', '2']);
    // beat 0: G4 (v1) + C3 (v2); beat 1: E4 (v1) + C3 (v2)
    expect(steps[0].notes.map((n) => n.name).sort()).toEqual(['C', 'G']);
    expect(steps[1].notes.map((n) => n.name).sort()).toEqual(['C', 'E']);
  });
});

describe('voicePickerEntries', () => {
  test('single-voice source yields Melody + Bass synthetic entries', () => {
    const src = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
    </measure></part></score-partwise>`;
    const entries = voicePickerEntries(src, ['1']);
    expect(entries.map((e) => e.label)).toEqual(['Melody (auto-split)', 'Bass (auto-split)']);
    expect(entries.map((e) => e.split)).toEqual([true, true]);
    expect(entries.map((e) => e.voiceId)).toEqual(['1', '2']);
  });

  test('multi-voice source yields one entry per real voice (no split)', () => {
    const src = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      <note><pitch><step>E</step><octave>3</octave></pitch><duration>2</duration><voice>2</voice></note>
    </measure></part></score-partwise>`;
    const entries = voicePickerEntries(src, ['1', '2']);
    expect(entries.every((e) => e.split === false)).toBe(true);
    expect(entries.map((e) => e.voiceId)).toEqual(['1', '2']);
  });
});

describe('counterLineToNotesByMeasure', () => {
  test('counter-line realizes as a colored voice via writeVoice', () => {
    const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>6</duration><voice>1</voice></note>
    </measure></part></score-partwise>`;
    const line = { notes: [{ midi: 48, measure: 1, onsetDivs: 0, durDivs: 6 }] };  // C3 spanning the measure
    const nbm = counterLineToNotesByMeasure(line, seg);
    expect(nbm[1].divs).toBe(6);
    expect(nbm[1].notes).toEqual([{ onsetDivs: 0, durDivs: 6, midi: 48 }]);
    const doc = new DOMParser().parseFromString(seg, 'application/xml');
    writeVoice(doc, { voiceId: '2', notesByMeasure: nbm, color: ADDED_NOTE_COLOR });
    const v2pitched = Array.from(doc.querySelectorAll('note'))
      .find((n) => (n.querySelector('voice') || {}).textContent === '2' && n.querySelector('pitch'));
    expect(v2pitched.getAttribute('color')).toBe(ADDED_NOTE_COLOR);
  });

  test('multi-voice segment: divs is the per-voice max, not the sum (no double-count)', () => {
    // Voice 1: four divisions of notes; voice 2 (after <backup>): another four. Both span the same
    // measure length (4), so divs must be 4 — NOT 8 (summing both voices).
    const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      <backup><duration>4</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>2</voice></note>
      <note><pitch><step>E</step><octave>3</octave></pitch><duration>2</duration><voice>2</voice></note>
    </measure></part></score-partwise>`;
    const line = { notes: [{ midi: 55, measure: 1, onsetDivs: 0, durDivs: 4 }] };
    const nbm = counterLineToNotesByMeasure(line, seg);
    expect(nbm[1].divs).toBe(4);
  });

  test('counter-line spans multiple measures, divs read per measure', () => {
    const seg = `<?xml version="1.0"?><score-partwise><part id="P1">
      <measure number="1"><attributes><divisions>2</divisions></attributes>
        <note><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note></measure>
      <measure number="2">
        <note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note></measure>
    </part></score-partwise>`;
    const line = { notes: [
      { midi: 48, measure: 1, onsetDivs: 0, durDivs: 4 },
      { midi: 50, measure: 2, onsetDivs: 0, durDivs: 4 },
    ] };
    const nbm = counterLineToNotesByMeasure(line, seg);
    expect(nbm[1].divs).toBe(4);
    expect(nbm[2].divs).toBe(4);
    expect(nbm[2].notes).toEqual([{ onsetDivs: 0, durDivs: 4, midi: 50 }]);
  });
});

describe('buildBeatNotes', () => {
  test('returns per-note beat entries for a voice over a measure range', () => {
    const src = `<?xml version="1.0"?><score-partwise><part id="P1">
      <measure number="1"><attributes><divisions>2</divisions></attributes>
        <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
        <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      </measure></part></score-partwise>`;
    const out = buildBeatNotes(src, '1', 1, 1);
    expect(out).toEqual([
      { midi: 67, measure: 1, beat: 0, onsetDivs: 0, durDivs: 2 },
      { midi: 65, measure: 1, beat: 1, onsetDivs: 2, durDivs: 2 },
    ]);
  });

  test('filters to the measure range and the chosen voice, skips rests/chords', () => {
    const src = `<?xml version="1.0"?><score-partwise><part id="P1">
      <measure number="1"><attributes><divisions>2</divisions></attributes>
        <note><rest/><duration>2</duration><voice>1</voice></note>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
        <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      </measure>
      <measure number="2"><note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note></measure>
    </part></score-partwise>`;
    const out = buildBeatNotes(src, '1', 1, 1);   // only measure 1
    // rest at onset0 advances the clock; C4 at onset2 beat1; chord E4 skipped
    expect(out).toEqual([{ midi: 60, measure: 1, beat: 1, onsetDivs: 2, durDivs: 2 }]);
  });
});
