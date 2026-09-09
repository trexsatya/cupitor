// public/music-embellish-xml.js
//
// Pure MusicXML builder for segment embellishment variations.
//  - extractSegmentXml(xmlString, [from, to]) — standalone MusicXML for a 1-based sequential
//    measure range, carrying the running <attributes> onto the first kept measure and renumbering
//    kept measures from 1 (mirrors the attribute carry-forward in music-split.js).
//  - applyVariation(segmentXml, voiceId, edits) — applies a variation's abstract edits to the
//    chosen voice's playable notes and returns a new MusicXML string.
//
// Note addressing: `index` / gap indices refer to positions in the chosen voice's playable note
// sequence in document order, skipping <rest> notes and <chord>-stacked notes.

import { midiToName } from './music-encoding.js';

// Natural pitch class of each note letter — lets writePitch derive the octave from the spelled
// letter (not the raw midi), so step/octave stay consistent across enharmonic boundaries (B#/Cb).
const STEP_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Color stamped on notes a variation ADDS (split decoration + anticipation insert), so the UI can
// highlight them. Tie continuations are NOT added notes (a hold), so they stay uncolored.
export const ADDED_NOTE_COLOR = '#EAB308';   // golden-yellow, legible on the white sheet

// ---------------------------------------------------------------------------
// Task 11 — extractSegmentXml
// ---------------------------------------------------------------------------

// Standalone MusicXML for the 1-based sequential measure range [from, to]. Carries the latest
// running <attributes> (divisions/key/time/clef) onto the first kept measure when it lacks its own,
// and renumbers kept measures starting at 1.
export function extractSegmentXml(xmlString, [from, to]) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  doc.querySelectorAll('part').forEach((part) => {
    let running = null;
    let seq = 0;
    let kept = 0;
    Array.from(part.querySelectorAll('measure')).forEach((m) => {
      seq += 1;
      const attr = m.querySelector('attributes');
      if (attr) running = attr;
      if (seq < from || seq > to) { m.remove(); return; }
      kept += 1;
      if (kept === 1 && !attr && running) m.insertBefore(running.cloneNode(true), m.firstChild);
      m.setAttribute('number', String(kept));
    });
  });
  return new XMLSerializer().serializeToString(doc);
}

// ---------------------------------------------------------------------------
// Voice / pitch / duration helpers
// ---------------------------------------------------------------------------

// Ordered playable <note> elements of the chosen voice, in document order. Skips <rest> notes and
// <chord>-stacked notes. Selects by matching a note's <voice> text to voiceId; if the document has
// no <voice> elements at all, every playable note is treated as the voice.
export function voiceNotes(doc, voiceId) {
  const all = Array.from(doc.querySelectorAll('note'));
  const hasVoices = all.some((n) => n.querySelector('voice'));
  return all.filter((n) => {
    if (n.querySelector('rest')) return false;
    if (n.querySelector('chord')) return false;
    if (hasVoices && voiceId != null) {
      const v = n.querySelector('voice');
      if (!v || v.textContent.trim() !== String(voiceId)) return false;
    }
    return true;
  });
}

// Note <type> for a given duration (in divisions) where a quarter = divisionsPerQuarter. Returns
// null when the duration does not map to a plain note value (e.g. a dotted/odd split).
function typeForDivs(divs, divisionsPerQuarter) {
  const quarters = divs / divisionsPerQuarter;
  const MAP = {
    4: 'whole', 2: 'half', 1: 'quarter', 0.5: 'eighth',
    0.25: '16th', 0.125: '32nd', 0.0625: '64th',
  };
  return Object.prototype.hasOwnProperty.call(MAP, quarters) ? MAP[quarters] : null;
}

// Overwrite <duration> and <type> together. <duration> keeps its MusicXML position (right after the
// pitch); <type> is created after <duration> if missing, or removed when the value is unmappable.
export function setDuration(noteEl, divs, divisionsPerQuarter) {
  const doc = noteEl.ownerDocument;
  let durEl = noteEl.querySelector('duration');
  if (!durEl) {
    durEl = doc.createElement('duration');
    const pitch = noteEl.querySelector('pitch, unpitched, rest');
    if (pitch && pitch.nextSibling) noteEl.insertBefore(durEl, pitch.nextSibling);
    else noteEl.appendChild(durEl);
  }
  durEl.textContent = String(divs);

  const type = typeForDivs(divs, divisionsPerQuarter);
  let typeEl = noteEl.querySelector('type');
  if (type) {
    if (!typeEl) {
      typeEl = doc.createElement('type');
      if (durEl.nextSibling) noteEl.insertBefore(typeEl, durEl.nextSibling);
      else noteEl.appendChild(typeEl);
    }
    typeEl.textContent = type;
  } else if (typeEl) {
    typeEl.remove();
  }
}

// Emit <pitch><step/>[<alter/>]<octave/></pitch> from a midi + optional spelled name. Letter and
// accidental come from the name (falling back to midiToName); octave = Math.floor(midi/12) − 1.
export function writePitch(noteEl, midi, name) {
  const doc = noteEl.ownerDocument;
  const spelled = name || midiToName(midi);
  const step = spelled[0];
  const acc = spelled.slice(1);
  const alter = acc === '#' ? 1 : acc === '##' ? 2 : acc === 'b' ? -1 : acc === 'bb' ? -2 : 0;
  // Octave of the spelled letter (from midi minus the accidental and the letter's natural pc), so
  // e.g. midi 60 spelled "B#" writes B#3 (sounds as C4), not an inconsistent B#4.
  const octave = Math.round((midi - alter - (STEP_PC[step] ?? 0)) / 12) - 1;

  noteEl.querySelectorAll('rest, pitch, unpitched').forEach((e) => e.remove());
  const pitch = doc.createElement('pitch');
  const stepEl = doc.createElement('step'); stepEl.textContent = step; pitch.appendChild(stepEl);
  if (alter) { const a = doc.createElement('alter'); a.textContent = String(alter); pitch.appendChild(a); }
  const oct = doc.createElement('octave'); oct.textContent = String(octave); pitch.appendChild(oct);

  const durEl = noteEl.querySelector('duration');
  if (durEl) noteEl.insertBefore(pitch, durEl);
  else noteEl.insertBefore(pitch, noteEl.firstChild);
}

// Strip markup that must not carry over onto a freshly derived note.
function clearStale(noteEl) {
  ['dot', 'beam', 'stem', 'notations', 'lyric', 'accidental', 'tie', 'time-modification']
    .forEach((tag) => noteEl.querySelectorAll(tag).forEach((e) => e.remove()));
}

// Fresh note derived from a template in the voice, overwriting pitch + duration + type.
function freshNote(template, midi, name, divs, divisionsPerQuarter) {
  const note = template.cloneNode(true);
  clearStale(note);
  writePitch(note, midi, name);
  setDuration(note, divs, divisionsPerQuarter);
  return note;
}

// Fresh note derived from a template but keeping its existing pitch spelling (used for tie
// continuations, where the held pitch must match the tied-from note exactly).
function cloneKeepPitch(template, divs, divisionsPerQuarter) {
  const note = template.cloneNode(true);
  clearStale(note);
  setDuration(note, divs, divisionsPerQuarter);
  return note;
}

// Add a <tie type=.../> (playback) and a <notations><tied type=.../></notations> (notation).
function addTie(noteEl, type) {
  const doc = noteEl.ownerDocument;
  const tie = doc.createElement('tie');
  tie.setAttribute('type', type);
  const durEl = noteEl.querySelector('duration');
  if (durEl && durEl.nextSibling) noteEl.insertBefore(tie, durEl.nextSibling);
  else if (durEl) noteEl.appendChild(tie);
  else noteEl.appendChild(tie);

  let notations = noteEl.querySelector('notations');
  if (!notations) { notations = doc.createElement('notations'); noteEl.appendChild(notations); }
  const tied = doc.createElement('tied');
  tied.setAttribute('type', type);
  notations.appendChild(tied);
}

// ---------------------------------------------------------------------------
// Task 12/13 — applyVariation
// ---------------------------------------------------------------------------

// Key used to order edits so later-applied edits never shift the indices of not-yet-applied ones.
function editPosition(edit) {
  if (edit.op === 'insert') return edit.gap ? edit.gap[0] : 0;
  return edit.index;
}

// --- per-op appliers (each recomputes voiceNotes against the current DOM) ---

function applySplit(doc, voiceId, edit, dpq) {
  const notes = voiceNotes(doc, voiceId);
  const orig = notes[edit.index];
  if (!orig) return;
  const dur = parseInt(orig.querySelector('duration').textContent, 10);
  // Hard guard (divisions-aware): a note shorter than 2 divisions cannot be halved into two
  // parts each >= 1 division. Skip the edit (leave the DOM unchanged) rather than emit a
  // <duration>0</duration> note. Covers before:true (appoggiatura) too.
  if (!Number.isFinite(dur) || dur < 2) return;
  const first = Math.ceil(dur / 2);
  const second = dur - first;

  if (edit.before) {
    // Appoggiatura: decoration takes the FIRST half, original tone the second.
    const deco = freshNote(orig, edit.insertMidi, edit.insertName, first, dpq);
    deco.setAttribute('color', ADDED_NOTE_COLOR); // added note — mark for highlighting
    orig.parentNode.insertBefore(deco, orig);
    setDuration(orig, second, dpq);
  } else {
    // Passing/neighbour/escape: original keeps the first half, decoration is the second half.
    const deco = freshNote(orig, edit.insertMidi, edit.insertName, second, dpq);
    deco.setAttribute('color', ADDED_NOTE_COLOR); // added note — mark for highlighting
    setDuration(orig, first, dpq);
    orig.parentNode.insertBefore(deco, orig.nextSibling);
  }
}

function applyInsert(doc, voiceId, edit, dpq) {
  const notes = voiceNotes(doc, voiceId);
  const src = notes[edit.gap[0]];
  if (!src) return;
  const dur = parseInt(src.querySelector('duration').textContent, 10);
  // Hard guard (divisions-aware): stealing a tail from a note shorter than 2 divisions would
  // zero out one side. Skip the edit and leave the DOM unchanged.
  if (!Number.isFinite(dur) || dur < 2) return;
  const antDur = Math.floor(dur / 2) || 1;
  const keep = dur - antDur;
  setDuration(src, keep, dpq);
  const ant = freshNote(src, edit.insertMidi, edit.insertName, antDur, dpq);
  ant.setAttribute('color', ADDED_NOTE_COLOR); // added note — mark for highlighting
  src.parentNode.insertBefore(ant, src.nextSibling); // end of src's measure, before note[gap[1]]
}

function applyTie(doc, voiceId, edit, dpq) {
  const notes = voiceNotes(doc, voiceId);
  const susp = notes[edit.index];
  const res = notes[edit.index + 1];
  if (!susp || !res) return;
  addTie(susp, 'start');
  const resDur = parseInt(res.querySelector('duration').textContent, 10);
  const hold = Math.floor(resDur / 2) || 1;
  const newRes = resDur - hold;
  const cont = cloneKeepPitch(susp, hold, dpq); // held-over suspension pitch
  addTie(cont, 'stop');
  res.parentNode.insertBefore(cont, res);
  setDuration(res, newRes, dpq);
}

function applyRetime(doc, voiceId, edit, dpq) {
  const notes = voiceNotes(doc, voiceId);
  const cur = notes[edit.index];
  const prev = notes[edit.index - 1];
  if (!cur || !prev) return;
  const delta = edit.deltaOnset;
  setDuration(prev, parseInt(prev.querySelector('duration').textContent, 10) - delta, dpq);
  setDuration(cur, parseInt(cur.querySelector('duration').textContent, 10) + delta, dpq);
}

// Grace-slide: a slashed grace note (no <duration>) inserted before notes[index], slurred into it.
// Used by the bluesy grace-slide site. Colored so it highlights/rings as added material.
function applyGrace(doc, voiceId, edit) {
  const notes = voiceNotes(doc, voiceId);
  const target = notes[edit.index];
  if (!target) return;
  const g = doc.createElement('note');
  const grace = doc.createElement('grace'); grace.setAttribute('slash', 'yes');
  writePitch(g, edit.insertMidi, edit.insertName);   // grace has no <duration>, so writePitch inserts pitch at front
  g.insertBefore(grace, g.firstChild);               // ensure <grace> is FIRST, before <pitch>
  g.setAttribute('color', ADDED_NOTE_COLOR);
  const v = doc.createElement('voice'); v.textContent = String(voiceId); g.appendChild(v);
  // A grace note MUST carry a <type>: it has no <duration>, so without a type VexFlow can't size it
  // and OSMD throws "Invalid note initialization object" while rendering (the whole variation then
  // fails to draw). Eighth is the conventional grace-slide value.
  const t = doc.createElement('type'); t.textContent = 'eighth'; g.appendChild(t);
  target.parentNode.insertBefore(g, target);
}

// Shuffle: swing the eighth pair at [index, index+1] to long-short (2:1), keeping their combined
// duration. Skips if the pair can't split 2:1 into whole divisions >= 1 (leaves the DOM unchanged).
function applyShuffle(doc, voiceId, edit, dpq) {
  const notes = voiceNotes(doc, voiceId);
  const a = notes[edit.index]; const b = notes[edit.index + 1];
  if (!a || !b) return;
  // A duration-less neighbour (e.g. a grace note) has no <duration> to read — skip the edit
  // rather than dereference null.
  const da0 = a.querySelector('duration'); const db0 = b.querySelector('duration');
  if (!da0 || !db0) return;
  const da = parseInt(da0.textContent, 10);
  const db = parseInt(db0.textContent, 10);
  const total = da + db;
  if (!Number.isFinite(total)) return;
  const long = Math.round((total * 2) / 3);
  const short = total - long;
  if (short < 1 || long < 1 || long <= short) return;   // can't swing (e.g. total < 3)
  setDuration(a, long, dpq);
  setDuration(b, short, dpq);
}

const APPLIERS = {
  split: applySplit,
  insert: applyInsert,
  tie: applyTie,
  retime: applyRetime,
  grace: applyGrace,
  shuffle: applyShuffle,
};

// Apply a variation's edits to the chosen voice within the (already extracted) segment XML.
// Returns a new MusicXML string. Edits are applied in descending index order so that an insertion
// at a higher position never shifts the note addresses of edits still to be applied.
export function applyVariation(segmentXml, voiceId, edits) {
  const doc = new DOMParser().parseFromString(segmentXml, 'application/xml');
  // Assumes a single divisions value for the segment (fine for the single-voice segments this
  // builder targets); takes the first <divisions> as divisions-per-quarter.
  const divEl = doc.querySelector('divisions');
  const dpq = (divEl && parseInt(divEl.textContent, 10)) || 1;

  const ordered = [...(edits || [])].sort((a, b) => editPosition(b) - editPosition(a));
  ordered.forEach((edit) => {
    const fn = APPLIERS[edit.op];
    if (fn) fn(doc, voiceId, edit, dpq);
  });

  return new XMLSerializer().serializeToString(doc);
}

// ---------------------------------------------------------------------------
// writeVoice — lay a complete voice onto each measure of a segment
// ---------------------------------------------------------------------------

// Lay a COMPLETE voice onto each measure of a segment doc: a <backup> that rewinds the measure's
// existing content, then the voice's notes in onset order with <rest>s filling every gap so the
// voice spans the full measure. `notesByMeasure[measureNumber] = { divs, notes: [...] }` where each
// note is { onsetDivs, durDivs, midi, name? } or { onsetDivs, durDivs, rest:true }. `divs` is the
// measure's total divisions. When `color` is set every pitched note carries it (→ coloredNoteMarks).
// Shared by the single-voice split and the contrapuntal counter-line.
export function writeVoice(doc, { voiceId, staff = null, notesByMeasure = {}, color = null }) {
  const divEl = doc.querySelector('divisions');
  const dpq = (divEl && parseInt(divEl.textContent, 10)) || 1;
  doc.querySelectorAll('measure').forEach((m) => {
    const num = parseInt(m.getAttribute('number'), 10);
    const spec = notesByMeasure[num];
    if (!spec) return;
    const total = spec.divs;
    // Rewind ONLY over content already in the measure (another voice). Into an EMPTY measure — e.g.
    // the FIRST voice laid by the single-voice split — a leading <backup> would push this voice to a
    // NEGATIVE onset. OSMD normalizes that to 0, but the player and OSMD cursor read the absolute beat
    // literally, so playback, the moving cursor, and note-muting all desync. Skip it when nothing precedes.
    if (total > 0 && m.querySelector('note')) {
      const backup = doc.createElement('backup');
      const bd = doc.createElement('duration'); bd.textContent = String(total);
      backup.appendChild(bd);
      m.appendChild(backup);
    }
    const items = [...(spec.notes || [])].sort((a, b) => a.onsetDivs - b.onsetDivs);
    let cursor = 0;
    const emit = (durDivs, note) => {
      if (durDivs <= 0) return;
      const el = note || makeRest(doc);
      setDuration(el, durDivs, dpq); // creates + positions <duration> when the note has none
      const v = doc.createElement('voice'); v.textContent = String(voiceId);
      el.appendChild(v);
      if (staff != null) { const s = doc.createElement('staff'); s.textContent = String(staff); el.appendChild(s); }
      m.appendChild(el);
    };
    const makeNote = (it, isChord) => {
      const note = doc.createElement('note');
      writePitch(note, it.midi, it.name); // emit's setDuration inserts <duration> after this <pitch>
      if (isChord) note.insertBefore(doc.createElement('chord'), note.firstChild); // <chord/> before <pitch>
      if (color) note.setAttribute('color', color);
      return note;
    };
    // Group onset-sorted items sharing an onsetDivs into a chord stack; rests never stack.
    const groups = [];
    items.forEach((it) => {
      const prev = groups[groups.length - 1];
      if (prev && !it.rest && !prev[0].rest && prev[0].onsetDivs === it.onsetDivs) prev.push(it);
      else groups.push([it]);
    });
    groups.forEach((group) => {
      const head = group[0];
      if (head.onsetDivs > cursor) emit(head.onsetDivs - cursor, null); // gap rest before this group
      if (head.rest) emit(head.durDivs, null);
      else group.forEach((it, i) => emit(it.durDivs, makeNote(it, i > 0))); // 1st note plain, rest are <chord/>
      const dur = Math.max(...group.map((it) => it.durDivs)); // stack advances the clock once, by its longest note
      cursor = Math.max(cursor, head.onsetDivs + dur);
    });
    if (cursor < total) emit(total - cursor, null); // trailing rest to the barline
  });
  return doc;
}

// A bare <note><rest/></note> (duration set by the caller via setDuration).
function makeRest(doc) {
  const note = doc.createElement('note');
  note.appendChild(doc.createElement('rest'));
  return note;
}

// ---------------------------------------------------------------------------
// coloredNoteMarks — locate the notes a variation ADDED (by color attribute)
// ---------------------------------------------------------------------------

// Given a variation MusicXML string (or Document), return one { measure, midi, onsetDivs } for
// every <note> carrying `color`. `measure` is the containing <measure number> (integer); `midi` is
// derived from <pitch> (12*(octave+1) + STEP_PC[step] + alter); `onsetDivs` is the note's onset
// within its measure = the sum of preceding same-voice, non-<chord/> <duration> values.
export function coloredNoteMarks(xml, color = ADDED_NOTE_COLOR) {
  const doc = typeof xml === 'string' ? new DOMParser().parseFromString(xml, 'application/xml') : xml;
  const marks = [];
  let divisions = 1;   // carried forward: MusicXML states it once and later measures inherit it
  doc.querySelectorAll('measure').forEach((m) => {
    const measure = parseInt(m.getAttribute('number'), 10);
    const dEl = m.querySelector('attributes > divisions');
    if (dEl) divisions = parseInt(dEl.textContent, 10) || divisions;
    const notes = Array.from(m.querySelectorAll('note'));
    notes.forEach((note) => {
      if (note.getAttribute('color') !== color) return;
      const pitch = note.querySelector('pitch');
      if (!pitch) return;
      const step = pitch.querySelector('step').textContent.trim();
      const octave = parseInt(pitch.querySelector('octave').textContent, 10);
      const alterEl = pitch.querySelector('alter');
      const alter = alterEl ? parseInt(alterEl.textContent, 10) : 0;
      const midi = 12 * (octave + 1) + (STEP_PC[step] ?? 0) + alter;

      // Onset = sum of preceding <duration> for the same voice in this measure, skipping
      // <chord/>-stacked notes (they share the previous onset, so add no time).
      const vEl = note.querySelector('voice');
      const voiceId = vEl ? vEl.textContent.trim() : null;
      let onsetDivs = 0;
      for (const n of notes) {
        if (n === note) break;
        if (n.querySelector('chord')) continue;
        if (voiceId != null) {
          const nv = n.querySelector('voice');
          if (!nv || nv.textContent.trim() !== voiceId) continue;
        }
        const d = n.querySelector('duration');
        if (d) onsetDivs += parseInt(d.textContent, 10) || 0;
      }
      // onsetBeats = the same onset in quarter-notes from the barline. `onsetDivs` alone is unusable
      // outside this document (divisions vary per piece), and the renderer needs a musical position
      // to tell two same-pitch notes in one bar apart.
      marks.push({ measure, midi, onsetDivs, onsetBeats: onsetDivs / (divisions || 1) });
    });
  });
  return marks;
}
