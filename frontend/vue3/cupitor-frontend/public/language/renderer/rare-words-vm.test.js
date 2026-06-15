import {
  RARE_WORDS_PAGE_SIZE,
  buildCategoryCounts,
  buildCategoryOptions,
  buildRareWordsPageVM,
} from "./rare-words-vm";

const item = (line, category, count = 1) => ({ line, category, count });

describe("RARE_WORDS_PAGE_SIZE", () => {
  test("is a positive integer", () => {
    expect(Number.isInteger(RARE_WORDS_PAGE_SIZE)).toBe(true);
    expect(RARE_WORDS_PAGE_SIZE).toBeGreaterThan(0);
  });
});

describe("buildCategoryCounts", () => {
  test("counts items per category", () => {
    const found = [item("a", "Verbs"), item("b", "Verbs"), item("c", "Adjectives")];
    expect(buildCategoryCounts(found)).toEqual({ Verbs: 2, Adjectives: 1 });
  });
  test("buckets null/missing categories under ''", () => {
    const found = [item("a", null), item("b", ""), item("c", undefined)];
    expect(buildCategoryCounts(found)).toEqual({ "": 3 });
  });
  test("tolerates non-array / null", () => {
    expect(buildCategoryCounts(null)).toEqual({});
    expect(buildCategoryCounts(undefined)).toEqual({});
  });
  test("skips null entries", () => {
    expect(buildCategoryCounts([item("a", "V"), null])).toEqual({ V: 1 });
  });
});

describe("buildCategoryOptions", () => {
  test("first option is 'All categories (N)'", () => {
    const found = [item("a", "V"), item("b", "A")];
    const opts = buildCategoryOptions(found);
    expect(opts[0]).toEqual({ value: "", label: "All categories (2)" });
  });
  test("subsequent options are sorted by category name", () => {
    const found = [item("a", "Verbs"), item("b", "Adjectives"), item("c", "Nouns")];
    const opts = buildCategoryOptions(found);
    expect(opts.slice(1).map(o => o.value)).toEqual(["Adjectives", "Nouns", "Verbs"]);
  });
  test("includes the per-category count in the label", () => {
    const found = [item("a", "V"), item("b", "V"), item("c", "A")];
    const opts = buildCategoryOptions(found);
    const vEntry = opts.find(o => o.value === "V");
    expect(vEntry.label).toBe("V — 2");
  });
  test("(uncategorised) label for empty category bucket", () => {
    const found = [item("a", "")];
    const opts = buildCategoryOptions(found);
    expect(opts.find(o => o.value === "").label).toBe("All categories (1)");
    // Empty-string category becomes a real option labelled (uncategorised).
    expect(opts.length).toBe(2);
    expect(opts[1].label).toContain("(uncategorised)");
  });
  test("empty input → only the 'All categories (0)' row", () => {
    expect(buildCategoryOptions([])).toEqual([{ value: "", label: "All categories (0)" }]);
    expect(buildCategoryOptions(null)).toEqual([{ value: "", label: "All categories (0)" }]);
  });
});

describe("buildRareWordsPageVM — state", () => {
  test("state 'empty' when no scan results yet", () => {
    expect(buildRareWordsPageVM([]).state).toBe("empty");
    expect(buildRareWordsPageVM(null).state).toBe("empty");
  });
  test("state 'no-matches' when filter eliminates everything", () => {
    const out = buildRareWordsPageVM([item("a", "V")], { categoryFilter: "Z" });
    expect(out.state).toBe("no-matches");
    expect(out.rows).toEqual([]);
  });
  test("state 'normal' when results exist", () => {
    const out = buildRareWordsPageVM([item("a", "V")]);
    expect(out.state).toBe("normal");
    expect(out.rows.length).toBeGreaterThan(0);
  });
});

describe("buildRareWordsPageVM — paging", () => {
  const many = Array.from({ length: 130 }, (_, i) => item(`w${i}`, "X", i));

  test("clamps page within [0, pages-1]", () => {
    const out = buildRareWordsPageVM(many, { page: 999, pageSize: 50 });
    expect(out.page).toBe(2);   // 130/50 = 3 pages → max index 2
    expect(out.pages).toBe(3);
  });
  test("emits up to pageSize items per page", () => {
    const out = buildRareWordsPageVM(many, { page: 0, pageSize: 50, categoryFilter: "X" });
    expect(out.rows.filter(r => r.kind === "item").length).toBe(50);
  });
  test("respects DEFAULT pageSize when not provided", () => {
    const out = buildRareWordsPageVM(many, { categoryFilter: "X" });
    expect(out.rows.filter(r => r.kind === "item").length).toBe(RARE_WORDS_PAGE_SIZE);
  });
  test("pages = 1 (minimum) even for empty results", () => {
    expect(buildRareWordsPageVM([]).pages).toBe(1);
  });
  test("negative page is clamped to 0", () => {
    expect(buildRareWordsPageVM(many, { page: -5, pageSize: 50 }).page).toBe(0);
  });
});

describe("buildRareWordsPageVM — category headers", () => {
  test("headers are emitted before each new category when filter is empty", () => {
    const found = [
      item("a", "Verbs"), item("b", "Verbs"),
      item("c", "Adjectives"), item("d", "Adjectives"),
    ];
    const out = buildRareWordsPageVM(found);
    const kinds = out.rows.map(r => r.kind);
    // Header, item, item, header, item, item.
    expect(kinds).toEqual(["header", "item", "item", "header", "item", "item"]);
    expect(out.rows[0].category).toBe("Verbs");
    expect(out.rows[3].category).toBe("Adjectives");
  });
  test("headers are suppressed when a category filter is active", () => {
    const found = [
      item("a", "Verbs"), item("b", "Verbs"),
      item("c", "Adjectives"),
    ];
    const out = buildRareWordsPageVM(found, { categoryFilter: "Verbs" });
    expect(out.rows.every(r => r.kind === "item")).toBe(true);
    expect(out.rows.length).toBe(2);
  });
  test("'' / null category labels as '(uncategorised)' in headers", () => {
    const found = [item("a", ""), item("b", null)];
    const out = buildRareWordsPageVM(found);
    expect(out.rows[0]).toEqual({ kind: "header", category: "(uncategorised)" });
  });
  test("two items in the same null category share one header", () => {
    const found = [item("a", null), item("b", null), item("c", null)];
    const out = buildRareWordsPageVM(found);
    expect(out.rows.filter(r => r.kind === "header").length).toBe(1);
  });
});

describe("buildRareWordsPageVM — filtering", () => {
  test("filter selects only the matching category", () => {
    const found = [item("a", "V"), item("b", "A"), item("c", "V")];
    const out = buildRareWordsPageVM(found, { categoryFilter: "V" });
    expect(out.rows.map(r => r.line)).toEqual(["a", "c"]);
    expect(out.total).toBe(2);
  });
  test("'' empty category is selectable via the empty-string filter", () => {
    const found = [item("a", ""), item("b", "V")];
    const out = buildRareWordsPageVM(found, { categoryFilter: "V" });
    expect(out.total).toBe(1);
  });
});
