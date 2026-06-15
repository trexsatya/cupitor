import {
  escapeHtml,
  highlightWordInLine,
  highlightSearchInVocabLine,
  highlightStemInPrefixMatch,
} from "./highlight";

// Mimics language.js's removeHintsInBrackets enough for tests: strips
// "(sl-pl)", "(pl)", and any other balanced (...) group. Does NOT alert.
function stripBracketHints(txt) {
  let s = String(txt)
    .replaceAll("(sl-pl)", "")
    .replaceAll("(pl)", "");
  // strip innermost balanced parens repeatedly
  while (/\([^()]*\)/.test(s)) s = s.replace(/\([^()]*\)/, "");
  return s;
}

describe("escapeHtml", () => {
  test("escapes the five canonical chars", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`))
      .toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
  test("passes through plain text unchanged", () => {
    expect(escapeHtml("trollguld")).toBe("trollguld");
  });
  test("coerces non-strings", () => {
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(null)).toBe("null");
  });
});

describe("highlightWordInLine", () => {
  test("wraps a whole-word match", () => {
    const out = highlightWordInLine("a troll walks", "troll");
    expect(out).toBe('a <b style="color:#1565c0">troll</b> walks');
  });
  test("does NOT match inside a longer word (Unicode boundary)", () => {
    // "växande" should not be highlighted when searching "växa".
    const out = highlightWordInLine("växande blommor", "växa");
    expect(out).toBe("växande blommor");
  });
  test("matches Swedish word with å/ä/ö", () => {
    const out = highlightWordInLine("en kväll", "kväll");
    expect(out).toBe('en <b style="color:#1565c0">kväll</b>');
  });
  test("escapes regex special chars in the search word", () => {
    const out = highlightWordInLine("knäböja(d) finns", "knäböja(d)");
    expect(out).toContain('<b style="color:#1565c0">knäböja(d)</b>');
  });
  test("returns text unchanged when word is falsy", () => {
    expect(highlightWordInLine("hello", "")).toBe("hello");
    expect(highlightWordInLine("hello", null)).toBe("hello");
  });
  test("case-insensitive matching wraps both occurrences", () => {
    const out = highlightWordInLine("Troll och TROLL", "troll");
    expect(out).toBe(
      '<b style="color:#1565c0">Troll</b> och <b style="color:#1565c0">TROLL</b>'
    );
  });
});

describe("highlightSearchInVocabLine — empty / falsy", () => {
  test("returns '' for empty rawText", () => {
    expect(highlightSearchInVocabLine("", "x")).toBe("");
    expect(highlightSearchInVocabLine(null, "x")).toBe("");
  });
  test("returns escaped raw when searchText is falsy", () => {
    const out = highlightSearchInVocabLine("a|b", "");
    expect(out).toBe("a | b");
  });
  test("returns escaped raw when search parts are too short", () => {
    // searchParts are filtered to length >= 3.
    const out = highlightSearchInVocabLine("trollguld", "ab");
    expect(out).toBe("trollguld");
  });
});

describe("highlightSearchInVocabLine — prefix / suffix overlaps", () => {
  test("highlights the prefix overlap of a segment with the search", () => {
    const out = highlightSearchInVocabLine("trollguld", "trollguldet");
    expect(out).toBe('<mark class="vocab-hl">trollguld</mark>');
  });
  test("highlights a single token inside a multi-word segment", () => {
    // "Rik som ett troll" should have "troll" wrapped when search is
    // "trollguldet".
    const out = highlightSearchInVocabLine("Rik som ett troll", "trollguldet");
    expect(out).toBe('Rik som ett <mark class="vocab-hl">troll</mark>');
  });
  test("highlights a suffix overlap when overlap == token.length", () => {
    // "äta|åt|ätit" — "åt" is wholly a suffix of "gråt".
    const out = highlightSearchInVocabLine("äta|åt|ätit", "gråt");
    expect(out).toContain('<mark class="vocab-hl">åt</mark>');
  });
  test("DOES NOT highlight 2-char prefix overlap inside a longer token", () => {
    // "stapla" vs "stoft" share only "st" (2 chars) — not full token, skip.
    const out = highlightSearchInVocabLine("stapla", "stoft");
    expect(out).toBe("stapla");
  });
  test("supports |-separated raw input and joins with ' | '", () => {
    const out = highlightSearchInVocabLine("trollguld|trolla", "trollguldet");
    expect(out).toBe(
      '<mark class="vocab-hl">trollguld</mark> | <mark class="vocab-hl">troll</mark>a'
    );
  });
  test("supports |-separated searchText (multi-term)", () => {
    const out = highlightSearchInVocabLine("trollguld", "irrelevant|trollguldet");
    expect(out).toBe('<mark class="vocab-hl">trollguld</mark>');
  });
  test("uses bracket-hint stripper when provided", () => {
    // "stoft(-et)" — stripped to "stoft"; with search "stoft" should still mark
    // "stoft" in the displayed segment with brackets intact.
    const out = highlightSearchInVocabLine("stoft(-et)", "stoft", { stripBracketHints });
    expect(out).toBe('<mark class="vocab-hl">stoft</mark>(-et)');
  });
  test("default stripper (no opts) still works — uses lowercased segment", () => {
    // Without bracket stripping, "stoft(-et)" tokens still pick up "stoft" as
    // a whitespace-split-free prefix overlap.
    const out = highlightSearchInVocabLine("stoft(-et)", "stoft");
    expect(out).toContain('<mark class="vocab-hl">stoft</mark>');
  });
});

describe("highlightSearchInVocabLine — exactPrefix mode", () => {
  test("DOES highlight when search is fully a prefix of segment", () => {
    // candidate "förråt", segment "förråta" — search part "förråt" is fully
    // a prefix of "förråta".
    const out = highlightSearchInVocabLine("förråta", "förråt", { exactPrefix: true });
    expect(out).toBe('<mark class="vocab-hl">förråt</mark>a');
  });
  test("does NOT highlight a partial prefix overlap", () => {
    // candidate "förråt" vs segment "förråd" share "förrå" (5 chars) but
    // "förråt" is not fully a prefix of "förråd". exactPrefix rejects.
    const out = highlightSearchInVocabLine("förråd", "förråt", { exactPrefix: true });
    expect(out).toBe("förråd");
  });
});

describe("highlightStemInPrefixMatch", () => {
  test("marks only the stem inside a candidate-prefixed segment", () => {
    // candidate = "förråt" (för + råt), stem = "råt".
    const out = highlightStemInPrefixMatch("förråta", "förråt", "råt");
    expect(out).toBe('för<mark class="vocab-hl">råt</mark>a');
  });
  test("returns segment un-highlighted when it doesn't start with candidate", () => {
    const out = highlightStemInPrefixMatch("annordlunda", "förråt", "råt");
    expect(out).toBe("annordlunda");
  });
  test("returns '' for empty rawText", () => {
    expect(highlightStemInPrefixMatch("", "förråt", "råt")).toBe("");
    expect(highlightStemInPrefixMatch(null, "förråt", "råt")).toBe("");
  });
  test("returns escaped raw when candidate or stem is missing", () => {
    expect(highlightStemInPrefixMatch("a|b", null, "råt")).toBe("a | b");
    expect(highlightStemInPrefixMatch("a|b", "förråt", "")).toBe("a | b");
  });
  test("handles |-separated segments — only matching ones are marked", () => {
    const out = highlightStemInPrefixMatch("förråta|skydda", "förråt", "råt");
    expect(out).toBe('för<mark class="vocab-hl">råt</mark>a | skydda');
  });
  test("returns escaped raw when stem is longer than candidate", () => {
    // stemOffsetInCand < 0 — nothing to do.
    const out = highlightStemInPrefixMatch("förråta", "för", "förråt");
    expect(out).toBe("förråta");
  });
  test("uses bracket-hint stripper for the start check", () => {
    // "(verb) förråta" — without stripping, the segment doesn't start with
    // "förråt"; with stripping it does. We still mark inside the original
    // (un-stripped) segment using segLower.indexOf(candLower).
    const out = highlightStemInPrefixMatch("(verb) förråta", "förråt", "råt", { stripBracketHints });
    // Note: leading "(verb) " keeps the candIdx of "förråt" at position 7.
    expect(out).toBe('(verb) för<mark class="vocab-hl">råt</mark>a');
  });
});

describe("highlightSearchInVocabLine — escapes embedded HTML", () => {
  test("HTML-escapes raw input even when no match is produced", () => {
    // A vocab segment containing HTML should always come out escaped —
    // never injected verbatim into the page.
    const out = highlightSearchInVocabLine("<x>nomatch</x>", "trollguldet");
    expect(out).toBe("&lt;x&gt;nomatch&lt;/x&gt;");
  });
  test("HTML-escapes the surrounding slices when a mark is produced", () => {
    // "<troll>" — the lcp of segment vs "trollguldet" walks past "<", so the
    // first whitespace-split token "<troll>" only matches via the inner
    // "troll" word fallback? Actually there's no whitespace here. Use a
    // multi-word segment so the bare "troll" token participates.
    const out = highlightSearchInVocabLine("<x> troll <y>", "trollguldet");
    expect(out).toContain('<mark class="vocab-hl">troll</mark>');
    expect(out).toContain("&lt;x&gt;");
    expect(out).toContain("&lt;y&gt;");
  });
});
