// public/music-tags.js
// Pure model for "pattern tags". Two layers, kept separate so the tag list can be GLOBAL while the
// note assignments stay per-piece:
//   • registry    — the global, shared list of tags: [{ name, color }] (persisted device-wide)
//   • assignments — which notes in THIS piece carry which tag: [{ name, notes:[{measure,midi,beats}] }]
//                   (persisted with the piece, as detail.patterns)
// Colors live only in the registry, so a tag looks the same in every piece. No DOM, no rendering.

// Distinct, reasonably-separable hues. Tags cycle through these in creation order.
export const TAG_PALETTE = [
  '#e6194B', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
  '#1d9e8a', '#f032e6', '#9A6324', '#808000', '#000075',
];

export function tagColor(i) { return TAG_PALETTE[((i % TAG_PALETTE.length) + TAG_PALETTE.length) % TAG_PALETTE.length]; }

// Stable key for a note identity (mirrors suppressionKey so the two features key notes identically).
export function noteId({ measure, midi, beats }) { return `${measure}:${midi}:${Number(beats).toFixed(6)}`; }

// ── Registry (global tag list) ────────────────────────────────────────────────────────────────

// Add a tag (next palette color) unless the name already exists or is blank. Returns { registry, added }.
export function addTag(registry, name) {
  const list = registry || [];
  const clean = (name || '').trim();
  if (!clean || list.some((t) => t.name === clean)) return { registry: list, added: false };
  return { registry: [...list, { name: clean, color: tagColor(list.length) }], added: true };
}

// Drop a tag by name. Returns a NEW registry.
export function removeTag(registry, name) { return (registry || []).filter((t) => t.name !== name); }

// Rename a tag in the registry, KEEPING its colour — a rename is the same motif under a new name, and
// having it change colour everywhere would read as a different motif. Refuses a blank name, an unknown
// `from`, and a `to` that is already taken: merging two tags is a different operation (whose notes win?),
// and silently doing it here would lose one tag's assignments in every piece. { registry, renamed }.
export function renameTag(registry, from, to) {
  const list = registry || [];
  const clean = (to || '').trim();
  if (!clean || clean === from) return { registry: list, renamed: false };
  if (!list.some((t) => t.name === from)) return { registry: list, renamed: false };
  if (list.some((t) => t.name === clean)) return { registry: list, renamed: false };
  return { registry: list.map((t) => (t.name === from ? { ...t, name: clean } : t)), renamed: true };
}

// Move one piece's note assignments onto a new tag name. Colours live in the registry, so this only
// carries the notes across. Refuses when `to` already holds notes here — same merge problem as above.
// Returns a NEW assignments array (the input unchanged when the rename is refused).
export function renameInAssignments(assignments, from, to) {
  const list = assignments || [];
  const clean = (to || '').trim();
  if (!clean || clean === from) return list;
  if (list.some((a) => a.name === clean)) return list;
  return list.map((a) => (a.name === from ? { ...a, name: clean } : a));
}

// name → color lookup.
export function colorMap(registry) {
  const m = {};
  (registry || []).forEach((t) => { m[t.name] = t.color; });
  return m;
}

// Ensure every tag name used in `patterns` exists in the registry (so a piece's tags always show in
// the global list). Preserves existing registry colors; honours a legacy color carried on a pattern,
// else assigns the next palette color. Returns a NEW registry.
export function mergeRegistry(registry, patterns) {
  const out = (registry || []).map((t) => ({ ...t }));
  const has = new Set(out.map((t) => t.name));
  (patterns || []).forEach((p) => {
    if (!p || !p.name || has.has(p.name)) return;
    out.push({ name: p.name, color: p.color || tagColor(out.length) });
    has.add(p.name);
  });
  return out;
}

// ── Assignments (per-piece note → tag) ──────────────────────────────────────────────────────────

export function indexAssignments(assignments) {
  return (assignments || []).map((a) => ({ name: a.name, keys: new Set((a.notes || []).map(noteId)) }));
}

// The NAME of the first assignment (by order) that contains `key` and whose name is in `allowed`
// (a Set), or null. `allowed` null → any tag qualifies. When a filter reveals only some tags, a
// note shared by several tags must light for a REVEALED tag even if an earlier (hidden) tag also
// claims it — so callers pass the revealed set here rather than relying on firstTagForKey.
export function revealedTagForKey(indexed, key, allowed) {
  const hits = [];
  for (const a of indexed) if ((!allowed || allowed.has(a.name)) && a.keys.has(key)) hits.push(a);
  if (!hits.length) return null;
  if (hits.length === 1) return hits[0].name;
  // A motif that contains another one WHOLE owns the notes they share. Painting the shorter one there
  // hides the longer figure the note is really part of — you would see "1,2,3" and never learn the
  // note belongs to "1,2,3,2,1". Order still decides when neither motif contains the other.
  const bigger = hits.find((a) => hits.every((b) => b === a || isSuperset(a.keys, b.keys)));
  return (bigger || hits[0]).name;
}

function isSuperset(a, b) {
  if (a.size < b.size) return false;
  for (const k of b) if (!a.has(k)) return false;
  return true;
}

// The NAME of the first assignment (by order) whose set contains `key`, or null. First tag wins.
export function firstTagForKey(indexed, key) { return revealedTagForKey(indexed, key, null); }

// Add/remove a note in the named tag's assignment, creating the assignment entry if absent.
// Returns a NEW assignments array.
export function toggleNote(assignments, name, id) {
  const key = noteId(id);
  const list = assignments || [];
  const note = { measure: id.measure, midi: id.midi, beats: id.beats };
  if (!list.some((a) => a.name === name)) return [...list, { name, notes: [note] }];
  return list.map((a) => {
    if (a.name !== name) return a;
    const has = (a.notes || []).some((n) => noteId(n) === key);
    const notes = has ? a.notes.filter((n) => noteId(n) !== key) : [...(a.notes || []), note];
    return { ...a, notes };
  });
}

// The per-note render decision. `colorOf(name)` resolves the registry color; `selectedNames` is the
// Set of tags the filter shows.
//   filter off → tagged notes get their color, nothing dims (base "color by tag" behavior)
//   filter on  → a note in a SELECTED tag keeps its color; every other note is dimmed.
export function noteStyle(indexed, key, filterOn, selectedNames, colorOf) {
  if (!filterOn) {
    const name = firstTagForKey(indexed, key);
    return { color: name && colorOf ? colorOf(name) : null, dim: false };
  }
  // A note in ANY selected tag lights (colored by that revealed tag), even if a non-selected tag
  // also claims it. Everything else dims.
  const name = revealedTagForKey(indexed, key, selectedNames || new Set());
  if (name) return { color: colorOf ? colorOf(name) : null, dim: false };
  return { color: null, dim: true };
}
