import { listParts, mergeParts, explodeStaves, shiftOctaves } from './music-merge.js';
import { STEP_PC } from './music-transpose.js';

// ── MusicXML fixture helpers ──────────────────────────────────────────────────────────────────
const note = (step, oct, dur, { alter = null, chord = false, voice = 1, staff = null, rest = false } = {}) =>
  `<note>${chord ? '<chord/>' : ''}${rest ? '<rest/>' : `<pitch><step>${step}</step>${alter != null ? `<alter>${alter}</alter>` : ''}<octave>${oct}</octave></pitch>`}<duration>${dur}</duration><voice>${voice}</voice>${staff != null ? `<staff>${staff}</staff>` : ''}</note>`;
const unpitchedNote = (dur) => `<note><unpitched><display-step>E</display-step><display-octave>4</display-octave></unpitched><duration>${dur}</duration><voice>1</voice></note>`;

const attrs = ({ div = 1, fifths = 0, beats = 4, clef = 'G2', transpose = null } = {}) =>
  `<attributes><divisions>${div}</divisions><key><fifths>${fifths}</fifths></key><time><beats>${beats}</beats><beat-type>4</beat-type></time>` +
  `<clef><sign>${clef[0]}</sign><line>${clef[1]}</line></clef>` +
  (transpose ? `<transpose><chromatic>${transpose.chromatic || 0}</chromatic>${transpose.octave ? `<octave-change>${transpose.octave}</octave-change>` : ''}</transpose>` : '') +
  `</attributes>`;

// A one-measure part. `body` follows the attributes; `measures` overrides for multi-measure parts.
const part = (id, a, body) => `<part id="${id}"><measure number="1">${attrs(a)}${body}</measure></part>`;
const scorePart = (id, name) => `<score-part id="${id}"><part-name>${name}</part-name></score-part>`;
const score = (list, parts) =>
  `<?xml version="1.0"?><score-partwise version="3.1"><part-list>${list.join('')}</part-list>${parts.join('')}</score-partwise>`;

const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml');
const num = (el) => parseInt(el.textContent, 10);
const midiOf = (p) => 12 * (num(p.querySelector('octave')) + 1) + STEP_PC[p.querySelector('step').textContent.trim()] +
  (p.querySelector('alter') ? num(p.querySelector('alter')) : 0);

describe('listParts', () => {
  test('lists parts with names and flags unpitched (drum) parts', () => {
    const xml = score(
      [scorePart('P1', 'Trumpet'), scorePart('P2', 'Drums')],
      [part('P1', {}, note('C', 4, 4)), part('P2', {}, unpitchedNote(4))],
    );
    const parts = listParts(xml);
    expect(parts).toEqual([
      { id: 'P1', name: 'Trumpet', unpitched: false },
      { id: 'P2', name: 'Drums', unpitched: true },
    ]);
  });
});

describe('mergeParts', () => {
  test('merges two single-voice parts into one part with two distinct voices + a backup', () => {
    const xml = score(
      [scorePart('P1', 'A'), scorePart('P2', 'B')],
      [part('P1', {}, note('C', 4, 4)), part('P2', {}, note('G', 3, 4))],
    );
    const doc = parse(mergeParts(xml, ['P1', 'P2']));
    expect(doc.querySelectorAll('part').length).toBe(1);
    expect(doc.querySelectorAll('score-part').length).toBe(1);
    const voices = [...doc.querySelectorAll('note voice')].map((v) => v.textContent);
    expect(new Set(voices).size).toBe(2);                       // two independent voices
    const backups = [...doc.querySelectorAll('backup duration')].map(num);
    expect(backups).toContain(4);                               // rewind a full measure between parts
    const steps = [...doc.querySelectorAll('note pitch step')].map((s) => s.textContent).sort();
    expect(steps).toEqual(['C', 'G']);                          // both parts' notes present
  });

  test('unifies divisions to the LCM and rescales durations', () => {
    const xml = score(
      [scorePart('P1', 'A'), scorePart('P2', 'B')],
      [part('P1', { div: 2 }, note('C', 4, 8)), part('P2', { div: 3 }, note('G', 3, 12))],
    );
    const doc = parse(mergeParts(xml, ['P1', 'P2']));
    expect(num(doc.querySelector('divisions'))).toBe(6);        // LCM(2,3)
    const durs = [...doc.querySelectorAll('note duration')].map(num).sort((a, b) => a - b);
    expect(durs).toEqual([24, 24]);                            // both whole notes → 6*4 divisions
  });

  test('converts each part to concert pitch (applies its <transpose>) and drops the transpose element', () => {
    const xml = score(
      [scorePart('P1', 'Bb Tpt'), scorePart('P2', 'B')],
      [part('P1', { transpose: { chromatic: -2 } }, note('D', 4, 4)), part('P2', {}, note('C', 4, 4))],
    );
    const out = mergeParts(xml, ['P1', 'P2']);
    const doc = parse(out);
    expect(doc.querySelectorAll('transpose').length).toBe(0);   // no transpose survives on a concert staff
    // The trumpet's written D4 sounds C4 (down 2 semitones).
    const pitches = [...doc.querySelectorAll('note pitch')].map((p) => ({
      step: p.querySelector('step').textContent, oct: num(p.querySelector('octave')),
    }));
    expect(pitches).toContainEqual({ step: 'C', oct: 4 });
  });

  test('auto-picks a bass clef when the merged notes sit low', () => {
    const xml = score(
      [scorePart('P1', 'A'), scorePart('P2', 'B')],
      [part('P1', { clef: 'F4' }, note('G', 2, 4)), part('P2', { clef: 'F4' }, note('C', 3, 4))],
    );
    const doc = parse(mergeParts(xml, ['P1', 'P2']));
    const clef = doc.querySelector('clef');
    expect(clef.querySelector('sign').textContent).toBe('F');
    expect(num(clef.querySelector('line'))).toBe(4);
  });

  test('leaves unselected parts untouched', () => {
    const xml = score(
      [scorePart('P1', 'A'), scorePart('P2', 'B'), scorePart('P3', 'C')],
      [part('P1', {}, note('C', 4, 4)), part('P2', {}, note('E', 4, 4)), part('P3', {}, note('G', 4, 4))],
    );
    const doc = parse(mergeParts(xml, ['P1', 'P2']));
    expect(doc.querySelectorAll('part').length).toBe(2);        // merged + P3
    const p3 = [...doc.querySelectorAll('part')].find((p) => p.getAttribute('id') === 'P3');
    expect(p3).toBeTruthy();
    expect(p3.querySelector('note pitch step').textContent).toBe('G');
  });

  test('fitRange shifts each part by whole octaves into the guitar range, preserving contour', () => {
    const xml = score(
      [scorePart('P1', 'Bass'), scorePart('P2', 'B')],
      [part('P1', {}, note('C', 2, 2) + note('C', 3, 2)), part('P2', {}, note('C', 4, 4))],
    );
    const doc = parse(mergeParts(xml, ['P1', 'P2'], { fitRange: { lo: 40, hi: 76 } }));
    const midis = [...doc.querySelectorAll('note pitch')].map(midiOf).sort((a, b) => a - b);
    // P1 (C2=36, C3=48) is too low → shifted up one octave to 48, 60 (octave interval preserved);
    // P2 (C4=60) already sits in range → unchanged.
    expect(midis).toEqual([48, 60, 60]);
    // Guitar reads a treble clef sounding an octave down (treble-8), so the E2–E5 range sits ON the
    // staff instead of dangling below a plain treble clef (whose bottom line is E4).
    const clef = doc.querySelector('clef');
    expect(clef.querySelector('sign').textContent).toBe('G');
    expect(num(clef.querySelector('line'))).toBe(2);
    expect(num(clef.querySelector('clef-octave-change'))).toBe(-1);
  });

  test('a non-fit merge uses a plain clef with no octave change', () => {
    const xml = score(
      [scorePart('P1', 'A'), scorePart('P2', 'B')],
      [part('P1', {}, note('C', 4, 4)), part('P2', {}, note('E', 4, 4))],
    );
    const doc = parse(mergeParts(xml, ['P1', 'P2']));
    expect(doc.querySelectorAll('clef-octave-change').length).toBe(0);
  });

  test('fitRange composes with a part transpose (concert pitch first, then octave-fit)', () => {
    // Bb trumpet written G6 sounds F6 (74+... ) — high; fit drops it an octave into range.
    const xml = score(
      [scorePart('P1', 'Tpt'), scorePart('P2', 'B')],
      [part('P1', { transpose: { chromatic: -2 } }, note('G', 6, 4)), part('P2', {}, note('C', 4, 4))],
    );
    const doc = parse(mergeParts(xml, ['P1', 'P2'], { fitRange: { lo: 40, hi: 76 } }));
    const midis = [...doc.querySelectorAll('note pitch')].map(midiOf);
    // Written G6=91 → concert F6=89 → still above 76 → −1 octave → F5=77? (still >76) → −2 → F4=65.
    expect(midis).toContain(65);   // trumpet folded down to F4
    expect(midis).toContain(60);   // C4 unchanged
  });

  test('fewer than two valid parts → returns the input unchanged', () => {
    const xml = score([scorePart('P1', 'A')], [part('P1', {}, note('C', 4, 4))]);
    expect(mergeParts(xml, ['P1'])).toBe(xml);
    expect(mergeParts(xml, [])).toBe(xml);
  });
});

describe('shiftOctaves', () => {
  test('moves every note up by whole octaves, preserving pitch classes and intervals', () => {
    const xml = score([scorePart('P1', 'A')], [part('P1', {}, note('C', 3, 2) + note('E', 4, 2))]);
    const doc = parse(shiftOctaves(xml, 1));
    const midis = [...doc.querySelectorAll('note pitch')].map(midiOf).sort((a, b) => a - b);
    expect(midis).toEqual([60, 76]);                            // C3→C4, E4→E5 (+12 each)
    expect([...doc.querySelectorAll('note pitch step')].map((s) => s.textContent)).toEqual(['C', 'E']);
  });

  test('moves every note down for a negative shift', () => {
    const xml = score([scorePart('P1', 'A')], [part('P1', {}, note('C', 4, 4))]);
    const doc = parse(shiftOctaves(xml, -1));
    expect([...doc.querySelectorAll('note pitch')].map(midiOf)).toEqual([48]);   // C4→C3
  });

  test('a zero shift returns the input unchanged', () => {
    const xml = score([scorePart('P1', 'A')], [part('P1', {}, note('C', 4, 4))]);
    expect(shiftOctaves(xml, 0)).toBe(xml);
  });
});

describe('explodeStaves', () => {
  // A one-measure grand-staff piano part: RH (staff 1, treble) then a full-measure <backup>, then LH
  // (staff 2, bass) — the standard MusicXML layout for a single multi-staff part.
  const grandStaffAttrs =
    `<attributes><divisions>1</divisions><key><fifths>0</fifths></key>` +
    `<time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves>` +
    `<clef number="1"><sign>G</sign><line>2</line></clef>` +
    `<clef number="2"><sign>F</sign><line>4</line></clef></attributes>`;
  const pianoScore = (body) => score(
    [scorePart('P1', 'Piano')],
    [`<part id="P1"><measure number="1">${grandStaffAttrs}${body}</measure></part>`],
  );
  // RH: C5 then D5 (two quarters); backup a full measure; LH: C3 whole note.
  const twoHandBody =
    note('C', 5, 1, { voice: 1, staff: 1 }) + note('D', 5, 1, { voice: 1, staff: 1 }) +
    `<backup><duration>2</duration></backup>` +
    note('C', 3, 2, { voice: 2, staff: 2 });

  test('splits a single multi-staff part into one single-staff part per staff', () => {
    const parts = listParts(explodeStaves(pianoScore(twoHandBody)));
    expect(parts.length).toBe(2);
    expect(parts.every((p) => !p.unpitched)).toBe(true);
    expect(parts.map((p) => p.name)).toEqual(['Piano — Right hand', 'Piano — Left hand']);
  });

  test('each exploded part is single-staff (no <staves>, no <staff> tags) with that staff’s clef', () => {
    const doc = parse(explodeStaves(pianoScore(twoHandBody)));
    expect(doc.querySelectorAll('staves').length).toBe(0);      // collapsed to one staff each
    expect(doc.querySelectorAll('note staff').length).toBe(0);  // staff tags dropped
    const clefs = [...doc.querySelectorAll('part')].map((p) => p.querySelector('clef sign').textContent);
    expect(clefs).toEqual(['G', 'F']);                          // RH keeps treble, LH keeps bass
  });

  test('each staff keeps its own notes at the right onset (backup/cross-staff structure resolved)', () => {
    const doc = parse(explodeStaves(pianoScore(twoHandBody)));
    const parts = [...doc.querySelectorAll('part')];
    const rhSteps = [...parts[0].querySelectorAll('note pitch step')].map((s) => s.textContent);
    const lhSteps = [...parts[1].querySelectorAll('note pitch step')].map((s) => s.textContent);
    expect(rhSteps).toEqual(['C', 'D']);                        // RH line
    expect(lhSteps).toEqual(['C']);                             // LH bass note
    // LH note starts at the measure beginning (leading RH run + backup resolved away → no stray forward).
    expect(parts[1].querySelectorAll('forward').length).toBe(0);
  });

  test('a plain single-staff part is returned unchanged', () => {
    const xml = score([scorePart('P1', 'Flute')], [part('P1', {}, note('C', 5, 4, { voice: 1 }))]);
    expect(explodeStaves(xml)).toBe(xml);
  });

  test('exploded staves feed straight into mergeParts (guitar-fit) → one combined staff', () => {
    const exploded = explodeStaves(pianoScore(twoHandBody));
    const ids = listParts(exploded).map((p) => p.id);
    const doc = parse(mergeParts(exploded, ids, { fitRange: { lo: 40, hi: 76 } }));
    expect(doc.querySelectorAll('part').length).toBe(1);        // both hands on one staff
    const steps = [...doc.querySelectorAll('note pitch step')].map((s) => s.textContent).sort();
    expect(steps).toEqual(['C', 'C', 'D']);                     // RH C,D + LH C all present
    const midis = [...doc.querySelectorAll('note pitch')].map(midiOf);
    expect(midis.every((m) => m >= 40 && m <= 76)).toBe(true);  // folded into guitar range
  });
});
