// Shadowing takes recorded over a card's clip in Practice.
//
// A take is a stretch the user spoke over. It is pinned to the video time it
// began at, and it is played back at that same time on the next pass — so the
// list is kept in video order and a take is identified by where it starts,
// not by when it was recorded.
//
// Takes are scratch: nothing here touches the card. The caller keeps them, or
// throws them away, on the user's word.
//
// Pure: no DOM, no player, no bridge. The caller owns the video and the mic.

// Two takes starting within this many seconds of each other are the same spot
// — the user recorded over it again rather than adding a second one beside it.
// The playhead is read from a poll, so the same intent never yields the same
// number twice.
export const TAKE_SAME_SPOT = 0.25;

function at(take) {
  const n = take && Number(take.t1);
  return isFinite(n) ? n : null;
}

// The take starting at `t1`, or null. Nearest wins when two are in reach, so
// the answer does not depend on the order the list happens to be in.
export function takeAt(takes, t1) {
  const want = Number(t1);
  if (!isFinite(want)) return null;
  let best = null;
  let bestGap = Infinity;
  for (const tk of takes || []) {
    const s = at(tk);
    if (s == null) continue;
    const gap = Math.abs(s - want);
    if (gap <= TAKE_SAME_SPOT && gap < bestGap) { best = tk; bestGap = gap; }
  }
  return best;
}

// Add a take, keeping the list in video order. One recorded over an existing
// spot replaces it — the caller is handed the old one back so it can drop the
// file that is no longer referenced.
export function addTake(takes, take) {
  const s = at(take);
  const list = (takes || []).slice();
  if (s == null) return { takes: list, replaced: null };
  const replaced = takeAt(list, s);
  const out = list.filter(t => t !== replaced);
  out.push(Object.assign({}, take, { t1: s }));
  out.sort((a, b) => Number(a.t1) - Number(b.t1));
  return { takes: out, replaced: replaced || null };
}

// Drop the take at `t1`, handing back the one removed so its file can go too.
export function removeTake(takes, t1) {
  const list = (takes || []).slice();
  const hit = takeAt(list, t1);
  if (!hit) return { takes: list, removed: null };
  return { takes: list.filter(t => t !== hit), removed: hit };
}

// Where the video rewinds to before replaying the take that starts at `t1`.
//
// The start of the take before it, or the start of the clip when there is
// none. Replaying only the stretch just spoken over is the point of the loop:
// rewinding to the clip start on every pass would make a long clip tedious,
// and rewinding to t1 itself would replay nothing at all.
export function rewindPointFor(takes, t1, clipStart) {
  const start = Number(clipStart);
  const base = isFinite(start) ? start : 0;
  const want = Number(t1);
  if (!isFinite(want)) return base;
  let best = base;
  for (const tk of takes || []) {
    const s = at(tk);
    // A take starting at the same spot is the one being replayed, not the one
    // before it — and one before the clip start belongs to another card.
    if (s == null || s >= want - TAKE_SAME_SPOT || s < base) continue;
    if (s > best) best = s;
  }
  return best;
}

// The most a playhead moves between two reads and still counts as playback.
// The poll runs several times a second, so an ordinary step is a fraction of
// this even at speed; anything larger is the playhead being put somewhere.
export const TAKE_MAX_STEP = 2;

// The take to play when the playhead moves from `prev` to `now`, or null.
//
// Crossing the mark is what fires a take, which is what makes them play every
// time rather than only in the pass that recorded them: rewinding, or playing
// the clip again, puts the marks back ahead of the playhead and they fire
// afresh. A jump in either direction is a seek rather than playback — landing
// past a take is the user going somewhere, not listening through it.
//
// The earliest mark in the window wins, so two takes close together keep
// their order instead of the later one swallowing the earlier.
export function takeDueBetween(takes, prev, now) {
  const from = Number(prev);
  const to = Number(now);
  if (!isFinite(from) || !isFinite(to)) return null;
  const step = to - from;
  if (step <= 0 || step > TAKE_MAX_STEP) return null;
  let best = null;
  for (const tk of takes || []) {
    const s = at(tk);
    if (s == null || s <= from || s > to) continue;
    if (!best || s < at(best)) best = tk;
  }
  return best;
}

// The take to play in the pass that follows a recording, where `awaiting` is
// the mark that pass was aimed at.
//
// That pass rewinds to the mark before the new take and plays forward, so it
// begins sitting on that earlier mark. A seek only settles to within a second
// or so, so the playhead can land short of the mark and then cross it — and
// the user hears a take they recorded minutes ago before the stretch they
// just spoke over. The pass is there to play back the take just made, so that
// is the only one it plays.
//
// Every other mark is still live: pass no `awaiting` — which is what an
// ordinary rewind or a second press of play does — and this is just
// takeDueBetween.
export function takeDueForPass(takes, prev, now, awaiting) {
  const due = takeDueBetween(takes, prev, now);
  if (!due) return null;
  // No pass running. Checked before the number, because a clip can start at
  // zero and Number(null) is zero too — reading "nothing to wait for" as
  // "waiting for the mark at zero" would silence a take at the very start.
  if (awaiting == null) return due;
  const want = Number(awaiting);
  if (!isFinite(want)) return due;
  // The mark the pass was waiting for is gone — discarded, or recorded over
  // from somewhere else. There is nothing left to hold the others back for.
  const target = takeAt(takes, want);
  if (!target) return due;
  return due === target ? due : null;
}

// Total seconds recorded across the takes, for the "3 takes · 12s" line.
export function takesDuration(takes) {
  return (takes || []).reduce((n, tk) => {
    const ms = tk && Number(tk.ms);
    return n + (isFinite(ms) && ms > 0 ? ms / 1000 : 0);
  }, 0);
}

// Where a take sits within the clip, so the list reads as "+4.2s" rather than
// as a raw video timestamp that means nothing on its own.
export function takeOffsetLabel(take, clipStart) {
  const s = at(take);
  const base = Number(clipStart);
  if (s == null || !isFinite(base)) return '';
  const d = Math.max(0, s - base);
  return '+' + (d < 10 ? d.toFixed(1) : String(Math.round(d))) + 's';
}
