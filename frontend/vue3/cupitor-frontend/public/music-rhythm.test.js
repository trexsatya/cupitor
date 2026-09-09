import { rhythmTokens, rhythmKey, rhythmLabel, voiceEvents, barRhythms, findRhythmPatterns, soloMutedIndices } from './music-rhythm.js';
import { buildScheduleFromMusicXml } from './music-player.js';

// A rendered note as the renderer's stream carries it: absolute onset + duration in quarter-beats.
const N = (measure, onset, durBeats, midi = 60, voice = 0) => ({ measure, onset, durBeats, midi, voice });
// A bar of consecutive notes starting at `at`: durations laid end to end (no rests).
const bar = (measure, at, durs, midi = 60, voice = 0) => {
  let t = at;
  return durs.map((d) => { const n = N(measure, t, d, midi, voice); t += d; return n; });
};
// Cells are measured in the METER's beats, so their tests must say what the meter is: each note
// carries its bar's downbeat, one beat, and one bar (quarter-beats). 4/4 unless stated.
const meter = (notes, { beatBeats = 1, barBeats = 4, barBeat = 0 } = {}) =>
  notes.map((n) => ({ ...n, beatBeats, barBeats, barBeat }));
// 6/8: bars of 3 quarter-beats, beat = dotted quarter (1.5), so three eighths = ONE beat.
const bars68 = (dursPerBar) => dursPerBar.flatMap((durs, i) =>
  meter(bar(i + 1, i * 3, durs), { beatBeats: 1.5, barBeats: 3, barBeat: i * 3 }));

describe('rhythmTokens / rhythmKey / rhythmLabel', () => {
  test('consecutive notes → note tokens; a hole between them → a rest token', () => {
    const evs = [{ onset: 0, dur: 1 }, { onset: 1, dur: 1 }, { onset: 3, dur: 1 }];   // hole of 1 beat
    expect(rhythmTokens(evs)).toEqual([
      { t: 'n', d: 1 }, { t: 'n', d: 1 }, { t: 'r', d: 1 }, { t: 'n', d: 1 },
    ]);
    expect(rhythmKey(evs)).toBe('1 1 r1 1');
    expect(rhythmLabel(rhythmTokens(evs))).toBe('q q (q) q');
  });

  test('proportional keys durations against the first note, so augmentation matches', () => {
    const slow = [{ onset: 0, dur: 1 }, { onset: 1, dur: 1 }, { onset: 2, dur: 2 }];
    const fast = [{ onset: 0, dur: 0.5 }, { onset: 0.5, dur: 0.5 }, { onset: 1, dur: 1 }];
    expect(rhythmKey(slow)).not.toBe(rhythmKey(fast));
    expect(rhythmKey(slow, { proportional: true })).toBe(rhythmKey(fast, { proportional: true }));
  });

  test('labels name whole/half/quarter/eighth/16th, dotted and triplet values', () => {
    const label = (durs) => rhythmLabel(rhythmTokens(durs.map((d, i) => ({ onset: i * 8, dur: d })))
      .filter((tk) => tk.t === 'n'));
    expect(label([4, 2, 1, 0.5, 0.25])).toBe('w h q e s');
    expect(label([3, 1.5, 0.75])).toBe('h. q. e.');
    expect(label([1 / 3])).toBe('e³');
    expect(label([0.9])).toBe('0.9');   // unmetered value falls back to the number
  });
});

describe('voiceEvents', () => {
  test('a chord collapses to ONE rhythmic event carrying every notehead index', () => {
    const stream = [N(1, 0, 1, 60), N(1, 0, 1, 64), N(1, 0, 1, 67), N(1, 1, 1, 72)];
    const evs = voiceEvents(stream).get(0);
    expect(evs.map((e) => e.onset)).toEqual([0, 1]);
    expect(evs[0].noteIdx).toEqual([0, 1, 2]);
    expect(evs[0].dur).toBe(1);
  });

  test('voices are kept apart', () => {
    const stream = [N(1, 0, 1, 60, 0), N(1, 0, 2, 48, 1)];
    const ev = voiceEvents(stream);
    expect(ev.get(0).map((e) => e.dur)).toEqual([1]);
    expect(ev.get(1).map((e) => e.dur)).toEqual([2]);
  });
});

describe('findRhythmPatterns — bars', () => {
  test('identical bar rhythms collapse into one pattern, counted and listed by measure', () => {
    const stream = [
      ...bar(1, 0, [1, 1, 2]),
      ...bar(2, 4, [0.5, 0.5, 1, 2]),
      ...bar(3, 8, [1, 1, 2]),
    ];
    const pats = findRhythmPatterns(stream, { unit: 'bar' });
    expect(pats[0].label).toBe('q q h');
    expect(pats[0].count).toBe(2);
    expect(pats[0].measures).toEqual([1, 3]);
    expect(pats.map((p) => p.count)).toEqual([2, 1]);           // most frequent first
    expect(pats[1].label).toBe('e e q h');
  });

  test('a rest inside the bar makes it a different pattern', () => {
    const stream = [
      ...bar(1, 0, [1, 1, 1, 1]),
      N(2, 4, 1), N(2, 6, 1),                                   // beat 2 empty → rest token
    ];
    const pats = findRhythmPatterns(stream, { unit: 'bar' });
    expect(pats.map((p) => p.label).sort()).toEqual(['q (q) q', 'q q q q']);
  });

  test('occurrences carry every notehead of the bar, chords included', () => {
    const stream = [
      N(1, 0, 1, 60), N(1, 0, 1, 64), N(1, 1, 1, 62),           // chord + note
      N(2, 4, 1, 67), N(2, 5, 1, 69),
    ];
    const pats = findRhythmPatterns(stream, { unit: 'bar' });
    expect(pats[0].count).toBe(2);
    expect(pats[0].occurrences[0].noteIdx).toEqual([0, 1, 2]);
    expect(pats[0].occurrences[1].noteIdx).toEqual([3, 4]);
  });

  test('proportional folds a half-speed bar into the same pattern', () => {
    const stream = [...bar(1, 0, [1, 1, 2]), ...bar(2, 4, [0.5, 0.5, 1])];
    expect(findRhythmPatterns(stream, { unit: 'bar' })).toHaveLength(2);
    const prop = findRhythmPatterns(stream, { unit: 'bar', proportional: true });
    expect(prop).toHaveLength(1);
    expect(prop[0].count).toBe(2);
    expect(prop[0].label).toBe('1 1 2');
  });

  test('nothing rendered → no patterns', () => {
    expect(findRhythmPatterns([], { unit: 'bar' })).toEqual([]);
    expect(findRhythmPatterns(null, { unit: 'cell' })).toEqual([]);
  });
});

describe('findRhythmPatterns — cells', () => {
  // The 6/8 case that a quarter-beat notion of "beat" gets wrong: three eighths ARE the beat here.
  test('6/8: three eighths are one beat-cell, and the six-eighth bar is a bar rhythm', () => {
    const stream = bars68([[0.5, 0.5, 0.5, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]]);
    const cells = findRhythmPatterns(stream, { unit: 'cell' });
    expect(cells.map((p) => p.label)).toEqual(['e e e']);       // one beat = three eighths
    expect(cells[0].count).toBe(8);                            // two beats per bar × four bars
    expect(findRhythmPatterns(stream, { unit: 'bar' })[0].label).toBe('e e e e e e');
  });

  test('3/4: cells span one or two beats — never the whole bar', () => {
    const stream = meter([...bar(1, 0, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]), ...bar(2, 3, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5])],
      { beatBeats: 1, barBeats: 3 }).map((n) => ({ ...n, barBeat: n.measure === 1 ? 0 : 3 }));
    const labels = findRhythmPatterns(stream, { unit: 'cell' }).map((p) => p.label);
    expect(labels).toContain('e e');                           // one beat
    expect(labels).toContain('e e e e');                       // two beats
    expect(labels).not.toContain('e e e e e e');               // a whole bar — unit 'bar' shows that
  });

  test('a cell starting off the beat is not a pattern (it is a rotation of one that starts on it)', () => {
    // 4/4 bar of eight eighths: cells start on beats 1–4 only, so "e e" has four occurrences, not seven.
    const stream = meter(bar(1, 0, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
    const two = findRhythmPatterns(stream, { unit: 'cell', maxBeats: 1 });
    expect(two.map((p) => p.label)).toEqual(['e e']);
    expect(two[0].count).toBe(4);
  });

  test('a cell the notes leave half empty keeps the trailing rest, so it is its own pattern', () => {
    // 4/4: beat 1 = two 16ths then silence; beat 2 = two eighths filling it.
    const stream = meter([N(1, 0, 0.25), N(1, 0.25, 0.25), N(1, 1, 0.5), N(1, 1.5, 0.5),
      N(2, 4, 0.25), N(2, 4.25, 0.25), N(2, 5, 0.5), N(2, 5.5, 0.5)]);
    const labels = findRhythmPatterns(stream, { unit: 'cell', maxBeats: 1 }).map((p) => p.label);
    expect(labels).toContain('s s (e)');                        // two 16ths + the eighth rest left over
    expect(labels).toContain('e e');
  });

  test('occurrences of one cell never overlap each other', () => {
    const stream = meter(bar(1, 0, [1, 1, 1, 1]));              // 4/4, four quarters
    const pats = findRhythmPatterns(stream, { unit: 'cell', maxBeats: 2 });
    expect(pats[0].label).toBe('q q');
    expect(pats[0].count).toBe(2);                              // (beats 1-2)(beats 3-4), not three
  });
});

// Playback SOLOS the picked rhythm — the piece keeps its own timing and everything else falls silent.
// Splicing the occurrences together instead (tag-style skip playback) moves the notes in time, which
// is what put the audio out of step with the highlighted noteheads.
describe('soloMutedIndices — playing one rhythm without moving it in time', () => {
  // 4/4: bar 1 = four quarters C D E F (one attack per beat), bar 2 = eight G eighths — the same notes
  // as `xml` below. With one-beat cells the only pattern is "e e", so bar 1 must fall silent.
  const twoBars = () => meter([
    ...[60, 62, 64, 65].map((midi, i) => N(1, i, 1, midi)),
    ...Array.from({ length: 8 }, (_, i) => N(2, 4 + i * 0.5, 0.5, 67)),
  ]);
  const eeCell = (stream) => findRhythmPatterns(stream, { unit: 'cell', maxBeats: 1 })
    .find((p) => p.label === 'e e');

  test('mutes exactly the notes outside the pattern', () => {
    const stream = twoBars();
    const muted = soloMutedIndices(stream, eeCell(stream));
    expect(muted.map((i) => stream[i].measure)).toEqual([1, 1, 1, 1]);   // only bar 1 is silenced
  });

  test('a pattern note doubled at the unison elsewhere is never muted by its twin', () => {
    const stream = twoBars();
    const twin = { ...stream[4], voice: 1 };                    // same midi + onset, another voice
    const withTwin = [...stream, twin];
    const muted = soloMutedIndices(withTwin, eeCell(withTwin));
    expect(muted.some((i) => withTwin[i].midi === twin.midi && withTwin[i].onset === twin.onset)).toBe(false);
  });

  test('the schedule keeps every note at its real time — only the others are muted', () => {
    const xml = `<score-partwise><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
      <part id="P1">
        <measure number="1"><attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
          ${['C', 'D', 'E', 'F'].map((s) => `<note><pitch><step>${s}</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>`).join('')}
        </measure>
        <measure number="2">
          ${Array(8).fill('<note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note>').join('')}
        </measure>
      </part></score-partwise>`;
    const stream = twoBars();
    const mutedNotes = soloMutedIndices(stream, eeCell(stream))
      .map((i) => ({ measure: stream[i].measure, midi: stream[i].midi, beats: stream[i].onset }));
    const schedule = buildScheduleFromMusicXml(xml, { tempo: 60, mutedNotes });   // 60bpm → 1 beat = 1s
    expect(schedule).toHaveLength(12);                          // every note is still scheduled…
    const sounding = schedule.filter((e) => !e.muted);
    expect(sounding).toHaveLength(8);                           // …but only bar 2 sounds
    expect(sounding.every((e) => e.midi === 67)).toBe(true);
    // The decisive bit: bar 2 still starts one bar in (4s), not pulled back to 0s.
    expect(sounding[0].time).toBeCloseTo(4);
    expect(sounding.map((e) => e.time)).toEqual([4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5]);
  });
});
