import {
  sanitizeFilenameSegment,
  buildCapturedSubtitleBaseName,
} from "./subtitle-naming";

describe("sanitizeFilenameSegment", () => {
  test("returns empty string for null/empty", () => {
    expect(sanitizeFilenameSegment(null)).toBe("");
    expect(sanitizeFilenameSegment("")).toBe("");
  });

  test("replaces filesystem/URL-reserved chars (incl. fullwidth colon) with _", () => {
    expect(sanitizeFilenameSegment('a/b\\c:d*e?f"g<h>i|j：k')).toBe(
      "a_b_c_d_e_f_g_h_i_j_k"
    );
  });

  test("collapses whitespace and repeated underscores, trims edges", () => {
    expect(sanitizeFilenameSegment("  hello   world  ")).toBe("hello world");
    expect(sanitizeFilenameSegment("a___b")).toBe("a_b");
    expect(sanitizeFilenameSegment("_ padded _")).toBe("padded");
    expect(sanitizeFilenameSegment("line1\n\tline2")).toBe("line1 line2");
  });

  test("preserves Swedish letters and fullwidth quote/question marks", () => {
    expect(sanitizeFilenameSegment("Åäö ＂konsten＂ att？")).toBe(
      "Åäö ＂konsten＂ att？"
    );
  });

  test("truncates to maxLen and trims a trailing space/underscore left by the cut", () => {
    expect(sanitizeFilenameSegment("abcdefghij", 5)).toBe("abcde");
    expect(sanitizeFilenameSegment("abcd efgh", 5)).toBe("abcd");
  });
});

describe("buildCapturedSubtitleBaseName", () => {
  test("joins channel || title || id (NFC-normalized)", () => {
    expect(
      buildCapturedSubtitleBaseName({
        videoId: "ID123",
        videoTitle: "My Title",
        channel: "Chan",
      })
    ).toBe("Chan || My Title || ID123");
  });

  test("channel falls back to title, then to id", () => {
    expect(
      buildCapturedSubtitleBaseName({ videoId: "ID", videoTitle: "T" })
    ).toBe("T || T || ID");
    expect(buildCapturedSubtitleBaseName({ videoId: "ID" })).toBe(
      "ID || ID || ID"
    );
  });

  test("sanitizes each segment (reserved chars → _)", () => {
    expect(
      buildCapturedSubtitleBaseName({
        videoId: "abc",
        videoTitle: "a: b",
        channel: "c/d",
      })
    ).toBe("c_d || a_ b || abc");
  });
});
