import { makeNotifKey, buildNotifItems, webpageNotifLists, locateNotifItem } from "./notif-bridge";

// A word (non-manual) item as stored in items[st][w].
const word = (over = {}) => ({ searchText: "gå an", word: "går", id: "vid1", lineIndex: 3, ...over });
// A manual card.
const card = (over = {}) => ({ manual: true, id: "m1", source: "hej", target: "hello", ...over });

describe("makeNotifKey", () => {
  test("is stable-format and unique per call with the injected rng", () => {
    const seq = [0.1, 0.2, 0.3, 0.4];
    let i = 0;
    const rng = () => seq[i++];
    const k1 = makeNotifKey(rng);
    const k2 = makeNotifKey(rng);
    expect(k1).toMatch(/^reclist-/);
    expect(k2).toMatch(/^reclist-/);
    expect(k1).not.toBe(k2);
  });
});

describe("buildNotifItems", () => {
  test("non-manual group → one item titled by the phrase, body = surface word", () => {
    const P = "gå an";
    const W = "går";
    const items = { [P]: { [W]: [word(), word({ lineIndex: 9, id: "vid2" })] } };
    const out = buildNotifItems(items);
    expect(out).toEqual([{ external_id: `w:${P}|${W}`, title: P, body: W }]);
  });

  test("word equal to phrase → no body", () => {
    const items = { katt: { katt: [word({ searchText: "katt", word: "katt" })] } };
    expect(buildNotifItems(items)).toEqual([{ external_id: "w:katt|katt", title: "katt" }]);
  });

  test("manual card → titled by source, body = target, one item per card", () => {
    const items = { Manual: { Card: [card(), card({ id: "m2", source: "tack", target: "thanks" })] } };
    expect(buildNotifItems(items)).toEqual([
      { external_id: "card:m1", title: "hej", body: "hello" },
      { external_id: "card:m2", title: "tack", body: "thanks" },
    ]);
  });

  test("target-only manual card falls back to target as title (no body dup)", () => {
    const items = { Manual: { Card: [card({ source: "", target: "hello" })] } };
    expect(buildNotifItems(items)).toEqual([{ external_id: "card:m1", title: "hello" }]);
  });

  test("empty-title items are dropped", () => {
    const items = { Manual: { Card: [card({ source: "", target: "" })] } };
    expect(buildNotifItems(items)).toEqual([]);
  });

  test("de-duplicates by external_id", () => {
    const items = { Manual: { Card: [card(), card()] } }; // same id twice
    expect(buildNotifItems(items)).toEqual([{ external_id: "card:m1", title: "hej", body: "hello" }]);
  });

  test("mixed bucket → manual cards and one grouped word item", () => {
    const items = { foo: { bar: [card({ id: "mx", source: "src", target: "tgt" }), word({ searchText: "foo", word: "bar" })] } };
    const out = buildNotifItems(items);
    expect(out).toContainEqual({ external_id: "card:mx", title: "src", body: "tgt" });
    expect(out).toContainEqual({ external_id: "w:foo|bar", title: "foo", body: "bar" });
    expect(out).toHaveLength(2);
  });

  test("empty / missing map → []", () => {
    expect(buildNotifItems(null)).toEqual([]);
    expect(buildNotifItems({})).toEqual([]);
  });

  test("disabled items are excluded", () => {
    // Disabled manual card → dropped.
    expect(buildNotifItems({ Manual: { Card: [card({ enabled: false })] } })).toEqual([]);
    // Word group with only disabled clips → no group item.
    expect(buildNotifItems({ foo: { bar: [word({ searchText: "foo", word: "bar", enabled: false })] } })).toEqual([]);
    // Group with one enabled clip → still produces the item.
    const mixed = { foo: { bar: [word({ searchText: "foo", word: "bar", enabled: false }), word({ searchText: "foo", word: "bar" })] } };
    expect(buildNotifItems(mixed)).toEqual([{ external_id: "w:foo|bar", title: "foo", body: "bar" }]);
  });

  test("title capped at 50 and body at 240, with ellipsis", () => {
    const longSrc = "a".repeat(80);
    const longTgt = "b".repeat(300);
    const [item] = buildNotifItems({ Manual: { Card: [card({ source: longSrc, target: longTgt })] } });
    expect(item.title.length).toBe(50);
    expect(item.title.endsWith("…")).toBe(true);
    expect(item.body.length).toBe(240);
    expect(item.body.endsWith("…")).toBe(true);
  });
});

describe("locateNotifItem", () => {
  test("finds a manual card by id → its array index", () => {
    const items = { Manual: { Card: [card(), card({ id: "m2", source: "tack" })] } };
    expect(locateNotifItem(items, "card:m2")).toEqual({ st: "Manual", w: "Card", idx: 1, manual: true });
  });

  test("finds a word group (idx null) for the exact external_id it produced", () => {
    const items = { "gå an": { går: [word()] } };
    const xid = buildNotifItems(items)[0].external_id;
    expect(locateNotifItem(items, xid)).toEqual({ st: "gå an", w: "går", idx: null, manual: false });
  });

  test("robust to a '|' inside the searchText (round-trips its own id)", () => {
    const items = { "a|b": { c: [word({ searchText: "a|b", word: "c" })] } };
    const xid = buildNotifItems(items)[0].external_id; // "w:a|b|c"
    expect(locateNotifItem(items, xid)).toEqual({ st: "a|b", w: "c", idx: null, manual: false });
  });

  test("no match → null", () => {
    expect(locateNotifItem({ Manual: { Card: [card()] } }, "card:nope")).toBeNull();
    expect(locateNotifItem(null, "card:x")).toBeNull();
    expect(locateNotifItem({}, "")).toBeNull();
  });
});

describe("webpageNotifLists", () => {
  test("keeps only source:'webpage' lists with an external_key", () => {
    const payload = {
      version: 1,
      lists: [
        { external_key: "reclist-a", source: "webpage", name: "A" },
        { external_key: null, source: "app", name: "In-app" },
        { external_key: "reclist-b", source: "webpage", name: "B" },
        null,
      ],
    };
    expect(webpageNotifLists(payload).map((l) => l.external_key)).toEqual(["reclist-a", "reclist-b"]);
  });

  test("bad payload → []", () => {
    expect(webpageNotifLists(null)).toEqual([]);
    expect(webpageNotifLists({})).toEqual([]);
  });
});

describe('buildUnreadNotifQueue', () => {
  const { buildUnreadNotifQueue } = require('./notif-bridge')
  const recordings = {
    A: { notifKey: 'a', items: { Manual: { Card: [card(), card({ id: 'm2' }), card({ id: 'off', enabled: false })] } } },
    B: { notifKey: 'b', items: { 'gå an': { går: [word(), word({ id: 'disabled', enabled: false }),
      card({ id: 'unrelated' }), word({ id: 'vid2' })] } } }
  }
  const event = (key, xid, fired_at, responded_at = null) =>
    ({ external_key: key, item_external_id: xid, fired_at, responded_at })
  test('clicked item first even after native acknowledgement, unread across lists, duplicate fires collapse', () => {
    const before = JSON.stringify(recordings)
    const feed = [event('a', 'card:m1', 1), event('b', 'w:gå an|går', 3),
      event('b', 'w:gå an|går', 2), event('a', 'card:m2', 4, 5), event(null, 'app-only', 6)]
    const queue = buildUnreadNotifQueue({ recordings, feed, clicked: event('a', 'card:m2', 4, 5) })
    expect(queue.map(i => i.id)).toEqual(['m2', 'vid1', 'vid2', 'm1'])
    expect(queue.map(i => i._recName)).toEqual(['A', 'B', 'B', 'A'])
    expect(queue.every(i => i._temporary)).toBe(true)
    expect(queue[1]).toMatchObject({ _st: 'gå an', _w: 'går', _idx: 0, _notifKey: 'b', _notifItemId: 'w:gå an|går' })
    queue[0].source = 'edited copy'
    expect(JSON.stringify(recordings)).toBe(before)
    expect(feed[0].responded_at).toBeNull()
  })
  test('disabled, removed and unmapped items never broaden the queue to a whole playlist', () => {
    const feed = [event('a', 'card:off', 5), event('a', 'card:removed', 6), event('gone', 'card:m1', 7)]
    expect(buildUnreadNotifQueue({ recordings, feed })).toEqual([])
    expect(buildUnreadNotifQueue({ recordings, feed, clicked: event('a', 'card:missing', 9) })).toEqual([])
  })
  test('cold URL payload resolves clicked item and virtual resolver is honored', () => {
    const queue = buildUnreadNotifQueue({ recordings, clicked: { payload: { pl: 'A' }, item_external_id: 'card:m2' },
      resolveItems: name => recordings[name].items })
    expect(queue.map(i => i.id)).toEqual(['m2'])
    expect(buildUnreadNotifQueue({})).toEqual([])
  })
  test('same external id in distinct playlists is not collapsed', () => {
    const copies = { ...recordings, C: { notifKey: 'c', items: recordings.A.items } }
    const queue = buildUnreadNotifQueue({ recordings: copies, feed: [event('a', 'card:m1', 1), event('c', 'card:m1', 2)] })
    expect(queue.map(i => i._recName)).toEqual(['C', 'A'])
  })
  test('large unread snapshot is not truncated', () => {
    const items = Array.from({ length: 275 }, (_, n) => card({ id: 'n' + n }))
    const recordings = { Many: { notifKey: 'many', items: { Manual: { Card: items } } } }
    const queue = buildUnreadNotifQueue({ recordings, feed: items.map((i, n) => event('many', 'card:' + i.id, n)) })
    expect(queue).toHaveLength(275)
    expect(queue[0].id).toBe('n274')
  })
})
