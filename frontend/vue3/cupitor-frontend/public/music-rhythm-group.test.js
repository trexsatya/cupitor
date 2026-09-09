import { normalizeRanges, parseRanges, formatRanges, rangeMeasures, inRanges, removeMeasure,
  addGroup, removeGroup, setGroupRanges, addGroupRanges, setGroupPattern,
  groupPatterns, resolveGroupPattern, groupOpts, groupShades, groupColor } from './music-rhythm-group.js';
import { soloMutedIndices } from './music-rhythm.js';
import { buildScheduleFromMusicXml, concatSchedules } from './music-player.js';

describe('measure ranges', () => {
  test('normalize sorts, orients and merges ranges that overlap or merely touch', () => {
    expect(normalizeRanges([[4, 5], [2, 3], [11, 12]])).toEqual([[2, 5], [11, 12]]);   // 2–3 + 4–5 = 2–5
    expect(normalizeRanges([[3, 2], [9, 9], [8, 10]])).toEqual([[2, 3], [8, 10]]);     // reversed input, overlap
    expect(normalizeRanges([['x', 2], null, [2]])).toEqual([[2, 2]]);                  // junk dropped, bare number ok
  });

  test('parse reads what a human types; format prints it back through a number map', () => {
    expect(parseRanges('2-3, 11–12 15')).toEqual([[2, 3], [11, 12], [15, 15]]);
    expect(parseRanges('')).toEqual([]);
    expect(formatRanges([[2, 3], [11, 12], [15, 15]])).toBe('2–3, 11–12, 15');
    expect(formatRanges([[2, 3]], (n) => n - 1)).toBe('1–2');   // sequential → printed (pickup shift)
  });

  test('rangeMeasures / inRanges / removeMeasure', () => {
    expect(rangeMeasures([[2, 3], [11, 12]])).toEqual([2, 3, 11, 12]);
    expect(inRanges([[2, 3], [11, 12]], 11)).toBe(true);
    expect(inRanges([[2, 3], [11, 12]], 4)).toBe(false);
    expect(removeMeasure([[2, 5]], 3)).toEqual([[2, 2], [4, 5]]);   // splits, does not re-merge
  });
});

describe('group list', () => {
  test('add refuses blank and duplicate names, and colors in creation order', () => {
    let groups = [];
    ({ groups } = addGroup(groups, 'lilting', [[2, 3]]));
    expect(addGroup(groups, '  ').added).toBe(false);
    expect(addGroup(groups, 'lilting', [[9, 9]]).added).toBe(false);
    ({ groups } = addGroup(groups, 'driving', [[11, 12]]));
    expect(groups.map((g) => [g.name, g.color, g.ranges, g.pattern]))
      .toEqual([['lilting', groupColor(0), [[2, 3]], null], ['driving', groupColor(1), [[11, 12]], null]]);
    // Captured WITH a figure: the settings it was read under ride along.
    const bound = addGroup([], 'cells', [[2, 3]], null, 'cell:0.5 0.5 0.5', { unit: 'cell', proportional: true }).groups[0];
    expect(bound).toMatchObject({ pattern: 'cell:0.5 0.5 0.5', unit: 'cell', proportional: true });
  });

  test('bars can be replaced or accumulated, and a group dropped', () => {
    let groups = addGroup([], 'lilting', [[2, 3]]).groups;
    groups = addGroupRanges(groups, 'lilting', [[11, 12]]);
    expect(groups[0].ranges).toEqual([[2, 3], [11, 12]]);
    groups = addGroupRanges(groups, 'lilting', [[4, 4]]);            // touching bar joins the run
    expect(groups[0].ranges).toEqual([[2, 4], [11, 12]]);
    groups = setGroupRanges(groups, 'lilting', [[7, 8]]);
    expect(groups[0].ranges).toEqual([[7, 8]]);
    expect(addGroupRanges(groups, 'nope', [[1, 1]])).toEqual(groups);  // unknown name: no-op
    expect(removeGroup(groups, 'lilting')).toEqual([]);
  });

  // Binding a group to one figure must also record the settings that figure was read under: a pattern
  // id only means something under them, so without this, flipping the panel to cells would silently
  // re-bind the group to whatever cell figure its bars happen to use most.
  test('a bound figure keeps the settings it was bound under; releasing it forgets them', () => {
    let groups = addGroup([], 'lilting', [[2, 3]]).groups;
    expect(groupOpts(groups[0], { unit: 'cell', proportional: true })).toEqual({ unit: 'cell', proportional: true });
    groups = setGroupPattern(groups, 'lilting', 'bar:0.5 0.5', { unit: 'bar', proportional: false });
    expect(groups[0]).toMatchObject({ pattern: 'bar:0.5 0.5', unit: 'bar', proportional: false });
    // …and the panel switching to cells no longer changes how the group is read.
    expect(groupOpts(groups[0], { unit: 'cell', proportional: true })).toEqual({ unit: 'bar', proportional: false });
    const released = setGroupPattern(groups, 'lilting', null);
    expect(released[0].pattern).toBe(null);
    expect('unit' in released[0]).toBe(false);
    expect(groupOpts(released[0], { unit: 'cell', proportional: false })).toEqual({ unit: 'cell', proportional: false });
  });
});

// A group = a rhythm FIGURE limited to its bars. 6/8: bars of 3 quarter-beats, beat = dotted quarter.
describe('groupPatterns / resolveGroupPattern', () => {
  const bar68 = (measure, durs, midi = 60) => {
    let t = (measure - 1) * 3;
    return durs.map((d) => {
      const n = { measure, onset: t, dur: d, durBeats: d, midi, voice: 0,
        barBeat: (measure - 1) * 3, beatBeats: 1.5, barBeats: 3 };
      t += d;
      return n;
    });
  };
  // m2,m3 run even eighths; m11,m12 run two dotted quarters. m2 also carries a second voice in
  // dotted quarters, so its bars hold more than one figure — which is why a group must name one.
  const stream = [
    ...bar68(2, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]), ...bar68(3, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
    ...bar68(2, [1.5, 1.5], 48).map((n) => ({ ...n, voice: 1 })),
    ...bar68(11, [1.5, 1.5]), ...bar68(12, [1.5, 1.5]),
  ];

  test('only the group\'s bars are scanned, most-used figure first', () => {
    expect(groupPatterns(stream, [[2, 3]]).map((p) => [p.label, p.count]))
      .toEqual([['e e e e e e', 2], ['q. q.', 1]]);
    expect(groupPatterns(stream, [[11, 12]]).map((p) => [p.label, p.count]))
      .toEqual([['q. q.', 2]]);
    expect(groupPatterns(stream, [[50, 60]])).toEqual([]);
  });

  test('occurrence indices point back into the FULL stream, not the filtered slice', () => {
    const pat = groupPatterns(stream, [[11, 12]])[0];
    const idx = pat.occurrences.flatMap((o) => o.noteIdx);
    expect(idx.every((i) => stream[i].measure === 11 || stream[i].measure === 12)).toBe(true);
    expect(Math.min(...idx)).toBeGreaterThan(13);   // …well past the m2–3 notes at the front
  });

  test('a group uses its stored figure, falling back to the most-used one', () => {
    const dotted = groupPatterns(stream, [[2, 3]])[1].id;
    expect(resolveGroupPattern(stream, { ranges: [[2, 3]], pattern: dotted }).label).toBe('q. q.');
    expect(resolveGroupPattern(stream, { ranges: [[2, 3]], pattern: 'bar:nonsense' }).label).toBe('e e e e e e');
    expect(resolveGroupPattern(stream, { ranges: [[2, 3]], pattern: null }).label).toBe('e e e e e e');
    expect(resolveGroupPattern(stream, { ranges: [[50, 60]] })).toBe(null);
  });

  test('soloing the group silences everything else — the other bars AND the other voice in its own', () => {
    const pat = resolveGroupPattern(stream, { ranges: [[2, 3]], pattern: null });
    const muted = soloMutedIndices(stream, pat);
    const sounding = stream.map((_, i) => i).filter((i) => !muted.includes(i));
    expect(new Set(sounding.map((i) => stream[i].measure))).toEqual(new Set([2, 3]));
    expect(sounding.every((i) => stream[i].voice === 0)).toBe(true);   // the dotted-quarter voice is out
    expect(muted.some((i) => stream[i].measure === 11)).toBe(true);    // ...as are the other bars
  });

  test('two shades of the group colour, same hue, visibly lighter', () => {
    const [dark, light] = groupShades('#e8590c');
    expect(dark).toBe('#e8590c');
    expect(light).toBe('#f5b492');   // 55% toward white
    expect(groupShades('rebeccapurple')).toEqual(['rebeccapurple', 'rebeccapurple']);   // non-hex passes through
  });
});

// ▶▶ Play all: each group in turn, a gap between them.
describe('concatSchedules', () => {
  const a = [{ midi: 60, time: 0, duration: 1, beat: 0 }, { midi: 60, time: 1, duration: 1, beat: 1 }];
  const b = [{ midi: 67, time: 0, duration: 1, beat: 40 }];

  test('later parts are pushed past the previous end plus the gap', () => {
    expect(concatSchedules([a, b], 2).map((e) => [e.midi, e.time]))
      .toEqual([[60, 0], [60, 1], [67, 4]]);   // a ends at 2s, +2s gap → 4s
    expect(concatSchedules([a, b], 0).map((e) => e.time)).toEqual([0, 1, 2]);
  });

  test('a later part\'s first onset is flagged rehome, so the forward-only cursor jumps back to it', () => {
    const out = concatSchedules([a, b], 1);
    expect(out.map((e) => !!e.rehome)).toEqual([false, false, true]);
    expect(out[2].beat).toBe(40);   // ...to the note's real place in the piece
  });

  test('empty parts are skipped without leaving a gap of their own', () => {
    expect(concatSchedules([a, [], b], 1).map((e) => e.time)).toEqual([0, 1, 3]);
    expect(concatSchedules([], 1)).toEqual([]);
  });
});

// How a picked rhythm / selected group plays: ONLY the bars it occurs in, one run after another with a
// gap, and — in solo mode — only its own notes sounding inside them.
describe('bars-with-a-gap playback (keepNotes + mutedNotes)', () => {
  const quarters = (step) => [0, 1, 2, 3]
    .map(() => `<note><pitch><step>${step}</step><octave>4</octave></pitch><duration>2</duration><type>quarter</type></note>`).join('');
  const xml = `<score-partwise><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
    <part id="P1">
      <measure number="1"><attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>${quarters('C')}</measure>
      <measure number="2">${quarters('D')}</measure>
      <measure number="3">${quarters('E')}</measure>
      <measure number="4">${quarters('F')}</measure>
    </part></score-partwise>`;
  const barNotes = (m, midi) => [0, 1, 2, 3].map((i) => ({ measure: m, midi, beats: (m - 1) * 4 + i }));
  const keep = [...barNotes(2, 62), ...barNotes(4, 65)];   // the bars the rhythm occurs in

  test('bars 2 and 4 play back to back, the skipped bar collapsing to the gap', () => {
    const s = buildScheduleFromMusicXml(xml, { tempo: 60, keepNotes: keep, breathBeats: 2 });
    expect(s.map((e) => e.midi)).toEqual([62, 62, 62, 62, 65, 65, 65, 65]);
    expect(s.map((e) => e.time)).toEqual([0, 1, 2, 3, 6, 7, 8, 9]);   // bar 3's 4s → the 2-beat gap
    expect(s.every((e) => !e.muted)).toBe(true);
  });

  test('solo mode keeps those bars\' timing exact while silencing the notes that are not the rhythm', () => {
    // The "rhythm" is beats 1 and 3 of each kept bar; the others keep their slot but do not sound.
    const mute = [keep[1], keep[3], keep[5], keep[7]];
    const s = buildScheduleFromMusicXml(xml, { tempo: 60, keepNotes: keep, mutedNotes: mute, breathBeats: 2 });
    expect(s).toHaveLength(8);                                          // nothing is dropped…
    expect(s.filter((e) => !e.muted).map((e) => e.time)).toEqual([0, 2, 6, 8]);   // …every other one sounds
    // Crucially the sounding notes stay 2 beats apart INSIDE a bar — soloing must not re-time them.
    expect(s.map((e) => e.time)).toEqual([0, 1, 2, 3, 6, 7, 8, 9]);
  });

  test('the cursor still follows: kept notes carry their real beat in the piece', () => {
    const s = buildScheduleFromMusicXml(xml, { tempo: 60, keepNotes: keep, breathBeats: 2 });
    expect(s[4].time).toBe(6);    // bar 4 starts right after the gap…
    expect(s[4].beat).toBe(12);   // …but the sheet cursor goes to bar 4's real downbeat
  });
});
