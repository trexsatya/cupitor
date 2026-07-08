import {
  flattenVocabEntries,
  buildRareWordRegex,
  buildRareWordPrefilter,
  prefilterHit,
  findRareWords,
} from "./rare-words";

describe("flattenVocabEntries", () => {
  test("flattens categories, dedupes by line (first category wins), drops short lines", () => {
    const vocab = {
      "Cat A": ["känna", "se", "  ", "gå an"],
      "Cat B": ["känna", "annat"],
    };
    expect(flattenVocabEntries(vocab, 3)).toEqual([
      { line: "känna", category: "Cat A" },
      { line: "gå an", category: "Cat A" },
      { line: "annat", category: "Cat B" },
    ]);
  });
});

describe("buildRareWordRegex", () => {
  test("anchors on word boundaries so inflections do not count as the base form", () => {
    const re = buildRareWordRegex("fanatisk");
    expect(re.test("han är fanatisk idag")).toBe(true);
    expect(re.test("han är fanatiskt")).toBe(false); // trailing letter breaks boundary
  });

  test("drops alternatives shorter than minAltLen before compiling", () => {
    const re = buildRareWordRegex("se|sova"); // "se" (len 2) dropped
    expect(re.test("vi ska sova")).toBe(true);
    expect(re.test("jag ser se")).toBe(false); // only "se" present -> no match
  });

  test("returns null when nothing survives the min-length filter", () => {
    expect(buildRareWordRegex("se|ha")).toBeNull();
  });
});

describe("buildRareWordPrefilter", () => {
  test("uses the longest letter-run of each alternative as its signature", () => {
    expect(buildRareWordPrefilter("fanatisk")).toEqual(["fanatisk"]);
    // "se" (len 2) dropped by minAltLen; only "sova" survives
    expect(buildRareWordPrefilter("se|sova")).toEqual(["sova"]);
    // one signature per surviving alternative
    expect(buildRareWordPrefilter("fanatisk|avskyvärd")).toEqual([
      "fanatisk",
      "avskyvärd",
    ]);
  });

  test("returns null (unfilterable) when a kept alternative has no run >= minSigLen", () => {
    expect(buildRareWordPrefilter("gå an")).toBeNull(); // runs gå/an, len 2
    expect(buildRareWordPrefilter("a b c")).toBeNull();
  });

  test("returns null when nothing survives the length filter", () => {
    expect(buildRareWordPrefilter("se|ha")).toBeNull();
  });
});

describe("prefilterHit", () => {
  test("passes when any signature appears in sv or en (case-insensitive input)", () => {
    expect(prefilterHit("han är fanatisk", "", ["fanatisk"])).toBe(true);
    expect(prefilterHit("", "not kindergarten", ["kindergarten"])).toBe(true);
    expect(prefilterHit("inget", "nothing", ["fanatisk", "avsky"])).toBe(false);
  });
});

describe("findRareWords", () => {
  const expand = (line) => line; // identity: lines are already plain

  test("pre-filter does not change results (same as without it)", () => {
    const entries = [
      { line: "fanatisk", category: "C" }, // appears once -> rare
      { line: "vanlig", category: "C" }, // appears twice -> not rare
    ];
    const subs = [
      { sv: "han är Fanatisk idag", en: "" }, // capital F: filter must lowercase
      { sv: "ett vanlig ord", en: "" },
      { sv: "helt vanlig igen", en: "" },
    ];
    const found = findRareWords(entries, subs, 2, { expand });
    expect(found).toEqual([{ line: "fanatisk", category: "C", count: 1 }]);
  });

  test("keeps only words occurring in fewer than `threshold` subtitle files", () => {
    const entries = [
      { line: "sällsynt", category: "C" }, // appears once
      { line: "vanlig", category: "C" }, // appears in two -> not rare at threshold 2
    ];
    const subs = [
      { sv: "det är ett sällsynt ord", en: "" },
      { sv: "ett vanlig ord", en: "" },
      { sv: "helt vanlig igen", en: "" },
    ];
    const found = findRareWords(entries, subs, 2, { expand });
    expect(found).toEqual([{ line: "sällsynt", category: "C", count: 1 }]);
  });

  test("counts a match in either the sv or en column", () => {
    const entries = [{ line: "kindergarten", category: "C" }];
    const subs = [{ sv: "inget här", en: "not kindergarten today" }];
    const found = findRareWords(entries, subs, 2, { expand });
    expect(found[0].count).toBe(1);
  });

  test("sorts by count ascending then line", () => {
    const entries = [
      { line: "bbb", category: "C" },
      { line: "aaa", category: "C" },
    ];
    const subs = [{ sv: "aaa bbb", en: "" }]; // both count 1
    const found = findRareWords(entries, subs, 2, { expand });
    expect(found.map((f) => f.line)).toEqual(["aaa", "bbb"]);
  });
});

describe("findRareWords perAlternative", () => {
  const expand = (line) => line; // identity: lines are already expanded

  test("surfaces a rare alternative bundled with common synonyms in one line", () => {
    // One vocab line mixes a rare idiom with common single-word synonyms.
    const entries = [
      { line: "sålla|sålla agnarna från vetet|sila", category: "Idioms" },
    ];
    const subs = [
      { sv: "vi ska sila kaffet", en: "" },
      { sv: "han vill sila igen", en: "" }, // "sila" in 2 files -> common
      { sv: "att sålla lite", en: "" }, // "sålla" in 1 file -> rare
    ];
    const found = findRareWords(entries, subs, 2, { expand, perAlternative: true });
    // "sila" (2 files) dropped; the rare word and the rare phrase surface individually
    expect(found.map((f) => f.line).sort()).toEqual([
      "sålla",
      "sålla agnarna från vetet",
    ]);
    expect(found.find((f) => f.line === "sålla agnarna från vetet")).toMatchObject({
      category: "Idioms",
      count: 0,
      expanded: "sålla agnarna från vetet", // stored verbatim, not re-expanded
    });
  });

  test("dedupes an alternative shared by two lines (first category wins)", () => {
    const entries = [
      { line: "rara|common", category: "A" },
      { line: "rara|other", category: "B" },
    ];
    const subs = [
      { sv: "common common", en: "" },
      { sv: "common again", en: "" }, // "common" in 2 files -> not rare
    ];
    const found = findRareWords(entries, subs, 2, { expand, perAlternative: true });
    const rara = found.filter((f) => f.line === "rara");
    expect(rara).toHaveLength(1);
    expect(rara[0].category).toBe("A");
    expect(found.map((f) => f.line).sort()).toEqual(["other", "rara"]);
  });
});
