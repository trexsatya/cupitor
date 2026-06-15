/**
 * @jest-environment jsdom
 */
import {
  escapeHtml,
  decodeHtmlEntities,
  removeHtmlTags,
  encodeHtmlTags,
  decodeHtmlTags,
} from "./html-utils";

describe("escapeHtml (re-exported)", () => {
  test("escapes &<>\"'", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`))
      .toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("decodeHtmlEntities", () => {
  test("decodes named entities", () => {
    expect(decodeHtmlEntities("&lt;a&gt;&amp;b&amp;&lt;/a&gt;"))
      .toBe("<a>&b&</a>");
  });
  test("decodes numeric entities", () => {
    expect(decodeHtmlEntities("&#39;hello&#39;")).toBe("'hello'");
  });
  test("plain text passes through unchanged", () => {
    expect(decodeHtmlEntities("just text")).toBe("just text");
  });
});

describe("removeHtmlTags", () => {
  test("strips tags but keeps text content", () => {
    expect(removeHtmlTags("<b>hello</b> <i>world</i>")).toBe("hello world");
  });
  test("decodes entities after stripping", () => {
    expect(removeHtmlTags("<p>&amp;foo</p>")).toBe("&foo");
  });
  test("handles self-closing tags", () => {
    expect(removeHtmlTags("a<br/>b")).toBe("ab");
  });
  test("handles null/undefined gracefully", () => {
    expect(removeHtmlTags(null)).toBe("");
    expect(removeHtmlTags(undefined)).toBe("");
  });
});

describe("encodeHtmlTags / decodeHtmlTags round trip", () => {
  let counter = 0;
  const stubUuid = () => `uuid${counter++}`;
  beforeEach(() => { counter = 0; });

  test("replaces each tag with a unique placeholder", () => {
    const [encoded, enc] = encodeHtmlTags("a <b>bold</b> c", stubUuid);
    expect(Object.keys(enc)).toEqual(["<b>", "</b>"]);
    expect(encoded).not.toContain("<b>");
    expect(encoded).not.toContain("</b>");
    expect(encoded).toContain("bold");
  });
  test("decodeHtmlTags restores the original tags (placeholders add padding)", () => {
    // Placeholders are wrapped with spaces (` _uuid_ `) so they stay
    // word-separated during intermediate processing. Restoring leaves
    // those spaces in place — the caller normalises whitespace if it
    // matters. This is the documented existing behaviour.
    const input = "a <b>bold</b> c";
    const [encoded, enc] = encodeHtmlTags(input, stubUuid);
    const restored = decodeHtmlTags(encoded, enc);
    // Tags are present in the right positions; whitespace may have
    // doubled around each replaced placeholder.
    expect(restored.replace(/\s+/g, " ")).toBe("a <b> bold </b> c");
    expect(restored).toContain("<b>");
    expect(restored).toContain("</b>");
  });
  test("identical tags share one placeholder", () => {
    const [, enc] = encodeHtmlTags("<i>a</i> <i>b</i>", stubUuid);
    // <i> should map to the same placeholder both times → only 2 keys total
    expect(Object.keys(enc)).toEqual(["<i>", "</i>"]);
  });
  test("text with no tags returns the input unchanged + empty encoding map", () => {
    const [encoded, enc] = encodeHtmlTags("no tags here", stubUuid);
    expect(encoded).toBe("no tags here");
    expect(enc).toEqual({});
  });
  test("handles null/undefined", () => {
    const [encoded, enc] = encodeHtmlTags(null, stubUuid);
    expect(encoded).toBe("");
    expect(enc).toEqual({});
  });
});

describe("decodeHtmlTags edge cases", () => {
  test("returns text untouched when encodings is empty", () => {
    expect(decodeHtmlTags("hi", {})).toBe("hi");
  });
  test("null encodings doesn't throw", () => {
    expect(decodeHtmlTags("hi", null)).toBe("hi");
  });
  test("handles null text", () => {
    expect(decodeHtmlTags(null, { "<b>": " _x_ " })).toBe("");
  });
});
