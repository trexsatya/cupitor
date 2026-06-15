import {
  stripBracketHints,
  vocabPrefixOverlapLen,
  vocabSuffixOverlapLen,
  vocabPrefixOverlapDetail,
  buildKnownWordSet,
  buildPrefixSet,
  vocabCompoundParts,
  VOCAB_OVERLAP_STOP_WORDS,
  VOCAB_COMPOUND_SUFFIXES,
} from "./vocab-search";

// Tiny synthetic vocabulary covering every interesting case from the user's
// reports. Each category is a list of pipe-joined lines, the same shape the
// real language.js code consumes.
const fakeVocab = {
  "Sample": [
    "(rich)| rik |förmögen|rik som ett troll|rikedom|",
    "(magic)|magi|trolldom|trolleri|",
    "(believe)|tro|tror|trodde|",
    "(Sparrow)|sparv|",
    "(proverb)|Det flyger inga stekta sparvar i munnen på en",
    "(stop)|stoppa|hindra|hinder|",
    "(eat)| äta | äter | åt | ätit |",
    "(jewel)|guld(sl-pl)|guldfisk|",
    "(injure)|såra|skär|bet|bett(sl-pl)|biten|",
    "(stroll)|promenera|drälla|",
    "(mind)|sinne|sinnet|",
    "(atmosphere)|stämning|stämningar|",
    "(silence)|tystnad|tyst|tysta|",
    "(speechless)|stum|tyst|mållös|",
    "(dayparts)|kväll|kvällar|",
    "(view)|utsikt|vy|vyer|",
    "(house)|hus|",
    "(bird)|fågel|fåglar|",
    "(stoft)|Damm|stoft(-et)|stoftmoln|",
    "(big)|stor|större|störst|",
    "(furniture)|stol|stolar|",
  ],
  // Hidden category — must NOT contribute to the known set.
  "Expansions": [
    "hinna=hinna,hinner,hann,hunnit",
  ],
};

const known = buildKnownWordSet(fakeVocab, new Set(["Expansions"]));
const prefixes = buildPrefixSet(known);

describe("stripBracketHints", () => {
  test("removes (sl-pl) and (pl) tags", () => {
    expect(stripBracketHints("guld(sl-pl)")).toBe("guld");
    expect(stripBracketHints("vy(pl)")).toBe("vy");
  });
  test("removes nested-paren content innermost-first", () => {
    expect(stripBracketHints("stoft(-et)")).toBe("stoft");
    expect(stripBracketHints("(was i so (vajaså))")).toBe("");
  });
  test("non-string input is handled safely", () => {
    expect(stripBracketHints(undefined)).toBe("");
    expect(stripBracketHints(null)).toBe("");
  });
});

describe("buildKnownWordSet", () => {
  test("skips hidden categories", () => {
    // hunnit only exists inside the Expansions definition line — should NOT
    // make it into the known set because the category is hidden.
    expect(known.has("hunnit")).toBe(false);
  });
  test("strips brackets and tokenises on whitespace + punctuation", () => {
    expect(known.has("guld")).toBe(true); // from "guld(sl-pl)"
    expect(known.has("stoft")).toBe(true); // from "stoft(-et)"
    expect(known.has("sparvar")).toBe(true); // from "Det flyger inga stekta sparvar..."
  });
  test("excludes stop words and tokens shorter than 3 chars", () => {
    expect(known.has("det")).toBe(false);
    expect(known.has("vy")).toBe(false); // 2 chars
  });
});

describe("vocabPrefixOverlapLen", () => {
  test("LCP near-containment accepts inflectional siblings", () => {
    // "trolla" + "trollguldet" share 5 of 6 — match.
    expect(vocabPrefixOverlapLen("trolla", "trollguldet")).toBe(5);
  });
  test("LCP near-containment rejects coincidental short prefix", () => {
    // "tropic" + "trollguldet" share only 3 of 6 — reject.
    expect(vocabPrefixOverlapLen("tropic", "trollguldet")).toBe(0);
  });
  test("multi-word segments tokenise per-word", () => {
    // "rik som ett troll" should match "trollguldet" via the "troll" token.
    expect(vocabPrefixOverlapLen("rik som ett troll", "trollguldet")).toBe(5);
  });
  test("matches sparv inside multi-word proverb line", () => {
    expect(
      vocabPrefixOverlapLen(
        "Det flyger inga stekta sparvar i munnen på en",
        "sparv"
      )
    ).toBeGreaterThanOrEqual(5);
  });
  test("stop-word tokens don't anchor", () => {
    // "det" alone shouldn't match anything ending in -det because it's a stop.
    expect(vocabPrefixOverlapLen("det som händer", "trollguldet")).toBe(0);
  });
  test("short search parts are filtered", () => {
    expect(vocabPrefixOverlapLen("trolla", "tr")).toBe(0);
  });
});

describe("vocabSuffixOverlapLen", () => {
  test("surfaces 2-char full-token suffix overlap", () => {
    // "äta|åt|ätit" + "gråt" — "åt" is fully consumed as the 2-char suffix.
    expect(vocabSuffixOverlapLen("äta|åt|ätit", "gråt")).toBe(2);
  });
  test("rejects partial 2-char suffix of a longer token", () => {
    // "(injure)|...|bet|..." vs "trollguldet": "bet" shares "et" (2/3) — reject.
    expect(
      vocabSuffixOverlapLen("(injure)|såra|bet|bett(sl-pl)|biten", "trollguldet")
    ).toBe(0);
  });
  test("matches a full-token vy in envy", () => {
    expect(vocabSuffixOverlapLen("utsikt|vy|vyer", "envy")).toBe(2);
  });
  test("no match for unrelated tokens", () => {
    expect(
      vocabSuffixOverlapLen("(believe)|tro|tror|trodde|", "trollguldet")
    ).toBe(0);
  });
});

describe("vocabPrefixOverlapDetail", () => {
  test("returns the actual matched substring, not the search part", () => {
    // Token "stor" matching "stoft" with LCP=3 — matched should be "sto".
    const { len, matched } = vocabPrefixOverlapDetail("stor|större", "stoft");
    expect(len).toBe(3);
    expect(matched).toBe("sto");
  });
  test("matched substring equals the search when tokens are exact match", () => {
    const { len, matched } = vocabPrefixOverlapDetail("stoft(-et)|stoftmoln", "stoft");
    expect(len).toBe(5);
    expect(matched).toBe("stoft");
  });
  test("multi-word picks the winning token", () => {
    const { len, matched } = vocabPrefixOverlapDetail(
      "rik som ett troll",
      "troll|trollguldet"
    );
    expect(len).toBe(5);
    expect(matched).toBe("troll");
  });
});

describe("vocabCompoundParts", () => {
  test("decomposes trollguldet into troll + guld", () => {
    expect(vocabCompoundParts("trollguldet", known, prefixes)).toEqual([
      "troll",
      "guld",
    ]);
  });
  test("decomposes kvällstysta into kväll + tysta", () => {
    expect(vocabCompoundParts("kvällstysta", known, prefixes)).toEqual([
      "kväll",
      "tysta",
    ]);
  });
  test("handles the Swedish linking 's' (sinnesstämning → sinne + stämning)", () => {
    expect(vocabCompoundParts("sinnesstämning", known, prefixes)).toEqual([
      "sinne",
      "stämning",
    ]);
  });
  test("strips a final inflection on the second half (fågelhuset → fågel + hus)", () => {
    expect(vocabCompoundParts("fågelhuset", known, prefixes)).toEqual([
      "fågel",
      "hus",
    ]);
  });
  test("doesn't split an already-known inflection (sparvarna)", () => {
    expect(vocabCompoundParts("sparvarna", known, prefixes)).toEqual([]);
  });
  test("uses prefix-of-known fallback (aftonpromenad → promen)", () => {
    expect(vocabCompoundParts("aftonpromenad", known, prefixes)).toEqual([
      "promen",
    ]);
  });
  test("skips coincidental 3-char hits without a suffix extension", () => {
    // No vocab word starts with "afton" and "ton" alone shouldn't anchor.
    const parts = vocabCompoundParts("aftonpromenad", known, prefixes);
    expect(parts).not.toContain("ton");
  });
  test("returns [] for inputs shorter than 6 chars", () => {
    expect(vocabCompoundParts("stoft", known, prefixes)).toEqual([]);
  });
  test("never includes a stop word as a morpheme", () => {
    for (const part of vocabCompoundParts("kvällstysta", known, prefixes)) {
      expect(VOCAB_OVERLAP_STOP_WORDS.has(part)).toBe(false);
    }
  });
});

describe("integration: groups by matched substring", () => {
  // Simulates the main panel's bucket-by-`matched` flow.
  function groupSearch(rawSearch) {
    const decomp = vocabCompoundParts(rawSearch, known, prefixes);
    const searchText = decomp.length
      ? [...decomp, rawSearch].join("|")
      : rawSearch;
    const groups = new Map();
    for (const lines of Object.values(fakeVocab)) {
      for (const line of lines) {
        const { len, matched } = vocabPrefixOverlapDetail(line, searchText);
        if (len >= 3) {
          if (!groups.has(matched)) groups.set(matched, []);
          groups.get(matched).push(line);
        }
      }
    }
    return groups;
  }

  test("'stoft' yields a 'stoft' group AND a separate 'sto' group", () => {
    const groups = groupSearch("stoft");
    expect(groups.has("stoft")).toBe(true);
    expect(groups.has("sto")).toBe(true);
    // The "stoft" group never contains lines whose only sto-prefix is "sto".
    for (const line of groups.get("stoft")) {
      expect(line.toLowerCase()).toMatch(/stoft/);
    }
  });

  test("'kvällstysta' yields both 'tyst' and 'tysta' groups", () => {
    const groups = groupSearch("kvällstysta");
    expect(groups.has("kväll")).toBe(true);
    expect(groups.has("tysta")).toBe(true);
    expect(groups.has("tyst")).toBe(true);
  });

  test("'trollguldet' yields 'troll' and 'guld' groups ahead of 'tro'", () => {
    const groups = groupSearch("trollguldet");
    expect(groups.has("troll")).toBe(true);
    expect(groups.has("guld")).toBe(true);
    expect(groups.has("tro")).toBe(true);
  });
});
