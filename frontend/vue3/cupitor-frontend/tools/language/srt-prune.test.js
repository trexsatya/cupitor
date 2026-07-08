import {
  srtSpanSeconds,
  isFullSrt,
  scanItemOwners,
  uniqueOwnerSrts,
  greedyRemovable,
  mergeRanges,
  srtKeepRanges,
  applyRanges,
  greedyCover,
  scanUncoveredOwners,
} from "./srt-prune.js";

const snippet = `1
00:09:36,000 --> 00:09:38,000
en rad

2
00:09:40,000 --> 00:09:46,000
till rad
`;

const fullTranscript = `1
00:00:10,000 --> 00:00:12,000
hej

2
00:02:00,000 --> 00:02:05,000
hej då
`;

describe("srtSpanSeconds / isFullSrt", () => {
  test("span is last end minus first start", () => {
    expect(srtSpanSeconds(fullTranscript)).toBeCloseTo(115, 3); // 125 - 10
    expect(srtSpanSeconds(snippet)).toBeCloseTo(10, 3); // 586 - 576
  });

  test("no timestamps -> null span, not full", () => {
    expect(srtSpanSeconds("just text, no times")).toBeNull();
    expect(isFullSrt("just text", { minSpanSec: 60 })).toBe(false);
  });

  test("full = duration longer than minSpanSec (default 60s)", () => {
    expect(isFullSrt(fullTranscript)).toBe(true); // 115s > 60
    expect(isFullSrt(snippet)).toBe(false); // 10s span
    expect(isFullSrt(fullTranscript, { minSpanSec: 200 })).toBe(false); // tunable
  });
});

describe("scanItemOwners", () => {
  const items = [
    { key: "alpha", expanded: "alpha" },
    { key: "beta", expanded: "beta" },
    { key: "gamma", expanded: "gamma" },
  ];
  const docs = [
    { name: "A", sv: "the alpha and beta", en: "" },
    { name: "B", sv: "alpha only", en: "" },
    { name: "C", sv: "", en: "gamma here" }, // matches en column
  ];

  test("maps each item to the srts containing it (either column)", () => {
    const owners = scanItemOwners(items, docs);
    expect(owners.get("alpha").sort()).toEqual(["A", "B"]);
    expect(owners.get("beta")).toEqual(["A"]);
    expect(owners.get("gamma")).toEqual(["C"]);
  });

  test("stops recording owners at maxOwners", () => {
    const owners = scanItemOwners([{ key: "xxx", expanded: "xxx" }], [
      { name: "A", sv: "xxx", en: "" },
      { name: "B", sv: "xxx", en: "" },
      { name: "C", sv: "xxx", en: "" },
      { name: "D", sv: "xxx", en: "" },
    ], { maxOwners: 3 });
    expect(owners.get("xxx")).toHaveLength(3);
  });
});

describe("uniqueOwnerSrts", () => {
  test("flags srts that are the sole owner of some item", () => {
    const owners = new Map([
      ["alpha", ["A", "B"]],
      ["beta", ["A"]],
      ["gamma", ["C"]],
    ]);
    expect([...uniqueOwnerSrts(owners)].sort()).toEqual(["A", "C"]);
  });
});

describe("greedyRemovable", () => {
  test("never removes a sole owner; keeps coverage when two candidates share the only item", () => {
    const owners = new Map([
      ["alpha", ["A", "B"]],
      ["beta", ["A"]], // A uniquely owns beta
      ["gamma", ["C"]], // C uniquely owns gamma
    ]);
    const { removable, kept } = greedyRemovable(["A", "B", "C"], owners);
    expect(removable).toEqual(["B"]);
    expect(kept.sort()).toEqual(["A", "C"]);
  });

  test("of two candidates sharing an item owned by exactly them, only one is removed", () => {
    const owners = new Map([["pair", ["A", "B"]]]);
    const { removable, kept } = greedyRemovable(["A", "B"], owners);
    expect(removable).toEqual(["A"]);
    expect(kept).toEqual(["B"]);
  });

  test("items with >= maxOwners are abundant and never block removal", () => {
    const owners = new Map([["common", ["A", "B", "C"]]]); // >=3 owners
    const { removable } = greedyRemovable(["A", "B"], owners, { maxOwners: 3 });
    expect(removable.sort()).toEqual(["A", "B"]); // both removable
  });
});

const bigSrt = `1
00:00:00,000 --> 00:00:02,000
alpha rad

2
00:00:02,000 --> 00:00:04,000
beta rad

3
00:00:04,000 --> 00:00:06,000
HIT here

4
00:00:06,000 --> 00:00:08,000
gamma rad

5
00:00:08,000 --> 00:00:10,000
delta rad
`;

describe("mergeRanges", () => {
  test("merges overlapping/adjacent second-ranges", () => {
    expect(mergeRanges([{ start: 0, end: 5 }, { start: 3, end: 8 }, { start: 10, end: 12 }])).toEqual([
      { start: 0, end: 8 },
      { start: 10, end: 12 },
    ]);
  });
});

describe("srtKeepRanges / applyRanges", () => {
  test("keeps a ±window of entries around each match, dropping the rest", () => {
    const ranges = srtKeepRanges(bigSrt, [/hit/i], { before: 1, after: 1 });
    expect(ranges).toEqual([{ start: 2, end: 8 }]); // entries 2..4 (start@2, end@8)
    const shrunk = applyRanges(bigSrt, ranges);
    // entries 2,3,4 kept; renumbered 1..3; entries 1 and 5 dropped
    expect(shrunk).toContain("beta rad");
    expect(shrunk).toContain("HIT here");
    expect(shrunk).toContain("gamma rad");
    expect(shrunk).not.toContain("alpha rad");
    expect(shrunk).not.toContain("delta rad");
    expect(shrunk.startsWith("1\n")).toBe(true); // renumbered from 1
  });

  test("no matching regex -> empty ranges -> empty output", () => {
    expect(srtKeepRanges(bigSrt, [/nomatch/i])).toEqual([]);
    expect(applyRanges(bigSrt, [])).toBe("");
  });

  test("firstPerRegex keeps only the first occurrence's window per regex", () => {
    // "rad" appears in entries 1,2,4,5 (0-based 0,1,3,4). Default keeps windows
    // around all of them; firstPerRegex keeps only the first.
    const all = srtKeepRanges(bigSrt, [/rad/i], { before: 0, after: 0 });
    const first = srtKeepRanges(bigSrt, [/rad/i], { before: 0, after: 0, firstPerRegex: true });
    expect(all.length).toBeGreaterThan(1);
    expect(first).toEqual([{ start: 0, end: 2 }]); // only entry 0's window (0..2s)
  });
});

describe("greedyCover", () => {
  test("covers every item using the fewest transcripts (most-coverage first)", () => {
    const itemOwners = new Map([
      ["a", ["T1"]],
      ["b", ["T1", "T2"]],
      ["c", ["T2", "T3"]],
    ]);
    const assignment = greedyCover(itemOwners);
    // T1 covers {a,b}; then c needs T2 or T3
    expect(assignment.get("T1").sort()).toEqual(["a", "b"]);
    expect([...assignment.keys()].includes("T2") || [...assignment.keys()].includes("T3")).toBe(true);
    // every item assigned exactly once
    const assigned = [...assignment.values()].flat().sort();
    expect(assigned).toEqual(["a", "b", "c"]);
  });
});

describe("scanUncoveredOwners", () => {
  const items = [
    { key: "alpha", expanded: "alpha" },
    { key: "beta", expanded: "beta" },
    { key: "gamma", expanded: "gamma" },
  ];
  const snippets = [{ name: "S1", sv: "alpha here", en: "" }]; // covers alpha
  const transcripts = [
    { name: "T1", sv: "beta and gamma", en: "" },
    { name: "T2", sv: "gamma again", en: "" },
  ];

  test("maps only items missing from every snippet to their transcript owners", () => {
    const m = scanUncoveredOwners(items, snippets, transcripts);
    expect(m.has("alpha")).toBe(false); // covered by a snippet
    expect(m.get("beta")).toEqual(["T1"]);
    expect(m.get("gamma").sort()).toEqual(["T1", "T2"]);
  });
});
