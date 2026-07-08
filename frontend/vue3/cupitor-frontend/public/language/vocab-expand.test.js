import {
  removeHintsInBrackets,
  buildExpansionMap,
  expandWords,
} from "./vocab-expand";

describe("removeHintsInBrackets", () => {
  test("strips a trailing bracket hint (keeping the preceding space)", () => {
    expect(removeHintsInBrackets("hoppa (verb)")).toBe("hoppa ");
  });

  test("strips multiple hints by position", () => {
    expect(removeHintsInBrackets("a (b) c (d) e")).toBe("a  c  e");
  });

  test("handles nested parens innermost-first without leaving orphans", () => {
    expect(removeHintsInBrackets("(x (y))")).toBe("");
  });

  test("applies the fixed replacements ((pl), (ngn), (ngt))", () => {
    expect(removeHintsInBrackets("(pl)")).toBe("");
    expect(removeHintsInBrackets("se (ngt)")).toBe("se [^ ]*");
    expect(removeHintsInBrackets("ge (ngn) något")).toBe("ge .*något");
  });

  test("does not call alert / throw in a non-browser env for balanced input", () => {
    expect(() => removeHintsInBrackets("clean text")).not.toThrow();
    expect(removeHintsInBrackets("clean text")).toBe("clean text");
  });
});

describe("buildExpansionMap", () => {
  test("parses the 'expansions' category into key -> [values]", () => {
    const vocab = { expansions: ["ha=ha,har,hade", "", " ignored line "] };
    expect(buildExpansionMap(vocab)).toEqual({ ha: ["ha", "har", "hade"] });
  });

  test("accepts Expansions / _expansions category names", () => {
    expect(buildExpansionMap({ Expansions: ["x=a,b"] })).toEqual({ x: ["a", "b"] });
    expect(buildExpansionMap({ _expansions: ["y=c"] })).toEqual({ y: ["c"] });
  });

  test("empty / missing category yields empty map", () => {
    expect(buildExpansionMap({})).toEqual({});
    expect(buildExpansionMap(null)).toEqual({});
  });
});

describe("expandWords", () => {
  test("lowercases and passes through a plain pipe list (no <*)", () => {
    expect(expandWords("KÄNNA|känner|kände")).toBe("känna|känner|kände");
  });

  test("expands a <* reference using the provided expansion map", () => {
    expect(expandWords("<*ha", "sv", { ha: ["ha", "har", "hade"] })).toBe(
      " ha |har|hade"
    );
  });

  test("expands <* embedded in a phrase, preserving the trailing words", () => {
    // "<*gå an" is shifted off the work list first, so the untouched "göra"
    // stays ahead of the pushed expansions.
    const out = expandWords("<*gå an|göra", "sv", { "gå": ["gå", "går"] });
    expect(out).toBe("göra|gå an|går an");
  });

  test("falls back to the literal word when no expansion is known", () => {
    expect(expandWords("<*okänt", "sv", {})).toBe("okänt");
  });
});
