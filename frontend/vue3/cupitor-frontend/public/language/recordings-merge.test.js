import {
  isVirtual,
  isManualItem,
  newManualId,
  parseMediaUrl,
  virtualMembers,
  resolveVirtualItems,
  itemsForRecording,
  recordingItemCountIn,
  recordingItemCountByName,
  mergeRecordingCollections,
  mergeRecordingsLocalAuthoritative,
  bridgePlaylistsToRecordings,
} from "./recordings-merge";

describe("bridgePlaylistsToRecordings", () => {
  const now = () => 1700000000000;
  const payload = {
    version: 1,
    active_id: "p2",
    playlists: [
      { id: "p1", name: "Chapter notes", created_at: 10, cards: [
        { id: "c1", text: "vad betyder detta?", book_key: "bookA", book_title: "Book A", chapter_idx: 0, chapter_title: "Intro", position: 5, created_at: 11 },
      ] },
      { id: "p2", name: "Hard words", created_at: 20, cards: [
        { id: "c2", text: "annat ord", book_key: "bookB", chapter_idx: 3, position: 9, created_at: 21 },
      ] },
    ],
  };

  test("maps card.text to the front (source), leaves target blank, tags external manual", () => {
    const { recordings } = bridgePlaylistsToRecordings(payload, now);
    const card = recordings["Chapter notes"].items.Manual.Card[0];
    expect(card.source).toBe("vad betyder detta?");
    expect(card.target).toBe("");
    expect(card.manual).toBe(true);
    expect(card.external).toBe(true);
    expect(card.id).toBe("c1");
  });

  test("carries book/chapter metadata, preserving chapter_idx of 0", () => {
    const { recordings } = bridgePlaylistsToRecordings(payload, now);
    const card = recordings["Chapter notes"].items.Manual.Card[0];
    expect(card.book_key).toBe("bookA");
    expect(card.chapter_idx).toBe(0);
    expect(card.chapter_title).toBe("Intro");
  });

  test("marks each playlist external with its ext id and resolves active_id → name", () => {
    const { recordings, activeName } = bridgePlaylistsToRecordings(payload, now);
    expect(recordings["Hard words"].external).toBe(true);
    expect(recordings["Hard words"].extId).toBe("p2");
    expect(activeName).toBe("Hard words");
  });

  test("empty / missing payload yields no recordings and no active", () => {
    expect(bridgePlaylistsToRecordings(null, now)).toEqual({ recordings: {}, activeName: null });
    expect(bridgePlaylistsToRecordings({ playlists: [] }, now)).toEqual({ recordings: {}, activeName: null });
  });
});

const fixedNow = () => 1700000000000;

describe("mergeRecordingsLocalAuthoritative", () => {
  const item = (id, lineIndex) => ({ id, lineIndex, searchText: "s", word: "w" });
  const pl = (items, updatedAt = 1) => ({ items, createdAt: 1, updatedAt });

  test("drops playlists that exist only on remote (deletion propagates)", () => {
    const local = { A: pl({ s: { w: [item("v1", 1)] } }) };
    const remote = { A: pl({ s: { w: [item("v1", 1)] } }), B: pl({ s: { w: [item("v9", 9)] } }) };
    const out = mergeRecordingsLocalAuthoritative(local, remote, fixedNow);
    expect(Object.keys(out).sort()).toEqual(["A"]);
  });

  test("keeps playlists that exist only locally", () => {
    const local = { A: pl({ s: { w: [item("v1", 1)] } }), C: pl({ s: { w: [item("v3", 3)] } }) };
    const remote = { A: pl({ s: { w: [item("v1", 1)] } }) };
    const out = mergeRecordingsLocalAuthoritative(local, remote, fixedNow);
    expect(Object.keys(out).sort()).toEqual(["A", "C"]);
  });

  test("unions items for a playlist present on both sides (keeps other-device captures)", () => {
    const local = { A: pl({ s: { w: [item("v1", 1)] } }, 2) };
    const remote = { A: pl({ s: { w: [item("v2", 2)] } }, 1) };
    const out = mergeRecordingsLocalAuthoritative(local, remote, fixedNow);
    const ids = out.A.items.s.w.map((i) => i.id).sort();
    expect(ids).toEqual(["v1", "v2"]);
  });

  test("empty local drops everything (all deleted)", () => {
    const remote = { A: pl({ s: { w: [item("v1", 1)] } }) };
    expect(mergeRecordingsLocalAuthoritative({}, remote, fixedNow)).toEqual({});
  });
});

describe("isVirtual", () => {
  test("true when the entry has virtual: true", () => {
    const coll = { v: { virtual: true, members: [] }, r: { items: {} } };
    expect(isVirtual(coll, "v")).toBe(true);
    expect(isVirtual(coll, "r")).toBe(false);
  });
  test("false for missing name / empty coll", () => {
    expect(isVirtual({}, "x")).toBe(false);
    expect(isVirtual(null, "x")).toBe(false);
  });
});

describe("isManualItem", () => {
  test("true only when item.manual is truthy", () => {
    expect(isManualItem({ manual: true })).toBe(true);
    expect(isManualItem({ manual: false })).toBe(false);
    expect(isManualItem({})).toBe(false);
    expect(isManualItem(null)).toBe(false);
  });
});

describe("newManualId", () => {
  test("starts with 'mc-' and is deterministic when rand is", () => {
    const id = newManualId(() => 0.5);
    expect(id.startsWith("mc-")).toBe(true);
    // With () => 0.5 each (0.5).toString(36) is "0.i", so the slices
    // pick "i" + "i" → "mc-ii". The point of the test is determinism +
    // the mc- prefix, not the absolute length.
    expect(id).toBe("mc-ii");
  });
  test("produces realistic-length ids when rand returns typical values", () => {
    // Math.random()-like values produce ~12-char ids in production.
    const id = newManualId(() => 0.123456789);
    expect(id.length).toBeGreaterThanOrEqual(10);
  });
  test("two calls with the same rand fn return the same id (deterministic)", () => {
    const r = () => 0.5;
    expect(newManualId(r)).toBe(newManualId(r));
  });
});

describe("parseMediaUrl", () => {
  test("null for blank / null input", () => {
    expect(parseMediaUrl("")).toBeNull();
    expect(parseMediaUrl(null)).toBeNull();
    expect(parseMediaUrl(undefined)).toBeNull();
    expect(parseMediaUrl("   ")).toBeNull();
  });
  test("file:// → audio", () => {
    expect(parseMediaUrl("file:///x/y.mp3")).toEqual({ kind: "audio", url: "file:///x/y.mp3" });
  });
  test("youtu.be short link", () => {
    expect(parseMediaUrl("https://youtu.be/aBcDeFgHiJk"))
      .toEqual({ kind: "youtube", id: "aBcDeFgHiJk", url: "https://youtu.be/aBcDeFgHiJk" });
  });
  test("youtube.com/watch?v=", () => {
    expect(parseMediaUrl("https://www.youtube.com/watch?v=aBcDeFgHiJk"))
      .toMatchObject({ kind: "youtube", id: "aBcDeFgHiJk" });
  });
  test("youtube.com/embed/", () => {
    expect(parseMediaUrl("https://www.youtube.com/embed/aBcDeFgHiJk"))
      .toMatchObject({ kind: "youtube", id: "aBcDeFgHiJk" });
  });
  test("youtube shorts", () => {
    expect(parseMediaUrl("https://www.youtube.com/shorts/aBcDeFgHiJk"))
      .toMatchObject({ kind: "youtube", id: "aBcDeFgHiJk" });
  });
  test("non-YouTube URL → 'link'", () => {
    expect(parseMediaUrl("https://vimeo.com/12345"))
      .toEqual({ kind: "link", url: "https://vimeo.com/12345" });
  });
  test("trims surrounding whitespace", () => {
    expect(parseMediaUrl("  https://example.com  "))
      .toEqual({ kind: "link", url: "https://example.com" });
  });
});

describe("virtualMembers", () => {
  const coll = {
    v:    { virtual: true, members: ["a", "b", "nope", "vChild"] },
    a:    { items: {} },
    b:    { items: {} },
    vChild: { virtual: true, members: [] },
  };
  test("filters out members that don't exist", () => {
    expect(virtualMembers(coll, "v")).toEqual(["a", "b"]);
  });
  test("excludes nested virtual playlists", () => {
    expect(virtualMembers(coll, "v")).not.toContain("vChild");
  });
  test("returns [] for non-virtual / missing names", () => {
    expect(virtualMembers(coll, "a")).toEqual([]);
    expect(virtualMembers(coll, "nope")).toEqual([]);
  });
});

describe("resolveVirtualItems", () => {
  const it = (id, lineIndex) => ({ id, lineIndex });
  const coll = {
    v: { virtual: true, members: ["a", "b"] },
    a: { items: { search1: { word1: [it("X", 1), it("Y", 2)] } } },
    b: { items: {
      search1: { word1: [it("X", 1), it("Z", 3)] },   // X dup, Z new
      search2: { word2: [it("Q", 4)] },
    } },
  };
  test("unions items across members, deduping by id+lineIndex", () => {
    const out = resolveVirtualItems(coll, "v");
    expect(out.search1.word1.map(i => i.id)).toEqual(["X", "Y", "Z"]);
    expect(out.search2.word2.map(i => i.id)).toEqual(["Q"]);
  });
  test("returns {} when the playlist isn't virtual", () => {
    expect(resolveVirtualItems(coll, "a")).toEqual({});
  });
  test("preserves first-seen order across members (newer-first)", () => {
    const c = {
      v: { virtual: true, members: ["a", "b"] },
      a: { items: { s: { w: [it("A", 1)] } } },
      b: { items: { s: { w: [it("B", 1)] } } },
    };
    expect(resolveVirtualItems(c, "v").s.w.map(i => i.id)).toEqual(["A", "B"]);
  });
});

describe("itemsForRecording", () => {
  test("returns the items map for a real playlist", () => {
    const coll = { r: { items: { s: { w: [{ id: "X", lineIndex: 1 }] } } } };
    expect(itemsForRecording(coll, "r").s.w[0].id).toBe("X");
  });
  test("resolves a virtual playlist on the fly", () => {
    const coll = {
      v: { virtual: true, members: ["a"] },
      a: { items: { s: { w: [{ id: "X", lineIndex: 1 }] } } },
    };
    expect(itemsForRecording(coll, "v").s.w[0].id).toBe("X");
  });
  test("returns {} for unknown names", () => {
    expect(itemsForRecording({}, "missing")).toEqual({});
  });
});

describe("recordingItemCountIn", () => {
  test("counts all items across all (searchText, word) buckets", () => {
    const items = {
      a: { x: [{}, {}], y: [{}] },
      b: { z: [{}, {}, {}] },
    };
    expect(recordingItemCountIn(items)).toBe(6);
  });
  test("returns 0 for empty / null", () => {
    expect(recordingItemCountIn({})).toBe(0);
    expect(recordingItemCountIn(null)).toBe(0);
  });
});

describe("recordingItemCountByName", () => {
  test("delegates to itemsForRecording then counts", () => {
    const coll = {
      r: { items: { s: { w: [{ id: "X", lineIndex: 1 }, { id: "Y", lineIndex: 2 }] } } }
    };
    expect(recordingItemCountByName(coll, "r")).toBe(2);
  });
  test("returns 0 for unknown name", () => {
    expect(recordingItemCountByName({}, "x")).toBe(0);
  });
});

describe("mergeRecordingCollections", () => {
  const it = (id, lineIndex, extra = {}) => ({ id, lineIndex, ...extra });

  test("a playlist on only one side comes through intact", () => {
    const a = { p1: { items: { s: { w: [it("X", 1)] } }, createdAt: 100, updatedAt: 200 } };
    const b = { p2: { items: { s: { w: [it("Y", 1)] } }, createdAt: 50, updatedAt: 60 } };
    const out = mergeRecordingCollections(a, b, fixedNow);
    expect(out.p1).toBe(a.p1);
    expect(out.p2).toBe(b.p2);
  });

  test("real playlists union items by (id, lineIndex)", () => {
    const a = { p: { items: { s: { w: [it("X", 1), it("Y", 2)] } }, createdAt: 1, updatedAt: 200 } };
    const b = { p: { items: { s: { w: [it("X", 1), it("Z", 3)] } }, createdAt: 1, updatedAt: 100 } };
    const out = mergeRecordingCollections(a, b, fixedNow);
    expect(out.p.items.s.w.map(i => i.id)).toEqual(["X", "Y", "Z"]);
    expect(out.p.updatedAt).toBe(200);
    expect(out.p.createdAt).toBe(1);
  });

  test("newer side wins for ordering ties when same (id, lineIndex) seen first", () => {
    const a = { p: { items: { s: { w: [it("X", 1, { from: "a" })] } }, createdAt: 1, updatedAt: 200 } };
    const b = { p: { items: { s: { w: [it("X", 1, { from: "b" })] } }, createdAt: 1, updatedAt: 100 } };
    const out = mergeRecordingCollections(a, b, fixedNow);
    // Newer (a) is first in the dedup walk, so its X wins.
    expect(out.p.items.s.w[0].from).toBe("a");
  });

  test("virtual ∪ virtual → union of members, newer first", () => {
    const a = { v: { virtual: true, members: ["m1", "m2"], updatedAt: 200, createdAt: 100 } };
    const b = { v: { virtual: true, members: ["m2", "m3"], updatedAt: 100, createdAt: 50 } };
    const out = mergeRecordingCollections(a, b, fixedNow);
    expect(out.v.members).toEqual(["m1", "m2", "m3"]);
    expect(out.v.updatedAt).toBe(200);
    expect(out.v.createdAt).toBe(50);
  });

  test("virtual + real where virtual is newer → virtual wins", () => {
    const a = { x: { virtual: true, members: ["m"], updatedAt: 200, createdAt: 1 } };
    const b = { x: { items: { s: { w: [it("X", 1)] } }, updatedAt: 100, createdAt: 1 } };
    const out = mergeRecordingCollections(a, b, fixedNow);
    expect(out.x.virtual).toBe(true);
    expect(out.x.members).toEqual(["m"]);
  });

  test("virtual + real where real is newer → real wins as-is", () => {
    const a = { x: { virtual: true, members: ["m"], updatedAt: 100, createdAt: 1 } };
    const b = { x: { items: { s: { w: [it("X", 1)] } }, updatedAt: 200, createdAt: 1 } };
    const out = mergeRecordingCollections(a, b, fixedNow);
    expect(out.x).toBe(b.x);
  });

  test("handles null/empty collections", () => {
    expect(mergeRecordingCollections(null, null, fixedNow)).toEqual({});
    const a = { p: { items: {}, updatedAt: 1, createdAt: 1 } };
    expect(mergeRecordingCollections(a, null, fixedNow).p).toBe(a.p);
    expect(mergeRecordingCollections(null, a, fixedNow).p).toBe(a.p);
  });
});
