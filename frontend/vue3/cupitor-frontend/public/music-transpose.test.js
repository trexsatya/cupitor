import { transposeMusicXml, nearestSemitones, KEY_PC } from './music-transpose.js';

// Independent MIDI reader (sharps only) so the assertions don't depend on the module under test.
const STEP_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midiOf(noteEl) {
  const p = noteEl.querySelector('pitch');
  const step = p.querySelector('step').textContent.trim();
  const oct = parseInt(p.querySelector('octave').textContent, 10);
  const alt = p.querySelector('alter') ? parseInt(p.querySelector('alter').textContent, 10) : 0;
  return 12 * (oct + 1) + STEP_PC[step] + alt;
}
const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml');
const pitched = (doc) => Array.from(doc.querySelectorAll('note')).filter((n) => n.querySelector('pitch'));

const XML = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
  <attributes><divisions>2</divisions><key><fifths>0</fifths></key></attributes>
  <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>
  <note><rest/><duration>2</duration></note>
  <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration></note>
  <note><pitch><step>B</step><octave>4</octave></pitch><duration>2</duration></note>
</measure></part></score-partwise>`;

describe('nearestSemitones', () => {
  test('shifts to the nearest direction, range [-5, 6]', () => {
    expect(nearestSemitones(0, 2)).toBe(2);    // C→D up 2
    expect(nearestSemitones(0, 11)).toBe(-1);  // C→B down 1 (not +11)
    expect(nearestSemitones(0, 9)).toBe(-3);   // C→A down 3
    expect(nearestSemitones(0, 6)).toBe(6);    // C→F# up 6 (boundary)
    expect(nearestSemitones(0, 7)).toBe(-5);   // C→G down 5 (7 wraps to -5)
    expect(nearestSemitones(4, 4)).toBe(0);    // same key
  });
});

describe('transposeMusicXml', () => {
  test('semitones = 0 returns the input unchanged', () => {
    expect(transposeMusicXml(XML, 0, 0)).toBe(XML);
  });

  test('transposes every pitch up by the interval (C→D, +2), respelling correctly', () => {
    const out = transposeMusicXml(XML, 2, KEY_PC.D);   // to D major
    const notes = pitched(parse(out));
    expect(midiOf(notes[0])).toBe(62);   // C4(60) → D4
    expect(midiOf(notes[1])).toBe(66);   // E4(64) → F#4
    expect(midiOf(notes[2])).toBe(73);   // B4(71) → C#5
    // E4→F# is spelled F# (step F, alter 1), not Gb, in a sharp target key
    const p1 = notes[1].querySelector('pitch');
    expect(p1.querySelector('step').textContent).toBe('F');
    expect(p1.querySelector('alter').textContent).toBe('1');
    expect(p1.querySelector('octave').textContent).toBe('4');
  });

  test('transposes down across an octave boundary (C4 → B3)', () => {
    const out = transposeMusicXml(XML, -1, KEY_PC.B);
    const notes = pitched(parse(out));
    expect(midiOf(notes[0])).toBe(59);   // C4(60) → B3
    expect(notes[0].querySelector('pitch').querySelector('octave').textContent).toBe('3');
    expect(notes[0].querySelector('pitch').querySelector('step').textContent).toBe('B');
  });

  test('uses flat spellings for a flat target key (C→Eb, +3 → Eb, not D#)', () => {
    const out = transposeMusicXml(XML, 3, KEY_PC.Eb);
    const p0 = pitched(parse(out))[0].querySelector('pitch');   // C4 → Eb4
    expect(p0.querySelector('step').textContent).toBe('E');
    expect(p0.querySelector('alter').textContent).toBe('-1');
  });

  test('removes a now-stale <alter> when the transposed note is natural', () => {
    // C#4 up 1 = D4 (natural) — the <alter> must be dropped, not left as +1.
    const xml = XML.replace('<step>C</step><octave>4</octave>', '<step>C</step><alter>1</alter><octave>4</octave>');
    const out = transposeMusicXml(xml, 1, KEY_PC.D);
    const p0 = pitched(parse(out))[0].querySelector('pitch');   // C#4 → D4
    expect(p0.querySelector('step').textContent).toBe('D');
    expect(p0.querySelector('alter')).toBeNull();
  });

  test('updates the key signature <fifths> to the target key', () => {
    expect(parse(transposeMusicXml(XML, 2, KEY_PC.D)).querySelector('fifths').textContent).toBe('2');
    expect(parse(transposeMusicXml(XML, 3, KEY_PC.Eb)).querySelector('fifths').textContent).toBe('-3');
  });

  test('a minor target writes the relative-major key signature (mode-aware)', () => {
    // A minor shares C major's signature (0 fifths), not A major's (+3).
    expect(parse(transposeMusicXml(XML, -3, 9, 'minor')).querySelector('fifths').textContent).toBe('0');
    // E minor shares G major's signature (+1 sharp), not E major's (+4).
    expect(parse(transposeMusicXml(XML, 4, 4, 'minor')).querySelector('fifths').textContent).toBe('1');
    // Major is still the default when no mode is passed.
    expect(parse(transposeMusicXml(XML, -3, 9)).querySelector('fifths').textContent).toBe('3');
  });

  test('sets an existing <mode> element to the target mode', () => {
    const xml = XML.replace('<fifths>0</fifths>', '<fifths>0</fifths><mode>major</mode>');
    expect(parse(transposeMusicXml(xml, -3, 9, 'minor')).querySelector('mode').textContent).toBe('minor');
    expect(parse(transposeMusicXml(xml, 2, KEY_PC.D)).querySelector('mode').textContent).toBe('major');
  });

  test('leaves rests and durations untouched', () => {
    const out = parse(transposeMusicXml(XML, 2, KEY_PC.D));
    const all = Array.from(out.querySelectorAll('note'));
    expect(all.some((n) => n.querySelector('rest'))).toBe(true);        // rest still there
    all.forEach((n) => expect(n.querySelector('duration').textContent).toBe('2'));  // durations intact
  });

  test('drops stale visual <accidental> elements (OSMD re-derives them)', () => {
    const xml = XML.replace('<step>E</step>', '<step>E</step>').replace(
      '<note><pitch><step>E</step>', '<note><pitch><step>E</step>').replace(
      '<pitch><step>E</step><octave>4</octave></pitch><duration>2</duration>',
      '<pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><accidental>natural</accidental>');
    const out = transposeMusicXml(xml, 2, KEY_PC.D);
    expect(parse(out).querySelector('accidental')).toBeNull();
  });

  test('round-trip: +5 then -5 restores every MIDI pitch', () => {
    const up = transposeMusicXml(XML, 5, KEY_PC.F);
    const back = transposeMusicXml(up, -5, KEY_PC.C);
    const a = pitched(parse(XML)).map(midiOf);
    const b = pitched(parse(back)).map(midiOf);
    expect(b).toEqual(a);
  });
});
