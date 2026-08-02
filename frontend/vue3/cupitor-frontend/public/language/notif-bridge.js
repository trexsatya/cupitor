// Pure building blocks for the NotifBridge feature (scheduled study
// notifications for a Recorded Search playlist). Kept free of `window` / DOM so
// they can be unit-tested directly; language.js owns the live bridge RPC, the
// dialog, and the warm-pushed state.
//
// See docs contract: 2026-07-27-notif-bridge-webapp-contract.md. The bridge
// addresses every list by our own `external_key` and every item by our own
// `external_id`; internal row ids never cross the bridge.

import { isManualItem } from "./recordings-merge.js";

// A stable, name-independent key for a playlist's notification list. Stored on
// the recording object (rec.notifKey) so it survives a playlist rename — the
// notifications keep firing with full SRS progress because the contract has no
// setName op and the fired notifications show item title/body, not the list
// name. `rand` is injectable for deterministic tests.
export function makeNotifKey(rand = Math.random) {
  const a = Math.floor(rand() * 1e12).toString(36);
  const b = Math.floor(rand() * 1e12).toString(36);
  return `reclist-${a}${b}`;
}

// Build the notification items[] for a playlist's items map. Rules:
//   - manual cards  → one item per card, titled by its SOURCE text
//                     (body = target when a source is present).
//   - other groups  → one item per (searchText, word) group, titled by the
//                     phrase/searchText (body = the surface word when it
//                     differs).
// Items with an empty title are dropped (the contract requires a non-empty
// title), and the result is de-duplicated by external_id. Item order becomes
// the notification `position`.
export const NOTIF_TITLE_MAX = 50;
export const NOTIF_BODY_MAX = 240;

// Trim to `max` chars, adding a trailing ellipsis (kept within the limit) when
// the value overflows.
function cap(s, max) {
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

export function buildNotifItems(items) {
  const out = [];
  const seen = new Set();
  const clean = (v) => (v == null ? "" : String(v)).trim();
  const push = (external_id, title, body) => {
    const t = cap(clean(title), NOTIF_TITLE_MAX);
    if (!external_id || !t || seen.has(external_id)) return;
    seen.add(external_id);
    const item = { external_id, title: t };
    const b = cap(clean(body), NOTIF_BODY_MAX);
    if (b && b !== t) item.body = b;
    out.push(item);
  };
  const map = items || {};
  Object.keys(map).forEach((st) => {
    const byW = map[st] || {};
    Object.keys(byW).forEach((w) => {
      const arr = byW[w] || [];
      let hasNonManual = false;
      arr.forEach((it) => {
        if (!it || it.enabled === false) return; // disabled items don't notify
        if (isManualItem(it)) {
          const src = clean(it.source);
          // Titled by source; fall back to target so a target-only card still
          // produces a valid (non-empty) item.
          push(`card:${it.id || `${st}|${w}`}`, src || clean(it.target), src ? it.target : "");
        } else {
          hasNonManual = true;
        }
      });
      // One item for the whole (st,w) group — many clips of the same word
      // collapse to a single study item.
      if (hasNonManual) push(`w:${st}|${w}`, st, w && w !== st ? w : "");
    });
  });
  return out;
}

// Locate a playlist item from a notification's external_id (the reverse of
// buildNotifItems). Re-derives each candidate id the SAME way so it's immune to
// a searchText that contains the '|' separator. Returns { st, w, idx, manual }
// (idx = the manual card's array position; null for a collapsed word group), or
// null if nothing matches.
export function locateNotifItem(items, externalId) {
  const map = items || {};
  if (!externalId) return null;
  const keys = Object.keys(map);
  for (const st of keys) {
    const byW = map[st] || {};
    for (const w of Object.keys(byW)) {
      const arr = byW[w] || [];
      for (let i = 0; i < arr.length; i++) {
        const it = arr[i];
        if (it && isManualItem(it) && `card:${it.id || `${st}|${w}`}` === externalId) {
          return { st, w, idx: i, manual: true };
        }
      }
      if (arr.some((it) => it && !isManualItem(it)) && `w:${st}|${w}` === externalId) {
        return { st, w, idx: null, manual: false };
      }
    }
  }
  return null;
}

// The webpage-owned lists out of a `cupitorNotifLists` payload — i.e. the ones
// we can address by external_key. Lists created in the app's own UI have
// source:'app' / external_key:null and are excluded.
export function webpageNotifLists(listsPayload) {
  const lists = listsPayload && Array.isArray(listsPayload.lists) ? listsPayload.lists : [];
  return lists.filter((l) => l && l.source === "webpage" && l.external_key);
}
