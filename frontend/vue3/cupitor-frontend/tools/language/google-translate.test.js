import {
  buildTranslateUrl,
  parseTranslateResponse,
} from "./google-translate.js";

describe("buildTranslateUrl", () => {
  test("targets translate_a/single with sl/tl and an encoded query", () => {
    const url = buildTranslateUrl("gå åtgång", "sv", "en");
    expect(url).toContain("translate_a/single");
    expect(url).toContain("client=gtx");
    expect(url).toContain("sl=sv");
    expect(url).toContain("tl=en");
    // Query round-trips back to the original text (space may be + or %20).
    expect(new URL(url).searchParams.get("q")).toBe("gå åtgång");
  });
});

describe("parseTranslateResponse", () => {
  test("concatenates the translated segments (data[0][*][0])", () => {
    const resp = [
      [
        ["Hello ", "Hej ", null, null, 1],
        ["world", "världen", null, null, 0],
      ],
      null,
      "sv",
    ];
    expect(parseTranslateResponse(resp)).toBe("Hello world");
  });

  test("returns empty string for null / malformed responses", () => {
    expect(parseTranslateResponse(null)).toBe("");
    expect(parseTranslateResponse([])).toBe("");
    expect(parseTranslateResponse([null])).toBe("");
  });
});
