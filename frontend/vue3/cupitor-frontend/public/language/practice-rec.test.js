import {
  TAKE_SAME_SPOT,
  takeAt,
  addTake,
  removeTake,
  rewindPointFor,
  takesDuration,
  takeOffsetLabel,
} from "./practice-rec";

const tk = (t1, extra) => Object.assign({ t1, url: "file:///" + t1, ms: 1000 }, extra);

describe("addTake", () => {
  test("keeps takes in video order however they were recorded", () => {
    let s = { takes: [] };
    s = addTake(s.takes, tk(30));
    s = addTake(s.takes, tk(10));
    s = addTake(s.takes, tk(20));
    expect(s.takes.map(t => t.t1)).toEqual([10, 20, 30]);
  });

  test("recording over a spot replaces it and hands back the old one", () => {
    const first = tk(10, { url: "file:///old" });
    const { takes } = addTake([first], tk(40));
    const again = addTake(takes, tk(10, { url: "file:///new" }));
    expect(again.takes.map(t => t.url)).toEqual(["file:///new", "file:///40"]);
    // The caller needs this to delete the file nothing points at any more.
    expect(again.replaced).toBe(first);
  });

  test("a spot is the same spot within the tolerance, not to the decimal", () => {
    // The playhead comes from a poll, so the same intent never reads alike.
    const { takes } = addTake([tk(10)], tk(10 + TAKE_SAME_SPOT / 2));
    expect(takes.length).toBe(1);
  });

  test("a take just outside the tolerance is its own spot", () => {
    const { takes } = addTake([tk(10)], tk(10 + TAKE_SAME_SPOT * 2));
    expect(takes.length).toBe(2);
  });

  test("refuses a take with no start, leaving the list as it was", () => {
    const list = [tk(10)];
    const { takes, replaced } = addTake(list, { url: "file:///x" });
    expect(takes).toEqual(list);
    expect(replaced).toBeNull();
  });

  test("does not mutate the list it was given", () => {
    const list = [tk(10)];
    addTake(list, tk(20));
    expect(list.length).toBe(1);
  });
});

describe("rewindPointFor", () => {
  test("goes back to the clip start for the first take", () => {
    expect(rewindPointFor([], 40, 30)).toBe(30);
  });

  test("goes back to the take before it, not to the clip start", () => {
    // The whole point of the loop: replay only what was just spoken over.
    const takes = [tk(35), tk(48)];
    expect(rewindPointFor(takes, 48, 30)).toBe(35);
  });

  test("ignores the take being replayed itself", () => {
    // Otherwise the rewind lands on t1 and replays nothing at all.
    expect(rewindPointFor([tk(48)], 48, 30)).toBe(30);
    expect(rewindPointFor([tk(48.1)], 48, 30)).toBe(30);
  });

  test("ignores takes after the one being replayed", () => {
    const takes = [tk(35), tk(48), tk(60)];
    expect(rewindPointFor(takes, 48, 30)).toBe(35);
  });

  test("never rewinds behind the clip start", () => {
    // A take from a card on the same video that started earlier.
    expect(rewindPointFor([tk(5)], 48, 30)).toBe(30);
  });

  test("falls back to the clip start when the numbers are unusable", () => {
    expect(rewindPointFor([tk(35)], NaN, 30)).toBe(30);
    expect(rewindPointFor([tk(35)], 48, NaN)).toBe(35);
  });
});

describe("takeAt / removeTake", () => {
  test("finds the take at a spot, and the nearest when two are in reach", () => {
    const near = tk(10.1);
    const found = takeAt([tk(10.2), near, tk(30)], 10.1);
    expect(found).toBe(near);
  });

  test("finds nothing where there is nothing", () => {
    expect(takeAt([tk(10)], 30)).toBeNull();
    expect(takeAt([], 10)).toBeNull();
  });

  test("removes by spot and hands back what went", () => {
    const one = tk(10);
    const { takes, removed } = removeTake([one, tk(30)], 10);
    expect(takes.map(t => t.t1)).toEqual([30]);
    expect(removed).toBe(one);
  });

  test("removing what is not there changes nothing", () => {
    const { takes, removed } = removeTake([tk(10)], 99);
    expect(takes.map(t => t.t1)).toEqual([10]);
    expect(removed).toBeNull();
  });
});

describe("labels", () => {
  test("adds up what was recorded, skipping takes with no length", () => {
    expect(takesDuration([tk(1, { ms: 2000 }), tk(2, { ms: 3500 }), tk(3, { ms: null })])).toBe(5.5);
    expect(takesDuration([])).toBe(0);
  });

  test("places a take within the clip rather than in the video", () => {
    expect(takeOffsetLabel(tk(34.2), 30)).toBe("+4.2s");
    expect(takeOffsetLabel(tk(30), 30)).toBe("+0.0s");
    // Past ten seconds the tenth stops earning its place.
    expect(takeOffsetLabel(tk(75), 30)).toBe("+45s");
  });

  test("says nothing it cannot work out", () => {
    expect(takeOffsetLabel(null, 30)).toBe("");
    expect(takeOffsetLabel(tk(34), NaN)).toBe("");
  });
});
