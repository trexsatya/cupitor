import { toSeconds, fromSeconds } from "./time-format";

describe("toSeconds", () => {
  test("HH:MM:SS,mmm (SRT canonical) — comma decimal", () => {
    expect(toSeconds("00:00:05,500")).toBe(5.5);
    expect(toSeconds("01:02:03,456")).toBeCloseTo(3723.456, 3);
  });
  test("HH:MM:SS.mmm — dot decimal", () => {
    expect(toSeconds("00:00:05.500")).toBe(5.5);
  });
  test("MM:SS (no hour)", () => {
    expect(toSeconds("02:30")).toBe(150);
  });
  test("HH:MM:SS (no millis)", () => {
    expect(toSeconds("01:00:00")).toBe(3600);
  });
  test("plain numeric string falls back to 0 (no colons, no comma)", () => {
    // splits.length is 1 → none of the branches set hour/mins/secs → all 0.
    expect(toSeconds("42")).toBe(0);
  });
  test("coerces non-string input via String()", () => {
    expect(toSeconds(60)).toBe(0); // "60" — no colon, treated as malformed
  });
});

describe("fromSeconds", () => {
  test("zero", () => {
    expect(fromSeconds(0)).toBe("00:00:00");
  });
  test("less than a minute", () => {
    expect(fromSeconds(5)).toBe("00:00:05");
  });
  test("crosses minute boundary", () => {
    expect(fromSeconds(150)).toBe("00:02:30");
  });
  test("crosses hour boundary", () => {
    expect(fromSeconds(3723)).toBe("01:02:03");
  });
  test("truncates sub-second precision", () => {
    expect(fromSeconds(5.9)).toBe("00:00:05");
  });
  test("zero-pads single-digit parts", () => {
    expect(fromSeconds(61)).toBe("00:01:01");
  });
});

describe("toSeconds ↔ fromSeconds round trip", () => {
  test("integer seconds round-trip exactly", () => {
    for (const s of [0, 1, 60, 3600, 3723]) {
      expect(toSeconds(fromSeconds(s))).toBe(s);
    }
  });
});
