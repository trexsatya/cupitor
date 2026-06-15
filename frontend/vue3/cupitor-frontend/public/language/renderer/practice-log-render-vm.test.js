import {
  statusInfo,
  buildPracticeLogPlanVM,
  buildPracticeLogHistoryVM,
} from "./practice-log-render-vm";

describe("statusInfo", () => {
  test("returns the matching status entry", () => {
    expect(statusInfo("done").label).toBe("Done");
    expect(statusInfo("in_progress").label).toBe("In progress");
  });
  test("defaults to 'not_started' for missing / unknown values", () => {
    expect(statusInfo(null).value).toBe("not_started");
    expect(statusInfo(undefined).value).toBe("not_started");
    expect(statusInfo("garbage").value).toBe("not_started");
  });
  test("includes css class hint", () => {
    expect(statusInfo("done").cls).toMatch(/^pl-status-/);
  });
});

describe("buildPracticeLogPlanVM", () => {
  test("projects items in customItems order with backfilled defaults", () => {
    const vm = buildPracticeLogPlanVM(
      ["Reading", "Writing"],
      { Reading: { status: "done", notes: "ok" } },
      "2026-W24"
    );
    expect(vm.weekLabel).toBe("2026-W24");
    expect(vm.items.length).toBe(2);
    expect(vm.items[0]).toEqual({
      name: "Reading", status: "done", notes: "ok", isDefault: true
    });
    expect(vm.items[1]).toEqual({
      name: "Writing", status: "not_started", notes: "", isDefault: true
    });
  });
  test("isDefault is false for items NOT in PRACTICE_LOG_DEFAULT_ITEMS", () => {
    const vm = buildPracticeLogPlanVM(["MyCustom"], {}, "2026-W24");
    expect(vm.items[0].isDefault).toBe(false);
  });
  test("handles missing weekRecord (e.g. brand-new week)", () => {
    const vm = buildPracticeLogPlanVM(["Reading"], null, "W1");
    expect(vm.items[0]).toEqual({
      name: "Reading", status: "not_started", notes: "", isDefault: true
    });
  });
  test("handles empty customItems → empty items", () => {
    const vm = buildPracticeLogPlanVM([], {}, "W1");
    expect(vm.items).toEqual([]);
  });
});

describe("buildPracticeLogHistoryVM — empty", () => {
  test("'empty' state when there are no weeks", () => {
    const out = buildPracticeLogHistoryVM({ weeks: {} });
    expect(out.state).toBe("empty");
  });
  test("'empty' state when data is null", () => {
    expect(buildPracticeLogHistoryVM(null).state).toBe("empty");
    expect(buildPracticeLogHistoryVM(undefined).state).toBe("empty");
  });
});

describe("buildPracticeLogHistoryVM — weeks", () => {
  function makeData() {
    return {
      historyRetainWeeks: 50,
      weeks: {
        "2026-W22": { Reading: { status: "done", notes: " spent 1h on a novel " } },
        "2026-W23": { Writing: { status: "in_progress", notes: "" } },
        "2026-W24": {},
      }
    };
  }
  test("emits weeks in reverse-chronological order", () => {
    const vm = buildPracticeLogHistoryVM(makeData());
    expect(vm.weeks.map(w => w.label)).toEqual(["2026-W24", "2026-W23", "2026-W22"]);
  });
  test("empty week record gets empty:true", () => {
    const vm = buildPracticeLogHistoryVM(makeData());
    expect(vm.weeks.find(w => w.label === "2026-W24").empty).toBe(true);
  });
  test("trims notes whitespace", () => {
    const vm = buildPracticeLogHistoryVM(makeData());
    const w22 = vm.weeks.find(w => w.label === "2026-W22");
    expect(w22.items[0].notes).toBe("spent 1h on a novel");
  });
  test("statusLabel + statusCls come through statusInfo lookup", () => {
    const vm = buildPracticeLogHistoryVM(makeData());
    const w22 = vm.weeks.find(w => w.label === "2026-W22");
    expect(w22.items[0].statusLabel).toBe("Done");
    expect(w22.items[0].statusCls).toMatch(/done/);
  });
});

describe("buildPracticeLogHistoryVM — retention", () => {
  test("slices to historyRetainWeeks most-recent entries", () => {
    const data = {
      historyRetainWeeks: 2,
      weeks: {
        "2026-W20": {}, "2026-W21": {}, "2026-W22": {}, "2026-W23": {}
      }
    };
    const vm = buildPracticeLogHistoryVM(data);
    expect(vm.weeks.map(w => w.label)).toEqual(["2026-W23", "2026-W22"]);
    expect(vm.retainWeeks).toBe(2);
  });
  test("falls back to default retention for garbage value", () => {
    const data = { historyRetainWeeks: 0, weeks: { "W1": {} } };
    const vm = buildPracticeLogHistoryVM(data);
    expect(vm.retainWeeks).toBeGreaterThan(0);
  });
});
