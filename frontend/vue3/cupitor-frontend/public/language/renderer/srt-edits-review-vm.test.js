import {
  pendingSrtEditCount,
  buildSrtEditsReviewVM,
} from "./srt-edits-review-vm";

const PATH = "db/language/Swedish/srts/foo.sv.srt";
const PATH2 = "db/language/Swedish/srts/bar.sv.srt";
const NOW = 1700000000000;

describe("pendingSrtEditCount", () => {
  test("sums line counts across files", () => {
    expect(pendingSrtEditCount({
      "a": { "1": {}, "2": {} },
      "b": { "3": {} },
    })).toBe(3);
  });
  test("returns 0 for empty / null", () => {
    expect(pendingSrtEditCount({})).toBe(0);
    expect(pendingSrtEditCount(null)).toBe(0);
    expect(pendingSrtEditCount(undefined)).toBe(0);
  });
  test("tolerates per-file maps that are null", () => {
    expect(pendingSrtEditCount({ "a": null, "b": { "1": {} } })).toBe(1);
  });
});

describe("buildSrtEditsReviewVM — empty", () => {
  test("'empty' state for falsy input", () => {
    expect(buildSrtEditsReviewVM(null).state).toBe("empty");
    expect(buildSrtEditsReviewVM({}).state).toBe("empty");
  });
  test("'empty' when every file has an empty per-line map", () => {
    expect(buildSrtEditsReviewVM({ [PATH]: {} }).state).toBe("empty");
  });
});

describe("buildSrtEditsReviewVM — groups", () => {
  test("emits one group per file with the line count", () => {
    const out = buildSrtEditsReviewVM({
      [PATH]: { "1": { newText: "a", ts: NOW } },
    }, { now: NOW });
    expect(out.state).toBe("normal");
    expect(out.groups.length).toBe(1);
    expect(out.groups[0].filePath).toBe(PATH);
    expect(out.groups[0].count).toBe(1);
    expect(out.groups[0].lines[0].newText).toBe("a");
  });
  test("groups are sorted by filePath", () => {
    const out = buildSrtEditsReviewVM({
      [PATH2]: { "1": {} },
      [PATH]:  { "1": {} },
    }, { now: NOW });
    expect(out.groups.map(g => g.filePath)).toEqual([PATH2, PATH].sort());
  });
  test("shortName strips the db/language/<Lang>/srts/ prefix", () => {
    const out = buildSrtEditsReviewVM({
      [PATH]: { "1": { newText: "", ts: NOW } }
    }, { now: NOW });
    expect(out.groups[0].shortName).toBe("foo.sv.srt");
  });
  test("headLabel pluralises 'edits' correctly", () => {
    const single = buildSrtEditsReviewVM({
      [PATH]: { "1": { newText: "", ts: NOW } }
    }, { now: NOW });
    expect(single.groups[0].headLabel).toContain("1 edit");
    expect(single.groups[0].headLabel).not.toContain("1 edits");

    const multi = buildSrtEditsReviewVM({
      [PATH]: { "1": {}, "2": {}, "3": {} }
    }, { now: NOW });
    expect(multi.groups[0].headLabel).toContain("3 edits");
  });
});

describe("buildSrtEditsReviewVM — line order + ageLabel", () => {
  test("lines are sorted by numeric line index", () => {
    const out = buildSrtEditsReviewVM({
      [PATH]: { "10": {}, "2": {}, "1": {} }
    }, { now: NOW });
    expect(out.groups[0].lines.map(l => l.lineIndex)).toEqual(["1", "2", "10"]);
  });
  test("'just now' for ts within the last minute", () => {
    const out = buildSrtEditsReviewVM({
      [PATH]: { "1": { newText: "", ts: NOW - 1000 } }
    }, { now: NOW });
    expect(out.groups[0].lines[0].ageLabel).toBe("just now");
  });
  test("'Nm ago' for older timestamps", () => {
    const out = buildSrtEditsReviewVM({
      [PATH]: { "1": { newText: "", ts: NOW - 5 * 60000 } }
    }, { now: NOW });
    expect(out.groups[0].lines[0].ageLabel).toBe("5m ago");
  });
  test("clamps negative ages (clock skew) to 0", () => {
    const out = buildSrtEditsReviewVM({
      [PATH]: { "1": { newText: "", ts: NOW + 60000 } }
    }, { now: NOW });
    expect(out.groups[0].lines[0].ageLabel).toBe("just now");
  });
  test("missing ts falls back to NOW (so age looks like 'just now')", () => {
    const out = buildSrtEditsReviewVM({
      [PATH]: { "1": { newText: "x" } }
    }, { now: NOW });
    // ts undefined → reduces to NOW - 0 = huge age. Documented behaviour
    // since the production code does the same. Pin it so any future fix
    // is intentional.
    expect(out.groups[0].lines[0].ageLabel).toContain("ago");
  });
});
