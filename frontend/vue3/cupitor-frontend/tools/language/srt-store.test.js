import { contextLinesToEntries, upsertIndexEntry, saveHit, mergeCapturedEntries } from "./srt-store.js";
import { mkdtempSync, existsSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseSrtEntries } from "../../public/language/srt-parser.js";
import { emptyStorage } from "../../public/language/subtitle-bundles.js";
import { readSubtitleFiles } from "./bundle-store.js";

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

  test("writeTarget:false writes only the source snippet (no translation file)", async () => {
    const { svPath, targetPath } = await saveHit(dir, hit, null, {
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

  test("default writes both source and target files", async () => {
    const { svPath, targetPath } = await saveHit(dir, hit, ["hi", "bye"], {
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

describe.each([false, true])("multiple captures of one YouTube video (bundled=%s)", (bundled) => {
  let dir;
  const first = {
    videoId: "sameVideo001", title: "Original title", channel: "Original channel",
    lines: [{ ts: 10, text: "Första ordet" }, { ts: 12, text: "Gemensam rad" }],
  };
  const second = {
    videoId: "sameVideo001", title: "Renamed video", channel: "Different channel",
    lines: [{ ts: 12, text: "Gemensam rad" }, { ts: 16, text: "Andra ordet" }],
  };
  const opts = { sourceLang: "sv", targetLang: "en" };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "srt-same-video-"));
    if (bundled) writeFileSync(join(dir, "storage.json"), JSON.stringify(emptyStorage(), null, 2) + "\n");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const cues = (dir, base, lang) => parseSrtEntries(readSubtitleFiles(dir)[`${base}.${lang}.srt`]);

  test("merges words, deduplicates overlapping context, preserves names, translations and index metadata", async () => {
    const initial = await saveHit(dir, first, ["First word", "Shared cue"], opts);
    let index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
    index[0].category = "Keep existing metadata";
    writeFileSync(join(dir, "index.json"), JSON.stringify(index, null, 2) + (bundled ? "\n" : ""));
    const next = await saveHit(dir, second, ["Shared cue", "Second word"], opts);
    expect(next.baseName).toBe(initial.baseName);
    index = JSON.parse(readFileSync(join(dir, "index.json"), "utf8"));
    expect(index).toHaveLength(1);
    expect(index[0].category).toBe("Keep existing metadata");
    expect(index[0].link).toBe("sameVideo001");
    expect(index[0].name).toBe(initial.baseName);
    expect(cues(dir, initial.baseName, "sv").map(x => x.text)).toEqual(["Första ordet", "Gemensam rad", "Andra ordet"]);
    expect(cues(dir, initial.baseName, "en").map(x => x.text)).toEqual(["First word", "Shared cue", "Second word"]);
    expect(cues(dir, initial.baseName, "sv").map(x => x.start)).toEqual([
      "00:00:10,000", "00:00:12,000", "00:00:16,000",
    ]);
    expect(Object.keys(readSubtitleFiles(dir))).toHaveLength(2);

    const before = readSubtitleFiles(dir), revision = index[0].bundleRevision;
    await saveHit(dir, second, ["Shared cue", "Second word"], opts);
    expect(readSubtitleFiles(dir)).toEqual(before);
    expect(JSON.parse(readFileSync(join(dir, "index.json"), "utf8"))[0].bundleRevision).toBe(revision);
  });

  test("a later source-only capture extends the source without removing the old translation", async () => {
    const { baseName } = await saveHit(dir, first, ["First word", "Shared cue"], opts);
    await saveHit(dir, { ...second, lines: [{ ts: 20, text: "Tredje ordet" }] }, null, { ...opts, writeTarget: false });
    expect(cues(dir, baseName, "sv").map(x => x.text)).toEqual(["Första ordet", "Gemensam rad", "Tredje ordet"]);
    expect(cues(dir, baseName, "en").map(x => x.text)).toEqual(["First word", "Shared cue"]);
  });

  test("conflicting lines at the same timestamp keep existing cues by default in both tracks", async () => {
    const { baseName } = await saveHit(dir, first, ["First word", "Shared cue"], opts);
    await saveHit(dir, { ...second, lines: [{ ts: 12, text: "Different transcript" }] }, ["Different translation"], opts);
    expect(cues(dir, baseName, "sv").map(x => x.text)).toEqual(["Första ordet", "Gemensam rad"]);
    expect(cues(dir, baseName, "en").map(x => x.text)).toEqual(["First word", "Shared cue"]);
  });

  test("error policy rejects a conflicting translation without modifying the source or index", async () => {
    await saveHit(dir, first, ["First word", "Shared cue"], opts);
    const before = readSubtitleFiles(dir);
    const originalIndex = readFileSync(join(dir, "index.json"), "utf8");
    await expect(saveHit(dir, { ...second, lines: [{ ts: 12, text: "Gemensam rad" }, { ts: 16, text: "Andra ordet" }] },
      ["Wrong existing translation", "Second word"], { ...opts, srtConflict: "error" })).rejects.toThrow(/Conflicting captured subtitles/);
    expect(readSubtitleFiles(dir)).toEqual(before);
    expect(readFileSync(join(dir, "index.json"), "utf8")).toBe(originalIndex);
  });
});

describe("capture SRT conflict policy and index safety", () => {
  const prior = "1\n00:00:03,000 --> 00:00:05,000\nOld subtitle\n";
  test("replace updates a colliding cue and keeps other cues", () => {
    const merged = mergeCapturedEntries(prior, [
      { start: 3, end: 5, text: "New subtitle" },
      { start: 8, end: 10, text: "Another line" },
    ], "replace");
    expect(parseSrtEntries(merged).map(x => x.text)).toEqual(["New subtitle", "Another line"]);
  });
  test("two incoming captions at the same timestamp do not create duplicate cues", () => {
    const same = [{ start: 3, end: 5, text: "First" }, { start: 3, end: 6, text: "Different" }];
    expect(parseSrtEntries(mergeCapturedEntries("", same)).map(x => x.text)).toEqual(["First"]);
    expect(parseSrtEntries(mergeCapturedEntries("", same, "replace")).map(x => x.text)).toEqual(["Different"]);
    expect(() => mergeCapturedEntries("", same, "error")).toThrow(/Conflicting captured subtitles/);
  });
  test("a corrupt subtitle index must not be silently replaced", async () => {
    const dir = mkdtempSync(join(tmpdir(), "srt-bad-index-"));
    try {
      writeFileSync(join(dir, "index.json"), "{broken");
      await expect(saveHit(dir, { videoId: "id1", lines: [{ ts: 1, text: "Text" }] }, null,
        { sourceLang: "sv", targetLang: "en", writeTarget: false })).rejects.toThrow();
      expect(readFileSync(join(dir, "index.json"), "utf8")).toBe("{broken");
      expect(Object.keys(readSubtitleFiles(dir))).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test("a translation must be present for every captured source line", async () => {
    const dir = mkdtempSync(join(tmpdir(), "srt-missing-translation-"));
    try {
      await expect(saveHit(dir, { videoId: "id1", lines: [{ ts: 1, text: "Text" }] }, [],
        { sourceLang: "sv", targetLang: "en" })).rejects.toThrow(/aligned translation/);
      expect(existsSync(join(dir, "index.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
