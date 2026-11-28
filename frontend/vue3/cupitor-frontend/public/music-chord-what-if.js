// Original arpeggio readings and hypothetical harmony: move one (optionally
// two) pitches to the next scale note below/above. Never alter score notes.
import { allChords } from './music-reference-data.js';
import { keyNameOf, parseKeyName } from './music-key.js';

const mod = n => ((n % 12) + 12) % 12;
const EPS = 1e-6;
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pcOfName = name => {
  const m = /^([A-G])([#b]*)$/.exec(name || '');
  return m ? mod(NATURAL[m[1]] + [...m[2]].reduce((n, a) => n + (a === '#' ? 1 : -1), 0)) : null;
};
const maskOf = pcs => pcs.reduce((mask, pc) => mask | (1 << pc), 0);

// Spell all seven degrees, including double accidentals, from the chosen tonic.
export function replacementScale(key, minorScale = 'natural') {
  const parsed = typeof key === 'string' ? parseKeyName(key) : key;
  if (!parsed || !Number.isFinite(parsed.tonicPc) || !['major', 'minor'].includes(parsed.mode)) return null;
  const { tonicPc, mode } = parsed;
  const written = typeof key === 'string' && /^\s*([A-Ga-g])\s*([#b♯♭]*)/.exec(key);
  const tonic = written ? written[1].toUpperCase() + written[2].replace(/♯/g, '#').replace(/♭/g, 'b') : keyNameOf(tonicPc, mode).replace(/m$/, '');
  const intervals = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11]
    : minorScale === 'harmonic' ? [0, 2, 3, 5, 7, 8, 11] : [0, 2, 3, 5, 7, 8, 10];
  const start = LETTERS.indexOf(tonic[0]);
  const tones = intervals.map((interval, i) => {
    const pc = mod(tonicPc + interval), letter = LETTERS[(start + i) % 7];
    const diff = ((pc - NATURAL[letter] + 18) % 12) - 6;
    return { pc, name: letter + (diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff)) };
  });
  return { tones, label: `${tonic} ${mode}` + (mode === 'minor' ? ` (${minorScale === 'harmonic' ? 'harmonic' : 'natural'})` : '') };
}

// A pitch already in the key moves to the NEXT distinct scale degree, rather
// than being offered itself as a replacement. Octave crossings retain direction.
export function neighboringScaleNotes(midi, scale) {
  if (!Number.isFinite(midi) || !scale) return [];
  return [-1, 1].map(direction => {
    for (let distance = 1; distance <= 12; distance++) {
      const target = midi + direction * distance;
      const tone = scale.tones.find(t => t.pc === mod(target));
      if (tone) return { midi: target, name: tone.name, delta: direction * distance };
    }
    return null;
  }).filter(Boolean);
}

const pitchLabel = n => `${n.name || SHARPS[mod(n.midi)]}${Math.floor(n.midi / 12) - 1}`;

function chordIndex(dict, scale) {
  const index = new Map(), spelling = new Map(scale.tones.map(t => [t.pc, t.name]));
  Object.keys(dict).forEach(name => {
    const pcs = (dict[name].notes || []).map(pcOfName);
    if (pcs.length < 3 || pcs.some(p => p == null)) return;
    const mask = maskOf(pcs), root = pcs[0];
    const label = name.replace(/^[A-G][#b]*/, spelling.get(root) || SHARPS[root]);
    if (!index.has(mask)) index.set(mask, []);
    if (!index.get(mask).some(c => c.name === label)) index.get(mask).push({ name: label, root, mask,
      tones: pcs.map(p => spelling.get(p) || SHARPS[p]) });
  });
  return index;
}

// Onset sonorities include notes still held from earlier attacks. A bar with
// no three-pitch sonority falls back to its collected notes (an arpeggio), which
// is explicitly labelled separately from notes sounding together.
export function whatIfContexts(notes, { includeBars = false } = {}) {
  const ordered = (notes || []).filter(n => Number.isFinite(n.midi) && Number.isFinite(n.onsetBeats) && !n.grace)
    .slice().sort((a, b) => a.onsetBeats - b.onsetBeats || a.midi - b.midi);
  const bars = new Map(), stacked = new Set(), contexts = [], seen = new Set();
  let active = [];
  for (let i = 0; i < ordered.length;) {
    const onset = ordered[i].onsetBeats, attack = [];
    while (i < ordered.length && Math.abs(ordered[i].onsetBeats - onset) < EPS) attack.push(ordered[i++]);
    attack.forEach(n => { if (!bars.has(n.measure)) bars.set(n.measure, []); bars.get(n.measure).push(n); });
    active = active.filter(n => n.onsetBeats + (n.durBeats || 0) > onset + EPS);
    active.push(...attack);
    const pitches = [...new Map(active.map(n => [n.midi, n])).values()].sort((a, b) => a.midi - b.midi);
    if (new Set(pitches.map(n => mod(n.midi))).size < 3) continue;
    const measure = attack[0].measure;
    stacked.add(measure);
    const id = `${measure}:${pitches.map(n => n.midi).join(',')}`;
    if (seen.has(id)) continue;
    seen.add(id); contexts.push({ measure, onset, kind: 'sounding', notes: pitches });
  }
  bars.forEach((ns, measure) => {
    if (!includeBars && stacked.has(measure)) return;
    const onset = Math.min(...ns.map(n => n.onsetBeats));
    const inherited = ordered.filter(n => n.measure < measure && n.onsetBeats + (n.durBeats || 0) > onset + EPS);
    const collected = inherited.concat(ns);
    if (new Set(collected.map(n => mod(n.midi))).size < 3) return;
    const pitches = [...new Map(collected.map(n => [n.midi, n])).values()].sort((a, b) => a.midi - b.midi);
    contexts.push({ measure, onset, kind: 'bar', notes: pitches });
  });
  return contexts.sort((a, b) => a.measure - b.measure || a.onset - b.onset);
}

function chordMatches(notes, index) {
  const bass = mod(Math.min(...notes.map(n => n.midi)));
  return (index.get(maskOf(notes.map(n => mod(n.midi)))) || []).slice()
    .sort((a, b) => Number(b.root === bass) - Number(a.root === bass) || a.name.localeCompare(b.name));
}

function sourceNotesFor(notes, context) {
  return (notes || []).filter(n => !n.grace && Number.isFinite(n.midi) && Number.isFinite(n.onsetBeats)
    && (context.kind === 'bar' ? n.measure === context.measure || (n.measure < context.measure && n.onsetBeats + (n.durBeats || 0) > context.onset + EPS)
      : n.onsetBeats <= context.onset + EPS && n.onsetBeats + (n.durBeats || 0) > context.onset + EPS));
}

function noteEvidence(original, sources, replacements = new Map(), prefix = 'n') {
  return original.map((n, i) => {
    const target = replacements.get(n.midi) || n;
    return { id: `${prefix}${i + 1}`, from: pitchLabel(n), to: pitchLabel(target),
      fromMidi: n.midi, toMidi: target.midi, changed: replacements.has(n.midi), extra: prefix === 'x',
      sources: [...new Map(sources.filter(s => s.midi === n.midi).sort((a, b) => a.measure - b.measure || a.onsetBeats - b.onsetBeats).map(s => {
        const id = { measure: s.measure, midi: s.midi, onsetBeats: s.onsetBeats };
        return [`${id.measure}:${id.midi}:${id.onsetBeats}`, id];
      })).values()] };
  });
}

// Collected-bar readings complement exact sounding groups. Never merge two
// independent, explicitly sounding chords into one extended-chord label.
// A sustained bass can also support a complete four-tone chord plus ONE
// additional pitch class; that extra is reported explicitly, never discarded.
export function analyzeOriginalHarmony(notes, { key = null, dict = allChords } = {}) {
  const scale = replacementScale(key) || { tones: [] };
  const index = chordIndex(dict, scale), contexts = whatIfContexts(notes, { includeBars: true });
  const dictionary = [...index.values()].flat();
  return contexts.filter(c => c.kind === 'bar').map(bar => {
    const pcs = maskOf(bar.notes.map(n => mod(n.midi)));
    const moments = contexts.filter(c => c.kind === 'sounding' && c.measure === bar.measure);
    if (moments.some(c => maskOf(c.notes.map(n => mod(n.midi))) === pcs)) return null;
    const sounding = moments.filter(c => chordMatches(c.notes, index).length).map(c => maskOf(c.notes.map(n => mod(n.midi))));
    if (sounding.some(a => sounding.some(b => (a & b) !== a && (a & b) !== b))) return null;
    const sources = sourceNotesFor(notes, bar), bassMidi = Math.min(...bar.notes.map(n => n.midi)), bass = mod(bassMidi);
    const start = bar.onset;
    const end = Math.max(...sources.filter(n => n.measure === bar.measure).map(n => n.onsetBeats + (n.durBeats || 0)));
    let covered = 0, until = start;
    sources.filter(n => n.midi === bassMidi).sort((a, b) => a.onsetBeats - b.onsetBeats).forEach(n => {
      const stop = Math.min(end, n.onsetBeats + (n.durBeats || 0));
      covered += Math.max(0, stop - Math.max(until, n.onsetBeats)); until = Math.max(until, stop);
    });
    const exact = chordMatches(bar.notes, index);
    const cores = covered >= .75 * (end - start) && end > start ? dictionary.filter(c => {
      const missing = bar.notes.filter(n => !(c.mask & (1 << mod(n.midi))));
      return c.root === bass && new Set(c.tones.map(pcOfName)).size >= 4 && (c.mask & pcs) === c.mask
        && new Set(missing.map(n => mod(n.midi))).size === 1;
    }) : [];
    const candidates = exact.concat(cores).sort((a, b) => {
      const score = c => (c.root === bass ? 2 : 0) + (c.mask === pcs ? 1 : 0);
      return score(b) - score(a) || a.name.localeCompare(b.name);
    });
    const readings = candidates.slice(0, 3).map(c => {
      const used = bar.notes.filter(n => c.mask & (1 << mod(n.midi)));
      const extra = bar.notes.filter(n => !(c.mask & (1 << mod(n.midi))));
      const bassName = bar.notes.find(n => n.midi === bassMidi).name || SHARPS[bass];
      const extraNames = [...new Set(extra.map(n => n.name || SHARPS[mod(n.midi)]))];
      const displayName = c.name.replace(/maj$/, '') + (c.root !== bass ? `/${bassName}` : '')
        + (extraNames.length ? ` + ${extraNames.join(', ')}` : '');
      const tones = c.tones.map(t => extra.length ? (bar.notes.find(n => mod(n.midi) === pcOfName(t))?.name || t) : t);
      return { name: c.name, displayName, changes: [], chords: [c.name], chordTones: [tones],
        additionalNotes: extra.map(pitchLabel), notes: used.map(pitchLabel),
        evidence: noteEvidence(used, sources).concat(noteEvidence(extra, sources, new Map(), 'x')) };
    });
    return readings.length ? { measure: bar.measure, onset: bar.onset, kind: 'bar', notes: bar.notes.map(pitchLabel), readings } : null;
  }).filter(Boolean);
}

export function exploreChordReplacements(notes, { key, minorScale = 'natural', maxChanges = 1, dict = allChords } = {}) {
  const scale = replacementScale(key, minorScale);
  if (!scale) return { error: 'Choose a key to explore replacements.', contexts: [], originalHarmony: [], scale: null };
  const index = chordIndex(dict, scale), scalePcs = new Set(scale.tones.map(t => t.pc));
  const matchesFor = ns => chordMatches(ns, index);
  const originalHarmony = analyzeOriginalHarmony(notes, { key, dict });
  const contexts = whatIfContexts(notes).map(context => {
    const original = context.notes, suggestions = [];
    // Retain the exact source attacks behind each pitch in the tested group.
    // A collected-bar pitch can occur several times; each of those occurrences
    // must carry the same evidence label on the score. Grace notes never enter.
    const sourceNotes = sourceNotesFor(notes, context);
    const options = original.map(n => neighboringScaleNotes(n.midi, scale));
    let tried = 0;
    function consider(changes) {
      tried++;
      const byMidi = new Map(changes.map(c => [c.from.midi, c.to]));
      const hypothetical = original.map(n => byMidi.get(n.midi) || n);
      const matches = matchesFor(hypothetical);
      if (matches.length) suggestions.push({ changes: changes.map(c => ({
        from: pitchLabel(c.from), to: pitchLabel(c.to), delta: c.to.delta,
        fromMidi: c.from.midi, toMidi: c.to.midi,
        outsideKey: !scalePcs.has(mod(c.from.midi)),
      })), notes: hypothetical.map(pitchLabel), chords: matches.map(c => c.name), chordTones: matches.map(c => c.tones.slice()),
      evidence: noteEvidence(original, sourceNotes, byMidi) });
    }
    original.forEach((from, i) => options[i].forEach(to => consider([{ from, to }])));
    if (Number(maxChanges) >= 2) original.forEach((from, i) => {
      for (let j = i + 1; j < original.length; j++) options[i].forEach(to => options[j].forEach(other =>
        consider([{ from, to }, { from: original[j], to: other }])));
    });
    return { ...context, notes: original.map(pitchLabel), originalChords: matchesFor(original).map(c => c.name),
      barChords: (originalHarmony.find(h => h.measure === context.measure)?.readings || []).map(r => r.displayName), tried, suggestions };
  });
  return { scale, contexts, originalHarmony };
}
