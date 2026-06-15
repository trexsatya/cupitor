import {
  parseVocabularyFile,
  vocabularyToText,
  isProperlyBracketed,
  mergeVocabulary,
} from "./vocab-merge";

describe("parseVocabularyFile", () => {
  test("buckets lines under their #category headers", () => {
    const txt = `#Verbs\n(preserve)|förvara|\n(eat)|äta|\n#Adj\n(big)|stor|`;
    expect(parseVocabularyFile(txt)).toEqual({
      __empty__: [],
      Verbs: ["(preserve)|förvara|", "(eat)|äta|"],
      Adj: ["(big)|stor|"],
    });
  });
  test("lines before the first header land in __empty__", () => {
    const txt = `orphan-line\n#Cat\nvalid-line`;
    expect(parseVocabularyFile(txt)).toEqual({
      __empty__: ["orphan-line"],
      Cat: ["valid-line"],
    });
  });
  test("trims the # off category names", () => {
    const out = parseVocabularyFile(`# With Spaces \nx`);
    expect(Object.keys(out)).toContain("With Spaces");
  });
  test("returns {} for empty input", () => {
    expect(parseVocabularyFile("")).toEqual({});
    expect(parseVocabularyFile(null)).toEqual({});
  });
});

describe("vocabularyToText", () => {
  test("renders categories back with #headers and newlines", () => {
    const vocab = {
      Verbs: ["(preserve)|förvara|", "(eat)|äta|"],
      Adj: ["(big)|stor|"],
    };
    expect(vocabularyToText(vocab)).toBe(
      "#Verbs\n(preserve)|förvara|\n(eat)|äta|\n#Adj\n(big)|stor|"
    );
  });
  test("empty vocab → empty string", () => {
    expect(vocabularyToText({})).toBe("");
  });
  test("preserves category insertion order", () => {
    const vocab = { Z: ["z"], A: ["a"], M: ["m"] };
    const txt = vocabularyToText(vocab);
    expect(txt.indexOf("#Z")).toBeLessThan(txt.indexOf("#A"));
    expect(txt.indexOf("#A")).toBeLessThan(txt.indexOf("#M"));
  });
});

describe("isProperlyBracketed", () => {
  test("accepts well-balanced lines", () => {
    expect(isProperlyBracketed("(spell)|trolla|förtrolla|")).toBe(true);
    expect(isProperlyBracketed("(big)|stor[a]|{x}|")).toBe(true);
    expect(isProperlyBracketed("plain text no brackets")).toBe(true);
  });
  test("rejects unmatched openers", () => {
    expect(isProperlyBracketed("(spell|trolla|")).toBe(false);
  });
  test("rejects unmatched closers", () => {
    expect(isProperlyBracketed("spell)|trolla|")).toBe(false);
  });
  test("rejects mismatched bracket types", () => {
    expect(isProperlyBracketed("(spell]|x|")).toBe(false);
  });
  test("validates each |-segment independently", () => {
    // First segment open, second closes — but parts are checked separately.
    expect(isProperlyBracketed("(spell|trolla)")).toBe(false);
  });
});

describe("mergeVocabulary", () => {
  function text(map) { return vocabularyToText(map); }

  test("preserves user-added lines (in local, not in base/remote)", () => {
    const base = text({ V: ["a"] });
    const local = { V: ["a", "b"] };  // user added 'b'
    const remote = text({ V: ["a"] });
    const out = mergeVocabulary(base, local, remote);
    expect(out.V).toEqual(["a", "b"]);
  });
  test("keeps remote-only additions appended", () => {
    const base = text({ V: ["a"] });
    const local = { V: ["a"] };
    const remote = text({ V: ["a", "remote-new"] });
    const out = mergeVocabulary(base, local, remote);
    expect(out.V).toEqual(["a", "remote-new"]);
  });
  test("drops a line removed locally — even if remote still has it", () => {
    const base = text({ V: ["a", "doomed"] });
    const local = { V: ["a"] };  // user removed 'doomed'
    const remote = text({ V: ["a", "doomed"] });
    const out = mergeVocabulary(base, local, remote);
    expect(out.V).not.toContain("doomed");
  });
  test("drops a line removed remotely (base had it, local kept it as-is)", () => {
    // localLines: ['a', 'gone']
    // gone is in base AND local but NOT remote → not "userAdded", and
    // not "stillInRemote" → dropped from the local pass. Then in remote
    // pass, 'gone' isn't in remoteLines, so it stays gone.
    const base = text({ V: ["a", "gone"] });
    const local = { V: ["a", "gone"] };
    const remote = text({ V: ["a"] });
    const out = mergeVocabulary(base, local, remote);
    expect(out.V).not.toContain("gone");
  });
  test("merges across categories with all three sides contributing", () => {
    const base = text({ V: ["a"], A: ["b"] });
    const local = { V: ["a", "added-local"], A: ["b"], N: ["only-local"] };
    const remote = text({ V: ["a", "added-remote"], A: ["b"], R: ["only-remote"] });
    const out = mergeVocabulary(base, local, remote);
    expect(out.V).toContain("added-local");
    expect(out.V).toContain("added-remote");
    expect(out.N).toEqual(["only-local"]);
    expect(out.R).toEqual(["only-remote"]);
  });
  test("never includes the __empty__ pseudo-category", () => {
    const base = "leading\n#Real\nx";
    const local = parseVocabularyFile(base);
    const remote = base;
    const out = mergeVocabulary(base, local, remote);
    expect(out.__empty__).toBeUndefined();
  });
  test("handles null/undefined inputs as empty", () => {
    const out = mergeVocabulary(null, null, null);
    expect(out).toEqual({});
  });
  test("dedupes within local order", () => {
    const local = { V: ["x", "x", "y"] };
    const out = mergeVocabulary(text({ V: ["x"] }), local, text({ V: ["x"] }));
    expect(out.V).toEqual(["x", "y"]);
  });
});
