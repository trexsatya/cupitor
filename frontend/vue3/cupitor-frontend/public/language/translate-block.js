// Translating a block of rows as ONE request, and getting the rows back out.
//
// A card's rows are a conversation, not a list: "MARILYN: I think," means
// nothing on its own, and a translator handed it alone answers a fragment. So
// the whole block goes in one request and keeps its context.
//
// The problem is getting it back. A translator owes us a translation, not a
// shape: it may keep the line breaks, re-segment two sentences into one, or
// return the lot as a single line. The card can't use any of that unless each
// row lands back on the row it came from, because the two faces are read side
// by side (and, for a captured card, paired with video timings by position).
//
// Two ways to recover it, tried in order by the caller:
//   1. the answer already has exactly the rows it was given  — plainRows
//   2. the rows were numbered going in, so the numbers find them — parseNumbered
// and if neither holds, the caller falls back to one request per row, which is
// always recoverable and always context-free.
//
// Pure: no DOM, no bridge. The caller owns the requests.

// Rows as a numbered block. The numbers are what survives re-segmentation —
// they are still in the text even when every line break is gone.
export function numberRows(rows) {
  return (rows || []).map((r, i) => `${i + 1}. ${r == null ? '' : r}`).join('\n');
}

// The answer split on line breaks, but only when it has exactly the rows it was
// given. Anything else is unusable: with the count changed there is no way to
// know which row a merged line belongs to.
export function plainRows(answer, count) {
  if (typeof answer !== 'string') return null;
  const rows = answer.replace(/\r\n?/g, '\n').split('\n');
  return rows.length === count ? rows : null;
}

// Where marker `n` starts in `text` at or after `from`, or -1.
//
// A marker is the number, then a `.` or `)`, and it has to open a row rather
// than sit inside one — so it is either at the very start or after whitespace.
// Without that, the "15" in "in 15. century" would be read as row fifteen.
function markerAt(text, n, from) {
  const needle = String(n);
  let i = from;
  for (;;) {
    i = text.indexOf(needle, i);
    if (i < 0) return -1;
    const before = i === 0 ? '' : text[i - 1];
    const after = text.slice(i + needle.length);
    // `.` or `)` may be followed by anything; a row can be empty.
    if ((i === 0 || /\s/.test(before)) && /^[.)]/.test(after)) return i;
    i += needle.length;
  }
}

// Pull `count` rows out of a numbered answer, wherever its line breaks ended
// up. Returns null unless every marker from 1 to count is present in order —
// a partial match is a guess about which rows moved, and a card whose faces
// stop lining up is worse than one translated a row at a time.
export function parseNumbered(answer, count) {
  if (typeof answer !== 'string') return null;
  if (!Number.isInteger(count) || count < 1) return null;
  const text = answer.replace(/\r\n?/g, '\n');
  const starts = [];
  let from = 0;
  for (let n = 1; n <= count; n++) {
    const at = markerAt(text, n, from);
    if (at < 0) return null;
    starts.push(at);
    from = at + String(n).length + 1;
  }
  return starts.map((at, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : text.length;
    // Drop the marker itself, then the whitespace the translator put after it.
    const body = text.slice(at + String(i + 1).length + 1, end);
    return body.replace(/^[ \t]+/, '').replace(/\s+$/, '');
  });
}
