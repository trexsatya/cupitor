import { generateCounterLines } from './music-counterpoint.js';

describe('generateCounterLines', () => {
  const melody = [
    { midi: 67, measure: 1, beat: 0, onsetDivs: 0, durDivs: 2 },   // G4 over C
    { midi: 65, measure: 1, beat: 1, onsetDivs: 2, durDivs: 2 },   // F4 over C
    { midi: 64, measure: 1, beat: 2, onsetDivs: 4, durDivs: 2 },   // E4 over C
  ];
  const chordByMeasure = { 1: 'C' };
  const C_MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);
  const pc = (m) => ((m % 12) + 12) % 12;
  const melAt = (mel, cn) => mel.find((m) => m.measure === cn.measure && m.onsetDivs === cn.onsetDivs);

  test('every counter-note is diatonic, below the melody, and never under the low-E floor', () => {
    const lines = generateCounterLines({ melody, chordByMeasure, key: 'C', register: 'below' });
    expect(lines.length).toBeGreaterThan(0);
    lines.forEach((line) => {
      expect(line.notes.length).toBeGreaterThan(0);
      expect(line.notes.length).toBeLessThanOrEqual(melody.length);
      line.notes.forEach((cn) => {
        const m = melAt(melody, cn);
        expect(m).toBeDefined();
        expect(cn.midi).toBeLessThan(m.midi);           // below register
        expect(cn.midi).toBeGreaterThanOrEqual(40);      // E2 floor (guitar low-E string)
        expect(C_MAJOR.has(pc(cn.midi))).toBe(true);     // diatonic (chord OR passing tone)
      });
    });
  });

  test('carries the melody beat coordinates on each counter-note', () => {
    const lines = generateCounterLines({ melody, chordByMeasure, key: 'C', register: 'below' });
    lines.forEach((line) => line.notes.forEach((cn) => {
      const m = melAt(melody, cn);
      expect(m).toBeDefined();
      expect(cn.durDivs).toBe(m.durDivs);
    }));
  });

  test('uses passing tones — the counter-note is not always a chord tone (3rd/5th)', () => {
    // E4→F4 ascending over C: the best CONTRARY (descending) consonant move from a C-major start is a
    // scale tone (e.g. A), not a chord tone, so at least one sounded note is a non-chord tone.
    const mel = [
      { midi: 64, measure: 1, beat: 0, onsetDivs: 0, durDivs: 2 },   // E4
      { midi: 65, measure: 1, beat: 1, onsetDivs: 2, durDivs: 2 },   // F4
    ];
    const lines = generateCounterLines({ melody: mel, chordByMeasure: { 1: 'C' }, key: 'C', register: 'below' });
    const CHORD_C = new Set([0, 4, 7]);
    const anyPassing = lines.some((line) => line.notes.some((cn) => !CHORD_C.has(pc(cn.midi))));
    expect(anyPassing).toBe(true);
    lines.forEach((line) => line.notes.forEach((cn) => expect(C_MAJOR.has(pc(cn.midi))).toBe(true)));
  });

  test('rests a beat rather than dropping below the low-E — need not cover every melody note', () => {
    const mel = [
      { midi: 55, measure: 1, beat: 0, onsetDivs: 0, durDivs: 2 },   // G3 — chord tones fit below
      { midi: 40, measure: 1, beat: 1, onsetDivs: 2, durDivs: 2 },   // E2 — nothing diatonic fits below the floor
    ];
    const lines = generateCounterLines({ melody: mel, chordByMeasure: { 1: 'C' }, key: 'C', register: 'below' });
    expect(lines.length).toBeGreaterThan(0);
    lines.forEach((line) => {
      expect(line.notes.length).toBeLessThan(mel.length);              // sparser than the melody
      expect(line.notes.some((cn) => cn.onsetDivs === 2)).toBe(false); // the low beat rested
      expect(line.notes.every((cn) => cn.midi >= 40)).toBe(true);
    });
  });

  test('favors contrary motion: across the generated lines, contrary moves outnumber parallel', () => {
    // Oscillating melody offers a contrary option at every step; the counter should mostly move opposite.
    const zig = [
      { midi: 72, measure: 1, beat: 0, onsetDivs: 0, durDivs: 1 },   // C5
      { midi: 71, measure: 1, beat: 1, onsetDivs: 1, durDivs: 1 },   // B4
      { midi: 72, measure: 1, beat: 2, onsetDivs: 2, durDivs: 1 },   // C5
      { midi: 71, measure: 1, beat: 3, onsetDivs: 3, durDivs: 1 },   // B4
      { midi: 72, measure: 1, beat: 4, onsetDivs: 4, durDivs: 1 },   // C5
    ];
    const lines = generateCounterLines({ melody: zig, chordByMeasure: { 1: 'C' }, key: 'C', register: 'below' });
    let contrary = 0, parallel = 0;
    lines.forEach((line) => {
      for (let i = 1; i < line.notes.length; i++) {
        const a = line.notes[i - 1], b = line.notes[i];
        const ma = melAt(zig, a), mb = melAt(zig, b);
        const md = Math.sign(mb.midi - ma.midi), cd = Math.sign(b.midi - a.midi);
        if (md === 0 || cd === 0) continue;
        if (cd !== md) contrary++; else parallel++;
      }
    });
    expect(contrary).toBeGreaterThan(parallel);
  });

  test('register:"above" places counter-notes above the melody as diatonic tones', () => {
    const lines = generateCounterLines({ melody, chordByMeasure, key: 'C', register: 'above' });
    expect(lines.length).toBeGreaterThan(0);
    lines.forEach((line) => {
      expect(line.notes.length).toBeGreaterThan(0);
      line.notes.forEach((cn) => {
        const m = melAt(melody, cn);
        expect(m).toBeDefined();
        expect(cn.midi).toBeGreaterThan(m.midi);
        expect(C_MAJOR.has(pc(cn.midi))).toBe(true);
      });
    });
  });

  test('returns [] for empty melody', () => {
    expect(generateCounterLines({ melody: [], chordByMeasure, key: 'C' })).toEqual([]);
  });

  test('returns [] when no chord is known for any measure (harmony cannot be judged)', () => {
    expect(generateCounterLines({ melody, chordByMeasure: { 1: 'Xyz' }, key: 'C' })).toEqual([]);
  });
});
