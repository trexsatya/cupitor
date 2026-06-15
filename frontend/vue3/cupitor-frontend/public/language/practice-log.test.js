import {
  PRACTICE_LOG_DEFAULT_ITEMS,
  PRACTICE_LOG_STATUSES,
  PRACTICE_LOG_DEFAULT_RETAIN,
  defaultPracticeLog,
  normalizePracticeLog,
  isoWeekLabel,
  addDays,
  prunePracticeLogWeeks,
  ensurePracticeLogWeek,
  weekHasUntouchedItem,
  mergePracticeLog,
} from "./practice-log";

describe("constants", () => {
  test("DEFAULT_ITEMS lists the six baseline skills", () => {
    expect(PRACTICE_LOG_DEFAULT_ITEMS).toEqual([
      "Reading", "Writing", "Listening", "Speaking", "Vocabulary", "Grammar"
    ]);
  });
  test("STATUSES contains the four canonical states with css classes", () => {
    const values = PRACTICE_LOG_STATUSES.map(s => s.value);
    expect(values).toEqual(["not_started", "in_progress", "done", "skipped"]);
    for (const s of PRACTICE_LOG_STATUSES) {
      expect(typeof s.label).toBe("string");
      expect(s.cls).toMatch(/^pl-status-/);
    }
  });
  test("DEFAULT_RETAIN is a positive integer", () => {
    expect(Number.isInteger(PRACTICE_LOG_DEFAULT_RETAIN)).toBe(true);
    expect(PRACTICE_LOG_DEFAULT_RETAIN).toBeGreaterThan(0);
  });
});

describe("defaultPracticeLog", () => {
  test("returns the canonical empty shape", () => {
    const d = defaultPracticeLog();
    expect(d.customItems).toEqual(PRACTICE_LOG_DEFAULT_ITEMS);
    expect(d.customItems).not.toBe(PRACTICE_LOG_DEFAULT_ITEMS); // fresh copy
    expect(d.weeks).toEqual({});
    expect(d.historyRetainWeeks).toBe(PRACTICE_LOG_DEFAULT_RETAIN);
  });
});

describe("normalizePracticeLog", () => {
  test("returns null for non-objects", () => {
    expect(normalizePracticeLog(null)).toBeNull();
    expect(normalizePracticeLog(undefined)).toBeNull();
    expect(normalizePracticeLog("string")).toBeNull();
    expect(normalizePracticeLog(42)).toBeNull();
  });
  test("falls back to default customItems when missing or empty", () => {
    expect(normalizePracticeLog({}).customItems).toEqual(PRACTICE_LOG_DEFAULT_ITEMS);
    expect(normalizePracticeLog({ customItems: [] }).customItems).toEqual(PRACTICE_LOG_DEFAULT_ITEMS);
    expect(normalizePracticeLog({ customItems: "nope" }).customItems).toEqual(PRACTICE_LOG_DEFAULT_ITEMS);
  });
  test("preserves valid customItems verbatim", () => {
    const inp = { customItems: ["A", "B"] };
    const out = normalizePracticeLog(inp);
    expect(out.customItems).toEqual(["A", "B"]);
  });
  test("falls back to {} for weeks when missing", () => {
    expect(normalizePracticeLog({}).weeks).toEqual({});
    expect(normalizePracticeLog({ weeks: null }).weeks).toEqual({});
    expect(normalizePracticeLog({ weeks: "bad" }).weeks).toEqual({});
  });
  test("falls back to DEFAULT_RETAIN for bad historyRetainWeeks", () => {
    expect(normalizePracticeLog({}).historyRetainWeeks).toBe(PRACTICE_LOG_DEFAULT_RETAIN);
    expect(normalizePracticeLog({ historyRetainWeeks: 0 }).historyRetainWeeks).toBe(PRACTICE_LOG_DEFAULT_RETAIN);
    expect(normalizePracticeLog({ historyRetainWeeks: -5 }).historyRetainWeeks).toBe(PRACTICE_LOG_DEFAULT_RETAIN);
    expect(normalizePracticeLog({ historyRetainWeeks: "x" }).historyRetainWeeks).toBe(PRACTICE_LOG_DEFAULT_RETAIN);
  });
  test("preserves valid historyRetainWeeks", () => {
    expect(normalizePracticeLog({ historyRetainWeeks: 5 }).historyRetainWeeks).toBe(5);
  });
});

describe("isoWeekLabel", () => {
  test("Monday of week 1 in 2026 lands on 2025-W52 then 2026-W01", () => {
    // ISO week 1 contains the first Thursday of the year. 2026-01-01 is a
    // Thursday — so week 1 starts 2025-12-29 (Mon) and ends 2026-01-04 (Sun).
    expect(isoWeekLabel(new Date("2025-12-29T00:00:00Z"))).toBe("2026-W01");
    expect(isoWeekLabel(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(isoWeekLabel(new Date("2026-01-04T00:00:00Z"))).toBe("2026-W01");
  });
  test("mid-year week ('2026-06-14' Sunday → still W24)", () => {
    expect(isoWeekLabel(new Date("2026-06-14T00:00:00Z"))).toBe("2026-W24");
  });
  test("pads week numbers with leading zero", () => {
    const out = isoWeekLabel(new Date("2026-01-05T00:00:00Z"));
    expect(out).toMatch(/^\d{4}-W\d{2}$/);
  });
  test("labels sort chronologically as strings", () => {
    const earlier = isoWeekLabel(new Date("2026-01-12T00:00:00Z")); // W03
    const later   = isoWeekLabel(new Date("2026-12-21T00:00:00Z")); // W52
    expect(earlier < later).toBe(true);
  });
});

describe("addDays", () => {
  test("shifts forward", () => {
    const d = new Date("2026-06-14T00:00:00Z");
    const out = addDays(d, 7);
    expect(out.getUTCDate()).toBe(21);
    expect(out.getUTCMonth()).toBe(5); // June
  });
  test("shifts backward with a negative argument", () => {
    const d = new Date("2026-06-14T00:00:00Z");
    expect(addDays(d, -7).getUTCDate()).toBe(7);
  });
  test("does NOT mutate the input", () => {
    const d = new Date("2026-06-14T00:00:00Z");
    addDays(d, 7);
    expect(d.toISOString()).toBe("2026-06-14T00:00:00.000Z");
  });
});

describe("prunePracticeLogWeeks", () => {
  function makeData(weeks, retain) {
    return { customItems: ["x"], weeks, historyRetainWeeks: retain };
  }
  test("drops weeks older than the retention horizon", () => {
    const data = makeData(
      { "2026-W01": {}, "2026-W02": {}, "2026-W03": {}, "2026-W04": {}, "2026-W05": {} },
      2
    );
    prunePracticeLogWeeks(data, null, null);
    expect(Object.keys(data.weeks).sort()).toEqual(["2026-W04", "2026-W05"]);
  });
  test("always keeps current and next labels even when over the cap", () => {
    const data = makeData(
      { "2026-W01": {}, "2026-W02": {}, "2026-W20": {}, "2026-W21": {} },
      1
    );
    prunePracticeLogWeeks(data, "2026-W20", "2026-W21");
    expect(new Set(Object.keys(data.weeks)))
      .toEqual(new Set(["2026-W20", "2026-W21"]));
  });
  test("falls back to DEFAULT_RETAIN when retain is bogus", () => {
    const data = makeData({ "2026-W01": {}, "2026-W02": {} }, 0);
    prunePracticeLogWeeks(data, null, null);
    // With DEFAULT_RETAIN = 100, both weeks are well under the cap.
    expect(Object.keys(data.weeks).length).toBe(2);
  });
  test("returns the data object (so callers can chain)", () => {
    const data = makeData({ "2026-W01": {} }, 5);
    expect(prunePracticeLogWeeks(data, null, null)).toBe(data);
  });
});

describe("ensurePracticeLogWeek", () => {
  test("creates the week record if missing", () => {
    const data = { customItems: ["Reading"], weeks: {} };
    ensurePracticeLogWeek(data, "2026-W24");
    expect(data.weeks["2026-W24"]).toBeDefined();
  });
  test("backfills missing items with the default record", () => {
    const data = { customItems: ["Reading", "Writing"], weeks: { "2026-W24": {} } };
    ensurePracticeLogWeek(data, "2026-W24");
    expect(data.weeks["2026-W24"]).toEqual({
      Reading: { status: "not_started", notes: "" },
      Writing: { status: "not_started", notes: "" },
    });
  });
  test("does NOT overwrite existing items", () => {
    const existing = { status: "done", notes: "wrote a journal" };
    const data = { customItems: ["Reading", "Writing"], weeks: { "2026-W24": { Reading: existing } } };
    ensurePracticeLogWeek(data, "2026-W24");
    expect(data.weeks["2026-W24"].Reading).toBe(existing);
    expect(data.weeks["2026-W24"].Writing).toEqual({ status: "not_started", notes: "" });
  });
  test("returns the week record", () => {
    const data = { customItems: ["Reading"], weeks: {} };
    const wk = ensurePracticeLogWeek(data, "2026-W24");
    expect(wk).toBe(data.weeks["2026-W24"]);
  });
});

describe("weekHasUntouchedItem", () => {
  test("returns true when the week record is missing entirely", () => {
    const data = { customItems: ["Reading"], weeks: {} };
    expect(weekHasUntouchedItem(data, "2026-W24")).toBe(true);
  });
  test("returns true when an item is missing from the week", () => {
    const data = { customItems: ["Reading", "Writing"], weeks: {
      "2026-W24": { Reading: { status: "done", notes: "" } }
    }};
    expect(weekHasUntouchedItem(data, "2026-W24")).toBe(true);
  });
  test("returns true when any item is still on not_started", () => {
    const data = { customItems: ["Reading"], weeks: {
      "2026-W24": { Reading: { status: "not_started", notes: "" } }
    }};
    expect(weekHasUntouchedItem(data, "2026-W24")).toBe(true);
  });
  test("returns false when every item has a non-default status", () => {
    const data = { customItems: ["Reading", "Writing"], weeks: {
      "2026-W24": {
        Reading: { status: "done", notes: "" },
        Writing: { status: "skipped", notes: "" },
      }
    }};
    expect(weekHasUntouchedItem(data, "2026-W24")).toBe(false);
  });
  test("falls back to DEFAULT_ITEMS when data.customItems is missing", () => {
    expect(weekHasUntouchedItem({ weeks: {} }, "2026-W24")).toBe(true);
  });
  test("tolerates null data", () => {
    expect(weekHasUntouchedItem(null, "2026-W24")).toBe(true);
  });
});

describe("mergePracticeLog", () => {
  test("returns the non-null side when one is null", () => {
    const x = defaultPracticeLog();
    expect(mergePracticeLog(null, x)).toBe(x);
    expect(mergePracticeLog(x, null)).toBe(x);
  });
  test("unions customItems remote-first, dedup preserving order", () => {
    const r = { customItems: ["A", "B"], weeks: {}, historyRetainWeeks: 5 };
    const l = { customItems: ["B", "C"], weeks: {}, historyRetainWeeks: 5 };
    const out = mergePracticeLog(r, l);
    expect(out.customItems).toEqual(["A", "B", "C"]);
  });
  test("takes the larger historyRetainWeeks", () => {
    const r = { customItems: ["A"], weeks: {}, historyRetainWeeks: 5 };
    const l = { customItems: ["A"], weeks: {}, historyRetainWeeks: 20 };
    expect(mergePracticeLog(r, l).historyRetainWeeks).toBe(20);
  });
  test("per-item: local wins when both sides have content", () => {
    const r = { customItems: ["Reading"], weeks: {
      "W1": { Reading: { status: "done", notes: "remote" } }
    }, historyRetainWeeks: 5 };
    const l = { customItems: ["Reading"], weeks: {
      "W1": { Reading: { status: "in_progress", notes: "local" } }
    }, historyRetainWeeks: 5 };
    const out = mergePracticeLog(r, l);
    expect(out.weeks.W1.Reading).toEqual({ status: "in_progress", notes: "local" });
  });
  test("per-item: side with content wins over default-only side", () => {
    const r = { customItems: ["Reading"], weeks: {
      "W1": { Reading: { status: "done", notes: "real" } }
    }, historyRetainWeeks: 5 };
    const l = { customItems: ["Reading"], weeks: {
      "W1": { Reading: { status: "not_started", notes: "" } }
    }, historyRetainWeeks: 5 };
    const out = mergePracticeLog(r, l);
    expect(out.weeks.W1.Reading).toEqual({ status: "done", notes: "real" });
  });
  test("per-item: both default → default", () => {
    const r = { customItems: ["Reading"], weeks: {
      "W1": { Reading: { status: "not_started", notes: "" } }
    }, historyRetainWeeks: 5 };
    const l = { customItems: ["Reading"], weeks: {
      "W1": { Reading: { status: "not_started", notes: "" } }
    }, historyRetainWeeks: 5 };
    const out = mergePracticeLog(r, l);
    expect(out.weeks.W1.Reading).toEqual({ status: "not_started", notes: "" });
  });
  test("week present only on one side comes through intact", () => {
    const r = { customItems: ["Reading"], weeks: {
      "W1": { Reading: { status: "done", notes: "" } }
    }, historyRetainWeeks: 5 };
    const l = { customItems: ["Reading"], weeks: {
      "W2": { Reading: { status: "in_progress", notes: "" } }
    }, historyRetainWeeks: 5 };
    const out = mergePracticeLog(r, l);
    expect(out.weeks.W1.Reading.status).toBe("done");
    expect(out.weeks.W2.Reading.status).toBe("in_progress");
  });
  test("notes-only content beats no-content", () => {
    const r = { customItems: ["Reading"], weeks: {
      "W1": { Reading: { status: "not_started", notes: "remote idea" } }
    }, historyRetainWeeks: 5 };
    const l = { customItems: ["Reading"], weeks: {
      "W1": { Reading: { status: "not_started", notes: "" } }
    }, historyRetainWeeks: 5 };
    const out = mergePracticeLog(r, l);
    expect(out.weeks.W1.Reading).toEqual({ status: "not_started", notes: "remote idea" });
  });
});
