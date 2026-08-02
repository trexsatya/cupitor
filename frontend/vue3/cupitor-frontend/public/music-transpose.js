// public/music-transpose.js
//
// Pure MusicXML transposition: shift every <pitch> by a number of semitones, respell each note to the
// target key's accidental preference (sharps for sharp keys, flats for flat keys), drop now-stale
// visual <accidental>s (OSMD redraws them from pitch + key signature), and rewrite the key signature.
// DOMParser + XMLSerializer only — no jQuery / app coupling — so it unit-tests in jsdom and the caller
// can transpose the source and re-render (sheet, chord detection, fretboard capture, playback all follow).

export const STEP_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Key (tonic) name → pitch class. Enharmonic spellings share a class.
export const KEY_PC = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11, 'B#': 0,
};

// Target pitch class → conventional MAJOR key signature (fifths) and sharp-vs-flat spelling. Mode is
// not tracked: the signature is cosmetic (each note's <alter> carries the true pitch regardless).
export const PC_KEY = {
  0: { fifths: 0, sharp: true }, 1: { fifths: -5, sharp: false }, 2: { fifths: 2, sharp: true },
  3: { fifths: -3, sharp: false }, 4: { fifths: 4, sharp: true }, 5: { fifths: -1, sharp: false },
  6: { fifths: 6, sharp: true }, 7: { fifths: 1, sharp: true }, 8: { fifths: -4, sharp: false },
  9: { fifths: 3, sharp: true }, 10: { fifths: -2, sharp: false }, 11: { fifths: 5, sharp: true },
};

// pitch class → [step, alter] for sharp / flat spelling. No B#/Cb, so octave = floor(midi/12)-1 holds.
export const SHARP = { 0: ['C', 0], 1: ['C', 1], 2: ['D', 0], 3: ['D', 1], 4: ['E', 0], 5: ['F', 0], 6: ['F', 1], 7: ['G', 0], 8: ['G', 1], 9: ['A', 0], 10: ['A', 1], 11: ['B', 0] };
export const FLAT = { 0: ['C', 0], 1: ['D', -1], 2: ['D', 0], 3: ['E', -1], 4: ['E', 0], 5: ['F', 0], 6: ['G', -1], 7: ['G', 0], 8: ['A', -1], 9: ['A', 0], 10: ['B', -1], 11: ['B', 0] };

// Smallest signed semitone shift moving pitch class `from` onto `to` (range [-5, 6]) — least register change.
export function nearestSemitones(from, to) {
  const raw = (((to - from) % 12) + 12) % 12;
  return raw > 6 ? raw - 12 : raw;
}

// Transpose `xmlString` by `semitones`; `targetPc` (0–11) picks the spelling + key signature and `mode`
// ('major' | 'minor') selects the mode. A minor target borrows its relative major's signature (tonic +3
// semitones), so A minor gets C major's 0 sharps rather than A major's 3. Returns a new MusicXML string
// (or the input unchanged for a 0/invalid shift or unparseable input).
export function transposeMusicXml(xmlString, semitones, targetPc, mode = 'major') {
  if (!xmlString || typeof xmlString !== 'string' || !semitones) return xmlString;
  let doc;
  try { doc = new DOMParser().parseFromString(xmlString, 'application/xml'); } catch (_) { return xmlString; }
  if (!doc || doc.getElementsByTagName('parsererror').length) return xmlString;

  // Signature + spelling follow the relative MAJOR key for a minor target (tonic + 3 semitones).
  const sigPc = (((mode === 'minor' ? targetPc + 3 : targetPc) % 12) + 12) % 12;
  const spec = PC_KEY[sigPc] || PC_KEY[0];
  const table = spec.sharp ? SHARP : FLAT;

  doc.querySelectorAll('note').forEach((note) => {
    const pitch = note.querySelector('pitch');
    if (!pitch) return;   // rest / unpitched — untouched
    const step = pitch.querySelector('step');
    const octaveEl = pitch.querySelector('octave');
    if (!step || !octaveEl) return;
    const alterEl = pitch.querySelector('alter');
    const alter = alterEl ? parseInt(alterEl.textContent, 10) : 0;
    const oct = parseInt(octaveEl.textContent, 10);
    const midi = 12 * (oct + 1) + (STEP_PC[step.textContent.trim()] || 0) + alter + semitones;
    const pc = ((midi % 12) + 12) % 12;
    const [newStep, newAlter] = table[pc];
    step.textContent = newStep;
    octaveEl.textContent = String(Math.floor(midi / 12) - 1);
    if (newAlter === 0) {
      if (alterEl) alterEl.remove();
    } else if (alterEl) {
      alterEl.textContent = String(newAlter);
    } else {
      const a = doc.createElement('alter'); a.textContent = String(newAlter);
      pitch.insertBefore(a, octaveEl);   // MusicXML order: step, alter, octave
    }
    const acc = note.querySelector('accidental');
    if (acc) acc.remove();   // stale visual accidental — OSMD redraws from pitch + key
  });

  doc.querySelectorAll('fifths').forEach((f) => { f.textContent = String(spec.fifths); });
  doc.querySelectorAll('key mode').forEach((m) => { m.textContent = mode; });   // update the label only when present

  return new XMLSerializer().serializeToString(doc);
}
