import { selectChunk, progressSummary } from "./progress.js";

describe("selectChunk", () => {
  test("returns the next `size` pending keys, preserving order", () => {
    const all = ["a", "b", "c", "d", "e"];
    expect(selectChunk(all, ["a", "c"], 2)).toEqual(["b", "d"]);
  });

  test("returns all pending when size <= 0", () => {
    expect(selectChunk(["a", "b", "c"], ["b"], 0)).toEqual(["a", "c"]);
  });

  test("accepts a Set of done keys", () => {
    expect(selectChunk(["a", "b", "c"], new Set(["a"]), 10)).toEqual(["b", "c"]);
  });

  test("empty when everything is done", () => {
    expect(selectChunk(["a", "b"], ["a", "b"], 5)).toEqual([]);
  });
});

describe("progressSummary", () => {
  test("counts total / done / pending (done intersected with all)", () => {
    expect(progressSummary(["a", "b", "c"], ["a", "x"])).toEqual({
      total: 3,
      done: 1,
      pending: 2,
    });
  });
});
