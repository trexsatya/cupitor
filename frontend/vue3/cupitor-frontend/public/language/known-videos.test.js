import { knownVideos } from "./known-videos";

const srts = [
  { link: "aaaaaaaaaaa", name: "One", source: "YouTube", src: "self" },
  { link: "bbbbbbbbbbb", name: "Two", source: "YouTube", src: "other", readOnly: true },
  // Seeded into window.srts by a buffered capture, not read from the index.
  { link: "ccccccccccc", name: "Three", source: "YouTube" },
];
const captured = [
  { id: "x", capturedAt: 1, detail: { videoId: "ccccccccccc", lines: [] } },
  { id: "y", capturedAt: 2, detail: { videoId: "aaaaaaaaaaa" } },
];
const ids = JSON.stringify(["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd"]);

describe("knownVideos", () => {
  test("not ready reports nothing", () => {
    expect(knownVideos(ids, { ready: false, srts, captured }))
      .toEqual({ ready: false, library: [], pending: [] });
  });
  test("splits ids into library (both layers) and pending; pending wins", () => {
    expect(knownVideos(ids, { ready: true, srts, captured })).toEqual({
      ready: true,
      library: ["bbbbbbbbbbb"],
      // In the order asked.
      pending: ["aaaaaaaaaaa", "ccccccccccc"],
    });
  });
  test("an entry only seeded by a capture is not in the library", () => {
    expect(knownVideos(JSON.stringify(["ccccccccccc"]), { ready: true, srts, captured: [] }))
      .toEqual({ ready: true, library: [], pending: [] });
  });
  test("a seeded entry pushed this session is in the library", () => {
    const pushed = [{ link: "ccccccccccc", name: "Three", source: "YouTube", pushed: true }];
    expect(knownVideos(JSON.stringify(["ccccccccccc"]), { ready: true, srts: pushed, captured: [] }))
      .toEqual({ ready: true, library: ["ccccccccccc"], pending: [] });
  });
  test("bad input is treated as no ids", () => {
    expect(knownVideos("not json", { ready: true, srts, captured }))
      .toEqual({ ready: true, library: [], pending: [] });
    expect(knownVideos('{"a":1}', { ready: true, srts, captured }).library).toEqual([]);
    expect(knownVideos(JSON.stringify([1, null, "bbbbbbbbbbb"]), { ready: true, srts, captured }).library)
      .toEqual(["bbbbbbbbbbb"]);
  });
  test("tolerates missing or malformed index and buffer", () => {
    expect(knownVideos(ids, { ready: true, srts: undefined, captured: [null, {}, { detail: null }] }))
      .toEqual({ ready: true, library: [], pending: [] });
  });
});
