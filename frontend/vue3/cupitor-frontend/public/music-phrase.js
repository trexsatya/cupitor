// public/music-phrase.js
// Pure model for "phrases". A phrase is a named, per-piece composite with its own color:
//   • tags  — a LOGICAL GROUP of member tags, referenced by name, resolved LIVE (editing a member
//             tag updates every phrase that includes it).
//   • notes — extra hand-picked notes (0+), added by painting on the sheet.
// A phrase resolves to the onset-ordered union of its tags' notes + its extra notes, which every
// phrase action (highlight together, play together, find, fretboard capture) consumes. Persisted
// with the piece as detail.phrases: [{ name, color, tags:[tagName], notes:[{measure,midi,beats}] }].
// No DOM.
import { noteId } from './music-tags.js';

// Distinct hues, deliberately different from TAG_PALETTE so a phrase's highlight reads as its own
// thing. Phrases cycle through these in creation order.
export const PHRASE_PALETTE = [
  '#0d6efd', '#d63384', '#fd7e14', '#20c997', '#6f42c1',
  '#dc3545', '#198754', '#0dcaf0', '#ffc107', '#6610f2',
];

export function phraseColor(i) { return PHRASE_PALETTE[((i % PHRASE_PALETTE.length) + PHRASE_PALETTE.length) % PHRASE_PALETTE.length]; }

export function phraseByName(phrases, name) { return (phrases || []).find((p) => p.name === name) || null; }

// Add a phrase (next palette color unless one is given) unless the name is blank or already taken.
// Returns { phrases, added }.
export function addPhrase(phrases, name, color = null) {
  const list = phrases || [];
  const clean = (name || '').trim();
  if (!clean || list.some((p) => p.name === clean)) return { phrases: list, added: false };
  return { phrases: [...list, { name: clean, color: color || phraseColor(list.length), tags: [], notes: [] }], added: true };
}

// Drop a phrase by name. Returns a NEW phrases array.
export function removePhrase(phrases, name) { return (phrases || []).filter((p) => p.name !== name); }

// Add (on=true) or remove (on=false) a member tag on the named phrase. No duplicates. NEW array.
export function setPhraseTag(phrases, name, tagName, on) {
  return (phrases || []).map((p) => {
    if (p.name !== name) return p;
    const has = (p.tags || []).includes(tagName);
    if (on && !has) return { ...p, tags: [...(p.tags || []), tagName] };
    if (!on && has) return { ...p, tags: (p.tags || []).filter((t) => t !== tagName) };
    return p;
  });
}

// Drop a tag name from EVERY phrase's membership (called when a global tag is deleted). NEW array.
export function removeTagFromPhrases(phrases, tagName) {
  return (phrases || []).map((p) => ((p.tags || []).includes(tagName) ? { ...p, tags: p.tags.filter((t) => t !== tagName) } : p));
}

// Toggle an extra (hand-picked) note on the named phrase (mirrors music-tags toggleNote). NEW array.
export function togglePhraseNote(phrases, name, id) {
  const key = noteId(id);
  const note = { measure: id.measure, midi: id.midi, beats: id.beats };
  return (phrases || []).map((p) => {
    if (p.name !== name) return p;
    const has = (p.notes || []).some((n) => noteId(n) === key);
    const notes = has ? p.notes.filter((n) => noteId(n) !== key) : [...(p.notes || []), note];
    return { ...p, notes };
  });
}

// Resolve a phrase to its onset-ordered note-id list: the union of its member tags' notes (looked
// up LIVE in `assignments`) and its extra notes, de-duped by identity, sorted by onset (beats, then
// measure, then midi for stability). Returns [{measure,midi,beats}]. Unknown member tags contribute
// nothing.
export function resolvePhraseNoteIds(phrase, assignments) {
  if (!phrase) return [];
  const byTag = {};
  (assignments || []).forEach((a) => { byTag[a.name] = a.notes || []; });
  const seen = new Set();
  const out = [];
  const add = (n) => {
    if (!n || n.midi == null) return;
    const k = noteId(n);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ measure: n.measure, midi: n.midi, beats: n.beats });
  };
  (phrase.tags || []).forEach((t) => (byTag[t] || []).forEach(add));
  (phrase.notes || []).forEach(add);
  return out.sort((x, y) =>
    (x.beats - y.beats) || ((x.measure || 0) - (y.measure || 0)) || ((x.midi || 0) - (y.midi || 0)));
}
