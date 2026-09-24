// The stretch of video a practice card plays.
//
// A card shows the matched subtitle line plus however many lines the ↑+ / ↓+
// buttons have added either side, and playback runs over that same window —
// with one caveat that decides most of this file.
//
// The SRTs here are SPARSE. A video's subtitle file is stitched together from
// captures of distant moments, with absolute timestamps, so two lines that sit
// next to each other in the file can be hours apart in the video. Widening a
// clip by line count alone therefore produces a clip that runs from the word
// to somewhere far past it, playing minutes of unrelated video. So the window
// is contracted to the contiguous run around the matched line: context is
// taken while the neighbour is temporally adjacent, and the walk stops at the
// first real gap.
//
// One line of run-off past the end, which the clip has always had, and which
// is subject to the same rule: subtitle end times clip speech short, so the
// next line's end is a natural place to stop — when it is actually next.
//
// The start only comes from the subtitles when lines were added before the
// matched one. Otherwise the captured start wins: it is the authoritative
// start of the line the card was made from, and it survives the SRT being
// re-segmented underneath it.
//
// Pure: takes parsed subtitle lines and returns seconds. No DOM, no player.

import { contiguousClipWindow } from './random-playlist.js';

const num = (v, fallback) => {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
};

export const CLIP_MIN_SECONDS = 4;

// A gap larger than this between neighbouring lines means they are separate
// captures, not continuous speech. Matches the player's default.
export const CLIP_GAP_THRESHOLD = 2.5;

export function clipRange(lines, pos, before, after, fallback, opts = {}) {
  const src = Array.isArray(lines) ? lines : [];
  const fb = fallback || {};
  const fbStart = num(fb.start, 0);
  let start = fbStart;
  let stop = num(fb.stop, fbStart + CLIP_MIN_SECONDS);
  const p = num(pos, -1);
  if (Number.isInteger(p) && p >= 0 && p < src.length) {
    const b = Math.max(0, num(before, 0));
    const a = Math.max(0, num(after, 0));
    const cues = src.map((l) => ({
      ts: l && l.start ? l.start.ordinal : null,
      te: l && l.end ? l.end.ordinal : null,
    }));
    const win = contiguousClipWindow(cues, p, {
      loBound: p - b,
      // One past the last line shown, for the run-off.
      hiBound: p + a + 1,
      gapThreshold: opts.gapThreshold == null ? CLIP_GAP_THRESHOLD : opts.gapThreshold,
      // A card's context is asked for deliberately, so it is not trimmed for
      // length the way an auto-built clip is.
      maxDuration: opts.maxDuration == null ? Infinity : opts.maxDuration,
    });
    // Zero times mean the anchor had no usable timing — leave the stored
    // bounds alone rather than replacing them with nothing.
    if (win.timeEnd > win.timeStart) {
      if (b > 0) start = win.timeStart;
      stop = win.timeEnd;
    }
  }
  // A range that does not move forward would stop the clip before it started.
  if (!(stop > start)) stop = start + CLIP_MIN_SECONDS;
  return { start, stop };
}

// The lines a practice card may show: the contiguous run around the matched
// line, capped by how much context was asked for.
//
// A card only shows what its clip can play. Showing a line from the far side
// of a seam would put text on the card that the video never reaches, which is
// what made playback look like it was ignoring the ↑+ / ↓+ buttons — so the
// context stops at the seam instead, and the card and the clip cover the same
// ground.
export function contiguousLineWindow(lines, pos, before, after, opts = {}) {
  const src = Array.isArray(lines) ? lines : [];
  const p = num(pos, -1);
  if (!(Number.isInteger(p) && p >= 0 && p < src.length)) return { from: 0, to: -1 };
  const b = Math.max(0, num(before, 0));
  const a = Math.max(0, num(after, 0));
  const cues = src.map((l) => ({
    ts: l && l.start ? l.start.ordinal : null,
    te: l && l.end ? l.end.ordinal : null,
  }));
  const win = contiguousClipWindow(cues, p, {
    loBound: p - b,
    hiBound: p + a,
    gapThreshold: opts.gapThreshold == null ? CLIP_GAP_THRESHOLD : opts.gapThreshold,
    maxDuration: Infinity,
  });
  return {
    from: Math.max(0, Math.min(p, win.fromPos)),
    to: Math.min(src.length - 1, Math.max(p, win.toPos)),
  };
}

// Seconds of video between each line and the one before it, where that is more
// than the threshold; 0 otherwise. Used to mark the breaks, so a context line
// the clip stops short of does not read as playback ignoring it.
//
// What this can and cannot tell you: the merge that builds these files writes a
// plain SRT — start, end, text — and keeps no record of which capture a line
// came from. So a stitched file is indistinguishable from a naturally sparse
// one, and the only evidence of a seam is the time between two lines. A long
// silence inside a single capture looks exactly the same.
//
// Which is why the marker says only what the timestamps actually prove: that
// there is a stretch of video here with no subtitle on it, and how long it is.
// Whether that is a seam between captures or a pause in the speech, the clip
// stops either way — so the marker is right about the thing it is there for.
export function gapSecondsBefore(lines, opts = {}) {
  const src = Array.isArray(lines) ? lines : [];
  const threshold = opts.gapThreshold == null ? CLIP_GAP_THRESHOLD : opts.gapThreshold;
  return src.map((l, i) => {
    if (i === 0) return 0;
    const prevEnd = num(src[i - 1] && src[i - 1].end && src[i - 1].end.ordinal, null);
    const thisStart = num(l && l.start && l.start.ordinal, null);
    if (prevEnd == null || thisStart == null) return 0;
    const gap = thisStart - prevEnd;
    return gap > threshold ? gap : 0;
  });
}

// "12s" / "4m 10s" — the length of a break, for the marker's tooltip.
export function formatGap(seconds) {
  const s = Math.round(num(seconds, 0));
  if (s <= 0) return '';
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? m + 'm ' + rest + 's' : m + 'm';
}
