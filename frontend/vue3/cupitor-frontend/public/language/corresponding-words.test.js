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
  confirmByBackTranslation,
  sameWord,
  sinkUnevidencedGroups,
  translationConfidence,
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

  // What those words do across the subtitles generally. "han" and "det" are
  // everywhere, which is exactly why counting the matched lines alone cannot
  // tell them apart from the word the search is about.
  const BG_LINES = 1000;
  const BG = new Map([
    ["han", 400], ["det", 380], ["kom", 90], ["nu", 85], ["så", 120],
    ["var", 110], ["gjorde", 40], ["just", 8], ["precis", 6],
    ["xyz", 1], ["abc", 1],
  ]);
  const bg = { background: BG, backgroundLines: BG_LINES };

  it("makes a group of the word that stands out, and nothing of the singletons", () => {
    const out = guessCorrespondingWords({
      lines, searchWord: "precisely", stopWords: STOP, ...bg,
    });
    expect(out.map(c => c.word)).toEqual(["just"]);
    expect(out[0].reasons).toEqual(["distinctive"]);
    // 'han' is in as many lines and is excluded by the stop list — and would
    // be excluded by its background share even without one.
    expect(out.some(c => c.word === "han")).toBe(false);
    // Singletons carrying no other signal stay out.
    expect(out.some(c => c.word === "xyz")).toBe(false);
    // So does 'precis', used in one line of three: looking like the English
    // word promotes a candidate, it does not make one. As an admission route
    // it produced only false friends — "angrep" for "angry", and the English
    // word "house" sitting untranslated in three lines out of 193.
    expect(out.some(c => c.word === "precis")).toBe(false);
  });

  // The host's dictionary answers with a ranked list of senses, and each one
  // is a candidate. A plain string — all the offline translator can give —
  // still works exactly as it did.
  it("ranks the dictionary's senses in the order it gave them", () => {
    const out = guessCorrespondingWords({
      lines: [], searchWord: "run", stopWords: STOP,
      translatedWords: [
        { word: "springa", rank: 0 },
        { word: "köra", rank: 1 },
        { word: "driva", rank: 2 },
      ],
    });
    expect(out.map(c => c.word)).toEqual(["springa", "köra", "driva"]);
    expect(out.every(c => c.reasons.includes("translated"))).toBe(true);
  });

  // A word both the subtitles and the dictionary point at must not lose to one
  // only the subtitles point at. It would, if reaching the same conclusion from
  // the other direction were worth more than reaching it from this one.
  it("ranks a word the lines and the dictionary agree on above a confirmed guess", () => {
    const both = guessCorrespondingWords({
      lines, searchWord: "precisely", stopWords: STOP, ...bg,
      translatedWords: [{ word: "just", rank: 0 }],
    });
    const agreed = both.find(c => c.word === "just");
    expect(agreed.reasons).toEqual(["distinctive", "translated"]);

    const confirmedOnly = confirmByBackTranslation(
      [{ word: "noga", score: 14 + 10 * (2 / 3), docCount: 2, reasons: ["distinctive"] }],
      "precisely", new Map([["noga", ["precisely"]]]));
    expect(agreed.score).toBeGreaterThan(confirmedOnly[0].score);
  });

  it("still takes a bare word from a translator with no dictionary behind it", () => {
    const out = guessCorrespondingWords({
      lines: [], searchWord: "lake", stopWords: STOP, translatedWords: ["sjö"],
    });
    expect(out.map(c => c.word)).toEqual(["sjö"]);
    expect(out[0].reasons).toEqual(["translated"]);
  });

  // The whole point of admitting more senses is that they must not crowd out
  // what the subtitles themselves show. "just" is in two of these three lines
  // and stands out against the background; a dictionary sense used in none of
  // them must not be ranked above it.
  it("keeps the word the lines actually use ahead of the dictionary's tail", () => {
    const out = guessCorrespondingWords({
      lines, searchWord: "precisely", stopWords: STOP, ...bg,
      translatedWords: [
        { word: "noga", rank: 0 },
        { word: "noggrant", rank: 1 },
        { word: "exakt", rank: 2 },
        { word: "alldeles", rank: 3 },
      ],
    });
    expect(out[0].word).toBe("just");
  });

  it("lifts a candidate that looks like the English word above its rivals", () => {
    const svLines = ["precisa mätningar", "precisa svar", "noggranna svar", "precisa tal"];
    const background = new Map([["precisa", 5], ["svar", 6], ["noggranna", 4], ["mätningar", 3], ["tal", 4]]);
    const ranked = guessCorrespondingWords({
      lines: svLines, searchWord: "precise", background, backgroundLines: 2000,
    });
    // 'svar' is in fewer lines but both qualify; the cognate goes first.
    expect(ranked[0].word).toBe("precisa");
    expect(ranked[0].reasons).toEqual(["distinctive", "cognate"]);
  });

  // A word the translator or the vocabulary offers is worth searching for even
  // when the results at hand never use it.
  it("keeps a translated or vocabulary word that appears in no line", () => {
    const out = guessCorrespondingWords({
      lines, searchWord: "precisely", stopWords: STOP, ...bg,
      translatedWords: ["noggrant"], vocabWords: ["alldeles"],
    });
    const byWord = Object.fromEntries(out.map(c => [c.word, c]));
    expect(byWord.noggrant.docCount).toBe(0);
    expect(byWord.alldeles.docCount).toBe(0);
    // Kept, but behind the word these lines actually use: a heading with
    // findings under it is worth more than one that only might be. The
    // translator still outranks the vocabulary between themselves.
    expect(out.map(c => c.word).slice(0, 3)).toEqual(["just", "noggrant", "alldeles"]);
  });

  it("respects the cap and drops words too short to mean anything", () => {
    // Eight words, each used in every line and rare everywhere else.
    const words = ["alfa", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
    const many = [words.join(" "), words.join(" "), words.join(" ")];
    const rare = { background: new Map(words.map(w => [w, 3])), backgroundLines: 1000 };
    expect(guessCorrespondingWords({ lines: many, max: 3, ...rare })).toHaveLength(3);
    expect(guessCorrespondingWords({ lines: ["ab ab", "ab cd", "ab ef"], ...rare })).toEqual([]);
  });

  // Two lines have no majority to speak of.
  it("reads nothing from the lines when there are too few of them", () => {
    const two = ["han kom just nu", "han gjorde just det"];
    expect(guessCorrespondingWords({ lines: two, stopWords: new Set(), ...bg })).toEqual([]);
    // The other signals still work on a pair.
    expect(guessCorrespondingWords({ lines: two, translatedWords: ["just"], ...bg })
      .map(c => c.word)).toEqual(["just"]);
  });

  // The bug that made an English search for "thin" propose "ska" and "den":
  // the words that repeat most are the ones that repeat everywhere.
  it("ignores a word that is just as common in the subtitles at large", () => {
    const everyday = ["han ska tunna skivor", "han ska ha tunna", "han ska gå"];
    const out = guessCorrespondingWords({
      lines: everyday,
      stopWords: new Set(),   // 'han' and 'ska' are NOT on the stop list
      background: new Map([["han", 500], ["ska", 450], ["tunna", 4], ["skivor", 20], ["gå", 200], ["ha", 300]]),
      backgroundLines: 1000,
    });
    expect(out.map(c => c.word)).toEqual(["tunna"]);
  });

  // Lift on its own promotes accidents, so a word must also carry a real
  // share of the matches — two mentions out of forty is a coincidence.
  it("ignores a rare word that only a couple of matches happen to use", () => {
    const lines40 = Array.from({ length: 40 }, (_, i) =>
      i < 2 ? "en udda hönshuset mening" : "huset vid vattnet");
    const out = guessCorrespondingWords({
      lines: lines40,
      // "vattnet" is in as many lines as "huset" but is ordinary in the
      // subtitles at large, so only "huset" stands out.
      background: new Map([["huset", 60], ["hönshuset", 2], ["vattnet", 900], ["udda", 30], ["mening", 40], ["vid", 800]]),
      backgroundLines: 5000,
    });
    expect(out.map(c => c.word)).toEqual(["huset"]);
  });

  // No yardstick, no guessing — a misleading heading is worse than none.
  it("reads nothing from the lines without a background", () => {
    expect(guessCorrespondingWords({ lines, searchWord: "", stopWords: STOP })).toEqual([]);
  });
});

describe("sameWord", () => {
  // The question is whether one English word is the other with an ending on
  // it, not whether they open alike — which between two English words is
  // commonplace and means nothing.
  it("accepts an inflection and rejects a shared opening", () => {
    expect(sameWord("thin", "thin")).toBe(true);
    expect(sameWord("thinner", "thin")).toBe(true);
    expect(sameWord("house", "houses")).toBe(true);
    expect(sameWord("starve", "start")).toBe(false);
    expect(sameWord("policy", "police")).toBe(false);
    expect(sameWord("plant", "plan")).toBe(true);
  });

  it("does not let a long word swallow a short one, and needs a real word", () => {
    expect(sameWord("thinking", "thin")).toBe(false);
    expect(sameWord("in", "inside")).toBe(false);
    expect(sameWord("", "thin")).toBe(false);
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

describe("translationConfidence", () => {
  // Real numbers: the host scores "sjö" → lake at 0.48 and sea at 0.03, and
  // gives wave, mere, lough and loch no score at all.
  it("reads the score where there is one", () => {
    expect(translationConfidence({ term: "lake", score: 0.4798, rank: 0 })).toBe("high");
    expect(translationConfidence({ term: "sea", score: 0.0316, rank: 1 })).toBe("medium");
    expect(translationConfidence({ term: "x", score: 0.004, rank: 2 })).toBe("low");
    // The score is believed even when it disagrees with the position.
    expect(translationConfidence({ term: "x", score: 0.9, rank: 5 })).toBe("high");
  });

  it("falls back to where the dictionary put it", () => {
    expect(translationConfidence({ term: "wave", rank: 0 })).toBe("high");
    expect(translationConfidence({ term: "mere", rank: 2 })).toBe("medium");
    expect(translationConfidence({ term: "loch", rank: 5 })).toBe("low");
    expect(translationConfidence(null)).toBe("low");
  });
});

describe("sinkUnevidencedGroups", () => {
  const direct = it => !it.viaGuess;
  const g = (word, ...items) => ({ word, reasons: [], items });
  const hit = { id: "hit" };
  const swept = { id: "swept", viaGuess: true };

  // The reported case: an English search for "thin" offers fin, smal and mager
  // from the dictionary, and each collects lines whose English side never says
  // "thin". They stay, below the words the search actually landed on.
  it("puts the groups the search never landed in last, keeping the rest in order", () => {
    const out = sinkUnevidencedGroups([
      g("tunnbrödsrulle", hit), g("fin", swept), g("tunna", hit, swept),
      g("smal", swept, swept), g("mager", swept), g(EVERYTHING_ELSE, hit),
    ], direct);
    expect(out.map(x => x.word))
      .toEqual(["tunnbrödsrulle", "tunna", "fin", "smal", "mager", EVERYTHING_ELSE]);
    // Nothing dropped.
    expect(out.reduce((n, x) => n + x.items.length, 0)).toBe(8);
  });

  it("leaves a set alone when every group has a real hit, and without a test", () => {
    const groups = [g("tunna", hit), g("smal", hit), g(EVERYTHING_ELSE, swept)];
    expect(sinkUnevidencedGroups(groups, direct).map(x => x.word))
      .toEqual(["tunna", "smal", EVERYTHING_ELSE]);
    expect(sinkUnevidencedGroups(groups, null)).toBe(groups);
    expect(sinkUnevidencedGroups(null, direct)).toEqual([]);
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

describe("confirmByBackTranslation", () => {
  const cands = [
    { word: "ska", score: 5, docCount: 4, reasons: ["distinctive"] },
    { word: "tunna", score: 2, docCount: 2, reasons: ["distinctive"] },
  ];

  // The point of the pass: the word that means what was searched for goes to
  // the front, however the counting had ranked it.
  it("promotes the guess that translates back to the search word", () => {
    const back = new Map([["ska", "shall"], ["tunna", "thin"]]);
    const out = confirmByBackTranslation(cands, "thin", back);
    expect(out.map(c => c.word)).toEqual(["tunna", "ska"]);
    expect(out[0].reasons).toContain("confirmed");
    expect(out[1].reasons).not.toContain("confirmed");
  });

  // A translator asked for one word gives one answer, and a real sense is
  // often not that answer — "kör" meaning "drives" is still a sense of "run".
  it("never demotes a guess it cannot confirm", () => {
    const out = confirmByBackTranslation(cands, "thin", new Map([["ska", "shall"]]));
    expect(out.map(c => c.word)).toEqual(["ska", "tunna"]);
    expect(out.map(c => c.score)).toEqual([5, 2]);
  });

  it("accepts an inflected or cognate answer, and leaves everything alone with no bridge", () => {
    expect(confirmByBackTranslation(cands, "thin", new Map([["tunna", "the thinner one"]]))[0].word)
      .toBe("tunna");
    expect(confirmByBackTranslation(cands, "thin", null)).toEqual(cands);
    expect(confirmByBackTranslation(cands, "", new Map([["tunna", "thin"]]))).toEqual(cands);
  });

  // The case a single answer cannot settle. Asked what "kör" means the
  // translator says "drives"; its sense list says drive, run, operate.
  it("confirms on any sense the dictionary lists, not just the likeliest", () => {
    const running = [
      { word: "springa", score: 5, docCount: 4, reasons: ["distinctive"] },
      { word: "kör", score: 2, docCount: 2, reasons: ["distinctive"] },
    ];
    const out = confirmByBackTranslation(running, "run",
      new Map([["kör", ["drives", "drive", "run", "operate"]]]));
    expect(out[0].word).toBe("kör");
    expect(out[0].reasons).toContain("confirmed");
    // An entry that lists nothing relevant still cannot demote anything.
    expect(confirmByBackTranslation(running, "run", new Map([["kör", ["drives", "steers"]]])))
      .toEqual(running);
    expect(confirmByBackTranslation(running, "run", new Map([["kör", []]]))).toEqual(running);
  });
});
