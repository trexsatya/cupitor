import {
  buildCapturedRowVM,
  pushButtonLabel,
} from "./captured-review-vm";

describe("buildCapturedRowVM", () => {
  test("projects the full detail shape", () => {
    const out = buildCapturedRowVM({
      id: "abc", capturedAt: 0, detail: {
        videoId: "vid1", videoTitle: "Title",
        sourceLang: "sv", targetLang: "en",
        lines: ["a", "b", "c"], translation: ["A", "B"],
        query: "trolla", matchIndex: 5,
      }
    });
    expect(out).toEqual({
      id: "abc",
      title: "Title",
      videoId: "vid1",
      sourceLang: "sv",
      targetLang: "en",
      srcLineCount: 3,
      tgtLineCount: 2,
      query: "trolla",
      matchIndex: "5",
    });
  });
  test("falls back to videoId / 'unknown' for missing title", () => {
    expect(buildCapturedRowVM({ id: "i", detail: { videoId: "v" } }).title).toBe("v");
    expect(buildCapturedRowVM({ id: "i", detail: {} }).title).toBe("unknown");
  });
  test("defaults for missing lang fields", () => {
    const out = buildCapturedRowVM({ id: "i", detail: {} });
    expect(out.sourceLang).toBe("?");
    expect(out.targetLang).toBe("?");
  });
  test("zero line counts when lines/translation are missing or non-array", () => {
    expect(buildCapturedRowVM({ id: "i", detail: {} }).srcLineCount).toBe(0);
    expect(buildCapturedRowVM({ id: "i", detail: { lines: "x" } }).srcLineCount).toBe(0);
  });
  test("empty query when missing", () => {
    expect(buildCapturedRowVM({ id: "i", detail: {} }).query).toBe("");
  });
  test("matchIndex is stringified", () => {
    expect(buildCapturedRowVM({ id: "i", detail: { matchIndex: 0 } }).matchIndex).toBe("0");
    expect(buildCapturedRowVM({ id: "i", detail: { matchIndex: null } }).matchIndex).toBe("");
  });
  test("tolerates null item", () => {
    const out = buildCapturedRowVM(null);
    expect(out.id).toBe("");
    expect(out.title).toBe("unknown");
  });
});

describe("pushButtonLabel", () => {
  test("'modify' state → 'Push (merge)'", () => {
    expect(pushButtonLabel("modify")).toBe("Push (merge)");
  });
  test("any other state → 'Push This'", () => {
    expect(pushButtonLabel("new")).toBe("Push This");
    expect(pushButtonLabel(undefined)).toBe("Push This");
    expect(pushButtonLabel("error")).toBe("Push This");
  });
});
