import {
  srtError,
  srtToJson,
  toStringSubtitle,
  srtTimeFromValue,
  srtTimeToSeconds,
  parseSrtEntries,
  entriesToSrtText,
  linesToSrtText,
  mergeSrtWithNewEntries,
  mergeSrtWithResolution,
  detectSrtConflicts,
  upsertSrtEntry,
  applyQueuedEditsToText,
} from "./srt-parser";

const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:03,500
Hej världen

2
00:00:04,000 --> 00:00:06,000
Andra raden`;

describe("srtError", () => {
  test("tags the error with kind + isSrtError", () => {
    const e = srtError("notfound", "missing");
    expect(e.kind).toBe("notfound");
    expect(e.isSrtError).toBe(true);
    expect(e.message).toBe("missing");
  });
  test("falls back to kind as message", () => {
    expect(srtError("transient").message).toBe("transient");
  });
});

describe("srtTimeFromValue — canonicalization", () => {
  test("null/undefined → zero string", () => {
    expect(srtTimeFromValue(null)).toBe("00:00:00,000");
    expect(srtTimeFromValue(undefined)).toBe("00:00:00,000");
  });
  test("from {ordinal} object", () => {
    expect(srtTimeFromValue({ ordinal: 65.5 })).toBe("00:01:05,500");
  });
  test("from {seconds} object", () => {
    expect(srtTimeFromValue({ seconds: 3661 })).toBe("01:01:01,000");
  });
  test("from canonical string (comma decimal)", () => {
    expect(srtTimeFromValue("00:00:05,500")).toBe("00:00:05,500");
  });
  test("from dot-decimal string (re-formats to comma)", () => {
    expect(srtTimeFromValue("00:00:05.500")).toBe("00:00:05,500");
  });
  test("pads short ms to 3 digits", () => {
    expect(srtTimeFromValue("00:00:05,5")).toBe("00:00:05,500");
  });
  test("from a numeric value (seconds)", () => {
    expect(srtTimeFromValue(5.5)).toBe("00:00:05,500");
    expect(srtTimeFromValue(3661.456)).toBe("01:01:01,456");
  });
  test("from numeric-string fallback", () => {
    expect(srtTimeFromValue("5.5")).toBe("00:00:05,500");
  });
  test("garbage string → zero", () => {
    expect(srtTimeFromValue("not-a-time")).toBe("00:00:00,000");
  });
});

describe("srtTimeToSeconds", () => {
  test("canonical comma form", () => {
    expect(srtTimeToSeconds("00:00:05,500")).toBe(5.5);
  });
  test("dot decimal", () => {
    expect(srtTimeToSeconds("01:00:00.000")).toBe(3600);
  });
  test("0 for malformed", () => {
    expect(srtTimeToSeconds("garbage")).toBe(0);
  });
});

describe("srtTimeFromValue ↔ srtTimeToSeconds round trip", () => {
  test("seconds → canonical → seconds", () => {
    for (const s of [0, 1.5, 60, 3600, 3661.456]) {
      expect(srtTimeToSeconds(srtTimeFromValue(s))).toBeCloseTo(s, 3);
    }
  });
});

describe("srtToJson", () => {
  test("parses standard SRT into items with ordinals + ts/te strings", () => {
    const items = srtToJson(SAMPLE_SRT, "text");
    expect(items.length).toBe(2);
    expect(items[0].id).toBe("1");
    expect(items[0].start.ordinal).toBe(1);
    expect(items[0].end.ordinal).toBe(3.5);
    expect(items[0].ts).toBe("00:00:01,000");
    expect(items[0].text).toContain("Hej världen");
  });
  test("strips the SVT <c.huvudpratare> tag", () => {
    const out = srtToJson(`1
00:00:01,000 --> 00:00:02,000
<c.huvudpratare>Tagged text`, "text");
    expect(out[0].text).toContain("Tagged text");
    expect(out[0].text).not.toContain("huvudpratare");
  });
  test("mirrors body onto item[lang] when lang is not 'text'", () => {
    const items = srtToJson(SAMPLE_SRT, "sv");
    expect(items[0].sv).toContain("Hej världen");
  });
  test("filters out entries without a start time", () => {
    // First synthetic block has no time-line — should be dropped.
    const out = srtToJson(`1
NOT A TIME LINE
foo

2
00:00:01,000 --> 00:00:02,000
bar`, "text");
    expect(out.length).toBe(1);
    expect(out[0].text).toContain("bar");
  });
});

describe("parseSrtEntries", () => {
  test("parses SRT to {start, end, text} entries", () => {
    const entries = parseSrtEntries(SAMPLE_SRT);
    expect(entries).toEqual([
      { start: "00:00:01,000", end: "00:00:03,500", text: "Hej världen" },
      { start: "00:00:04,000", end: "00:00:06,000", text: "Andra raden" },
    ]);
  });
  test("tolerates missing sequence number", () => {
    const out = parseSrtEntries(`00:00:01,000 --> 00:00:02,000\nhello`);
    expect(out.length).toBe(1);
    expect(out[0].text).toBe("hello");
  });
  test("tolerates \\r\\n line endings", () => {
    const out = parseSrtEntries("1\r\n00:00:01,000 --> 00:00:02,000\r\nhi");
    expect(out.length).toBe(1);
  });
  test("skips blocks without a time-line", () => {
    const out = parseSrtEntries(`1\nbroken\nfoo\n\n2\n00:00:01,000 --> 00:00:02,000\nok`);
    expect(out.length).toBe(1);
    expect(out[0].text).toBe("ok");
  });
  test("returns [] for empty / non-string input", () => {
    expect(parseSrtEntries("")).toEqual([]);
    expect(parseSrtEntries(null)).toEqual([]);
    expect(parseSrtEntries(undefined)).toEqual([]);
  });
});

describe("entriesToSrtText", () => {
  test("renders entries with sequential numbering", () => {
    const entries = [
      { start: "00:00:01,000", end: "00:00:02,000", text: "a" },
      { start: "00:00:03,000", end: "00:00:04,000", text: "b" },
    ];
    expect(entriesToSrtText(entries)).toBe(
      "1\n00:00:01,000 --> 00:00:02,000\na\n\n2\n00:00:03,000 --> 00:00:04,000\nb\n"
    );
  });
});

describe("linesToSrtText", () => {
  test("normalises shape and sorts by start", () => {
    const items = [
      { start: 5, end: 6, text: "second" },
      { start: 1, end: 2, text: "first" },
    ];
    const out = linesToSrtText(items);
    expect(out).toContain("first");
    expect(out.indexOf("first")).toBeLessThan(out.indexOf("second"));
  });
  test("normalises \\r\\n to \\n in text", () => {
    const out = linesToSrtText([{ start: 1, end: 2, text: "a\r\nb" }]);
    expect(out).toContain("a\nb");
    expect(out).not.toContain("\r");
  });
  test("returns just the trailing \\n for empty input", () => {
    expect(linesToSrtText([])).toBe("\n");
    expect(linesToSrtText(null)).toBe("\n");
  });
});

describe("mergeSrtWithNewEntries", () => {
  test("appends non-overlapping new items, sorted by start", () => {
    const out = mergeSrtWithNewEntries(SAMPLE_SRT, [
      { start: "00:00:10,000", end: "00:00:11,000", text: "tail" },
    ]);
    const parsed = parseSrtEntries(out);
    expect(parsed.map(e => e.text)).toEqual(["Hej världen", "Andra raden", "tail"]);
  });
  test("dedupes when start+text matches", () => {
    const out = mergeSrtWithNewEntries(SAMPLE_SRT, [
      { start: "00:00:01,000", end: "00:00:03,500", text: "Hej världen" },
    ]);
    expect(parseSrtEntries(out).length).toBe(2);
  });
});

describe("mergeSrtWithResolution", () => {
  test("'use-new' replaces existing entry at that start", () => {
    const resolution = new Map([
      ["00:00:01,000", { action: "use-new" }]
    ]);
    const out = mergeSrtWithResolution(SAMPLE_SRT, [
      { start: "00:00:01,000", end: "00:00:03,500", text: "REPLACED" }
    ], resolution);
    const parsed = parseSrtEntries(out);
    expect(parsed[0].text).toBe("REPLACED");
  });
  test("'keep' drops the incoming entry", () => {
    const resolution = new Map([
      ["00:00:01,000", { action: "keep" }]
    ]);
    const out = mergeSrtWithResolution(SAMPLE_SRT, [
      { start: "00:00:01,000", end: "00:00:03,500", text: "REPLACED" }
    ], resolution);
    expect(parseSrtEntries(out)[0].text).toBe("Hej världen");
  });
  test("'edit' replaces with the user-supplied text", () => {
    const resolution = new Map([
      ["00:00:01,000", { action: "edit", text: "EDITED" }]
    ]);
    const out = mergeSrtWithResolution(SAMPLE_SRT, [
      { start: "00:00:01,000", end: "00:00:03,500", text: "ignored" }
    ], resolution);
    expect(parseSrtEntries(out)[0].text).toBe("EDITED");
  });
  test("null resolution behaves like mergeSrtWithNewEntries", () => {
    const a = mergeSrtWithResolution(SAMPLE_SRT, [
      { start: "00:00:10,000", end: "00:00:11,000", text: "x" }
    ], null);
    const b = mergeSrtWithNewEntries(SAMPLE_SRT, [
      { start: "00:00:10,000", end: "00:00:11,000", text: "x" }
    ]);
    expect(a).toBe(b);
  });
});

describe("detectSrtConflicts", () => {
  test("flags entries where text differs at the same start", () => {
    const c = detectSrtConflicts(SAMPLE_SRT, [
      { start: "00:00:01,000", end: "00:00:03,500", text: "DIFFERENT" }
    ]);
    expect(c.length).toBe(1);
    expect(c[0].existingText).toBe("Hej världen");
    expect(c[0].incomingText).toBe("DIFFERENT");
  });
  test("does not flag identical text", () => {
    const c = detectSrtConflicts(SAMPLE_SRT, [
      { start: "00:00:01,000", end: "00:00:03,500", text: "Hej världen" }
    ]);
    expect(c).toEqual([]);
  });
  test("does not flag a brand-new start time", () => {
    const c = detectSrtConflicts(SAMPLE_SRT, [
      { start: "00:00:99,000", end: "00:01:00,000", text: "new" }
    ]);
    expect(c).toEqual([]);
  });
  test("returns [] when existing text is empty", () => {
    expect(detectSrtConflicts("", [{ start: 1, end: 2, text: "a" }])).toEqual([]);
  });
});

describe("srtToJson", () => {
  test("returns [] for null/undefined/empty (source-only videos have no .en.srt)", () => {
    expect(srtToJson(null)).toEqual([]);
    expect(srtToJson(undefined)).toEqual([]);
    expect(srtToJson("")).toEqual([]);
  });
});

describe("upsertSrtEntry", () => {
  test("replaces the text of an existing index, keeping its timestamp verbatim", () => {
    const out = upsertSrtEntry(SAMPLE_SRT, { index: 2, start: 999, end: 1000, text: "Ny text" });
    expect(out).toContain("2\n00:00:04,000 --> 00:00:06,000\nNy text");
    // first block untouched, no renumbering, no duplicate blocks
    expect(out).toContain("1\n00:00:01,000 --> 00:00:03,500\nHej världen");
    expect(out.match(/-->/g)).toHaveLength(2);
  });

  test("inserts a missing index in numeric order using the supplied timestamp", () => {
    const src = "1\n00:00:01,000 --> 00:00:02,000\nA\n\n3\n00:00:05,000 --> 00:00:06,000\nC";
    const out = upsertSrtEntry(src, { index: 2, start: 3, end: 4, text: "B" });
    const order = out.trim().split(/\n\s*\n/).map((b) => b.split("\n")[0]);
    expect(order).toEqual(["1", "2", "3"]);
    expect(out).toContain("2\n00:00:03,000 --> 00:00:04,000\nB");
  });

  test("builds a fresh single-entry SRT from empty input", () => {
    expect(upsertSrtEntry("", { index: 5, start: 10, end: 12, text: "Hej" }))
      .toBe("5\n00:00:10,000 --> 00:00:12,000\nHej\n");
  });

  test("leaves text unchanged when the index is missing and no timestamp is given", () => {
    expect(upsertSrtEntry(SAMPLE_SRT, { index: 9, text: "x" })).toBe(SAMPLE_SRT);
  });
});

describe("applyQueuedEditsToText", () => {
  test("updates existing lines in place", () => {
    const out = applyQueuedEditsToText(SAMPLE_SRT, { "2": { newText: "Bytt" } });
    expect(out).toContain("2\n00:00:04,000 --> 00:00:06,000\nBytt");
    expect(out).toContain("Hej världen");
  });

  test("builds a fresh SRT when current is empty and edits carry timestamps", () => {
    const out = applyQueuedEditsToText("", {
      "1": { newText: "Hej", start: 1, end: 3 },
      "2": { newText: "Då", start: 3, end: 5 },
    });
    expect(out).toContain("1\n00:00:01,000 --> 00:00:03,000\nHej");
    expect(out).toContain("2\n00:00:03,000 --> 00:00:05,000\nDå");
  });

  test("returns null when current is empty and edits have no timestamps", () => {
    expect(applyQueuedEditsToText("", { "1": { newText: "Hej" } })).toBeNull();
  });
});

describe("toStringSubtitle", () => {
  test("formats a sub for debug output", () => {
    const s = toStringSubtitle({
      number: 3,
      ts_o: "00:00:01,000",
      te_o: "00:00:02,000",
      sv: "Hej världen this is a longer line so it gets truncated"
    });
    expect(s).toContain("3");
    expect(s).toContain("00:00:01,000 --> 00:00:02,000");
    expect(s).toContain("...");
  });
});
