import { notesOfRegister, createMusicRenderer } from './music-render.js';

const note = (midi, onsetBeats = 0, durBeats = 1, measure = 1) => ({ midi, onsetBeats, durBeats, measure });
const pitches = (notes, register) => notesOfRegister(notes, register).map(n => n.midi);

test('pitch layers follow each attack rather than fixed voice numbers', () => {
  const notes = [note(48), note(60), note(64), note(72), note(55, 1), note(67, 1), note(79, 1)];
  expect(pitches(notes, 'lowest')).toEqual([48, 55]);
  expect(pitches(notes, 'highest')).toEqual([72, 79]);
  expect(pitches(notes, 'middle')).toEqual([60, 64, 67]);
});

test('held bass and melody frame arpeggiated middle notes across a barline', () => {
  const notes = [note(48, 0, 8), note(72, 0, 8), note(60, 1), note(64, 4, 1, 2), note(67, 5, 1, 2)];
  expect(pitches(notes, 'lowest')).toEqual([48]);
  expect(pitches(notes, 'highest')).toEqual([72]);
  expect(pitches(notes, 'middle')).toEqual([60, 64, 67]);
});

test('released notes stop affecting the next attack; grace notes do not create layers', () => {
  const notes = [note(48), note(72), { ...note(40, 1), grace: true }, note(60, 1), note(67, 1)];
  expect(pitches(notes, 'lowest')).toEqual([48, 60]);
  expect(pitches(notes, 'highest')).toEqual([72, 67]);
  expect(pitches(notes, 'middle')).toEqual([]);
});

test('unisons share a suppression identity and invalid input is ignored', () => {
  const n = note(60);
  expect(notesOfRegister([n, n, { midi: null, onsetBeats: 0 }, { midi: 20 }], 'lowest')).toEqual([{ measure: 1, midi: 60, beats: 0 }]);
  expect(notesOfRegister([n], 'middle')).toEqual([]);
  expect(notesOfRegister([n], 'unknown')).toEqual([]);
});

test('manual recalculation and leaving suppress mode clear old picks while retaining muted notes', () => {
  const osmd = { setOptions() {}, render() {}, Sheet: { SourceMeasures: [] } };
  const renderer = createMusicRenderer({}, { osmdFactory: () => osmd });
  const suppressed = [{ measure: 1, midi: 60, beats: 0 }];
  renderer.setSuppressedNotes(suppressed);
  renderer.setSelectedChords(['Cmaj']);
  expect(renderer.recalculateChords()).toEqual([]);
  expect(renderer.getSelectedChords()).toEqual([]);
  expect(renderer.getMutedNotes()).toEqual(suppressed);
  renderer.setSuppressMode(true);
  renderer.setSelectedChords(['Cmaj']);
  renderer.setSuppressMode(false);
  expect(renderer.getSelectedChords()).toEqual([]);
  expect(renderer.getMutedNotes()).toEqual(suppressed);
});

test('the actual score model recalculates chord names and fretboard steps from audible notes', async () => {
  const canvas = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ font: '', measureText: text => ({ width: String(text).length * 6 }) });
  const oldBox = SVGElement.prototype.getBBox;
  SVGElement.prototype.getBBox = () => ({ x: 10, y: 10, width: 10, height: 10 });
  const host = document.createElement('div'); document.body.appendChild(host);
  Object.defineProperty(host, 'offsetWidth', { value: 900 });
  const { OpenSheetMusicDisplay } = require('./vendor/opensheetmusicdisplay.min.js');
  const renderer = createMusicRenderer(host, { beatCounters: false, osmdFactory: c => new OpenSheetMusicDisplay(c, { autoResize: false }) });
  const source = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>${['C', 'E', 'G'].map((step, i) => `<note>${i ? '<chord/>' : ''}<pitch><step>${step}</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>`).join('')}</measure></part></score-partwise>`;
  try {
    await renderer.loadDetail({ format: 'musicxml', source, meta: { key: 'C' } });
    expect(renderer.getGuessedChordSequence().length).toBeGreaterThan(0);
    renderer.suppressRegister('middle', true);
    expect(renderer.getMutedNotes().map(n => n.midi)).toEqual([64]);
    expect(renderer.getGuessedChordSequence().flatMap(c => c.notes)).not.toContain('E');
    renderer.suppressRegister('lowest', true);
    renderer.suppressRegister('highest', true);
    expect(renderer.getGuessedChordSequence()).toEqual([]);
    expect(renderer.getGuessedChords()).toEqual([]);
    expect(renderer.getGuessedChordSequence({ includeSuppressed: true }).length).toBeGreaterThan(0);
    renderer.setHearAll(true);
    expect(renderer.getGuessedChordSequence().length).toBeGreaterThan(0);
  } finally {
    renderer.osmd.clear(); host.remove(); canvas.mockRestore();
    if (oldBox) SVGElement.prototype.getBBox = oldBox; else delete SVGElement.prototype.getBBox;
  }
});
