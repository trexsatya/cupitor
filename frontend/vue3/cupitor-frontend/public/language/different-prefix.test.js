import {
  COMMON_PREFIXES,
  _stripPrefix,
  findDifferentPrefixMatches,
} from "./different-prefix";
import { vocabSuffixOverlapLen } from "./vocab-search";

describe("_stripPrefix", () => {
  const sv = COMMON_PREFIXES.sv.slice().sort((a, b) => b.length - a.length);

  test("strips 'be-' from 'bevara'", () => {
    expect(_stripPrefix("bevara", sv)).toEqual({ prefix: "be", stem: "vara" });
  });
  test("strips 'för-' from 'förvärva'", () => {
    expect(_stripPrefix("förvärva", sv)).toEqual({ prefix: "för", stem: "värva" });
  });
  test("longest matching prefix wins ('genom-' before 'ge-')", () => {
    // "genomgång" — 'genom' strips to 'gång' (4 chars) ✓
    expect(_stripPrefix("genomgång", sv)).toEqual({ prefix: "genom", stem: "gång" });
  });
  test("strip is skipped when both prefixes would leave a too-short stem", () => {
    // 'genomgå' - 'genom' = 'gå' (2 chars, too short) — no rule strips.
    expect(_stripPrefix("genomgå", sv)).toEqual({ prefix: "", stem: "genomgå" });
  });
  test("won't reduce a word past a 3-char stem floor", () => {
    // 'bevis' minus 'be-' would leave 'vis' (3) — passes.
    expect(_stripPrefix("bevis", sv)).toEqual({ prefix: "be", stem: "vis" });
    // 'beta' minus 'be-' leaves 'ta' (2) — fail, no strip.
    expect(_stripPrefix("beta", sv)).toEqual({ prefix: "", stem: "beta" });
  });
  test("returns prefix='' when nothing matches", () => {
    expect(_stripPrefix("xylofon", sv)).toEqual({ prefix: "", stem: "xylofon" });
  });
});

describe("findDifferentPrefixMatches", () => {
  // Build a deterministic line list for testing. Categories are flattened
  // by the caller in production; here we just supply two parallel arrays.
  const lines = [
    "(preserve)|förvara|förvarade|förvarar|",        // 0
    "(beware)|akta|akta sig|",                       // 1
    "(eat)| äta | åt | ätit |",                      // 2 — for weak-overlap path
    "(stop)|stoppa|hejda|",                          // 3 — unrelated
    "(spell)|trolla|förtrolla|trollkarl|",           // 4
    "(believe)|tro|tror|trodde|",                    // 5 — too generic, but matches "tro" stem
  ];
  const cats = ["Verbs", "Verbs", "Food", "Verbs", "Magic", "Mind"];

  test("'bevara' → stem 'vara', finds 'förvara' line", () => {
    const res = findDifferentPrefixMatches("bevara", "sv", lines, cats, vocabSuffixOverlapLen);
    expect(res.stem).toBe("vara");
    expect(res.origPrefix).toBe("be");
    const prefHits = res.results.filter(r => r.kind === "prefix");
    // Expect at least the "förvara" line to surface via candidate "förvara".
    const forVaraHit = prefHits.find(r => r.lineIdx === 0);
    expect(forVaraHit).toBeTruthy();
    expect(forVaraHit.candidate).toBe("förvara");
    expect(forVaraHit.prefix).toBe("för");
  });

  test("'gråt' → stem 'råt' (g- isn't a Swedish prefix here) → falls through to suffix overlap", () => {
    const res = findDifferentPrefixMatches("gråt", "sv", lines, cats, vocabSuffixOverlapLen);
    // 'g' isn't in COMMON_PREFIXES.sv, so no strip; stem stays "gråt".
    expect(res.origPrefix).toBe("");
    expect(res.stem).toBe("gråt");
    // (b) pass: "äta|åt|ätit" has the bare "åt" segment with LCS=2 vs "gråt".
    const overlapHits = res.results.filter(r => r.kind === "overlap");
    expect(overlapHits.some(r => r.lineIdx === 2)).toBe(true);
  });

  test("returns empty when stem is too short", () => {
    // "abc" stripped (no matching prefix) leaves "abc" which is exactly 3
    // chars, but the function bails earlier: stem.length < 3 short-circuits.
    const res = findDifferentPrefixMatches("ab", "sv", lines, cats, vocabSuffixOverlapLen);
    expect(res.results).toEqual([]);
  });

  test("empty / null search returns empty result with no stem", () => {
    expect(findDifferentPrefixMatches("", "sv", lines, cats, vocabSuffixOverlapLen))
      .toEqual({ stem: "", origPrefix: "", results: [] });
    expect(findDifferentPrefixMatches(null, "sv", lines, cats, vocabSuffixOverlapLen))
      .toEqual({ stem: "", origPrefix: "", results: [] });
  });

  test("unknown lang falls back to Swedish prefix list", () => {
    const res = findDifferentPrefixMatches("bevara", "de", lines, cats, vocabSuffixOverlapLen);
    expect(res.stem).toBe("vara");
    expect(res.origPrefix).toBe("be");
  });

  test("each line is reported at most once (prefix wins over overlap)", () => {
    const res = findDifferentPrefixMatches("bevara", "sv", lines, cats, vocabSuffixOverlapLen);
    const ids = res.results.map(r => r.lineIdx);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("suffix-overlap callback is optional", () => {
    const res = findDifferentPrefixMatches("bevara", "sv", lines, cats, null);
    // (a) prefix matches still come through; (b) overlap matches are skipped.
    expect(res.results.every(r => r.kind === "prefix")).toBe(true);
  });

  test("category badge is propagated to each result", () => {
    const res = findDifferentPrefixMatches("bevara", "sv", lines, cats, vocabSuffixOverlapLen);
    for (const r of res.results) {
      expect(cats[r.lineIdx]).toBe(r.category);
    }
  });
});
