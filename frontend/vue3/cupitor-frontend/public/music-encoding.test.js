// public/music-encoding.test.js
import { nameToMidi, intervalsOf, toSargam, packContour, unpackContour, encodeNoteText, encodeMusicXml, inferChords } from './music-encoding.js';
import jQuery from 'jquery';

// musicxml.js relies on a global `$`; provide it for jsdom.
beforeAll(() => { global.$ = global.jQuery = jQuery; });

describe('pitch helpers', () => {
  test('nameToMidi: C4 = 60, A4 = 69, C#5 = 73', () => {
    expect(nameToMidi('C', 4)).toBe(60);
    expect(nameToMidi('A', 4)).toBe(69);
    expect(nameToMidi('C#', 5)).toBe(73);
    expect(nameToMidi('Db', 5)).toBe(73); // enharmonic
  });

  test('intervalsOf: deltas between consecutive MIDI numbers', () => {
    expect(intervalsOf([60, 67, 66, 65])).toEqual([7, -1, -1]);
    expect(intervalsOf([60])).toEqual([]);
    expect(intervalsOf([])).toEqual([]);
  });

  test('toSargam: degree in key by pitch-class, null for chromatic', () => {
    // Key of C major: C->Sa, D->Re, E->Ga, F->Ma, G->Pa, A->Dha, B->Ni
    expect(toSargam('C', 'C')).toBe('Sa');
    expect(toSargam('G', 'C')).toBe('Pa');
    expect(toSargam('Gb', 'C')).toBe(null);   // chromatic in C major
    // Minor key uses its own scale; A minor: A->Sa
    expect(toSargam('A', 'Am')).toBe('Sa');
  });
});

describe('contour packing', () => {
  test('round-trips intervals through a compact string', () => {
    const intervals = [7, -1, -1, 0, 12, -12];
    const packed = packContour(intervals);
    expect(typeof packed).toBe('string');
    expect(unpackContour(packed)).toEqual(intervals);
  });

  test('empty intervals -> empty string -> empty array', () => {
    expect(packContour([])).toBe('');
    expect(unpackContour('')).toEqual([]);
  });
});

describe('encodeNoteText', () => {
  const txt = 'G4# D5# D5 C5#\nB4 C5# B4 A4# G4#';

  test('builds one voice with pitch/interval/sargam; rhythm+lyric+chord null', () => {
    const doc = encodeNoteText(txt, { id: 'jethalal_bgm', title: 'Jethalal BGM', system: 'western', key: 'G#m' });
    expect(doc.meta.format).toBe('note-text');
    expect(doc.meta.id).toBe('jethalal_bgm');
    expect(doc.voices).toHaveLength(1);
    const v = doc.voices[0];
    expect(v.pitch).toEqual([68, 75, 74, 73, 71, 73, 71, 70, 68]);
    expect(v.interval).toEqual([7, -1, -1, -2, 2, -2, -1, -2]);
    expect(v.duration.every(d => d === null)).toBe(true);
    expect(v.lyric.every(l => l === null)).toBe(true);
    expect(v.chordSymbol.every(c => c === null)).toBe(true);
    expect(v.sargam).toHaveLength(v.pitch.length);
    expect(v.measureIndex).toHaveLength(v.pitch.length);
  });
});

// Minimal but valid MusicXML: key=E (4 sharps), 4/4, two measures,
// notes E4 G#4 | B4, plus a <harmony> in measure 1 and a lyric on E4.
const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>4</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef></attributes>
      <harmony><root><root-step>E</root-step></root><kind>major</kind></harmony>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type>
        <lyric number="1"><syllabic>single</syllabic><text>la</text></lyric></note>
      <note><pitch><step>G</step><alter>1</alter><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;

describe('encodeMusicXml', () => {
  test('populates all channels with correct measureIndex', () => {
    const doc = encodeMusicXml(SAMPLE_XML, { id: 'sample', title: 'Sample', system: 'western' });
    expect(doc.meta.format).toBe('musicxml');
    expect(doc.meta.key).toBe('E');                 // <fifths>4</fifths> -> E major
    expect(doc.meta.time).toBe('4/4');
    expect(doc.voices).toHaveLength(1);
    const v = doc.voices[0];
    expect(v.pitch).toEqual([64, 68, 71]);          // E4, G#4, B4
    expect(v.interval).toEqual([4, 3]);
    expect(v.duration).toEqual(['half', 'half', 'whole']);
    expect(v.measureIndex).toEqual([1, 1, 2]);
    expect(v.lyric[0]).toBe('la');
    expect(v.sargam[0]).toBe('Sa');                 // E is tonic of E major
    expect(v.chordSymbol[0]).toBe('E');             // from <harmony> in measure 1
    expect(v.chordSymbol[2]).toBe(null);
  });
});

describe('inferChords (pure, per-measure)', () => {
  test('fills null chordSymbol with the best per-measure triad', () => {
    // For note-text, each line is one measure.
    const doc = encodeNoteText('C4 E4 G4\nA4 C5 E5', { id: 't', key: 'C' });
    const out = inferChords(doc);
    expect(out.voices[0].chordSymbol).toEqual(['C', 'C', 'C', 'Am', 'Am', 'Am']);
  });

  test('returns null for a measure with no clear triad', () => {
    const doc = encodeNoteText('C4 D4', { id: 't', key: 'C' });
    expect(inferChords(doc).voices[0].chordSymbol).toEqual([null, null]);
  });

  test('does not overwrite an existing (harmony) chordSymbol', () => {
    const doc = encodeNoteText('C4 E4 G4', { id: 't', key: 'C' });
    doc.voices[0].chordSymbol[0] = 'Csus4';           // pretend a <harmony> tag set this
    const out = inferChords(doc);
    expect(out.voices[0].chordSymbol[0]).toBe('Csus4'); // preserved
    expect(out.voices[0].chordSymbol[1]).toBe('C');     // null slots filled with the measure chord
  });
});
