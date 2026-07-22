/**
 * @jest-environment jsdom
 */
import { splitMusicXmlPieces, detectPieceBoundaries, defaultTitlePrefix, pieceTitle, countPieces } from './music-split.js';

// Two "pieces" in one part. Piece 1 states a clef; piece 2 does NOT (it inherits it in the source
// file) — the splitter must carry the clef forward so piece 2 renders correctly on its own. Each
// piece re-states its own key/time. Measure numbering resets to 1 at the second piece.
const TWO_PIECES = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Test Book</work-title></work>
  <credit page="1"><credit-words>Test Book — page decoration</credit-words></credit>
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction><direction-type><words font-weight="bold">Allegro moderato.</words></direction-type></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>3</fifths></key>
        <time><beats>3</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><direction-type><words font-weight="bold">Andante</words></direction-type></direction>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>3</duration><type>half</type></note>
    </measure>
    <measure number="2">
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>3</duration><type>half</type></note>
    </measure>
  </part>
</score-partwise>`;

const SINGLE_PIECE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Solo</work-title></work>
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key>
      <time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure>
    <measure number="2"><note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure>
    <measure number="3"><note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure>
  </part>
</score-partwise>`;

const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml');
const text = (node) => (node ? (node.textContent || '').trim() : '');
const clefsIn = (xml) => {
  const first = parse(xml).getElementsByTagName('measure')[0];
  const attrs = first.getElementsByTagName('attributes')[0];
  return attrs ? [...attrs.children].filter((c) => c.nodeName === 'clef') : [];
};
const fifthsIn = (xml) => parse(xml).getElementsByTagName('fifths')[0].textContent;

describe('detectPieceBoundaries', () => {
  test('a measure whose number drops to <= the previous one starts a new piece', () => {
    expect(detectPieceBoundaries([1, 2, 3, 1, 2, 1, 2, 3, 4])).toEqual([0, 3, 5]);
  });

  test('a leading pickup (0 then 1) stays within the same piece', () => {
    // 0,1,2 ... then reset 0,1 → only two pieces, starting at index 0 and 3.
    expect(detectPieceBoundaries([0, 1, 2, 0, 1])).toEqual([0, 3]);
  });

  test('a strictly ascending run is a single piece', () => {
    expect(detectPieceBoundaries([1, 2, 3, 4, 5])).toEqual([0]);
  });

  test('non-numeric numbers are treated as continuations, not boundaries', () => {
    expect(detectPieceBoundaries([1, NaN, 2, 3])).toEqual([0]);
  });
});

describe('countPieces', () => {
  test('counts the pieces packed in a source without building a DOM', () => {
    expect(countPieces(TWO_PIECES)).toBe(2);
    expect(countPieces(SINGLE_PIECE)).toBe(1);
  });
  test('is 0 when there are no measures (e.g. note-text) and agrees with splitMusicXmlPieces', () => {
    expect(countPieces('some plain text, no measures')).toBe(0);
    expect(countPieces(TWO_PIECES)).toBe(splitMusicXmlPieces(TWO_PIECES).pieces.length);
  });
  test('ignores non-measure number="" attributes (endings, clefs, slurs)', () => {
    // A single piece whose measures carry <ending number="1"> and <clef number="1"> must still count as 1.
    const withNoise = SINGLE_PIECE
      .replace('<note>', '<barline><ending number="1" type="start"/></barline><note>');
    expect(countPieces(withNoise)).toBe(1);
  });
});

describe('defaultTitlePrefix', () => {
  test('takes the composer/opus segment after the last separator, dropping extensions', () => {
    expect(defaultTitlePrefix('12_Etudes_-_Ferdinand_Sor_op._6.mscz.xml')).toBe('Ferdinand_Sor_op._6');
    expect(defaultTitlePrefix('12 Etudes - Ferdinand Sor op. 6')).toBe('Ferdinand Sor op. 6');
    expect(defaultTitlePrefix('A — B — C')).toBe('C');
  });
  test('a name with no separator is used whole (extension stripped)', () => {
    expect(defaultTitlePrefix('solo.musicxml')).toBe('solo');
    expect(defaultTitlePrefix('Prelude')).toBe('Prelude');
  });
});

describe('pieceTitle', () => {
  test('formats "{prefix} — No. {n} ({tempo})", omitting empty tempo and defaulting the prefix', () => {
    expect(pieceTitle('Sor Op.6', 3, 'Andante')).toBe('Sor Op.6 — No. 3 (Andante)');
    expect(pieceTitle('Sor Op.6', 2, '')).toBe('Sor Op.6 — No. 2');
    expect(pieceTitle('', 1, 'Allegro')).toBe('Piece — No. 1 (Allegro)');
  });
});

describe('splitMusicXmlPieces', () => {
  test('an explicit prefix overrides the collection work-title in every title', () => {
    const { pieces } = splitMusicXmlPieces(TWO_PIECES, { prefix: 'Ferdinand_Sor_op._6' });
    expect(pieces[0].title).toBe('Ferdinand_Sor_op._6 — No. 1 (Allegro moderato)');
    expect(pieces[1].title).toBe('Ferdinand_Sor_op._6 — No. 2 (Andante)');
  });
  test('splits the collection into one standalone source per piece', () => {
    const { collectionTitle, pieces } = splitMusicXmlPieces(TWO_PIECES);
    expect(collectionTitle).toBe('Test Book');
    expect(pieces).toHaveLength(2);
    expect(pieces.map((p) => p.measureCount)).toEqual([2, 2]);
    expect(pieces[0].measureStart).toBe(1);
    expect(pieces[1].measureStart).toBe(3);
  });

  test('titles are "{collection} — No. {n} ({tempo})", trailing period stripped', () => {
    const { pieces } = splitMusicXmlPieces(TWO_PIECES);
    expect(pieces[0].title).toBe('Test Book — No. 1 (Allegro moderato)');
    expect(pieces[1].title).toBe('Test Book — No. 2 (Andante)');
  });

  test('carries the clef forward into a piece that did not re-state it', () => {
    const { pieces } = splitMusicXmlPieces(TWO_PIECES);
    // Piece 1 already had its clef.
    expect(clefsIn(pieces[0].source)).toHaveLength(1);
    // Piece 2 had none in the source — the splitter must inject the carried G/2 clef.
    const p2clefs = clefsIn(pieces[1].source);
    expect(p2clefs).toHaveLength(1);
    expect(p2clefs[0].getElementsByTagName('sign')[0].textContent).toBe('G');
  });

  test("each piece keeps its own key/time (read from its own first measure)", () => {
    const { pieces } = splitMusicXmlPieces(TWO_PIECES);
    expect(fifthsIn(pieces[0].source)).toBe('0');
    expect(fifthsIn(pieces[1].source)).toBe('3');
  });

  test('no notes bleed between pieces — each source carries only its own measures/notes', () => {
    const { pieces } = splitMusicXmlPieces(TWO_PIECES);
    const stepsOf = (xml) => [...parse(xml).getElementsByTagName('note')]
      .map((n) => text(n.getElementsByTagName('step')[0]));
    expect(stepsOf(pieces[0].source)).toEqual(['C', 'D']);   // piece 1 only
    expect(stepsOf(pieces[1].source)).toEqual(['E', 'F']);   // piece 2 only
  });

  test('drops book-level <credit> page decorations from each piece', () => {
    const { pieces } = splitMusicXmlPieces(TWO_PIECES);
    expect(parse(pieces[0].source).getElementsByTagName('credit')).toHaveLength(0);
  });

  test('a single-piece file returns one piece and does not force a "No. 1" suffix', () => {
    const { pieces } = splitMusicXmlPieces(SINGLE_PIECE, { fallbackTitle: 'solo.xml' });
    expect(pieces).toHaveLength(1);
    expect(pieces[0].title).toBe('Solo');
  });

  test('uses fallbackTitle when the file has no work-title', () => {
    const noTitle = TWO_PIECES.replace('<work><work-title>Test Book</work-title></work>', '');
    const { pieces } = splitMusicXmlPieces(noTitle, { fallbackTitle: 'sor_op6' });
    expect(pieces[0].title).toBe('sor_op6 — No. 1 (Allegro moderato)');
  });
});
