import {
  CAPTION_NO_TRANSLATION,
  captionLinesFrom,
  captionKey,
  captionWords,
  captionFaces,
} from "./caption-capture";

describe("captionLinesFrom", () => {
  it("accepts both sources the host sends", () => {
    const lines = [{ start: 3, text: "Han gick hem." }];
    expect(captionLinesFrom({ source: "caption", lines })).toHaveLength(1);
    expect(captionLinesFrom({ source: "page", lines })).toHaveLength(1);
  });

  // The host normalises anything it doesn't recognise to 'caption', so a third
  // value means the host grew a new source. Keeping the text beats dropping it
  // silently, which is the one failure the user cannot see or recover from.
  it("keeps a block whose source it does not recognise", () => {
    const cap = { source: "epub", lines: [{ start: 0, text: "Hej." }] };
    expect(captionLinesFrom(cap)).toEqual([
      { start: 0, text: "Hej.", translation: "" },
    ]);
  });

  it("returns [] for anything without a lines array", () => {
    expect(captionLinesFrom(null)).toEqual([]);
    expect(captionLinesFrom({ source: "caption" })).toEqual([]);
    expect(captionLinesFrom({ source: "caption", lines: "nope" })).toEqual([]);
  });

  // One row of the card must be exactly one line: the de-dupe pairs rows with
  // captionStarts by position, so a smuggled newline would shift everything.
  it("collapses embedded newlines in text and translation", () => {
    const [line] = captionLinesFrom({
      source: "caption",
      lines: [{ start: 1, text: "Han gick\n  hem.", translation: "He went\nhome." }],
    });
    expect(line.text).toBe("Han gick hem.");
    expect(line.translation).toBe("He went home.");
  });

  it("drops blank lines and defaults an unusable start to 0", () => {
    const out = captionLinesFrom({
      source: "caption",
      lines: [
        { start: 1, text: "   " },
        null,
        { start: "abc", text: "Ja." },
      ],
    });
    expect(out).toEqual([{ start: 0, text: "Ja.", translation: "" }]);
  });
});

describe("captionKey", () => {
  // Subtitle tracks repeat short lines constantly; keying on text alone would
  // swallow every repeat after the first.
  it("tells repeats of the same text apart by start", () => {
    expect(captionKey("u", 12, "Ja.")).not.toBe(captionKey("u", 40, "Ja."));
  });

  // Page blocks have no times, so identity collapses to page + text — which is
  // the right identity there.
  it("treats the same sentence off the same page as one", () => {
    expect(captionKey("u", 0, "Hej.")).toBe(captionKey("u", 0, "Hej."));
    expect(captionKey("u", 0, "Hej.")).not.toBe(captionKey("v", 0, "Hej."));
  });
});

describe("captionFaces", () => {
  const ragged = [
    { start: 0, text: "Ett", translation: "" },
    { start: 1, text: "Två", translation: "Two" },
  ];

  // The card writer trims both faces, so an untranslated FIRST line would lose
  // its blank row and shift the whole column up — pairing every line with its
  // neighbour's translation.
  it("holds a missing translation open with a placeholder", () => {
    const faces = captionFaces(ragged, "source");
    expect(faces.source).toBe("Ett\nTvå");
    expect(faces.target).toBe(`${CAPTION_NO_TRANSLATION}\nTwo`);
  });

  it("leaves the other face empty when nothing is translated", () => {
    const faces = captionFaces([{ text: "Ett", translation: "" }], "source");
    expect(faces.target).toBe("");
  });

  it("swaps which face the captured text lands on", () => {
    const faces = captionFaces(ragged, "target");
    expect(faces.textField).toBe("target");
    expect(faces.target).toBe("Ett\nTvå");
    expect(faces.source).toBe(`${CAPTION_NO_TRANSLATION}\nTwo`);
  });
});

describe("captionWords", () => {
  it("names a page block after sentences and anything else after captions", () => {
    expect(captionWords({ source: "page" }).units).toBe("sentences");
    expect(captionWords({ source: "caption" }).units).toBe("lines");
    expect(captionWords(null).units).toBe("lines");
  });
});
