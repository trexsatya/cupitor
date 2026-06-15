import {
  withTimeout,
  nfc,
  runInBatches,
  fetchWithRetry,
  commitWithMerge,
} from "./net";

// Tiny stand-in for setTimeout that fires the callback immediately so
// tests don't have to wait real time. Returns a fake handle.
function immediateTimeout(fn) { fn(); return 1; }

describe("nfc", () => {
  test("NFC-normalises a decomposed string", () => {
    // "å" can be encoded as either precomposed (U+00E5) or decomposed
    // ("a" U+0061 + ◌̊ U+030A). Both should round-trip to the same NFC form.
    const decomposed = "å";
    expect(nfc(decomposed)).toBe("å");
  });
  test("leaves NFC-already strings alone", () => {
    expect(nfc("å")).toBe("å");
    expect(nfc("hello")).toBe("hello");
  });
  test("coerces null/undefined to empty string", () => {
    expect(nfc(null)).toBe("");
    expect(nfc(undefined)).toBe("");
  });
});

describe("withTimeout", () => {
  test("resolves with the promise's value when it settles first", async () => {
    const out = await withTimeout(Promise.resolve(42), 10000, "x");
    expect(out).toBe(42);
  });
  test("rejects with a labelled timeout when promise hangs", async () => {
    const hang = new Promise(() => {});
    // immediateTimeout fires synchronously → timeout wins.
    await expect(withTimeout(hang, 1, "myop", immediateTimeout))
      .rejects.toThrow(/timeout: myop/);
  });
  test("propagates the original rejection if it loses the race", async () => {
    // Timeout never fires (we never call the callback).
    const noopTimeout = () => 1;
    await expect(withTimeout(Promise.reject(new Error("boom")), 999, "x", noopTimeout))
      .rejects.toThrow("boom");
  });
});

describe("runInBatches", () => {
  test("invokes fn for each item with bounded concurrency", async () => {
    const items = [1, 2, 3, 4, 5];
    const fn = jest.fn(async (n) => n * 2);
    const out = await runInBatches(items, fn, 2);
    expect(fn).toHaveBeenCalledTimes(5);
    expect(out.map(r => r.value)).toEqual([2, 4, 6, 8, 10]);
    expect(out.every(r => r.status === "fulfilled")).toBe(true);
  });
  test("captures failures as {status:'rejected'} per item", async () => {
    const fn = (n) => n === 2 ? Promise.reject(new Error("nope")) : Promise.resolve(n);
    const out = await runInBatches([1, 2, 3], fn, 2);
    expect(out[0]).toEqual({ status: "fulfilled", value: 1 });
    expect(out[1].status).toBe("rejected");
    expect(out[1].reason.message).toBe("nope");
    expect(out[2]).toEqual({ status: "fulfilled", value: 3 });
  });
  test("calls onProgress after each item", async () => {
    const progress = jest.fn();
    await runInBatches([1, 2, 3], async (x) => x, 1, progress);
    expect(progress).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
  });
  test("returns [] for empty / non-array input", async () => {
    expect(await runInBatches([], async (x) => x, 2)).toEqual([]);
    expect(await runInBatches(null, async (x) => x, 2)).toEqual([]);
  });
  test("respects concurrency cap (no more than `concurrency` in flight)", async () => {
    let inFlight = 0, peak = 0;
    const fn = async () => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--;
    };
    await runInBatches([1, 2, 3, 4, 5, 6, 7, 8], fn, 3);
    expect(peak).toBeLessThanOrEqual(3);
  });
});

describe("fetchWithRetry", () => {
  const okResp = (body = "ok") => ({ ok: true, status: 200, text: async () => body });

  test("returns the first OK response", async () => {
    const fetchFn = jest.fn().mockResolvedValueOnce(okResp());
    const out = await fetchWithRetry("https://x/y", {}, { fetch: fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(true);
  });
  test("retries on non-OK and eventually succeeds", async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(okResp());
    const sleep = jest.fn().mockResolvedValue(undefined);
    const out = await fetchWithRetry("https://x/y", { tries: 3 }, {
      fetch: fetchFn, sleep, now: () => 1000, random: () => 0,
    });
    expect(out.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
  test("appends a cache-buster on retry attempts", async () => {
    const calls = [];
    const fetchFn = jest.fn().mockImplementation((url) => {
      calls.push(url);
      if (calls.length < 3) return Promise.resolve({ ok: false, status: 502 });
      return Promise.resolve(okResp());
    });
    await fetchWithRetry("https://example.com/data", { tries: 3 }, {
      fetch: fetchFn, sleep: jest.fn().mockResolvedValue(undefined),
      now: () => 1000, random: () => 0,
    });
    expect(calls[0]).toBe("https://example.com/data");
    expect(calls[1]).toContain("_cb=1000-1");
    expect(calls[2]).toContain("_cb=1000-2");
  });
  test("preserves an existing query string when adding cache-buster", async () => {
    const calls = [];
    const fetchFn = jest.fn().mockImplementation((url) => {
      calls.push(url);
      if (calls.length < 2) return Promise.resolve({ ok: false, status: 502 });
      return Promise.resolve(okResp());
    });
    await fetchWithRetry("https://example.com/data?foo=bar", { tries: 2 }, {
      fetch: fetchFn, sleep: jest.fn().mockResolvedValue(undefined),
      now: () => 1000, random: () => 0,
    });
    expect(calls[1]).toBe("https://example.com/data?foo=bar&_cb=1000-1");
  });
  test("throws after exhausting tries", async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchWithRetry("https://x/y", { tries: 2 }, {
      fetch: fetchFn, sleep: jest.fn().mockResolvedValue(undefined),
      now: () => 0, random: () => 0,
    })).rejects.toThrow(/HTTP 500/);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
  test("throws when no fetch implementation is provided and global fetch is missing", async () => {
    const originalFetch = global.fetch;
    delete global.fetch;
    try {
      await expect(fetchWithRetry("https://x/y", {}, {})).rejects.toThrow(/no fetch implementation/);
    } finally {
      if (originalFetch) global.fetch = originalFetch;
    }
  });
  test("forces cache: 'no-store' on every attempt", async () => {
    const fetchFn = jest.fn().mockResolvedValue(okResp());
    await fetchWithRetry("https://x/y", {}, { fetch: fetchFn });
    expect(fetchFn.mock.calls[0][1].cache).toBe("no-store");
  });
});

describe("commitWithMerge", () => {
  function makeUtils({ initialContent = "BASE\n", initialSha = "sha0", failAttempts = 0 } = {}) {
    let attempts = 0;
    let stored = { content: initialContent, sha: initialSha };
    const getFile = jest.fn(async () => stored);
    const putFile = jest.fn(async (owner, repo, path, body, msg, sha) => {
      if (attempts < failAttempts) {
        attempts++;
        throw new Error("GitHub API error 409: stale sha");
      }
      stored = { content: body, sha: "sha" + (attempts + 1) };
      return stored;
    });
    return { getFile, putFile, getStored: () => stored, attemptsRef: () => attempts };
  }

  test("happy path: reads, merges, writes once", async () => {
    const utils = makeUtils();
    const merge = jest.fn(async (remote) => (remote || "") + "added\n");
    const out = await commitWithMerge({
      filePath: "db/file.txt", commitMessage: "msg", merge
    }, { githubUtils: utils, log: () => {} });
    expect(merge).toHaveBeenCalledWith("BASE\n");
    expect(out).toBe("BASE\nadded\n");
    expect(utils.putFile).toHaveBeenCalledTimes(1);
  });

  test("retries on 409 with re-merge", async () => {
    const utils = makeUtils({ failAttempts: 1 });
    const merge = jest.fn(async (remote) => (remote || "") + "x\n");
    const out = await commitWithMerge({
      filePath: "f", commitMessage: "m", merge, maxAttempts: 3
    }, { githubUtils: utils, log: () => {} });
    // Two getFile calls (initial + retry), two putFile attempts.
    expect(utils.getFile).toHaveBeenCalledTimes(2);
    expect(utils.putFile).toHaveBeenCalledTimes(2);
    expect(merge).toHaveBeenCalledTimes(2);
    expect(out).toBe("BASE\nx\n");
  });

  test("throws on non-409/422 errors immediately", async () => {
    const utils = {
      getFile: jest.fn(async () => ({ content: "", sha: "s" })),
      putFile: jest.fn(async () => { throw new Error("GitHub API error 401: unauthorized"); })
    };
    await expect(commitWithMerge({
      filePath: "f", commitMessage: "m", merge: async () => "x", maxAttempts: 3
    }, { githubUtils: utils, log: () => {} })).rejects.toThrow(/401/);
    expect(utils.putFile).toHaveBeenCalledTimes(1);
  });

  test("merge returning null throws a descriptive error", async () => {
    const utils = makeUtils();
    await expect(commitWithMerge({
      filePath: "f", commitMessage: "m", merge: async () => null
    }, { githubUtils: utils })).rejects.toThrow(/merge returned no content/);
  });

  test("file-not-found is silent — merge sees null remote", async () => {
    const utils = {
      getFile: jest.fn(async () => { throw new Error("404"); }),
      putFile: jest.fn(async () => ({ content: "new", sha: "s" }))
    };
    const merge = jest.fn(async (remote) => `${remote}|done`);
    const out = await commitWithMerge({
      filePath: "f", commitMessage: "m", merge
    }, { githubUtils: utils, log: () => {} });
    expect(merge).toHaveBeenCalledWith(null);
    expect(out).toBe("null|done");
  });

  test("exhausts retries and throws lastErr", async () => {
    const utils = {
      getFile: jest.fn(async () => ({ content: "", sha: "s" })),
      putFile: jest.fn(async () => { throw new Error("GitHub API error 409: conflict"); })
    };
    await expect(commitWithMerge({
      filePath: "f", commitMessage: "m", merge: async () => "x", maxAttempts: 2
    }, { githubUtils: utils, log: () => {} })).rejects.toThrow(/409/);
    expect(utils.putFile).toHaveBeenCalledTimes(2);
  });

  test("throws when no GitHubUtils is available", async () => {
    // Force the window.GitHubUtils fallback to be absent.
    const originalWindow = global.window;
    global.window = {};
    try {
      await expect(commitWithMerge({
        filePath: "f", commitMessage: "m", merge: async () => "x"
      })).rejects.toThrow(/no GitHubUtils available/);
    } finally {
      global.window = originalWindow;
    }
  });
});
