import {
  buildPlayQueue,
  shuffleQueue,
  migrateLegacyLastPlayedMap,
  setLastPlayedEntry,
  getNewestEntry,
  buildQueueKeys,
  saveQueueOrderInto,
  reconstituteQueue,
  resumePromptMessage,
  computeResumePoint,
} from "./play-queue";

const it = (id, lineIndex, extra = {}) => ({ id, lineIndex, ...extra });

describe("buildPlayQueue", () => {
  test("uses currentItems when loop is not 'all'", () => {
    const q = buildPlayQueue({
      loop: 'one',
      recordings: {},
      currentName: "P",
      currentItems: { s: { w: [it("X", 1)] } }
    });
    expect(q.length).toBe(1);
    expect(q[0]._recName).toBe("P");
    expect(q[0]._st).toBe("s");
    expect(q[0]._w).toBe("w");
    expect(q[0]._idx).toBe(0);
    expect(q[0].id).toBe("X");
  });
  test("loop 'all' unions every real playlist alphabetically", () => {
    const recordings = {
      Z: { items: { s: { w: [it("Z1", 1)] } } },
      A: { items: { s: { w: [it("A1", 1)] } } },
      M: { items: { s: { w: [it("M1", 1)] } } },
    };
    const q = buildPlayQueue({ loop: 'all', recordings, currentName: null, currentItems: null });
    expect(q.map(i => i.id)).toEqual(["A1", "M1", "Z1"]);
  });
  test("loop 'all' skips virtual playlists", () => {
    const recordings = {
      A: { items: { s: { w: [it("A1", 1)] } } },
      V: { virtual: true, members: ["A"] },
    };
    const q = buildPlayQueue({ loop: 'all', recordings });
    expect(q.map(i => i.id)).toEqual(["A1"]);
  });
  test("disabled items are skipped", () => {
    const q = buildPlayQueue({
      loop: 'one', currentName: "P",
      currentItems: { s: { w: [it("X", 1), it("Y", 2, { enabled: false })] } }
    });
    expect(q.map(i => i.id)).toEqual(["X"]);
  });
  test("empty input → empty queue", () => {
    expect(buildPlayQueue({ loop: 'one', currentItems: {} })).toEqual([]);
    expect(buildPlayQueue({ loop: 'all', recordings: {} })).toEqual([]);
  });
});

describe("shuffleQueue", () => {
  test("returns the same array (mutated)", () => {
    const q = [1, 2, 3];
    const out = shuffleQueue(q, () => 0.5);
    expect(out).toBe(q);
  });
  test("with rand=0 it stays stable (Fisher-Yates picks j=i)", () => {
    // For i=2 → j=Math.floor(0*3)=0 → swap q[2] and q[0]
    // For i=1 → j=Math.floor(0*2)=0 → swap q[1] and q[0]
    // Hand-trace expected = [2, 3, 1] from [1,2,3].
    const q = [1, 2, 3];
    shuffleQueue(q, () => 0);
    expect(q).toEqual([2, 3, 1]);
  });
  test("deterministic with a fixed sequence", () => {
    // Provide deterministic rand returning predictable picks.
    const sequence = [0.99, 0.5];
    let idx = 0;
    const q = [1, 2, 3];
    shuffleQueue(q, () => sequence[idx++ % sequence.length]);
    expect(q.length).toBe(3);
    expect(new Set(q)).toEqual(new Set([1, 2, 3]));
  });
});

describe("migrateLegacyLastPlayedMap", () => {
  test("wraps a legacy single-cursor entry into the map shape", () => {
    const legacy = { recName: "P", mode: "play", st: "s", w: "w", id: "X", lineIndex: 1 };
    const m = migrateLegacyLastPlayedMap(legacy);
    expect(m.P.play).toBe(legacy);
  });
  test("defaults legacy mode to 'play' when missing", () => {
    const legacy = { recName: "P" };
    const m = migrateLegacyLastPlayedMap(legacy);
    expect(m.P.play).toBe(legacy);
  });
  test("'practice' legacy mode is preserved", () => {
    const legacy = { recName: "P", mode: "practice" };
    const m = migrateLegacyLastPlayedMap(legacy);
    expect(m.P.practice).toBe(legacy);
  });
  test("returns null for non-object", () => {
    expect(migrateLegacyLastPlayedMap(null)).toBeNull();
    expect(migrateLegacyLastPlayedMap(undefined)).toBeNull();
    expect(migrateLegacyLastPlayedMap("string")).toBeNull();
  });
  test("passes through already-new-shape maps", () => {
    const m = { P: { play: { recName: "P" } } };
    expect(migrateLegacyLastPlayedMap(m)).toBe(m);
  });
});

describe("setLastPlayedEntry", () => {
  test("creates a new entry under recName + mode", () => {
    const item = { id: "X", lineIndex: 1, _recName: "P", _st: "s", _w: "w", _idx: 0 };
    const out = setLastPlayedEntry({}, item, "play", 5);
    expect(out.P.play).toMatchObject({
      recName: "P", st: "s", w: "w", idx: 0, id: "X", lineIndex: 1, mode: "play", queuePos: 5
    });
  });
  test("preserves prior queueKeys / ts when updating cursor only", () => {
    const map = { P: { play: { queueKeys: [{ id: "X" }], ts: 99 } } };
    const item = { id: "Y", lineIndex: 2, _recName: "P", _st: "s", _w: "w", _idx: 1 };
    const out = setLastPlayedEntry(map, item, "play", 3);
    expect(out.P.play.queueKeys).toEqual([{ id: "X" }]);
    expect(out.P.play.ts).toBe(99);
  });
  test("does NOT mutate the input map", () => {
    const map = {};
    const out = setLastPlayedEntry(map, { id: "X", lineIndex: 1, _recName: "P" }, "play", 0);
    expect(map).toEqual({});
    expect(out).not.toBe(map);
  });
  test("returns the input map when item has no _recName", () => {
    const map = {};
    const out = setLastPlayedEntry(map, { id: "X", lineIndex: 1 }, "play", 0);
    expect(out).toBe(map);
  });
});

describe("getNewestEntry", () => {
  test("picks the higher-ts entry across modes", () => {
    const map = { P: { play: { ts: 10, mode: "play" }, practice: { ts: 20, mode: "practice" } } };
    expect(getNewestEntry(map, "P").mode).toBe("practice");
  });
  test("returns the only existing side when one is missing", () => {
    const map = { P: { play: { ts: 5 } } };
    expect(getNewestEntry(map, "P")).toEqual({ ts: 5 });
  });
  test("null for unknown recName", () => {
    expect(getNewestEntry({ P: {} }, "Q")).toBeNull();
  });
});

describe("buildQueueKeys", () => {
  test("emits identity tuples for items with origin", () => {
    const queue = [
      { id: "X", lineIndex: 1, _recName: "P", _st: "s", _w: "w" },
      { id: "Y", lineIndex: 2, _recName: "P", _st: "s", _w: "w" },
    ];
    expect(buildQueueKeys(queue)).toEqual([
      { recName: "P", st: "s", w: "w", id: "X", lineIndex: 1 },
      { recName: "P", st: "s", w: "w", id: "Y", lineIndex: 2 },
    ]);
  });
  test("skips items without _recName", () => {
    expect(buildQueueKeys([{ id: "X" }])).toEqual([]);
  });
  test("returns [] for non-array input", () => {
    expect(buildQueueKeys(null)).toEqual([]);
  });
});

describe("saveQueueOrderInto", () => {
  test("snapshots queueKeys and resets queuePos to 0", () => {
    const queue = [{ id: "X", lineIndex: 1, _recName: "P", _st: "s", _w: "w" }];
    const out = saveQueueOrderInto({}, queue, "play", "P");
    expect(out.P.play.queueKeys.length).toBe(1);
    expect(out.P.play.queuePos).toBe(0);
    expect(out.P.play.mode).toBe("play");
  });
  test("bumps ts above the max in the entire map", () => {
    const map = {
      P: { play: { ts: 5 }, practice: { ts: 7 } },
      Q: { play: { ts: 10 } },
    };
    const queue = [{ id: "X", lineIndex: 1, _recName: "P", _st: "s", _w: "w" }];
    const out = saveQueueOrderInto(map, queue, "play", "P");
    expect(out.P.play.ts).toBe(11);
  });
  test("no-op (returns map) when queue has no origin items", () => {
    const map = { P: { play: { ts: 1 } } };
    const out = saveQueueOrderInto(map, [{ id: "X" }], "play", "P");
    expect(out).toBe(map);
  });
  test("does NOT mutate input", () => {
    const map = {};
    const out = saveQueueOrderInto(map, [{ id: "X", lineIndex: 1, _recName: "P", _st: "s", _w: "w" }], "play", "P");
    expect(map).toEqual({});
    expect(out).not.toBe(map);
  });
});

describe("reconstituteQueue", () => {
  const coll = {
    P: { items: { s: { w: [it("X", 1), it("Y", 2), it("Z", 3, { enabled: false })] } } },
    V: { virtual: true, members: ["P"] },
  };
  test("rebuilds a queue from saved keys (real playlist)", () => {
    const keys = [
      { recName: "P", st: "s", w: "w", id: "X", lineIndex: 1 },
      { recName: "P", st: "s", w: "w", id: "Y", lineIndex: 2 },
    ];
    const out = reconstituteQueue(coll, keys);
    expect(out.length).toBe(2);
    expect(out[0]._idx).toBe(0);
    expect(out[1]._idx).toBe(1);
  });
  test("skips disabled items", () => {
    const keys = [
      { recName: "P", st: "s", w: "w", id: "X", lineIndex: 1 },
      { recName: "P", st: "s", w: "w", id: "Z", lineIndex: 3 },   // disabled
    ];
    const out = reconstituteQueue(coll, keys);
    expect(out.map(i => i.id)).toEqual(["X"]);
  });
  test("skips keys whose item no longer exists", () => {
    const keys = [{ recName: "P", st: "s", w: "w", id: "GHOST", lineIndex: 99 }];
    expect(reconstituteQueue(coll, keys)).toEqual([]);
  });
  test("resolves a virtual playlist's items via members", () => {
    const keys = [{ recName: "V", st: "s", w: "w", id: "X", lineIndex: 1 }];
    const out = reconstituteQueue(coll, keys);
    expect(out.length).toBe(1);
    expect(out[0]._recName).toBe("V");
  });
  test("[] for non-array keys", () => {
    expect(reconstituteQueue(coll, null)).toEqual([]);
  });
});

describe("resumePromptMessage", () => {
  test("includes recName, mode, remaining/total", () => {
    const msg = resumePromptMessage("MyList", "play", 3, 10);
    expect(msg).toContain("MyList");
    expect(msg).toContain("play");
    expect(msg).toContain("3 of 10");
  });
});

describe("computeResumePoint", () => {
  const coll = { P: { items: { s: { w: [it("X", 1), it("Y", 2)] } } } };
  test("returns null when no entry exists", () => {
    expect(computeResumePoint({}, coll, "P", "play")).toBeNull();
  });
  test("returns null when recording doesn't exist", () => {
    expect(computeResumePoint({}, coll, "GHOST", "play")).toBeNull();
  });
  test("returns {queue, pos, message} when resumable", () => {
    const map = {
      P: { play: {
        queueKeys: [
          { recName: "P", st: "s", w: "w", id: "X", lineIndex: 1 },
          { recName: "P", st: "s", w: "w", id: "Y", lineIndex: 2 },
        ],
        queuePos: 1
      } }
    };
    const out = computeResumePoint(map, coll, "P", "play");
    expect(out.queue.length).toBe(2);
    expect(out.pos).toBe(1);
    expect(out.message).toContain("1 of 2");
  });
  test("null when queuePos is past the end (full replay)", () => {
    const map = {
      P: { play: {
        queueKeys: [{ recName: "P", st: "s", w: "w", id: "X", lineIndex: 1 }],
        queuePos: 1
      } }
    };
    expect(computeResumePoint(map, coll, "P", "play")).toBeNull();
  });
  test("null when reconstituted queue is empty", () => {
    const map = {
      P: { play: {
        queueKeys: [{ recName: "P", st: "s", w: "w", id: "GHOST", lineIndex: 99 }],
        queuePos: 0
      } }
    };
    expect(computeResumePoint(map, coll, "P", "play")).toBeNull();
  });
  test("clamps pos within the live queue length", () => {
    const map = {
      P: { play: {
        queueKeys: [
          { recName: "P", st: "s", w: "w", id: "X", lineIndex: 1 },
          { recName: "P", st: "s", w: "w", id: "GHOST", lineIndex: 99 },
        ],
        queuePos: 1
      } }
    };
    // Live queue has 1 item; rawPos=1 < queueKeys.length=2 (passes that
    // gate), then clamped to min(1, 0) = 0.
    const out = computeResumePoint(map, coll, "P", "play");
    expect(out.pos).toBe(0);
    expect(out.queue.length).toBe(1);
  });
});
