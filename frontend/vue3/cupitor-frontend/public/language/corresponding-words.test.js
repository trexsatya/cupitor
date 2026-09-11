import {
  EVERYTHING_ELSE,
  tokenizeLine,
  documentFrequencies,
  isCognate,
  wordMatches,
  lineContainsWord,
  guessCorrespondingWords,
  groupResultsByWord,
  capGroups,
} from "./corresponding-words";

// 'han' is a stop word in the real list; the rest of these are not.
const STOP = new Set(["han", "det", "är", "att", "och", "som"]);

describe("tokenizeLine", () => {
  it("keeps accented letters and words joined by an apostrophe", () => {
    expect(tokenizeLine("Han är förvånad — det's så!")).toEqual(
      ["han", "är", "förvånad", "det's", "så"]);
  });

  it("is empty for nothing to say", () => {
    expect(tokenizeLine("")).toEqual([]);
    expect(tokenizeLine(null)).toEqual([]);
    expect(tokenizeLine("...")).toEqual([]);
  });
});

describe("documentFrequencies", () => {
  // A word repeated inside one line is one piece of evidence, not three.
  it("counts lines, not occurrences", () => {
    const freq = documentFrequencies(["just just just", "just nu"]);
    expect(freq.get("just")).toBe(2);
    expect(freq.get("nu")).toBe(1);
  });
});

describe("isCognate", () => {
  it("accepts a shared root and rejects a shared start", () => {
    expect(isCognate("precis", "precisely")).toBe(true);
    expect(isCognate("exakt", "exactly")).toBe(false);   // diverges at char 4
    expect(isCognate("natur", "nature")).toBe(true);
    expect(isCognate("prat", "precisely")).toBe(false);
    expect(isCognate("på", "possibly")).toBe(false);     // too short to judge
  });
});

describe("wordMatches", () => {
  // A line may carry an ending the candidate does not.
  it("allows a short ending on a long enough candidate", () => {
    expect(wordMatches("precisa", "precis")).toBe(true);
    expect(wordMatches("precisionen", "precis")).toBe(false);  // ending too long
    expect(wordMatches("just", "just")).toBe(true);
  });

  // The allowance scales, so a short candidate can't swallow a longer word
  // that merely starts the same way. These are different words, not endings.
  it("does not let a short candidate claim a longer word", () => {
    expect(wordMatches("hands", "hand")).toBe(true);
    expect(wordMatches("handel", "hand")).toBe(false);
    expect(wordMatches("handske", "hand")).toBe(false);
    expect(wordMatches("justera", "just")).toBe(false);
  });

  it("finds a word in a line without matching inside another", () => {
    expect(lineContainsWord("han kom just nu", "just")).toBe(true);
    expect(lineContainsWord("justering av priset", "just")).toBe(false);
  });
});

describe("guessCorrespondingWords", () => {
  // The worked example: three Swedish lines paired with English "precisely".
  const lines = [
    "han kom just nu xyz",
    "han gjorde just det abc",
    "precis så var det",
  ];

  it("makes a group of the word that repeats, and nothing of the singletons", () => {
    const out = guessCorrespondingWords({
      lines, searchWord: "precisely", stopWords: STOP,
    });
    expect(out.map(c => c.word)).toEqual(["just", "precis"]);
    // 'just' by repetition, 'precis' only because it looks like the English.
    expect(out[0].reasons).toEqual(["repeated"]);
    expect(out[1].reasons).toEqual(["cognate"]);
    // 'han' repeats just as often and is excluded only by the stop list.
    expect(out.some(c => c.word === "han")).toBe(false);
    // Singletons carrying no other signal stay out.
    expect(out.some(c => c.word === "xyz")).toBe(false);
  });

  it("without the cognate signal, only the repeated word forms a group", () => {
    const out = guessCorrespondingWords({ lines, searchWord: "", stopWords: STOP });
    expect(out.map(c => c.word)).toEqual(["just"]);
  });

  // A word the translator or the vocabulary offers is worth searching for even
  // when the results at hand never use it.
  it("keeps a translated or vocabulary word that appears in no line", () => {
    const out = guessCorrespondingWords({
      lines, searchWord: "precisely", stopWords: STOP,
      translatedWords: ["noggrant"], vocabWords: ["alldeles"],
    });
    const byWord = Object.fromEntries(out.map(c => [c.word, c]));
    expect(byWord.noggrant.docCount).toBe(0);
    expect(byWord.alldeles.docCount).toBe(0);
    // The translator outranks the vocabulary, and both outrank anything read
    // off the lines themselves.
    expect(out.map(c => c.word).slice(0, 3)).toEqual(["noggrant", "alldeles", "just"]);
  });

  it("respects the cap and drops words too short to mean anything", () => {
    // Eight words, each used in every line.
    const words = ["alfa", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
    const many = [words.join(" "), words.join(" "), words.join(" ")];
    expect(guessCorrespondingWords({ lines: many, max: 3 })).toHaveLength(3);
    expect(guessCorrespondingWords({ lines: ["ab ab", "ab cd", "ab ef"] })).toEqual([]);
  });

  // Two lines have no majority to speak of — whatever they share scores full
  // marks, and the headings would be the pronoun they both happen to use.
  it("reads nothing from repetition when there are too few lines", () => {
    const two = ["han kom just nu", "han gjorde just det"];
    expect(guessCorrespondingWords({ lines: two, stopWords: new Set() })).toEqual([]);
    // The other signals still work on a pair.
    expect(guessCorrespondingWords({ lines: two, translatedWords: ["just"] })
      .map(c => c.word)).toEqual(["just"]);
  });
});

describe("groupResultsByWord", () => {
  const lineOf = it => it.sv;
  const items = [
    { id: 1, sv: "han kom just nu" },
    { id: 2, sv: "just det" },
    { id: 3, sv: "precis så" },
    { id: 4, sv: "ingenting alls" },
  ];

  it("buckets by the first candidate a line uses, and sweeps up the rest", () => {
    const out = groupResultsByWord(items, [{ word: "just" }, { word: "precis" }], lineOf);
    expect(out.map(g => [g.word, g.items.map(i => i.id)])).toEqual([
      ["just", [1, 2]],
      ["precis", [3]],
      [EVERYTHING_ELSE, [4]],
    ]);
  });

  // One finding should read as one finding, wherever else it could sit.
  it("puts a line mentioning two candidates under the stronger one only", () => {
    const both = [{ id: 9, sv: "just precis så" }];
    const out = groupResultsByWord(both, [{ word: "just" }, { word: "precis" }], lineOf);
    expect(out).toHaveLength(1);
    expect(out[0].word).toBe("just");
  });

  it("omits a group nothing landed in, and the sweep-up when nothing is left over", () => {
    const out = groupResultsByWord(items.slice(0, 2), [{ word: "just" }, { word: "precis" }], lineOf);
    expect(out.map(g => g.word)).toEqual(["just"]);
  });

  it("puts everything in the sweep-up when there is nothing to go on", () => {
    const out = groupResultsByWord(items, [], lineOf);
    expect(out.map(g => g.word)).toEqual([EVERYTHING_ELSE]);
    expect(out[0].items).toHaveLength(4);
  });
});

describe("capGroups", () => {
  const g = (word, n) => ({ word, items: Array.from({ length: n }, (_, i) => `${word}${i}`) });

  // The bug this exists to prevent: capping the headings quietly threw away
  // the findings underneath the ones that missed the cut.
  it("keeps every item when it drops a heading", () => {
    const groups = Array.from({ length: 10 }, (_, i) => g(`w${i}`, 4));
    const out = capGroups(groups, 3);
    expect(out.map(x => x.word)).toEqual(["w0", "w1", "w2", EVERYTHING_ELSE]);
    expect(out.reduce((n, x) => n + x.items.length, 0)).toBe(40);
  });

  it("folds the spill in with an existing sweep-up, keeping it last", () => {
    const out = capGroups([g("a", 1), g("b", 1), { word: EVERYTHING_ELSE, items: ["x"] }], 1);
    expect(out.map(x => x.word)).toEqual(["a", EVERYTHING_ELSE]);
    expect(out[1].items).toEqual(["x", "b0"]);
  });

  it("leaves a set that already fits alone, and adds no empty sweep-up", () => {
    const groups = [g("a", 2), g("b", 1)];
    expect(capGroups(groups, 6)).toEqual(groups);
  });
});
