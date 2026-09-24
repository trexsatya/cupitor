import {
  gestureAxis,
  GESTURE_SLOP,
  nativeScrollVerdictStale,
  FS_RECHECK_ABOVE,
} from "./scroll-gesture";

describe("nativeScrollVerdictStale", () => {
  test("keeps the answer while the list is the size it was measured at", () => {
    expect(nativeScrollVerdictStale(20000, 20000)).toBe(false);
    expect(nativeScrollVerdictStale(20000, 19800)).toBe(false);
  });

  test("asks again once row previews have grown the list", () => {
    // The whole bug: measured at 11200 before the previews arrived, used at
    // 19600 afterwards — past the height where the WebView gives up.
    expect(nativeScrollVerdictStale(19600, 11200)).toBe(true);
  });

  test("asks again when the list shrinks by as much", () => {
    expect(nativeScrollVerdictStale(11200, 19600)).toBe(true);
  });

  test("leaves short lists alone however much they change", () => {
    // No browser struggles here, and re-probing costs a visible frame.
    expect(nativeScrollVerdictStale(FS_RECHECK_ABOVE, 100)).toBe(false);
    expect(nativeScrollVerdictStale(3000, 20000)).toBe(false);
  });

  test("a tall list with no answer on record is worth asking about", () => {
    expect(nativeScrollVerdictStale(20000, undefined)).toBe(true);
  });

  test("treats an unusable height as nothing to act on", () => {
    expect(nativeScrollVerdictStale(NaN, 100)).toBe(false);
    expect(nativeScrollVerdictStale(undefined, 100)).toBe(false);
  });
});

describe("gestureAxis", () => {
  test("waits until the finger has moved far enough to tell", () => {
    expect(gestureAxis(2, 3, true)).toBeNull();
    expect(gestureAxis(GESTURE_SLOP - 1, 0, true)).toBeNull();
  });

  test("takes a clearly vertical drag", () => {
    expect(gestureAxis(1, 20, true)).toBe("y");
  });

  test("gives a clearly sideways drag away — when there is somewhere to go", () => {
    expect(gestureAxis(20, 1, true)).toBe("x");
  });

  test("keeps a sideways drag when there is nowhere sideways to go", () => {
    // The list reads as frozen otherwise: the decision stands for the whole
    // gesture, and the axis it was given cannot move.
    expect(gestureAxis(20, 1, false)).toBe("y");
  });

  test("keeps a thumb's diagonal start when there is nowhere sideways to go", () => {
    // A flick arcs, so the first few pixels lean sideways more often than not.
    expect(gestureAxis(7, 6, false)).toBe("y");
  });

  test("a diagonal start still goes sideways when sideways is possible", () => {
    expect(gestureAxis(7, 6, true)).toBe("x");
  });

  test("a tie goes to the axis this scroller owns", () => {
    expect(gestureAxis(10, 10, true)).toBe("x");
    expect(gestureAxis(10, 10, false)).toBe("y");
  });

  test("direction does not matter, only distance", () => {
    expect(gestureAxis(-20, -1, true)).toBe("x");
    expect(gestureAxis(-1, -20, true)).toBe("y");
  });

  test("an explicit slop overrides the default", () => {
    expect(gestureAxis(10, 0, true, 20)).toBeNull();
    expect(gestureAxis(25, 0, true, 20)).toBe("x");
    // A nonsense slop falls back rather than deciding on the first pixel.
    expect(gestureAxis(1, 1, true, 0)).toBeNull();
    expect(gestureAxis(1, 1, true, -5)).toBeNull();
  });

  test("treats unusable numbers as no movement", () => {
    expect(gestureAxis(NaN, NaN, true)).toBeNull();
    expect(gestureAxis(undefined, undefined, true)).toBeNull();
  });
});
