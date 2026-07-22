/** @jest-environment jsdom */
import jQuery from 'jquery';
import { extractSegmentXml, applyVariation, coloredNoteMarks, ADDED_NOTE_COLOR, writeVoice } from './music-embellish-xml.js';

beforeAll(() => { global.$ = global.jQuery = jQuery; });

// Tiny 3-measure fixture. divisions=2 => quarter=2, whole=8. One voiceless note per measure.
const XML = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>x</part-name></score-part></part-list>
<part id="P1">
<measure number="1"><attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>A</step><octave>4</octave></pitch><duration>8</duration><type>whole</type></note></measure>
<measure number="2"><note><pitch><step>C</step><octave>5</octave></pitch><duration>8</duration><type>whole</type></note></measure>
<measure number="3"><note><pitch><step>E</step><octave>5</octave></pitch><duration>8</duration><type>whole</type></note></measure>
</part></score-partwise>`;

// One measure of four quarter notes (C D E F), divisions=2 => quarter=2, measure total=8.
const MULTI = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>x</part-name></score-part></part-list>
<part id="P1">
<measure number="1"><attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type></note>
<note><pitch><step>D</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type></note>
<note><pitch><step>E</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type></note>
<note><pitch><step>F</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type></note>
</measure></part></score-partwise>`;

// Two voices in one measure. Voice 1: a G whole note. Voice 2 (after <backup>): a rest, then A,
// then a C with a <chord/>-stacked E, then G. Voice-2 playable addressing must be [A, C, G]
// (rest and chord-stacked note skipped).
const TWO_VOICE = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>x</part-name></score-part></part-list>
<part id="P1">
<measure number="1"><attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>G</step><octave>4</octave></pitch><duration>8</duration><type>whole</type><voice>1</voice></note>
<backup><duration>8</duration></backup>
<note><rest/><duration>2</duration><type>quarter</type><voice>2</voice></note>
<note><pitch><step>A</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type><voice>2</voice></note>
<note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type><voice>2</voice></note>
<note><chord/><pitch><step>E</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type><voice>2</voice></note>
<note><pitch><step>G</step><octave>5</octave></pitch><duration>2</duration><type>quarter</type><voice>2</voice></note>
</measure></part></score-partwise>`;

// divisions=1 => a quarter note is ONE division. A 1-division note cannot be split into two
// parts each >= 1 division, so both applySplit and applyInsert must refuse to touch it (else they
// would emit a <duration>0</duration> note = malformed for playback/render).
const ONE_DIV = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>x</part-name></score-part></part-list>
<part id="P1">
<measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
<note><pitch><step>C</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>E</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
<note><pitch><step>F</step><octave>5</octave></pitch><duration>1</duration><type>quarter</type></note>
</measure></part></score-partwise>`;

const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml');

// ---------------------------------------------------------------------------
// Task 11 — extractSegmentXml
// ---------------------------------------------------------------------------
describe('extractSegmentXml', () => {
  test('keeps only the requested measures and carries divisions/clef', () => {
    const out = extractSegmentXml(XML, [2, 3]);
    const doc = parse(out);
    const measures = doc.querySelectorAll('measure');
    expect(measures.length).toBe(2);
    expect(doc.querySelector('divisions').textContent).toBe('2'); // carried onto measure 2
    expect(doc.querySelector('clef sign').textContent).toBe('G'); // clef carried too
  });

  test('renumbers kept measures starting from 1', () => {
    const out = extractSegmentXml(XML, [2, 3]);
    const doc = parse(out);
    const nums = [...doc.querySelectorAll('measure')].map((m) => m.getAttribute('number'));
    expect(nums).toEqual(['1', '2']);
  });

  test('a single leading measure keeps its own attributes untouched', () => {
    const out = extractSegmentXml(XML, [1, 1]);
    const doc = parse(out);
    expect(doc.querySelectorAll('measure').length).toBe(1);
    expect(doc.querySelector('divisions').textContent).toBe('2');
    expect(doc.querySelector('step').textContent).toBe('A');
  });
});

// ---------------------------------------------------------------------------
// Task 12 — applyVariation: split + insert
// ---------------------------------------------------------------------------
describe('applyVariation — split', () => {
  test('halves a note and inserts the decoration pitch as its second half', () => {
    const seg = extractSegmentXml(XML, [1, 1]); // single A whole note, divisions=2
    const out = applyVariation(seg, 'P1', [{ op: 'split', index: 0, insertMidi: 71, insertName: 'B' }]);
    const doc = parse(out);
    const notes = doc.querySelectorAll('measure note');
    expect(notes.length).toBe(2);
    // first half keeps the original pitch, second half is the decoration
    expect(notes[0].querySelector('step').textContent).toBe('A');
    expect(notes[1].querySelector('step').textContent).toBe('B');
    expect(notes[1].querySelector('octave').textContent).toBe('4'); // B4 from midi 71
    // durations sum preserved and each becomes a half note (4 divisions)
    const dur = [...notes].map((n) => +n.querySelector('duration').textContent);
    expect(dur[0] + dur[1]).toBe(8);
    expect(dur).toEqual([4, 4]);
    expect(notes[0].querySelector('type').textContent).toBe('half');
    expect(notes[1].querySelector('type').textContent).toBe('half');
  });

  test('before:true (appoggiatura) puts the decoration FIRST and the original tone second', () => {
    const seg = extractSegmentXml(XML, [1, 1]);
    const out = applyVariation(seg, 'P1', [{ op: 'split', index: 0, insertMidi: 74, insertName: 'D', before: true }]);
    const doc = parse(out);
    const notes = doc.querySelectorAll('measure note');
    expect(notes.length).toBe(2);
    expect(notes[0].querySelector('step').textContent).toBe('D'); // decoration first
    expect(notes[0].querySelector('octave').textContent).toBe('5'); // D5 from midi 74
    expect(notes[1].querySelector('step').textContent).toBe('A'); // original chord tone second
    const dur = [...notes].map((n) => +n.querySelector('duration').textContent);
    expect(dur[0] + dur[1]).toBe(8);
  });

  test('a sharp decoration emits an <alter> of 1', () => {
    const seg = extractSegmentXml(XML, [1, 1]);
    const out = applyVariation(seg, 'P1', [{ op: 'split', index: 0, insertMidi: 73, insertName: 'C#' }]);
    const doc = parse(out);
    const notes = doc.querySelectorAll('measure note');
    expect(notes[1].querySelector('step').textContent).toBe('C');
    expect(notes[1].querySelector('alter').textContent).toBe('1');
    expect(notes[1].querySelector('octave').textContent).toBe('5'); // C#5 from midi 73
  });
});

describe('applyVariation — split on a middle note', () => {
  test('splits note[1] of a 4-note measure, leaving the others and the total intact', () => {
    const out = applyVariation(MULTI, 'P1', [{ op: 'split', index: 1, insertMidi: 65, insertName: 'F' }]);
    const doc = parse(out);
    const notes = doc.querySelectorAll('measure note');
    expect(notes.length).toBe(5);
    const steps = [...notes].map((n) => n.querySelector('step').textContent);
    expect(steps).toEqual(['C', 'D', 'F', 'E', 'F']); // D split -> D + decoration F, then untouched E,F
    const dur = [...notes].map((n) => +n.querySelector('duration').textContent);
    expect(dur.reduce((a, b) => a + b, 0)).toBe(8); // measure total preserved
    expect(dur[1] + dur[2]).toBe(2); // the split note's two halves sum to the original quarter
  });
});

describe('applyVariation — multiple non-conflicting edits in one call', () => {
  test('split@0 + split@2 both land correctly (descending-order application keeps indices valid)', () => {
    const out = applyVariation(MULTI, 'P1', [
      { op: 'split', index: 0, insertMidi: 74, insertName: 'D' },
      { op: 'split', index: 2, insertMidi: 65, insertName: 'F' },
    ]);
    const doc = parse(out);
    const steps = [...doc.querySelectorAll('measure note')].map((n) => n.querySelector('step').textContent);
    // original C D E F -> (C,decoD) D (E,decoF) F
    expect(steps).toEqual(['C', 'D', 'D', 'E', 'F', 'F']);
    const dur = [...doc.querySelectorAll('measure note')].map((n) => +n.querySelector('duration').textContent);
    expect(dur.reduce((a, b) => a + b, 0)).toBe(8);
  });
});

describe('applyVariation — voice filtering', () => {
  test('editing voice 2 skips rest/chord notes and leaves voice 1 and <backup> untouched', () => {
    const out = applyVariation(TWO_VOICE, 'P2'.slice(1), [{ op: 'split', index: 0, insertMidi: 71, insertName: 'B' }]);
    // NB: voiceId is '2' (TWO_VOICE has real <voice> elements, so it is honoured)
    const doc = parse(out);

    // Voice 1 whole note untouched.
    const v1 = [...doc.querySelectorAll('note')].find((n) => n.querySelector('voice')?.textContent === '1');
    expect(v1.querySelector('step').textContent).toBe('G');
    expect(v1.querySelector('duration').textContent).toBe('8');

    // <backup> untouched.
    expect(doc.querySelector('backup duration').textContent).toBe('8');

    // Rest untouched (still a quarter rest).
    const rest = [...doc.querySelectorAll('note')].find((n) => n.querySelector('rest'));
    expect(rest.querySelector('duration').textContent).toBe('2');

    // Chord-stacked E untouched (still present, still a <chord/> note).
    const chord = [...doc.querySelectorAll('note')].find((n) => n.querySelector('chord'));
    expect(chord.querySelector('step').textContent).toBe('E');

    // The split landed on A (first playable voice-2 note), inserting B right after it.
    const v2playable = [...doc.querySelectorAll('note')].filter(
      (n) => n.querySelector('voice')?.textContent === '2' && !n.querySelector('rest') && !n.querySelector('chord'));
    const v2steps = v2playable.map((n) => n.querySelector('step').textContent);
    expect(v2steps).toEqual(['A', 'B', 'C', 'G']); // A halved -> A + decoration B, then C, G
    expect(+v2playable[0].querySelector('duration').textContent
      + +v2playable[1].querySelector('duration').textContent).toBe(2);
  });
});

describe('applyVariation — insert (anticipation)', () => {
  test('steals note[i] tail and inserts the anticipated pitch before note[j]', () => {
    const seg = extractSegmentXml(XML, [1, 2]); // A (m1), C (m2)
    const out = applyVariation(seg, 'P1', [{ op: 'insert', gap: [0, 1], insertMidi: 72, insertName: 'C' }]);
    const doc = parse(out);
    const m1notes = doc.querySelectorAll('measure')[0].querySelectorAll('note');
    expect(m1notes.length).toBe(2); // original A + anticipation C at end of m1
    expect(m1notes[1].querySelector('step').textContent).toBe('C');
    // measure 1 total still 8
    const m1dur = [...m1notes].map((n) => +n.querySelector('duration').textContent);
    expect(m1dur.reduce((a, b) => a + b, 0)).toBe(8);
    // measure 2 untouched (still one note summing 8)
    const m2notes = doc.querySelectorAll('measure')[1].querySelectorAll('note');
    expect(m2notes.length).toBe(1);
  });

  test('anticipation when note[gap[0]] is NOT the last note in its measure', () => {
    // Steal from D (index 1) and insert an E anticipation before E (index 2), inside a 4-note bar.
    const out = applyVariation(MULTI, 'P1', [{ op: 'insert', gap: [1, 2], insertMidi: 64, insertName: 'E' }]);
    const doc = parse(out);
    const notes = doc.querySelectorAll('measure note');
    expect(notes.length).toBe(5);
    const steps = [...notes].map((n) => n.querySelector('step').textContent);
    expect(steps).toEqual(['C', 'D', 'E', 'E', 'F']); // anticipation E sits between D and the real E
    const dur = [...notes].map((n) => +n.querySelector('duration').textContent);
    expect(dur.reduce((a, b) => a + b, 0)).toBe(8); // measure total preserved
    expect(dur[1] + dur[2]).toBe(2); // D's original quarter split into D-tail + anticipation
  });
});

// ---------------------------------------------------------------------------
// Duration guard — never emit a <duration>0</duration> note (divisions-aware)
// ---------------------------------------------------------------------------
describe('applyVariation — duration guard on short notes', () => {
  test('split on a 1-division note is skipped (measure unchanged, no zero-duration note)', () => {
    const out = applyVariation(ONE_DIV, 'P1', [{ op: 'split', index: 1, insertMidi: 65, insertName: 'F' }]);
    const doc = parse(out);
    expect(doc.querySelector('parsererror')).toBeNull();            // still parses
    const notes = doc.querySelectorAll('measure note');
    expect(notes.length).toBe(4);                                   // no decoration inserted
    const dur = [...notes].map((n) => +n.querySelector('duration').textContent);
    expect(dur).toEqual([1, 1, 1, 1]);                              // untouched
    expect(dur.every((d) => d >= 1)).toBe(true);                    // never a note < 1 division
    expect(out).not.toContain('<duration>0</duration>');
  });

  test('before:true (appoggiatura) split on a 1-division note is skipped too', () => {
    const out = applyVariation(ONE_DIV, 'P1', [{ op: 'split', index: 0, insertMidi: 74, insertName: 'D', before: true }]);
    const doc = parse(out);
    expect(doc.querySelector('parsererror')).toBeNull();
    const notes = doc.querySelectorAll('measure note');
    expect(notes.length).toBe(4);
    expect([...notes].map((n) => +n.querySelector('duration').textContent)).toEqual([1, 1, 1, 1]);
    expect(out).not.toContain('<duration>0</duration>');
  });

  test('insert (anticipation) targeting a 1-division note is skipped (no zero-duration note)', () => {
    const out = applyVariation(ONE_DIV, 'P1', [{ op: 'insert', gap: [0, 1], insertMidi: 62, insertName: 'D' }]);
    const doc = parse(out);
    expect(doc.querySelector('parsererror')).toBeNull();
    const notes = doc.querySelectorAll('measure note');
    expect(notes.length).toBe(4);
    expect([...notes].map((n) => +n.querySelector('duration').textContent)).toEqual([1, 1, 1, 1]);
    expect(out).not.toContain('<duration>0</duration>');
  });

  test('a 2-division note still splits (guard only blocks divs < 2)', () => {
    const seg = extractSegmentXml(XML, [1, 1]); // A whole note, divisions=2 => 8 divisions
    const out = applyVariation(seg, 'P1', [{ op: 'split', index: 0, insertMidi: 71, insertName: 'B' }]);
    const notes = parse(out).querySelectorAll('measure note');
    expect(notes.length).toBe(2); // long note is unaffected by the guard
  });
});

// ---------------------------------------------------------------------------
// Task 13 — applyVariation: tie + retime
// ---------------------------------------------------------------------------
describe('applyVariation — tie (suspension/retardation)', () => {
  test('adds tie start on the suspended note and a tied continuation before the resolution', () => {
    const seg = extractSegmentXml(XML, [1, 2]); // A (m1) -> C (m2)
    const out = applyVariation(seg, 'P1', [{ op: 'tie', index: 0 }]);
    const doc = parse(out);
    // tie start on the original note in measure 1
    const m1note = doc.querySelectorAll('measure')[0].querySelector('note');
    expect(m1note.querySelector('tie[type="start"]')).not.toBeNull();
    // measure 2 now has a continuation (tie stop, suspended A pitch) then the resolution C
    const m2notes = doc.querySelectorAll('measure')[1].querySelectorAll('note');
    expect(m2notes.length).toBe(2);
    expect(m2notes[0].querySelector('tie[type="stop"]')).not.toBeNull();
    expect(m2notes[0].querySelector('step').textContent).toBe('A'); // held-over suspension pitch
    expect(m2notes[1].querySelector('step').textContent).toBe('C'); // resolution
    // measure 2 total preserved
    const m2dur = [...m2notes].map((n) => +n.querySelector('duration').textContent);
    expect(m2dur.reduce((a, b) => a + b, 0)).toBe(8);
    // a <tied> notation is present for rendering
    expect(doc.querySelector('notations tied[type="start"]')).not.toBeNull();
  });
});

describe('applyVariation — retime', () => {
  test('moves a note earlier by shrinking the previous note and growing this one', () => {
    const seg = extractSegmentXml(XML, [1, 1]);
    // first split so there are two notes in a measure to retime between
    const split = applyVariation(seg, 'P1', [{ op: 'split', index: 0, insertMidi: 71, insertName: 'B' }]);
    const out = applyVariation(split, 'P1', [{ op: 'retime', index: 1, deltaOnset: 2 }]);
    const doc = parse(out);
    const notes = doc.querySelectorAll('measure note');
    const dur = [...notes].map((n) => +n.querySelector('duration').textContent);
    expect(dur).toEqual([2, 6]); // prev shrank by 2, current grew by 2
    expect(dur.reduce((a, b) => a + b, 0)).toBe(8); // measure total preserved
  });

  test('an unmappable duration removes <type> rather than leaving it wrong', () => {
    const seg = extractSegmentXml(XML, [1, 1]);
    const split = applyVariation(seg, 'P1', [{ op: 'split', index: 0, insertMidi: 71, insertName: 'B' }]);
    // retime yields a 6-division note = 3 quarters, which has no plain <type>.
    const out = applyVariation(split, 'P1', [{ op: 'retime', index: 1, deltaOnset: 2 }]);
    const doc = parse(out);
    const notes = doc.querySelectorAll('measure note');
    expect(+notes[1].querySelector('duration').textContent).toBe(6); // duration is correct
    expect(notes[1].querySelector('type')).toBeNull(); // unmappable -> type dropped, not left wrong
    // the mappable sibling still carries a correct type
    expect(notes[0].querySelector('type').textContent).toBe('quarter');
  });
});

// ---------------------------------------------------------------------------
// Marking added notes with a color attribute
// ---------------------------------------------------------------------------
describe('applyVariation — color-marks the added decoration note', () => {
  test('passing split colors exactly ONE note, and it is the decoration', () => {
    const seg = extractSegmentXml(XML, [1, 1]); // A whole note
    const out = applyVariation(seg, 'P1', [{ op: 'split', index: 0, insertMidi: 71, insertName: 'B' }]);
    const doc = parse(out);
    const notes = [...doc.querySelectorAll('measure note')];
    const colored = notes.filter((n) => n.getAttribute('color') === ADDED_NOTE_COLOR);
    expect(colored.length).toBe(1);
    expect(colored[0].querySelector('step').textContent).toBe('B'); // decoration pitch
    expect(ADDED_NOTE_COLOR).toBe('#EAB308');
    // the kept original is NOT colored
    expect(notes[0].getAttribute('color')).toBeNull();
  });

  test('before:true (appoggiatura) colors the FIRST (decoration) note, not the original', () => {
    const seg = extractSegmentXml(XML, [1, 1]);
    const out = applyVariation(seg, 'P1', [{ op: 'split', index: 0, insertMidi: 74, insertName: 'D', before: true }]);
    const doc = parse(out);
    const notes = [...doc.querySelectorAll('measure note')];
    expect(notes[0].getAttribute('color')).toBe(ADDED_NOTE_COLOR); // decoration first
    expect(notes[0].querySelector('step').textContent).toBe('D');
    expect(notes[1].getAttribute('color')).toBeNull(); // original chord tone
    expect(notes.filter((n) => n.getAttribute('color') === ADDED_NOTE_COLOR).length).toBe(1);
  });

  test('anticipation insert colors the anticipation note', () => {
    const seg = extractSegmentXml(XML, [1, 2]);
    const out = applyVariation(seg, 'P1', [{ op: 'insert', gap: [0, 1], insertMidi: 72, insertName: 'C' }]);
    const doc = parse(out);
    const notes = [...doc.querySelectorAll('measure note')];
    const colored = notes.filter((n) => n.getAttribute('color') === ADDED_NOTE_COLOR);
    expect(colored.length).toBe(1);
    expect(colored[0].querySelector('step').textContent).toBe('C'); // the anticipation
  });

  test('tie (suspension) colors NO note — a hold is not an added note', () => {
    const seg = extractSegmentXml(XML, [1, 2]);
    const out = applyVariation(seg, 'P1', [{ op: 'tie', index: 0 }]);
    const doc = parse(out);
    const colored = [...doc.querySelectorAll('measure note')].filter((n) => n.getAttribute('color') === ADDED_NOTE_COLOR);
    expect(colored.length).toBe(0);
  });
});

describe('coloredNoteMarks', () => {
  test('returns one mark for a passing split with correct measure, midi, and onset', () => {
    const seg = extractSegmentXml(XML, [1, 1]); // A whole note in measure 1, divisions=2
    const out = applyVariation(seg, 'P1', [{ op: 'split', index: 0, insertMidi: 71, insertName: 'B' }]);
    const marks = coloredNoteMarks(out);
    expect(marks.length).toBe(1);
    expect(marks[0].measure).toBe(1);
    expect(marks[0].midi).toBe(71); // matches insertMidi (B4)
    expect(marks[0].onsetDivs).toBe(4); // decoration is the 2nd half of the 8-division whole note
  });

  test('returns no marks for a tie variation', () => {
    const seg = extractSegmentXml(XML, [1, 2]);
    const out = applyVariation(seg, 'P1', [{ op: 'tie', index: 0 }]);
    expect(coloredNoteMarks(out)).toEqual([]);
  });

  test('anticipation mark carries the anticipated midi and its measure', () => {
    const seg = extractSegmentXml(XML, [1, 2]);
    const out = applyVariation(seg, 'P1', [{ op: 'insert', gap: [0, 1], insertMidi: 72, insertName: 'C' }]);
    const marks = coloredNoteMarks(out);
    expect(marks.length).toBe(1);
    expect(marks[0].measure).toBe(1);
    expect(marks[0].midi).toBe(72); // C5 anticipation
    expect(marks[0].onsetDivs).toBe(4); // sits after the A that kept the first 4 divisions
  });
});

// ---------------------------------------------------------------------------
// grace op — slashed, duration-less grace note
// ---------------------------------------------------------------------------
describe('applyVariation — grace', () => {
  test('grace op inserts a colored, duration-less grace note before the target', () => {
    const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice></note>
    </measure></part></score-partwise>`;
    const out = applyVariation(seg, '1', [{ op: 'grace', index: 0, insertMidi: 71, insertName: 'B' }]);
    const doc = new DOMParser().parseFromString(out, 'application/xml');
    const notes = Array.from(doc.querySelectorAll('note'));
    expect(notes[0].querySelector('grace')).not.toBeNull();          // grace comes first
    expect(notes[0].firstElementChild.tagName.toLowerCase()).toBe('grace'); // <grace> before <pitch>
    expect(notes[0].querySelector('duration')).toBeNull();           // grace notes carry no duration
    expect(notes[0].querySelector('type').textContent).toBe('eighth'); // ...but MUST carry a <type> or OSMD/VexFlow throws
    expect(notes[0].getAttribute('color')).toBe(ADDED_NOTE_COLOR);
    expect(notes[0].querySelector('voice').textContent).toBe('1');   // carries the voice
    expect(coloredNoteMarks(out).some((m) => m.midi === 71)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shuffle op — swing an eighth pair to long-short (2:1)
// ---------------------------------------------------------------------------
describe('applyVariation — shuffle', () => {
  test('shuffle op re-times an eighth pair to long-short (2:1) preserving the beat total', () => {
    // divisions=6 (quarter=6, eighth=3). Two eighths on beat 1 → should become 4 + 2.
    const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
      <attributes><divisions>6</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>3</duration><voice>1</voice></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>3</duration><voice>1</voice></note>
    </measure></part></score-partwise>`;
    const out = applyVariation(seg, '1', [{ op: 'shuffle', index: 0 }]);
    const doc = new DOMParser().parseFromString(out, 'application/xml');
    const durs = Array.from(doc.querySelectorAll('note duration')).map((d) => parseInt(d.textContent, 10));
    expect(durs).toEqual([4, 2]);   // long, short; sums to the original 6
  });

  test('shuffle op is a no-op when the pair cannot swing 2:1 in whole divisions', () => {
    const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><voice>1</voice></note>
    </measure></part></score-partwise>`;
    const out = applyVariation(seg, '1', [{ op: 'shuffle', index: 0 }]);
    const durs = Array.from(new DOMParser().parseFromString(out, 'application/xml').querySelectorAll('note duration')).map((d) => parseInt(d.textContent, 10));
    expect(durs).toEqual([1, 1]);   // total 2 can't split long>short in whole divisions → unchanged
  });

  test('shuffle op is a no-op (does not throw) when a neighbor is a duration-less grace note', () => {
    // notes[0] is a slashed grace note (no <duration>); notes[1] is a normal note. Reading the
    // grace note's missing <duration> used to throw a TypeError — the guard makes it a clean no-op.
    const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><grace slash="yes"/><pitch><step>B</step><octave>4</octave></pitch><voice>1</voice></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice></note>
    </measure></part></score-partwise>`;
    let out;
    expect(() => { out = applyVariation(seg, '1', [{ op: 'shuffle', index: 0 }]); }).not.toThrow();
    const doc = new DOMParser().parseFromString(out, 'application/xml');
    const durs = Array.from(doc.querySelectorAll('note duration')).map((d) => parseInt(d.textContent, 10));
    expect(durs).toEqual([4]);   // the sole real note keeps its duration; the grace stays duration-less
  });
});

describe('writeVoice', () => {
  const SEG = `<?xml version="1.0"?><score-partwise><part id="P1">
    <measure number="1">
      <attributes><divisions>2</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
    </measure>
  </part></score-partwise>`;

  test('into an EMPTY measure it adds NO leading backup (voice starts at onset 0, not a negative beat)', () => {
    // splitSingleVoice empties the measure then lays voice 1 first. A leading <backup> there rewinds
    // over nothing and pushes the voice to a NEGATIVE onset (OSMD normalizes to 0 but the player reads
    // it literally → cursor/mute/play desync). No prior content ⇒ no backup.
    const empty = `<?xml version="1.0"?><score-partwise><part id="P1">
      <measure number="1"><attributes><divisions>2</divisions></attributes></measure>
    </part></score-partwise>`;
    const doc = new DOMParser().parseFromString(empty, 'application/xml');
    writeVoice(doc, { voiceId: '1', notesByMeasure: { 1: { divs: 4, notes: [{ onsetDivs: 0, durDivs: 4, midi: 60 }] } } });
    expect(doc.querySelector('measure backup')).toBeNull();
  });

  test('appends a second voice after a <backup> that rewinds the whole measure', () => {
    const doc = new DOMParser().parseFromString(SEG, 'application/xml');
    writeVoice(doc, { voiceId: '2', color: '#C62828',
      notesByMeasure: { 1: { divs: 6, notes: [{ onsetDivs: 0, durDivs: 3, midi: 55 }] } } });
    const m = doc.querySelector('measure');
    const backup = m.querySelector('backup > duration');
    expect(backup && backup.textContent).toBe('6');
    const v2 = Array.from(m.querySelectorAll('note')).filter((n) => {
      const v = n.querySelector('voice'); return v && v.textContent === '2';
    });
    const durs = v2.map((n) => parseInt(n.querySelector('duration').textContent, 10));
    expect(durs.reduce((a, b) => a + b, 0)).toBe(6);
    const pitched = v2.find((n) => n.querySelector('pitch'));
    expect(pitched.getAttribute('color')).toBe('#C62828');
    expect(v2.some((n) => n.querySelector('rest'))).toBe(true);
  });

  test('fills a leading gap, honours an explicit rest item, and stamps the staff', () => {
    const doc = new DOMParser().parseFromString(SEG, 'application/xml');
    // divs=8: a rest gap [0,2), a pitched G3 [2,4), an explicit rest [4,6), then trailing gap [6,8).
    writeVoice(doc, { voiceId: '2', staff: 2, notesByMeasure: {
      1: { divs: 8, notes: [
        { onsetDivs: 2, durDivs: 2, midi: 55 },
        { onsetDivs: 4, durDivs: 2, rest: true },
      ] },
    } });
    const m = doc.querySelector('measure');
    const v2 = Array.from(m.querySelectorAll('note')).filter((n) => {
      const v = n.querySelector('voice'); return v && v.textContent === '2';
    });
    // Order: leading-gap rest, G3, explicit rest, trailing rest.
    const pitchedIdx = v2.findIndex((n) => n.querySelector('pitch'));
    expect(pitchedIdx).toBe(1); // a rest precedes the pitched note (leading gap ran)
    const leadRest = v2[0];
    expect(leadRest.querySelector('rest')).toBeTruthy();
    expect(leadRest.querySelector('duration').textContent).toBe('2'); // gap = onsetDivs (2)
    // Explicit { rest: true } item produced a rest of its stated duration.
    const explicitRest = v2[2];
    expect(explicitRest.querySelector('rest')).toBeTruthy();
    expect(explicitRest.querySelector('duration').textContent).toBe('2');
    // Every emitted voice note carries the staff.
    expect(v2.every((n) => n.querySelector('staff') && n.querySelector('staff').textContent === '2')).toBe(true);
    // Full measure covered.
    const durs = v2.map((n) => parseInt(n.querySelector('duration').textContent, 10));
    expect(durs.reduce((a, b) => a + b, 0)).toBe(8);
  });

  test('stacks two notes at the same onset as a chord (no measure overflow)', () => {
    const doc = new DOMParser().parseFromString(SEG, 'application/xml');
    writeVoice(doc, { voiceId: '2', notesByMeasure: {
      1: { divs: 6, notes: [
        { onsetDivs: 0, durDivs: 6, midi: 64 },
        { onsetDivs: 0, durDivs: 6, midi: 67 },
      ] },
    } });
    const m = doc.querySelector('measure');
    const v2 = Array.from(m.querySelectorAll('note')).filter((n) => {
      const v = n.querySelector('voice'); return v && v.textContent === '2';
    });
    const pitched = v2.filter((n) => n.querySelector('pitch'));
    expect(pitched).toHaveLength(2);                         // both notes present
    expect(pitched[0].querySelector('chord')).toBeNull();   // first note plain
    const chordEl = pitched[1].querySelector('chord');
    expect(chordEl).not.toBeNull();                          // second note is a <chord/>
    expect(pitched[1].firstChild).toBe(chordEl);             // <chord/> precedes <pitch>
    // A chord note adds 0 to the timeline; the voice spans exactly the measure.
    const advanced = v2
      .filter((n) => !n.querySelector('chord'))
      .reduce((a, n) => a + parseInt(n.querySelector('duration').textContent, 10), 0);
    expect(advanced).toBe(6);
  });
});
