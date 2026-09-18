import { numberRows, plainRows, parseNumbered } from "./translate-block";

describe("plainRows", () => {
  test("accepts an answer that kept the rows it was given", () => {
    expect(plainRows("en\ntvå\ntre", 3)).toEqual(["en", "två", "tre"]);
  });

  test("refuses an answer whose row count moved", () => {
    // The translator merged two sentences — there is no way to tell which row
    // the merged line belongs to, so it must not be guessed at.
    expect(plainRows("en två\ntre", 3)).toBeNull();
    expect(plainRows("allt på en rad", 3)).toBeNull();
  });
});

describe("parseNumbered", () => {
  test("recovers rows when the line breaks survived", () => {
    const answer = "1. Inte oroa dig.\n2. PETE: [skrattar]\n3. Roligt.";
    expect(parseNumbered(answer, 3)).toEqual([
      "Inte oroa dig.", "PETE: [skrattar]", "Roligt.",
    ]);
  });

  test("recovers rows when every line break was lost", () => {
    // The ML Kit path answers with one line; the numbers are still in it.
    const answer = "1. Inte oroa dig. 2. PETE: [skrattar] 3. Roligt.";
    expect(parseNumbered(answer, 3)).toEqual([
      "Inte oroa dig.", "PETE: [skrattar]", "Roligt.",
    ]);
  });

  test("survives the translator re-segmenting across rows", () => {
    const answer = "1. Inte oroa dig. Låt mig se.\n2. PETE: [skrattar] 3. Roligt.";
    expect(parseNumbered(answer, 3)).toEqual([
      "Inte oroa dig. Låt mig se.", "PETE: [skrattar]", "Roligt.",
    ]);
  });

  test("accepts ')' as the marker punctuation too", () => {
    expect(parseNumbered("1) ett 2) två", 2)).toEqual(["ett", "två"]);
  });

  test("keeps an empty row empty", () => {
    expect(parseNumbered("1. ett\n2.\n3. tre", 3)).toEqual(["ett", "", "tre"]);
  });

  test("refuses when a marker is missing", () => {
    // The translator dropped row 2 — better to ask again row by row than to
    // shift every later row up by one.
    expect(parseNumbered("1. ett\n3. tre", 3)).toBeNull();
  });

  test("does not mistake a number inside the text for a marker", () => {
    // "15" here is content. Only 1 and 2 are markers, and 2 must come after 1.
    const answer = "1. på 1500-talet, i 15. året\n2. sedan";
    expect(parseNumbered(answer, 2)).toEqual(["på 1500-talet, i 15. året", "sedan"]);
  });

  test("round-trips with numberRows when nothing is disturbed", () => {
    const rows = ["ett", "två", "tre"];
    expect(parseNumbered(numberRows(rows), rows.length)).toEqual(rows);
  });
});
