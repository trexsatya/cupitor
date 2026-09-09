// public/music-key.js
// Key detection: signature first, MODE from cadences, pitch profile only as a check.
//
// Why not just read the key signature: a signature fixes the note *collection*, never the tonic —
// 0 sharps is C major AND A minor, 3 flats is Eb major AND C minor. So we take the signature's two
// candidates (relative major / relative minor) and decide between them from what the music actually
// lands on: the final bass note, the final chord, the dominant before it, the raised 7th a minor key
// needs for its leading tone. The Krumhansl profile fit (music-pattern.keyScores) is used only to
// break a cadence tie and to sanity-check the signature.
//
// And a signature is not a promise. Plenty of exported scores carry no <key> at all, or a bare
// 0 fifths, while writing every accidental inline — so "no signature" means "C major / A minor, OR
// the signature is simply missing". In that case a clearly better profile fit is allowed to win
// (source: 'profile'). When a REAL signature (non-zero) disagrees with the pitch content we keep the
// notated reading but report signatureFits: false, because the honest answer there is "the notation
// says X, the notes say Y" — not a silent override.
//
// Pure: arrays of {midi, measure, onset|onsetBeats|beats, durBeats?} in, a description out. No DOM.
import { keyScores } from './music-pattern.js';

const PC_OF_NAME = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, 'E#': 5, Fb: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, 'B#': 0, Cb: 11 };

// fifths (sharps +, flats −) → key name. Spellings match music-reference-data's scale tables, so
// every name here is accepted by getScale (that's why −7 is B, not Cb: there is no Cb major table).
export const MAJOR_BY_FIFTHS = { '-7': 'B', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb',
  '-1': 'F', '0': 'C', '1': 'G', '2': 'D', '3': 'A', '4': 'E', '5': 'B', '6': 'F#', '7': 'C#' };
export const MINOR_BY_FIFTHS = { '-7': 'G#m', '-6': 'Ebm', '-5': 'Bbm', '-4': 'Fm', '-3': 'Cm', '-2': 'Gm',
  '-1': 'Dm', '0': 'Am', '1': 'Em', '2': 'Bm', '3': 'F#m', '4': 'C#m', '5': 'G#m', '6': 'D#m', '7': 'A#m' };

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pcOf = (x) => ((x % 12) + 12) % 12;

// Pure: 'Am' | 'A m' | 'Amin' | 'A minor' | 'C' | 'C major' | 'F#m' | 'Bb' → { tonicPc, mode }.
// Anything unparseable → null. One parser for every key string in the app (meta.key is written in
// several shapes — a bare letter from a signature, 'D minor' from the transpose picker), so callers
// stop each inventing their own suffix-stripping (and silently mis-reading 'D minor' as no key).
export function parseKeyName(name) {
  const m = /^\s*([A-Ga-g])\s*([#b♯♭]{0,2})\s*(.*)$/.exec(String(name == null ? '' : name));
  if (!m) return null;
  const tonic = m[1].toUpperCase() + m[2].replace(/♯/g, '#').replace(/♭/g, 'b');
  const tonicPc = PC_OF_NAME[tonic];
  if (tonicPc == null) return null;
  const rest = m[3].toLowerCase().replace(/[\s._-]/g, '');
  const mode = (/^m/.test(rest) && !/^maj/.test(rest)) ? 'minor' : 'major';
  return { tonicPc, mode };
}

// Pure: the signature that spells (tonicPc, mode) — the enharmonic with the fewest accidentals.
export function fifthsOfKey(tonicPc, mode) {
  const table = mode === 'minor' ? MINOR_BY_FIFTHS : MAJOR_BY_FIFTHS;
  let best = null;
  for (let f = -7; f <= 7; f++) {
    const parsed = parseKeyName(table[String(f)]);
    if (parsed && parsed.tonicPc === pcOf(tonicPc) && (best == null || Math.abs(f) < Math.abs(best))) best = f;
  }
  return best == null ? 0 : best;
}

// Pure: getScale-compatible key name for (tonicPc, mode), spelled per its own signature (Eb, not D#).
export function keyNameOf(tonicPc, mode) {
  const f = String(fifthsOfKey(tonicPc, mode));
  return mode === 'minor' ? MINOR_BY_FIFTHS[f] : MAJOR_BY_FIFTHS[f];
}

// Pure: human label, e.g. 'A minor'.
export function keyLabelOf(tonicPc, mode) {
  const name = keyNameOf(tonicPc, mode).replace(/m$/, '');
  return `${name} ${mode}`;
}

// Pure: '2♯' / '3♭' / 'no ♯/♭' — how the signature reads on the page.
export function signatureText(fifths) {
  const f = parseInt(fifths, 10) || 0;
  if (!f) return 'no ♯/♭';
  return `${Math.abs(f)}${f > 0 ? '♯' : '♭'}`;
}

// Pure: the TWO keys a signature can mean — its major and its relative minor.
export function keyCandidatesFromFifths(fifths) {
  const f = String(parseInt(fifths, 10) || 0);
  const major = parseKeyName(MAJOR_BY_FIFTHS[f] || 'C');
  const minor = parseKeyName(MINOR_BY_FIFTHS[f] || 'Am');
  return [
    { tonicPc: major.tonicPc, mode: 'major', key: MAJOR_BY_FIFTHS[f] || 'C', label: keyLabelOf(major.tonicPc, 'major') },
    { tonicPc: minor.tonicPc, mode: 'minor', key: MINOR_BY_FIFTHS[f] || 'Am', label: keyLabelOf(minor.tonicPc, 'minor') },
  ];
}

const onsetOf = (n) => (n.onset != null ? n.onset : (n.onsetBeats != null ? n.onsetBeats : (n.beats != null ? n.beats : 0)));

// Pure: 12-bin pitch-class histogram weighted by sounding length (durBeats when present, else 1).
// A held tonic should outweigh a passing sixteenth — an unweighted count lets fast ornamental notes
// pull the profile fit toward the wrong key.
export function weightedPcHistogram(notes) {
  const counts = new Array(12).fill(0);
  (notes || []).forEach((n) => {
    if (!n || n.midi == null) return;
    const w = (typeof n.durBeats === 'number' && n.durBeats > 0) ? n.durBeats : 1;
    counts[pcOf(n.midi)] += w;
  });
  return counts;
}

// Pure: one summary per measure, in measure order:
//   { measure, pcs:Set, firstBassPc, lastBassPc, lastTopPc }
// firstBassPc = lowest note of the measure's FIRST onset column (its downbeat harmony's bass).
// lastBassPc = the bass of the measure's CLOSING HARMONY: the lowest note of its last vertical stack,
//   or — when nothing is stacked (an arpeggiated or single-line texture) — the lowest note in the
//   measure. Not the literal last note: an arpeggio can end on any chord tone, and reading a final
//   E-minor arpeggio that happens to finish on B as "ends on B" mis-called whole pieces.
// lastTopPc = highest note of the last onset — where the melody comes to rest.
export function measureSummaries(notes) {
  const byMeasure = new Map();
  (notes || []).forEach((n) => {
    if (!n || n.midi == null) return;
    const m = n.measure != null ? n.measure : 0;
    if (!byMeasure.has(m)) byMeasure.set(m, []);
    byMeasure.get(m).push(n);
  });
  return [...byMeasure.keys()].sort((a, b) => a - b).map((m) => {
    const ns = byMeasure.get(m);
    const onsets = ns.map(onsetOf);
    const first = Math.min(...onsets), last = Math.max(...onsets);
    const col = (t) => ns.filter((n) => onsetOf(n) === t);
    const lowest = (arr) => arr.reduce((a, b) => (b.midi < a.midi ? b : a), arr[0]);
    const highest = (arr) => arr.reduce((a, b) => (b.midi > a.midi ? b : a), arr[0]);
    const lastCol = col(last);
    const stacks = [...new Set(onsets)].sort((a, b) => a - b).map(col).filter((c) => c.length >= 2);
    const closing = stacks.length ? stacks[stacks.length - 1] : ns;
    return {
      measure: m,
      pcs: new Set(ns.map((n) => pcOf(n.midi))),
      firstBassPc: pcOf(lowest(col(first)).midi),
      lastBassPc: pcOf(lowest(closing).midi),
      lastTopPc: pcOf(highest(lastCol).midi),
    };
  });
}

// Cadence weights. Deliberately coarse and comparable: the winner is decided by a margin of a few
// points, so each item is worth roughly "how much a musician would lean on it".
const W = { finalBass: 4, finalMelody: 2, finalTriad: 2, dominantBefore: 2, modalDominant: 1,
  openingBass: 1, leadingTone: 2, cadenceElsewhere: 1, cadenceElsewhereCap: 3, tonicAbsent: -4 };

// Pure: how strongly the music cadences on (tonicPc, mode) → { score, reasons: [...] }.
// Reads the LAST measure (what the piece settles on), the measure before it (the approach), the
// opening bass, and — for a minor candidate — the raised 7th that a minor key's dominant needs and
// that its relative major would have no reason to write.
export function cadenceScore(summaries, tonicPc, mode, { pcCounts = null } = {}) {
  const sums = summaries || [];
  const reasons = [];
  if (!sums.length) return { score: 0, reasons };
  const T = pcOf(tonicPc);
  const third = mode === 'minor' ? 3 : 4;
  const nm = (off) => PC_NAMES[pcOf(T + off)];
  const has = (s, off) => s.pcs.has(pcOf(T + off));
  const triad = (s) => has(s, 0) && has(s, third) && has(s, 7);
  const domTriad = (s) => has(s, 7) && has(s, 11) && has(s, 2);
  let score = 0;
  const last = sums[sums.length - 1];

  if (last.lastBassPc === T) { score += W.finalBass; reasons.push(`closing harmony sits on ${nm(0)} in the bass`); }
  // Only when it's a different note than the bass — a single closing note is already counted above.
  if (last.lastTopPc === T && last.lastTopPc !== last.lastBassPc) { score += W.finalMelody; reasons.push(`melody ends on ${nm(0)}`); }
  if (triad(last)) { score += W.finalTriad; reasons.push(`final chord is the ${nm(0)} ${mode === 'minor' ? 'minor' : 'major'} triad`); }

  if (sums.length >= 2) {
    const prev = sums[sums.length - 2];
    if (domTriad(prev)) { score += W.dominantBefore; reasons.push(`dominant ${nm(7)}${mode === 'minor' ? ' (raised 7th)' : ''} leads into the final chord`); }
    else if (has(prev, 7) && has(prev, 10) && has(prev, 2)) { score += W.modalDominant; reasons.push(`modal v (${nm(7)} minor) before the final chord`); }
  }

  if (sums[0].firstBassPc === T) { score += W.openingBass; reasons.push(`opens on ${nm(0)} in the bass`); }

  // Minor-only: the raised 7th (leading tone). In A minor that G# is an accidental the signature does
  // not carry — its presence is the clearest sign the piece is in the minor, not the relative major
  // (where the same pitch would be a foreign #5 with no cadential job).
  if (mode === 'minor') {
    const raised = sums.filter((s) => has(s, 11)).length;
    if (raised) { score += W.leadingTone; reasons.push(`raised 7th ${nm(11)} used as a leading tone (${raised} measure${raised > 1 ? 's' : ''})`); }
  }

  // V→i / V→I anywhere: a dominant-triad measure followed by a tonic-triad measure.
  let elsewhere = 0;
  for (let i = 0; i + 1 < sums.length - 1; i++) if (domTriad(sums[i]) && triad(sums[i + 1])) elsewhere++;
  if (elsewhere) {
    const add = Math.min(elsewhere * W.cadenceElsewhere, W.cadenceElsewhereCap);
    score += add;
    reasons.push(`${elsewhere} internal ${nm(7)}→${nm(0)} cadence${elsewhere > 1 ? 's' : ''}`);
  }

  if (pcCounts && !pcCounts[T]) { score += W.tonicAbsent; reasons.push(`${nm(0)} never sounds`); }
  return { score, reasons };
}

const MARGIN_HIGH = 4, MARGIN_MED = 2;
const PROFILE_TIE = 0.5;       // cadence scores this close → let the profile fit choose the mode
const PROFILE_OVERRIDE = 0.08; // how much better a profile fit must be to contradict a signature
const PROFILE_SCALE = 10;      // profile correlation → cadence points, when no signature narrows the field
const SIG_DISTANCE = 2;        // fifths apart before we call the signature and the notes inconsistent

function scoreCandidates(candidates, sums, hist, byKey) {
  return candidates.map((c) => {
    const cad = cadenceScore(sums, c.tonicPc, c.mode, { pcCounts: hist });
    const profile = byKey.get(`${c.tonicPc}:${c.mode}`);
    return { ...c, cadence: cad.score, reasons: cad.reasons, profile: profile == null ? -Infinity : profile };
  });
}

// Pick between a signature's two candidates: cadence decides; a near-tie falls to the profile fit.
function chooseCandidate(scored) {
  const ranked = scored.slice().sort((a, b) => (b.cadence - a.cadence) || (b.profile - a.profile));
  const [top, other] = ranked;
  if (!other) return { winner: top, margin: Infinity, tiedOnCadence: false, ranked };
  const margin = top.cadence - other.cadence;
  if (margin < PROFILE_TIE) {
    const byProfile = scored.slice().sort((a, b) => b.profile - a.profile);
    return { winner: byProfile[0], margin, tiedOnCadence: true, ranked: byProfile };
  }
  return { winner: top, margin, tiedOnCadence: false, ranked };
}

// Pure: the piece's key. `notes` = [{midi, measure, onset|onsetBeats, durBeats?}].
// `fifths` = the notated key signature (null / undefined = none written in the file).
//
// Returns:
//   { key, tonicPc, mode, label,            — the answer ('Am', 9, 'minor', 'A minor')
//     fifths, hasSignature, signatureFits,  — what the page said and whether the notes agree
//     source: 'cadence'|'profile'|'signature',
//     confidence: 'high'|'medium'|'low', ambiguous,
//     reasons: [...], alternatives: [{key,label,tonicPc,mode}] }
export function detectKey(notes, { fifths = null, hasSignature = null } = {}) {
  const written = (fifths == null || fifths === '') ? null : (parseInt(fifths, 10) || 0);
  const sigPresent = hasSignature == null ? written != null : !!hasSignature;
  const sigFifths = written == null ? 0 : written;
  const hist = weightedPcHistogram(notes);
  const anyNotes = hist.some((c) => c > 0);
  const scores = keyScores(hist);
  const byKey = new Map(scores.map((s) => [`${s.tonicPc}:${s.mode}`, s.score]));
  const sums = measureSummaries(notes);
  const reasons = [];

  const nominal = keyCandidatesFromFifths(sigFifths);
  const profileBest = anyNotes ? scores[0] : null;
  const bestProfileScore = profileBest ? profileBest.score : 0;
  // A blank or bare-0 signature is weak evidence — "no sharps" and "nobody wrote the signature" look
  // identical in the file — so the 12 keys' worth of alternatives stay on the table. A real (non-zero)
  // signature is taken at its word: only its two keys are considered.
  const signatureIsWeak = !sigPresent || sigFifths === 0;
  reasons.push(sigPresent
    ? `key signature ${signatureText(sigFifths)} → ${nominal[0].label} or ${nominal[1].label}`
    : `no key signature written → ${nominal[0].label} or ${nominal[1].label} (or the signature is missing)`);

  let chosen, source;
  if (signatureIsWeak) {
    // Every key, judged on where the music cadences, with a penalty for a poor collection fit. The
    // cadence carries the decision (a piece that lands on G with F#s is in G, whatever the blank
    // signature says); the profile term keeps a key with accidental cadence points from winning on
    // notes the piece barely uses.
    const all = [];
    for (let t = 0; t < 12; t++) for (const mode of ['major', 'minor']) {
      const cad = cadenceScore(sums, t, mode, { pcCounts: hist });
      const profile = byKey.get(`${t}:${mode}`);
      const p = profile == null || profile === -Infinity ? bestProfileScore : profile;
      all.push({ tonicPc: t, mode, key: keyNameOf(t, mode), label: keyLabelOf(t, mode),
        cadence: cad.score, reasons: cad.reasons, profile: p,
        total: cad.score + PROFILE_SCALE * (p - bestProfileScore) });
    }
    // Nominal C/Am first among equals: with nothing to separate them, the written signature stands.
    const nominalKeys = new Set(nominal.map((c) => `${c.tonicPc}:${c.mode}`));
    const ranked = all.sort((a, b) => (b.total - a.total)
      || (nominalKeys.has(`${b.tonicPc}:${b.mode}`) ? 1 : 0) - (nominalKeys.has(`${a.tonicPc}:${a.mode}`) ? 1 : 0)
      || (b.profile - a.profile));
    chosen = { winner: ranked[0], margin: ranked[1] ? ranked[0].total - ranked[1].total : Infinity, ranked: ranked.slice(0, 3) };
    source = chosen.winner.cadence > 0 ? 'cadence' : 'profile';
    if (fifthsOfKey(chosen.winner.tonicPc, chosen.winner.mode) !== sigFifths) {
      reasons.push(`the notes fit ${signatureText(fifthsOfKey(chosen.winner.tonicPc, chosen.winner.mode))} — the written signature looks incomplete`);
    }
  } else {
    chosen = chooseCandidate(scoreCandidates(nominal, sums, hist, byKey));
    source = chosen.tiedOnCadence ? 'signature' : 'cadence';
  }

  // Do the notes actually live in the written signature? For a real signature it takes a difference of
  // 2+ accidentals to call it wrong (a modulation or a chromatic passage shifts the profile one step
  // around the circle on its own); for a weak one, landing anywhere else is enough.
  const chosenFifths = fifthsOfKey(chosen.winner.tonicPc, chosen.winner.mode);
  const nominalProfile = Math.max(...nominal.map((c) => byKey.get(`${c.tonicPc}:${c.mode}`) ?? -Infinity));
  const sigMismatch = signatureIsWeak
    ? chosenFifths !== sigFifths
    : (!!profileBest && (bestProfileScore - nominalProfile) > PROFILE_OVERRIDE
       && Math.abs(fifthsOfKey(profileBest.tonicPc, profileBest.mode) - sigFifths) >= SIG_DISTANCE);
  if (sigMismatch && !signatureIsWeak) {
    reasons.push(`written signature ${signatureText(sigFifths)} disagrees with the notes (they fit ${keyLabelOf(profileBest.tonicPc, profileBest.mode)})`);
  }

  const w = chosen.winner;
  reasons.push(...(w.reasons.length ? w.reasons : ['no clear cadence — decided on overall pitch content']));

  let confidence = w.reasons.length === 0 ? 'low'
    : chosen.margin >= MARGIN_HIGH ? 'high' : chosen.margin >= MARGIN_MED ? 'medium' : 'low';
  if (sigMismatch || !sigPresent) confidence = confidence === 'high' ? 'medium' : confidence;
  if (!anyNotes) confidence = 'low';

  const alternatives = [];
  chosen.ranked.slice(1).forEach((c) => alternatives.push({ key: c.key, label: c.label, tonicPc: c.tonicPc, mode: c.mode }));
  if (profileBest && !alternatives.some((a) => a.tonicPc === profileBest.tonicPc && a.mode === profileBest.mode)
      && !(profileBest.tonicPc === w.tonicPc && profileBest.mode === w.mode)) {
    alternatives.push({ key: keyNameOf(profileBest.tonicPc, profileBest.mode), label: keyLabelOf(profileBest.tonicPc, profileBest.mode),
      tonicPc: profileBest.tonicPc, mode: profileBest.mode });
  }

  return {
    key: w.key,
    tonicPc: w.tonicPc,
    mode: w.mode,
    label: w.label,
    fifths: written,
    hasSignature: sigPresent,
    signatureFits: !sigMismatch,
    source,
    confidence,
    ambiguous: !sigPresent || sigMismatch || confidence === 'low',
    reasons,
    alternatives,
  };
}

// Pure: one-line explanation for a tooltip/badge, e.g.
// 'A minor · no ♯/♭ · medium confidence — ends on A in the bass; raised 7th G# …'
export function keyExplanation(detail) {
  if (!detail) return '';
  const head = [detail.label, signatureText(detail.fifths == null ? 0 : detail.fifths) + (detail.hasSignature ? '' : ' (none written)'),
    `${detail.confidence} confidence`].join(' · ');
  const why = (detail.reasons || []).join('; ');
  const alt = (detail.alternatives || []).length ? ` — could also be ${detail.alternatives.map((a) => a.label).join(' / ')}` : '';
  return `${head}${why ? ' — ' + why : ''}${alt}`;
}
