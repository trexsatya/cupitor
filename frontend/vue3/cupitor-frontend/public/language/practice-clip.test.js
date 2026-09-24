import { clipRange, CLIP_MIN_SECONDS } from "./practice-clip";

// Five lines, one second each, starting at 10s.
const lines = [0, 1, 2, 3, 4].map((i) => ({
  index: i + 1,
  start: { ordinal: 10 + i },
  end: { ordinal: 11 + i },
}));
const captured = { start: 12, stop: 13 };

describe("clipRange", () => {
  test("plays the matched line and one more, which is what it always did", () => {
    // Matched line is index 2 (12s–13s); the run-off takes it to 14s.
    expect(clipRange(lines, 2, 0, 0, captured)).toEqual({ start: 12, stop: 14 });
  });

  test("a line added after is heard, not just shown", () => {
    expect(clipRange(lines, 2, 0, 1, captured).stop).toBe(15);
    expect(clipRange(lines, 2, 0, 2, captured).stop).toBe(15);
  });

  test("a line added before moves the start back", () => {
    expect(clipRange(lines, 2, 1, 0, captured).start).toBe(11);
    expect(clipRange(lines, 2, 2, 0, captured).start).toBe(10);
  });

  test("with nothing added the captured start wins over the subtitles", () => {
    // The captured time is authoritative for the matched line and survives the
    // SRT being re-segmented, so it is not second-guessed.
    const drifted = lines.map((l) => ({ ...l, start: { ordinal: l.start.ordinal + 5 } }));
    expect(clipRange(drifted, 2, 0, 0, captured).start).toBe(12);
  });

  test("does not run off the end of the subtitles", () => {
    const r = clipRange(lines, 4, 0, 3, captured);
    expect(r.stop).toBe(15);
    expect(clipRange(lines, 0, 5, 0, captured).start).toBe(10);
  });

  test("falls back to the captured times when the line cannot be placed", () => {
    expect(clipRange(lines, -1, 0, 2, captured)).toEqual(captured);
    expect(clipRange([], 0, 0, 0, captured)).toEqual(captured);
    expect(clipRange(null, 0, 0, 0, captured)).toEqual(captured);
  });

  test("lines with no timing leave the captured range alone", () => {
    const untimed = [{ index: 1 }, { index: 2 }, { index: 3 }];
    expect(clipRange(untimed, 1, 1, 1, captured)).toEqual(captured);
  });

  test("a range that would not move forward is given a length", () => {
    expect(clipRange([], 0, 0, 0, { start: 30, stop: 30 })).toEqual({
      start: 30,
      stop: 30 + CLIP_MIN_SECONDS,
    });
  });
});
