import { ticksInWindow, downbeatAlignment } from './music-metronome.js';

describe('ticksInWindow', () => {
  test('emits one tick per beat within the window (bpm=60 → 1s per beat)', () => {
    const { ticks } = ticksInWindow(0, 4, 0, 60, 4);   // window [0,4): beats at 0,1,2,3
    expect(ticks.map((t) => t.time)).toEqual([0, 1, 2, 3]);
    expect(ticks.map((t) => t.beat)).toEqual([0, 1, 2, 3]);
  });

  test('accents beat 0 and every beatsPerMeasure-th beat', () => {
    const { ticks } = ticksInWindow(0, 8, 0, 60, 4);
    expect(ticks.map((t) => t.accent)).toEqual([true, false, false, false, true, false, false, false]);
  });

  test('3/4 accents every third beat', () => {
    const { ticks } = ticksInWindow(0, 6, 0, 60, 3);
    expect(ticks.map((t) => t.accent)).toEqual([true, false, false, true, false, false]);
  });

  test('carries nextTime and beat forward for the next window (no gaps/overlaps)', () => {
    const first = ticksInWindow(0, 2.5, 0, 60, 4);      // beats 0,1,2 → next at 3
    expect(first.beat).toBe(3);
    expect(first.nextTime).toBe(3);
    const second = ticksInWindow(first.nextTime, 5, first.beat, 60, 4);   // beats 3,4
    expect(second.ticks.map((t) => t.beat)).toEqual([3, 4]);
    expect(second.ticks[1].accent).toBe(true);           // beat 4 is a downbeat
  });

  test('a starting beat phase shifts the accent to the real downbeat (start 2 beats into 4/4)', () => {
    // Playback began on beat 3 of a 4/4 bar (phase 2): the next downbeat is 2 ticks later, then every 4.
    const { ticks } = ticksInWindow(0, 7, 2, 60, 4);   // beats 2,3,4,5,6,7,8
    expect(ticks.map((t) => t.beat)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(ticks.filter((t) => t.accent).map((t) => t.beat)).toEqual([4, 8]);
  });

  test('tempo sets the spacing (120 bpm → 0.5s per beat)', () => {
    const { ticks } = ticksInWindow(0, 1, 0, 120, 4);
    expect(ticks.map((t) => t.time)).toEqual([0, 0.5]);
  });

  test('empty window yields no ticks but still advances position', () => {
    const res = ticksInWindow(5, 5, 2, 60, 4);           // windowEnd == nextTime
    expect(res.ticks).toEqual([]);
    expect(res.nextTime).toBe(5);
    expect(res.beat).toBe(2);
  });

  test('non-positive bpm / beatsPerMeasure fall back to 90 / 4', () => {
    const spb = 60 / 90;
    const { ticks } = ticksInWindow(0, spb * 3.5, 0, 0, 0);   // beats 0..3 fall inside; beat 4 is past it
    expect(ticks).toHaveLength(4);
    expect(ticks[0].accent).toBe(true);                  // beat 0 accented under the default meter (4)
    expect(ticks[1].accent).toBe(false);
    expect(ticks[0].time).toBeCloseTo(0, 9);
    expect(ticks[1].time).toBeCloseTo(spb, 9);
  });
});

describe('downbeatAlignment', () => {
  // Anchors the click grid to whole beats (offset from the first note's onset) and puts the accent on
  // barline downbeats. Returns { phase, beatOffset }: phase = counter at the first tick; beatOffset =
  // beats to wait before that first tick so it lands on the beat grid.

  test('note on the beat, no pickup, first beat → tick immediately, accent now', () => {
    expect(downbeatAlignment(0, 4, 4)).toEqual({ phase: 0, beatOffset: 0 });
  });

  test('note on the beat, mid-piece downbeat (beat 12 of 4/4) → immediate accent', () => {
    expect(downbeatAlignment(12, 4, 4)).toEqual({ phase: 0, beatOffset: 0 });
  });

  test('syncopated first note (beat 4.5, 3/4, no pickup) → wait 0.5 beat then accent on the next barline', () => {
    // Real A_Time_For_Us case: barlines at 0,3,6,9; first note off-beat at 4.5. First tick at beat 5
    // (phase 2, weak), accent at beat 6 (a barline).
    expect(downbeatAlignment(4.5, 3, 3)).toEqual({ phase: 2, beatOffset: 0.5 });
  });

  test('quarter-off first note (beat 5.75, 3/4) → wait 0.25 beat, first tick at beat 6 (a downbeat)', () => {
    expect(downbeatAlignment(5.75, 3, 3)).toEqual({ phase: 0, beatOffset: 0.25 });
  });

  // Genuine metric pickup: first full-measure downbeat sits at absolute beat 1 (1-beat anacrusis).
  test('1-beat pickup, playing the pickup note (start 0) → phase 3 so accent lands 1 beat later', () => {
    expect(downbeatAlignment(0, 1, 4)).toEqual({ phase: 3, beatOffset: 0 });
  });

  test('1-beat pickup, starting on the first real downbeat (beat 1) → immediate accent', () => {
    expect(downbeatAlignment(1, 1, 4)).toEqual({ phase: 0, beatOffset: 0 });
  });

  test('non-positive meter falls back to 4', () => {
    expect(downbeatAlignment(0, 0, 0)).toEqual({ phase: 0, beatOffset: 0 });
  });

  test('tiny float error on an integer beat is treated as on-grid (no spurious wait)', () => {
    const { phase, beatOffset } = downbeatAlignment(6 + 1e-9, 3, 3);
    expect(phase).toBe(0);
    expect(beatOffset).toBeCloseTo(0, 6);
  });
});
