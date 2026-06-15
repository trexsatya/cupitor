import { guessStems, STEM_RULES } from "./stemming";

describe("guessStems — Swedish", () => {
  test("strips '-at' to '-a' (group-1 supinum / past participle)", () => {
    expect(guessStems("förvärvat", "sv")).toEqual(["förvärva"]);
  });
  test("strips '-ad' giving both verb form and root", () => {
    expect(guessStems("förvärvad", "sv")).toEqual(["förvärva", "förvärv"]);
  });
  test("strips '-it' (group-3 supinum)", () => {
    expect(guessStems("köpit", "sv")).toEqual(["köpa"]);
  });
  test("strips '-ning' suffix", () => {
    expect(guessStems("byggning", "sv")).toEqual(["bygg"]);
  });
  test("strips '-arna' giving plural-base and root", () => {
    expect(guessStems("flickorna", "sv")).toEqual(["flicka"]);
    expect(guessStems("hundarna", "sv")).toEqual(["hunda", "hund"]);
  });
  test("strips '-et' giving the indef form", () => {
    expect(guessStems("huset", "sv")).toEqual(["hus"]);
  });
  test("strips '-en' (definite/plural)", () => {
    expect(guessStems("kvällen", "sv")).toEqual(["kväll"]);
  });
  test("'trollguldet' falls into the '-et' rule (matched before '-t')", () => {
    // First matching suffix wins — 'et' rule fires before 't' rule.
    expect(guessStems("trollguldet", "sv")).toEqual(["trollguld"]);
  });
  test("returns [] for inputs shorter than 4 chars", () => {
    expect(guessStems("hus", "sv")).toEqual([]);
    expect(guessStems("ab", "sv")).toEqual([]);
  });
  test("returns [] when stripping would leave a too-short stem", () => {
    // word.length - suffix.length must be >= 3.
    // "ata" - "at" = 1 char, fails; "ata" - "a" = 2 chars, also fails.
    expect(guessStems("ata", "sv")).toEqual([]);
  });
  test("returns [] for null/undefined/empty input", () => {
    expect(guessStems(null, "sv")).toEqual([]);
    expect(guessStems(undefined, "sv")).toEqual([]);
    expect(guessStems("", "sv")).toEqual([]);
  });
  test("first-matching-suffix wins — stops at the first rule", () => {
    // 'ningarna' fires for "byggningarna", NOT the later 'arna' rule.
    expect(guessStems("byggningarna", "sv")).toEqual(["bygg"]);
  });
  test("deduplicates while preserving order", () => {
    // 'arna' rule has repls ['a', ''] — for "hundarna" both stems are
    // distinct; no duplicates expected. Sanity check that order is stable.
    const out = guessStems("hundarna", "sv");
    expect(out).toEqual(["hunda", "hund"]);
    expect(new Set(out).size).toBe(out.length);
  });
});

describe("guessStems — English", () => {
  test("strips '-ing'", () => {
    expect(guessStems("running", "en")).toEqual(["runn", "runne"]);
  });
  test("strips '-tional' → '-tion'", () => {
    expect(guessStems("functional", "en")).toEqual(["function"]);
  });
  test("strips '-ization' → '-ize'", () => {
    expect(guessStems("optimization", "en")).toEqual(["optimize"]);
  });
  test("strips '-ies' → '-y'", () => {
    expect(guessStems("studies", "en")).toEqual(["study"]);
  });
  test("strips '-ed'", () => {
    expect(guessStems("jumped", "en")).toEqual(["jump", "jumpe"]);
  });
});

describe("guessStems — Spanish", () => {
  test("strips '-ando' → '-ar'", () => {
    expect(guessStems("hablando", "es")).toEqual(["hablar"]);
  });
  test("strips '-iendo' giving both -er and -ir candidates", () => {
    expect(guessStems("comiendo", "es")).toEqual(["comer", "comir"]);
  });
  test("strips '-aron' → '-ar'", () => {
    expect(guessStems("hablaron", "es")).toEqual(["hablar"]);
  });
  test("strips '-os' → '-o'", () => {
    expect(guessStems("libros", "es")).toEqual(["libro"]);
  });
});

describe("guessStems — unsupported language", () => {
  test("returns [] for an unknown lang code", () => {
    expect(guessStems("anything", "de")).toEqual([]);
    expect(guessStems("anything", "fr")).toEqual([]);
    expect(guessStems("anything", undefined)).toEqual([]);
  });
});

describe("STEM_RULES table shape", () => {
  test("each entry is [suffix, replacements[]]", () => {
    for (const lang of Object.keys(STEM_RULES)) {
      for (const entry of STEM_RULES[lang]) {
        expect(Array.isArray(entry)).toBe(true);
        expect(entry.length).toBe(2);
        expect(typeof entry[0]).toBe("string");
        expect(Array.isArray(entry[1])).toBe(true);
        for (const r of entry[1]) expect(typeof r).toBe("string");
      }
    }
  });
});
