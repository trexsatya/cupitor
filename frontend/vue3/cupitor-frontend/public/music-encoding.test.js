// public/music-encoding.test.js
import { nameToMidi, intervalsOf, toSargam, packContour, unpackContour, encodeNoteText, encodeMusicXml, inferChords, computeOnsets, canonicalChordSpans } from './music-encoding.js';
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

describe('computeOnsets (per-measure note onsets, divisions)', () => {
  const N = (duration, chord = false) => ({ type: 'note', duration, chord });
  const B = (duration) => ({ type: 'backup', duration });
  const F = (duration) => ({ type: 'forward', duration });

  test('sequential notes advance the cursor by their duration', () => {
    expect(computeOnsets([N(1), N(1), N(2)])).toEqual([0, 1, 2]);
  });

  test('<chord/> notes share the onset of the preceding note (a vertical stack)', () => {
    // A whole-note triad then the next beat: three stacked notes at 0, next at 4.
    expect(computeOnsets([N(4), N(4, true), N(4, true), N(4)])).toEqual([0, 0, 0, 4]);
  });

  test('<backup> rewinds the cursor so a second voice aligns to the same beats', () => {
    // voice1 half+half, backup a whole, voice2 half+half → onsets [0,2, 0,2].
    expect(computeOnsets([N(2), N(2), B(4), N(2), N(2)])).toEqual([0, 2, 0, 2]);
  });

  test('<forward> advances the cursor (a rest gap)', () => {
    expect(computeOnsets([N(2), F(2), N(2)])).toEqual([0, 4]);
  });

  test('a leading chord note (malformed) onsets at the current cursor', () => {
    expect(computeOnsets([N(2, true), N(2)])).toEqual([0, 2]);
  });
});

describe('encodeMusicXml carries spelled name + onset per note', () => {
  const STACK = `<?xml version="1.0"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>G</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
      <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
      <note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>2</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;

  test('a <chord/> stack shares one onset; the next measure restarts at 0', () => {
    const doc = encodeMusicXml(STACK, { id: 't', system: 'western' });
    const v = doc.voices[0];
    expect(v.pitch).toEqual([60, 64, 67, 62, 65]);
    expect(v.name).toEqual(['C', 'E', 'G', 'D', 'F']);   // spelled names, not midi→sharp
    expect(v.onset).toEqual([0, 0, 0, 0, 2]);            // triad stacked at 0; m2: D@0, F@2
  });
});

describe('canonicalChordSpans (single measure-ordered sequence across all voices)', () => {
  test('a multi-voice piece collapses to ONE monotonic progression, not one copy per voice', () => {
    // Two voices carrying the SAME per-measure progression (as inferChords produces).
    const voices = [
      { chordSymbol: ['Am', 'C', 'Am'], measureIndex: [1, 2, 3] },
      { chordSymbol: ['Am', 'C', 'Am'], measureIndex: [1, 2, 3] },
    ];
    expect(canonicalChordSpans(voices)).toEqual([
      { symbol: 'Am', measureStart: 1, measureEnd: 1 },
      { symbol: 'C', measureStart: 2, measureEnd: 2 },
      { symbol: 'Am', measureStart: 3, measureEnd: 3 },
    ]);
  });

  test('spans are strictly measure-ordered — no voice-boundary seam jumping back', () => {
    // voice 0 covers measures 1..3, voice 1 repeats 1..3. A concatenation would place a
    // measure-3 span immediately before a measure-1 span (the seam that blows up segment
    // resolution). The canonical sequence must never regress in measureStart.
    const voices = [
      { chordSymbol: ['Am', 'C', 'G'], measureIndex: [1, 2, 3] },
      { chordSymbol: ['Am', 'C', 'G'], measureIndex: [1, 2, 3] },
    ];
    const spans = canonicalChordSpans(voices);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].measureStart).toBeGreaterThanOrEqual(spans[i - 1].measureStart);
    }
  });

  test('aggregates across voices by measure: a chord only present in a later voice is kept', () => {
    // voice 0 rests (null) in measure 2; voice 1 supplies that measure's chord.
    const voices = [
      { chordSymbol: ['Am', null], measureIndex: [1, 2] },
      { chordSymbol: [null, 'G'], measureIndex: [1, 2] },
    ];
    expect(canonicalChordSpans(voices)).toEqual([
      { symbol: 'Am', measureStart: 1, measureEnd: 1 },
      { symbol: 'G', measureStart: 2, measureEnd: 2 },
    ]);
  });

  test('an earlier voice wins the measure (real harmony tag over another voice)', () => {
    const voices = [
      { chordSymbol: ['Am'], measureIndex: [1] },
      { chordSymbol: ['E7'], measureIndex: [1] },
    ];
    expect(canonicalChordSpans(voices).map(s => s.symbol)).toEqual(['Am']);
  });

  test('empty / missing input yields an empty list', () => {
    expect(canonicalChordSpans([])).toEqual([]);
    expect(canonicalChordSpans(undefined)).toEqual([]);
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

  test('names a stacked chord by its bass — sheet-consistent (C-rooted, not A-rooted, for C-E-G-A over a C bass)', () => {
    // Same four pitch classes {C,E,G,A} spell C6 (bass C) or Am7 (bass A). The old coverage-scorer
    // ties and picks Am7 alphabetically; the sheet's engine roots it on the C bass. Search must agree.
    const xml = `<?xml version="1.0"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>G</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
      <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
      <note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
      <note><chord/><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;
    const out = inferChords(encodeMusicXml(xml, { id: 't', system: 'western' }));
    expect(out.voices[0].chordSymbol[0]).toMatch(/^C/);      // rooted on the bass C (e.g. C6)
    expect(out.voices[0].chordSymbol[0]).not.toBe('Am7');
  });
});

// --- Phase 0: tempo parsing (needs jQuery global for the MusicXML parse) ---
describe('encodeMusicXml tempo parsing', () => {
  beforeAll(() => { global.$ = global.jQuery = require('jquery'); });

  const xmlWith = (soundEl) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      ${soundEl}
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;

  test('reads <sound tempo> into meta.tempo as a number', () => {
    const { encodeMusicXml } = require('./music-encoding.js');
    const doc = encodeMusicXml(xmlWith('<direction><sound tempo="120"/></direction>'));
    expect(doc.meta.tempo).toBe(120);
  });

  test('parses fractional tempo', () => {
    const { encodeMusicXml } = require('./music-encoding.js');
    const doc = encodeMusicXml(xmlWith('<direction><sound tempo="42.5"/></direction>'));
    expect(doc.meta.tempo).toBe(42.5);
  });

  test('meta.tempo is null when no <sound tempo> present', () => {
    const { encodeMusicXml } = require('./music-encoding.js');
    const doc = encodeMusicXml(xmlWith(''));
    expect(doc.meta.tempo).toBeNull();
  });
});

describe('robustness: unknown/edge keys', () => {
  test('toSargam returns null (does not throw) for an unknown key', () => {
    expect(toSargam('C', 'Zz')).toBe(null);
    expect(toSargam('C', '')).toBe(null);
  });

  test('encodeMusicXml handles a 7-flat key signature without throwing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><key><fifths>-7</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef></attributes>
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;
    let doc;
    expect(() => { doc = encodeMusicXml(xml, { id: 'flat7', system: 'western' }); }).not.toThrow();
    expect(doc.voices[0].pitch).toEqual([71]); // B4
    // key must resolve to a scale that actually exists in majorScales
    expect(['B', 'Cb']).toContain(doc.meta.key);
  });
});
