import {
  buildBoundedWordRe,
  phraseFoundInTexts,
  highlightWordHtml,
  findLineByTime,
  buildPlayingBannerVM,
  buildPlayingSubsVM,
  contiguousPlayWindow,
} from "./playing-ui-vm";

describe("buildBoundedWordRe", () => {
  test("matches a whole word but not as substring", () => {
    const re = buildBoundedWordRe("troll");
    expect("a troll walks".match(re)).not.toBeNull();
    expect("trollguld here".match(re)).toBeNull();
  });
  test("Unicode-aware boundary: doesn't match inside Swedish words", () => {
    const re = buildBoundedWordRe("växa");
    expect("växande".match(re)).toBeNull();
    expect("växa".match(re)).not.toBeNull();
  });
});

describe("phraseFoundInTexts", () => {
  test("true when the phrase appears whole in one row", () => {
    expect(phraseFoundInTexts(["foo bar baz", "qux"], "bar")).toBe(true);
  });
  test("false when the phrase is split across rows", () => {
    expect(phraseFoundInTexts(["a b", "c d"], "b c")).toBe(false);
  });
  test("false for empty/falsy inputs", () => {
    expect(phraseFoundInTexts([], "x")).toBe(false);
    expect(phraseFoundInTexts(["x"], "")).toBe(false);
    expect(phraseFoundInTexts(null, "x")).toBe(false);
  });
  test("trims word whitespace", () => {
    expect(phraseFoundInTexts(["hello world"], "  world  ")).toBe(true);
  });
});

describe("highlightWordHtml", () => {
  test("wraps every match in <mark class='hl-word'>", () => {
    expect(highlightWordHtml("foo bar foo", "foo"))
      .toBe('<mark class="hl-word">foo</mark> bar <mark class="hl-word">foo</mark>');
  });
  test("escapes ambient HTML", () => {
    expect(highlightWordHtml("<i>x</i>", "x"))
      .toBe('&lt;i&gt;<mark class="hl-word">x</mark>&lt;/i&gt;');
  });
  test("returns plain escaped text when word is empty", () => {
    expect(highlightWordHtml("<b>foo</b>", ""))
      .toBe("&lt;b&gt;foo&lt;/b&gt;");
  });
  test("multi-word phrase: matches as a whole when present", () => {
    expect(highlightWordHtml("i förväg ok", "i förväg"))
      .toBe('<mark class="hl-word">i förväg</mark> ok');
  });
  test("multi-word phrase: token fallback when whole phrase absent (allowTokens true)", () => {
    // Phrase 'a b' not present as whole; tokens 'a' and 'b' fall back.
    const out = highlightWordHtml("a foo b", "a b");
    expect(out).toContain('<mark class="hl-word">a</mark>');
    expect(out).toContain('<mark class="hl-word">b</mark>');
  });
  test("allowTokens=false suppresses the per-token fallback", () => {
    const out = highlightWordHtml("a foo b", "a b", { allowTokens: false });
    expect(out).toBe("a foo b");
  });
});

describe("findLineByTime", () => {
  const lines = [
    { start: { ordinal: 0 },  end: { ordinal: 2 }  },
    { start: { ordinal: 2 },  end: { ordinal: 5 }  },
    { start: { ordinal: 5 },  end: { ordinal: 10 } },
  ];
  test("picks the line whose [start, end) brackets t", () => {
    expect(findLineByTime(lines, 0.5)).toBe(0);
    expect(findLineByTime(lines, 3)).toBe(1);
    expect(findLineByTime(lines, 7)).toBe(2);
  });
  test("end is exclusive: t at end transitions to the next line", () => {
    expect(findLineByTime(lines, 5)).toBe(2);
  });
  test("returns the first line at-or-after t when nothing brackets it", () => {
    // Build a list with a gap.
    const gap = [{ start: { ordinal: 0 }, end: { ordinal: 2 } }, { start: { ordinal: 10 } }];
    expect(findLineByTime(gap, 5)).toBe(1);
  });
  test("returns -1 for empty / null input", () => {
    expect(findLineByTime([], 0)).toBe(-1);
    expect(findLineByTime(null, 0)).toBe(-1);
  });
});

describe("buildPlayingBannerVM", () => {
  test("progressText is N/M (1-indexed)", () => {
    const out = buildPlayingBannerVM({ word: "x" }, 4, 10, 30);
    expect(out.progressText).toBe("5/10");
  });
  test("manual item has 📝 head and link badge for youtube URL", () => {
    const out = buildPlayingBannerVM({
      manual: true, source: "src", target: "tgt", mediaUrl: "yt", mediaKind: "youtube"
    }, 0, 1, 30);
    expect(out.isManual).toBe(true);
    expect(out.headText).toBe("📝 src");
    expect(out.metaText).toBe("tgt · ▶ YouTube");
  });
  test("manual without media has no link badge", () => {
    const out = buildPlayingBannerVM({ manual: true, source: "a", target: "b" }, 0, 1, 30);
    expect(out.metaText).toBe("b");
  });
  test("non-manual item has ▶ head + meta line", () => {
    const out = buildPlayingBannerVM({
      searchText: "hej", word: "world", id: "vid", source: "yt",
      timeStart: 10, timeEnd: 15
    }, 0, 1, 30);
    expect(out.isManual).toBe(false);
    expect(out.headText).toBe('▶ "hej" → world');
    expect(out.metaText).toBe("vid · yt · 10s – 15s");
    expect(out.word).toBe("world");
  });
  // Practising the deck backwards turns the card over: the Target face becomes
  // the prompt. Only the two faces swap — the link badge stays where it is.
  test("reversed manual item shows target as the prompt", () => {
    const out = buildPlayingBannerVM({
      manual: true, source: "src", target: "tgt", mediaUrl: "yt", mediaKind: "youtube"
    }, 0, 1, 30, true);
    expect(out.headText).toBe("📝 tgt");
    expect(out.metaText).toBe("src · ▶ YouTube");
  });
  test("reversed empty face still reads (empty), on whichever side it lands", () => {
    const out = buildPlayingBannerVM({ manual: true, source: "a", target: "" }, 0, 1, 30, true);
    expect(out.headText).toBe("📝 (empty)");
    expect(out.metaText).toBe("a");
  });
  // A captured clip has no second side to turn over.
  test("reversed leaves a captured clip alone", () => {
    const it = { searchText: "hej", word: "world", id: "vid", source: "yt", timeStart: 10, timeEnd: 15 };
    expect(buildPlayingBannerVM(it, 0, 1, 30, true)).toEqual(buildPlayingBannerVM(it, 0, 1, 30, false));
  });
  test("gap label falls back to 30 for non-numeric", () => {
    const out = buildPlayingBannerVM({ word: "x" }, 0, 1, "garbage");
    expect(out.gapLabel).toBe("30s");
  });
  test("gap label honours a numeric value", () => {
    const out = buildPlayingBannerVM({ word: "x" }, 0, 1, 5);
    expect(out.gapLabel).toBe("5s");
  });
});

describe("buildPlayingSubsVM", () => {
  function makeParsed(svLines, enLines) {
    return {
      sv: svLines.map((text, i) => ({ index: i, text })),
      en: enLines.map((text, i) => ({ index: i, text })),
    };
  }

  test("'no-primary' when parsed is missing", () => {
    expect(buildPlayingSubsVM({ parsed: null }).state).toBe("no-primary");
    expect(buildPlayingSubsVM({ parsed: { sv: [], en: [] }, lang: "sv", item: {} }).state)
      .toBe("no-primary");
  });
  test("'no-match' when the recorded lineIndex isn't in primary", () => {
    const parsed = makeParsed(["a", "b"], ["A", "B"]);
    const out = buildPlayingSubsVM({ parsed, lang: "sv", item: { lineIndex: 99 } });
    expect(out.state).toBe("no-match");
  });
  test("emits one row per primary line in the [from, to] window", () => {
    const parsed = makeParsed(["a", "b", "c", "d", "e"], ["A", "B", "C", "D", "E"]);
    const out = buildPlayingSubsVM({ parsed, lang: "sv", item: { lineIndex: 2 }, before: 1, after: 1 });
    expect(out.state).toBe("ok");
    expect(out.from).toBe(1);
    expect(out.to).toBe(3);
    expect(out.rows.length).toBe(3);
    expect(out.rows.map(r => r.mainText)).toEqual(["b", "c", "d"]);
    expect(out.rows.map(r => r.secText)).toEqual(["B", "C", "D"]);
  });
  test("active flag marks the matched row", () => {
    const parsed = makeParsed(["a", "b", "c"], ["A", "B", "C"]);
    const out = buildPlayingSubsVM({ parsed, lang: "sv", item: { lineIndex: 1 }, before: 1, after: 1 });
    expect(out.rows.find(r => r.i === 1).active).toBe(true);
    expect(out.rows.find(r => r.i === 0).active).toBe(false);
  });
  test("highlightHtml is set when item has a word", () => {
    const parsed = makeParsed(["hello world"], ["hi"]);
    const out = buildPlayingSubsVM({ parsed, lang: "sv", item: { lineIndex: 0, word: "world" }, before: 0, after: 0 });
    expect(out.rows[0].highlightHtml).toContain("<mark");
  });
  test("highlightHtml is null when item has no word", () => {
    const parsed = makeParsed(["hello"], ["hi"]);
    const out = buildPlayingSubsVM({ parsed, lang: "sv", item: { lineIndex: 0 }, before: 0, after: 0 });
    expect(out.rows[0].highlightHtml).toBeNull();
  });
  test("clamps before/after to the corpus edges", () => {
    const parsed = makeParsed(["a", "b"], ["A", "B"]);
    const out = buildPlayingSubsVM({ parsed, lang: "sv", item: { lineIndex: 0 }, before: 10, after: 10 });
    expect(out.from).toBe(0);
    expect(out.to).toBe(1);
  });
  test("works with 'en' as primary", () => {
    const parsed = makeParsed(["a"], ["A"]);
    const out = buildPlayingSubsVM({ parsed, lang: "en", item: { lineIndex: 0 }, before: 0, after: 0 });
    expect(out.rows[0].mainText).toBe("A");
    expect(out.rows[0].secText).toBe("a");
  });

  // Cues carrying start/end times — needed for the stale-lineIndex recovery.
  function timed(rows) {
    return {
      sv: rows.map((r, i) => ({ index: r.index, text: r.text, start: { ordinal: i * 2 }, end: { ordinal: i * 2 + 2 } })),
      en: [],
    };
  }
  test("recovers via time+word when the recorded lineIndex is stale (SRT re-segmented)", () => {
    const parsed = timed([
      { index: 10, text: "aaa" },
      { index: 11, text: "gå på pinka på natten" },
      { index: 12, text: "ccc" },
    ]);
    // lineIndex 253 no longer exists; timeStart/timeEnd bracket cue #2, word matches it.
    const out = buildPlayingSubsVM({ parsed, lang: "sv", item: { lineIndex: 253, word: "pinka", timeStart: 2, timeEnd: 4 }, before: 0, after: 0 });
    expect(out.state).toBe("ok");
    expect(out.matchIdx).toBe(1);
  });
  test("recovers by time alone when the word isn't in the text (hand-capture: word is the video title)", () => {
    const parsed = timed([
      { index: 10, text: "aaa" },
      { index: 11, text: "bbb" },
    ]);
    const out = buildPlayingSubsVM({ parsed, lang: "sv", item: { lineIndex: 999, word: "Some Video Title", timeStart: 2, timeEnd: 4 }, before: 0, after: 0 });
    expect(out.state).toBe("ok");
    expect(out.matchIdx).toBe(1);
  });
  test("still 'no-match' when lineIndex is absent and there is no time/word anchor", () => {
    const parsed = makeParsed(["a", "b"], ["A", "B"]);
    const out = buildPlayingSubsVM({ parsed, lang: "sv", item: { lineIndex: 99 } });
    expect(out.state).toBe("no-match");
  });
});

describe("contiguousPlayWindow", () => {
  const cue = (index, text, ts, te) => ({ index, text, start: { ordinal: ts }, end: { ordinal: te } });

  test("contracts a stored window that spans a large gap (the overshoot bug)", () => {
    const primary = [
      cue(1, "a", 0, 2),
      cue(2, "b", 2, 4),
      cue(3, "fast here", 320, 323), // matched, right after a 316s gap
      cue(4, "d", 323, 325),
    ];
    // Stored window was the old naive ±2 span [2, 325] that crossed the gap.
    const win = contiguousPlayWindow(primary, { lineIndex: 3, word: "fast", timeStart: 2, timeEnd: 325 }, { gapThreshold: 1.5 });
    expect(win.timeStart).toBe(320);
    expect(win.timeEnd).toBe(325);
    expect(win.matchIdx).toBe(2);
  });

  test("leaves a fully-contiguous stored window unchanged (idempotent)", () => {
    const primary = [cue(1, "a", 0, 2), cue(2, "b matched", 2, 4), cue(3, "c", 4, 6)];
    const win = contiguousPlayWindow(primary, { lineIndex: 2, word: "matched", timeStart: 0, timeEnd: 6 }, { gapThreshold: 1.5 });
    expect(win.timeStart).toBe(0);
    expect(win.timeEnd).toBe(6);
  });

  test("never lengthens beyond the stored window (shrink-only)", () => {
    // 5 contiguous cues span [0,10]; stored window is only [2,6].
    const primary = [0, 1, 2, 3, 4].map((i) => cue(i + 1, i === 2 ? "w" : "x", i * 2, i * 2 + 2));
    const win = contiguousPlayWindow(primary, { lineIndex: 3, word: "w", timeStart: 2, timeEnd: 6 }, { gapThreshold: 1.5 });
    expect(win.timeStart).toBe(2);
    expect(win.timeEnd).toBe(6);
  });

  test("recovers the anchor by time+word when lineIndex is stale", () => {
    const primary = [cue(10, "aaa", 0, 2), cue(11, "gå på pinka", 2, 4), cue(12, "ccc", 4, 6)];
    const win = contiguousPlayWindow(primary, { lineIndex: 253, word: "pinka", timeStart: 2, timeEnd: 4 }, { gapThreshold: 1.5 });
    expect(win.matchIdx).toBe(1);
    expect(win.timeStart).toBe(2);
    expect(win.timeEnd).toBe(4);
  });

  test("returns null for manual items (user-authored clips are never re-clamped)", () => {
    const primary = [cue(1, "a", 0, 2)];
    expect(contiguousPlayWindow(primary, { manual: true, lineIndex: 1 })).toBeNull();
  });

  test("returns null when the cue can't be located", () => {
    const primary = [cue(1, "a", 0, 2), cue(2, "b", 2, 4)];
    expect(contiguousPlayWindow(primary, { lineIndex: 999 })).toBeNull();
  });

  test("returns null for empty / missing primary", () => {
    expect(contiguousPlayWindow([], { lineIndex: 1 })).toBeNull();
    expect(contiguousPlayWindow(null, { lineIndex: 1 })).toBeNull();
  });
});
