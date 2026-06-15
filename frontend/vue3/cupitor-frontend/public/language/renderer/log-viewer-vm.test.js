import {
  LOG_LEVEL_ORDER,
  filterLogs,
  formatLogTimestamp,
  formatLogsAsText,
} from "./log-viewer-vm";

const entry = (level, msg, t = 0) => ({ t, level, msg });

describe("LOG_LEVEL_ORDER", () => {
  test("error is the most severe (lowest number)", () => {
    expect(LOG_LEVEL_ORDER.error).toBeLessThan(LOG_LEVEL_ORDER.warn);
    expect(LOG_LEVEL_ORDER.warn).toBeLessThan(LOG_LEVEL_ORDER.info);
    expect(LOG_LEVEL_ORDER.info).toBeLessThan(LOG_LEVEL_ORDER.log);
    expect(LOG_LEVEL_ORDER.log).toBeLessThan(LOG_LEVEL_ORDER.debug);
  });
});

describe("filterLogs — level filter", () => {
  const buf = [
    entry("error", "E"),
    entry("warn",  "W"),
    entry("info",  "I"),
    entry("log",   "L"),
    entry("debug", "D"),
  ];
  test("'all' returns every entry", () => {
    expect(filterLogs(buf, { level: "all" }).map(e => e.msg)).toEqual(["E", "W", "I", "L", "D"]);
  });
  test("'warn' keeps error + warn (more severe / equal)", () => {
    expect(filterLogs(buf, { level: "warn" }).map(e => e.msg)).toEqual(["E", "W"]);
  });
  test("'info' keeps error + warn + info", () => {
    expect(filterLogs(buf, { level: "info" }).map(e => e.msg)).toEqual(["E", "W", "I"]);
  });
  test("'debug' keeps everything", () => {
    expect(filterLogs(buf, { level: "debug" }).map(e => e.msg)).toEqual(["E", "W", "I", "L", "D"]);
  });
  test("unknown level behaves like 'all'", () => {
    expect(filterLogs(buf, { level: "trace" }).map(e => e.msg)).toEqual(["E", "W", "I", "L", "D"]);
  });
  test("entries with unknown levels are treated as least-severe (kept on 'all', dropped otherwise)", () => {
    const mixed = [entry("error", "E"), entry("trace", "T")];
    expect(filterLogs(mixed, { level: "all" }).map(e => e.msg)).toEqual(["E", "T"]);
    expect(filterLogs(mixed, { level: "error" }).map(e => e.msg)).toEqual(["E"]);
  });
});

describe("filterLogs — query filter", () => {
  const buf = [
    entry("log", "Hello world"),
    entry("log", "GOODBYE"),
    entry("log", "World peace"),
  ];
  test("case-insensitive substring match", () => {
    expect(filterLogs(buf, { query: "world" }).map(e => e.msg))
      .toEqual(["Hello world", "World peace"]);
  });
  test("empty query returns everything", () => {
    expect(filterLogs(buf, { query: "" }).length).toBe(3);
  });
  test("query is trimmed via lowercase comparison only — leading/trailing whitespace is significant", () => {
    expect(filterLogs(buf, { query: "GOOD" }).map(e => e.msg)).toEqual(["GOODBYE"]);
  });
  test("query + level compose (AND semantics)", () => {
    const mixed = [
      entry("error", "boom"),
      entry("warn",  "boom"),
      entry("info",  "irrelevant"),
    ];
    expect(filterLogs(mixed, { level: "warn", query: "boom" }).map(e => e.msg))
      .toEqual(["boom", "boom"]);
  });
});

describe("filterLogs — defaults / robustness", () => {
  test("default options = no filtering", () => {
    const buf = [entry("error", "E"), entry("debug", "D")];
    expect(filterLogs(buf).length).toBe(2);
  });
  test("non-array buffer → []", () => {
    expect(filterLogs(null)).toEqual([]);
    expect(filterLogs(undefined)).toEqual([]);
    expect(filterLogs("not an array")).toEqual([]);
  });
  test("null entries are skipped", () => {
    const buf = [null, entry("log", "ok"), undefined];
    expect(filterLogs(buf).length).toBe(1);
  });
  test("entries with non-string msg are coerced for substring check", () => {
    const buf = [{ t: 0, level: "log", msg: 42 }, { t: 0, level: "log", msg: null }];
    expect(filterLogs(buf, { query: "42" }).length).toBe(1);
    expect(filterLogs(buf, { query: "" }).length).toBe(2);
  });
});

describe("formatLogTimestamp", () => {
  test("formats a millisecond timestamp as HH:MM:SS.mmm", () => {
    // 1700000000000 UTC = 2023-11-14T22:13:20.000Z → "22:13:20.000"
    expect(formatLogTimestamp(1700000000000)).toBe("22:13:20.000");
  });
  test("preserves sub-second precision", () => {
    expect(formatLogTimestamp(1700000000456)).toBe("22:13:20.456");
  });
  test("epoch zero is '00:00:00.000'", () => {
    expect(formatLogTimestamp(0)).toBe("00:00:00.000");
  });
});

describe("formatLogsAsText", () => {
  test("renders one ISO-stamped line per entry", () => {
    const buf = [
      entry("error", "boom", 1700000000000),
      entry("info",  "ok",   1700000001000),
    ];
    const out = formatLogsAsText(buf);
    expect(out.split("\n").length).toBe(2);
    expect(out).toContain("[error] boom");
    expect(out).toContain("[info] ok");
    expect(out).toMatch(/2023-11-14T22:13:20\.000Z/);
  });
  test("returns '' for empty / non-array input", () => {
    expect(formatLogsAsText([])).toBe("");
    expect(formatLogsAsText(null)).toBe("");
  });
});
