import {
  clipRange,
  contiguousLineWindow,
  gapSecondsBefore,
  formatGap,
  CLIP_MIN_SECONDS,
  CLIP_LEAD_SECONDS,
} from "./practice-clip";

const line = (i, s, e) => ({ index: i, start: { ordinal: s }, end: { ordinal: e } });

// Five continuous lines, one second each, starting at 10s.
const lines = [0, 1, 2, 3, 4].map((i) => line(i + 1, 10 + i, 11 + i));
const captured = { start: 12, stop: 13 };

// The real shape: a file stitched from two captures, minutes apart. Lines 0-2
// are one snippet; lines 3-4 were captured somewhere else entirely.
const sparse = [
  line(1, 10, 11),
  line(2, 11, 12),
  line(3, 12, 13),
  line(4, 600, 601),
  line(5, 601, 602),
];

// `lines` are one second each and back to back, so neither the lead nor the
// tail has any room: the clip is exactly the lines shown.
const L = CLIP_LEAD_SECONDS;
const near = (r, start, stop) => {
  expect(r.start).toBeCloseTo(start, 5);
  expect(r.stop).toBeCloseTo(stop, 5);
};

describe("clipRange", () => {
  test("plays the matched line only — not the line before it nor the one after", () => {
    near(clipRange(lines, 2, 0, 0, { start: 11, stop: 14 }), 12, 13);
  });

  test("a line added after is heard, not just shown", () => {
    near(clipRange(lines, 2, 0, 1, captured), 12, 14);
  });

  test("a line added before moves the start back", () => {
    expect(clipRange(lines, 2, 1, 0, captured).start).toBeCloseTo(11, 5);
    expect(clipRange(lines, 2, 2, 0, captured).start).toBeCloseTo(10 - L, 5); // first line in the file: room to lead
  });

  test("a little before and after when the neighbours leave room, but not into them", () => {
    const spaced = [line(1, 5, 9.9), line(2, 10, 11), line(3, 11.3, 12)];
    near(clipRange(spaced, 1, 0, 0, captured), 9.9, 11.3);
    const roomy = [line(1, 10, 11), line(2, 13, 14)];
    near(clipRange(roomy, 0, 0, 0, captured), 10 - L, 11.6);
  });

  test("a next line that starts before this one ends gets no run-off", () => {
    const overlap = [line(1, 10, 11), line(2, 10.8, 12)];
    expect(clipRange(overlap, 0, 0, 0, captured).stop).toBeCloseTo(11, 5);
  });

  test("a missing time is unknown, not 0 — the stored times play", () => {
    const blank = [{ index: 1, start: { ordinal: null }, end: { ordinal: 11 } }];
    expect(clipRange(blank, 0, 0, 0, captured)).toEqual(captured);
  });

  test("falls back to the captured times when the line cannot be placed", () => {
    expect(clipRange(lines, -1, 0, 2, captured)).toEqual(captured);
    expect(clipRange([], 0, 0, 0, captured)).toEqual(captured);
    expect(clipRange(null, 0, 0, 0, captured)).toEqual(captured);
  });

  test("a range that would not move forward is given a length", () => {
    expect(clipRange([], 0, 0, 0, { start: 30, stop: 30 })).toEqual({
      start: 30,
      stop: 30 + CLIP_MIN_SECONDS,
    });
  });
});

describe("clipRange over a stitched file", () => {
  // The whole point: these lines are neighbours in the file and ten minutes
  // apart in the video.
  test("does not run across the jump to reach the next line", () => {
    // Anchor on the last line of the first snippet, ask for one line after.
    // Line 4 starts at 600s — playing to it would run for ten minutes.
    const r = clipRange(sparse, 2, 0, 1, { start: 12, stop: 13 });
    expect(r.stop).toBeCloseTo(13.6, 5);
    expect(r.stop - r.start).toBeLessThan(5);
  });

  test("does not run back across the jump either", () => {
    // Anchor on the first line after the jump, ask for two lines before.
    const r = clipRange(sparse, 3, 2, 0, { start: 600, stop: 601 });
    expect(r.start).toBeCloseTo(600 - L, 5);
  });

  test("still takes context on the side that is continuous", () => {
    near(clipRange(sparse, 2, 2, 0, { start: 12, stop: 13 }), 10 - L, 13.6);
  });
});

describe("contiguousLineWindow", () => {
  test("gives every line asked for when the run is continuous", () => {
    expect(contiguousLineWindow(lines, 2, 1, 1)).toEqual({ from: 1, to: 3 });
    expect(contiguousLineWindow(lines, 2, 9, 9)).toEqual({ from: 0, to: 4 });
  });

  test("stops at the seam rather than putting an unplayable line on the card", () => {
    // Line 3 is ten minutes away. Asking for context after line 2 gets none.
    expect(contiguousLineWindow(sparse, 2, 0, 1)).toEqual({ from: 2, to: 2 });
    expect(contiguousLineWindow(sparse, 2, 2, 5)).toEqual({ from: 0, to: 2 });
  });

  test("stops at the seam going backwards too", () => {
    expect(contiguousLineWindow(sparse, 3, 3, 1)).toEqual({ from: 3, to: 4 });
  });

  test("always covers the matched line itself", () => {
    expect(contiguousLineWindow(sparse, 3, 0, 0)).toEqual({ from: 3, to: 3 });
  });

  test("an unplaceable line asks for nothing", () => {
    expect(contiguousLineWindow(lines, -1, 1, 1)).toEqual({ from: 0, to: -1 });
    expect(contiguousLineWindow([], 0, 1, 1)).toEqual({ from: 0, to: -1 });
  });
});

describe("gapSecondsBefore", () => {
  test("measures the break, for the marker search results draws", () => {
    // 600 - 13 = 587s between the two captures.
    expect(gapSecondsBefore(sparse)).toEqual([0, 0, 0, 587, 0]);
  });

  test("continuous lines report no break", () => {
    expect(gapSecondsBefore(lines)).toEqual([0, 0, 0, 0, 0]);
  });

  test("lines with no timing are not guessed at", () => {
    expect(gapSecondsBefore([{ index: 1 }, { index: 2 }])).toEqual([0, 0]);
    expect(gapSecondsBefore(null)).toEqual([]);
  });
});

describe("formatGap", () => {
  test("reads as a length of video", () => {
    expect(formatGap(12)).toBe("12s");
    expect(formatGap(60)).toBe("1m");
    expect(formatGap(587)).toBe("9m 47s");
  });

  test("nothing to say about no gap", () => {
    expect(formatGap(0)).toBe("");
    expect(formatGap(null)).toBe("");
  });
});
