// public/music-rhythm-group.js
// Pure model for "rhythm groups": a named, per-piece RHYTHM FIGURE CONFINED TO CHOSEN BARS. Two
// passages can be notated in the same meter and still feel completely different — 6/8 running in even
// eighths vs 6/8 swinging in two dotted quarters — and no scan can make that judgement, so a group is
// where you record it by ear: you pick the bars, and the figure those bars run.
// A group behaves exactly like a picked rhythm pattern (highlight its occurrences, solo it on the
// transport) except that it is LIMITED TO ITS OWN BARS — see groupPatterns.
// Persisted with the piece as detail.rhythmGroups:
//   [{ name, color, ranges: [[fromMeasure, toMeasure], …], pattern, unit, proportional }]
// `pattern` is a music-rhythm.js pattern id (null = whichever figure those bars use most). A pattern id
// only means anything under the scan settings that produced it (`bar:…` vs `cell:…`, proportional or
// not), so the group KEEPS those settings — otherwise flipping the panel's Group-by would silently
// re-bind the group to a different figure. Ranges hold SEQUENTIAL measure numbers; printed numbers are
// a display concern (the caller maps). No DOM.
import { findRhythmPatterns } from './music-rhythm.js';

// Warm/earthy hues, deliberately apart from TAG_PALETTE, PHRASE_PALETTE and the rhythm-pattern
// greens, so a group's bars never read as a motif or as a scanned figure.
export const GROUP_PALETTE = [
  '#e8590c', '#1098ad', '#ae3ec9', '#2f9e44',
  '#c2255c', '#5f3dc4', '#f08c00', '#0b7285',
];

export function groupColor(i) { return GROUP_PALETTE[((i % GROUP_PALETTE.length) + GROUP_PALETTE.length) % GROUP_PALETTE.length]; }

export function groupByName(groups, name) { return (groups || []).find((g) => g.name === name) || null; }

// Sort, clamp to whole numbers, and MERGE ranges that overlap or merely touch (2–3 + 4–5 → 2–5), so
// capturing bar after bar grows one tidy range instead of a pile of adjacent ones. Junk is dropped.
export function normalizeRanges(ranges) {
  const clean = (ranges || [])
    .map((r) => (Array.isArray(r) ? [Math.round(Number(r[0])), Math.round(Number(r[1] == null ? r[0] : r[1]))] : null))
    .filter((r) => r && Number.isFinite(r[0]) && Number.isFinite(r[1]))
    .map((r) => (r[0] <= r[1] ? r : [r[1], r[0]]))
    .filter((r) => r[0] >= 0)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = [];
  for (const r of clean) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

// Read a bar list a human typed: "2-3, 11–12 15" → [[2,3],[11,12],[15,15]]. Commas, spaces and any
// dash all separate/join; anything unparseable is ignored rather than throwing.
export function parseRanges(text) {
  const s = String(text == null ? '' : text);
  const out = [];
  const re = /(\d+)\s*(?:[-–—]\s*(\d+))?/g;
  let m;
  while ((m = re.exec(s)) !== null) out.push([Number(m[1]), m[2] == null ? Number(m[1]) : Number(m[2])]);
  return normalizeRanges(out);
}

// "2–3, 11–12, 15". `map` converts each number for display (e.g. sequential → printed).
export function formatRanges(ranges, map = (n) => n) {
  return normalizeRanges(ranges)
    .map(([a, b]) => (a === b ? `${map(a)}` : `${map(a)}–${map(b)}`))
    .join(', ');
}

// Every measure number the ranges cover, ascending.
export function rangeMeasures(ranges) {
  const out = [];
  normalizeRanges(ranges).forEach(([a, b]) => { for (let m = a; m <= b; m++) out.push(m); });
  return out;
}

export function inRanges(ranges, measure) {
  return (ranges || []).some((r) => Array.isArray(r) && measure >= r[0] && measure <= r[1]);
}

export function measureCount(ranges) { return rangeMeasures(ranges).length; }

// Union of two range lists (merged/normalized).
export function addRanges(ranges, more) { return normalizeRanges([...(ranges || []), ...(more || [])]); }

// Drop one measure, splitting a range if it falls inside.
export function removeMeasure(ranges, measure) {
  const out = [];
  normalizeRanges(ranges).forEach(([a, b]) => {
    if (measure < a || measure > b) { out.push([a, b]); return; }
    if (measure > a) out.push([a, measure - 1]);
    if (measure < b) out.push([measure + 1, b]);
  });
  return out;   // already ordered and gapped — normalize would re-merge across the hole
}

// Add a group (next palette color unless one is given) unless the name is blank or already taken.
// Returns { groups, added }.
export function addGroup(groups, name, ranges = [], color = null, pattern = null, opts = {}) {
  const list = groups || [];
  const clean = (name || '').trim();
  if (!clean || list.some((g) => g.name === clean)) return { groups: list, added: false };
  const g = { name: clean, color: color || groupColor(list.length), ranges: normalizeRanges(ranges), pattern: pattern || null };
  if (pattern) Object.assign(g, bindOpts(opts));
  return { groups: [...list, g], added: true };
}

// The scan settings a pattern id was resolved under, kept on the group with the id itself.
function bindOpts(opts = {}) {
  return { unit: opts.unit || 'bar', proportional: !!opts.proportional };
}

// The settings to read a group's figure under: its own (once one is bound), else the caller's current
// ones. This is what makes an association hold when the panel's Group-by / proportional change.
export function groupOpts(group, fallback = {}) {
  if (group && group.pattern) return bindOpts({ unit: group.unit, proportional: group.proportional });
  return { unit: fallback.unit || 'bar', proportional: !!fallback.proportional };
}

export function removeGroup(groups, name) { return (groups || []).filter((g) => g.name !== name); }

// Replace a group's bars. NEW array; unknown name is a no-op.
export function setGroupRanges(groups, name, ranges) {
  return (groups || []).map((g) => (g.name === name ? { ...g, ranges: normalizeRanges(ranges) } : g));
}

// Add bars to a group (union). NEW array; unknown name is a no-op.
export function addGroupRanges(groups, name, ranges) {
  return (groups || []).map((g) => (g.name === name ? { ...g, ranges: addRanges(g.ranges, ranges) } : g));
}

// Bind the group to one specific figure of its bars — the id together with the settings it was read
// under. `null` releases it back to "whichever figure those bars use most".
export function setGroupPattern(groups, name, pattern, opts = {}) {
  return (groups || []).map((g) => {
    if (g.name !== name) return g;
    if (!pattern) { const { unit, proportional, ...rest } = g; return { ...rest, pattern: null }; }
    return { ...g, pattern, ...bindOpts(opts) };
  });
}

// The rhythm figures the group's bars run, most used first — the same scan as the whole-sheet picker
// (music-rhythm.js findRhythmPatterns) but fed ONLY the notes in `ranges`, which is what makes a group
// "the selected rhythm, limited to these measures". Occurrence indices are mapped back to the FULL
// stream, so the caller can highlight those noteheads and solo them against the whole piece.
// `stream` is a rhythm stream; `opts` is forwarded (unit: bar|cell, proportional).
export function groupPatterns(stream, ranges, opts = {}) {
  const idx = [];
  (stream || []).forEach((n, i) => { if (inRanges(ranges, n.measure)) idx.push(i); });
  const sub = idx.map((i) => stream[i]);
  return findRhythmPatterns(sub, opts).map((p) => ({
    ...p,
    occurrences: (p.occurrences || []).map((o) => ({ ...o, noteIdx: (o.noteIdx || []).map((k) => idx[k]) })),
  }));
}

// The group's own figure: the pattern it is BOUND to (read under the settings it was bound with), else
// whichever figure its bars use most. Null when the bars hold no figure at all (not drawn, too few
// notes). A bound id that its bars no longer run also falls back — editing the bars can't strand it.
export function resolveGroupPattern(stream, group, opts = {}) {
  if (!group) return null;
  const pats = groupPatterns(stream, group.ranges, groupOpts(group, opts));
  if (!pats.length) return null;
  return (group.pattern && pats.find((p) => p.id === group.pattern)) || pats[0];
}

// Two shades of a group's colour, so neighbouring occurrences stay apart on the sheet (what the
// whole-sheet rhythm highlight does with its two greens). `#rrggbb` in, [dark, light] out.
export function groupShades(color) {
  const hex = /^#([0-9a-f]{6})$/i.exec(String(color || ''));
  if (!hex) return [color || '#888', color || '#888'];
  const n = parseInt(hex[1], 16);
  const mix = [16, 8, 0].map((sh) => {
    const c = (n >> sh) & 255;
    return Math.round(c + (255 - c) * 0.55);   // 55% toward white — visibly lighter, still the same hue
  });
  return [color, `#${mix.map((c) => c.toString(16).padStart(2, '0')).join('')}`];
}
