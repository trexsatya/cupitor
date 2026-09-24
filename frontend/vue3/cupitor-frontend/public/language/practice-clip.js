// The stretch of video a practice card plays.
//
// A card shows the matched subtitle line plus however many lines the ↑+ / ↓+
// buttons have added either side. Playback runs over that same window, so a
// line that can be read can also be heard.
//
// One line of run-off past the end, which the clip has always had: subtitle
// end times clip speech short, and the next line's end is a natural place to
// stop.
//
// The start only comes from the subtitles when lines were added before the
// matched one. Otherwise the captured start wins: it is the authoritative
// start of the line the card was made from, and it survives the SRT being
// re-segmented underneath it.
//
// Pure: takes parsed subtitle lines and returns seconds. No DOM, no player.

const startOf = (l) => (l && l.start && typeof l.start.ordinal === 'number') ? l.start.ordinal : null;
const endOf = (l) => (l && l.end && typeof l.end.ordinal === 'number') ? l.end.ordinal : null;

const num = (v, fallback) => {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
};

export const CLIP_MIN_SECONDS = 4;

export function clipRange(lines, pos, before, after, fallback) {
  const src = Array.isArray(lines) ? lines : [];
  const fb = fallback || {};
  let start = num(fb.start, 0);
  let stop = num(fb.stop, start + CLIP_MIN_SECONDS);
  const p = num(pos, -1);
  if (Number.isInteger(p) && p >= 0 && p < src.length) {
    const b = Math.max(0, num(before, 0));
    const a = Math.max(0, num(after, 0));
    if (b > 0) {
      const s = startOf(src[Math.max(0, p - b)]);
      if (s != null) start = s;
    }
    const last = Math.min(src.length - 1, p + a);
    const runOff = endOf(src[Math.min(src.length - 1, last + 1)]);
    const e = runOff != null ? runOff : endOf(src[last]);
    if (e != null) stop = e;
  }
  // A range that does not move forward would stop the clip before it started.
  if (!(stop > start)) stop = start + CLIP_MIN_SECONDS;
  return { start, stop };
}
