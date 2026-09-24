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

export function gestureAxis(dx, dy, canScrollX, slop) {
  const s = Number(slop) > 0 ? Number(slop) : GESTURE_SLOP;
  const ax = Math.abs(Number(dx) || 0);
  const ay = Math.abs(Number(dy) || 0);
  // Not moved far enough to say. The caller keeps asking.
  if (Math.max(ax, ay) < s) return null;
  if (!canScrollX) return 'y';
  return ay > ax ? 'y' : 'x';
}
