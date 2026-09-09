// public/music-key.test.js
import { parseKeyName, fifthsOfKey, keyNameOf, keyCandidatesFromFifths, cadenceScore,
  measureSummaries, detectKey } from './music-key.js';

// midi, measure, onset(beats) — a chord = several notes on one onset.
const n = (midi, measure, onset) => ({ midi, measure, onset, durBeats: 1 });
const chord = (midis, measure, onset) => midis.map((m) => n(m, measure, onset));

describe('key names', () => {
  test('parseKeyName reads every shape the app writes', () => {
    expect(parseKeyName('Am')).toEqual({ tonicPc: 9, mode: 'minor' });
    expect(parseKeyName('A minor')).toEqual({ tonicPc: 9, mode: 'minor' });
    expect(parseKeyName('Amin')).toEqual({ tonicPc: 9, mode: 'minor' });
    expect(parseKeyName('C')).toEqual({ tonicPc: 0, mode: 'major' });
    expect(parseKeyName('Cmaj')).toEqual({ tonicPc: 0, mode: 'major' });
    expect(parseKeyName('Bb')).toEqual({ tonicPc: 10, mode: 'major' });
    expect(parseKeyName('F#m')).toEqual({ tonicPc: 6, mode: 'minor' });
    expect(parseKeyName('')).toBe(null);
    expect(parseKeyName('nonsense')).toBe(null);
  });
  test('a key is spelled by its own signature (Eb minor, not D# minor)', () => {
    expect(keyNameOf(3, 'minor')).toBe('Ebm');
    expect(fifthsOfKey(3, 'minor')).toBe(-6);
    expect(keyNameOf(9, 'minor')).toBe('Am');
    expect(fifthsOfKey(0, 'major')).toBe(0);
  });
  test('a signature means two keys — its major and its relative minor', () => {
    expect(keyCandidatesFromFifths(0).map((c) => c.label)).toEqual(['C major', 'A minor']);
    expect(keyCandidatesFromFifths(-3).map((c) => c.label)).toEqual(['Eb major', 'C minor']);
  });
});

describe('measureSummaries', () => {
  test('reads each measure\'s downbeat bass and its closing column', () => {
    const notes = [...chord([57, 60, 64], 1, 0), ...chord([59, 62, 67], 1, 2)];
    const [m1] = measureSummaries(notes);
    expect(m1.firstBassPc).toBe(9);    // A of the opening A-C-E
    expect(m1.lastBassPc).toBe(11);    // B of the closing B-D-G stack
    expect(m1.lastTopPc).toBe(7);      // G on top of it
  });
});

// The mode question the key signature cannot answer: 0 sharps is C major AND A minor.
describe('detectKey decides the mode from the cadences', () => {
  // i – V – i in A minor: lands on A, and the dominant carries the raised 7th G#.
  const aMinor = [...chord([57, 60, 64], 1, 0), ...chord([64, 68, 71], 2, 0), ...chord([57, 60, 64], 3, 0)];
  // I – V – I in C major, same (empty) signature.
  const cMajor = [...chord([60, 64, 67], 1, 0), ...chord([67, 71, 74], 2, 0), ...chord([60, 64, 67], 3, 0)];

  test('a piece that cadences on A with a G# leading tone is A minor, not C major', () => {
    const d = detectKey(aMinor, { fifths: 0 });
    expect(d.key).toBe('Am');
    expect(d.mode).toBe('minor');
    expect(d.source).toBe('cadence');
    expect(d.confidence).toBe('high');
    expect(d.reasons.join(' ')).toMatch(/raised 7th G#/);
  });
  test('the same signature reads C major when the music cadences on C', () => {
    const d = detectKey(cMajor, { fifths: 0 });
    expect(d.key).toBe('C');
    expect(d.mode).toBe('major');
    expect(d.signatureFits).toBe(true);
  });
  test('an arpeggiated ending is read as its harmony, not as its last note', () => {
    // E minor, 1♯. Every measure is a single line: i (E-G-B), V (B-D#-F#), i (E-G-B) — so the piece's
    // last NOTE is B while its closing harmony is E minor. Reading the last note called this B minor.
    const notes = [n(52, 1, 0), n(55, 1, 1), n(59, 1, 2), n(47, 2, 0), n(51, 2, 1), n(54, 2, 2),
      n(52, 3, 0), n(55, 3, 1), n(59, 3, 2)];
    const d = detectKey(notes, { fifths: 1 });
    expect(d.key).toBe('Em');
    expect(d.reasons.join(' ')).toMatch(/closing harmony sits on E/);
  });
  test('cadenceScore prefers the tonic the music actually lands on', () => {
    expect(cadenceScore(measureSummaries(aMinor), 9, 'minor').score)
      .toBeGreaterThan(cadenceScore(measureSummaries(aMinor), 0, 'major').score);
  });
});

describe('detectKey treats a missing signature as a guess, not a fact', () => {
  // G major written with no signature at all (every F# spelled inline) — I–V–I in G.
  const gMajorNoSig = [...chord([55, 59, 62], 1, 0), ...chord([62, 66, 69], 2, 0), ...chord([55, 59, 62], 3, 0)];

  test('no signature → C major / A minor is only the starting assumption', () => {
    const d = detectKey(gMajorNoSig, { fifths: null });
    expect(d.hasSignature).toBe(false);
    expect(d.reasons[0]).toMatch(/no key signature written/);
    expect(d.ambiguous).toBe(true);
  });
  test('…and a pitch content that clearly fits another signature wins', () => {
    const d = detectKey(gMajorNoSig, { fifths: null });
    expect(d.key).toBe('G');                 // cadences on G, with F#s — not C major
    expect(d.signatureFits).toBe(false);
    expect(d.reasons.join(' ')).toMatch(/written signature looks incomplete/);
    expect(d.confidence).not.toBe('high');   // an inferred signature is never asserted confidently
  });
  test('a bare 0-fifths signature is just as weak (it may only mean "not written")', () => {
    const d = detectKey(gMajorNoSig, { fifths: 0 });
    expect(d.key).toBe('G');
    expect(d.signatureFits).toBe(false);
  });
});

describe('detectKey never silently rewrites a real signature', () => {
  test('a written 3-flat signature contradicted by the notes is kept, and reported', () => {
    const gMajorContent = [...chord([55, 59, 62], 1, 0), ...chord([62, 66, 69], 2, 0), ...chord([55, 59, 62], 3, 0)];
    const d = detectKey(gMajorContent, { fifths: -3 });
    expect(['Eb', 'Cm']).toContain(d.key);         // still the notated signature's pair
    expect(d.signatureFits).toBe(false);
    expect(d.reasons.join(' ')).toMatch(/disagrees with the notes/);
    expect(d.ambiguous).toBe(true);
  });
});

describe('detectKey on nothing', () => {
  test('no notes → a low-confidence C, no throw', () => {
    const d = detectKey([], { fifths: null });
    expect(d.confidence).toBe('low');
    expect(d.key).toBe('C');
  });
});
