// End-to-end search tests over REAL data. The vocab lines, expansion entries
// and SRT cues below are copied verbatim from the Swedish corpus
// (trexsatya.github.io/db/language/swedish/{vocabulary.txt,srts/*.sv.srt}) so
// the tests exercise the actual search behaviour on the kinds of items that
// occur in production — single-word entries, multi-word phrases, `<*`-expansion
// refs, and `(ngt)`-hint wildcards — rather than synthetic strings.
//
// They wire together the same pure pieces the app uses:
//   vocab match : expandWords(line)  →  wordIsExactInVocabularyLine(expanded, search)
//   SRT match   : srtToJson(text)    →  RegExp(relaxSpaces(withWordBoundaries(search)))
// (The live app adds a DOM/render layer and a lenient stem fallback on top; the
// matching core tested here is what decides which lines/cues come back.)

import { parseVocabularyFile } from "./vocab-merge.js";
import { expandWords, buildExpansionMap } from "./vocab-expand.js";
import { wordIsExactInVocabularyLine, withWordBoundaries, relaxSpaces } from "./search-text.js";
import { srtToJson } from "./srt-parser.js";

// ── Real vocabulary slice (verbatim lines + a real `expansions` section) ──
const VOCAB_TEXT = `#lad
(lad)|sven|svenner|svenne|svennar
#driver
(driver)|körsven|körsvenner|kusk|kuskar
#wellbeing
(wellbeing)|må bra|glad|lugn|
#anger
(anger)|brusa upp|bli upprörd|bli arg
#include
(include)|inkludera|innefatta|innehålla|inbegripa|omfatta|<*bestå av|
#regarding
(regarding)|sett till (ngt)|i termer av|med avseende på
#expansions
bestå=bestå,består,bestod,bestått`;

const vocab = parseVocabularyFile(VOCAB_TEXT);
const expansionMap = buildExpansionMap(vocab);
const line = (cat) => vocab[cat][0];

// Mirror the app's tier-1 vocab matcher (renderVocabularyFindings): expand the
// line to its inflected forms, then phrase-match the search against it.
const vocabMatches = (vocabLine, search) =>
  wordIsExactInVocabularyLine(expandWords(vocabLine, "sv", expansionMap), String(search).toLowerCase().trim());

describe("e2e vocab search — single-word entries", () => {
  test('"sven" matches the (lad) line', () => {
    expect(vocabMatches(line("lad"), "sven")).toBe(true);
  });
  test('"sven" does NOT match the (driver) superword line (körsven)', () => {
    expect(vocabMatches(line("driver"), "sven")).toBe(false);
  });
  test('searching "sven" across the whole slice returns only the [lad] category', () => {
    const realCats = Object.keys(vocab).filter((c) => c !== "__empty__" && c !== "expansions");
    const matched = realCats.filter((c) => vocab[c].some((ln) => ln && vocabMatches(ln, "sven")));
    expect(matched).toEqual(["lad"]);
  });
});

describe("e2e vocab search — multi-word phrases", () => {
  test('the whole phrase "må bra" matches its line', () => {
    expect(vocabMatches(line("wellbeing"), "må bra")).toBe(true);
  });
  test('a bare component word "bra" does NOT exact-match the phrase "må bra"', () => {
    expect(vocabMatches(line("wellbeing"), "bra")).toBe(false);
  });
  test('the whole phrase "brusa upp" matches, but bare "brusa" does not', () => {
    expect(vocabMatches(line("anger"), "brusa upp")).toBe(true);
    expect(vocabMatches(line("anger"), "brusa")).toBe(false);
  });
});

describe("e2e vocab search — <* expansion refs", () => {
  test('a conjugated form "bestod av" matches "<*bestå av" via the expansion map', () => {
    expect(vocabMatches(line("include"), "bestod av")).toBe(true);
  });
  test('the base phrase "bestå av" matches too', () => {
    expect(vocabMatches(line("include"), "bestå av")).toBe(true);
  });
  test('the bare verb "bestå" (without "av") does NOT match the phrase "bestå av"', () => {
    expect(vocabMatches(line("include"), "bestå")).toBe(false);
  });
});

describe("e2e vocab search — (ngt) hint becomes a subtitle-matching wildcard", () => {
  // "(ngt)" isn't a literal phrase; expandWords turns "sett till (ngt)" into the
  // regex fragment "sett till [^ ]*", meant to match a real subtitle line where
  // some word fills the slot.
  const expandedRegarding = expandWords(line("regarding"), "sv", expansionMap);
  const wildcardPhrase = expandedRegarding.split("|")[0]; // "sett till [^ ]*"
  const re = new RegExp(relaxSpaces(withWordBoundaries(wildcardPhrase)), "i");

  test('expandWords produces the "[^ ]*" wildcard for a (ngt) slot', () => {
    expect(wildcardPhrase).toBe("sett till [^ ]*");
  });
  test("the wildcard matches a subtitle where a word fills the slot", () => {
    expect(re.test("vi har sett till huset idag")).toBe(true);
  });
  test('the wildcard does NOT match unrelated "sett" usages', () => {
    expect(re.test("jag har sett fram emot")).toBe(false);
  });
});

// ── Real SRT snippet (verbatim cues from a corpus .sv.srt) ──
const SRT_SNIPPET = `1
00:30:08,720 --> 00:30:10,240
inte dagis Du får inte välja vilken bok

2
00:30:10,240 --> 00:30:11,799
du vill nej men jag vill väl för fan

3
00:30:11,799 --> 00:30:14,200
inte läsa någon jävla patrask bok Jag`;

describe("e2e SRT search over a real snippet", () => {
  const cues = srtToJson(SRT_SNIPPET, "sv");
  const cueIndicesMatching = (search) => {
    const re = new RegExp(relaxSpaces(withWordBoundaries(search)), "i");
    return cues.filter((c) => re.test(c.text)).map((c) => c.index);
  };

  test("srtToJson parses the three cues with timestamps", () => {
    expect(cues.map((c) => c.index)).toEqual(["1", "2", "3"]);
    expect(cues[0].start.ordinal).toBeCloseTo(1808.72, 2); // 00:30:08,720
  });
  test('"bok" matches the two cues that contain it', () => {
    expect(cueIndicesMatching("bok")).toEqual(["1", "3"]);
  });
  test('"väl" matches only cue 2 — NOT "välja" in cue 1 (word boundary)', () => {
    expect(cueIndicesMatching("väl")).toEqual(["2"]);
  });
  test('"vill" matches only cue 2 — NOT "vilken" in cue 1', () => {
    expect(cueIndicesMatching("vill")).toEqual(["2"]);
  });
});
