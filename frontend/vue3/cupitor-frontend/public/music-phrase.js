// public/music-phrase.js
// Pure model for "phrases". A phrase is a named, per-piece set of hand-picked notes with its own
// color — the notes are chosen directly (painted on the sheet), NOT composed from tags. A phrase
// resolves to an onset-ordered note-id list, which every phrase action (play, fretboard capture,
// pattern search, highlight) consumes. Persisted with the piece as detail.phrases:
//   [{ name, color, notes:[{measure,midi,beats}] }]. No DOM.
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
  return { phrases: [...list, { name: clean, color: color || phraseColor(list.length), notes: [] }], added: true };
}

// Drop a phrase by name. Returns a NEW phrases array.
export function removePhrase(phrases, name) { return (phrases || []).filter((p) => p.name !== name); }

// Toggle a note on the named phrase (mirrors music-tags toggleNote). NEW array.
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

// Resolve a phrase to its onset-ordered note-id list: its notes, de-duped by identity, sorted by
// onset (beats, then measure, then midi for stability). Returns [{measure,midi,beats}].
export function resolvePhraseNoteIds(phrase) {
  if (!phrase) return [];
  const seen = new Set();
  const out = [];
  (phrase.notes || []).forEach((n) => {
    if (!n || n.midi == null) return;
    const k = noteId(n);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ measure: n.measure, midi: n.midi, beats: n.beats });
  });
  return out.sort((x, y) =>
    (x.beats - y.beats) || ((x.measure || 0) - (y.measure || 0)) || ((x.midi || 0) - (y.midi || 0)));
}
