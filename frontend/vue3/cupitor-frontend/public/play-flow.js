// public/play-flow.js
// Direction for the 'flow' animation: a dot travelling along a connector
// from its source to the end the arrow points at.

// `kind` is 'arrow' (head at p2), 'bi' (heads at both ends) or 'line'
// (no head; direction comes from the source object's centre).
// Returns [start, end] or null when the connector has no single direction.
export function flowEnds(kind, p1, p2, sourceCenter) {
  if (kind === 'arrow') return [p1, p2];
  if (kind === 'line' && sourceCenter) {
    return dist2(p1, sourceCenter) <= dist2(p2, sourceCenter) ? [p1, p2] : [p2, p1];
  }
  return null;
}

export function pointAlong(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function dist2(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}
