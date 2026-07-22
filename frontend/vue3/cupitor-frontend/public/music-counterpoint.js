// public/music-counterpoint.js
//
// Generate independent counter-lines that move against the melody — preferring contrary motion and
// consonant vertical intervals. Counter-notes are drawn from the chord tones AND the diatonic scale
// (passing/colour tones, so the line isn't limited to 3rds/5ths), never fall below the guitar's low
// E, and a beat may REST when nothing fits well — so the line need not shadow every melody note.
// Pure: returns note lists; the caller realizes them as a new colored voice via writeVoice (which
// fills the gaps between sounded notes with rests).

import { chordByAnyName, getScale } from './music-reference-data.js';
import { pitchClass } from './music-encoding.js';

const CONSONANT = new Set([0, 3, 4, 7, 8, 9]);   // uni/min3/maj3/P5/min6/maj6 (mod-12 interval)
const LOWEST_MIDI = 40;        // E2 — the guitar's open low-E string; counter-notes never go below it.
const CHORD_TONE_BONUS = 1;    // chord tones edge out passing tones when consonance/motion otherwise tie.
const REST_SCORE = 1.5;        // a beat rests unless its best pitched option scores strictly higher.

function pcsOf(names) { return (names || []).map((n) => pitchClass(n)).filter((p) => p != null); }
function chordPcs(sym) { const c = sym ? chordByAnyName(sym) : null; return c ? pcsOf(c.notes) : []; }
function scalePcs(key) { try { return pcsOf(getScale(key)); } catch (_) { return []; } }

// Highest midi <= ceil with pitch class pc.
function highestBelow(pc, ceil) { let m = ((pc % 12) + 12) % 12; while (m + 12 <= ceil) m += 12; return m; }
// Lowest midi >= floor with pitch class pc.
function lowestAbove(pc, floor) { let m = ((pc % 12) + 12) % 12; while (m < floor) m += 12; return m; }

export function generateCounterLines({ melody, chordByMeasure, key, register = 'below', cap = 6 } = {}) {
  if (!melody || !melody.length) return [];
  const scale = new Set(scalePcs(key));
  // Candidate chord/scale tones under (or over) each melody note, tagged whether they are chord tones.
  // A beat with no known chord gets NO candidates (it can only rest — its harmony can't be judged), so
  // scale tones only ever augment a real chord; they never conjure a line out of an unknown symbol.
  const candByBeat = melody.map((mn) => {
    const chord = new Set(chordPcs(chordByMeasure[mn.measure]));
    if (!chord.size) return [];
    const byMidi = new Map();
    new Set([...chord, ...scale]).forEach((pc) => {
      const base = register === 'above' ? lowestAbove(pc, mn.midi + 1) : highestBelow(pc, mn.midi - 1);
      [base, register === 'above' ? base + 12 : base - 12].forEach((cm) => {
        if (cm < LOWEST_MIDI || cm === mn.midi) return;   // never below the low-E floor, never in unison
        const cand = byMidi.get(cm) || { midi: cm, chordTone: false };
        cand.chordTone = cand.chordTone || chord.has(pc);
        byMidi.set(cm, cand);
      });
    });
    return [...byMidi.values()];
  });
  const firstIdx = candByBeat.findIndex((c) => c.length);
  if (firstIdx === -1) return [];   // no beat can sound a counter-note anywhere → no line

  // Score a candidate at beat i against the counter-line's last SOUNDED pitch (prev; null before the
  // line has started or right after a rest at the very start).
  const scoreCand = (cand, i, prev) => {
    const interval = Math.abs(cand.midi - melody[i].midi) % 12;   // interval CLASS — right for both registers
    const consonant = CONSONANT.has(interval) ? 2 : 0;
    const chordBonus = cand.chordTone ? CHORD_TONE_BONUS : 0;
    let motion = 1;
    if (prev != null && i > 0) {
      const melDir = Math.sign(melody[i].midi - melody[i - 1].midi);
      const ctDir = Math.sign(cand.midi - prev);
      if (melDir === 0) motion = 1;            // melody holds → no contrary/parallel sense
      else if (ctDir === 0) motion = 0.5;      // counter holds (oblique) — don't reward standing still
      else if (ctDir !== melDir) motion = 3;   // CONTRARY — strongly preferred (makes the line independent)
      else motion = 0;                         // parallel
    }
    const near = prev == null ? 0 : -Math.abs(cand.midi - prev) / 18;   // soft leap penalty
    return consonant + chordBonus + motion + near;
  };

  const lines = [];
  candByBeat[firstIdx].slice(0, 4).forEach((seed) => {
    const notes = [];
    let prev = null;
    for (let i = 0; i < melody.length; i++) {
      let chosen = null;
      if (i === firstIdx) {
        chosen = seed;                         // force distinct starts so the beam explores real options
      } else {
        let bestScore = REST_SCORE;            // a candidate must BEAT this to sound; else the beat rests
        candByBeat[i].forEach((cand) => {
          const s = scoreCand(cand, i, prev);
          if (s > bestScore) { bestScore = s; chosen = cand; }
        });
      }
      if (chosen) {
        notes.push({ midi: chosen.midi, measure: melody[i].measure,
          onsetDivs: melody[i].onsetDivs, durDivs: melody[i].durDivs });
        prev = chosen.midi;
      }
      // else: this beat rests — writeVoice fills the gap, so the counter-line doesn't shadow every note.
    }
    if (notes.length) lines.push({ label: `counter-line from ${seed.midi}`, notes });
  });
  // Dedupe identical lines (same sounded pitches at the same onsets); cap.
  const seen = new Set(); const out = [];
  for (const l of lines) {
    const k = l.notes.map((n) => `${n.onsetDivs}:${n.midi}`).join(',');
    if (seen.has(k)) continue; seen.add(k); out.push(l);
    if (out.length >= cap) break;
  }
  return out;
}
