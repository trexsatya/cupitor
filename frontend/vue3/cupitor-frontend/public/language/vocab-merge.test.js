import {
  parseVocabularyFile,
  vocabularyToText,
  isProperlyBracketed,
  mergeVocabulary,
  removeVocabularyLine,
  vocabPendingHintText,
} from "./vocab-merge";
import {
  mergeVocabularyLayers,
  withoutReadOnlyLines,
  pendingVocabCategories,
  relayerVocabulary,
} from "./data-source";

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
  test("headers named like Object.prototype keys are ordinary categories", () => {
    const out = parseVocabularyFile(`#toString\na\n#constructor\nb\n#__proto__\nc\n#hasOwnProperty\nd`);
    expect(Object.keys(out)).toEqual(["__empty__", "toString", "constructor", "__proto__", "hasOwnProperty"]);
    expect(out.toString).toEqual(["a"]);
    expect(out.constructor).toEqual(["b"]);
    expect(out["__proto__"]).toEqual(["c"]);
    expect(JSON.parse(JSON.stringify(out)).__proto__).toEqual(["c"]);
    expect(vocabularyToText(out)).toBe("#__empty__\n\n#toString\na\n#constructor\nb\n#__proto__\nc\n#hasOwnProperty\nd");
  });
});

describe("mergeVocabulary with prototype-named categories", () => {
  test("keeps them, from parsed text and from a plain local object", () => {
    const remote = `#toString\nr\n#__proto__\np`;
    const local = { constructor: ["l"] }; // plain object, as window.vocabulary = {} starts
    const out = mergeVocabulary("", local, remote);
    expect(Object.keys(out).sort()).toEqual(["__proto__", "constructor", "toString"]);
    expect(out.toString).toEqual(["r"]);
    expect(out["__proto__"]).toEqual(["p"]);
    expect(out.constructor).toEqual(["l"]);
  });
  test("a plain local object without the category does not read its prototype", () => {
    const out = mergeVocabulary(`#toString\nx`, {}, `#toString\nx`);
    expect(out.toString).toEqual([]);
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

describe("removeVocabularyLine", () => {
  const none = new Set();

  test("removes the line from its category and leaves the input unchanged", () => {
    const vocab = { V: ["a", "b", "c"], A: ["x"] };
    const res = removeVocabularyLine(vocab, none, "V", "b");
    expect(res.reason).toBeUndefined();
    expect(res.vocab.V).toEqual(["a", "c"]);
    expect(res.vocab.A).toBe(vocab.A);
    expect(Object.keys(res.vocab)).toEqual(["V", "A"]);
    expect(vocab.V).toEqual(["a", "b", "c"]);
  });
  test("removes only the chosen copy of a repeated line", () => {
    const vocab = { V: ["a", "dup", "b", "dup"] };
    expect(removeVocabularyLine(vocab, none, "V", "dup").vocab.V).toEqual(["a", "b", "dup"]);
    expect(removeVocabularyLine(vocab, none, "V", "dup", 1).vocab.V).toEqual(["a", "dup", "b"]);
    expect(removeVocabularyLine(vocab, none, "V", "dup", 2)).toEqual({ reason: "not-found" });
  });
  test("leaves the same text in another category alone", () => {
    const vocab = { V: ["same"], A: ["same"] };
    const res = removeVocabularyLine(vocab, none, "A", "same");
    expect(res.vocab).toEqual({ V: ["same"], A: [] });
  });
  test("keeps a category emptied by the removal", () => {
    const res = removeVocabularyLine({ V: ["only"], A: ["x"] }, none, "V", "only");
    expect(res.vocab).toEqual({ V: [], A: ["x"] });
  });
  test("refuses the other user's (read-only) line", () => {
    const vocab = { V: ["mine", "theirs"] };
    expect(removeVocabularyLine(vocab, new Set(["theirs"]), "V", "theirs")).toEqual({ reason: "read-only" });
  });
  test("refuses a blank or missing line", () => {
    expect(removeVocabularyLine({ V: ["", "a"] }, none, "V", "")).toEqual({ reason: "blank" });
    expect(removeVocabularyLine({ V: ["a"] }, none, "V", "   ")).toEqual({ reason: "blank" });
    expect(removeVocabularyLine({ V: ["a"] }, none, "V", undefined)).toEqual({ reason: "blank" });
  });
  test("refuses a line that isn't in that category, or an unknown category", () => {
    expect(removeVocabularyLine({ V: ["a"], A: ["b"] }, none, "V", "b")).toEqual({ reason: "not-found" });
    expect(removeVocabularyLine({ V: ["a"] }, none, "Nope", "a")).toEqual({ reason: "not-found" });
    expect(removeVocabularyLine({ V: ["a"] }, none, "toString", "a")).toEqual({ reason: "not-found" });
  });
  test("works on a map without a prototype", () => {
    const vocab = parseVocabularyFile("#V\na\nb");
    expect(removeVocabularyLine(vocab, none, "V", "a").vocab.V).toEqual(["b"]);
  });
});

describe("a deleted line through save and reload", () => {
  const base = "#V\na\ndoomed\nc\n#A\nx";

  test("stays deleted when remote is unchanged", () => {
    const local = removeVocabularyLine(parseVocabularyFile(base), new Set(), "V", "doomed").vocab;
    const out = mergeVocabulary(base, local, base);
    expect(out.V).toEqual(["a", "c"]);
    expect(out.A).toEqual(["x"]);
  });
  test("keeps a line someone else added on remote meanwhile", () => {
    const local = removeVocabularyLine(parseVocabularyFile(base), new Set(), "V", "doomed").vocab;
    const remote = "#V\na\ndoomed\nc\nfrom-remote\n#A\nx";
    const out = mergeVocabulary(base, local, remote);
    expect(out.V).toEqual(["a", "c", "from-remote"]);
  });
  test("an emptied category keeps its header in the saved text", () => {
    const b = "#V\nonly\n#A\nx";
    const local = removeVocabularyLine(parseVocabularyFile(b), new Set(), "V", "only").vocab;
    const out = mergeVocabulary(b, local, b);
    expect(out.V).toEqual([]);
    expect(vocabularyToText(out)).toBe("#V\n\n#A\nx");
  });
  test("the unsaved-edits buffer holds the category without the line, even when emptied", () => {
    const layered = mergeVocabularyLayers("#V\nonly\n#A\nx", null);
    const local = removeVocabularyLine(layered.vocab, layered.readOnly, "V", "only").vocab;
    const buf = pendingVocabCategories(local, ["V"], layered.readOnly, layered.otherCategories);
    expect(Object.keys(buf)).toEqual(["V"]);
    expect(buf.V).toEqual([]);
  });
  test("the other user's lines never reach the save", () => {
    const layered = mergeVocabularyLayers("#V\nmine\ngone", "#V\ntheirs\n#O\nother-only");
    const local = removeVocabularyLine(layered.vocab, layered.readOnly, "V", "gone").vocab;
    const own = withoutReadOnlyLines(local, layered.readOnly, layered.otherCategories);
    expect(own).toEqual({ V: ["mine"] });
  });
  test("the other user's identical line shows again, read-only, after the layers are rebuilt", () => {
    // Self and other both have "shared": only self's copy is shown (editable).
    const layered = mergeVocabularyLayers("#V\nshared\nmine", "#V\nshared");
    expect(layered.readOnly.has("shared")).toBe(false);
    const local = removeVocabularyLine(layered.vocab, layered.readOnly, "V", "shared").vocab;
    expect(local.V).toEqual(["mine"]);
    const re = relayerVocabulary(local, layered.readOnly, layered.otherCategories, "#V\nshared");
    expect(re.vocab.V).toEqual(["mine", "shared"]);
    expect(re.readOnly.has("shared")).toBe(true);
    // ...and is still kept out of the save.
    expect(withoutReadOnlyLines(re.vocab, re.readOnly, re.otherCategories)).toEqual({ V: ["mine"] });
  });
});

describe("vocabPendingHintText", () => {
  test("names additions and deletions", () => {
    expect(vocabPendingHintText(2, 0)).toBe("unsaved changes pending — 2 new entries — Save & Close to commit");
    expect(vocabPendingHintText(1, 0)).toBe("unsaved changes pending — 1 new entry — Save & Close to commit");
    expect(vocabPendingHintText(0, 1)).toBe("unsaved changes pending — 1 deleted — Save & Close to commit");
    expect(vocabPendingHintText(3, 2)).toBe("unsaved changes pending — 3 new entries, 2 deleted — Save & Close to commit");
  });
  test("gives no number when none is known", () => {
    expect(vocabPendingHintText(0, 0)).toBe("unsaved changes pending — Save & Close to commit");
    expect(vocabPendingHintText(undefined, "x")).toBe("unsaved changes pending — Save & Close to commit");
    expect(vocabPendingHintText(-1, null)).toBe("unsaved changes pending — Save & Close to commit");
  });
});
