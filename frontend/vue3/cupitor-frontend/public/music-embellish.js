// Pure music-embellishment engine: tag a voice's notes against per-measure chords,
// find eligible non-chord-tone sites per technique, and enumerate progressive
// (capped, non-conflicting) combinations. No DOM, no UI — abstract edits only.
import { pitchClass, midiToName } from './music-encoding.js';
import { getScale, chordByAnyName } from './music-reference-data.js';

// --- Task 1: pitch helpers + buildPool ---

export const pcOf = (midi) => (((midi % 12) + 12) % 12);

// Diatonic pitch classes of a major-key name (getScale returns spelled scale note names).
export function scalePcs(key) {
  // getScale throws on unknown key names (undefined.split); mirror toSargam's defensive guard.
  let scale = null;
  try { scale = key ? getScale(key) : null; } catch (e) { return []; }
  if (!scale || !scale.length) return [];
  return [...new Set(scale.map((n) => pitchClass(n)).filter((p) => p != null))];
}

// Allowed decorating pitch classes. Default: PCs present in the segment. addNotes: the key scale.
export function buildPool(segmentNoteNames, { addNotes = false, key = null } = {}) {
  const pool = new Set((segmentNoteNames || []).map((n) => pitchClass(n)).filter((p) => p != null));
  if (addNotes) scalePcs(key).forEach((p) => pool.add(p));
  return pool;
}

// Blue-note pitch classes for a key: ♭3, ♭5/♯4, ♭7 above the tonic. Tonic pc from the scale's root
// (falls back to 0 for an unknown key so a bluesy pool still has something to add).
export function BLUE_PCS(key) {
  let tonic = 0;
  try { const scale = key ? getScale(key) : null; if (scale && scale.length) tonic = pitchClass(scale[0]) ?? 0; }
  catch (e) { tonic = 0; }
  return [3, 6, 10].map((iv) => (tonic + iv) % 12);
}

// --- Task 2: noteRoles ---

function chordPcSet(sym) {
  const c = sym ? chordByAnyName(sym) : null;
  return c ? new Set(c.notes.map((n) => pitchClass(n)).filter((p) => p != null)) : new Set();
}

export function noteRoles(notes, chordByMeasure = {}) {
  const strongOnsetByMeasure = {};
  (notes || []).forEach((n) => {
    const cur = strongOnsetByMeasure[n.measure];
    if (cur == null || n.onset < cur) strongOnsetByMeasure[n.measure] = n.onset;
  });
  return (notes || []).map((n) => {
    const pcs = chordPcSet(n.chord != null ? n.chord : chordByMeasure[n.measure]);
    const pc = pcOf(n.midi);
    return { ...n, pc, isChordTone: pcs.has(pc),
      beatStrength: n.onset === strongOnsetByMeasure[n.measure] ? 'strong' : 'weak' };
  });
}

// --- Task 3: enumerateVariations (progressive + cap + conflict) ---

// Two sites conflict if their edits touch the same note index or the same insertion gap.
function sitesConflict(a, b) {
  if (a.index === b.index) return true;
  if (a.gap && b.gap && a.gap[0] === b.gap[0]) return true;
  // Conservative on purpose: adjacent splits (gap [i,i+1] vs index i+1) are kept apart —
  // both would edit the shared boundary note, so we never pair them.
  if (a.gap && a.gap.includes(b.index)) return true;
  if (b.gap && b.gap.includes(a.index)) return true;
  return false;
}

function combos(sites, size) {
  if (size === 1) return sites.map((s) => [s]);
  const out = [];
  for (let i = 0; i < sites.length; i++) {
    for (const tail of combos(sites.slice(i + 1), size - 1)) {
      const group = [sites[i], ...tail];
      if (group.every((s, x) => group.slice(x + 1).every((t) => !sitesConflict(s, t)))) out.push(group);
    }
  }
  return out;
}

export function enumerateVariations(sites, { cap = 50 } = {}) {
  const out = [];
  for (let size = 1; size <= (sites || []).length && out.length < cap; size++) {
    for (const group of combos(sites, size)) {
      if (out.length >= cap) break;
      out.push({
        id: `v${out.length + 1}`,
        label: group.map((s) => s.label).join(' · '),
        techniques: group.map((s) => s.technique),
        edits: group.map((s) => s.edit),
      });
    }
  }
  return out;
}

// --- Task 4: diatonic-step helpers ---

function scaleIndex(pc, scale) { return scale.indexOf(pc); }

export function diatonicNeighborPc(pc, dir, scale) {
  const i = scaleIndex(pc, scale);
  if (i < 0 || !scale.length) return null;
  return scale[((i + dir) % scale.length + scale.length) % scale.length];
}

export function isThirdApart(pcA, pcB, scale) {
  const a = scaleIndex(pcA, scale), b = scaleIndex(pcB, scale);
  if (a < 0 || b < 0) return false;
  const d = ((b - a) % scale.length + scale.length) % scale.length;
  return d === 2 || d === scale.length - 2;
}

export function midpointPc(pcA, pcB, scale) {
  if (!isThirdApart(pcA, pcB, scale)) return null;
  const a = scaleIndex(pcA, scale);
  const up = ((scaleIndex(pcB, scale) - a) % scale.length + scale.length) % scale.length === 2;
  return diatonicNeighborPc(pcA, up ? +1 : -1, scale);
}

// --- Task 5 & 6: eligibleSites dispatcher + passing/neighbour detectors ---

// Pick the octave of a pitch class nearest to a reference midi (keeps decorations close in register).
function nearestMidiForPc(pc, aroundMidi) {
  const base = aroundMidi - (((aroundMidi % 12) + 12) % 12) + pc;
  return [base - 12, base, base + 12].reduce((best, m) =>
    Math.abs(m - aroundMidi) < Math.abs(best - aroundMidi) ? m : best);
}

// passing: two adjacent chord tones a diatonic third apart -> insert the middle scale pc.
function passingSites(roled, scale, pool) {
  const out = [];
  for (let i = 0; i + 1 < roled.length; i++) {
    const a = roled[i], b = roled[i + 1];
    if (!a.isChordTone || !b.isChordTone) continue;
    // midpointPc re-checks the third-apart condition and returns null otherwise, so no separate guard.
    const mid = midpointPc(a.pc, b.pc, scale);
    if (mid == null || !pool.has(mid)) continue;
    const insertMidi = nearestMidiForPc(mid, a.midi);
    const insertName = midiToName(insertMidi);
    out.push({ technique: 'passing', index: i, gap: [i, i + 1], insertMidi, insertName,
      label: `passing ${insertName} @ m${a.measure}`,
      edit: { op: 'split', index: i, insertMidi, insertName } });
  }
  return out;
}

// neighbour: a chord tone whose next note repeats the same pc -> insert a diatonic neighbour
// between them (upper preferred, lower fallback) if it is in the pool.
function neighbourSites(roled, scale, pool) {
  const out = [];
  for (let i = 0; i + 1 < roled.length; i++) {
    const a = roled[i], b = roled[i + 1];
    if (!a.isChordTone || a.pc !== b.pc) continue;
    for (const dir of [+1, -1]) {
      const npc = diatonicNeighborPc(a.pc, dir, scale);
      if (npc == null || !pool.has(npc)) continue;
      const insertMidi = nearestMidiForPc(npc, a.midi);
      const insertName = midiToName(insertMidi);
      out.push({ technique: 'neighbour', index: i, gap: [i, i + 1], insertMidi, insertName,
        label: `${dir > 0 ? 'upper' : 'lower'} neighbour ${insertName} @ m${a.measure}`,
        edit: { op: 'split', index: i, insertMidi, insertName } });
      break; // one neighbour per site (upper preferred)
    }
  }
  return out;
}

// --- Task 7: anticipation detector (re-timing, no new pitch) ---

// anticipation: sound the next chord tone early by stealing the tail of the current note.
// No new pitch (reuses the next note's own pitch). Pool-independent.
function anticipationSites(roled) {
  const out = [];
  for (let i = 0; i + 1 < roled.length; i++) {
    const a = roled[i], b = roled[i + 1];
    if (!b.isChordTone) continue;
    if (a.duration < 1) continue;               // need >= a quarter-note (1 beat) to steal a tail
    const insertMidi = b.midi, insertName = b.name;
    out.push({ technique: 'anticipation', index: i, gap: [i, i + 1], insertMidi, insertName,
      label: `anticipation ${insertName} @ m${b.measure}`,
      edit: { op: 'insert', gap: [i, i + 1], insertMidi, insertName } });
  }
  return out;
}

// --- Task 8: suspension + retardation detectors (re-timing, tie) ---

// dir = -1 for suspension (resolves down), +1 for retardation (resolves up).
// note[i] is a chord tone a diatonic step (dir) from a chord tone note[i+1] across a
// chord change -> hold note[i] over (tie) then resolve by step. No new pitch. Pool-independent.
function suspensionLike(roled, scale, technique, dir) {
  const out = [];
  for (let i = 0; i + 1 < roled.length; i++) {
    const a = roled[i], b = roled[i + 1];
    if (!a.isChordTone || !b.isChordTone) continue;
    // A suspension/retardation is defined by a chord CHANGE (which usually but not
    // necessarily coincides with a barline), not by the barline itself.
    if (!a.chord || !b.chord || a.chord === b.chord) continue;
    if (diatonicNeighborPc(a.pc, dir, scale) !== b.pc) continue; // a resolves to b by a step
    out.push({ technique, index: i, gap: null, insertMidi: null, insertName: null,
      label: `${technique} @ m${a.measure}–${b.measure}`,
      edit: { op: 'tie', index: i } });
  }
  return out;
}

// --- Task 9: appoggiatura + escape detectors (pitch-inserting) ---

// appoggiatura: on a strong-beat chord tone, insert an accented non-chord diatonic
// step-neighbour BEFORE it that resolves by step into it. Site valid if neighbour pc in pool.
function appoggiaturaSites(roled, scale, pool) {
  const out = [];
  for (let i = 0; i < roled.length; i++) {
    const t = roled[i];
    if (!t.isChordTone || t.beatStrength !== 'strong') continue;
    if (t.duration < 1) continue;               // need >= a quarter-note (1 beat) of room
    for (const dir of [+1, -1]) {
      const npc = diatonicNeighborPc(t.pc, dir, scale);
      if (npc == null || !pool.has(npc)) continue;
      const insertMidi = nearestMidiForPc(npc, t.midi), insertName = midiToName(insertMidi);
      out.push({ technique: 'appoggiatura', index: i, gap: null, insertMidi, insertName,
        label: `appoggiatura ${insertName} @ m${t.measure}`,
        edit: { op: 'split', index: i, insertMidi, insertName, before: true } });
      break;
    }
  }
  return out;
}

// escape (échappée): a chord tone note[i] followed (by a leap) by a chord tone note[i+1] ->
// step AWAY from note[i] to a weak non-chord tone, then the existing leap completes it.
function escapeSites(roled, scale, pool) {
  const out = [];
  for (let i = 0; i + 1 < roled.length; i++) {
    const a = roled[i], b = roled[i + 1];
    if (!a.isChordTone || !b.isChordTone) continue;
    if (Math.abs(b.midi - a.midi) < 3) continue;              // need a leap to "escape" into
    // échappée: step away opposite the resolution leap, then the existing leap completes it.
    const dir = b.midi > a.midi ? -1 : +1;
    const npc = diatonicNeighborPc(a.pc, dir, scale);
    if (npc == null || !pool.has(npc)) continue;
    const insertMidi = nearestMidiForPc(npc, a.midi), insertName = midiToName(insertMidi);
    out.push({ technique: 'escape', index: i, gap: [i, i + 1], insertMidi, insertName,
      label: `escape ${insertName} @ m${a.measure}`,
      edit: { op: 'split', index: i, insertMidi, insertName } });
  }
  return out;
}

// Bluesy grace-slide: a grace note a semitone BELOW each strong-beat chord tone, slurred into it.
// Emits a `grace` edit. Register-exact (midi-1); the builder colors it as added.
export function blueGraceSlideSites(roled) {
  const sites = [];
  (roled || []).forEach((t, i) => {
    if (!t.isChordTone || t.beatStrength !== 'strong') return;
    const insertMidi = t.midi - 1;
    const insertName = midiToName(insertMidi);
    sites.push({ technique: 'bluesyGrace', index: i, gap: null, insertMidi, insertName,
      label: `blue grace → ${midiToName(t.midi)} @ m${t.measure}`,
      edit: { op: 'grace', index: i, insertMidi, insertName } });
  });
  return sites;
}

// One shuffle edit per adjacent eighth-note pair within a single beat (both ~0.5-quarter durations,
// same measure). Swings the pair long-short. Standard site shape so it enumerates + conflict-checks
// by index like the others.
export function shuffleSites(roled) {
  const out = [];
  for (let i = 0; i + 1 < (roled || []).length; i++) {
    const a = roled[i], b = roled[i + 1];
    if (a.duration === 0.5 && b.duration === 0.5 && a.measure === b.measure) {
      out.push({ technique: 'shuffle', index: i, gap: null,
        label: `shuffle @ m${a.measure}`, edit: { op: 'shuffle', index: i } });
    }
  }
  return out;
}

const DETECTORS = {
  passing: passingSites,
  neighbour: neighbourSites,
  anticipation: anticipationSites,
  suspension: (r, s) => suspensionLike(r, s, 'suspension', -1),
  retardation: (r, s) => suspensionLike(r, s, 'retardation', +1),
  appoggiatura: appoggiaturaSites,
  escape: escapeSites,
  bluesyGrace: (roled) => blueGraceSlideSites(roled),
};

export function eligibleSites(roled, { pool, key, techniques } = {}) {
  const scale = scalePcs(key);
  const enabled = techniques || Object.keys(DETECTORS);
  const sites = [];
  enabled.forEach((t) => { if (DETECTORS[t]) sites.push(...DETECTORS[t](roled, scale, pool)); });
  return sites;
}

// --- Task 10: TECHNIQUES metadata + generateVariations façade ---

export const TECHNIQUES = [
  { key: 'passing', name: 'Passing tone', needsNewPitch: true },
  { key: 'neighbour', name: 'Neighbour tone', needsNewPitch: true },
  { key: 'suspension', name: 'Suspension', needsNewPitch: false },
  { key: 'retardation', name: 'Retardation', needsNewPitch: false },
  { key: 'appoggiatura', name: 'Appoggiatura', needsNewPitch: true },
  { key: 'escape', name: 'Escape tone', needsNewPitch: true },
  { key: 'anticipation', name: 'Anticipation', needsNewPitch: false },
];

export function generateVariations({ voiceNotes, chordByMeasure, segmentNoteNames, key,
  techniques, addNotes = false, cap = 50, style = 'classical', shuffle = false } = {}) {
  const pool = buildPool(segmentNoteNames, { addNotes, key });
  if (style === 'bluesy') BLUE_PCS(key).forEach((p) => pool.add(p));
  const roled = noteRoles(voiceNotes, chordByMeasure);
  const enabled = (techniques || []).slice();
  if (style === 'bluesy' && !enabled.includes('bluesyGrace')) enabled.push('bluesyGrace');
  const sites = eligibleSites(roled, { pool, key, techniques: enabled });
  if (style === 'bluesy' && shuffle) sites.push(...shuffleSites(roled));
  return enumerateVariations(sites, { cap });
}
