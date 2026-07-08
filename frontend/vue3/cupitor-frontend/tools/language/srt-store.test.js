import { contextLinesToEntries, upsertIndexEntry, saveHit } from "./srt-store.js";
import { mkdtempSync, existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("saveHit writeTarget", () => {
  const hit = {
    videoId: "vid123",
    title: "Titel",
    channel: "Kanal",
    lines: [{ ts: 1, text: "hej" }, { ts: 3, text: "då" }],
  };
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "srt-store-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("writeTarget:false writes only the source snippet (no translation file)", () => {
    const { svPath, targetPath } = saveHit(dir, hit, null, {
      sourceLang: "sv",
      targetLang: "en",
      writeTarget: false,
    });
    expect(existsSync(svPath)).toBe(true);
    expect(targetPath).toBeNull();
    expect(existsSync(svPath.replace(/\.sv\.srt$/, ".en.srt"))).toBe(false);
    // index.json still records the video
    const idx = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
    expect(idx.some((e) => e.link === "vid123")).toBe(true);
  });

  test("default writes both source and target files", () => {
    const { svPath, targetPath } = saveHit(dir, hit, ["hi", "bye"], {
      sourceLang: "sv",
      targetLang: "en",
    });
    expect(existsSync(svPath)).toBe(true);
    expect(existsSync(targetPath)).toBe(true);
  });
});

describe("contextLinesToEntries", () => {
  test("end of each entry is the next line's start; last uses defaultDur", () => {
    const lines = [
      { ts: 10, text: "a" },
      { ts: 12, text: "b" },
      { ts: 15, text: "c" },
    ];
    expect(contextLinesToEntries(lines, { defaultDurSec: 3 })).toEqual([
      { start: 10, end: 12, text: "a" },
      { start: 12, end: 15, text: "b" },
      { start: 15, end: 18, text: "c" },
    ]);
  });

  test("uses overridden text when provided (e.g. translations)", () => {
    const lines = [{ ts: 1, text: "hej" }];
    expect(
      contextLinesToEntries(lines, { texts: ["hi"], defaultDurSec: 2 })
    ).toEqual([{ start: 1, end: 3, text: "hi" }]);
  });
});

describe("upsertIndexEntry", () => {
  const base = [{ link: "x", name: "X", source: "YouTube" }];

  test("appends a new video id", () => {
    const out = upsertIndexEntry(base, { videoId: "y", name: "Y", source: "YouTube" });
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({ link: "y", name: "Y", source: "YouTube" });
  });

  test("replaces an existing entry in place (no duplicate link)", () => {
    const out = upsertIndexEntry(base, { videoId: "x", name: "X2", source: "YouTube" });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("X2");
  });

  test("does not mutate the input array", () => {
    upsertIndexEntry(base, { videoId: "z", name: "Z" });
    expect(base).toHaveLength(1);
  });
});
