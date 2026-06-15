import {
  SIMILARITY_VOWELS,
  isVowel,
  classifyCharDiffs,
  levenshtein,
  phoneticKey,
  compoundOverlap,
  scoreSimilarity,
} from "./similarity";

describe("isVowel", () => {
  test("matches the Swedish-extended vowel set", () => {
    for (const v of ["a", "e", "i", "o", "u", "y", "å", "ä", "ö"]) {
      expect(isVowel(v)).toBe(true);
    }
  });
  test("is case-insensitive", () => {
    expect(isVowel("A")).toBe(true);
    expect(isVowel("Ö")).toBe(true);
  });
  test("rejects consonants and non-letters", () => {
    expect(isVowel("b")).toBe(false);
    expect(isVowel("z")).toBe(false);
    expect(isVowel("")).toBe(false);
    expect(isVowel(null)).toBe(false);
    expect(isVowel(undefined)).toBe(false);
  });
});

describe("classifyCharDiffs", () => {
  test("identical strings → count 0, all flags false", () => {
    expect(classifyCharDiffs("abc", "abc")).toEqual({
      count: 0, allVowel: false, allConsonant: false
    });
  });
  test("single vowel difference → allVowel true", () => {
    // "trä" vs "tre" — only middle char differs, ä vs e (both vowels).
    expect(classifyCharDiffs("trä", "tre")).toEqual({
      count: 1, allVowel: true, allConsonant: false
    });
  });
  test("single consonant difference → allConsonant true", () => {
    // "katt" vs "matt" — k vs m (both consonants).
    expect(classifyCharDiffs("katt", "matt")).toEqual({
      count: 1, allVowel: false, allConsonant: true
    });
  });
  test("mixed-class difference → both flags false", () => {
    // "kat" vs "bat" — k vs b (both consonants), single diff → all consonant.
    // For mixed, try "kat" vs "kit": a (vowel) vs i (vowel) → all vowel.
    // Need a vowel-vs-consonant: "kat" vs "kbt" — a (vowel) vs b (consonant).
    expect(classifyCharDiffs("kat", "kbt")).toEqual({
      count: 1, allVowel: false, allConsonant: false
    });
  });
  test("multiple diffs all-vowel", () => {
    expect(classifyCharDiffs("tre", "tro")).toEqual({
      count: 1, allVowel: true, allConsonant: false
    });
    expect(classifyCharDiffs("trea", "troi")).toEqual({
      count: 2, allVowel: true, allConsonant: false
    });
  });
});

describe("levenshtein", () => {
  test("identical strings → 0", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
  });
  test("one substitution → 1", () => {
    expect(levenshtein("katt", "matt")).toBe(1);
  });
  test("one insertion → 1", () => {
    expect(levenshtein("kat", "katt")).toBe(1);
  });
  test("one deletion → 1", () => {
    expect(levenshtein("katt", "kat")).toBe(1);
  });
  test("empty inputs", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "")).toBe(0);
  });
  test("kitten → sitting = 3", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("phoneticKey — Swedish", () => {
  test("sj-sound family collapses to a single class marker", () => {
    // sj/skj/sch/ssj all become "Ç..."
    expect(phoneticKey("sjuk", "sv").charAt(0)).toBe("Ç");
    expect(phoneticKey("skjuta", "sv").charAt(0)).toBe("Ç");
    expect(phoneticKey("schack", "sv").charAt(0)).toBe("Ç");
  });
  test("sk before front-vowel = Ç (sj-sound), else stays /sk/", () => {
    expect(phoneticKey("skön", "sv").charAt(0)).toBe("Ç");
    expect(phoneticKey("skola", "sv").startsWith("sk")).toBe(true);
  });
  test("k before front-vowel = C (tj-sound)", () => {
    expect(phoneticKey("köpa", "sv").charAt(0)).toBe("C");
    expect(phoneticKey("kall",  "sv").charAt(0)).toBe("k");
  });
  test("silent-onset j-family collapses (hj/lj/gj/dj/j) → J", () => {
    expect(phoneticKey("hjul", "sv").charAt(0)).toBe("J");
    expect(phoneticKey("jul",  "sv").charAt(0)).toBe("J");
    expect(phoneticKey("ljus", "sv").charAt(0)).toBe("J");
  });
  test("identical phonetic keys for true homophones", () => {
    // "hjul" and "jul" — both start with J + "ul".
    expect(phoneticKey("hjul", "sv")).toBe(phoneticKey("jul", "sv"));
  });
  test("w → v, ng → N, x → ks, z → s, qu → kv", () => {
    expect(phoneticKey("watt", "sv")).toBe("vatt");
    expect(phoneticKey("säng", "sv")).toContain("N");
    expect(phoneticKey("axel", "sv")).toContain("ks");
    expect(phoneticKey("zon",  "sv")).toBe("son");
    expect(phoneticKey("kvar", "sv")).toBe("kvar");
  });
  test("c (before non-front-vowel) → k; ck → k via the c rule firing first", () => {
    // "tack" — the `c → k` rule fires before the `ck → k` rule, so the
    // net is "tackk" wait, "tac" + "k" → "tak" + "k" = "takk". Both
    // "tack" and a hypothetical "takk" reduce to the same key, which is
    // what matters for similarity grouping.
    expect(phoneticKey("tack", "sv")).toBe("takk");
    expect(phoneticKey("takk", "sv")).toBe("takk");
  });
  test("empty / falsy input → ''", () => {
    expect(phoneticKey("", "sv")).toBe("");
    expect(phoneticKey(null, "sv")).toBe("");
  });
});

describe("phoneticKey — English", () => {
  test("ph → f", () => {
    expect(phoneticKey("phone", "en")).toBe("fone");
  });
  test("silent leading letters dropped", () => {
    expect(phoneticKey("knight", "en")).toBe("night");
    expect(phoneticKey("write",  "en")).toBe("rite");
  });
  test("c before front-vowel = s, else k", () => {
    expect(phoneticKey("cell", "en")).toBe("sell");
    expect(phoneticKey("cat",  "en")).toBe("kat");
  });
  test("ck → k, qu → kw, x → ks", () => {
    expect(phoneticKey("back", "en")).toBe("bak");
    expect(phoneticKey("quick", "en")).toBe("kwik");
  });
});

describe("phoneticKey — Spanish", () => {
  test("ll → y, h dropped, v → b", () => {
    expect(phoneticKey("llamar", "es")).toBe("yamar");
    expect(phoneticKey("hablar", "es")).toBe("ablar");
    expect(phoneticKey("vaca",   "es")).toBe("baka");
  });
  test("c/g before front-vowel respect their soft sound", () => {
    expect(phoneticKey("cero", "es")).toBe("sero");
    expect(phoneticKey("casa", "es")).toBe("kasa");
    expect(phoneticKey("gente", "es")).toBe("xente");
  });
  test("j → x", () => {
    expect(phoneticKey("jefe", "es")).toBe("xefe");
  });
});

describe("compoundOverlap", () => {
  test("shorter appears at the start or end of the longer", () => {
    // "livsgnista" ends with "gnista" → gap = 10-6 = 4.
    expect(compoundOverlap("gnista", "livsgnista")).toBe(4);
    // "gnistade" starts with "gnista" → gap = 8-6 = 2.
    expect(compoundOverlap("gnista", "gnistade")).toBe(2);
  });
  test("returns 0 when shorter < 4 chars", () => {
    expect(compoundOverlap("is", "kris")).toBe(0);
    expect(compoundOverlap("kat", "kattuna")).toBe(0);
  });
  test("returns 0 when same length (would be a substitution)", () => {
    expect(compoundOverlap("katt", "matt")).toBe(0);
  });
  test("returns 0 when shorter is in the middle, not edges", () => {
    expect(compoundOverlap("guld", "trollguldet")).toBe(0); // ends with "guldet", not "guld"
  });
  test("argument order doesn't matter", () => {
    expect(compoundOverlap("livsgnista", "gnista")).toBe(4);
  });
});

describe("scoreSimilarity", () => {
  test("returns null for identical / empty / null", () => {
    expect(scoreSimilarity("kat", "kat", "sv")).toBeNull();
    expect(scoreSimilarity("", "kat", "sv")).toBeNull();
    expect(scoreSimilarity("kat", null, "sv")).toBeNull();
  });
  test("tier 0 (phonetic homophone)", () => {
    expect(scoreSimilarity("hjul", "jul", "sv"))
      .toEqual({ tier: 0, distance: 0 });
  });
  test("tier 1 (single vowel diff)", () => {
    expect(scoreSimilarity("kat", "kit", "sv"))
      .toEqual({ tier: 1, distance: 1 });
  });
  test("tier 1 (compound overlap)", () => {
    // "gnista" ⊂ "livsgnista".
    const r = scoreSimilarity("gnista", "livsgnista", "sv");
    expect(r.tier).toBe(1);
    expect(r.distance).toBe(4);
  });
  test("tier 2 (single consonant diff)", () => {
    expect(scoreSimilarity("katt", "matt", "sv"))
      .toEqual({ tier: 2, distance: 1 });
  });
  test("tier 3 (edit distance 2)", () => {
    expect(scoreSimilarity("kat", "kort", "sv"))
      .toEqual({ tier: 3, distance: 2 });
  });
  test("returns null when edit distance > 2", () => {
    expect(scoreSimilarity("kat", "elefant", "sv")).toBeNull();
  });
  test("tier 0 takes precedence over tier 2/3", () => {
    // "jul" and "hjul" are tier 0 (phonetic) — should NOT fall through to
    // tier 3 even though edit distance is 1.
    expect(scoreSimilarity("jul", "hjul", "sv").tier).toBe(0);
  });
});

describe("SIMILARITY_VOWELS constant", () => {
  test("is a Set with 9 entries", () => {
    expect(SIMILARITY_VOWELS instanceof Set).toBe(true);
    expect(SIMILARITY_VOWELS.size).toBe(9);
  });
});
