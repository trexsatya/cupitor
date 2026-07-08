import {
  nextRandomPlaylistName,
  collectManualItems,
  matchingPositions,
  buildAutoItemsForWord,
  sampleAndGroup,
  wordsForCategories,
  contiguousClipWindow,
  wordsAroundInLine,
} from "./random-playlist";

// A shuffle that leaves order untouched — makes sampling deterministic in tests.
const noShuffle = (arr) => arr.slice();

describe("nextRandomPlaylistName", () => {
  test("returns Random-1 when no Random-N playlists exist", () => {
    expect(nextRandomPlaylistName([])).toBe("Random-1");
    expect(nextRandomPlaylistName(["Week 1", "Idioms"])).toBe("Random-1");
  });

  test("skips taken numbers and returns the first free Random-N", () => {
    expect(nextRandomPlaylistName(["Random-1", "Random-2", "Idioms"])).toBe("Random-3");
  });

  test("fills a gap rather than always taking max+1", () => {
    expect(nextRandomPlaylistName(["Random-1", "Random-3"])).toBe("Random-2");
  });
});

describe("collectManualItems", () => {
  const cap = (id, lineIndex, extra = {}) => ({ id, lineIndex, searchText: "st", word: "w", ...extra });
  const recordings = {
    "Week 1": { items: { st: { w: [cap("v1", 1), cap("v2", 2)] } } },
    "Idioms": { items: { st: { w: [cap("v3", 3)] }, Manual: { Card: [{ manual: true, id: "m1" }] } } },
    "Combo": { virtual: true, members: ["Week 1"] },
  };

  test("empty playlists selection = all real playlists", () => {
    const out = collectManualItems(recordings, []);
    expect(out.map((t) => t.it.id).sort()).toEqual(["v1", "v2", "v3"]);
  });

  test("restricts to the named playlists", () => {
    const out = collectManualItems(recordings, ["Week 1"]);
    expect(out.map((t) => t.it.id).sort()).toEqual(["v1", "v2"]);
  });

  test("excludes manual flashcards and virtual playlists", () => {
    const out = collectManualItems(recordings, ["Idioms", "Combo"]);
    expect(out.map((t) => t.it.id)).toEqual(["v3"]);
  });

  test("returns {st,w,it} tuples", () => {
    const [t] = collectManualItems(recordings, ["Week 1"]);
    expect(t).toEqual({ st: "st", w: "w", it: cap("v1", 1) });
  });
});

describe("matchingPositions", () => {
  const lines = [
    { index: 1, text: "god morgon" },
    { index: 2, text: "hej på dig" },
    { index: 3, text: "vi ses hej" },
    { index: 4, text: "" },
  ];
  test("returns array positions whose text matches the regex", () => {
    expect(matchingPositions(lines, /\bhej\b/i)).toEqual([1, 2]);
  });
  test("empty when nothing matches", () => {
    expect(matchingPositions(lines, /\bkatt\b/i)).toEqual([]);
  });
});

describe("buildAutoItemsForWord", () => {
  const lines = [
    { index: 10, ts: 0, te: 2 },
    { index: 11, ts: 2, te: 4 },
    { index: 12, ts: 4, te: 6 },
    { index: 13, ts: 6, te: 8 },
    { index: 14, ts: 8, te: 10 },
  ];
  const match = (pos) => ({ link: "vid1", source: "yt", lines, pos });

  test("captures a ±N window: timeStart/timeEnd span the neighborhood, lineIndex = matched entry index", () => {
    const [t] = buildAutoItemsForWord("hej", [match(2)], { matchesPerWord: 1, contextLines: 1, shuffle: noShuffle });
    expect(t).toEqual({
      st: "hej",
      w: "hej",
      it: { searchText: "hej", word: "hej", id: "vid1", source: "yt", timeStart: 2, timeEnd: 8, lineIndex: 12, enabled: true },
    });
  });

  test("clamps at the start of the file", () => {
    const [t] = buildAutoItemsForWord("hej", [match(0)], { matchesPerWord: 1, contextLines: 2, shuffle: noShuffle });
    expect(t.it.timeStart).toBe(0);
    expect(t.it.timeEnd).toBe(6);
    expect(t.it.lineIndex).toBe(10);
  });

  test("clamps at the end of the file", () => {
    const [t] = buildAutoItemsForWord("hej", [match(4)], { matchesPerWord: 1, contextLines: 2, shuffle: noShuffle });
    expect(t.it.timeStart).toBe(4);
    expect(t.it.timeEnd).toBe(10);
    expect(t.it.lineIndex).toBe(14);
  });

  test("contextLines=0 → just the matched line", () => {
    const [t] = buildAutoItemsForWord("hej", [match(2)], { matchesPerWord: 1, contextLines: 0, shuffle: noShuffle });
    expect(t.it.timeStart).toBe(4);
    expect(t.it.timeEnd).toBe(6);
  });

  test("caps at matchesPerWord across all matches", () => {
    const out = buildAutoItemsForWord("hej", [match(1), match(2), match(3)], { matchesPerWord: 2, contextLines: 0, shuffle: noShuffle });
    expect(out).toHaveLength(2);
    expect(out.map((t) => t.it.lineIndex)).toEqual([11, 12]);
  });

  test("returns nothing when the word has no matches", () => {
    expect(buildAutoItemsForWord("hej", [], { matchesPerWord: 1, contextLines: 2, shuffle: noShuffle })).toEqual([]);
  });

  test("labels the item with the per-match surface word (a single word), not the expanded alternation", () => {
    const [t] = buildAutoItemsForWord("går|gick", [{ ...match(0), word: "gick" }], { matchesPerWord: 1, contextLines: 0, shuffle: noShuffle });
    expect(t.st).toBe("gick");
    expect(t.w).toBe("gick");
    expect(t.it.searchText).toBe("gick");
    expect(t.it.word).toBe("gick");
  });

  test("falls back to the passed word when a match has no surface word", () => {
    const [t] = buildAutoItemsForWord("hej", [match(0)], { matchesPerWord: 1, contextLines: 0, shuffle: noShuffle });
    expect(t.it.word).toBe("hej");
  });
});

describe("contiguousClipWindow", () => {
  const contig = [
    { ts: 0, te: 2 }, { ts: 2, te: 4 }, { ts: 4, te: 6 }, { ts: 6, te: 8 }, { ts: 8, te: 10 },
  ];

  test("contiguous cues: run spans the whole array", () => {
    const w = contiguousClipWindow(contig, 2);
    expect(w).toEqual({ fromPos: 0, toPos: 4, timeStart: 0, timeEnd: 10 });
  });

  test("restricts the walk to [loBound, hiBound]", () => {
    const w = contiguousClipWindow(contig, 2, { loBound: 1, hiBound: 3 });
    expect(w).toEqual({ fromPos: 1, toPos: 3, timeStart: 2, timeEnd: 8 });
  });

  test("a gap larger than threshold stops the walk on that side", () => {
    const cues = [
      { ts: 0, te: 2 }, { ts: 2, te: 4 }, { ts: 104, te: 106 }, { ts: 106, te: 108 },
    ];
    // anchor at pos 2: walking left hits the 100s gap → stops; right is contiguous.
    const w = contiguousClipWindow(cues, 2, { gapThreshold: 1.5 });
    expect(w).toEqual({ fromPos: 2, toPos: 3, timeStart: 104, timeEnd: 108 });
  });

  test("gaps on both sides → anchor-only window", () => {
    const cues = [{ ts: 0, te: 2 }, { ts: 50, te: 52 }, { ts: 100, te: 102 }];
    const w = contiguousClipWindow(cues, 1, { gapThreshold: 1.5 });
    expect(w).toEqual({ fromPos: 1, toPos: 1, timeStart: 50, timeEnd: 52 });
  });

  test("gap exactly at the threshold is still adjacent (inclusive)", () => {
    const cues = [{ ts: 0, te: 2 }, { ts: 3.5, te: 5.5 }];
    const w = contiguousClipWindow(cues, 1, { gapThreshold: 1.5 });
    expect(w.fromPos).toBe(0);
    expect(w.timeStart).toBe(0);
  });

  test("clamps a run longer than maxDuration, keeping the anchor cue covered", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ts: i * 2, te: i * 2 + 2 }));
    const w = contiguousClipWindow(many, 10, { gapThreshold: 1.5, maxDuration: 25 });
    expect(w.timeEnd - w.timeStart).toBeLessThanOrEqual(25 + 1e-9);
    expect(w.timeStart).toBeLessThanOrEqual(20); // anchor cue [20,22] fully inside
    expect(w.timeEnd).toBeGreaterThanOrEqual(22);
    expect(20 - w.timeStart).toBeLessThanOrEqual(25 * 0.25 + 1e-9); // lead ≤ 25% of cap
  });

  test("maxDuration Infinity → no clamp", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ts: i * 2, te: i * 2 + 2 }));
    const w = contiguousClipWindow(many, 10, { gapThreshold: 1.5, maxDuration: Infinity });
    expect(w.timeStart).toBe(0);
    expect(w.timeEnd).toBe(40);
  });

  test("empty cues → zero window, no throw", () => {
    expect(contiguousClipWindow([], 0)).toEqual({ fromPos: 0, toPos: 0, timeStart: 0, timeEnd: 0 });
  });

  test("out-of-range anchor → zero window", () => {
    expect(contiguousClipWindow(contig, 99)).toEqual({ fromPos: 0, toPos: 0, timeStart: 0, timeEnd: 0 });
  });

  test("non-finite anchor times → anchor-only window with zero times", () => {
    const cues = [{ ts: 0, te: 2 }, { ts: undefined, te: null }, { ts: 4, te: 6 }];
    const w = contiguousClipWindow(cues, 1);
    expect(w).toEqual({ fromPos: 1, toPos: 1, timeStart: 0, timeEnd: 0 });
  });
});

describe("wordsAroundInLine", () => {
  test("counts words before and after the first whole-word occurrence", () => {
    expect(wordsAroundInLine("one two three W four five", "W")).toEqual({ before: 3, after: 2 });
  });
  test("word at the start → 0 before", () => {
    expect(wordsAroundInLine("W trailing words here", "W")).toEqual({ before: 0, after: 3 });
  });
  test("word at the end → 0 after", () => {
    expect(wordsAroundInLine("leading words then W", "W")).toEqual({ before: 3, after: 0 });
  });
  test("Swedish whole-word boundary (does not match inside a longer word)", () => {
    expect(wordsAroundInLine("jag heter växa idag", "växa")).toEqual({ before: 2, after: 1 });
    expect(wordsAroundInLine("en växande sak", "växa")).toEqual({ before: 0, after: 0 });
  });
  test("word absent / empty inputs → 0/0 (caller then adds context)", () => {
    expect(wordsAroundInLine("no target here", "ZZZ")).toEqual({ before: 0, after: 0 });
    expect(wordsAroundInLine("", "W")).toEqual({ before: 0, after: 0 });
    expect(wordsAroundInLine("some words", "")).toEqual({ before: 0, after: 0 });
  });
});

describe("buildAutoItemsForWord — word-count context (minWordsAround)", () => {
  test("matched line already has ≥ n words each side → no context lines added", () => {
    const lines = [
      { index: 1, ts: 0, te: 2, text: "aaa bbb ccc" },
      { index: 2, ts: 2, te: 4, text: "one two three W four five six" }, // 3 before, 3 after
      { index: 3, ts: 4, te: 6, text: "ddd eee fff" },
    ];
    const [t] = buildAutoItemsForWord("W", [{ link: "v", source: "yt", lines, pos: 1, word: "W" }],
      { matchesPerWord: 1, contextLines: 5, minWordsAround: 3, shuffle: noShuffle });
    expect(t.it.timeStart).toBe(2);
    expect(t.it.timeEnd).toBe(4);
  });

  test("short matched line → grows both sides up to the contextLines cap until n words", () => {
    const lines = [
      { index: 1, ts: 0, te: 2, text: "p q r s t" },
      { index: 2, ts: 2, te: 4, text: "W" },
      { index: 3, ts: 4, te: 6, text: "a b c d e" },
      { index: 4, ts: 6, te: 8, text: "f g" },
    ];
    const [t] = buildAutoItemsForWord("W", [{ link: "v", source: "yt", lines, pos: 1, word: "W" }],
      { matchesPerWord: 1, contextLines: 5, minWordsAround: 4, shuffle: noShuffle });
    expect(t.it.timeStart).toBe(0); // grew left one line (5 words ≥ 4)
    expect(t.it.timeEnd).toBe(6);   // grew right one line (5 words ≥ 4)
  });

  test("grows only the deficient side", () => {
    const lines = [
      { index: 1, ts: 0, te: 2, text: "x" },
      { index: 2, ts: 2, te: 4, text: "W four five six seven" }, // 0 before, 4 after
      { index: 3, ts: 4, te: 6, text: "later" },
    ];
    const [t] = buildAutoItemsForWord("W", [{ link: "v", source: "yt", lines, pos: 1, word: "W" }],
      { matchesPerWord: 1, contextLines: 2, minWordsAround: 4, shuffle: noShuffle });
    expect(t.it.timeStart).toBe(0); // grew left (needed words before)
    expect(t.it.timeEnd).toBe(4);   // did NOT grow right (already had 4 after)
  });

  test("honours the contextLines cap even when still short of n words", () => {
    const lines = [
      { index: 1, ts: 0, te: 2, text: "a" },
      { index: 2, ts: 2, te: 4, text: "b" },
      { index: 3, ts: 4, te: 6, text: "W" },
      { index: 4, ts: 6, te: 8, text: "c" },
      { index: 5, ts: 8, te: 10, text: "d" },
    ];
    const [t] = buildAutoItemsForWord("W", [{ link: "v", source: "yt", lines, pos: 2, word: "W" }],
      { matchesPerWord: 1, contextLines: 1, minWordsAround: 10, shuffle: noShuffle });
    expect(t.it.timeStart).toBe(2); // capped at 1 line each side despite < 10 words
    expect(t.it.timeEnd).toBe(8);
  });

  test("default (minWordsAround unset) preserves the old ±contextLines behavior", () => {
    const lines = [
      { index: 10, ts: 0, te: 2, text: "aa bb" },
      { index: 11, ts: 2, te: 4, text: "W" },
      { index: 12, ts: 4, te: 6, text: "cc dd" },
    ];
    const [t] = buildAutoItemsForWord("W", [{ link: "v", source: "yt", lines, pos: 1, word: "W" }],
      { matchesPerWord: 1, contextLines: 1, shuffle: noShuffle });
    expect(t.it.timeStart).toBe(0); // full ±1 window
    expect(t.it.timeEnd).toBe(6);
  });
});

describe("buildAutoItemsForWord — sparse-snippet gap handling", () => {
  test("does not span a large temporal gap inside the ±N window", () => {
    const sparse = [
      { index: 1, ts: 0, te: 2 },
      { index: 2, ts: 2, te: 4 },     // matched line
      { index: 3, ts: 300, te: 302 }, // stitched-in cue from a distant part of the video
      { index: 4, ts: 302, te: 304 },
    ];
    const [t] = buildAutoItemsForWord(
      "hej",
      [{ link: "v", source: "yt", lines: sparse, pos: 1 }],
      { matchesPerWord: 1, contextLines: 2, shuffle: noShuffle }
    );
    // Naive ±2 would be [0, 304]; contiguous run around pos 1 is [0, 4].
    expect(t.it.timeStart).toBe(0);
    expect(t.it.timeEnd).toBe(4);
    expect(t.it.lineIndex).toBe(2);
  });

  test("caps an over-long contiguous run at maxDuration", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ index: i + 1, ts: i * 2, te: i * 2 + 2 }));
    const [t] = buildAutoItemsForWord(
      "hej",
      [{ link: "v", source: "yt", lines: many, pos: 15 }],
      { matchesPerWord: 1, contextLines: 20, shuffle: noShuffle, maxDuration: 25 }
    );
    expect(t.it.timeEnd - t.it.timeStart).toBeLessThanOrEqual(25 + 1e-9);
  });
});

describe("wordsForCategories", () => {
  const vocab = { Greetings: ["hej", "god morgon"], Verbs: ["springa"], expansions: ["ignore"] };
  const hidden = new Set(["expansions"]);

  test("empty categories = all non-hidden categories", () => {
    expect(wordsForCategories(vocab, [], hidden).sort()).toEqual(["god morgon", "hej", "springa"]);
  });
  test("restricts to the named categories and skips hidden ones", () => {
    expect(wordsForCategories(vocab, ["Greetings", "expansions"], hidden).sort()).toEqual(["god morgon", "hej"]);
  });
});

describe("sampleAndGroup", () => {
  const tup = (id, lineIndex, st = "s", w = "wd") => ({ st, w, it: { id, lineIndex, searchText: st, word: w } });

  test("dedupes by (id, lineIndex)", () => {
    const grouped = sampleAndGroup([tup("v1", 1), tup("v1", 1), tup("v2", 2)], { count: 50, shuffle: noShuffle });
    expect(grouped.s.wd).toHaveLength(2);
  });

  test("slices to count", () => {
    const tuples = [tup("v1", 1), tup("v2", 2), tup("v3", 3)];
    const grouped = sampleAndGroup(tuples, { count: 2, shuffle: noShuffle });
    const total = Object.values(grouped).flatMap((byW) => Object.values(byW)).flat().length;
    expect(total).toBe(2);
  });

  test("groups into items[st][w] and deep-copies (no aliasing)", () => {
    const src = tup("v1", 1);
    const grouped = sampleAndGroup([src], { count: 50, shuffle: noShuffle });
    expect(grouped.s.wd[0]).toEqual(src.it);
    grouped.s.wd[0].id = "mutated";
    expect(src.it.id).toBe("v1");
  });

  test("empty pool → empty object", () => {
    expect(sampleAndGroup([], { count: 50, shuffle: noShuffle })).toEqual({});
  });
});
