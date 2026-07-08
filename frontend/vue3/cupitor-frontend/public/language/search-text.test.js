import {
  splitSentences,
  chunkifySentence,
  getWords,
  expandRegex,
  withWordBoundaries,
  relaxSpaces,
  isRegExp,
  getSurrounding,
  cleanSrtForMatch,
  getSearchedTerms,
  getWordsOrdered,
  searchSubtitleText,
  filterByLanguage,
  wordIsExactInVocabularyLine,
  vocabHasExactWord,
} from "./search-text";

// Faux bracket-hint stripper that matches the production semantics for the
// hints these tests actually exercise.
function stripBracketHints(txt) {
  let s = String(txt)
    .replaceAll("(sl-pl)", "")
    .replaceAll("(pl)", "");
  while (/\([^()]*\)/.test(s)) s = s.replace(/\([^()]*\)/, "");
  return s;
}

describe("splitSentences", () => {
  test("splits on sentence boundaries", () => {
    const out = splitSentences("Hej. Hur mår du? Bra!");
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
  test("filters out empty / 1-char fragments", () => {
    const out = splitSentences("a.");
    // The lone "a." may or may not survive depending on Intl.Segmenter — but
    // single-char fragments must not appear.
    expect(out.every(s => s.trim().length > 1)).toBe(true);
  });
});

describe("getWords", () => {
  test("tokenises a plain Swedish phrase", () => {
    const out = getWords("Hej världen");
    expect(out.filter(w => /\w/.test(w))).toEqual(expect.arrayContaining(["Hej", "världen"]));
  });
  test("drops bare '|' separators", () => {
    const out = getWords("a | b");
    expect(out.includes("|")).toBe(false);
  });
});

describe("expandRegex", () => {
  test("expands *ngn into the pronoun group", () => {
    expect(expandRegex("hjälp *ngn med")).toBe("hjälp (jag|du|han|hon|ni|de|vi|dom) med");
  });
  test("expands *sig into the reflexive group", () => {
    expect(expandRegex("ge *sig av")).toBe("ge (mig|dig|honom|henne|er|sig) av");
  });
  test("leaves text without macros untouched", () => {
    expect(expandRegex("ingenting speciellt")).toBe("ingenting speciellt");
  });
});

describe("withWordBoundaries", () => {
  const reOf = (p) => new RegExp(relaxSpaces(withWordBoundaries(p)), "i");
  test("wraps a pattern in Unicode-letter-aware lookarounds", () => {
    expect(withWordBoundaries("design"))
      .toBe("(?<![A-Za-z0-9_À-ÖØ-öø-ÿ])(?:design)(?![A-Za-z0-9_À-ÖØ-öø-ÿ])");
  });
  test("matches a standalone word", () => {
    expect(reOf("vits").test("en bra vits här")).toBe(true);
  });
  test("does not match across a trailing Swedish vowel (vits ≠ vitså)", () => {
    expect(reOf("vits").test("det var vitså igår")).toBe(false);
  });
  test("does not match inside a larger word on either side (fors ≠ töksfors)", () => {
    expect(reOf("fors").test("en töksfors finns")).toBe(false);
    expect(reOf("fors").test("vid en fors nu")).toBe(true);
  });
  test("respects boundaries before an accented letter too (över ≠ överraska)", () => {
    expect(reOf("över").test("en överraska sak")).toBe(false);
    expect(reOf("över").test("hoppa över nu")).toBe(true);
  });
  test("leaves patterns padded with leading/trailing space alone", () => {
    expect(withWordBoundaries(" en ")).toBe(" en ");
  });
  test("returns the input verbatim when empty/falsy", () => {
    expect(withWordBoundaries("")).toBe("");
    expect(withWordBoundaries(null)).toBe(null);
  });
});

describe("relaxSpaces", () => {
  test("replaces runs of spaces with \\s+", () => {
    expect(relaxSpaces("a b")).toBe("a\\s+b");
    expect(relaxSpaces("a    b   c")).toBe("a\\s+b\\s+c");
  });
  test("leaves non-space content alone", () => {
    expect(relaxSpaces("nospace")).toBe("nospace");
  });
  test("coerces non-strings", () => {
    expect(relaxSpaces(null)).toBe("");
    expect(relaxSpaces(undefined)).toBe("");
  });
});

describe("isRegExp", () => {
  test("flags as regex when '.', '*' or '?' is present", () => {
    expect(isRegExp("foo.*bar")).toBe(true);
    expect(isRegExp("a?")).toBe(true);
    expect(isRegExp("c.t")).toBe(true);
  });
  test("plain word is NOT a regex", () => {
    expect(isRegExp("trollguld")).toBe(false);
  });
  test("falsy input → false", () => {
    expect(isRegExp("")).toBe(false);
    expect(isRegExp(null)).toBe(false);
  });
});

describe("getSurrounding", () => {
  const list = ["a", "b", "c", "d", "e", "f", "g"];
  test("returns a centered window of size 2*size+1", () => {
    const out = getSurrounding(3, list, 2);
    expect(out.map(o => o.item)).toEqual(["b", "c", "d", "e", "f"]);
  });
  test("clamps at the start of the list", () => {
    const out = getSurrounding(1, list, 5);
    expect(out[0].item).toBe("a");
  });
  test("clamps at the end of the list", () => {
    const out = getSurrounding(5, list, 5);
    expect(out[out.length - 1].item).toBe("g");
  });
  test("returns [] when index is out of range", () => {
    expect(getSurrounding(99, list, 2)).toEqual([]);
  });
});

describe("cleanSrtForMatch", () => {
  test("strips entry numbers and time-arrow lines", () => {
    const srt = `1
00:00:01,000 --> 00:00:02,000
hej

2
00:00:03,000 --> 00:00:04,000
hello world`;
    const cleaned = cleanSrtForMatch(srt);
    expect(cleaned).toContain("hej");
    expect(cleaned).toContain("hello world");
    expect(cleaned).not.toContain("-->");
    expect(cleaned).not.toMatch(/^\d/);
  });
  test("collapses internal whitespace", () => {
    expect(cleanSrtForMatch("  a   b\n  c  ")).toBe("a b c");
  });
  test("returns '' for falsy input", () => {
    expect(cleanSrtForMatch("")).toBe("");
    expect(cleanSrtForMatch(null)).toBe("");
  });
});

describe("getSearchedTerms", () => {
  test("splits by '|' and dedupes", () => {
    const out = getSearchedTerms("ATT|BE|ATT");
    expect(out).toEqual(["att", "be"]);
  });
  test("preserves leading/trailing whitespace inside each term", () => {
    // " en " has both leading & trailing space → both preserved;
    // " ute" has only leading space → only leading preserved.
    const out = getSearchedTerms(" en | ute");
    expect(out).toEqual([" en ", " ute"]);
  });
  test("strips bracket hints from each term", () => {
    const out = getSearchedTerms("snäll(t)|söt", stripBracketHints);
    expect(out).toEqual(["snäll", "söt"]);
  });
  test("trims leading/trailing pipe chars", () => {
    expect(getSearchedTerms("||att||be||")).toEqual(["att", "be"]);
  });
  test("returns [] for falsy input", () => {
    expect(getSearchedTerms("")).toEqual([]);
    expect(getSearchedTerms(null)).toEqual([]);
    expect(getSearchedTerms(undefined)).toEqual([]);
  });
});

describe("getWordsOrdered", () => {
  test("the search text comes first", () => {
    const out = getWordsOrdered(["x", "y", "att"], "att");
    expect(out[0]).toBe("att");
  });
  test("exact-term matches from searched terms come next", () => {
    const out = getWordsOrdered(["zzz", "be", "att"], "att|be");
    expect(out.slice(0, 3)).toEqual(["att|be", "att", "be"]);
  });
  test("prefix-related words are sorted shortest first", () => {
    const out = getWordsOrdered(["trolla", "troll", "trollguldet"], "troll");
    // searched 'troll' matches itself first; then prefix-related sorted by length.
    expect(out).toEqual(["troll", "trolla", "trollguldet"]);
  });
  test("everything else is appended at the end (deduped)", () => {
    const out = getWordsOrdered(["unrelated"], "att");
    expect(out).toEqual(["att", "unrelated"]);
  });
});

describe("searchSubtitleText", () => {
  const subs = {
    a: { sv: "Hej världen", en: "Hello world" },
    b: { sv: "Vad gör du?", en: "What are you doing?" },
    c: { sv: "Ingen träff", en: "No match" },
  };
  test("scans the default 'sv' key", () => {
    expect(searchSubtitleText(subs, "Hej")).toEqual(["Hej världen"]);
  });
  test("scans an explicit 'en' key", () => {
    expect(searchSubtitleText(subs, "world", "en")).toEqual(["Hello world"]);
  });
  test("returns [] when no match", () => {
    expect(searchSubtitleText(subs, "xyz")).toEqual([]);
  });
  test("tolerates null map", () => {
    expect(searchSubtitleText(null, "x")).toEqual([]);
  });
});

describe("filterByLanguage", () => {
  const results = [
    { sv_match: true, sv_subs: "SV1", en_match: false, en_subs: "EN1" },
    { sv_match: false, sv_subs: "SV2", en_match: true,  en_subs: "EN2" },
    { sv_match: true, sv_subs: "SV3", en_match: true,  en_subs: "EN3" },
  ];
  test("'sv' filter picks sv_subs where sv_match is true", () => {
    expect(filterByLanguage(results, "sv")).toEqual(["SV1", "SV3"]);
  });
  test("'en' filter picks en_subs where en_match is true", () => {
    expect(filterByLanguage(results, "en")).toEqual(["EN2", "EN3"]);
  });
  test("returns [] for null input", () => {
    expect(filterByLanguage(null, "sv")).toEqual([]);
  });
});

describe("wordIsExactInVocabularyLine", () => {
  test("matches a single-word search as a token", () => {
    expect(wordIsExactInVocabularyLine("(spell)|trolla|förtrolla|", "trolla")).toBe(true);
  });
  test("does NOT match as substring of a longer token", () => {
    expect(wordIsExactInVocabularyLine("(spell)|trollguld|", "troll")).toBe(false);
  });
  test("multi-word phrase falls back to substring match", () => {
    expect(wordIsExactInVocabularyLine("(do)|göra susen|", "göra susen")).toBe(true);
  });
  test("|-separated search tries each term", () => {
    expect(wordIsExactInVocabularyLine("(spell)|trolla|förtrolla|", "skydda|trolla")).toBe(true);
  });
  test("empty search → false", () => {
    expect(wordIsExactInVocabularyLine("anything", "")).toBe(false);
  });
});

describe("vocabHasExactWord", () => {
  const lines = [
    "(spell)|trolla|förtrolla|",
    "(big)|stor|stort|stora|",
    "(do something)|göra susen|",
  ];
  test("returns true when an exact token exists in a segment", () => {
    expect(vocabHasExactWord(lines, "trolla")).toBe(true);
    expect(vocabHasExactWord(lines, "stort")).toBe(true);
  });
  test("matches a token inside a multi-word segment", () => {
    expect(vocabHasExactWord(lines, "göra")).toBe(true);
  });
  test("returns false for a bare prefix that isn't a whole token", () => {
    expect(vocabHasExactWord(lines, "troll")).toBe(false);
  });
  test("falsy word → false", () => {
    expect(vocabHasExactWord(lines, "")).toBe(false);
    expect(vocabHasExactWord(lines, null)).toBe(false);
  });
  test("respects the bracket-hint stripper", () => {
    expect(vocabHasExactWord(["(animal)|katt|", "(big)|stor(t)|"], "stort", stripBracketHints))
      .toBe(false); // "stor(t)" strips to "stor", so "stort" is no longer an exact match
    expect(vocabHasExactWord(["(animal)|katt|", "(big)|stor|"], "katt", stripBracketHints))
      .toBe(true);
  });
});

describe("chunkifySentence", () => {
  test("returns an array of chunks", () => {
    const out = chunkifySentence("Hej. Hur mår du? Bra! Det går fint.", 30);
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });
});
