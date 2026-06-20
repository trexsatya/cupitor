// public/music-index.integration.test.js
import fs from 'fs';
import jQuery from 'jquery';
import { encodeMusicXml, inferChords } from './music-encoding.js';
import { buildIndexEntry } from './music-index.js';

beforeAll(() => { global.$ = global.jQuery = jQuery; });

const SCORES = '/Users/satyendra.kumar/Documents/MuseScore3/Scores';
const CHOPIN = `${SCORES}/Chopin_Nocturne_Op.9_No.2_for_Solo_Guitar.xml`;
const SOR = `${SCORES}/24_Etudes_Op.35_-_Fernando_Sor_1778_-_1839.xml`;
const have = (p) => { try { return fs.existsSync(p); } catch (_) { return false; } };

(have(CHOPIN) ? describe : describe.skip)('real file: Chopin Nocturne', () => {
  test('encodes; key from 4 sharps; channels present', () => {
    const xml = fs.readFileSync(CHOPIN, 'utf8');
    const doc = inferChords(encodeMusicXml(xml, { id: 'Chopin_Nocturne_Op.9_No.2_for_Solo_Guitar', system: 'western' }));
    expect(doc.meta.key).toBe('E');
    expect(doc.meta.tempo).toBe(54);   // Phase 0: <sound tempo="54">
    const entry = buildIndexEntry(doc, xml);
    expect(entry.noteCount).toBeGreaterThan(100);
    expect(entry.channels).toContain('duration');
    expect(entry.channels).toContain('chordSymbol');   // inference produced chords
    expect(entry.search.chords.length).toBeGreaterThan(0);
    expect(entry.search.contour.length).toBeGreaterThan(0);
  });
});

(have(SOR) ? describe : describe.skip)('real file: Sor 24 Études (stress)', () => {
  test('encodes 932-measure / ~4MB file without error', () => {
    const xml = fs.readFileSync(SOR, 'utf8');
    const doc = inferChords(encodeMusicXml(xml, { id: '24_Etudes_Op.35_-_Fernando_Sor', system: 'western' }));
    const entry = buildIndexEntry(doc, xml);
    expect(entry.noteCount).toBeGreaterThan(500);
  }, 30000); // generous timeout for the large parse
});
