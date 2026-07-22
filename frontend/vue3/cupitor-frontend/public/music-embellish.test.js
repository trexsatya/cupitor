import {
  pcOf,
  scalePcs,
  buildPool,
  noteRoles,
  noteRoles as roles,
  enumerateVariations,
  diatonicNeighborPc,
  isThirdApart,
  midpointPc,
  eligibleSites,
  TECHNIQUES,
  generateVariations,
  BLUE_PCS,
  blueGraceSlideSites,
} from './music-embellish.js';

describe('pitch helpers', () => {
  test('pcOf reduces midi to a 0-11 pitch class', () => {
    expect(pcOf(69)).toBe(9);   // A4
    expect(pcOf(60)).toBe(0);   // C4
  });
  test('scalePcs returns the diatonic pitch classes of a key', () => {
    expect(scalePcs('C').sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
  test('scalePcs of an unknown/empty key is empty', () => {
    expect(scalePcs('')).toEqual([]);
  });
  test('scalePcs of an unknown non-empty key is empty (does not throw)', () => {
    expect(scalePcs('H')).toEqual([]);
  });
});

describe('buildPool', () => {
  test('default pool = pitch classes present in the segment note names', () => {
    const pool = buildPool(['A', 'C', 'E'], { addNotes: false, key: 'C' });
    expect([...pool].sort((a, b) => a - b)).toEqual([0, 4, 9]); // C,E,A
  });
  test('addNotes widens the pool to the key scale', () => {
    const pool = buildPool(['A'], { addNotes: true, key: 'C' });
    expect([...pool].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
});

describe('noteRoles', () => {
  const chordByMeasure = { 1: 'Am' }; // Am = A,C,E
  test('tags chord tones by pitch class and marks the earliest onset as the strong beat', () => {
    const notes = [
      { name: 'A', midi: 69, onset: 0, duration: 1, measure: 1, chord: 'Am' },
      { name: 'B', midi: 71, onset: 1, duration: 1, measure: 1, chord: 'Am' },
      { name: 'C', midi: 72, onset: 2, duration: 1, measure: 1, chord: 'Am' },
    ];
    const roled = noteRoles(notes, chordByMeasure);
    expect(roled.map((n) => n.isChordTone)).toEqual([true, false, true]); // B is not in Am
    expect(roled.map((n) => n.beatStrength)).toEqual(['strong', 'weak', 'weak']);
    expect(roled[0].pc).toBe(9);
  });
  test('a null chord makes every note a non-chord tone', () => {
    const roled = noteRoles([{ name: 'A', midi: 69, onset: 0, duration: 1, measure: 2, chord: null }], {});
    expect(roled[0].isChordTone).toBe(false);
  });
});

describe('enumerateVariations', () => {
  const site = (technique, index, gap) => ({ technique, index, gap, label: `${technique}@${index}`, edit: { op: 'x', index } });
  test('lists single-site variations first, then non-conflicting pairs, and caps the count', () => {
    const sites = [site('passing', 0, [0, 1]), site('neighbour', 2, null), site('suspension', 4, null)];
    const out = enumerateVariations(sites, { cap: 4 });
    // first three are singles, in order
    expect(out.slice(0, 3).map((v) => v.label)).toEqual(['passing@0', 'neighbour@2', 'suspension@4']);
    // fourth is a pair (progressive), capped at 4 total
    expect(out).toHaveLength(4);
    expect(out[3].techniques.length).toBe(2);
    expect(out.every((v) => v.id)).toBe(true);
  });
  test('never combines two sites that touch the same note index', () => {
    const sites = [site('passing', 1, [1, 2]), site('appoggiatura', 1, null)]; // both index 1 -> conflict
    const out = enumerateVariations(sites, { cap: 10 });
    expect(out).toHaveLength(2);            // only the two singles, no pair
    expect(out.every((v) => v.techniques.length === 1)).toBe(true);
  });
  test('adjacent split sites (gap overlap on the boundary note) are not paired', () => {
    // gap [0,1] and gap [1,2] share note index 1 -> conservative rule keeps them apart
    const sites = [site('passing', 0, [0, 1]), site('passing', 1, [1, 2])];
    const out = enumerateVariations(sites, { cap: 10 });
    expect(out).toHaveLength(2);            // two singles only, no pair
    expect(out.every((v) => v.techniques.length === 1)).toBe(true);
  });
});

describe('diatonic-step helpers (C major scale)', () => {
  const scale = [0, 2, 4, 5, 7, 9, 11];
  test('diatonicNeighborPc steps up/down within the scale', () => {
    expect(diatonicNeighborPc(9, +1, scale)).toBe(11); // A -> B
    expect(diatonicNeighborPc(9, -1, scale)).toBe(7);  // A -> G
    expect(diatonicNeighborPc(0, -1, scale)).toBe(11); // C -> B (wrap down)
    expect(diatonicNeighborPc(11, +1, scale)).toBe(0); // B -> C (wrap up)
  });
  test('isThirdApart: two scale degrees apart (a diatonic third)', () => {
    expect(isThirdApart(9, 0, scale)).toBe(true);   // A..C (A,B,C)
    expect(isThirdApart(9, 11, scale)).toBe(false);  // A..B is a second
  });
  test('midpointPc: the scale degree between two notes a third apart', () => {
    expect(midpointPc(9, 0, scale)).toBe(11); // between A and C = B
  });
});

describe('eligibleSites — passing', () => {
  const key = 'C';
  const chordByMeasure = { 1: 'Am' }; // A,C,E
  const notes = [
    { name: 'A', midi: 69, onset: 0, duration: 2, measure: 1, chord: 'Am' },
    { name: 'C', midi: 72, onset: 2, duration: 2, measure: 1, chord: 'Am' },
  ];
  test('finds a passing tone B between A and C when B is in the pool', () => {
    const pool = new Set([9, 11, 0]); // A, B, C present
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool, key, techniques: ['passing'] });
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ technique: 'passing', index: 0, gap: [0, 1], insertMidi: 71 });
    expect(sites[0].edit).toMatchObject({ op: 'split', index: 0, insertMidi: 71 });
  });
  test('no passing site when the middle pitch (B) is not in the pool', () => {
    const pool = new Set([9, 0]); // A, C only
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool, key, techniques: ['passing'] });
    expect(sites).toHaveLength(0);
  });
});

describe('eligibleSites — neighbour', () => {
  const key = 'C', chordByMeasure = { 1: 'Am' };
  const notes = [
    { name: 'A', midi: 69, onset: 0, duration: 2, measure: 1, chord: 'Am' },
    { name: 'A', midi: 69, onset: 2, duration: 2, measure: 1, chord: 'Am' },
  ];
  test('inserts an upper neighbour B between two A chord tones', () => {
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set([9, 11]), key, techniques: ['neighbour'] });
    expect(sites[0]).toMatchObject({ technique: 'neighbour', index: 0, gap: [0, 1], insertMidi: 71 });
  });
  test('falls back to the lower neighbour G when B is not in the pool', () => {
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set([9, 7]), key, techniques: ['neighbour'] });
    expect(sites[0].insertMidi).toBe(67); // G
  });
  test('no neighbour site when neither the upper nor lower neighbour is in the pool', () => {
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set([9]), key, techniques: ['neighbour'] });
    expect(sites).toEqual([]); // only A in pool -> B and G both excluded
  });
});

describe('eligibleSites — anticipation', () => {
  const key = 'C', chordByMeasure = { 1: 'Am', 2: 'F' }; // F = F,A,C
  const notes = [
    { name: 'E', midi: 64, onset: 0, duration: 4, measure: 1, chord: 'Am' },
    { name: 'F', midi: 65, onset: 0, duration: 4, measure: 2, chord: 'F' },
  ];
  test('anticipates the next chord tone F by stealing the current note tail', () => {
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set(), key, techniques: ['anticipation'] });
    expect(sites[0]).toMatchObject({ technique: 'anticipation', index: 0, insertMidi: 65 });
    expect(sites[0].edit).toMatchObject({ op: 'insert', gap: [0, 1], insertMidi: 65 });
  });
});

describe('eligibleSites — suspension / retardation', () => {
  const key = 'C';
  const chordByMeasure = { 1: 'G', 2: 'C' }; // G=G,B,D ; C=C,E,G
  const notes = [
    { name: 'D', midi: 62, onset: 0, duration: 4, measure: 1, chord: 'G' }, // D is a step above C (next chord tone)
    { name: 'C', midi: 60, onset: 0, duration: 4, measure: 2, chord: 'C' },
  ];
  test('suspension: D held over the barline resolving down to C', () => {
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set(), key, techniques: ['suspension'] });
    expect(sites[0]).toMatchObject({ technique: 'suspension', index: 0 });
    expect(sites[0].edit).toMatchObject({ op: 'tie', index: 0 });
  });
  test('retardation: a note a step BELOW the next chord tone, resolving up', () => {
    const n = [
      { name: 'B', midi: 71, onset: 0, duration: 4, measure: 1, chord: 'G' }, // B a step below C
      { name: 'C', midi: 72, onset: 0, duration: 4, measure: 2, chord: 'C' },
    ];
    const sites = eligibleSites(roles(n, chordByMeasure), { pool: new Set(), key, techniques: ['retardation'] });
    expect(sites[0]).toMatchObject({ technique: 'retardation', index: 0 });
  });
});

describe('eligibleSites — appoggiatura / escape', () => {
  const key = 'C';
  test('appoggiatura: accented upper-step D before a strong-beat C', () => {
    const chordByMeasure = { 1: 'C' }; // C,E,G
    const notes = [{ name: 'C', midi: 72, onset: 0, duration: 4, measure: 1, chord: 'C' }];
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set([0, 2]), key, techniques: ['appoggiatura'] });
    expect(sites[0]).toMatchObject({ technique: 'appoggiatura', index: 0, insertMidi: 74 }); // D
    expect(sites[0].edit).toMatchObject({ op: 'split', index: 0, insertMidi: 74 });
  });
  test('escape: steps down to B (opposite the upward leap) then leaps to G', () => {
    const chordByMeasure = { 1: 'C' };
    const notes = [
      { name: 'C', midi: 60, onset: 0, duration: 2, measure: 1, chord: 'C' },
      { name: 'G', midi: 67, onset: 2, duration: 2, measure: 1, chord: 'C' },
    ];
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set([11, 0, 7]), key, techniques: ['escape'] });
    expect(sites[0]).toMatchObject({ technique: 'escape', index: 0, insertMidi: 59 }); // B3, a step below C
  });
});

describe('generateVariations façade', () => {
  test('TECHNIQUES lists all 7 with display names and needsNewPitch flags', () => {
    expect(TECHNIQUES.map((t) => t.key).sort()).toEqual(
      ['anticipation', 'appoggiatura', 'escape', 'neighbour', 'passing', 'retardation', 'suspension']);
    expect(TECHNIQUES.find((t) => t.key === 'passing').needsNewPitch).toBe(true);
    expect(TECHNIQUES.find((t) => t.key === 'suspension').needsNewPitch).toBe(false);
  });
  test('end-to-end: notes + chords + options -> capped, labelled variations', () => {
    const notes = [
      { name: 'A', midi: 69, onset: 0, duration: 2, measure: 1, chord: 'Am' },
      { name: 'C', midi: 72, onset: 2, duration: 2, measure: 1, chord: 'Am' },
    ];
    const out = generateVariations({
      voiceNotes: notes, chordByMeasure: { 1: 'Am' },
      segmentNoteNames: ['A', 'B', 'C'], key: 'C',
      techniques: ['passing'], addNotes: false, cap: 10,
    });
    expect(out[0].label).toContain('passing');
    expect(out[0].edits[0].op).toBe('split');
  });
});

describe('detector edge cases', () => {
  const key = 'C';

  test('escape: no site when the step-away neighbour B is not in the pool', () => {
    const chordByMeasure = { 1: 'C' };
    const notes = [
      { name: 'C', midi: 60, onset: 0, duration: 2, measure: 1, chord: 'C' },
      { name: 'G', midi: 67, onset: 2, duration: 2, measure: 1, chord: 'C' },
    ];
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set([0, 7]), key, techniques: ['escape'] });
    expect(sites).toHaveLength(0);
  });

  test('escape: no site when the two chord tones are only a step apart (no leap)', () => {
    const notes = [
      { name: 'C', midi: 60, onset: 0, duration: 2, measure: 1, chord: 'C' },   // C chord tone
      { name: 'D', midi: 62, onset: 2, duration: 2, measure: 1, chord: 'Dm' },  // Dm chord tone, a step up
    ];
    const sites = eligibleSites(roles(notes, {}), { pool: new Set([0, 2, 4, 5, 7, 9, 11]), key, techniques: ['escape'] });
    expect(sites).toHaveLength(0);
  });

  test('appoggiatura: lower-neighbour fallback when the upper neighbour is not in the pool', () => {
    const notes = [{ name: 'C', midi: 72, onset: 0, duration: 4, measure: 1, chord: 'C' }];
    const sites = eligibleSites(roles(notes, {}), { pool: new Set([11]), key, techniques: ['appoggiatura'] });
    expect(sites[0]).toMatchObject({ technique: 'appoggiatura', index: 0, insertMidi: 71 }); // B3, lower neighbour
  });

  test('appoggiatura: no site on a weak-beat chord tone (strong-beat gate)', () => {
    const notes = [
      { name: 'D', midi: 62, onset: 0, duration: 2, measure: 1, chord: 'C' }, // strong beat but non-chord tone -> skipped
      { name: 'C', midi: 72, onset: 2, duration: 2, measure: 1, chord: 'C' }, // chord tone but weak beat -> gated
    ];
    const sites = eligibleSites(roles(notes, {}), { pool: new Set([0, 2, 4, 5, 7, 9, 11]), key, techniques: ['appoggiatura'] });
    expect(sites).toHaveLength(0);
  });

  test('appoggiatura: no site when neither neighbour is in the pool', () => {
    const notes = [{ name: 'C', midi: 72, onset: 0, duration: 4, measure: 1, chord: 'C' }];
    const sites = eligibleSites(roles(notes, {}), { pool: new Set([0, 7]), key, techniques: ['appoggiatura'] });
    expect(sites).toHaveLength(0);
  });

  test('anticipation: no site when the current note is too short to steal a tail (duration < 1)', () => {
    const chordByMeasure = { 1: 'Am', 2: 'F' };
    const notes = [
      { name: 'E', midi: 64, onset: 0, duration: 0.5, measure: 1, chord: 'Am' }, // eighth (0.5 beat) -> no room
      { name: 'F', midi: 65, onset: 0, duration: 4, measure: 2, chord: 'F' },
    ];
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set(), key, techniques: ['anticipation'] });
    expect(sites).toHaveLength(0);
  });

  test('anticipation: a quarter-note (1 beat) now HAS room to steal a tail (guard is beat-based)', () => {
    const chordByMeasure = { 1: 'Am', 2: 'F' };
    const notes = [
      { name: 'E', midi: 64, onset: 0, duration: 1, measure: 1, chord: 'Am' }, // quarter = 1 beat -> room
      { name: 'F', midi: 65, onset: 0, duration: 4, measure: 2, chord: 'F' },
    ];
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set(), key, techniques: ['anticipation'] });
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ technique: 'anticipation', index: 0, insertMidi: 65 });
  });

  test('appoggiatura: a quarter-note (1 beat) strong-beat chord tone now qualifies (guard is beat-based)', () => {
    const chordByMeasure = { 1: 'C' }; // C,E,G
    const notes = [{ name: 'C', midi: 72, onset: 0, duration: 1, measure: 1, chord: 'C' }]; // quarter = 1 beat
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set([0, 2]), key, techniques: ['appoggiatura'] });
    expect(sites[0]).toMatchObject({ technique: 'appoggiatura', index: 0, insertMidi: 74 }); // D before C
  });

  test('anticipation: no site when the next note is not a chord tone', () => {
    const chordByMeasure = { 1: 'Am' };
    const notes = [
      { name: 'E', midi: 64, onset: 0, duration: 4, measure: 1, chord: 'Am' },
      { name: 'B', midi: 71, onset: 4, duration: 4, measure: 1, chord: 'Am' }, // B not in Am
    ];
    const sites = eligibleSites(roles(notes, chordByMeasure), { pool: new Set(), key, techniques: ['anticipation'] });
    expect(sites).toHaveLength(0);
  });

  test('suspension: keys on a chord CHANGE, not a barline — fires within one measure when the chord changes', () => {
    const notes = [
      { name: 'D', midi: 62, onset: 0, duration: 2, measure: 1, chord: 'G' }, // D chord tone of G
      { name: 'C', midi: 60, onset: 2, duration: 2, measure: 1, chord: 'C' }, // C chord tone, a step below; SAME measure, chord changed
    ];
    const sites = eligibleSites(roles(notes, {}), { pool: new Set(), key, techniques: ['suspension'] });
    expect(sites[0]).toMatchObject({ technique: 'suspension', index: 0 });
    expect(sites[0].edit).toMatchObject({ op: 'tie', index: 0 });
  });

  test('suspension: no site across a barline when the chord does NOT change', () => {
    const notes = [
      { name: 'C', midi: 60, onset: 0, duration: 2, measure: 1, chord: 'Cmaj7' }, // C chord tone of Cmaj7
      { name: 'B', midi: 59, onset: 0, duration: 2, measure: 2, chord: 'Cmaj7' }, // B chord tone, a step below; different measure, SAME chord
    ];
    const sites = eligibleSites(roles(notes, {}), { pool: new Set(), key, techniques: ['suspension'] });
    expect(sites).toHaveLength(0);
  });
});

test('BLUE_PCS returns b3, b5, b7 pitch classes relative to the key tonic', () => {
  expect(new Set(BLUE_PCS('C'))).toEqual(new Set([3, 6, 10]));   // C: Eb,Gb,Bb
  expect(new Set(BLUE_PCS('Am'))).toEqual(new Set([0, 3, 7]));   // Am: C,Eb,G
});

test('bluesy style widens the pool with blue notes and enables blue grace sites', () => {
  const voiceNotes = [
    { midi: 60, onset: 0, duration: 1, measure: 1, chord: 'C' },   // strong-beat C chord tone
    { midi: 64, onset: 1, duration: 1, measure: 1, chord: 'C' },
    { midi: 67, onset: 2, duration: 1, measure: 1, chord: 'C' },
  ];
  const vars = generateVariations({ voiceNotes, chordByMeasure: { 1: 'C' }, segmentNoteNames: ['C', 'E', 'G'],
    key: 'C', style: 'bluesy', techniques: [], cap: 20 });
  expect(vars.some((v) => v.edits.some((e) => e && e.op === 'grace'))).toBe(true);
});

test('shuffle=true adds a shuffle edit for eighth pairs', () => {
  const voiceNotes = [
    { midi: 60, onset: 0, duration: 0.5, measure: 1, chord: 'C' },
    { midi: 62, onset: 0.5, duration: 0.5, measure: 1, chord: 'C' },
  ];
  const vars = generateVariations({ voiceNotes, chordByMeasure: { 1: 'C' }, segmentNoteNames: ['C', 'D'],
    key: 'C', style: 'bluesy', techniques: [], shuffle: true, cap: 20 });
  expect(vars.some((v) => v.edits.some((e) => e && e.op === 'shuffle'))).toBe(true);
});

test('classical style does NOT add blue grace or shuffle', () => {
  const voiceNotes = [
    { midi: 60, onset: 0, duration: 0.5, measure: 1, chord: 'C' },
    { midi: 62, onset: 0.5, duration: 0.5, measure: 1, chord: 'C' },
  ];
  const vars = generateVariations({ voiceNotes, chordByMeasure: { 1: 'C' }, segmentNoteNames: ['C', 'D'],
    key: 'C', style: 'classical', techniques: [], shuffle: true, cap: 20 });
  expect(vars.every((v) => v.edits.every((e) => e && e.op !== 'grace' && e.op !== 'shuffle'))).toBe(true);
});

test('blueGraceSlide adds a grace a semitone below each strong-beat chord tone', () => {
  const roled = [
    { midi: 60, pc: 0, isChordTone: true, beatStrength: 'strong', measure: 1, onset: 0, duration: 1 },
    { midi: 64, pc: 4, isChordTone: true, beatStrength: 'weak', measure: 1, onset: 1, duration: 1 },
  ];
  const sites = blueGraceSlideSites(roled);
  expect(sites).toHaveLength(1);
  expect(sites[0].technique).toBe('bluesyGrace');
  expect(sites[0].index).toBe(0);
  expect(sites[0].edit).toMatchObject({ op: 'grace', index: 0, insertMidi: 59 });
  // the site's edit is wired through to enumerated variations
  const vars = enumerateVariations(sites);
  expect(vars[0].edits[0]).toMatchObject({ op: 'grace', insertMidi: 59 });
});
