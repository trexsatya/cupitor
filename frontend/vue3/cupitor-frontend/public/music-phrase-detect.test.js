// Tests for automatic phrase detection. The interesting behaviour is not "does it segment" but
// "does it recognise a phrase that came back changed, and does it find the boundary when the piece
// doesn't start on one" — so the fixtures are built to make exactly those things fail if broken.
import {
  detectPhrases, cutSegments, groupSegments, segmentSignature, segmentSimilarity, seqSimilarity,
  topLine, contourSeq, measureSpan, familyName, phraseLabel, phraseBands, changedBars,
  transposeOffset, DEFAULT_PHRASE_BARS,
} from './music-phrase-detect.js';
import { buildScheduleFromMusicXml, concatSchedules } from './music-player.js';

// One quarter-note per beat, four to a bar, starting at bar `from`. `pitches` is one bar's worth of
// midi numbers per entry, so barsOf([[60,62,64,65]]) is a single bar of four quarters.
function barsOf(bars, from = 1) {
  const out = [];
  bars.forEach((pitches, b) => {
    pitches.forEach((midi, i) => {
      out.push({ measure: from + b, onset: (from + b - 1) * 4 + i, durBeats: 1, midi });
    });
  });
  return out;
}

// An 8-bar tune: a rising 4-bar limb answered by a falling one.
const THEME = [
  [60, 62, 64, 65], [67, 65, 64, 62], [60, 64, 67, 72], [71, 69, 67, 65],
  [64, 65, 67, 69], [71, 72, 71, 69], [67, 65, 64, 62], [60, 60, 60, 60],
];
// The same tune with its last bar re-cadenced and one bar ornamented — a "slight modification".
const THEME_VARIED = THEME.map((bar, i) => {
  if (i === 5) return [71, 72, 74, 72];
  if (i === 7) return [62, 60, 59, 60];
  return bar;
});
// A genuinely different 8 bars: static repeated notes, nothing like the theme's contour.
const OTHER = [
  [55, 55, 55, 55], [57, 57, 57, 57], [55, 55, 55, 55], [53, 53, 53, 53],
  [55, 55, 55, 55], [57, 57, 57, 57], [59, 59, 59, 59], [55, 55, 55, 55],
];

describe('reading a segment', () => {
  test('the top line takes only the highest note of each onset', () => {
    // A chord (60+64+67) plus a following single note, in one bar.
    const stream = [
      { measure: 1, onset: 0, durBeats: 1, midi: 60 },
      { measure: 1, onset: 0, durBeats: 1, midi: 64 },
      { measure: 1, onset: 0, durBeats: 1, midi: 67 },
      { measure: 1, onset: 1, durBeats: 1, midi: 69 },
    ];
    expect(topLine(stream, 1, 1).map((n) => n.midi)).toEqual([67, 69]);
  });

  test('contour is intervals, so the same shape transposed reads the same', () => {
    const low = segmentSignature(barsOf([[60, 62, 64, 65]]), 1, 1);
    const high = segmentSignature(barsOf([[67, 69, 71, 72]]), 1, 1);
    expect(low.contour).toEqual(high.contour);
    expect(segmentSimilarity(low, high)).toBe(1);
  });

  test('measureSpan is null for a stream with no notes', () => {
    expect(measureSpan([])).toBeNull();
  });
});

describe('comparing sequences', () => {
  test('one changed token out of ten costs about a tenth', () => {
    const a = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    const b = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'X'];
    const sim = seqSimilarity(a, b);
    expect(sim).toBeGreaterThan(0.85);
    expect(sim).toBeLessThan(1);
  });

  test('two empty sequences agree; an empty against a full one does not', () => {
    expect(seqSimilarity([], [])).toBe(1);
    expect(seqSimilarity([], ['1'])).toBe(0);
  });
});

describe('cutting the piece into segments', () => {
  test('an even piece cuts into whole segments', () => {
    expect(cutSegments({ first: 1, last: 16 }, 8, 0)).toEqual([
      { from: 1, to: 8, partial: false },
      { from: 9, to: 16, partial: false },
    ]);
  });

  test('an offset keeps the bars before it as their own short segment', () => {
    expect(cutSegments({ first: 1, last: 18 }, 8, 2)).toEqual([
      { from: 1, to: 2, partial: true },
      { from: 3, to: 10, partial: false },
      { from: 11, to: 18, partial: false },
    ]);
  });

  test('a leftover tail is kept, not dropped', () => {
    const segs = cutSegments({ first: 1, last: 11 }, 8, 0);
    expect(segs[segs.length - 1]).toEqual({ from: 9, to: 11, partial: true });
  });
});

describe('grouping segments into families', () => {
  test('the first statement seeds the family and later ones join it', () => {
    const seg = (from, to, bars) => ({ from, to, partial: false, sig: segmentSignature(barsOf(bars, from), from, to) });
    const families = groupSegments([
      seg(1, 8, THEME), seg(9, 16, OTHER), seg(17, 24, THEME_VARIED),
    ]);
    expect(families).toHaveLength(2);
    expect(families[0].occurrences.map((o) => o.from)).toEqual([1, 17]);
    expect(families[1].occurrences.map((o) => o.from)).toEqual([9]);
  });

  test('a modified return joins its family but is marked varied', () => {
    const seg = (from, bars) => ({ from, to: from + 7, partial: false, sig: segmentSignature(barsOf(bars, from), from, from + 7) });
    const [fam] = groupSegments([seg(1, THEME), seg(9, THEME_VARIED)]);
    expect(fam.occurrences[0].varied).toBe(false);
    expect(fam.occurrences[1].varied).toBe(true);
    expect(fam.occurrences[1].similarity).toBeGreaterThan(0.62);
    expect(fam.occurrences[1].similarity).toBeLessThan(1);
  });
});

describe('locating what changed inside a modified return', () => {
  // THEME_VARIED edits bar 6 and bar 8 (0-based indices 5 and 7) and nothing else.
  const sigAt = (bars, from) => segmentSignature(barsOf(bars, from), from, from + bars.length - 1);

  test('only the edited bars are reported, by their own measure numbers', () => {
    const ref = sigAt(THEME, 1);
    const occ = sigAt(THEME_VARIED, 9);   // so its bars are m9…m16; edits land on m14 and m16
    expect(changedBars(ref, occ)).toEqual([14, 16]);
  });

  test('an identical return reports nothing changed', () => {
    expect(changedBars(sigAt(THEME, 1), sigAt(THEME, 9))).toEqual([]);
  });

  test('a return transposed as a whole reports nothing changed', () => {
    // Every note up a major third: the phrase is the same phrase, played higher.
    const up = THEME.map((bar) => bar.map((m) => m + 4));
    expect(transposeOffset(sigAt(THEME, 1), sigAt(up, 9))).toBe(4);
    expect(changedBars(sigAt(THEME, 1), sigAt(up, 9))).toEqual([]);
  });

  test('a transposed return still reports the bar edited inside it', () => {
    const up = THEME.map((bar, i) => (i === 2 ? [72, 72, 72, 72] : bar.map((m) => m + 4)));
    expect(changedBars(sigAt(THEME, 1), sigAt(up, 9))).toEqual([11]);
  });

  test('a changed note in a one-note bar is caught — contour alone could not see it', () => {
    // One note per bar: there are no intervals within a bar, so only pitch can tell these apart.
    const ref = segmentSignature(barsOf([[60], [62], [64]], 1), 1, 3);
    const occ = segmentSignature(barsOf([[60], [67], [64]], 4), 4, 6);
    expect(changedBars(ref, occ)).toEqual([5]);
  });

  test('the shift is the one most bars agree with, not the average of their opening notes', () => {
    // Three bars are the reference up a fifth, exactly; the other five are rewritten, and their opening
    // notes sit at +0,+1,+2,+3,+4. Averaging those eight openings lands on +4 — a shift NO bar agrees
    // with — and every bar then reads as changed. Real scores are full of this: it was why a heavily
    // rewritten return used to flag and spare bars near-arbitrarily.
    const ref = [[60, 62, 64, 65], [67, 69, 71, 72], [74, 72, 71, 69],
      [67, 65, 64, 62], [60, 62, 64, 65], [67, 69, 71, 72], [74, 72, 71, 69], [67, 65, 64, 62]];
    const occ = [
      ...ref.slice(0, 3).map((bar) => bar.map((m) => m + 7)),
      [67, 67, 67, 67], [61, 61, 61, 61], [69, 69, 69, 69], [77, 77, 77, 77], [71, 71, 71, 71],
    ];
    const refSig = segmentSignature(barsOf(ref, 1), 1, 8);
    const occSig = segmentSignature(barsOf(occ, 9), 9, 16);
    expect(transposeOffset(refSig, occSig)).toBe(7);
    expect(changedBars(refSig, occSig)).toEqual([12, 13, 14, 15, 16]);
  });

  test('a bar the reference does not have counts as changed', () => {
    const ref = segmentSignature(barsOf([[60, 62, 64, 65]], 1), 1, 1);
    const occ = segmentSignature(barsOf([[60, 62, 64, 65], [67, 69, 71, 72]], 5), 5, 6);
    expect(changedBars(ref, occ)).toEqual([6]);
  });

  test('a rhythm change with the same pitches is caught', () => {
    const ref = segmentSignature([
      { measure: 1, onset: 0, durBeats: 1, midi: 60 }, { measure: 1, onset: 1, durBeats: 1, midi: 62 },
    ], 1, 1);
    const occ = segmentSignature([
      { measure: 2, onset: 4, durBeats: 0.5, midi: 60 }, { measure: 2, onset: 4.5, durBeats: 1.5, midi: 62 },
    ], 2, 2);
    expect(changedBars(ref, occ)).toEqual([2]);
  });
});

describe('detectPhrases', () => {
  // theme | other | theme-varied — 24 bars, boundaries on the 8-bar grid.
  const abaStream = [...barsOf(THEME, 1), ...barsOf(OTHER, 9), ...barsOf(THEME_VARIED, 17)];

  test('names families in order of appearance and folds the varied return into the first', () => {
    const { phrases, bars, offset } = detectPhrases(abaStream);
    expect(bars).toBe(DEFAULT_PHRASE_BARS);
    expect(offset).toBe(0);
    expect(phrases.map((p) => p.name)).toEqual(['A', 'B']);
    expect(phrases[0].count).toBe(2);
    expect(phrases[0].ranges).toEqual([[1, 8], [17, 24]]);
    expect(phrases[1].ranges).toEqual([[9, 16]]);
  });

  test('the label carries the count, the bars, and a prime on a modified return', () => {
    const { phrases } = detectPhrases(abaStream);
    expect(phrases[0].label).toBe('A · 2× · m1-8, m17-24′');
  });

  test('a modified return carries the bars that differ; the reference carries none', () => {
    const { phrases } = detectPhrases(abaStream);
    const [ref, variation] = phrases[0].occurrences;
    expect(ref.changed).toEqual([]);
    // THEME_VARIED sits at m17-24, so its edited 6th and 8th bars are m22 and m24.
    expect(variation.changed).toEqual([22, 24]);
    expect(phrases[0].changedBars).toBe(2);
  });

  test('a two-bar intro shifts the cut, and the shifted cut is the one chosen', () => {
    // 2 bars of intro, then theme / other / theme — the real phrases start at bar 3, so an unshifted
    // 8-bar cut splits every one of them. The intro is deliberately unlike anything else in the piece:
    // material that resembles another part of the score would make the unshifted cut defensible too.
    const intro = barsOf([[84, 83, 82, 81], [80, 79, 78, 77]], 1);
    const stream = [...intro, ...barsOf(THEME, 3), ...barsOf(OTHER, 11), ...barsOf(THEME_VARIED, 19)];
    const { offset, phrases } = detectPhrases(stream);
    expect(offset).toBe(2);
    const theme = phrases.find((p) => p.ranges.some((r) => r[0] === 3));
    expect(theme.ranges).toEqual([[3, 10], [19, 26]]);
  });

  test('every bar of the piece belongs to exactly one phrase occurrence', () => {
    const { phrases } = detectPhrases(abaStream);
    const covered = [];
    phrases.forEach((p) => p.occurrences.forEach((o) => { for (let m = o.from; m <= o.to; m += 1) covered.push(m); }));
    covered.sort((a, b) => a - b);
    expect(covered).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  test('a shorter phrase length is honoured', () => {
    const { bars, phrases } = detectPhrases(abaStream, { bars: 4 });
    expect(bars).toBe(4);
    expect(phrases.every((p) => p.occurrences.every((o) => o.to - o.from + 1 <= 4))).toBe(true);
  });

  test('an empty stream yields no phrases instead of throwing', () => {
    expect(detectPhrases([])).toEqual({ bars: 8, first: 0, offset: 0, phrases: [] });
  });
});

// ▶ Play on a detected phrase: every occurrence in turn with a gap between. The composition lives in
// music.html, but the scheduling decision it rests on is worth pinning here — getting it wrong produces
// playback with no audible seam, which is the whole point of the feature.
describe('playing a phrase occurrence by occurrence', () => {
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
  // A phrase stated in bars 1-2 and returning in bars 3-4.
  const occ1 = [...barNotes(1, 60), ...barNotes(2, 62)];
  const occ2 = [...barNotes(3, 64), ...barNotes(4, 65)];
  const sched = (keep) => buildScheduleFromMusicXml(xml, { tempo: 60, keepNotes: keep });

  test('one schedule per occurrence, spliced by the gap, leaves an audible seam', () => {
    const parts = [occ1, occ2].map(sched);
    const out = concatSchedules(parts, 2);   // 2s at tempo 60
    expect(out.map((e) => e.midi)).toEqual([60, 60, 60, 60, 62, 62, 62, 62, 64, 64, 64, 64, 65, 65, 65, 65]);
    // The first statement runs 0…8s; the return starts a full gap later, not immediately.
    expect(out[7].time + out[7].duration).toBe(8);
    expect(out[8].time).toBe(10);
  });

  test('the return is flagged rehome, so the play cursor jumps back to its real bars', () => {
    const out = concatSchedules([occ1, occ2].map(sched), 2);
    expect(out.filter((e) => e.rehome)).toHaveLength(1);
    expect(out[8].rehome).toBe(true);
    expect(out[8].beat).toBe(8);   // bar 3's downbeat, where the return actually lives
  });

  test('handing every occurrence to ONE keepNotes call fuses them — why they are built separately', () => {
    // keepNotes compresses the gaps out of whatever it is given, so all four bars come out contiguous
    // and the two occurrences run together with nothing between them.
    const fused = sched([...occ1, ...occ2]);
    expect(fused.map((e) => e.time)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(fused[8].time).toBe(8);   // the return begins the instant the statement ends — no seam
  });

  test('an occurrence that is not on the drawn sheet contributes nothing and costs no gap', () => {
    const out = concatSchedules([sched(occ1), [], sched(occ2)], 2);
    expect(out[8].time).toBe(10);   // still one gap, not two
  });

  // "Suppress notes" has to apply to phrase playback too: a suppressed voice must not be heard.
  describe('respecting suppressed notes', () => {
    const suppressed = (keep, muted) =>
      buildScheduleFromMusicXml(xml, { tempo: 60, keepNotes: keep, mutedNotes: muted });

    test('a suppressed note keeps its slot and goes silent', () => {
      // Suppress beats 2 and 4 of each bar of the first occurrence.
      const muted = [occ1[1], occ1[3], occ1[5], occ1[7]];
      const s = suppressed(occ1, muted);
      expect(s).toHaveLength(8);                                       // nothing dropped…
      expect(s.filter((e) => e.muted).map((e) => e.time)).toEqual([1, 3, 5, 7]);
      expect(s.filter((e) => !e.muted).map((e) => e.time)).toEqual([0, 2, 4, 6]);
    });

    test('muting rather than dropping is what keeps the phrase in time', () => {
      // Why suppressed notes are muted instead of being left out of keepNotes: keepNotes compresses away
      // any measure it is given nothing in. Suppress a whole bar and dropping it would delete that bar
      // from the phrase — the phrase would start on what is really its second bar. Muting keeps the bar,
      // silent, so the phrase keeps its shape and its length.
      const bar1 = occ1.slice(0, 4);
      const muted = suppressed(occ1, bar1);
      expect(muted).toHaveLength(8);
      expect(muted.filter((e) => e.muted).map((e) => e.time)).toEqual([0, 1, 2, 3]);   // bar 1: silent…
      expect(muted.filter((e) => !e.muted).map((e) => e.time)).toEqual([4, 5, 6, 7]);  // …bar 2 still 2nd

      const dropped = suppressed(occ1.slice(4), []);
      expect(dropped).toHaveLength(4);
      expect(dropped.map((e) => e.time)).toEqual([0, 1, 2, 3]);   // bar 2 slid to the front — wrong phrase
    });

    test('suppressing inside a bar does not re-time the rest of it', () => {
      // Compression is per measure, so a hole inside a bar is left alone either way. This is the case the
      // comment above does NOT cover, pinned so the two are not confused.
      const muted = [occ1[1], occ1[3]];
      const kept = suppressed(occ1, muted).filter((e) => !e.muted).map((e) => e.time);
      const dropped = suppressed(occ1.filter((n, i) => ![1, 3].includes(i)), []).map((e) => e.time);
      expect(kept).toEqual([0, 2, 4, 5, 6, 7]);
      expect(dropped).toEqual(kept);
    });

    test('the gap between occurrences is unchanged by suppression', () => {
      // A muted note still occupies time, so the splice points do not move.
      const muted = [occ1[7]];
      const out = concatSchedules([suppressed(occ1, muted), suppressed(occ2, muted)], 2);
      expect(out[8].time).toBe(10);
    });

    test('suppressing everything leaves a schedule where nothing sounds', () => {
      const s = suppressed(occ1, occ1);
      expect(s).toHaveLength(8);
      expect(s.filter((e) => !e.muted)).toHaveLength(0);
    });
  });
});

describe('presentation', () => {
  test('family names run past Z', () => {
    expect([0, 1, 25, 26].map(familyName)).toEqual(['A', 'B', 'Z', 'AA']);
  });

  test('the label can show printed measure numbers instead of sequential ones', () => {
    const occ = [{ from: 2, to: 9, varied: false }];
    expect(phraseLabel('A', occ, (m) => m - 1)).toBe('A · 1× · m1-8');
  });

  test('a varied occurrence shades lighter than the reference', () => {
    const bands = phraseBands({ color: '#1565c0', occurrences: [
      { from: 1, to: 8, varied: false }, { from: 9, to: 16, varied: true },
    ] });
    expect(bands.map((b) => b.fill)).toEqual(['#1565c0', '#1565c0']);
    expect(bands[1].opacity).toBeLessThan(bands[0].opacity);
  });

  test('each band is badged, so back-to-back occurrences can be told apart', () => {
    // m9-16 and m17-24 touch: without a per-occurrence badge the two blocks read as one long span.
    const bands = phraseBands({ name: 'B', color: '#c62828', occurrences: [
      { from: 9, to: 16, varied: false }, { from: 17, to: 24, varied: true }, { from: 25, to: 32, varied: true },
    ] });
    expect(bands.map((b) => b.badge)).toEqual(['B1', 'B2′', 'B3′']);
  });

  test('a lone occurrence is badged with just its letter — there is no second one to number against', () => {
    const bands = phraseBands({ name: 'C', color: '#2e7d32', occurrences: [{ from: 1, to: 8, varied: false }] });
    expect(bands.map((b) => b.badge)).toEqual(['C']);
  });
});

// Each occurrence of a picked phrase gets a toggle. Switching one off takes it off the sheet and out
// of playback — but must NOT renumber the rest: the badge names an occurrence's place in the phrase,
// so B3′ has to stay B3′ whatever else is showing.
describe('phraseBands — per-occurrence toggles', () => {
  const phrase = {
    name: 'B', color: '#c62828',
    occurrences: [
      { from: 9, to: 16, varied: false, changed: [] },
      { from: 25, to: 32, varied: true, changed: [30] },
      { from: 33, to: 40, varied: true, changed: [38] },
      { from: 41, to: 48, varied: true, changed: [46] },
    ],
  };
  const off = (...idx) => ({
    ...phrase,
    occurrences: phrase.occurrences.map((o, i) => ({ ...o, enabled: !idx.includes(i) })),
  });

  test('every occurrence shows when none is switched off', () => {
    expect(phraseBands(phrase).map((b) => b.badge)).toEqual(['B1', 'B2′', 'B3′', 'B4′']);
  });

  test('a switched-off occurrence leaves the sheet', () => {
    expect(phraseBands(off(1)).map((b) => b.badge)).toEqual(['B1', 'B3′', 'B4′']);
  });

  test('the survivors keep their own numbers — no renumbering', () => {
    expect(phraseBands(off(0, 1)).map((b) => b.badge)).toEqual(['B3′', 'B4′']);
    expect(phraseBands(off(1, 2)).map((b) => b.badge)).toEqual(['B1', 'B4′']);
  });

  test('a lone surviving occurrence keeps its bars and its changed-bar outlines', () => {
    const bands = phraseBands(off(0, 1, 3));
    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({ from: 33, to: 40, badge: 'B3′', changed: [38] });
  });

  test('switching everything off shades nothing', () => {
    expect(phraseBands(off(0, 1, 2, 3))).toEqual([]);
  });

  test('occurrences with no `enabled` flag at all still show (older callers)', () => {
    expect(phraseBands({ ...phrase, occurrences: [{ from: 1, to: 8 }] }).map((b) => b.badge)).toEqual(['B']);
  });
});
