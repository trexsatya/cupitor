import { translateLines } from "./translate-lines";

describe("translateLines", () => {
  test("returns translations in the same order as the input", async () => {
    const fn = async (t) => t.toUpperCase();
    expect(await translateLines(["a", "b", "c"], fn)).toEqual(["A", "B", "C"]);
  });

  test("passes whitespace-only lines through untouched (no translateFn call)", async () => {
    const seen = [];
    const fn = async (t) => { seen.push(t); return "X"; };
    const out = await translateLines(["hej", "   ", ""], fn);
    expect(out).toEqual(["X", "   ", ""]);
    expect(seen).toEqual(["hej"]);
  });

  test("never runs more than `concurrency` translateFn calls at once", async () => {
    let active = 0;
    let max = 0;
    const fn = (t) =>
      new Promise((res) => {
        active++;
        max = Math.max(max, active);
        setTimeout(() => { active--; res(t); }, 5);
      });
    await translateLines(["1", "2", "3", "4", "5", "6", "7", "8"], fn, { concurrency: 3 });
    expect(max).toBeLessThanOrEqual(3);
    expect(max).toBeGreaterThan(1);
  });
});
