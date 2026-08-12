// public/music-phrase.js
// Pure model for "phrases". A phrase is a named STRETCH OF BARS, with its own colour, and a correction
// to what is in it: { name, color, from, to, drop, add } — printed measure numbers, and two note lists.
//
//   the phrase = every note in [from, to]  −  drop  +  add
//
// The bars are the phrase's shape and are what a range means everywhere else (shading, inPhrase, the
// compare boxes). `drop` and `add` are the exceptions to it: a note inside the bars that isn't really
// part of the phrase, and a note outside them that is — a pickup in the bar before, a resolution that
// spills into the bar after. Musical phrases do not respect barlines, so a model that can only say
// "these bars" cannot say what a lot of phrases actually are.
//
// Both lists hold note identities {measure, midi, beats} — the same identity motifs use, so a note
// means one thing across the app. They are kept mutually exclusive: no note is both added and dropped.
//
// A phrase saved before this stored its hand-painted notes under `notes`; that field is read as `add`
// so nothing saved is lost. Older still: a phrase was a group of member tags with no range at all, and
// `phraseRange` reports the span of the notes it was painted with, so those keep working too.
//
// Persisted with the piece as detail.phrases. No DOM.
import { noteId } from './music-tags.js';

// Distinct hues, deliberately different from TAG_PALETTE so a phrase's highlight reads as its own
// thing. Phrases cycle through these in creation order.
export const PHRASE_PALETTE = [
  '#0d6efd', '#d63384', '#fd7e14', '#20c997', '#6f42c1',
  '#dc3545', '#198754', '#0dcaf0', '#ffc107', '#6610f2',
];

export function phraseColor(i) { return PHRASE_PALETTE[((i % PHRASE_PALETTE.length) + PHRASE_PALETTE.length) % PHRASE_PALETTE.length]; }

// A bar number, or NaN when there isn't one. Not `Number(x)`: Number(null) and Number('') are both 0,
// so an omitted range would quietly become "bars 0 to 0" — a phrase covering a measure that cannot exist.
function numOrNaN(x) {
  if (x == null || (typeof x === 'string' && x.trim() === '')) return NaN;
  return Number(x);
}

export function phraseByName(phrases, name) { return (phrases || []).find((p) => p.name === name) || null; }

// Add a phrase over [from,to] (next palette color unless one is given) unless the name is blank or
// already taken. Returns { phrases, added }.
export function addPhrase(phrases, name, color = null, from = null, to = null) {
  const list = phrases || [];
  const clean = (name || '').trim();
  if (!clean || list.some((p) => p.name === clean)) return { phrases: list, added: false };
  const [a, b] = [from, to].map(numOrNaN);
  const range = Number.isFinite(a) && Number.isFinite(b)
    ? { from: Math.min(a, b), to: Math.max(a, b) } : { from: null, to: null };
  return { phrases: [...list, { name: clean, color: color || phraseColor(list.length), ...range, tags: [], add: [], drop: [] }], added: true };
}

// The notes brought IN from outside the bars. `notes` is where a phrase saved before `add` existed
// kept them, so it reads as the same thing.
export function addedNotes(phrase) {
  const a = phrase && (phrase.add || phrase.notes);
  return Array.isArray(a) ? a : [];
}
// The notes inside the bars that are NOT part of the phrase.
export function droppedNotes(phrase) {
  return Array.isArray(phrase && phrase.drop) ? phrase.drop : [];
}

// The bars a phrase covers, as [from, to] — or null when it covers nothing yet. A phrase saved under
// the oldest model has no from/to, so its span is read off the notes it was painted with: those phrases
// keep working, and are only rewritten when you edit their range.
//
// This is the phrase's SHAPE, not its contents: added notes deliberately do not widen it. A pickup
// added from the bar before is part of the phrase without making that bar part of it — otherwise
// adding one note would move every band, alignment and comparison the range drives.
export function phraseRange(phrase) {
  if (!phrase) return null;
  const [a, b] = [phrase.from, phrase.to].map(numOrNaN);
  if (Number.isFinite(a) && Number.isFinite(b)) return [Math.min(a, b), Math.max(a, b)];
  const ms = addedNotes(phrase).map((n) => n.measure).filter((m) => m != null);
  return ms.length ? [Math.min(...ms), Math.max(...ms)] : null;
}

// What the phrase is actually made of: `inBars` (the caller's "notes drawn in [from,to]" — only the
// renderer knows what is on the sheet) minus the dropped notes, plus the added ones. De-duped by
// identity and ordered by onset, the shape every caller expects.
export function phraseNotes(phrase, inBars) {
  if (!phrase) return [];
  const dropped = new Set(droppedNotes(phrase).map(noteId));
  const seen = new Set();
  const out = [];
  const push = (n) => {
    if (!n || n.midi == null) return;
    const k = noteId(n);
    if (dropped.has(k) || seen.has(k)) return;
    seen.add(k);
    out.push({ measure: n.measure, midi: n.midi, beats: n.beats });
  };
  (inBars || []).forEach(push);
  addedNotes(phrase).forEach(push);
  return out.sort((x, y) =>
    (x.beats - y.beats) || ((x.measure || 0) - (y.measure || 0)) || ((x.midi || 0) - (y.midi || 0)));
}

// Move a phrase's bars. A blank value on either side leaves the phrase covering nothing rather than
// guessing — an empty range is visible in the panel and fixable; a guessed one is neither.
export function setPhraseRange(phrases, name, from, to) {
  const [a, b] = [from, to].map(numOrNaN);
  const ok = Number.isFinite(a) && Number.isFinite(b);
  return (phrases || []).map((p) => (p.name === name
    ? { ...p, from: ok ? Math.min(a, b) : null, to: ok ? Math.max(a, b) : null }
    : p));
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

// Follow a renamed tag through every phrase's membership. A phrase saved under the old model still lists
// its member tags by name, so a rename that skipped this would leave the phrase pointing at a tag that
// no longer exists — resolvePhraseNoteIds silently contributes nothing for an unknown member, so the
// phrase would just quietly lose those notes. De-duplicates in case both names were listed. NEW array.
export function renameTagInPhrases(phrases, from, to) {
  const clean = (to || '').trim();
  if (!clean || clean === from) return phrases || [];
  return (phrases || []).map((p) => {
    if (!(p.tags || []).includes(from)) return p;
    return { ...p, tags: [...new Set(p.tags.map((t) => (t === from ? clean : t)))] };
  });
}

// One gesture for both corrections: clicking a note says "this is wrong". WHICH way it is wrong is
// already known from where the note is — inside the bars it must be a note to take out, outside them a
// note to bring in — so the user picks notes and never a mode. Clicking an already-corrected note undoes
// it, which is why the exception lists are cleared first: that also keeps a note from being in both.
//
// A phrase with no range of its own is judged against the span of what it has been painted with (see
// phraseRange), so the first click on one is always an addition and later clicks inside that span take
// notes back out — which is the same rule, read off the only bars such a phrase has.
export function togglePhraseNote(phrases, name, id) {
  const key = noteId(id);
  const note = { measure: id.measure, midi: id.midi, beats: id.beats };
  return (phrases || []).map((p) => {
    if (p.name !== name) return p;
    const add = addedNotes(p).filter((n) => noteId(n) !== key);
    const drop = droppedNotes(p).filter((n) => noteId(n) !== key);
    const corrected = addedNotes(p).length !== add.length || droppedNotes(p).length !== drop.length;
    const clean = { ...p, add, drop };
    delete clean.notes;   // converge on the current shape; addedNotes has already read it
    if (corrected) return clean;   // it was an exception; clicking again puts it back to the default
    const r = phraseRange(p);
    const inBars = !!r && id.measure != null && id.measure >= r[0] && id.measure <= r[1];
    return inBars ? { ...clean, drop: [...drop, note] } : { ...clean, add: [...add, note] };
  });
}

