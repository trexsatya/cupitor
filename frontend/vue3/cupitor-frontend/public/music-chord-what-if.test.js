import { exploreChordReplacements, neighboringScaleNotes, replacementScale, whatIfContexts } from './music-chord-what-if.js';
import realPieces from '../tests/browser/fixtures/chord-what-if-real.json';

const note = (midi, onsetBeats = 0, durBeats = 1, measure = 1) => ({ midi, onsetBeats, durBeats, measure });
const explore = (midis, options = {}) => exploreChordReplacements(midis.map(m => note(m)), { key: 'C', ...options }).contexts[0];
const has = (context, from, to, chord) => context.suggestions.some(s => s.changes.some(c => c.from === from && c.to === to) && s.chords.includes(chord));

test('an in-key note can be the pitch that prevents a complete chord', () => {
  const c = explore([54, 69, 76], { key: 'Bm' });
  expect(c.originalChords).toEqual([]);
  expect(has(c, 'A4', 'B4', 'Bsus4')).toBe(true);
  expect(has(c, 'E5', 'D5', 'Dmaj')).toBe(true);
  expect(c.suggestions.every(s => !s.changes[0].outsideKey)).toBe(true);
});

test('chromatic notes try the nearest scale tone in both directions', () => {
  const c = explore([60, 64, 66]);
  expect(c.originalChords).toEqual([]);
  expect(has(c, 'F#4', 'G4', 'Cmaj')).toBe(true);
  expect(c.suggestions.find(s => s.changes[0].from === 'F#4').changes[0].outsideKey).toBe(true);
  expect(neighboringScaleNotes(66, replacementScale('C')).map(n => n.midi)).toEqual([65, 67]);
});

test('scale neighbors skip the original degree and cross octaves correctly', () => {
  expect(neighboringScaleNotes(60, replacementScale('C')).map(n => [n.midi, n.name])).toEqual([[59, 'B'], [62, 'D']]);
  expect(neighboringScaleNotes(71, replacementScale('C')).map(n => [n.midi, n.name])).toEqual([[69, 'A'], [72, 'C']]);
});

test('natural and harmonic minor distinguish the raised seventh', () => {
  expect(replacementScale('Bm').tones.map(n => n.name)).toEqual(['B', 'C#', 'D', 'E', 'F#', 'G', 'A']);
  expect(replacementScale('Bm', 'harmonic').tones.map(n => n.name)).toEqual(['B', 'C#', 'D', 'E', 'F#', 'G', 'A#']);
  expect(neighboringScaleNotes(70, replacementScale('Bm', 'harmonic')).map(n => n.midi)).toEqual([67, 71]);
});

test('matches explain every resulting pitch, rather than hiding extra notes', () => {
  const c = explore([60, 64, 66, 67]);
  expect(c.originalChords).toEqual([]); // C major with an unexplained F# is not complete.
  expect(has(c, 'F#4', 'G4', 'Cmaj')).toBe(true);
});

test('already recognized chromatic chords remain available for comparison', () => {
  const c = explore([60, 63, 67]);
  expect(c.originalChords).toContain('Cmin');
  expect(has(c, 'D#4', 'E4', 'Cmaj')).toBe(true);
});

test('two-pitch exploration is explicit and single changes are ranked first', () => {
  const c = explore([60, 61, 66]);
  expect(c.suggestions.every(s => s.changes.length === 1 && !s.chords.includes('Bmin'))).toBe(true);
  const two = explore([60, 61, 66], { maxChanges: 2 });
  expect(two.suggestions.some(s => s.chords.includes('Bmin') && s.changes.length === 2)).toBe(true);
  const mixed = explore([60, 62, 67], { maxChanges: 2 }).suggestions;
  expect(mixed.map(s => s.changes.length)).toEqual(mixed.map(s => s.changes.length).sort());
});

test('enharmonics match by pitch while results use key spellings', () => {
  const c = explore([58, 62, 65], { key: 'Bb' });
  expect(c.originalChords).toContain('Bbmaj');
  expect(replacementScale('F#').tones.map(n => n.name)).toContain('E#');
});

test('held pitches are included until their end, including across a barline', () => {
  const notes = [note(48, 0, 4), note(64, 1, 1), note(67, 1, 1), note(65, 4, 1, 2), note(69, 4, 1, 2)];
  const contexts = whatIfContexts(notes);
  expect(contexts[0].notes.map(n => n.midi)).toEqual([48, 64, 67]);
  expect(contexts).toHaveLength(1); // released bass cannot complete the later F-A.
  notes[0].durBeats = 5;
  expect(whatIfContexts(notes)[1].notes.map(n => n.midi)).toEqual([48, 65, 69]);
});

test('unison staff/TAB duplicates do not multiply changes; grace notes are excluded', () => {
  const notes = [note(60), note(60), note(62), note(67), { ...note(66), grace: true }];
  const c = exploreChordReplacements(notes, { key: 'C' }).contexts[0];
  expect(c.notes).toEqual(['C4', 'D4', 'G4']);
  expect(c.tried).toBe(6);
});

test('octave doubles retain separate sounding pitches when one changes', () => {
  const c = explore([48, 60, 64, 67]);
  expect(c.suggestions.every(s => !(s.changes[0].from === 'C3' && s.chords.includes('Emin')))).toBe(true);
});

test('arpeggios are labelled as collected bar notes', () => {
  const notes = [note(60, 0), note(62, 1), note(67, 2)];
  const c = exploreChordReplacements(notes, { key: 'C' }).contexts[0];
  expect(c.kind).toBe('bar');
  expect(has(c, 'D4', 'E4', 'Cmaj')).toBe(true);
});

test('analysis leaves original pitches and input note objects unchanged', () => {
  const notes = Object.freeze([60, 62, 67].map(m => Object.freeze(note(m))));
  exploreChordReplacements(notes, { key: 'C', maxChanges: 2 });
  expect(notes.map(n => n.midi)).toEqual([60, 62, 67]);
});

test('empty notes and unknown key have an explicit empty result', () => {
  expect(exploreChordReplacements([], { key: 'C' }).contexts).toEqual([]);
  expect(exploreChordReplacements([note(60)])).toMatchObject({ contexts: [], error: expect.any(String) });
});

test.each(realPieces)('$piece m$measure: real score produces the verified replacement', sample => {
  const report = exploreChordReplacements(sample.notes, { key: sample.key });
  const c = report.contexts.find(c => c.measure === sample.measure && c.notes.join('|') === sample.originalNotes.join('|'));
  expect(c).toBeDefined();
  expect(c.kind).toBe(sample.kind);
  expect(c.originalChords).toEqual([]);
  expect(has(c, sample.change.from, sample.change.to, sample.chord)).toBe(true);
});
