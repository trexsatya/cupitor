import {
  CAPTION_NO_TRANSLATION,
  captionLinesFrom,
  captionKey,
  captionWords,
  captionFaces,
  captionRowCounts,
  captionRowGroups,
  cardTranslateDirection,
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

  // A subtitle is broken to fit the screen, so the break is presentation.
  it("collapses embedded newlines in a caption and in any translation", () => {
    const [line] = captionLinesFrom({
      source: "caption",
      lines: [{ start: 1, text: "Han gick\n  hem.", translation: "He went\nhome." }],
    });
    expect(line.text).toBe("Han gick hem.");
    expect(line.translation).toBe("He went home.");
  });

  // A page sentence is broken where the document breaks it, and that break is
  // part of the text the reader picked.
  it("keeps the line breaks of a page sentence", () => {
    const [line] = captionLinesFrom({
      source: "page",
      lines: [{ start: 0, text: "  Han gick hem,  \n  sa hon.  " }],
    });
    expect(line.text).toBe("Han gick hem,\nsa hon.");
  });

  it("drops rows a page sentence left empty", () => {
    const [line] = captionLinesFrom({
      source: "page",
      lines: [{ start: 0, text: "Forsta\r\n\n   \nandra" }],
    });
    expect(line.text).toBe("Forsta\nandra");
  });

  it("still drops a page line with nothing but whitespace", () => {
    expect(captionLinesFrom({ source: "page", lines: [{ start: 0, text: " \n \n " }] }))
      .toEqual([]);
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

  // A two-row line has to push the row below it down on BOTH faces, or the
  // next line reads against the wrong translation.
  it("grows the other face with a line that keeps its breaks", () => {
    const faces = captionFaces(
      [
        { start: 0, text: "Han gick hem,\nsa hon.", translation: "He went home, she said." },
        { start: 0, text: "Ja.", translation: "Yes." },
      ],
      "source",
    );
    expect(faces.source).toBe("Han gick hem,\nsa hon.\nJa.");
    expect(faces.target).toBe(`He went home, she said.\n${CAPTION_NO_TRANSLATION}\nYes.`);
    expect(faces.source.split("\n")).toHaveLength(faces.target.split("\n").length);
  });
});

describe("captionRowCounts / captionRowGroups", () => {
  const lines = [
    { start: 0, text: "Han gick hem,\nsa hon." },
    { start: 0, text: "Ja." },
  ];

  it("counts the rows each line takes and puts them back together", () => {
    const counts = captionRowCounts(lines);
    expect(counts).toEqual([2, 1]);
    const rows = lines.map((l) => l.text).join("\n").split("\n");
    expect(captionRowGroups(rows, counts)).toEqual([
      "Han gick hem,\nsa hon.",
      "Ja.",
    ]);
  });

  // An edited card must be distrusted rather than matched against the wrong
  // rows: a duplicate is recoverable, a silently dropped line is not.
  it("refuses rows that no longer add up", () => {
    expect(captionRowGroups(["a", "b"], [2, 1])).toBeNull();
    expect(captionRowGroups(["a", "b", "c", "d"], [2, 1])).toBeNull();
    expect(captionRowGroups(["a"], [0])).toBeNull();
    expect(captionRowGroups(["a"], [-1])).toBeNull();
    expect(captionRowGroups(["a"], [1.5])).toBeNull();
    expect(captionRowGroups("a", [1])).toBeNull();
    expect(captionRowGroups(["a"], "1")).toBeNull();
  });

  // The counts come back from stored JSON, so they are data to distrust, not
  // numbers to coerce.
  it("refuses a count that is not a number", () => {
    expect(captionRowGroups(["a", "b"], ["2"])).toBeNull();
    expect(captionRowGroups(["a"], [true])).toBeNull();
    expect(captionRowGroups(["a"], [[1]])).toBeNull();
    expect(captionRowGroups(["a"], [null])).toBeNull();
    expect(captionRowGroups(["a"], [undefined])).toBeNull();
    expect(captionRowGroups(["a"], ["x"])).toBeNull();
  });

  // A card captured before the row counts existed is read as one row per
  // line, which is what the card writer stores for it.
  it("reads a card with no counts of its own as one row each", () => {
    const starts = [0, 1.5];
    expect(captionRowGroups(["Ett", "Två"], starts.map(() => 1)))
      .toEqual(["Ett", "Två"]);
    // …and such a card holding a multi-row line is distrusted, not mismatched.
    expect(captionRowGroups(["Ett", "Två", "Tre"], starts.map(() => 1))).toBeNull();
  });

  // The property the whole scheme rests on, over every shape a capture can
  // take rather than one example.
  it("keeps the two faces the same height whatever the lines look like", () => {
    const shapes = [
      [{ text: "A\nB", translation: "t" }, { text: "C" }],
      [{ text: "A", translation: "t" }, { text: "B\nC\nD" }],
      [{ text: "A\nB" }, { text: "C\nD", translation: "t" }],
      [{ text: "A", translation: "one\ntwo" }],
      [{ text: "A\nB", translation: "one\ntwo\nthree" }, { text: "C" }],
    ];
    for (const lines of shapes) {
      for (const field of ["source", "target"]) {
        const faces = captionFaces(lines, field);
        if (!faces[faces.otherField]) continue; // nothing translated at all
        expect(faces[faces.otherField].split("\n")).toHaveLength(
          faces[faces.textField].split("\n").length,
        );
      }
    }
  });
});

describe("captionWords", () => {
  it("names a page block after sentences and anything else after captions", () => {
    expect(captionWords({ source: "page" }).units).toBe("sentences");
    expect(captionWords({ source: "caption" }).units).toBe("lines");
    expect(captionWords(null).units).toBe("lines");
  });
});

describe("cardTranslateDirection", () => {
  test("a hand-typed card reads Source as the studied language", () => {
    expect(cardTranslateDirection(null, "target", "sv"))
      .toEqual({ from: "source", to: "target", fromLang: "sv", toLang: "en" });
    expect(cardTranslateDirection({}, "source", "sv"))
      .toEqual({ from: "target", to: "source", fromLang: "en", toLang: "sv" });
  });

  test("a card captured with the caption text in Target runs the other way", () => {
    const it = { captionField: "target" };
    expect(cardTranslateDirection(it, "target", "sv"))
      .toEqual({ from: "source", to: "target", fromLang: "en", toLang: "sv" });
    expect(cardTranslateDirection(it, "source", "sv"))
      .toEqual({ from: "target", to: "source", fromLang: "sv", toLang: "en" });
  });

  test("no direction when the page has no code for the studied language", () => {
    expect(cardTranslateDirection(null, "target", null)).toBeNull();
  });
});
