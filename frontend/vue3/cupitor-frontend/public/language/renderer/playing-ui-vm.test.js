import {
  buildBoundedWordRe,
  phraseFoundInTexts,
  highlightWordHtml,
  findLineByTime,
  buildPlayingBannerVM,
  buildPlayingSubsVM,
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
});
