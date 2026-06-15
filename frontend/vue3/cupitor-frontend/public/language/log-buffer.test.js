import {
  LOG_BUFFER_MAX,
  serializeLogArg,
  pushLog,
  installConsoleTap,
  makeWindowErrorEntry,
  makeUnhandledRejectionEntry,
} from "./log-buffer";

describe("LOG_BUFFER_MAX", () => {
  test("is a positive integer", () => {
    expect(Number.isInteger(LOG_BUFFER_MAX)).toBe(true);
    expect(LOG_BUFFER_MAX).toBeGreaterThan(0);
  });
});

describe("serializeLogArg", () => {
  test("strings pass through", () => {
    expect(serializeLogArg("hello")).toBe("hello");
  });
  test("Error → stack (when present)", () => {
    const e = new Error("oops");
    const out = serializeLogArg(e);
    expect(out).toContain("oops");
  });
  test("Error without stack → 'Name: message'", () => {
    const e = new Error("oops");
    delete e.stack;
    expect(serializeLogArg(e)).toBe("Error: oops");
  });
  test("plain object → JSON", () => {
    expect(serializeLogArg({ a: 1 })).toBe('{"a":1}');
  });
  test("cyclic object falls back to String()", () => {
    const x = {}; x.self = x;
    const out = serializeLogArg(x);
    expect(out).toBe(String(x));   // "[object Object]"
  });
  test("numbers and booleans round-trip via JSON", () => {
    expect(serializeLogArg(42)).toBe("42");
    expect(serializeLogArg(true)).toBe("true");
  });
});

describe("pushLog", () => {
  test("appends and returns the buffer", () => {
    const buf = [];
    const out = pushLog(buf, { t: 1, level: "log", msg: "a" });
    expect(out).toBe(buf);
    expect(buf.length).toBe(1);
  });
  test("trims to max length (drops oldest entries)", () => {
    const buf = [];
    for (let i = 0; i < 10; i++) pushLog(buf, { t: i, level: "log", msg: String(i) }, 5);
    expect(buf.length).toBe(5);
    // Oldest five (0..4) should be gone; newest five (5..9) remain.
    expect(buf.map(e => e.msg)).toEqual(["5", "6", "7", "8", "9"]);
  });
  test("respects the default max when none is given", () => {
    const buf = [];
    pushLog(buf, { t: 1, level: "log", msg: "x" });
    expect(buf.length).toBe(1);
  });
});

describe("installConsoleTap", () => {
  function makeConsole() {
    return { log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  }

  test("mirrors calls into the buffer + forwards to the original method", () => {
    const buf = [];
    const c = makeConsole();
    const origLog = c.log;
    const uninstall = installConsoleTap(buf, c, { now: () => 100 });
    c.log("hello", { x: 1 });
    expect(buf.length).toBe(1);
    expect(buf[0]).toEqual({ t: 100, level: "log", msg: 'hello {"x":1}' });
    expect(origLog).toHaveBeenCalledWith("hello", { x: 1 });
    uninstall();
  });
  test("uninstaller restores the original methods", () => {
    const c = makeConsole();
    const origs = { log: c.log, info: c.info, warn: c.warn, error: c.error, debug: c.debug };
    const uninstall = installConsoleTap([], c);
    expect(c.log).not.toBe(origs.log);
    uninstall();
    expect(c.log).toBe(origs.log);
    expect(c.info).toBe(origs.info);
    expect(c.debug).toBe(origs.debug);
  });
  test("respects the levels option (skip unmatched)", () => {
    const buf = [];
    const c = makeConsole();
    const origInfo = c.info;
    installConsoleTap(buf, c, { levels: ["log"] });
    c.info("not patched");
    expect(buf.length).toBe(0);
    expect(c.info).toBe(origInfo);  // info NOT patched
  });
  test("respects the max option", () => {
    const buf = [];
    const c = makeConsole();
    installConsoleTap(buf, c, { max: 3 });
    for (let i = 0; i < 5; i++) c.log("m" + i);
    expect(buf.length).toBe(3);
    expect(buf.map(e => e.msg)).toEqual(["m2", "m3", "m4"]);
  });
  test("calls without an original method don't throw", () => {
    const buf = [];
    const c = { log: undefined };
    installConsoleTap(buf, c);
    c.log("safe");   // no original to call, but the tap fires
    expect(buf.length).toBe(1);
  });
});

describe("makeWindowErrorEntry", () => {
  test("formats a standard ErrorEvent shape", () => {
    const e = { message: "boom", filename: "/x.js", lineno: 1, colno: 2 };
    const entry = makeWindowErrorEntry(e, () => 100);
    expect(entry).toEqual({
      t: 100,
      level: "error",
      msg: "[window.error] boom @ /x.js:1:2",
    });
  });
  test("appends the underlying error's stack when present", () => {
    const err = new Error("inner");
    const e = { message: "outer", error: err };
    const entry = makeWindowErrorEntry(e, () => 0);
    expect(entry.msg).toContain("outer");
    expect(entry.msg).toContain(err.stack);
  });
  test("falls back to e.type when message is missing", () => {
    const entry = makeWindowErrorEntry({ type: "unknown" }, () => 0);
    expect(entry.msg).toContain("unknown");
  });
});

describe("makeUnhandledRejectionEntry", () => {
  test("uses the reason's stack when present", () => {
    const err = new Error("rejected");
    const entry = makeUnhandledRejectionEntry({ reason: err }, () => 0);
    expect(entry.msg).toContain("[unhandledrejection]");
    expect(entry.msg).toContain(err.stack);
  });
  test("falls back to serializeLogArg for non-Error reasons", () => {
    const entry = makeUnhandledRejectionEntry({ reason: { code: 42 } }, () => 0);
    expect(entry.msg).toContain('{"code":42}');
  });
  test("handles missing event / reason gracefully", () => {
    const entry = makeUnhandledRejectionEntry({}, () => 0);
    expect(entry.level).toBe("error");
  });
});
