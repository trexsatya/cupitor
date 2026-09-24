// Which way a touch gesture is going, for a scroller that drives one axis
// itself and leaves the other to the browser.
//
// Undecided until the finger has moved far enough to tell: claiming an axis on
// the first pixel makes a sideways drag jump the list, and never claiming one
// leaves the list unable to move at all.
//
// Sideways is only ever claimed when there is somewhere sideways to go. A
// gesture handed to an axis that cannot move is a gesture that does nothing,
// and since the decision stands for the rest of the gesture, the list reads as
// having stopped working until the finger is lifted and put down again. A
// thumb starting a flick arcs, so the first few pixels are a poor guide to
// what was meant.
//
// Pure: no DOM. The caller says whether sideways is possible.

export const GESTURE_SLOP = 6;

// Whether an earlier "native scroll works here" answer can still be trusted.
//
// What breaks on the old WebView is a content-height limit, so the answer
// depends on how tall the list was when it was asked. A list measured before
// its row previews arrive is shorter than the list the user ends up with, and
// an answer kept for the life of the element goes quietly wrong the moment the
// content crosses the limit — the list stops scrolling and nothing asks again.
//
// Below FS_RECHECK_ABOVE no browser has trouble, so an answer given there
// cannot go stale and re-asking would only cost a visible frame.
export const FS_RECHECK_ABOVE = 8192;
export const FS_RECHECK_STEP = 512;

export function nativeScrollVerdictStale(height, okAt) {
  const h = Number(height);
  if (!isFinite(h) || h <= FS_RECHECK_ABOVE) return false;
  const was = Number(okAt);
  if (!isFinite(was)) return true;
  return Math.abs(h - was) > FS_RECHECK_STEP;
}

export function gestureAxis(dx, dy, canScrollX, slop) {
  const s = Number(slop) > 0 ? Number(slop) : GESTURE_SLOP;
  const ax = Math.abs(Number(dx) || 0);
  const ay = Math.abs(Number(dy) || 0);
  // Not moved far enough to say. The caller keeps asking.
  if (Math.max(ax, ay) < s) return null;
  if (!canScrollX) return 'y';
  return ay > ax ? 'y' : 'x';
}
