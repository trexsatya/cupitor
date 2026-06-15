import {
  tierLabel,
  tierClass,
  similarGroupHeader,
  similarSegmentHeader,
  diffPrefixHeader,
  diffPrefixRowBadge,
} from "./similar-matches-vm";

describe("tierLabel", () => {
  test("tier 0 → 'homophone'", () => expect(tierLabel(0)).toBe("homophone"));
  test("tier 1 → 'vowel diff'", () => expect(tierLabel(1)).toBe("vowel diff"));
  test("tier 2 → 'consonant diff'", () => expect(tierLabel(2)).toBe("consonant diff"));
  test("tier 3 includes the distance", () => expect(tierLabel(3, 2)).toBe("edit dist 2"));
});

describe("tierClass", () => {
  test("tier 0", () => expect(tierClass(0)).toBe("similar-tier-0"));
  test("tier 1", () => expect(tierClass(1)).toBe("similar-tier-1"));
  test("tier 2", () => expect(tierClass(2)).toBe("similar-tier-2"));
  test("tier 3 includes the distance", () => expect(tierClass(3, 2)).toBe("similar-tier-3-d2"));
});

describe("similarGroupHeader", () => {
  test("emits all the fields the renderer needs", () => {
    const out = similarGroupHeader({
      bestMatch: { tier: 0, distance: 0, searchWord: "jul" },
      lines: [{}, {}, {}],
      candidate: "hjul",
    });
    expect(out).toEqual({
      candidate: "hjul",
      searchWord: "jul",
      label: "homophone",
      lineCount: 3,
      plural: "s",
      tierClass: "similar-tier-0",
    });
  });
  test("singular for 1 line", () => {
    const out = similarGroupHeader({
      bestMatch: { tier: 1, distance: 1, searchWord: "kat" },
      lines: [{}],
      candidate: "kit",
    });
    expect(out.plural).toBe("");
    expect(out.lineCount).toBe(1);
  });
  test("tier 3 with distance", () => {
    const out = similarGroupHeader({
      bestMatch: { tier: 3, distance: 2, searchWord: "kat" },
      lines: [{}, {}],
      candidate: "kort",
    });
    expect(out.label).toBe("edit dist 2");
    expect(out.tierClass).toBe("similar-tier-3-d2");
  });
});

describe("similarSegmentHeader", () => {
  test("emits the renderer fields", () => {
    const out = similarSegmentHeader({
      category: "Verbs", candidate: "hjul", searchWord: "jul", tier: 0,
    });
    expect(out).toEqual({
      category: "Verbs",
      candidate: "hjul",
      searchWord: "jul",
      label: "homophone",
      tierClass: "similar-tier-0",
    });
  });
  test("missing category defaults to '?'", () => {
    expect(similarSegmentHeader({ tier: 0 }).category).toBe("?");
  });
});

describe("diffPrefixHeader", () => {
  test("returns stem + origPrefix + searchText", () => {
    expect(diffPrefixHeader({ stem: "vara", origPrefix: "be", searchText: "bevara" }))
      .toEqual({ stem: "vara", origPrefix: "be", searchText: "bevara" });
  });
  test("defaults for missing values", () => {
    expect(diffPrefixHeader({}))
      .toEqual({ stem: "?", origPrefix: "", searchText: "" });
  });
});

describe("diffPrefixRowBadge", () => {
  test("prefix kind → '(<prefix>-)'", () => {
    expect(diffPrefixRowBadge({ kind: "prefix", prefix: "för", category: "Verbs" }))
      .toEqual({ category: "Verbs", badge: "(för-)" });
  });
  test("overlap kind → '(suffix overlap)'", () => {
    expect(diffPrefixRowBadge({ kind: "overlap", category: "Food" }))
      .toEqual({ category: "Food", badge: "(suffix overlap)" });
  });
  test("missing category defaults to '?'", () => {
    expect(diffPrefixRowBadge({ kind: "overlap" }).category).toBe("?");
  });
});
