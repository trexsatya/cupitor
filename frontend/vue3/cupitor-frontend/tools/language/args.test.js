import { parseArgs, coerceFlags, matchCategory, mergeRareByCategory } from "./args.js";

describe("matchCategory", () => {
  test("no filter matches everything", () => {
    expect(matchCategory("Feelings, emotions", "")).toBe(true);
    expect(matchCategory("Feelings, emotions", undefined)).toBe(true);
  });

  test("case-insensitive substring match (category names contain commas)", () => {
    expect(matchCategory("Feelings, emotions", "feelings")).toBe(true);
    expect(matchCategory("Crimes, Law, Rules, Punishments", "crimes")).toBe(true);
    expect(matchCategory("Feelings, emotions", "Feelings, emotions")).toBe(true);
  });

  test("non-matching category is rejected", () => {
    expect(matchCategory("Nature, Plants", "feelings")).toBe(false);
  });
});

describe("mergeRareByCategory", () => {
  const existing = [
    { line: "old-feel", category: "Feelings, emotions", count: 1 },
    { line: "keep-nature", category: "Nature, Plants", count: 1 },
    { line: "gone-feel", category: "Feelings, emotions", count: 1 },
  ];
  const fresh = [{ line: "new-feel", category: "Feelings, emotions", count: 0 }];

  test("replaces only the filtered category, keeps the rest", () => {
    const out = mergeRareByCategory(existing, fresh, "feelings");
    expect(out.map((e) => e.line)).toEqual(["keep-nature", "new-feel"]);
  });

  test("with no existing file, returns the fresh results", () => {
    expect(mergeRareByCategory([], fresh, "feelings")).toEqual(fresh);
  });

  test("substring filter drops every matching existing category", () => {
    const out = mergeRareByCategory(
      [
        { line: "a", category: "Crimes, Law, Rules" },
        { line: "b", category: "Nature" },
      ],
      [{ line: "c", category: "Crimes, Law, Rules" }],
      "crimes"
    );
    expect(out.map((e) => e.line)).toEqual(["b", "c"]);
  });
});

describe("parseArgs", () => {
  test("splits command and --key value / --key=value / boolean flags", () => {
    const { command, flags } = parseArgs([
      "filmot",
      "--chunk",
      "10",
      "--max=5",
      "--reset",
      "--words",
      "a,b,c",
    ]);
    expect(command).toBe("filmot");
    expect(flags).toEqual({
      chunk: "10",
      max: "5",
      reset: true,
      words: "a,b,c",
    });
  });

  test("no command yields empty command", () => {
    expect(parseArgs([]).command).toBe("");
  });
});

describe("coerceFlags", () => {
  test("maps CLI flags to numeric/list config overrides", () => {
    const cfg = coerceFlags({
      threshold: "3",
      max: "7",
      before: "2",
      after: "4",
      chunk: "15",
      words: "gå, springa ,åka",
    });
    expect(cfg).toEqual({
      rareThreshold: 3,
      maxItemsPerWord: 7,
      linesBefore: 2,
      linesAfter: 4,
      chunk: 15,
      words: ["gå", "springa", "åka"],
    });
  });

  test("maps --maxPages to numeric maxSearchPages", () => {
    expect(coerceFlags({ maxPages: "4" })).toEqual({ maxSearchPages: 4 });
  });

  test("ignores unknown flags and leaves booleans", () => {
    expect(coerceFlags({ reset: true, unknown: "x" })).toEqual({ reset: true });
  });
});
